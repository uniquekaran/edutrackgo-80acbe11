import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Loader2, Send, Radio } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { testGatewayApi } from "@/lib/gatewayApi.functions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const APP_KEY = "edutrack-branding-v1";
interface Branding { appName: string; tagline: string; primaryColor: string; }
const DEFAULT: Branding = { appName: "EduTrack", tagline: "Student platform", primaryColor: "#6366f1" };

function AdminSettings() {
  const [b, setB] = useState<Branding>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<null | { ok: boolean; message: string }>(null);
  const runTest = useServerFn(testGatewayApi);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APP_KEY);
      if (raw) setB({ ...DEFAULT, ...JSON.parse(raw) });
    } catch { /* noop */ }
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      localStorage.setItem(APP_KEY, JSON.stringify(b));
      toast.success("Settings saved");
    } catch {
      toast.error("Unable to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestGateway() {
    setTesting(true);
    setLastTest(null);
    try {
      const res = await runTest();
      if (res.ok) {
        const msg = `GatewayAPI test successful${res.latency_ms ? ` (${res.latency_ms}ms)` : ""}`;
        setLastTest({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const msg = res.error ?? "GatewayAPI test failed";
        setLastTest({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network request failed";
      setLastTest({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Configure</p>
        <h1 className="text-2xl font-black">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Site branding placeholder and integration checks.</p>
      </div>

      {/* GatewayAPI Test */}
      <section className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-black">GatewayAPI</p>
            <p className="text-[11px] text-muted-foreground">Verify SMS/notification credentials via the connector gateway.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestGateway}
          disabled={testing}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary hover:bg-accent px-4 py-2 text-xs font-bold disabled:opacity-70"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {testing ? "Testing…" : "Test GatewayAPI"}
        </button>

        {lastTest && (
          <p className={`text-xs font-semibold ${lastTest.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {lastTest.message}
          </p>
        )}
      </section>

      {/* Branding */}
      <form onSubmit={save} className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-4">
        <div>
          <p className="text-sm font-black">Site branding</p>
          <p className="text-[11px] text-muted-foreground">Stored locally per admin (placeholder).</p>
        </div>
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
        <button disabled={saving} className="gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2 disabled:opacity-70">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save settings"}
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
