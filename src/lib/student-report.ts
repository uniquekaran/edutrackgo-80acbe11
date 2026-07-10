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
    if (y > pageH - margin - 26) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(k + ":", margin, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(v || "—", pageW - margin * 2 - 120);
    doc.text(wrapped as string[], margin + 120, y);
    line(14 * Math.max(1, (wrapped as string[]).length));
  };
  const writeLinkedUrl = (url: string) => {
    const lines = doc.splitTextToSize(url, pageW - margin * 2 - 20) as string[];
    doc.setTextColor(37, 99, 235); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    for (const chunk of lines.slice(0, 4)) {
      if (y > pageH - margin - 12) { doc.addPage(); y = margin; }
      doc.textWithLink(chunk, margin + 20, y, { url });
      line(11);
    }
    doc.setTextColor(0);
  };
  const rule = () => {
    doc.setDrawColor(220); doc.line(margin, y, pageW - margin, y); line(10);
  };

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("EduTrack — Janam Kundli Student Dossier", margin, 40);
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

  writeH("Full Personal Profile", 14);
  writeKV("Full Name", input.profile.full_name ?? "—");
  writeKV("Student ID", input.profile.id);
  writeKV("Email", input.profile.email ?? "—");
  writeKV("Verified Student Mobile", input.profile.phone ?? "—");
  writeKV("Verified Father Mobile", input.fatherPhone || "—");
  writeKV("College", input.profile.college ?? "—");
  writeKV("Course Track", input.profile.department ?? input.profile.batch ?? "—");
  writeKV("Department", input.profile.department ?? "—");
  writeKV("Batch", input.profile.batch ?? "—");
  writeKV("Absolute Registration Date", input.profile.created_at ? new Date(input.profile.created_at).toLocaleString("en-IN") : "—");
  rule();

  writeH("Entrance Exam Card", 14);
  writeKV("Exam Name", input.exam.examName || "—");
  writeKV("Earned Score", input.exam.score || "—");
  writeKV("Secure Rank", input.exam.rank || "—");
  writeKV("Year", input.exam.year || "—");
  rule();

  const uploads = latestByType(input.rows);
  doc.addPage();
  y = margin;
  writeH("11-Point Validation Checklist Matrix", 14);
  for (const it of REQUIRED_DOCS) {
    if (y > pageH - margin - 70) { doc.addPage(); y = margin; }
    if (it.kind === "form") {
      const done =
        it.formField === "student_phone" ? !!input.profile.phone :
        it.formField === "father_phone" ? !!input.fatherPhone :
        !!(input.exam.examName || input.exam.score);
      const value =
        it.formField === "student_phone" ? (input.profile.phone ?? "—") :
        it.formField === "father_phone" ? (input.fatherPhone || "—") :
        `${input.exam.examName || "—"} · Score: ${input.exam.score || "—"} · Rank: ${input.exam.rank || "—"} · Year: ${input.exam.year || "—"}`;
      writeKV(it.label, `${done ? "COMPLETE" : "PENDING"} · ${value}`);
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
    writeLinkedUrl(row.file_url);
  }
  rule();

  writeH("Uploaded Asset Links", 14);
  const real = input.rows.filter((r) => !r.document_type.startsWith("__meta:"));
  if (real.length === 0) writeKV("(none)", "");
  for (const r of real) {
    writeKV(r.document_type, `${r.status.toUpperCase()} · ${new Date(r.created_at).toLocaleString("en-IN")}`);
    const reason = input.rejections.get(r.id);
    if (reason) writeKV("Admin Remark", reason);
    writeLinkedUrl(r.file_url);
  }

  const filename = `${safeName(input.profile.full_name)}_${input.profile.id.slice(0, 8)}_CompleteData.pdf`;
  doc.save(filename);
}
