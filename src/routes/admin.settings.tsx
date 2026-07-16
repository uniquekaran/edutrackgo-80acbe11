import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const AI_KEY_STORAGE = "edutrack:ai-api-key";

function AdminSettings() {
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_KEY_STORAGE);
      if (raw) setApiKey(raw);
    } catch { /* noop */ }
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        localStorage.removeItem(AI_KEY_STORAGE);
        toast.success("AI API key cleared");
      } else {
        localStorage.setItem(AI_KEY_STORAGE, trimmed);
        toast.success("AI API key saved");
      }
    } catch {
      toast.error("Unable to save key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Configure</p>
        <h1 className="text-2xl font-black">AI Configuration</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Paste your AI provider API key. Used by the EduAI assistant.</p>
      </div>

      <form onSubmit={save} className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center">
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-black">AI Provider API Key</p>
            <p className="text-[11px] text-muted-foreground">Stored locally in your browser and sent with EduAI requests.</p>
          </div>
        </div>
        <Field label="API key">
          <div className="relative">
            <textarea
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              rows={reveal ? 4 : 2}
              spellCheck={false}
              autoComplete="off"
              placeholder="sk-... or your provider key"
              className={`w-full rounded-xl bg-secondary px-3 py-2 text-sm font-mono pr-11 ${reveal ? "" : "tracking-widest"}`}
              style={reveal ? undefined : { WebkitTextSecurity: "disc" } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-lg bg-background/70 hover:bg-accent"
              aria-label={reveal ? "Hide key" : "Show key"}
            >
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Leave blank to clear the saved key.</p>
        </Field>
        <button disabled={saving} className="gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2 disabled:opacity-70">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save API key"}
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
