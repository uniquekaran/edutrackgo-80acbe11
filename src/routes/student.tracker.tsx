import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardList, GaugeCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { useStore, attendanceStats } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDate } from "@/lib/format";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/student/tracker")({
  head: () => ({ meta: [{ title: "Academic Tracker — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: TrackerPage,
});

interface Todo { id: string; title: string; done: boolean; due_date: string | null }

// Hardcoded internal test calendar — would be Drive-backed in production
const INTERNAL_TESTS = [
  { subject: "Mathematics", date: addDays(7) },
  { subject: "Computer Science", date: addDays(12) },
  { subject: "Electronics", date: addDays(20) },
];

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function TrackerPage() {
  const maybeUser = useStore((s) => s.user);
  const attendance = useStore((s) => s.attendance);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!maybeUser) return;
    (async () => {
      const { data } = await supabase.from("user_activities").select("activity_key").eq("user_id", maybeUser.id).eq("status", "done");
      setDoneKeys(new Set((data ?? []).map((r) => r.activity_key)));
    })();
  }, [maybeUser]);

  async function markDone(key: string, label: string) {
    if (!maybeUser) return;
    const { error } = await supabase.from("user_activities").upsert({
      user_id: maybeUser.id, activity_key: key, status: "done", completed_at: new Date().toISOString(),
    }, { onConflict: "user_id,activity_key" });
    if (error) return toast.error(error.message);
    setDoneKeys((s) => new Set(s).add(key));
    toast.success(`Marked "${label}" as done`);
  }

  useEffect(() => {
    if (!maybeUser) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("todo_list")
          .select("id,title,done,due_date")
          .eq("user_id", maybeUser.id)
          .order("due_date", { ascending: true, nullsFirst: false });
        if (active) setTodos((data ?? []) as Todo[]);
      } catch (e) { console.warn(e); }
    })();
    const ch = supabase
      .channel(`tracker:${maybeUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_list", filter: `user_id=eq.${maybeUser.id}` }, async () => {
        const { data } = await supabase.from("todo_list").select("id,title,done,due_date").eq("user_id", maybeUser.id);
        setTodos((data ?? []) as Todo[]);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [maybeUser]);

  const monthlyBars = useMemo(() => {
    if (!maybeUser) return [];
    const days = 30;
    const today = new Date();
    const arr: { date: string; present: boolean }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      arr.push({ date: key, present: attendance.some((a) => a.userId === maybeUser.id && a.date === key) });
    }
    return arr;
  }, [attendance, maybeUser]);

  if (!maybeUser) return null;
  const stats = attendanceStats(maybeUser.id);
  const pendingTasks = todos.filter((t) => !t.done);

  return (
    <div className="pb-8">
      <header className="px-6 pt-10 pb-5 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 grid place-items-center">
            <GaugeCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black leading-tight">Academic Tracker</h1>
            <p className="text-[11px] opacity-90">Attendance, tests & deadlines</p>
          </div>
        </div>
      </header>

      <section className="px-5 -mt-6">
        <div className="rounded-3xl glass-strong shadow-elevated p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Monthly attendance</p>
              <p className="text-3xl font-black mt-0.5">{stats.pct}%</p>
              <p className="text-[11px] text-muted-foreground">{stats.days} of {stats.total} days</p>
            </div>
            <CalendarCheck2 className="w-6 h-6 text-primary" />
          </div>
          <div className="mt-4 flex items-end gap-[3px] h-16">
            {monthlyBars.map((b) => (
              <div
                key={b.date}
                title={`${b.date} · ${b.present ? "Present" : "Absent"}`}
                className={`flex-1 rounded-sm transition-all ${b.present ? "gradient-primary" : "bg-muted/60"}`}
                style={{ height: b.present ? "100%" : "30%" }}
              />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Last 30 days · IST</p>
        </div>
      </section>

      <section className="px-5 mt-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Upcoming internal tests</h2>
        <div className="space-y-2">
          {INTERNAL_TESTS.map((t) => {
            const key = `test:${t.subject}`;
            const done = doneKeys.has(key);
            return (
              <div key={t.subject} className="rounded-2xl glass shadow-soft p-3.5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${done ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" : "gradient-primary text-primary-foreground"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{t.subject}</p>
                  <p className="text-[11px] text-muted-foreground">{formatISTDate(t.date)}</p>
                </div>
                <button
                  disabled={done}
                  onClick={() => markDone(key, t.subject)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full ${done ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" : "bg-secondary text-foreground"}`}
                >
                  {done ? "Done" : "Mark done"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-5 mt-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Assignment deadlines</h2>
        <div className="space-y-2">
          {pendingTasks.length === 0 && (
            <div className="rounded-2xl glass shadow-soft p-5 text-center">
              <p className="text-xs text-muted-foreground">All caught up — no pending assignments 🎉</p>
            </div>
          )}
          {pendingTasks.map((t) => {
            const overdue = t.due_date && new Date(t.due_date) < new Date();
            return (
              <div key={t.id} className="rounded-2xl glass shadow-soft p-3.5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                  overdue ? "bg-destructive/15 text-destructive" : "bg-accent text-primary"
                }`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.due_date ? `Due ${formatISTDate(t.due_date)}` : "No deadline"}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${overdue ? "text-destructive" : "text-primary"}`}>
                  {overdue ? "Overdue" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
