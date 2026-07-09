import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, Upload, FileText, Loader2, Lock, Mail, Building2, GraduationCap, Trash2, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SYLLABUS_SUBJECTS } from "@/lib/syllabus-subjects";
import { formatISTDate } from "@/lib/format";

export const Route = createFileRoute("/network/teacher")({
  head: () => ({ meta: [{ title: "Teacher Portal — EduAI Network" }] }),
  component: TeacherGate,
});

// Teacher credentials are separate from Admin. Do NOT share these.
const TEACHER_EMAIL = "teacher@aktu.edu";
const TEACHER_PASSWORD = "Teacher@123";
const TEACHER_AUTH_KEY = "eduai-network-teacher-authed";
// Distinct from ADMIN's key ("eduai-network-admin-authed") to prevent session bleeding.

// Upstream Supabase identity used for storage/RLS writes (shared with admin uploads).
const UPLOAD_EMAIL = "630karan@gmail.com";
const UPLOAD_PASSWORD = "Karan@123";

function TeacherGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    try { setAuthed(localStorage.getItem(TEACHER_AUTH_KEY) === "1"); } catch { setAuthed(false); }
  }, []);
  if (authed === null) return null;
  if (!authed) return <TeacherLogin onSuccess={() => setAuthed(true)} />;
  return <TeacherConsole onSignOut={async () => {
    try { localStorage.removeItem(TEACHER_AUTH_KEY); } catch {}
    try { await supabase.auth.signOut(); } catch {}
    setAuthed(false);
  }} />;
}

/* --------------------------------- Login --------------------------------- */

function TeacherLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() !== TEACHER_EMAIL || password !== TEACHER_PASSWORD) {
      toast.error("Access Denied: invalid teacher credentials.");
      return;
    }
    setBusy(true);
    // Clean any prior Supabase session AND any admin/legacy portal keys.
    try {
      localStorage.removeItem("eduai-network-admin-authed");
      localStorage.removeItem("eduai-network-authed"); // legacy shared key
    } catch {}
    try { await supabase.auth.signOut(); } catch {}
    // Sign in as the upstream uploader so RLS-protected syllabus writes succeed.
    try {
      await supabase.auth.signInWithPassword({ email: UPLOAD_EMAIL, password: UPLOAD_PASSWORD });
    } catch (err) {
      console.warn("Upstream sign-in failed; uploads may be restricted.", err);
    }
    try { localStorage.setItem(TEACHER_AUTH_KEY, "1"); } catch {}
    toast.success("Welcome to the Teacher Portal");
    setBusy(false);
    onSuccess();
  }

  return (
    <div className="min-h-screen bg-[#050915] text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[36rem] h-[36rem] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-cyan-600/25 blur-[120px]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <Link to="/network" className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Portal
        </Link>
        <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-7 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 grid place-items-center shadow-lg">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-70">Faculty</p>
              <h1 className="text-lg font-black">Teacher Sign-in</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/60">
            Upload syllabi and PYQs for your subjects. Separate from the Admin portal.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/60 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Institution
              </label>
              <div className="mt-1.5 h-12 px-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold flex items-center">
                AKTU
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/60">Faculty Email</label>
              <div className="mt-1.5 relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@aktu.edu"
                  className="w-full h-12 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400 placeholder:text-white/30" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/60">Password</label>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400 placeholder:text-white/30" />
              </div>
            </div>
            <button type="submit" disabled={busy}
              className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-60">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <><GraduationCap className="w-4 h-4" /> Enter Teacher Portal</>}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-white/40">
            Demo faculty account: teacher@aktu.edu / Teacher@123
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Console -------------------------------- */

function TeacherConsole({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-[#050915] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[40rem] h-[40rem] rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute bottom-0 -left-40 w-[36rem] h-[36rem] rounded-full bg-cyan-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-8">
        <div className="flex items-center justify-between">
          <Link to="/network" className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Portal
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
              <GraduationCap className="w-3.5 h-3.5" /> AKTU · Faculty
            </span>
            <button onClick={onSignOut}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 inline-flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        <h1 className="mt-6 text-3xl md:text-4xl font-black tracking-tight">Teacher Dashboard</h1>
        <p className="text-sm text-white/60">Publish syllabi and materials that appear instantly in every student's Exam Portal.</p>

        <div className="mt-6">
          <SyllabusPanel />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Syllabus CMS ----------------------------- */

interface SyllabusRow {
  id: string; title: string; subject: string; file_url: string; created_at: string;
}

function SyllabusPanel() {
  const [subject, setSubject] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<SyllabusRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("syllabi")
        .select("id, title, subject, file_url, created_at")
        .order("created_at", { ascending: false });
      if (active) setItems((data ?? []) as SyllabusRow[]);
    }
    load();
    const ch = supabase
      .channel("teacher:syllabus")
      .on("postgres_changes", { event: "*", schema: "public", table: "syllabi" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!subject) { toast.error("Choose a subject first"); return; }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only .pdf files are accepted");
      return;
    }
    setBusy(true);
    try {
      const college = "AKTU";
      const safe = subject.replace(/\W+/g, "-").toLowerCase();
      const path = `${college}/${safe}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("syllabi")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("syllabi")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Failed to sign URL");

      // Replace any existing syllabus for this subject in this college.
      await supabase.from("syllabi").delete().eq("college", college).eq("subject", subject);

      const { data: authData } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("syllabi").insert({
        college,
        subject,
        title: `${subject} — Syllabus`,
        file_url: signed.signedUrl,
        uploaded_by: authData?.user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success(`Syllabus published for ${subject}`);
    } catch (err) {
      console.warn(err);
      toast.error("Upload failed. Please try again.");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("syllabi").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); return; }
    toast.success("Syllabus removed");
  }


  const uploaded = new Set(items.map((i) => i.subject));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5">
        <h2 className="text-base font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-300" /> Upload Syllabus</h2>
        <p className="text-xs text-white/60 mt-0.5">Only <code className="text-emerald-300">.pdf</code> files. Students see the download instantly.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-white/60">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5 w-full h-12 px-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold outline-none focus:border-emerald-400">
              <option value="" className="bg-slate-900">— Select subject —</option>
              {SYLLABUS_SUBJECTS.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  {s}{uploaded.has(s) ? " · already uploaded" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} />
            <button onClick={() => fileRef.current?.click()} disabled={busy || !subject}
              className="h-12 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Choose PDF</>}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">Published syllabi · {items.length}</h3>
        {items.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center text-white/50 text-sm">
            No syllabi uploaded yet.
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden">
            {items.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.subject}</p>
                  <p className="text-[10px] text-white/50">{formatISTDate(m.created_at)}</p>
                </div>
                <a href={m.file_url} target="_blank" rel="noreferrer"
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15">
                  Open
                </a>
                <button onClick={() => remove(m.id)}
                  className="w-8 h-8 rounded-lg grid place-items-center text-white/50 hover:text-rose-300 hover:bg-rose-500/10"
                  aria-label="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
