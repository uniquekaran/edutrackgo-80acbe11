// Shared constants + helpers for the Student Document Vault.
// The DB schema is fixed (no migrations allowed), so we encode "meta"
// records — rejection reasons, mobile numbers, entrance exam details —
// inside the existing `documents` table using reserved document_type keys.

import { supabase } from "@/integrations/supabase/client";

export type DocStatus = "pending" | "submitted" | "verified" | "rejected";

export interface DocRow {
  id: string;
  student_id: string;
  student_name: string;
  document_type: string;
  file_url: string;
  status: DocStatus;
  created_at: string;
  updated_at?: string;
}

/** Required student documents in the vault. */
export interface RequiredItem {
  key: string;                // stable key used as `document_type`
  label: string;              // display name
  kind: "file" | "form";      // "form" items are satisfied by profile data, not a file upload
  optional?: boolean;
  formField?: "student_phone" | "father_phone" | "entrance_exam";
}

export const REQUIRED_DOCS: RequiredItem[] = [
  { key: "Trust Registration Certificate",       label: "Trust Registration Certificate", kind: "file" },
  { key: "10th Original Marksheet",              label: "10th Original Marksheet",        kind: "file" },
  { key: "12th Original Marksheet",              label: "12th Original Marksheet",        kind: "file" },
  { key: "Original Aadhaar Card",                label: "Original Aadhaar Card",          kind: "file" },
  { key: "Student Registered Mobile Number",     label: "Student Registered Mobile Number", kind: "form", formField: "student_phone" },
  { key: "Entrance Exam Scorecard / Details",    label: "Entrance Exam Scorecard / Details", kind: "form", formField: "entrance_exam" },
  { key: "Original Income Certificate",          label: "Original Income Certificate",    kind: "file" },
  { key: "Father Mobile Number",                 label: "Father's Mobile Number",         kind: "form", formField: "father_phone" },
  { key: "Original Caste Certificate",           label: "Original Caste Certificate (If Applicable)", kind: "file", optional: true },
  { key: "Original Payment Receipt",             label: "Original Payment Receipt",       kind: "file" },
  { key: "NOC (No Objection Certificate)",       label: "NOC (No Objection Certificate)", kind: "file" },
];

export const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const BUCKET = "student-documents";

// Meta record types encoded inside `documents.document_type`.
const META_REJECTION_PREFIX = "__meta:rejection:";     // key = __meta:rejection:<parent_doc_id>, file_url = reason
const META_FATHER_PHONE = "__meta:father_phone";       // file_url = phone
const META_ENTRANCE = "__meta:entrance_exam";          // file_url = JSON {examName, score, rank, year}

export function isMetaRow(d: { document_type: string }) {
  return d.document_type.startsWith("__meta:");
}

/** Filter DB rows down to visible/real document rows (no meta). */
export function realDocs(rows: DocRow[]): DocRow[] {
  return rows.filter((d) => !isMetaRow(d));
}

/** Return the latest upload row per required document key. */
export function latestByType(rows: DocRow[]): Map<string, DocRow> {
  const map = new Map<string, DocRow>();
  const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const d of sorted) {
    if (isMetaRow(d)) continue;
    if (!map.has(d.document_type)) map.set(d.document_type, d);
  }
  return map;
}

/** Extract rejection reasons keyed by parent doc id. */
export function rejectionReasons(rows: DocRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of rows) {
    if (d.document_type.startsWith(META_REJECTION_PREFIX)) {
      const parentId = d.document_type.slice(META_REJECTION_PREFIX.length);
      out.set(parentId, d.file_url || "");
    }
  }
  return out;
}

export interface EntranceExam {
  examName: string; score: string; rank: string; year: string;
}
export const EMPTY_EXAM: EntranceExam = { examName: "", score: "", rank: "", year: "" };

export function extractFatherPhone(rows: DocRow[]): string {
  const row = rows.find((d) => d.document_type === META_FATHER_PHONE);
  return row?.file_url ?? "";
}

export function extractEntranceExam(rows: DocRow[]): EntranceExam {
  const row = rows.find((d) => d.document_type === META_ENTRANCE);
  if (!row?.file_url) return { ...EMPTY_EXAM };
  try {
    const p = JSON.parse(row.file_url) as Partial<EntranceExam>;
    return { ...EMPTY_EXAM, ...p };
  } catch { return { ...EMPTY_EXAM }; }
}

async function upsertMeta(studentId: string, studentName: string, docType: string, fileUrl: string) {
  // Delete any prior meta row of this type for the student, then insert fresh.
  await supabase.from("documents").delete()
    .eq("student_id", studentId)
    .eq("document_type", docType);
  if (!fileUrl) return { ok: true as const };
  const { error } = await supabase.from("documents").insert({
    student_id: studentId,
    student_name: studentName,
    document_type: docType,
    file_url: fileUrl,
    status: "verified",
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function saveFatherPhone(studentId: string, studentName: string, phone: string) {
  return upsertMeta(studentId, studentName, META_FATHER_PHONE, phone.trim());
}

export async function saveEntranceExam(studentId: string, studentName: string, exam: EntranceExam) {
  const clean: EntranceExam = {
    examName: exam.examName.trim(),
    score: exam.score.trim(),
    rank: exam.rank.trim(),
    year: exam.year.trim(),
  };
  const any = clean.examName || clean.score || clean.rank || clean.year;
  return upsertMeta(studentId, studentName, META_ENTRANCE, any ? JSON.stringify(clean) : "");
}

export async function saveRejectionReason(studentId: string, studentName: string, parentDocId: string, reason: string) {
  const key = META_REJECTION_PREFIX + parentDocId;
  return upsertMeta(studentId, studentName, key, reason.trim());
}

export async function clearRejectionReason(studentId: string, parentDocId: string) {
  const key = META_REJECTION_PREFIX + parentDocId;
  await supabase.from("documents").delete()
    .eq("student_id", studentId)
    .eq("document_type", key);
}

/** Compute progress: how many of the 11 required items are complete. */
export function computeProgress(rows: DocRow[], profilePhone: string): { done: number; total: number } {
  const uploads = latestByType(rows);
  const father = extractFatherPhone(rows);
  const exam = extractEntranceExam(rows);
  let done = 0;
  for (const item of REQUIRED_DOCS) {
    if (item.kind === "file") {
      const row = uploads.get(item.key);
      if (row && row.status !== "rejected") done++;
    } else {
      if (item.formField === "student_phone" && profilePhone.trim()) done++;
      else if (item.formField === "father_phone" && father.trim()) done++;
      else if (item.formField === "entrance_exam" && (exam.examName || exam.score)) done++;
    }
  }
  return { done, total: REQUIRED_DOCS.length };
}
