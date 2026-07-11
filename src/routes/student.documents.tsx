import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  FileText, Upload, CheckCircle2, Clock, XCircle, Loader2, Eye, X, RefreshCw, Phone, GraduationCap, Save,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTDateTime } from "@/lib/format";
import {
  REQUIRED_DOCS, FILE_ACCEPT, BUCKET,
  type DocRow, type DocStatus, type EntranceExam, EMPTY_EXAM,
  latestByType, rejectionReasons, extractFatherPhone, extractEntranceExam,
  saveFatherPhone, saveEntranceExam, computeProgress,
} from "@/lib/student-docs";

export const Route = createFileRoute("/student/documents")({
  head: () => ({ meta: [{ title: "Document Vault — EduTrack" }] }),
  component: Documents,
});

function Documents() {
  const maybeUser = useStore((s) => s.user);
  if (!maybeUser) return null;
  const user = maybeUser;

  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocRow | null>(null);
  const [studentPhone, setStudentPhone] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [exam, setExam] = useState<EntranceExam>({ ...EMPTY_EXAM });
  const [savingForm, setSavingForm] = useState<null | "student_phone" | "father_phone" | "entrance_exam">(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const prevStatus = useRef<Map<string, DocStatus>>(new Map());

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: docsData }, { data: profile }] = await Promise.all([
        supabase.from("documents").select("*").eq("student_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      const next = (docsData ?? []) as DocRow[];
      // Live status transition toasts
      const prev = prevStatus.current;
      if (prev.size > 0) {
        for (const d of next) {
          const before = prev.get(d.id);
          if (before && before !== d.status && !d.document_type.startsWith("__meta:")) {
            if (d.status === "verified") toast.success(`Verified — ${d.document_type}`);
            else if (d.status === "rejected") toast.error(`Rejected — ${d.document_type}`);
          }
        }
      }
      prevStatus.current = new Map(next.map((d) => [d.id, d.status]));
      setRows(next);
      setStudentPhone(profile?.phone ?? "");
      setFatherPhone(extractFatherPhone(next));
      setExam(extractEntranceExam(next));
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel(`docs:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `student_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user.id]);

  const uploads = latestByType(rows);
  const rejections = rejectionReasons(rows);
  const progress = computeProgress(rows, studentPhone);
  const pct = Math.round((progress.done / progress.total) * 100);

  async function pickFile(key: string) {
    fileRefs.current[key]?.click();
  }

  async function onFile(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Validate type
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!allowed.includes(file.type) && !["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      toast.error("Only PDF, JPG, or PNG files are accepted.");
      return;
    }
    setUploadingKey(key);
    let fileUrl = "";
    try {
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "bin"}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
      fileUrl = signed?.signedUrl ?? path;
    } catch (err) {
      console.warn("upload failed", err);
      fileUrl = URL.createObjectURL(file);
      toast.warning("Stored locally — cloud upload was blocked");
    }
    // Delete prior row for this doc type so "Replace" behaviour is clean
    const prior = uploads.get(key);
    if (prior) {
      await supabase.from("documents").delete().eq("id", prior.id);
    }
    const { error: insErr } = await supabase.from("documents").insert({
      student_id: user.id,
      student_name: user.name,
      document_type: key,
      file_url: fileUrl,
      status: "pending",
    });
    if (insErr) toast.error(insErr.message);
    else toast.success(`${key} submitted`);
    setUploadingKey(null);
  }




  async function handleSavePhone() {
    setSavingForm("student_phone");
    const { error } = await supabase.from("profiles").update({ phone: studentPhone.trim() || null }).eq("id", user.id);
    setSavingForm(null);
    if (error) return toast.error(error.message);
    toast.success("Mobile number saved");
  }
  async function handleSaveFatherPhone() {
    setSavingForm("father_phone");
    const r = await saveFatherPhone(user.id, user.name, fatherPhone);
    setSavingForm(null);
    if (!r.ok) return toast.error(r.error);
    toast.success("Father's mobile saved");
  }
  async function handleSaveExam() {
    setSavingForm("entrance_exam");
    const r = await saveEntranceExam(user.id, user.name, exam);
    setSavingForm(null);
    if (!r.ok) return toast.error(r.error);
    toast.success("Entrance exam details saved");
  }

  return (
    <div className="pb-8">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-2xl font-black">Document Vault</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload the 11 required items and keep your details up to date.</p>
      </header>

      {/* Progress */}
      <section className="px-5">
        <div className="rounded-2xl bg-surface shadow-soft p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progress</p>
              <p className="text-lg font-black mt-0.5">Documents Completed: {progress.done} / {progress.total}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">{pct}%</p>
              <p className="text-[10px] text-muted-foreground">completion</p>
            </div>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="px-5 mt-6"><div className="rounded-2xl bg-surface shadow-soft p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div></div>
      ) : (
        <>
          {/* 11 required items */}
          <section className="px-5 mt-5 space-y-3">
            {REQUIRED_DOCS.map((item, idx) => {
              const num = idx + 1;
              if (item.kind === "form") {
                return (
                  <FormCard
                    key={item.key}
                    num={num}
                    item={item}
                    studentPhone={studentPhone} setStudentPhone={setStudentPhone}
                    fatherPhone={fatherPhone} setFatherPhone={setFatherPhone}
                    exam={exam} setExam={setExam}
                    saving={savingForm}
                    onSavePhone={handleSavePhone}
                    onSaveFatherPhone={handleSaveFatherPhone}
                    onSaveExam={handleSaveExam}
                  />
                );
              }
              const row = uploads.get(item.key);
              const rejection = row ? rejections.get(row.id) : "";
              const isUploading = uploadingKey === item.key;
              const hasFile = !!row;
              return (
                <div
                  key={item.key}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className="rounded-2xl bg-surface shadow-soft p-4 animate-fade-in transition-all duration-300 hover:shadow-elevated hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent text-primary grid place-items-center shrink-0 text-xs font-black">{num}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{item.label}{item.optional && <span className="ml-2 text-[10px] text-muted-foreground font-normal">optional</span>}</p>
                      {row ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Submitted · {formatISTDateTime(row.created_at)}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Not uploaded yet</p>
                      )}
                    </div>
                    {hasFile && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreview(row!); }}
                        aria-label={`Preview ${item.label}`}
                        className="w-8 h-8 rounded-lg grid place-items-center bg-secondary hover:bg-accent/60 transition-colors shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <StatusTag status={row ? row.status : "pending"} />
                  </div>

                  {rejection && (
                    <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-[12px] text-destructive">
                      <p className="font-bold uppercase text-[10px] tracking-widest mb-0.5">Rejection reason</p>
                      <p className="text-foreground/90">{rejection}</p>
                    </div>
                  )}

                  <input
                    ref={(el) => { fileRefs.current[item.key] = el; }}
                    type="file" className="hidden" accept={FILE_ACCEPT}
                    onChange={(e) => onFile(item.key, e)}
                  />

                  <div className={`mt-3 grid ${hasFile ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); pickFile(item.key); }}
                      disabled={isUploading}
                      className={`h-11 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-70 ${
                        hasFile
                          ? "bg-secondary hover:bg-accent/60 text-foreground border border-border"
                          : "gradient-primary text-primary-foreground shadow-soft hover:shadow-elevated"
                      }`}
                    >
                      {isUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                        : hasFile ? <><RefreshCw className="w-3.5 h-3.5" /> Replace Document</>
                        : <><Upload className="w-3.5 h-3.5" /> Upload Document</>}
                    </button>
                    {hasFile && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setPreview(row!); }}
                        className="h-11 rounded-xl gradient-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-soft hover:shadow-elevated transition-all active:scale-[0.98]"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Checklist summary */}
          <section className="px-5 mt-6">
            <div className="rounded-2xl bg-surface shadow-soft p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Checklist</p>
              <ul className="grid grid-cols-1 gap-1.5">
                {REQUIRED_DOCS.map((it) => {
                  let ok = false;
                  if (it.kind === "file") {
                    const row = uploads.get(it.key);
                    ok = !!row && row.status !== "rejected";
                  } else if (it.formField === "student_phone") ok = !!studentPhone.trim();
                  else if (it.formField === "father_phone") ok = !!fatherPhone.trim();
                  else if (it.formField === "entrance_exam") ok = !!(exam.examName || exam.score);
                  return (
                    <li key={it.key} className="flex items-center gap-2 text-[12px]">
                      <span className={`w-4 h-4 rounded-full grid place-items-center shrink-0 ${ok ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}>
                        {ok ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      </span>
                      <span className="flex-1 truncate">{it.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </>
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function FormCard(props: {
  num: number; item: (typeof REQUIRED_DOCS)[number];
  studentPhone: string; setStudentPhone: (v: string) => void;
  fatherPhone: string; setFatherPhone: (v: string) => void;
  exam: EntranceExam; setExam: (v: EntranceExam) => void;
  saving: null | "student_phone" | "father_phone" | "entrance_exam";
  onSavePhone: () => void; onSaveFatherPhone: () => void; onSaveExam: () => void;
}) {
  const { num, item } = props;
  const isSaving = props.saving === item.formField;
  const complete =
    item.formField === "student_phone" ? !!props.studentPhone.trim() :
    item.formField === "father_phone" ? !!props.fatherPhone.trim() :
    !!(props.exam.examName || props.exam.score);

  return (
    <div className="rounded-2xl bg-surface shadow-soft p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent text-primary grid place-items-center shrink-0 text-xs font-black">{num}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate flex items-center gap-1.5">
            {item.formField === "entrance_exam" ? <GraduationCap className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            {item.label}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Enter as a form field — no file upload required.</p>
        </div>
        <StatusTag status={complete ? "verified" : "pending"} />
      </div>

      {item.formField === "student_phone" && (
        <div className="mt-3 flex gap-2">
          <input value={props.studentPhone} onChange={(e) => props.setStudentPhone(e.target.value)}
            placeholder="e.g. +91 98xxxxxx"
            className="flex-1 h-10 px-3 rounded-xl bg-secondary text-sm font-semibold outline-none" />
          <button onClick={props.onSavePhone} disabled={isSaving}
            className="h-10 px-4 rounded-xl gradient-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-70">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      )}
      {item.formField === "father_phone" && (
        <div className="mt-3 flex gap-2">
          <input value={props.fatherPhone} onChange={(e) => props.setFatherPhone(e.target.value)}
            placeholder="Father's mobile number"
            className="flex-1 h-10 px-3 rounded-xl bg-secondary text-sm font-semibold outline-none" />
          <button onClick={props.onSaveFatherPhone} disabled={isSaving}
            className="h-10 px-4 rounded-xl gradient-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-70">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      )}
      {item.formField === "entrance_exam" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ExamField label="Exam Name" v={props.exam.examName} onChange={(v) => props.setExam({ ...props.exam, examName: v })} />
          <ExamField label="Score" v={props.exam.score} onChange={(v) => props.setExam({ ...props.exam, score: v })} />
          <ExamField label="Rank" v={props.exam.rank} onChange={(v) => props.setExam({ ...props.exam, rank: v })} />
          <ExamField label="Year" v={props.exam.year} onChange={(v) => props.setExam({ ...props.exam, year: v })} />
          <button onClick={props.onSaveExam} disabled={isSaving}
            className="col-span-2 h-10 rounded-xl gradient-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-70">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save entrance details
          </button>
        </div>
      )}
    </div>
  );
}
function ExamField({ label, v, onChange }: { label: string; v: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={v} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 px-3 rounded-xl bg-secondary text-sm font-semibold outline-none" />
    </label>
  );
}

function PreviewModal({ doc, onClose }: { doc: DocRow; onClose: () => void }) {
  const url = doc.file_url;
  const lower = url.split("?")[0].toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(lower) || url.startsWith("data:image") || url.startsWith("blob:");
  const isPdf = /\.pdf$/.test(lower) || url.startsWith("data:application/pdf");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-surface w-full max-w-md max-h-[92vh] rounded-3xl shadow-elevated flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold truncate flex-1">{doc.document_type}</p>
          <StatusTag status={doc.status} />
          <button onClick={onClose} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-accent/50" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-secondary/40 grid place-items-center p-3">
          {isImage ? (
            <img src={url} alt={doc.document_type} className="max-w-full max-h-[70vh] rounded-2xl border border-border bg-white object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={doc.document_type} className="w-full h-[70vh] rounded-2xl border border-border bg-white" />
          ) : (
            <div className="text-center p-8">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Preview not available</p>
              <p className="mt-1 text-xs text-muted-foreground break-all">{url}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatusTag({ status }: { status: DocStatus }) {
  const map = {
    pending:   { Icon: Clock,        label: "Pending",   cls: "bg-muted text-muted-foreground border-border" },
    submitted: { Icon: Upload,       label: "Submitted", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified:  { Icon: CheckCircle2, label: "Verified",  cls: "bg-success/15 text-success border-success/30" },
    rejected:  { Icon: XCircle,      label: "Rejected",  cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const { Icon, label, cls } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}
