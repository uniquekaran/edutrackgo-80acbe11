import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckSquare, Square, Youtube, GaugeCircle, Megaphone, Presentation, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/format";

const REGISTERS = [
  "Attendance Register",
  "Meeting Minutes Register",
  "Fee / Contribution Register",
  "Inventory Register",
  "Event Log Register",
  "Grievance Register",
];

const YT_CHANNELS = [
  { name: "AKTU Digital Education", url: "https://www.youtube.com/@aktudigitaleducation" },
  { name: "Gate Smashers", url: "https://www.youtube.com/@GateSmashers" },
  { name: "Knowledge Gate", url: "https://www.youtube.com/@KnowledgeGATE_kg" },
  { name: "Neso Academy", url: "https://www.youtube.com/@nesoacademy" },
  { name: "Jenny's Lectures", url: "https://www.youtube.com/@JennysLecturesCSIT" },
  { name: "CodeHelp - by Babbar", url: "https://www.youtube.com/@CodeHelp" },
  { name: "Apna College", url: "https://www.youtube.com/@ApnaCollegeOfficial" },
  { name: "Sudhanshu Kumar", url: "https://www.youtube.com/@SudhanshuKumar" },
  { name: "College Wallah", url: "https://www.youtube.com/@CollegeWallahbyPW" },
  { name: "Physics Wallah Foundation", url: "https://www.youtube.com/@PhysicsWallah" },
];

interface Broadcast { id: string; title: string; body: string; audience: string; created_at: string; }

export function CoreDashboard({ userId }: { userId: string }) {
  const [registers, setRegisters] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<Broadcast[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`registers:${userId}`);
      if (raw) setRegisters(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("id,title,body,audience,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (alive) setAlerts((data ?? []) as Broadcast[]);
    })();
    const ch = supabase
      .channel(`core:broadcasts:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, async () => {
        const { data } = await supabase
          .from("broadcasts").select("id,title,body,audience,created_at")
          .order("created_at", { ascending: false }).limit(10);
        if (alive) setAlerts((data ?? []) as Broadcast[]);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [userId]);

  function toggle(name: string) {
    const next = { ...registers, [name]: !registers[name] };
    setRegisters(next);
    try { localStorage.setItem(`registers:${userId}`, JSON.stringify(next)); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Meeting Alerts" hint="Live broadcasts from the admin" icon={<Megaphone className="w-4 h-4" />} />
      <div className="rounded-2xl glass shadow-soft divide-y divide-border/60">
        {alerts.length === 0 && <p className="p-5 text-sm text-muted-foreground text-center">No active alerts.</p>}
        {alerts.map((b) => (
          <div key={b.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold truncate">{b.title}</p>
              <span className="text-[10px] font-black uppercase text-primary shrink-0">{b.audience}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{b.body}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">{formatISTDateTime(b.created_at)}</p>
          </div>
        ))}
      </div>

      <SectionHeader title="6 Physical Registers" hint="Tick as you verify each register" icon={<CheckSquare className="w-4 h-4" />} />
      <div className="rounded-2xl glass shadow-soft p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {REGISTERS.map((r) => {
          const on = !!registers[r];
          return (
            <button
              key={r}
              onClick={() => toggle(r)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${on ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"}`}
            >
              {on ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span className="truncate">{r}</span>
            </button>
          );
        })}
      </div>

      <SectionHeader title="Command Actions" hint="VSDT tracker & competency vault" icon={<GaugeCircle className="w-4 h-4" />} />
      <div className="grid grid-cols-2 gap-3">
        <Link to="/student/tracker" className="rounded-2xl glass shadow-soft p-4 active:scale-[0.98] transition">
          <GaugeCircle className="w-5 h-5 text-primary" />
          <p className="mt-2 text-sm font-bold">VSDT Readiness Tracker</p>
          <p className="text-[10px] text-muted-foreground">Attendance & tests</p>
        </Link>
        <Link to="/student/competency" className="rounded-2xl glass shadow-soft p-4 active:scale-[0.98] transition">
          <Presentation className="w-5 h-5 text-primary" />
          <p className="mt-2 text-sm font-bold">PPT Vault (5 slots)</p>
          <p className="text-[10px] text-muted-foreground">Scholarship, Platform, VSDT…</p>
        </Link>
      </div>

      <SectionHeader title="Top 10 AKTU YouTube Channels" hint="Curated by the committee" icon={<Youtube className="w-4 h-4" />} />
      <div className="rounded-2xl glass shadow-soft divide-y divide-border/60">
        {YT_CHANNELS.map((c, i) => (
          <a key={c.url} href={c.url} target="_blank" rel="noreferrer"
             className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition">
            <span className="w-6 text-[11px] font-black text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm font-semibold flex-1 truncate">{c.name}</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, hint, icon }: { title: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between pt-2">
      <div>
        <p className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">{icon} {title}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
