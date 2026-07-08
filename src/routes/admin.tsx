import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, ShieldCheck, Megaphone, LogOut, CheckCircle2, XCircle, Send,
  FileText, Search, ChevronRight, X, Loader2, BarChart3,
  CalendarCheck, AlertTriangle, BookOpen, Upload, Trash2, Activity,
  Sparkles, TrendingUp, Radio,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { AttendanceRecord } from "@/lib/store";

import { MobileShell } from "@/components/MobileShell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { useStore, signOut as clearLocalUser, broadcast } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTDate, formatISTDateTime } from "@/lib/format";
import { StatusTag, type DocStatus } from "./student.documents";


const ADMIN_BYPASS_EMAILS = ["vset.official@gmail.com", "630karan@gmail.com", "630karan2@gmail.com"];

interface DocRow {
  id: string;
  student_id: string;
  student_name: string;
  document_type: string;
  file_url: string;
  status: DocStatus;
  created_at: string;
}
interface StudentRow {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  college: string | null;
  professional_tier: string | null;
  created_at: string;
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: AdminConsole,
});


type Tab = "roster" | "documents" | "analytics" | "ppts" | "broadcast";

function AdminConsole() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [bootError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("roster");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [preview, setPreview] = useState<DocRow | null>(null);

  // Auth gate: wait for hydration; bypass for the configured admin email.
  const isAuthorized = useMemo(() => {
    if (!user) return null; // still loading
    if (user.email && ADMIN_BYPASS_EMAILS.includes(user.email.toLowerCase())) return true;
    return user.role === "admin";
  }, [user]);

  useEffect(() => {
    if (isAuthorized === false) {
      navigate({ to: "/student" });
    }
  }, [isAuthorized, navigate]);

  // Load data once authorized
  useEffect(() => {
    if (isAuthorized !== true) return;
    let cancelled = false;

    async function load() {
      try {
        const [studentsRes, docsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, email, full_name, department, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("documents")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);
        if (studentsRes.error) throw studentsRes.error;
        if (docsRes.error) throw docsRes.error;

        const { data: adminRoles, error: rolesErr } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (rolesErr) throw rolesErr;
        const adminIds = new Set((adminRoles ?? []).map((r) => r.user_id));

        if (cancelled) return;
        setStudents(((studentsRes.data ?? []) as StudentRow[]).filter((s) => !adminIds.has(s.id)));
        setDocs((docsRes.data ?? []) as DocRow[]);
      } catch (e) {
        if (cancelled) return;
        console.warn("Admin load failed, using mock fallback", e);
        const mock = buildMockSnapshot();
        setStudents(mock.students);
        setDocs(mock.docs);
        toast.warning("Network issue — showing simulated data so the console stays usable.");
      }
    }
    load();

    const ch = supabase
      .channel("admin:documents")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [isAuthorized]);

  // --- Loading / gating UI ---
  if (isAuthorized === null) return <FullScreenSpinner label="Loading dashboard…" />;
  if (isAuthorized === false) return <FullScreenSpinner label="Loading dashboard…" />;
  if (bootError) {
    return (
      <MobileShell>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
            <p className="mt-3 font-bold">Couldn't load the dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">{bootError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 h-10 rounded-xl gradient-primary text-primary-foreground font-bold text-sm"
            >Retry</button>
          </div>
        </div>
      </MobileShell>
    );
  }
  if (!students || !docs || !user) return <FullScreenSpinner label="Loading dashboard…" />;

  const pendingCount = docs.filter((d) => d.status === "pending").length;
  const firstName = user.name?.split(" ")[0] ?? "Admin";

  async function handleSignOut() {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    clearLocalUser();
    navigate({ to: "/auth" });
  }

  return (
    <MobileShell>
      <header className="px-6 pt-10 pb-8 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Admin Console</p>
            <h1 className="text-2xl font-black mt-0.5">Hello, {firstName}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle variant="onPrimary" />
            <button
              onClick={handleSignOut}
              className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center active:scale-90 transition-transform"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
        <div className="grid grid-cols-3 gap-2 mt-5">
          <KPI label="Students" value={students.length} />
          <KPI label="Pending" value={pendingCount} />
          <KPI label="Verified" value={docs.filter((d) => d.status === "verified").length} />
        </div>
      </header>

      <div className="px-5 -mt-5 sticky top-0 z-20">
        <div className="rounded-2xl bg-surface shadow-elevated p-1 grid grid-cols-5 gap-1 overflow-x-auto">
          <TabBtn active={tab === "roster"} onClick={() => setTab("roster")} icon={<Users className="w-4 h-4" />} label="Roster" />
          <TabBtn active={tab === "documents"} onClick={() => setTab("documents")} icon={<ShieldCheck className="w-4 h-4" />} label="Docs" />
          <TabBtn active={tab === "ppts"} onClick={() => setTab("ppts")} icon={<FileText className="w-4 h-4" />} label="PPTs" />
          <TabBtn active={tab === "broadcast"} onClick={() => setTab("broadcast")} icon={<Radio className="w-4 h-4" />} label="Broadcast" />
          <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 className="w-4 h-4" />} label="Stats" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 animate-in fade-in duration-200" key={tab}>
        {tab === "roster" && <Roster students={students} docs={docs} onOpen={setSelectedStudent} />}
        {tab === "documents" && <DocumentsHub docs={docs} onPreview={setPreview} />}
        {tab === "ppts" && <PPTReviewer />}
        {tab === "broadcast" && <BroadcastPanel authorId={user.id} />}
        {tab === "analytics" && <Analytics students={students} docs={docs} authorName={user.name ?? "Admin"} />}
      </div>

      {selectedStudent && (
        <StudentProfilePanel
          student={selectedStudent}
          docs={docs.filter((d) => d.student_id === selectedStudent.id)}
          onClose={() => setSelectedStudent(null)}
          onPreview={setPreview}
        />
      )}

      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </MobileShell>
  );
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <MobileShell>
      <div className="flex-1 grid place-items-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
            <Loader2 className="absolute inset-0 m-auto w-12 h-12 text-primary animate-spin" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </MobileShell>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-xl font-black mt-0.5">{value}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
        active ? "gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ============================ Tab 1: Roster ============================ */

function Roster({
  students, docs, onOpen,
}: { students: StudentRow[]; docs: DocRow[]; onOpen: (s: StudentRow) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      (s.full_name ?? "").toLowerCase().includes(term) ||
      (s.email ?? "").toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term),
    );
  }, [q, students]);

  return (
    <div className="px-5 pt-5 space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or UID"
          className="w-full h-12 pl-9 pr-3 rounded-xl bg-secondary outline-none text-sm font-medium border border-transparent focus:border-primary focus:bg-surface transition-all"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No students match your search.</p>
      )}

      {filtered.map((s) => {
        const initials = (s.full_name ?? s.email ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
        const studentDocs = docs.filter((d) => d.student_id === s.id);
        const pending = studentDocs.filter((d) => d.status === "pending").length;
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            className="w-full rounded-2xl bg-surface shadow-soft p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground grid place-items-center font-black shrink-0">
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{s.full_name ?? "Unnamed student"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
              <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5 font-mono">UID: {s.id}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {pending > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning-foreground border border-warning/30">
                  {pending} pending
                </span>
              )}
              <span className="text-[11px] text-primary font-bold inline-flex items-center gap-0.5">
                View <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* =================== Student Profile + Docs side-panel =================== */

interface StudentDetail {
  full_name: string | null;
  course: string | null;
  semester: string | null;
  roll_number: string | null;
  father_name: string | null;
  mother_name: string | null;
  college_name: string | null;
  blood_group: string | null;
  avatar_url: string | null;
}

function StudentProfilePanel({
  student, docs, onClose, onPreview,
}: { student: StudentRow; docs: DocRow[]; onClose: () => void; onPreview: (d: DocRow) => void }) {
  const [bio, setBio] = useState<StudentDetail | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("student_profiles_detail")
          .select("full_name, course, semester, roll_number, father_name, mother_name, college_name, blood_group, avatar_url")
          .eq("user_id", student.id)
          .maybeSingle();
        if (!active) return;
        setBio(data as StudentDetail | null);
        const path = data?.avatar_url;
        if (path && !path.startsWith("http") && !path.startsWith("blob:") && !path.startsWith("data:")) {
          const { data: signed } = await supabase.storage.from("student-avatars").createSignedUrl(path, 60 * 60 * 24);
          if (active && signed?.signedUrl) setAvatarUrl(signed.signedUrl);
        } else if (path) {
          setAvatarUrl(path);
        }
      } catch (e) { console.warn(e); }
    })();
    return () => { active = false; };
  }, [student.id]);

  async function setStatus(id: string, status: DocStatus) {
    const { error } = await supabase.from("documents").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "verified" ? "Document approved" : "Document rejected");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-in fade-in" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-elevated flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl gradient-primary text-primary-foreground grid place-items-center font-black shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (bio?.full_name ?? student.full_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{bio?.full_name ?? student.full_name ?? "Unnamed student"}</p>
            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
            <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5 font-mono">UID: {student.id}</p>
            {student.department && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{student.department}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-accent/50">
            <X className="w-4 h-4" />
          </button>
        </div>


        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Bio-data</h3>
            <div className="rounded-2xl bg-secondary/40 p-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <BioRow k="Course" v={bio?.course} />
              <BioRow k="Semester" v={bio?.semester} />
              <BioRow k="Roll No." v={bio?.roll_number} />
              <BioRow k="Blood" v={bio?.blood_group} />
              <BioRow k="Father" v={bio?.father_name} full />
              <BioRow k="Mother" v={bio?.mother_name} full />
              <BioRow k="College" v={bio?.college_name} full />
            </div>
          </section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">All documents</h3>

          {docs.length === 0 && (
            <div className="rounded-xl bg-secondary/50 p-6 text-center text-sm text-muted-foreground">
              No documents uploaded yet.
            </div>
          )}
          {docs.map((d) => (
            <div key={d.id} className="rounded-2xl bg-secondary/40 p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-primary grid place-items-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{d.document_type}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatISTDate(d.created_at)}
                  </p>
                </div>
                <StatusTag status={d.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {d.file_url ? (
                  <button
                    onClick={() => onPreview(d)}
                    className="h-10 rounded-xl bg-surface border border-border font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <FileText className="w-3.5 h-3.5" /> View
                  </button>
                ) : (
                  <div className="h-10 rounded-xl bg-surface/50 border border-dashed border-border text-muted-foreground font-bold text-xs flex items-center justify-center">
                    No file
                  </div>
                )}
                <button
                  onClick={() => setStatus(d.id, "rejected")}
                  className="h-10 rounded-xl bg-destructive/10 text-destructive font-bold text-xs flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  onClick={() => setStatus(d.id, "verified")}
                  className="h-10 rounded-xl bg-success text-success-foreground font-bold text-xs flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BioRow({ k, v, full }: { k: string; v?: string | null; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="text-xs font-bold truncate">{v || "—"}</p>
    </div>
  );
}


/* ========================== Tab 2: Documents Hub ========================== */

function DocumentsHub({ docs, onPreview }: { docs: DocRow[]; onPreview: (d: DocRow) => void }) {
  const pending = docs.filter((d) => d.status === "pending");
  // Rejected documents are removed from the active workspace; only verified items remain visible.
  const recent = docs.filter((d) => d.status === "verified").slice(0, 20);


  async function setStatus(id: string, status: DocStatus) {
    const { error } = await supabase.from("documents").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "verified" ? "Document approved" : "Document rejected");
  }

  return (
    <div className="px-5 pt-5 space-y-5">
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Pending requests
        </h2>
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="rounded-2xl bg-surface shadow-soft p-6 text-center">
              <ShieldCheck className="w-7 h-7 mx-auto text-success" />
              <p className="mt-2 text-sm">All caught up.</p>
            </div>
          )}
          {pending.map((d) => (
            <div key={d.id} className="rounded-2xl bg-surface shadow-soft p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-primary grid place-items-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{d.student_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.document_type} · {formatISTDate(d.created_at)}
                  </p>
                </div>
                {d.file_url && (
                  <button
                    onClick={() => onPreview(d)}
                    className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-accent/50"
                    aria-label="Preview file"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setStatus(d.id, "rejected")} className="h-11 rounded-xl bg-destructive/10 text-destructive font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98]">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => setStatus(d.id, "verified")} className="h-11 rounded-xl bg-success text-success-foreground font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98]">
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Recently processed
          </h2>
          <div className="rounded-2xl bg-surface shadow-soft divide-y divide-border">
            {recent.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{d.student_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{d.document_type}</p>
                </div>
                {d.file_url && (
                  <button
                    onClick={() => onPreview(d)}
                    className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-accent/50"
                    aria-label="Preview file"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
                <StatusTag status={d.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ===================== Tab 3: Analytics & Broadcast ===================== */

function Analytics({
  students, docs, authorName,
}: { students: StudentRow[]; docs: DocRow[]; authorName: string }) {
  const attendance = useStore((s) => s.attendance);
  const announcements = useStore((s) => s.announcements);
  const today = new Date().toISOString().slice(0, 10);
  const presentToday = attendance.filter((a) => a.date === today);
  const pendingCount = docs.filter((d) => d.status === "pending").length;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const departments = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => s.department && set.add(s.department));
    return Array.from(set).sort();
  }, [students]);
  const [scope, setScope] = useState<string>("ALL");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");

  function push() {
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    const prefix = priority === "urgent" ? "🚨 URGENT · " : "";
    const audience = scope === "ALL" ? "All students" : scope;
    const recipients =
      scope === "ALL" ? students.length : students.filter((s) => s.department === scope).length;
    broadcast({
      title: prefix + title.trim(),
      body: `[Audience: ${audience}]\n${body.trim()}`,
      authorName,
    });
    setTitle(""); setBody("");
    toast.success(`Sent to ${recipients} student${recipients === 1 ? "" : "s"} · ${audience}`);
  }

  // 7-day activity series (attendance count per day)
  const activitySeries = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    const fmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: iso,
        label: fmt.format(d),
        count: attendance.filter((a) => a.date === iso).length,
      });
    }
    return days;
  }, [attendance]);

  return (
    <div className="px-5 pt-5 space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Students" value={students.length} icon={<Users className="w-4 h-4" />} />
        <MetricCard label="Pending" value={pendingCount} icon={<ShieldCheck className="w-4 h-4" />} />
        <MetricCard label="Present" value={presentToday.length} icon={<CalendarCheck className="w-4 h-4" />} />
      </div>

      <ExtraCounters totalStudents={students.length} presentCount={presentToday.length} />

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Student activity · last 7 days
        </h2>
        <div className="rounded-2xl glass shadow-soft p-3 pt-4">
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={activitySeries} margin={{ top: 4, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="var(--color-primary-glow)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ stroke: "var(--color-primary)", strokeOpacity: 0.2 }}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ fontWeight: 700 }}
                  formatter={(v: number) => [`${v} check-ins`, "Activity"]}
                />
                <Line type="monotone" dataKey="count" stroke="url(#actGrad)" strokeWidth={3} dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Peak check-in intervals · last 7 days
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Live attendance · today
        </h2>
        <div className="rounded-2xl glass shadow-soft divide-y divide-border overflow-hidden">
          {presentToday.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No check-ins recorded yet today.
            </p>
          ) : (
            [...presentToday]
              .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
              .map((a) => {
                const s = students.find((x) => x.id === a.userId);
                const label = s?.full_name ?? a.userId.slice(0, 8);
                const initials = label.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                const timeLabel = a.timestamp
                  ? new Date(a.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
                  : (a.time ?? "—");
                return (
                  <div key={a.userId} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-9 h-9 rounded-xl gradient-primary text-primary-foreground grid place-items-center text-[11px] font-black shrink-0">
                      {initials || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{label}</p>
                      <p className="text-[11px] text-muted-foreground">Marked at {timeLabel}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-success">Present</span>
                  </div>
                );
              })
          )}
        </div>
      </section>

      <LiveActivityFeed students={students} docs={docs} announcements={announcements} attendance={attendance} />


      <div className="rounded-2xl glass shadow-soft p-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" /> Bulk Announcement
        </h2>
        <p className="text-xs text-muted-foreground">
          Target an audience and push instantly to every student feed.
        </p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Audience</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="mt-1.5 w-full h-12 px-3 rounded-xl bg-secondary outline-none text-sm font-semibold border border-transparent focus:border-primary"
              >
                <option value="ALL">All students ({students.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d} ({students.filter((s) => s.department === d).length})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
              <div className="mt-1.5 grid grid-cols-2 gap-1 p-1 bg-secondary rounded-xl h-12">
                <button
                  type="button"
                  onClick={() => setPriority("normal")}
                  className={`rounded-lg text-xs font-bold transition-all ${
                    priority === "normal" ? "bg-surface shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("urgent")}
                  className={`rounded-lg text-xs font-bold transition-all ${
                    priority === "urgent" ? "bg-destructive text-destructive-foreground shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  Urgent
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Library hours updated"
              className="mt-1.5 w-full h-12 px-3.5 rounded-xl bg-secondary outline-none text-sm font-medium border border-transparent focus:border-primary focus:bg-surface transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Share the details students need to know…"
              className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-secondary outline-none text-sm font-medium border border-transparent focus:border-primary focus:bg-surface transition-all resize-none"
            />
          </div>
          <button
            onClick={push}
            className="w-full h-14 py-3.5 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-elevated active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Send to {scope === "ALL" ? "everyone" : scope}
          </button>
        </div>
      </div>

      <LearningMaterialUploader />




      {announcements.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Live noticeboard
          </h2>
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-2xl bg-surface shadow-soft p-4">
                <p className="text-sm font-bold">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatISTDateTime(a.createdAt)}</p>
                <p className="mt-2 text-sm">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface shadow-soft p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] uppercase tracking-wider font-bold">{label}</p>
      </div>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

/* ====================== Learning Material Uploader ====================== */

interface MaterialRow {
  id: string;
  title: string;
  subject: string;
  module: string | null;
  course: string | null;
  file_url: string;
  created_at: string;
}

function LearningMaterialUploader() {
  const [items, setItems] = useState<MaterialRow[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [course, setCourse] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("learning_materials")
        .select("id, title, subject, module, course, file_url, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (active) setItems((data ?? []) as MaterialRow[]);
    }
    load();
    const ch = supabase
      .channel("admin:materials")
      .on("postgres_changes", { event: "*", schema: "public", table: "learning_materials" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `materials/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("student-documents").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("student-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      setFileUrl(signed?.signedUrl ?? path);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success("File uploaded");
    } catch (err) {
      console.warn(err);
      toast.error("File upload failed — paste a link instead");
    } finally { setBusy(false); }
  }

  async function publish() {
    if (!title.trim() || !subject.trim() || !fileUrl.trim()) {
      toast.error("Title, subject and file/link are required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("learning_materials").insert({
      title: title.trim(),
      subject: subject.trim(),
      module: moduleName.trim() || null,
      course: course.trim() || null,
      description: description.trim() || null,
      file_url: fileUrl.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setSubject(""); setModuleName(""); setCourse(""); setFileUrl(""); setDescription("");
    toast.success("Published to student feed");
  }

  async function remove(id: string) {
    await supabase.from("learning_materials").delete().eq("id", id);
  }

  return (
    <div className="rounded-2xl bg-surface shadow-soft p-4">
      <h2 className="text-base font-bold flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" /> Upload Learning Material
      </h2>
      <p className="text-xs text-muted-foreground">PPTs or notes published instantly to students.</p>

      <div className="mt-4 space-y-3">
        <MiniField label="Title" v={title} onChange={setTitle} placeholder="Unit 3 — Data Structures" />
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Subject" v={subject} onChange={setSubject} placeholder="DSA" />
          <MiniField label="Module" v={moduleName} onChange={setModuleName} placeholder="Module 3" />
        </div>
        <MiniField label="Course (optional)" v={course} onChange={setCourse} placeholder="B.Tech" />
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short description (optional)"
            className="mt-1.5 w-full px-3 py-2 rounded-xl bg-secondary outline-none text-sm font-medium border border-transparent focus:border-primary focus:bg-surface transition-all resize-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">File or Link</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://… or upload file"
              className="flex-1 h-11 px-3 rounded-xl bg-secondary outline-none text-sm font-medium border border-transparent focus:border-primary focus:bg-surface transition-all"
            />
            <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept=".ppt,.pptx,.pdf,.doc,.docx,image/*" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="h-11 px-3 rounded-xl bg-secondary border border-border font-bold text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> File
            </button>
          </div>
        </div>
        <button
          onClick={publish}
          disabled={busy}
          className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : <><Send className="w-4 h-4" /> Publish to Students</>}
        </button>
      </div>

      {items.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent uploads</h3>
          <ul className="divide-y divide-border">
            {items.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {m.subject}{m.module ? ` · ${m.module}` : ""} · {formatISTDate(m.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => remove(m.id)}
                  className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MiniField({ label, v, onChange, placeholder }: { label: string; v: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={v}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full h-11 px-3 rounded-xl bg-secondary outline-none text-sm font-semibold border border-transparent focus:border-primary focus:bg-surface transition-all"
      />
    </div>
  );
}


/* ============================ Doc Preview Modal ============================ */

function DocPreviewModal({ doc, onClose }: { doc: DocRow; onClose: () => void }) {
  const url = doc.file_url;
  const lower = url.split("?")[0].toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(lower) || url.startsWith("data:image") || url.startsWith("blob:");
  const isPdf = /\.pdf$/.test(lower) || url.startsWith("data:application/pdf");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-md max-h-[92vh] rounded-3xl shadow-elevated flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-accent text-primary grid place-items-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{doc.document_type}</p>
            <p className="text-[11px] text-muted-foreground truncate">{doc.student_name}</p>
          </div>
          <StatusTag status={doc.status} />
        </div>

        <div className="flex-1 overflow-auto bg-secondary/40 grid place-items-center p-3">
          {isImage ? (
            <img
              src={url}
              alt={doc.document_type}
              className="max-w-full max-h-[70vh] rounded-2xl border border-border bg-white object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              title={doc.document_type}
              className="w-full h-[70vh] rounded-2xl border border-border bg-white"
            />
          ) : (
            <div className="text-center p-8">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Preview not available</p>
              <p className="mt-1 text-xs text-muted-foreground break-all">{url}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <X className="w-4 h-4" /> Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Mock fallback ============================ */
function buildMockSnapshot(): { students: StudentRow[]; docs: DocRow[] } {
  const now = Date.now();
  const iso = (offset: number) => new Date(now - offset).toISOString();
  const students: StudentRow[] = [
    { id: "mock-1", email: "aria@college.edu", full_name: "Aria Mehta", department: "Computer Science", created_at: iso(86400000 * 3) },
    { id: "mock-2", email: "rohan@college.edu", full_name: "Rohan Verma", department: "Electronics", created_at: iso(86400000 * 7) },
    { id: "mock-3", email: "sara@college.edu", full_name: "Sara Khan", department: "Design", created_at: iso(86400000 * 12) },
  ];
  const docs: DocRow[] = [
    { id: "mock-d1", student_id: "mock-1", student_name: "Aria Mehta", document_type: "Class 10 Marksheet", file_url: "", status: "pending", created_at: iso(3600000) },
    { id: "mock-d2", student_id: "mock-2", student_name: "Rohan Verma", document_type: "Aadhaar Card", file_url: "", status: "verified", created_at: iso(86400000) },
    { id: "mock-d3", student_id: "mock-3", student_name: "Sara Khan", document_type: "NOC (No Objection Certificate)", file_url: "", status: "rejected", created_at: iso(86400000 * 2) },
  ];
  return { students, docs };
}

/* ============================ Analytics helpers ============================ */

function useAIQueriesToday() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    function read() {
      try {
        const key = `eduai-queries-${new Date().toISOString().slice(0, 10)}`;
        setCount(Number(localStorage.getItem(key) ?? 0));
      } catch { setCount(0); }
    }
    read();
    const t = setInterval(read, 4000);
    const onStorage = (e: StorageEvent) => { if (e.key?.startsWith("eduai-queries-")) read(); };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(t); window.removeEventListener("storage", onStorage); };
  }, []);
  return count;
}

function ExtraCounters({ totalStudents, presentCount }: { totalStudents: number; presentCount: number }) {
  const aiToday = useAIQueriesToday();
  const presentPct = totalStudents === 0 ? 0 : Math.round((presentCount / totalStudents) * 100);
  const absentPct = Math.max(0, 100 - presentPct);
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl glass shadow-soft p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary text-primary-foreground grid place-items-center shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Registered</p>
          <p className="text-lg font-black leading-tight">{totalStudents}</p>
        </div>
      </div>
      <div className="rounded-2xl glass shadow-soft p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent text-primary grid place-items-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Queries today</p>
          <p className="text-lg font-black leading-tight">{aiToday}</p>
        </div>
      </div>
      <div className="col-span-2 rounded-2xl glass shadow-soft p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Real-time attendance
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground">{presentCount}/{totalStudents}</p>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden flex">
          <div className="gradient-primary" style={{ width: `${presentPct}%` }} />
          <div className="bg-destructive/40" style={{ width: `${absentPct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold">
          <span className="text-success">Present · {presentPct}%</span>
          <span className="text-destructive">Absent · {absentPct}%</span>
        </div>
      </div>
    </div>
  );
}

interface FeedItem { id: string; icon: "user" | "doc" | "att" | "ann"; text: string; when: number }

function LiveActivityFeed({
  students, docs, announcements, attendance,
}: {
  students: StudentRow[];
  docs: DocRow[];
  announcements: { id: string; title: string; createdAt: number; authorName: string }[];
  attendance: AttendanceRecord[];
}) {
  const items: FeedItem[] = useMemo(() => {
    const list: FeedItem[] = [];
    for (const s of students) {
      list.push({
        id: `s-${s.id}`,
        icon: "user",
        text: `New student registered — ${s.full_name ?? s.email}`,
        when: new Date(s.created_at).getTime(),
      });
    }
    for (const d of docs) {
      list.push({
        id: `d-${d.id}`,
        icon: "doc",
        text: `${d.student_name} · ${d.document_type} → ${d.status}`,
        when: new Date(d.created_at).getTime(),
      });
    }
    for (const a of attendance) {
      const s = students.find((x) => x.id === a.userId);
      const name = s?.full_name ?? a.userId.slice(0, 8);
      const when = a.timestamp ?? new Date(a.date).getTime();
      list.push({ id: `a-${a.userId}-${a.date}`, icon: "att", text: `${name} marked attendance`, when });
    }
    for (const ann of announcements) {
      list.push({ id: `n-${ann.id}`, icon: "ann", text: `Announcement · ${ann.title}`, when: ann.createdAt });
    }
    return list.sort((a, b) => b.when - a.when).slice(0, 12);
  }, [students, docs, attendance, announcements]);

  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5 text-primary animate-pulse" /> Live activity feed
      </h2>
      <div className="rounded-2xl glass shadow-soft divide-y divide-border overflow-hidden">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
        ) : items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
              it.icon === "user" ? "bg-accent text-primary"
              : it.icon === "doc" ? "bg-primary/15 text-primary"
              : it.icon === "att" ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive"
            }`}>
              {it.icon === "user" ? <Users className="w-3.5 h-3.5" />
                : it.icon === "doc" ? <FileText className="w-3.5 h-3.5" />
                : it.icon === "att" ? <CalendarCheck className="w-3.5 h-3.5" />
                : <Megaphone className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">{it.text}</p>
              <p className="text-[10px] text-muted-foreground">{formatISTDateTime(it.when)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
