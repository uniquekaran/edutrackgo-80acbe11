import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, KeyRound, Loader2, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — EduTrack" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase's recovery link sets a session automatically on load.
    // Wait a moment for the client to process the URL hash.
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error(error.message ?? "Could not update password."); return; }
      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell>
      <div className="px-6 pt-10 pb-8 gradient-primary text-primary-foreground">
        <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm opacity-90">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black">EduTrack</h1>
        </div>
        <h2 className="mt-8 text-3xl font-black leading-tight">Set a new password</h2>
        <p className="mt-2 text-sm opacity-90">Pick something strong you'll remember.</p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          {!ready ? (
            <div className="h-40 grid place-items-center text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <PasswordField label="New password (min 8)" value={password} onChange={setPassword} show={show} toggleShow={() => setShow((v) => !v)} autoComplete="new-password" />
              <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} show={show} toggleShow={() => setShow((v) => !v)} autoComplete="new-password" />
              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
              >
                {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>) : (<><ShieldCheck className="w-4 h-4" /> Update Password</>)}
              </button>
            </form>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function PasswordField({ label, value, onChange, show, toggleShow, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; toggleShow: () => void; autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1.5 relative">
        <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full h-12 pl-10 pr-11 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={toggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
