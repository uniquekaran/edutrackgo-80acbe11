import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, ShieldAlert, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { isAdminUser } from "@/lib/auth-helpers";
import { signInAdmin } from "@/components/admin/signInAdmin";

export const Route = createFileRoute("/auth/admin")({
  head: () => ({ meta: [{ title: "Administrator sign in — EduTrack" }] }),
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (isAdminUser(user.email)) navigate({ to: "/admin" });
    else navigate({ to: "/student" });
  }, [user, navigate]);

  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const currentEmail = sess.session?.user?.email ?? null;
      if (currentEmail && !isAdminUser(currentEmail)) {
        await supabase.auth.signOut();
      }
      const redirect_uri = `${window.location.origin}/auth/admin`;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed.");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pwLoading) return;
    if (!email.trim() || !password) {
      toast.error("Enter both email and password.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await signInAdmin({ email, password, college: "AKTU" });
      if (!res.ok) {
        toast.error(res.error || "Login failed.");
        setPwLoading(false);
        return;
      }
      toast.success("Signed in as administrator");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed.");
      setPwLoading(false);
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
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest opacity-80">Staff Portal</p>
            <h1 className="text-2xl font-black">Admin / Teacher sign in</h1>
          </div>
        </div>
        <p className="mt-3 text-sm opacity-90">Restricted access — authorized staff accounts only.</p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8 space-y-4">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email address</label>
              <div className="mt-1.5 relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pwLoading}
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-secondary text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pwLoading}
                  className="w-full h-12 pl-10 pr-10 rounded-xl bg-secondary text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-muted-foreground rounded-lg hover:bg-accent/50"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-elevated active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {pwLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Logging in…</>
              ) : (
                <>Login</>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full h-12 rounded-2xl bg-white border border-border shadow-soft flex items-center justify-center gap-3 font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-70"
          >
            {googleLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
            ) : (
              <><GoogleIcon className="w-5 h-5" /> Continue with Google</>
            )}
          </button>

          <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Only authorized staff accounts can access the admin console.
          </div>
        </div>

        <div className="rounded-2xl bg-accent/30 border border-border p-3.5 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Unauthorized accounts are automatically signed out. Contact your administrator for access.
          </p>
        </div>
      </div>
    </MobileShell>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.89-1.74 2.982-4.305 2.982-7.351Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.598-4.122H3.064v2.59A9.996 9.996 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.402 13.9a6.01 6.01 0 0 1 0-3.8V7.51H3.064a10.01 10.01 0 0 0 0 8.98l3.338-2.59Z" />
      <path fill="#EA4335" d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.695 2 12 2A9.996 9.996 0 0 0 3.064 7.51l3.338 2.59C7.19 7.737 9.395 5.977 12 5.977Z" />
    </svg>
  );
}
