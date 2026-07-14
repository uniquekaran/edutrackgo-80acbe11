import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Clock, XCircle, Eye, ExternalLink, Loader2, Search, User as UserIcon,
  FileText, Download, ChevronLeft, Users as UsersIcon, Upload, FileDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTDate, formatISTDateTime } from "@/lib/format";
import {
  REQUIRED_DOCS, isMetaRow, latestByType, rejectionReasons,
  extractFatherPhone, extractEntranceExam,
  saveRejectionReason, clearRejectionReason,
  saveFatherPhone, saveEntranceExam,
  type DocRow, type DocStatus, type EntranceExam,
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

type FilterKind = "all" | "pending" | "verified" | "rejected";
type DbDiagnostic = { source: "profiles" | "documents" | "client"; level: "error" | "warning"; message: string };

function formatDbError(source: "profiles" | "documents", error: unknown) {
  const err = error as { message?: string; code?: string; details?: string; hint?: string };
  return [
    `${source} error: ${err.message ?? String(error)}`,
    err.code ? `code=${err.code}` : "",
    err.details ? `details=${err.details}` : "",
    err.hint ? `hint=${err.hint}` : "",
  ].filter(Boolean).join(" · ");
}

function AdminStudents() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [diagnostics, setDiagnostics] = useState<DbDiagnostic[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  async function load() {
    setLoading(true);
    const nextDiagnostics: DbDiagnostic[] = [];
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      nextDiagnostics.push({ source: "client", level: "error", message: `client error: ${sessionError.message}` });
    } else if (!sessionData.session) {
      nextDiagnostics.push({ source: "client", level: "warning", message: "Connection Warning: no authenticated browser session is present, so protected database reads may return 0 rows." });
    } else if ((sessionData.session.user.email ?? "").toLowerCase() !== "vset.official@gmail.com") {
      nextDiagnostics.push({ source: "client", level: "warning", message: `Connection Warning: active session is ${sessionData.session.user.email ?? "unknown"}, not vset.official@gmail.com.` });
    }

    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      nextDiagnostics.push({
        source: "client",
        level: "error",
        message: "client error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. The browser client cannot connect to the configured production backend.",
      });
    }

    try {
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, college, department, batch, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(10000);

      if (pErr) {
        nextDiagnostics.push({ source: "profiles", level: "error", message: formatDbError("profiles", pErr) });
        setProfiles([]);
      } else {
        const allProfiles = (profs ?? []) as ProfileLite[];
        if (allProfiles.length === 0) {
          nextDiagnostics.push({
            source: "profiles",
            level: "warning",
            message: "Connection Warning: profiles query returned 0 rows. No frontend role filters were applied.",
          });
        }
        setProfiles(allProfiles);
      }
    } catch (e) {
      nextDiagnostics.push({ source: "profiles", level: "error", message: formatDbError("profiles", e) });
      setProfiles([]);
    }

    try {
      const { data: docsData, error: dErr } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000);

      if (dErr) {
        nextDiagnostics.push({ source: "documents", level: "error", message: formatDbError("documents", dErr) });
        setDocs([]);
      } else {
        const allDocs = (docsData ?? []) as DocRow[];
        if (allDocs.length === 0) {
          nextDiagnostics.push({
            source: "documents",
            level: "warning",
            message: "Connection Warning: documents query returned 0 rows. Student profiles will still render if profiles exist.",
          });
        }
        setDocs(allDocs);
      }
    } catch (e) {
      nextDiagnostics.push({ source: "documents", level: "error", message: formatDbError("documents", e) });
      setDocs([]);
    } finally {
      setDiagnostics(nextDiagnostics);
      if (nextDiagnostics.some((item) => item.level === "error")) toast.error("Database error visible on screen.");
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // Live sync
    const ch = supabase
      .channel("admin-students-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const summaries = useMemo(() => {
    const byStudent = new Map<string, DocRow[]>();
    for (const d of docs) {
      const list = byStudent.get(d.student_id) ?? [];
      list.push(d);
      byStudent.set(d.student_id, list);
    }
    return profiles.map((p) => {
      const rows = byStudent.get(p.id) ?? [];
      const uploads = latestByType(rows);
      const fileDone = REQUIRED_DOCS.filter((it) => it.kind === "file" && uploads.get(it.key) && uploads.get(it.key)!.status !== "rejected").length;
      const formDone =
        (p.phone ? 1 : 0) +
        (extractFatherPhone(rows) ? 1 : 0) +
        ((extractEntranceExam(rows).examName || extractEntranceExam(rows).score) ? 1 : 0);
      const done = fileDone + formDone;
      const pendingAction = Array.from(uploads.values()).some((r) => r.status === "pending");
      const fullyVerified = done === REQUIRED_DOCS.length &&
        REQUIRED_DOCS.filter((it) => it.kind === "file").every((it) => uploads.get(it.key)?.status === "verified");
      return { profile: p, rows, done, pendingAction, fullyVerified };
    }).sort((a, b) => (a.profile.full_name ?? "").localeCompare(b.profile.full_name ?? ""));
  }, [profiles, docs]);

  const counts = useMemo(() => ({
    all: summaries.length,
    pending: summaries.filter((s) => s.pendingAction).length,
    verified: summaries.filter((s) => s.fullyVerified).length,
    rejected: summaries.filter((s) => overallStatus(s.rows) === "Rejected").length,
  }), [summaries]);

  const filtered = summaries.filter((s) => {
    if (filter === "pending" && !s.pendingAction) return false;
    if (filter === "verified" && !s.fullyVerified) return false;
    if (filter === "rejected" && overallStatus(s.rows) !== "Rejected") return false;
    if (!q) return true;
    const n = q.toLowerCase();
    return (s.profile.full_name ?? "").toLowerCase().includes(n)
      || (s.profile.email ?? "").toLowerCase().includes(n)
      || (s.profile.phone ?? "").toLowerCase().includes(n)
      || s.profile.id.toLowerCase().includes(n);
  });

  // Overall status per student: Rejected > Pending > Verified.
  function overallStatus(rows: DocRow[]): "Rejected" | "Pending" | "Verified" {
    const uploads = latestByType(rows);
    let anyRejected = false;
    let anyPending = false;
    for (const it of REQUIRED_DOCS.filter((x) => x.kind === "file")) {
      const row = uploads.get(it.key);
      if (!row) { anyPending = true; continue; }
      if (row.status === "rejected") anyRejected = true;
      else if (row.status !== "verified") anyPending = true;
    }
    if (anyRejected) return "Rejected";
    if (anyPending) return "Pending";
    return "Verified";
  }

  function csvEscape(v: string): string {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  function handleExportCsv() {
    const header = ["Name", "Email", "Status"];
    const lines = [header.join(",")];
    for (const s of summaries) {
      const status = overallStatus(s.rows);
      lines.push([
        csvEscape(s.profile.full_name ?? ""),
        csvEscape(s.profile.email ?? ""),
        status,
      ].join(","));
    }
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `eduTrack_students_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (openId) {
    const s = summaries.find((x) => x.profile.id === openId);
    if (s) return <StudentDetail summary={{ profile: s.profile, rows: s.rows }} onBack={() => setOpenId(null)} onChanged={load} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Directory</p>
          <h1 className="text-2xl font-black">Master Student List</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Click any student to open their full 360° profile.</p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={loading || summaries.length === 0}
          className="h-10 px-4 rounded-xl gradient-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-2 disabled:opacity-60 shadow-soft"
        >
          <FileDown className="w-4 h-4" /> Export to CSV
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft p-4 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Database diagnostics</p>
          {diagnostics.map((item, index) => (
            <div
              key={`${item.source}-${index}`}
              className={`rounded-xl border p-3 text-xs font-semibold ${item.level === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning-foreground"}`}
            >
              {item.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FilterTile active={filter === "all"} onClick={() => setFilter("all")} label="All Students" value={counts.all} tone="default" icon={UsersIcon} />
        <FilterTile active={filter === "pending"} onClick={() => setFilter("pending")} label="Pending Action" value={counts.pending} tone="warning" icon={Clock} />
        <FilterTile active={filter === "verified"} onClick={() => setFilter("verified")} label="Fully Verified" value={counts.verified} tone="success" icon={CheckCircle2} />
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft p-4">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, mobile, or student ID"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKind)}
            className="h-10 px-3 rounded-xl bg-secondary text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Filter by status"
          >
            <option value="all">All ({counts.all})</option>
            <option value="verified">Verified ({counts.verified})</option>
            <option value="pending">Pending ({counts.pending})</option>
            <option value="rejected">Rejected ({counts.rejected})</option>
          </select>
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
                <th className="text-left px-4 py-2.5 font-bold">Progress</th>
                <th className="text-left px-4 py-2.5 font-bold">Registered</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No students found.</td></tr>}
              {filtered.map((s) => {
                const pct = Math.round((s.done / REQUIRED_DOCS.length) * 100);
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
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold tabular-nums">{s.done}/{REQUIRED_DOCS.length}</span>
                      </div>
                    </td>
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

function FilterTile({ active, onClick, label, value, tone, icon: Icon }: { active: boolean; onClick: () => void; label: string; value: number; tone: "default" | "success" | "warning"; icon: typeof CheckCircle2 }) {
  const toneCls = { default: "text-foreground", success: "text-success", warning: "text-warning-foreground" }[tone];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl p-4 border transition-all ${active ? "bg-accent border-primary shadow-soft ring-2 ring-primary/40" : "bg-surface border-border hover:bg-accent/30"}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className={`w-4 h-4 ${toneCls}`} />
      </div>
      <p className={`text-2xl font-black mt-1 ${toneCls}`}>{value}</p>
    </button>
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
        <OverviewTab
          profile={profile}
          fatherPhone={fatherPhone}
          exam={exam}
          onChanged={onChanged}
        />
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

function OverviewTab({ profile, fatherPhone, exam, onChanged }: {
  profile: ProfileLite;
  fatherPhone: string;
  exam: EntranceExam;
  onChanged: () => void;
}) {
  const [studentPhone, setStudentPhone] = useState(profile.phone ?? "");
  const [fPhone, setFPhone] = useState(fatherPhone);
  const [ex, setEx] = useState<EntranceExam>(exam);
  const [saving, setSaving] = useState<string | null>(null);

  async function savePhone() {
    setSaving("phone");
    try {
      const { error } = await supabase.from("profiles").update({ phone: studentPhone.trim() || null }).eq("id", profile.id);
      if (error) throw error;
      toast.success("Student mobile updated");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(null); }
  }
  async function saveFather() {
    setSaving("father");
    const r = await saveFatherPhone(profile.id, profile.full_name ?? "", fPhone);
    if (!r.ok) toast.error(r.error ?? "Failed to save");
    else { toast.success("Father mobile updated"); onChanged(); }
    setSaving(null);
  }
  async function saveExam() {
    setSaving("exam");
    const r = await saveEntranceExam(profile.id, profile.full_name ?? "", ex);
    if (!r.ok) toast.error(r.error ?? "Failed to save");
    else { toast.success("Entrance exam updated"); onChanged(); }
    setSaving(null);
  }

  const inputCls = "w-full h-10 px-3 rounded-xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40";
  const labelCls = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Personal</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Info label="Full Name" v={profile.full_name ?? "—"} />
          <Info label="Email" v={profile.email ?? "—"} />
          <div>
            <label className={labelCls}>Student Mobile</label>
            <div className="mt-1 flex gap-2">
              <input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className={inputCls} placeholder="+91…" />
              <button onClick={savePhone} disabled={saving === "phone"} className="px-3 h-10 rounded-xl gradient-primary text-primary-foreground text-xs font-bold disabled:opacity-70">Save</button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Father Mobile</label>
            <div className="mt-1 flex gap-2">
              <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className={inputCls} placeholder="+91…" />
              <button onClick={saveFather} disabled={saving === "father"} className="px-3 h-10 rounded-xl gradient-primary text-primary-foreground text-xs font-bold disabled:opacity-70">Save</button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Academic</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Info label="College" v={profile.college ?? "—"} />
          <Info label="Course / Department" v={profile.department ?? "—"} />
          <Info label="Batch" v={profile.batch ?? "—"} />
          <Info label="Student ID" v={profile.id.slice(0, 8) + "…"} mono />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Entrance Exam</p>
          <button onClick={saveExam} disabled={saving === "exam"} className="px-3 h-9 rounded-xl gradient-primary text-primary-foreground text-xs font-bold disabled:opacity-70">Save Exam</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Exam Name</label>
            <input value={ex.examName} onChange={(e) => setEx({ ...ex, examName: e.target.value })} className={`${inputCls} mt-1`} placeholder="JEE, NEET…" />
          </div>
          <div>
            <label className={labelCls}>Score</label>
            <input value={ex.score} onChange={(e) => setEx({ ...ex, score: e.target.value })} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label className={labelCls}>Rank</label>
            <input value={ex.rank} onChange={(e) => setEx({ ...ex, rank: e.target.value })} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label className={labelCls}>Year</label>
            <input value={ex.year} onChange={(e) => setEx({ ...ex, year: e.target.value })} className={`${inputCls} mt-1`} />
          </div>
        </div>
      </div>
    </div>
  );
}

