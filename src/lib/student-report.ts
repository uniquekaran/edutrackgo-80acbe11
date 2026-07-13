// Client-side PDF report generator for the "Download All Student Data" action.
// Layout:
//   Page 1 top:    Bio-Data Matrix (name, course, mobile, father's mobile, email)
//   Page 1 bottom: Document Status Checklist table (S.No, Doc, Status, Remarks, Open Document link)
//   Pages 2..N:    One page per uploaded document image, in the canonical vault order.
//                  PDFs cannot be embedded as images — a note is added instead.
// Uses jsPDF + jspdf-autotable (both already installed).

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

function isPdfUrl(url: string): boolean {
  const lower = url.split("?")[0].toLowerCase();
  return /\.pdf$/.test(lower) || url.startsWith("data:application/pdf");
}

function isImageUrl(url: string): boolean {
  const lower = url.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|avif)$/.test(lower) || url.startsWith("data:image") || url.startsWith("blob:");
}

async function loadAsDataUrl(url: string): Promise<string | null> {
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

async function measureImage(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

export async function downloadStudentPackage(input: StudentPackageInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const HEADER_H = 60;
  const FOOTER_H = 30;
  const generatedAt = new Date().toLocaleString("en-IN");
  const studentLabel = input.profile.full_name ?? input.profile.email ?? input.profile.id.slice(0, 8);

  const drawChrome = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, HEADER_H, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("EduTrack — Institutional Student Dossier", margin, 24);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Student: ${studentLabel}`, margin, 42);
    doc.text(`Generated ${generatedAt}`, pageW - margin, 42, { align: "right" });
    doc.setTextColor(0);
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

  drawChrome();

  // ---------- PAGE 1 (top): Bio-Data Matrix ----------
  const bioTop = HEADER_H + 20;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Bio-Data Matrix", margin, bioTop);

  const bioRows: Array<[string, string]> = [
    ["Full Name", input.profile.full_name ?? "—"],
    ["Course", input.profile.department ?? input.profile.batch ?? "—"],
    ["Student Mobile", input.profile.phone ?? "—"],
    ["Father's Mobile", input.fatherPhone || "—"],
    ["Email", input.profile.email ?? "—"],
  ];
  autoTable(doc, {
    startY: bioTop + 8,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 140, fillColor: [241, 245, 249] }, 1: { cellWidth: "auto" } },
    body: bioRows,
  });

  // ---------- PAGE 1 (bottom): Document Status Checklist ----------
  const afterBioY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? bioTop + 100;
  const checklistTop = afterBioY + 24;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Document Status Checklist", margin, checklistTop);

  const uploads = latestByType(input.rows);
  const fileItems = REQUIRED_DOCS.filter((it) => it.kind === "file");
  const checklistBody = fileItems.map((it, idx) => {
    const row = uploads.get(it.key);
    const status = row ? row.status.toUpperCase() : "PENDING";
    const remark = row?.status === "rejected" ? (input.rejections.get(row.id) ?? "") : "";
    const url = row?.file_url ?? "";
    return [String(idx + 1), it.label, status, remark || "—", url ? "Open Document" : "—"];
  });

  // Track link cell metadata so we can draw clickable overlays after the table renders.
  const linkCells: Array<{ row: number; url: string; x: number; y: number; w: number; h: number }> = [];

  autoTable(doc, {
    startY: checklistTop + 8,
    margin: { left: margin, right: margin },
    theme: "striped",
    head: [["S.No", "Document Name", "Status", "Admin Remarks", "Link"]],
    body: checklistBody,
    styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32, halign: "center" },
      1: { cellWidth: 160 },
      2: { cellWidth: 60, halign: "center", fontStyle: "bold" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 80, halign: "center", textColor: [37, 99, 235], fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const s = String(data.cell.raw);
        if (s === "VERIFIED") data.cell.styles.textColor = [16, 122, 87];
        else if (s === "REJECTED") data.cell.styles.textColor = [190, 30, 45];
        else data.cell.styles.textColor = [180, 100, 0];
      }
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const url = checklistBody[data.row.index]?.[4] === "Open Document" ? String(fileItems[data.row.index] ? uploads.get(fileItems[data.row.index].key)?.file_url ?? "" : "") : "";
        if (url) {
          linkCells.push({ row: data.row.index, url, x: data.cell.x, y: data.cell.y, w: data.cell.width, h: data.cell.height });
        }
      }
    },
  });

  // Overlay clickable links onto the "Open Document" cells.
  for (const c of linkCells) {
    doc.link(c.x, c.y, c.w, c.h, { url: c.url });
  }

  // ---------- PAGES 2..N: one document image per page ----------
  // Canonical order = REQUIRED_DOCS (keeps vault + PDF in sync).
  for (const it of fileItems) {
    const row = uploads.get(it.key);
    if (!row || !row.file_url) continue; // skip missing — never insert blank pages
    const url = row.file_url;

    doc.addPage();
    drawChrome();

    // Document header
    const titleY = HEADER_H + 30;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(it.label, margin, titleY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Status: ${row.status.toUpperCase()} · uploaded ${new Date(row.created_at).toLocaleDateString("en-IN")}`, margin, titleY + 14);
    doc.setTextColor(0);

    const bodyTop = titleY + 30;
    const availW = pageW - margin * 2;
    const availH = pageH - FOOTER_H - bodyTop - 10;

    if (isPdfUrl(url)) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(11);
      doc.setTextColor(120);
      doc.text("Document is a PDF — open via the link on page 1", pageW / 2, bodyTop + availH / 2, { align: "center" });
      doc.setTextColor(0);
      continue;
    }

    if (!isImageUrl(url)) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(11);
      doc.setTextColor(120);
      doc.text("Unsupported file type — open via the link on page 1", pageW / 2, bodyTop + availH / 2, { align: "center" });
      doc.setTextColor(0);
      continue;
    }

    const dataUrl = await loadAsDataUrl(url);
    if (!dataUrl) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(11);
      doc.setTextColor(150, 60, 60);
      doc.text("Could not load image — open via the link on page 1", pageW / 2, bodyTop + availH / 2, { align: "center" });
      doc.setTextColor(0);
      continue;
    }
    const size = await measureImage(dataUrl);
    if (!size) continue;
    const scale = Math.min(availW / size.w, availH / size.h);
    const drawW = size.w * scale;
    const drawH = size.h * scale;
    const x = margin + (availW - drawW) / 2;
    const y = bodyTop + (availH - drawH) / 2;
    try {
      doc.addImage(dataUrl, imageFormat(dataUrl), x, y, drawW, drawH);
    } catch {
      doc.setFont("helvetica", "italic"); doc.setFontSize(11);
      doc.setTextColor(150, 60, 60);
      doc.text("Image could not be embedded — open via the link on page 1", pageW / 2, bodyTop + availH / 2, { align: "center" });
      doc.setTextColor(0);
    }
  }

  stampFooters();

  const filename = `${safeName(input.profile.full_name)}_${input.profile.id.slice(0, 8)}_CompleteData.pdf`;
  doc.save(filename);
}

