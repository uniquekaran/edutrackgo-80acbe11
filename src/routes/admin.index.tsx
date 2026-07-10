import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, HelpCircle, FileText, Activity, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — EduTrack" },
      { name: "description", content: "Live overview of student growth, document activity, and campus operations for EduTrack administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

interface Counts { users: number; questions: number; documents: number; syllabi: number; }
interface Activity { id: string; label: string; at: string; }
type DashboardDiagnostic = { level: "error" | "warning"; message: string };

function dbMessage(source: string, error: unknown) {
  const err = error as { message?: string; code?: string; details?: string; hint?: string };
  return [
    `${source} error: ${err.message ?? String(error)}`,
    err.code ? `code=${err.code}` : "",
    err.details ? `details=${err.details}` : "",
    err.hint ? `hint=${err.hint}` : "",
  ].filter(Boolean).join(" · ");
}

function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({ users: 0, questions: 0, documents: 0, syllabi: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [chart, setChart] = useState<Array<{ day: string; users: number }>>([]);
  const [diagnostics, setDiagnostics] = useState<DashboardDiagnostic[]>([]);

  useEffect(() => {
    async function fetchAll() {
      const nextDiagnostics: DashboardDiagnostic[] = [];
      const [u, d, q, s] = await Promise.all([
        supabase.from("profiles").select("id, created_at, full_name, email").order("created_at", { ascending: false }),
        supabase.from("documents").select("id, student_id, document_type, status, created_at").order("created_at", { ascending: false }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("syllabi").select("id", { count: "exact", head: true }),
      ]);
      if (u.error) nextDiagnostics.push({ level: "error", message: dbMessage("profiles", u.error) });
      if (d.error) nextDiagnostics.push({ level: "error", message: dbMessage("documents", d.error) });
      if (!u.error && (u.data ?? []).length === 0) nextDiagnostics.push({ level: "warning", message: "Connection Warning: profiles query returned 0 rows on the dashboard. No frontend role or tenant filters were applied." });
      if (!d.error && (d.data ?? []).length === 0) nextDiagnostics.push({ level: "warning", message: "Connection Warning: documents query returned 0 rows on the dashboard. No frontend role or tenant filters were applied." });
      const users = u.data ?? [];
      const documents = d.data ?? [];
      setCounts({
        users: users.length,
        questions: q.count ?? 0,
        documents: documents.length,
        syllabi: s.count ?? 0,
      });
      setDiagnostics(nextDiagnostics);
      setActivity(
        users.slice(0, 8).map((p) => ({
          id: p.id,
          label: `New user · ${p.full_name ?? p.email}`,
          at: p.created_at,
        })),
      );
      const byDay = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        byDay.set(d.toISOString().slice(0, 10), 0);
      }
      for (const p of users) {
        const key = p.created_at.slice(0, 10);
        if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      setChart(Array.from(byDay).map(([day, users]) => ({ day: day.slice(5), users })));
    }
    fetchAll();
    // Live sync: refetch when profiles or documents change.
    const ch = supabase
      .channel("admin-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Overview</p>
        <h1 className="text-2xl font-black">Dashboard</h1>
      </div>

      {diagnostics.length > 0 && (
        <div className="rounded-2xl bg-surface border border-border shadow-soft p-4 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Database diagnostics</p>
          {diagnostics.map((item, index) => (
            <div
              key={index}
              className={`rounded-xl border p-3 text-xs font-semibold ${item.level === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning-foreground"}`}
            >
              {item.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Users" value={counts.users} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Active Quizzes" value={counts.questions} icon={<HelpCircle className="w-4 h-4" />} />
        <StatCard label="Documents" value={counts.documents} icon={<FileText className="w-4 h-4" />} />
        <StatCard label="Syllabi" value={counts.syllabi} icon={<Sparkles className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-surface border border-border p-5 shadow-soft">
          <p className="text-sm font-bold mb-3">User signups · last 7 days</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-surface border border-border p-5 shadow-soft">
          <p className="text-sm font-bold mb-3 flex items-center gap-1.5"><Activity className="w-4 h-4" /> Latest activity</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activity.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
            {activity.map((a) => (
              <div key={a.id} className="text-xs">
                <p className="font-semibold truncate">{a.label}</p>
                <p className="text-[10px] text-muted-foreground">{formatISTDateTime(a.at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-black mt-1.5">{value}</p>
    </div>
  );
}
