// Client-side PDF report generator for the "Download All Student Data" action.
// Uses jsPDF (already installed). Bundles all profile fields, form data,
// verification status, admin remarks (rejection reasons) and links to every
// uploaded document into a single PDF that downloads immediately.

import { jsPDF } from "jspdf";
import { REQUIRED_DOCS, latestByType, type DocRow, type EntranceExam } from "@/lib/student-docs";

export interface StudentPackageInput {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    college: string | null;
    department: string | null;
    batch: string | null;
    avatar_url: string | null;
    created_at: string | null;
  };
  rows: DocRow[];
  fatherPhone: string;
  exam: EntranceExam;
  rejections: Map<string, string>;
}

function safeName(s: string | null | undefined) {
  return (s ?? "student").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60);
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function downloadStudentPackage(input: StudentPackageInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const line = (h = 14) => {
    y += h;
    if (y > pageH - margin) { doc.addPage(); y = margin; }
  };
  const writeH = (t: string, size = 16) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(size);
    doc.text(t, margin, y); line(size + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  };
  const writeKV = (k: string, v: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(k + ":", margin, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(v || "—", pageW - margin * 2 - 120);
    doc.text(wrapped as string[], margin + 120, y);
    line(14 * Math.max(1, (wrapped as string[]).length));
  };
  const rule = () => {
    doc.setDrawColor(220); doc.line(margin, y, pageW - margin, y); line(10);
  };

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("EduTrack — Complete Student Data", margin, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, margin, 60);
  doc.setTextColor(0);
  y = 110;

  // Photo (best effort)
  if (input.profile.avatar_url) {
    const dataUrl = await loadImageAsDataUrl(input.profile.avatar_url);
    if (dataUrl) {
      try { doc.addImage(dataUrl, "JPEG", pageW - margin - 90, 100, 90, 110); }
      catch { /* ignore */ }
    }
  }

  writeH("Profile", 14);
  writeKV("Full Name", input.profile.full_name ?? "—");
  writeKV("Student ID", input.profile.id);
  writeKV("Email", input.profile.email ?? "—");
  writeKV("Student Mobile", input.profile.phone ?? "—");
  writeKV("Father Mobile", input.fatherPhone || "—");
  writeKV("College", input.profile.college ?? "—");
  writeKV("Course / Department", input.profile.department ?? "—");
  writeKV("Batch", input.profile.batch ?? "—");
  writeKV("Registered", input.profile.created_at ? new Date(input.profile.created_at).toLocaleDateString("en-IN") : "—");
  rule();

  writeH("Entrance Exam Details", 14);
  writeKV("Exam Name", input.exam.examName || "—");
  writeKV("Score", input.exam.score || "—");
  writeKV("Rank", input.exam.rank || "—");
  writeKV("Year", input.exam.year || "—");
  rule();

  const uploads = latestByType(input.rows);
  writeH("Document Checklist & Verification", 14);
  for (const it of REQUIRED_DOCS) {
    if (it.kind === "form") {
      const done =
        it.formField === "student_phone" ? !!input.profile.phone :
        it.formField === "father_phone" ? !!input.fatherPhone :
        !!(input.exam.examName || input.exam.score);
      writeKV(it.label, done ? "COMPLETE (form)" : "PENDING");
      continue;
    }
    const row = uploads.get(it.key);
    if (!row) { writeKV(it.label, "NOT UPLOADED"); continue; }
    const status = row.status.toUpperCase();
    writeKV(it.label, `${status} · uploaded ${new Date(row.created_at).toLocaleDateString("en-IN")}`);
    if (row.status === "rejected") {
      const reason = input.rejections.get(row.id);
      if (reason) writeKV("  Admin Remark", reason);
    }
    // File URL underneath (as a clickable link)
    doc.setTextColor(37, 99, 235); doc.setFontSize(9);
    const linkText = doc.splitTextToSize(row.file_url, pageW - margin * 2 - 20) as string[];
    doc.textWithLink(linkText[0] ?? row.file_url, margin + 20, y, { url: row.file_url });
    doc.setTextColor(0);
    line(12);
  }
  rule();

  writeH("Uploaded Files (raw list)", 14);
  const real = input.rows.filter((r) => !r.document_type.startsWith("__meta:"));
  if (real.length === 0) writeKV("(none)", "");
  for (const r of real) {
    writeKV(r.document_type, `${r.status.toUpperCase()} · ${new Date(r.created_at).toLocaleString("en-IN")}`);
    doc.setTextColor(37, 99, 235); doc.setFontSize(9);
    const linkText = doc.splitTextToSize(r.file_url, pageW - margin * 2 - 20) as string[];
    doc.textWithLink(linkText[0] ?? r.file_url, margin + 20, y, { url: r.file_url });
    doc.setTextColor(0);
    line(12);
  }

  const filename = `${safeName(input.profile.full_name)}_${input.profile.id.slice(0, 8)}_CompleteData.pdf`;
  doc.save(filename);
}
