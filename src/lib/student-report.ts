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
  const HEADER_H = 60;
  const FOOTER_H = 30;
  const contentTop = HEADER_H + 20;
  const generatedAt = new Date().toLocaleString("en-IN");
  const studentLabel = input.profile.full_name ?? input.profile.email ?? input.profile.id.slice(0, 8);
  let y = contentTop;

  const drawChrome = () => {
    // Header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, HEADER_H, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("EduTrack — Institutional Student Dossier", margin, 24);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Student: ${studentLabel}`, margin, 42);
    doc.text(`Generated ${generatedAt}`, pageW - margin, 42, { align: "right" });
    doc.setTextColor(0);
    // Footer rule
    doc.setDrawColor(220);
    doc.line(margin, pageH - FOOTER_H, pageW - margin, pageH - FOOTER_H);
  };

  const stampFooters = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("EduTrack · Confidential", margin, pageH - 12);
      doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 12, { align: "right" });
      doc.setTextColor(0);
    }
  };

  const newPage = () => { doc.addPage(); drawChrome(); y = contentTop; };
  const ensure = (h: number) => { if (y > pageH - FOOTER_H - h) newPage(); };

  const line = (h = 14) => { y += h; if (y > pageH - FOOTER_H - 10) newPage(); };
  const writeH = (t: string, size = 14) => {
    ensure(size + 10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(size);
    doc.text(t, margin, y); line(size + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  };
  const writeKV = (k: string, v: string) => {
    ensure(20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(k + ":", margin, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(v || "—", pageW - margin * 2 - 120) as string[];
    doc.text(wrapped, margin + 120, y);
    line(14 * Math.max(1, wrapped.length));
  };
  const writeLinkedUrl = (url: string | null | undefined) => {
    ensure(12);
    const clean = (url ?? "").trim();
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    if (!clean) {
      doc.setTextColor(150, 60, 60);
      doc.text("— No file available (missing storage path)", margin + 20, y);
      line(11);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      return;
    }
    const isLinkable = /^https?:\/\//i.test(clean);
    const lines = doc.splitTextToSize(clean, pageW - margin * 2 - 20) as string[];
    doc.setFont("helvetica", "normal");
    doc.setTextColor(isLinkable ? 37 : 120, isLinkable ? 99 : 120, isLinkable ? 235 : 120);
    for (const chunk of lines.slice(0, 4)) {
      ensure(12);
      if (isLinkable) doc.textWithLink(chunk, margin + 20, y, { url: clean });
      else doc.text(chunk, margin + 20, y);
      line(11);
    }
    doc.setTextColor(0);
  };
  const rule = () => { ensure(14); doc.setDrawColor(220); doc.line(margin, y, pageW - margin, y); line(10); };

  drawChrome();

  // Photo (best effort)
  if (input.profile.avatar_url) {
    const dataUrl = await loadImageAsDataUrl(input.profile.avatar_url);
    if (dataUrl) {
      try { doc.addImage(dataUrl, "JPEG", pageW - margin - 90, contentTop, 90, 110); }
      catch { /* ignore */ }
    }
  }

  writeH("Bio-Data");
  writeKV("Full Name", input.profile.full_name ?? "—");
  writeKV("Student ID", input.profile.id);
  writeKV("Email", input.profile.email ?? "—");
  writeKV("College", input.profile.college ?? "—");
  writeKV("Course Track", input.profile.department ?? input.profile.batch ?? "—");
  writeKV("Department", input.profile.department ?? "—");
  writeKV("Batch", input.profile.batch ?? "—");
  writeKV("Registration Date", input.profile.created_at ? new Date(input.profile.created_at).toLocaleString("en-IN") : "—");
  rule();

  writeH("Contact Matrix");
  writeKV("Student Mobile", input.profile.phone ?? "—");
  writeKV("Father Mobile", input.fatherPhone || "—");
  rule();

  writeH("Entrance Exam");
  writeKV("Exam Name", input.exam.examName || "—");
  writeKV("Earned Score", input.exam.score || "—");
  writeKV("Secure Rank", input.exam.rank || "—");
  writeKV("Year", input.exam.year || "—");
  rule();

  const uploads = latestByType(input.rows);
  newPage();
  writeH("11-Point Document Verification");
  for (const it of REQUIRED_DOCS) {
    ensure(60);
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

  writeH("Uploaded Asset Links");
  const real = input.rows.filter((r) => !r.document_type.startsWith("__meta:"));
  if (real.length === 0) writeKV("(none)", "");
  for (const r of real) {
    writeKV(r.document_type, `${r.status.toUpperCase()} · ${new Date(r.created_at).toLocaleString("en-IN")}`);
    const reason = input.rejections.get(r.id);
    if (reason) writeKV("Admin Remark", reason);
    writeLinkedUrl(r.file_url);
  }

  stampFooters();

  const filename = `${safeName(input.profile.full_name)}_${input.profile.id.slice(0, 8)}_CompleteData.pdf`;
  doc.save(filename);
}

