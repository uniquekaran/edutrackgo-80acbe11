import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const APP_KEY = "edutrack-branding-v1";
interface Branding { appName: string; tagline: string; primaryColor: string; }
const DEFAULT: Branding = { appName: "EduTrack", tagline: "Student platform", primaryColor: "#6366f1" };

function AdminSettings() {
  const [b, setB] = useState<Branding>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APP_KEY);
      if (raw) setB({ ...DEFAULT, ...JSON.parse(raw) });
    } catch { /* noop */ }
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(APP_KEY, JSON.stringify(b));
      toast.success("Settings saved");
    } catch { toast.error("Could not save"); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Configure</p>
        <h1 className="text-2xl font-black">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Site branding placeholder — stored locally per admin.</p>
      </div>

      <form onSubmit={save} className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-4">
        <Field label="App name">
          <input value={b.appName} onChange={(e) => setB({ ...b, appName: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm" />
        </Field>
        <Field label="Tagline">
          <input value={b.tagline} onChange={(e) => setB({ ...b, tagline: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm" />
        </Field>
        <Field label="Primary color">
          <div className="flex items-center gap-2">
            <input type="color" value={b.primaryColor} onChange={(e) => setB({ ...b, primaryColor: e.target.value })} className="w-12 h-10 rounded-lg border border-border bg-secondary" />
            <input value={b.primaryColor} onChange={(e) => setB({ ...b, primaryColor: e.target.value })} className="flex-1 rounded-xl bg-secondary px-3 py-2 text-sm font-mono" />
          </div>
        </Field>
        <button className="gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2">
          <Save className="w-4 h-4" /> Save settings
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
