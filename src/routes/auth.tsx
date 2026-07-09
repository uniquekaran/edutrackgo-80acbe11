import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, Loader2, ShieldCheck, Lock, Mail, KeyRound, LogIn, ChevronDown, ChevronUp, Building2, Eye, EyeOff, ShieldAlert, User, UserPlus, MailCheck } from "lucide-react";
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

type Mode = "login" | "signup" | "verify" | "forgot";

function friendlyError(msg?: string | null): string {
  const m = (msg ?? "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already")) return "An account with this email already exists.";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email before signing in.";
  if (m.includes("otp") && m.includes("expired")) return "That code has expired. Request a new one.";
  if (m.includes("token") && m.includes("expired")) return "That code has expired. Request a new one.";
  if (m.includes("invalid") && m.includes("otp")) return "Invalid code. Double-check and try again.";
  if (m.includes("password") && m.includes("weak")) return "Password is too weak. Use at least 8 characters.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a moment and retry.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Network error. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const { next } = Route.useSearch();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP verification
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");

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
        toast.error(friendlyError(result.error.message));
        setLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (e) {
      toast.error(friendlyError(e instanceof Error ? e.message : null));
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error("Enter email and password."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const friendly = friendlyError(error.message);
      toast.error(friendly);
      if ((error.message ?? "").toLowerCase().includes("email not confirmed")) {
        setPendingEmail(email.trim().toLowerCase());
        setMode("verify");
      }
      setBusy(false);
      return;
    }
    // SIGNED_IN handler redirects.
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    const em = signupEmail.trim().toLowerCase();
    if (!name || !em || !signupPassword || !confirmPassword) { toast.error("All fields are required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast.error("Enter a valid email address."); return; }
    if (signupPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (signupPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password: signupPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name },
        },
      });
      if (error) { toast.error(friendlyError(error.message)); setBusy(false); return; }
      // If email confirmation is required, session is null.
      if (!data.session) {
        setPendingEmail(em);
        setOtp("");
        setMode("verify");
        toast.success("Check your email for the 6-digit verification code.");
      } else {
        toast.success("Account created!");
      }
    } catch (err) {
      toast.error(friendlyError(err instanceof Error ? err.message : null));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const em = pendingEmail.trim().toLowerCase();
    const token = otp.trim();
    if (!em) { toast.error("Enter your email."); return; }
    if (!/^\d{6}$/.test(token)) { toast.error("Enter the 6-digit code from your email."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: em, token, type: "email" });
      if (error) { toast.error(friendlyError(error.message)); setBusy(false); return; }
      toast.success("Email verified!");
      // SIGNED_IN handler redirects; if no session set, fall back to login mode.
    } catch (err) {
      toast.error(friendlyError(err instanceof Error ? err.message : null));
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    const em = pendingEmail.trim().toLowerCase();
    if (!em) { toast.error("Enter your email first."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: em });
      if (error) { toast.error(friendlyError(error.message)); return; }
      toast.success("New code sent. Check your inbox.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const em = forgotEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast.error("Enter a valid email address."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { toast.error(friendlyError(error.message)); return; }
      toast.success("Password reset email sent. Check your inbox.");
      setMode("login");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminCollege) { toast.error("Select your college first."); return; }
    if (!adminEmail || !adminPassword) { toast.error("Enter admin email and password."); return; }
    setAdminLoading(true);
    try {
      const res = await signInAdmin({ email: adminEmail, password: adminPassword, college: adminCollege });
      if (!res.ok) {
        toast.error(res.error ?? "Invalid admin credentials");
        return;
      }
      try { localStorage.setItem("edutrack-admin-college", adminCollege); } catch { /* noop */ }
      toast.success(`Welcome back — ${adminCollege}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid admin credentials");
    } finally {
      setAdminLoading(false);
    }
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
        <h2 className="mt-8 text-3xl font-black leading-tight">
          {mode === "signup" ? "Create your account" : mode === "verify" ? "Verify your email" : mode === "forgot" ? "Reset your password" : "Sign in to your campus"}
        </h2>
        <p className="mt-2 text-sm opacity-90">
          {mode === "signup" ? "Join with your college email." : mode === "verify" ? "Enter the 6-digit code we sent you." : mode === "forgot" ? "We'll email you a reset link." : "One tap with Google, or use email."}
        </p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          {mode === "verify" ? (
            <VerifyPanel
              email={pendingEmail}
              setEmail={setPendingEmail}
              otp={otp}
              setOtp={setOtp}
              busy={busy}
              onSubmit={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => setMode("login")}
            />
          ) : mode === "forgot" ? (
            <ForgotPanel
              email={forgotEmail}
              setEmail={setForgotEmail}
              busy={busy}
              onSubmit={handleForgot}
              onBack={() => setMode("login")}
            />
          ) : (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-white border border-border shadow-soft flex items-center justify-center gap-3 font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-70"
              >
                {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Connecting…</>) : (<><GoogleIcon className="w-5 h-5" /> Continue with Google</>)}
              </button>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Or use email</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 p-1 rounded-2xl bg-accent/40 border border-border">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`h-10 rounded-xl text-sm font-bold transition-all ${mode === "login" ? "bg-surface shadow-soft text-foreground" : "text-muted-foreground"}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`h-10 rounded-xl text-sm font-bold transition-all ${mode === "signup" ? "bg-surface shadow-soft text-foreground" : "text-muted-foreground"}`}
                >
                  Sign Up
                </button>
              </div>

              {mode === "login" ? (
                <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
                  <TextField icon={<Mail className="w-4 h-4" />} label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="you@college.edu" />
                  <PasswordField icon={<KeyRound className="w-4 h-4" />} label="Password" autoComplete="current-password" value={password} onChange={setPassword} show={showPassword} toggleShow={() => setShowPassword((v) => !v)} />
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setForgotEmail(email); setMode("forgot"); }} className="text-[11px] font-semibold text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
                  >
                    {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>) : (<><LogIn className="w-4 h-4" /> Sign In</>)}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="mt-4 space-y-3">
                  <TextField icon={<User className="w-4 h-4" />} label="Full name" type="text" autoComplete="name" value={fullName} onChange={setFullName} placeholder="Your name" />
                  <TextField icon={<Mail className="w-4 h-4" />} label="Email" type="email" autoComplete="email" value={signupEmail} onChange={setSignupEmail} placeholder="you@college.edu" />
                  <PasswordField icon={<KeyRound className="w-4 h-4" />} label="Password (min 8)" autoComplete="new-password" value={signupPassword} onChange={setSignupPassword} show={showPassword} toggleShow={() => setShowPassword((v) => !v)} />
                  <PasswordField icon={<KeyRound className="w-4 h-4" />} label="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} show={showPassword} toggleShow={() => setShowPassword((v) => !v)} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
                  >
                    {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>) : (<><UserPlus className="w-4 h-4" /> Create Account</>)}
                  </button>
                </form>
              )}

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

              <button
                type="button"
                onClick={() => setAdminOpen((v) => !v)}
                aria-expanded={adminOpen}
                className="mt-4 w-full h-12 rounded-2xl border border-border bg-background flex items-center justify-center gap-2 text-sm font-semibold text-foreground hover:bg-accent/40 active:scale-[0.98] transition-all"
              >
                <Lock className="w-4 h-4 text-primary" />
                Admin / Teacher Portal Login
                {adminOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </button>

              {adminOpen && (
                <form onSubmit={handleAdminLogin} className="mt-4 space-y-3 rounded-2xl border border-border bg-accent/20 p-4">
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <ShieldAlert className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <span>Restricted access — staff & faculty credentials only.</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> College
                    </label>
                    <div className="mt-1.5">
                      <CollegeSelect value={adminCollege} onChange={setAdminCollege} label="" placeholder="Select your college first…" />
                    </div>
                  </div>

                  <TextField icon={<Mail className="w-4 h-4" />} label="Admin email" type="email" autoComplete="email" value={adminEmail} onChange={setAdminEmail} placeholder="admin@college.edu" />

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                    <div className="mt-1.5 relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showAdminPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-11 pl-10 pr-11 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((v) => !v)}
                        aria-label={showAdminPassword ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
                  >
                    {adminLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Logging in…</>) : (<><ShieldCheck className="w-4 h-4" /> Login as Admin</>)}
                  </button>
                </form>
              )}

              <p className="mt-5 text-center text-[11px] text-muted-foreground">
                By continuing you agree to EduTrack's Terms & Privacy.
              </p>
            </>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function TextField({ icon, label, type, autoComplete, value, onChange, placeholder }: {
  icon: React.ReactNode; label: string; type: string; autoComplete?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1.5 relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-3 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}

function PasswordField({ icon, label, autoComplete, value, onChange, show, toggleShow }: {
  icon: React.ReactNode; label: string; autoComplete?: string; value: string; onChange: (v: string) => void; show: boolean; toggleShow: () => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1.5 relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
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

function VerifyPanel({ email, setEmail, otp, setOtp, busy, onSubmit, onResend, onBack }: {
  email: string; setEmail: (v: string) => void; otp: string; setOtp: (v: string) => void; busy: boolean; onSubmit: (e: React.FormEvent) => void; onResend: () => void; onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-accent/40 border border-border">
        <MailCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-foreground">Check your email</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            We sent a 6-digit verification code to your inbox. Enter it below to activate your account.
          </p>
        </div>
      </div>
      <TextField icon={<Mail className="w-4 h-4" />} label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="you@college.edu" />
      <div>
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">6-digit code</label>
        <div className="mt-1.5">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="w-full h-14 px-4 rounded-2xl border border-border bg-background text-center text-2xl font-bold tracking-[0.5em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
      >
        {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>) : (<><ShieldCheck className="w-4 h-4" /> Verify Account</>)}
      </button>
      <div className="flex items-center justify-between text-[11px]">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground font-semibold">← Back to login</button>
        <button type="button" onClick={onResend} disabled={busy} className="text-primary font-semibold hover:underline disabled:opacity-60">Resend code</button>
      </div>
    </form>
  );
}

function ForgotPanel({ email, setEmail, busy, onSubmit, onBack }: {
  email: string; setEmail: (v: string) => void; busy: boolean; onSubmit: (e: React.FormEvent) => void; onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-accent/40 border border-border">
        <KeyRound className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-foreground">Reset your password</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            Enter your account email and we'll send you a secure reset link.
          </p>
        </div>
      </div>
      <TextField icon={<Mail className="w-4 h-4" />} label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="you@college.edu" />
      <button
        type="submit"
        disabled={busy}
        className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
      >
        {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending reset email…</>) : (<><Mail className="w-4 h-4" /> Send Reset Link</>)}
      </button>
      <button type="button" onClick={onBack} className="w-full text-[11px] text-muted-foreground hover:text-foreground font-semibold">← Back to login</button>
    </form>
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
