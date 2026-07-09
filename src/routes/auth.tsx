import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, Loader2, ShieldCheck, Lock, Mail, KeyRound, LogIn, ChevronDown, ChevronUp, Building2, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { CollegeSelect } from "@/components/CollegeSelect";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { signInAdmin } from "@/components/admin/signInAdmin";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — EduTrack" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Admin inline form state
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminCollege, setAdminCollege] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (next) { window.location.href = next; return; }
    navigate({ to: user.role === "admin" ? "/admin" : "/student" });
  }, [user, navigate, next]);

  async function handleGoogle() {
    setLoading(true);
    try {
      const redirect_uri = next
        ? `${window.location.origin}/auth?next=${encodeURIComponent(next)}`
        : window.location.origin;
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri });
      if (result.error) {
        toast.error(result.error.message ?? "Sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed.");
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error("Enter email and password."); return; }
    setEmailLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      toast.error(error.message ?? "Login failed.");
      setEmailLoading(false);
      return;
    }
    // useSupabaseAuth SIGNED_IN handler will redirect.
  }

  return (
    <MobileShell>
      <div className="px-6 pt-10 pb-8 gradient-primary text-primary-foreground">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm opacity-90">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black">EduTrack</h1>
        </div>
        <h2 className="mt-8 text-3xl font-black leading-tight">Sign in to your campus</h2>
        <p className="mt-2 text-sm opacity-90">One tap with Google. We'll take it from there.</p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-white border border-border shadow-soft flex items-center justify-center gap-3 font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <GoogleIcon className="w-5 h-5" />
                Continue with Google
              </>
            )}
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Or use email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="mt-1.5 relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  className="w-full h-12 pl-10 pr-3 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Password</label>
              <div className="mt-1.5 relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 pr-3 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={emailLoading}
              className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
            >
              {emailLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>) : (<><LogIn className="w-4 h-4" /> Login</>)}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-3 p-3.5 rounded-2xl bg-accent/40 border border-border">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">Secure & private</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                We only access your name, email, and avatar. New accounts join as students by default.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Staff</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Link
            to="/auth/admin"
            className="mt-4 w-full h-12 rounded-2xl border border-border bg-background flex items-center justify-center gap-2 text-sm font-semibold text-foreground hover:bg-accent/40 active:scale-[0.98] transition-all"
          >
            <Lock className="w-4 h-4 text-primary" />
            Admin / Teacher Portal Login
          </Link>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            By continuing you agree to EduTrack's Terms & Privacy.
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
