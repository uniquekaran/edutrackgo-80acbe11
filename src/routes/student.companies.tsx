import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ExternalLink, Briefcase, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteSkeleton } from "@/components/RouteSkeleton";

export const Route = createFileRoute("/student/companies")({
  head: () => ({ meta: [{ title: "Target Companies — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: CompaniesPage,
});

interface Company {
  id: string; name: string; sector: string | null; location: string | null;
  tier: string | null; website: string | null; notes: string | null;
}

function CompaniesPage() {
  const [rows, setRows] = useState<Company[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("companies").select("id,name,sector,location,tier,website,notes")
        .eq("is_active", true).order("tier", { ascending: true }).order("name", { ascending: true });
      if (alive) setRows((data ?? []) as Company[]);
    })();
    const ch = supabase.channel("companies:all").on("postgres_changes", { event: "*", schema: "public", table: "companies" }, async () => {
      const { data } = await supabase.from("companies").select("id,name,sector,location,tier,website,notes").eq("is_active", true);
      setRows((data ?? []) as Company[]);
    }).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="pb-8">
      <header className="px-6 pt-10 pb-5 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 grid place-items-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black leading-tight">Target Companies</h1>
            <p className="text-[11px] opacity-90">{rows === null ? "Loading…" : `${rows.length} recruiters in your roster`}</p>
          </div>
        </div>
      </header>

      <section className="px-5 -mt-6 space-y-2.5">
        {rows === null && <div className="rounded-2xl glass p-6 text-center text-xs text-muted-foreground">Loading companies…</div>}
        {rows && rows.length === 0 && <div className="rounded-2xl glass p-6 text-center text-xs text-muted-foreground">No companies added yet.</div>}
        {rows?.map((c) => (
          <div key={c.id} className="rounded-2xl glass shadow-soft p-3.5 flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl gradient-primary text-primary-foreground grid place-items-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate">{c.name}</p>
                {c.tier && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-accent text-primary">{c.tier}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                {c.sector && <span>{c.sector}</span>}
                {c.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
              </p>
              {c.notes && <p className="text-[11px] text-muted-foreground mt-1">{c.notes}</p>}
            </div>
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0 mt-1.5">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
