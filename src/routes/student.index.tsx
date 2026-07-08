import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, TrendingUp, Sparkles, LogOut, BookOpen, ChevronRight, ShieldCheck, ScrollText, BookOpenCheck, GaugeCircle } from "lucide-react";
import { attendanceStats, markAttendance, signOut as clearLocalUser, useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTDay } from "@/lib/format";
import { TodoWidget } from "@/components/TodoWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { SyllabusButton } from "@/components/SyllabusButton";
import { TierBadge } from "@/components/TierBadge";
import { CoreDashboard } from "@/components/CoreDashboard";
import { GlobalDashboard } from "@/components/GlobalDashboard";
import { useTenant } from "@/lib/tenant";




export const Route = createFileRoute("/student/")({
  head: () => ({ meta: [{ title: "Dashboard — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: StudentDashboard,
});


function StudentDashboard() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user)!;
  const attendance = useStore((s) => s.attendance);
  const [course, setCourse] = useState<string>("");
  const { isCoreMember, tier, profile } = useTenant();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("student_profiles_detail")
          .select("course")
          .eq("user_id", user.id)
          .maybeSingle();
        if (active && data?.course) setCourse(data.course);
      } catch (e) { console.warn(e); }
    })();
    return () => { active = false; };
  }, [user.id]);

  const stats = useMemo(() => attendanceStats(user.id), [attendance, user.id]);
  const today = new Date().toISOString().slice(0, 10);
  const markedToday = attendance.some((a) => a.userId === user.id && a.date === today);

  const recent = useMemo(
    () =>
      [...attendance]
        .filter((a) => a.userId === user.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 6),
    [attendance, user.id],
  );

  function handleMark() {
    const ok = markAttendance(user.id);
    if (ok) toast.success("Attendance Successfully Marked!");
    else toast.info("You've already marked attendance today");
  }

  async function handleSignOut() {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    clearLocalUser();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  return (
    <div className="pb-6">
      <header className="px-6 pt-10 pb-6 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest opacity-80">{formatISTDay(new Date())}</p>
            <h1 className="mt-1 text-2xl font-black truncate">Hi, {user.name?.split(" ")[0] ?? "there"} 👋</h1>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <TierBadge tier={tier} />
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
                {profile?.college ?? "Unclassified"} · {isCoreMember ? "Core Committee" : "Enterprise Mode"}
              </span>
            </div>
            <p className="text-sm opacity-90 mt-1 truncate">
              {course ? `${course} · Student` : (
                <Link to="/student/profile" className="underline decoration-white/40 hover:decoration-white">Set your branch →</Link>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle variant="onPrimary" />
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center active:scale-90 transition-transform"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>


      <section className="px-5 -mt-7 mb-4">
        <div className="rounded-3xl glass-strong neon-border shadow-elevated p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" /> Quick Actions
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <SyllabusButton />
            <Link
              to="/student/eduai"
              className="group relative overflow-hidden rounded-2xl glass p-3 active:scale-[0.97] transition-transform border border-primary/20"
            >
              <Sparkles className="w-5 h-5 text-primary" />
              <p className="mt-2 text-[12px] font-black leading-tight">Ask EduAI</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Personalised study tips</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5">
        <div className="rounded-3xl glass-strong shadow-elevated p-5">


          <div className="flex items-center gap-5">
            <Ring pct={stats.pct} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendance</p>
              <p className="text-3xl font-black mt-0.5">{stats.pct}%</p>
              <p className="text-sm text-muted-foreground mt-0.5">{stats.days} of {stats.total} days</p>
            </div>
          </div>

          <button
            onClick={handleMark}
            disabled={markedToday}
            className={`mt-5 w-full h-14 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              markedToday
                ? "bg-success/15 text-success cursor-not-allowed"
                : "gradient-primary text-primary-foreground shadow-elevated"
            }`}
          >
            {markedToday ? (<><CheckCircle2 className="w-5 h-5" /> Marked for today</>) : (<><Sparkles className="w-5 h-5" /> Mark Today's Attendance</>)}
          </button>
        </div>
      </section>

      <section className="px-5 mt-6 grid grid-cols-2 gap-3">
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="This week" value={`${recent.filter((r) => withinDays(r.date, 7)).length} days`} />
        <StatCard icon={<Calendar className="w-4 h-4" />} label="Streak" value={`${calcStreak(recent.map((r) => r.date))} days`} />
      </section>

      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Quick links</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <QuickLink
            to="/student/exams"
            label="Exam Portal"
            hint="PYQs & model papers"
            icon={<BookOpenCheck className="w-5 h-5" />}
          />
          <QuickLink
            to="/student/tracker"
            label="Academic Tracker"
            hint="Attendance & tests"
            icon={<GaugeCircle className="w-5 h-5" />}
          />
          <QuickLink
            to="/student/vault"
            label="Documents Vault"
            hint="Aadhaar, ID, Marksheets"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <QuickLink
            to="/student/noc"
            label="NOC Requests"
            hint="Leave & event approvals"
            icon={<ScrollText className="w-5 h-5" />}
          />
        </div>
      </section>

      <section className="px-5 mt-4">

        <Link
          to="/student/materials"
          className="block rounded-2xl glass shadow-soft p-4 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl gradient-primary text-primary-foreground grid place-items-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Academic Modules & PPTs</p>
              <p className="text-[11px] text-muted-foreground">Browse subject-wise study material</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </section>

      <section className="px-5 mt-4">
        <TodoWidget userId={user.id} />
      </section>

      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Recent attendance</h2>
        </div>
        <div className="rounded-2xl glass shadow-soft divide-y divide-border">
          {recent.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground text-center">No attendance yet. Mark today's!</p>
          )}
          {recent.map((r) => {
            const timeLabel = r.timestamp
              ? new Date(r.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
              : r.time ?? null;
            return (
              <div key={r.date} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-success/15 text-success grid place-items-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatDate(r.date)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {timeLabel ? `Marked at ${timeLabel}` : "Present"}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase text-success">On time</span>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-secondary)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#g1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-primary-glow)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-xl font-black">{pct}%</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl glass shadow-soft p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-black">{value}</p>
    </div>
  );
}

function QuickLink({ to, label, hint, icon }: { to: string; label: string; hint: string; icon: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl glass shadow-soft p-3.5 active:scale-[0.97] transition-transform"
    >
      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full gradient-primary opacity-10 group-hover:opacity-20 transition-opacity" />
      <div className="relative flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl gradient-primary text-primary-foreground grid place-items-center shrink-0 shadow-soft">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>
        </div>
      </div>
    </Link>
  );
}


function withinDays(date: string, days: number) {
  const d = new Date(date).getTime();
  return Date.now() - d < days * 86400000;
}
function calcStreak(dates: string[]) {
  const set = new Set(dates);
  let s = 0;
  const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
  if (s === 0) { d.setDate(d.getDate() - 1); while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); } }
  return s;
}
function formatDate(d: string) {
  return formatISTDay(d);
}
