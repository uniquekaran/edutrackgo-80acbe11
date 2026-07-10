import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Clock, XCircle, Eye, ExternalLink, Loader2, Search, User as UserIcon,
  FileText, Download, ChevronLeft, Users as UsersIcon, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTDate, formatISTDateTime } from "@/lib/format";
import {
  REQUIRED_DOCS, isMetaRow, latestByType, rejectionReasons,
  extractFatherPhone, extractEntranceExam,
  saveRejectionReason, clearRejectionReason,
  type DocRow, type DocStatus,
} from "@/lib/student-docs";
import { downloadStudentPackage } from "@/lib/student-report";

export const Route = createFileRoute("/admin/students")({
  head: () => ({ meta: [{ title: "Master Student List — Admin" }] }),
  component: AdminStudents,
});

interface ProfileLite {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  college: string | null;
  department: string | null;
  batch: string | null;
  avatar_url: string | null;
  created_at: string | null;
}
interface StudentSummary {
  profile: ProfileLite;
  rows: DocRow[];
}

function AdminStudents() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: profs, error: pErr }, { data: docsData, error: dErr }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, phone, college, department, batch, avatar_url, created_at"),
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (dErr) throw dErr;
      // Only show students in the master list
      const roleMap = new Map<string, string>();
      for (const r of roles ?? []) roleMap.set(r.user_id, r.role);
      const students = (profs ?? []).filter((p) => (roleMap.get(p.id) ?? "student") === "student");
      setProfiles(students as ProfileLite[]);
      setDocs((docsData ?? []) as DocRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const summaries: StudentSummary[] = useMemo(() => {
    const byStudent = new Map<string, DocRow[]>();
    for (const d of docs) {
      const list = byStudent.get(d.student_id) ?? [];
      list.push(d);
      byStudent.set(d.student_id, list);
    }
    return profiles.map((p) => ({ profile: p, rows: byStudent.get(p.id) ?? [] }))
      .sort((a, b) => (a.profile.full_name ?? "").localeCompare(b.profile.full_name ?? ""));
  }, [profiles, docs]);

  const filtered = summaries.filter((s) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return (s.profile.full_name ?? "").toLowerCase().includes(n)
      || (s.profile.email ?? "").toLowerCase().includes(n)
      || (s.profile.phone ?? "").toLowerCase().includes(n)
      || s.profile.id.toLowerCase().includes(n);
  });

  const totals = useMemo(() => {
    let approved = 0, rejected = 0, pending = 0, total = 0;
    for (const d of docs) {
      if (isMetaRow(d)) continue;
      total++;
      if (d.status === "verified") approved++;
      else if (d.status === "rejected") rejected++;
      else pending++;
    }
    return { total, approved, rejected, pending };
  }, [docs]);

  if (openId) {
    const s = summaries.find((x) => x.profile.id === openId);
    if (s) return <StudentDetail summary={s} onBack={() => setOpenId(null)} onChanged={load} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Directory</p>
        <h1 className="text-2xl font-black">Master Student List</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Click any student to open their full 360° profile.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Students" value={summaries.length} tone="default" icon={UsersIcon} />
        <Stat label="Verified" value={totals.approved} tone="success" icon={CheckCircle2} />
        <Stat label="Pending" value={totals.pending + totals.total - totals.approved - totals.rejected - totals.pending} tone="warning" icon={Clock} />
        <Stat label="Rejected" value={totals.rejected} tone="danger" icon={XCircle} />
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, mobile, or student ID"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-bold">Student</th>
                <th className="text-left px-4 py-2.5 font-bold">Student ID</th>
                <th className="text-left px-4 py-2.5 font-bold">Course</th>
                <th className="text-left px-4 py-2.5 font-bold">Docs</th>
                <th className="text-left px-4 py-2.5 font-bold">Registered</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No students found.</td></tr>}
              {filtered.map((s) => {
                const uploads = latestByType(s.rows);
                const doneFiles = REQUIRED_DOCS.filter((it) => it.kind === "file" && uploads.get(it.key) && uploads.get(it.key)!.status !== "rejected").length;
                const formDone =
                  (s.profile.phone ? 1 : 0) +
                  (extractFatherPhone(s.rows) ? 1 : 0) +
                  ((extractEntranceExam(s.rows).examName || extractEntranceExam(s.rows).score) ? 1 : 0);
                const done = doneFiles + formDone;
                return (
                  <tr key={s.profile.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => setOpenId(s.profile.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-accent text-primary grid place-items-center shrink-0"><UserIcon className="w-4 h-4" /></div>
                        <div className="min-w-0">
                          <p className="font-bold truncate max-w-[220px]">{s.profile.full_name ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{s.profile.email ?? s.profile.phone ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono truncate max-w-[160px]">{s.profile.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">{s.profile.department ?? s.profile.batch ?? "—"}</td>
                    <td className="px-4 py-3 font-bold">{done}/{REQUIRED_DOCS.length}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{s.profile.created_at ? formatISTDate(s.profile.created_at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "default" | "success" | "warning" | "danger"; icon: typeof CheckCircle2 }) {
  const cls = { default: "bg-secondary text-foreground", success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning-foreground", danger: "bg-destructive/10 text-destructive" }[tone];
  return (
    <div className={`rounded-2xl p-4 border border-border ${cls}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
        <Icon className="w-4 h-4 opacity-70" />
      </div>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

/* -------------------- 360° detail -------------------- */

type Tab = "overview" | "documents" | "verification" | "downloads" | "activity";

function StudentDetail({ summary, onBack, onChanged }: { summary: StudentSummary; onBack: () => void; onChanged: () => void }) {
  const { profile, rows } = summary;
  const [tab, setTab] = useState<Tab>("overview");
  const [preview, setPreview] = useState<DocRow | null>(null);
  const [reasonFor, setReasonFor] = useState<DocRow | null>(null);
  const [busy, setBusy] = useState(false);

  const uploads = latestByType(rows);
  const rejections = rejectionReasons(rows);
  const fatherPhone = extractFatherPhone(rows);
  const exam = extractEntranceExam(rows);
  const realList = rows.filter((r) => !isMetaRow(r));

  async function setStatus(doc: DocRow, status: DocStatus, reason?: string) {
    setBusy(true);
    try {
      const { error } = await supabase.from("documents")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      if (status === "rejected" && reason) {
        const r = await saveRejectionReason(doc.student_id, doc.student_name, doc.id, reason);
        if (!r.ok) throw new Error(r.error);
      } else {
        await clearRejectionReason(doc.student_id, doc.id);
      }
      toast.success(`Document ${status}`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function handleDownload() {
    setBusy(true);
    try {
      await downloadStudentPackage({ profile, rows, fatherPhone, exam, rejections });
      toast.success("Report generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-secondary grid place-items-center"><ChevronLeft className="w-4 h-4" /></button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">360° Student Profile</p>
          <h1 className="text-2xl font-black truncate">{profile.full_name ?? "—"}</h1>
        </div>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="h-11 px-4 rounded-xl gradient-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-2 disabled:opacity-70"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download All Student Data
        </button>
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent text-primary grid place-items-center overflow-hidden shrink-0">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6" />}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 text-xs">
            <Info label="Email" v={profile.email ?? "—"} />
            <Info label="Mobile" v={profile.phone ?? "—"} />
            <Info label="College" v={profile.college ?? "—"} />
            <Info label="Course/Dept" v={profile.department ?? "—"} />
            <Info label="Batch" v={profile.batch ?? "—"} />
            <Info label="Student ID" v={profile.id.slice(0, 8) + "…"} mono />
            <Info label="Father Mobile" v={fatherPhone || "—"} />
            <Info label="Registered" v={profile.created_at ? formatISTDate(profile.created_at) : "—"} />
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
        {(["overview", "documents", "verification", "downloads", "activity"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-4">
          <Section title="Personal">
            <Info label="Full Name" v={profile.full_name ?? "—"} />
            <Info label="Email" v={profile.email ?? "—"} />
            <Info label="Student Mobile" v={profile.phone ?? "—"} />
            <Info label="Father Mobile" v={fatherPhone || "—"} />
          </Section>
          <Section title="Academic">
            <Info label="College" v={profile.college ?? "—"} />
            <Info label="Course / Department" v={profile.department ?? "—"} />
            <Info label="Batch" v={profile.batch ?? "—"} />
          </Section>
          <Section title="Entrance Exam">
            <Info label="Exam Name" v={exam.examName || "—"} />
            <Info label="Score" v={exam.score || "—"} />
            <Info label="Rank" v={exam.rank || "—"} />
            <Info label="Year" v={exam.year || "—"} />
          </Section>
        </div>
      )}

      {tab === "documents" && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft divide-y divide-border">
          {REQUIRED_DOCS.filter((it) => it.kind === "file").map((it) => {
            const row = uploads.get(it.key);
            const reason = row ? rejections.get(row.id) : "";
            return (
              <div key={it.key} className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{it.label}</p>
                    <p className="text-[11px] text-muted-foreground">{row ? formatISTDateTime(row.created_at) : "Not uploaded"}</p>
                  </div>
                  <StatusTag status={row ? row.status : "pending"} />
                  {row && (
                    <>
                      <button onClick={() => setPreview(row)} className="p-2 text-muted-foreground hover:bg-accent rounded-lg"><Eye className="w-4 h-4" /></button>
                      <a href={row.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-primary hover:bg-accent rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                      <button onClick={() => setStatus(row, "verified")} disabled={busy || row.status === "verified"} className="px-2 py-1 rounded-lg bg-success/15 text-success text-[10px] font-bold uppercase disabled:opacity-50">Approve</button>
                      <button onClick={() => setReasonFor(row)} disabled={busy} className="px-2 py-1 rounded-lg bg-destructive/15 text-destructive text-[10px] font-bold uppercase disabled:opacity-50">Reject</button>
                    </>
                  )}
                </div>
                {reason && (
                  <div className="mt-2 rounded-xl bg-destructive/10 border border-destructive/30 p-2 text-[11px] text-destructive">
                    <span className="font-bold">Reason:</span> <span className="text-foreground/90">{reason}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "verification" && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Checklist</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {REQUIRED_DOCS.map((it) => {
              let ok = false;
              if (it.kind === "file") {
                const r = uploads.get(it.key);
                ok = !!r && r.status !== "rejected";
              } else if (it.formField === "student_phone") ok = !!profile.phone;
              else if (it.formField === "father_phone") ok = !!fatherPhone;
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
      )}

      {tab === "downloads" && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft p-5">
          <p className="text-sm font-bold">Complete student package</p>
          <p className="text-xs text-muted-foreground mt-1">Generates a single PDF report containing the student profile, form data, verification status, and links to every uploaded document.</p>
          <button onClick={handleDownload} disabled={busy}
            className="mt-4 h-12 px-5 rounded-xl gradient-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2 disabled:opacity-70">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 📥 Download All Student Data
          </button>
        </div>
      )}

      {tab === "activity" && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft divide-y divide-border">
          {realList.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No activity yet.</p>}
          {realList.map((d) => (
            <div key={d.id} className="p-3 flex items-center gap-3">
              <Upload className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{d.document_type}</p>
                <p className="text-[11px] text-muted-foreground">{formatISTDateTime(d.created_at)}</p>
              </div>
              <StatusTag status={d.status} />
            </div>
          ))}
        </div>
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {reasonFor && (
        <RejectDialog
          doc={reasonFor}
          onCancel={() => setReasonFor(null)}
          onSubmit={async (reason) => {
            await setStatus(reasonFor, "rejected", reason);
            setReasonFor(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function Info({ label, v, mono }: { label: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold truncate ${mono ? "font-mono text-[12px]" : ""}`}>{v}</p>
    </div>
  );
}

function StatusTag({ status }: { status: DocStatus }) {
  const map = {
    pending:   { Icon: Clock,        label: "Pending",   cls: "bg-muted text-muted-foreground border-border" },
    submitted: { Icon: Upload,       label: "Submitted", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified:  { Icon: CheckCircle2, label: "Verified",  cls: "bg-success/15 text-success border-success/30" },
    rejected:  { Icon: XCircle,      label: "Rejected",  cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const { Icon, label, cls } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase border ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function PreviewModal({ doc, onClose }: { doc: DocRow; onClose: () => void }) {
  const url = doc.file_url;
  const lower = url.split("?")[0].toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(lower) || url.startsWith("data:image") || url.startsWith("blob:");
  const isPdf = /\.pdf$/.test(lower) || url.startsWith("data:application/pdf");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-surface w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-elevated flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold truncate flex-1">{doc.document_type}</p>
          <StatusTag status={doc.status} />
        </div>
        <div className="flex-1 overflow-auto bg-secondary/40 grid place-items-center p-3">
          {isImage ? <img src={url} alt="" className="max-w-full max-h-[70vh] rounded-2xl border border-border bg-white object-contain" />
            : isPdf ? <iframe src={url} title={doc.document_type} className="w-full h-[70vh] rounded-2xl border border-border bg-white" />
            : <p className="text-xs text-muted-foreground break-all p-6">{url}</p>}
        </div>
        <div className="p-4 border-t border-border flex gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 h-11 rounded-xl bg-secondary text-sm font-bold flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> Open</a>
          <button onClick={onClose} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground text-sm font-bold">Close</button>
        </div>
      </div>
    </div>
  );
}

function RejectDialog({ doc, onCancel, onSubmit }: { doc: DocRow; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={onCancel}>
      <div className="bg-surface w-full max-w-md rounded-3xl shadow-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold">Reject "{doc.document_type}"</p>
        <p className="text-xs text-muted-foreground mt-1">Reason will be shown to the student.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
          placeholder="e.g. document is blurry, wrong document uploaded, missing page…"
          className="mt-3 w-full p-3 rounded-xl bg-secondary text-sm outline-none" />
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 h-11 rounded-xl bg-secondary text-sm font-bold">Cancel</button>
          <button onClick={() => reason.trim() ? onSubmit(reason.trim()) : toast.error("Reason is required")}
            className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold">Reject</button>
        </div>
      </div>
    </div>
  );
}
