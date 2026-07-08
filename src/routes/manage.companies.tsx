import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/manage/companies")({
  component: ManageCompanies,
});

interface Row {
  id: string; name: string; sector: string | null; location: string | null;
  tier: string | null; website: string | null; is_active: boolean; notes: string | null;
}

function ManageCompanies() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ name: "", sector: "", location: "", tier: "Tier 1", website: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("companies").insert({
      name: form.name.trim(), sector: form.sector || null, location: form.location || null,
      tier: form.tier || null, website: form.website || null, notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company added");
    setForm({ name: "", sector: "", location: "", tier: "Tier 1", website: "", notes: "" });
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  async function toggle(r: Row) {
    await supabase.from("companies").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="rounded-2xl glass-strong p-4 space-y-2">
        <p className="text-sm font-bold mb-2">Add company</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input required placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm" />
          <input placeholder="Sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm" />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm" />
          <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm">
            <option>Tier 1</option><option>Tier 2</option><option>Tier 3</option><option>Dream</option>
          </select>
          <input placeholder="Website URL" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm sm:col-span-2" />
        </div>
        <button disabled={saving} className="w-full gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-2.5 rounded-xl flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Add"}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{rows.length} companies</p>
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl glass p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{r.name} <span className="text-[10px] font-normal text-muted-foreground">{r.tier}</span></p>
              <p className="text-[11px] text-muted-foreground truncate">{r.sector} · {r.location}</p>
            </div>
            <button onClick={() => toggle(r)} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${r.is_active ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
              {r.is_active ? "Active" : "Hidden"}
            </button>
            <button onClick={() => remove(r.id)} className="text-destructive p-2"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
