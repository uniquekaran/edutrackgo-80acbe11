import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, GraduationCap, Loader2, ShieldCheck, Smartphone, User, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { sendOtp, verifyOtp } from "@/lib/otp.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — EduTrack" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "",
  }),
  component: AuthPage,
});

type Step = "enter-phone" | "verify-otp";

function friendly(msg?: string | null): string {
  const m = (msg ?? "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Network error. Check your connection and try again.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a moment and retry.";
  return msg || "Something went wrong. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const { next } = Route.useSearch();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [step, setStep] = useState<Step>("enter-phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  const nowRef = useRef(now); nowRef.current = now;

  useEffect(() => {
    if (!user) return;
    if (next) { window.location.href = next; return; }
    navigate({ to: user.role === "admin" ? "/admin" : "/student" });
  }, [user, navigate, next]);

  useEffect(() => {
    if (step !== "verify-otp") return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [step]);

  const secondsLeft = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const canResend = secondsLeft <= 0 || secondsLeft < (300 - 60); // allow resend after 60s

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const redirect_uri = next
        ? `${window.location.origin}/auth?next=${encodeURIComponent(next)}`
        : window.location.origin;
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri });
      if (result.error) {
        toast.error(friendly(result.error.message));
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (e) {
      toast.error(friendly(e instanceof Error ? e.message : null));
      setGoogleLoading(false);
    }
  }

  async function doSendOtp(): Promise<boolean> {
    const raw = phone.trim();
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits || digits.length < 10) {
      toast.error("Enter a valid mobile number");
      return false;
    }
    const res = await sendOtp({ data: { phone: raw } });
    if (!res.ok) {
      toast.error(friendly(res.error));
      return false;
    }
    setToken(res.token!);
    setNormalizedPhone(res.phone!);
    setExpiresAt(res.expiresAt!);
    setNow(Math.floor(Date.now() / 1000));
    setOtp("");
    return true;
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const ok = await doSendOtp();
      if (ok) {
        setStep("verify-otp");
        toast.success("Verification code sent");
      }
    } catch (err) {
      toast.error(friendly(err instanceof Error ? err.message : null));
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const ok = await doSendOtp();
      if (ok) toast.success("New code sent");
    } catch (err) {
      toast.error(friendly(err instanceof Error ? err.message : null));
    } finally {
      setResending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error("Enter the 6-digit code"); return; }
    setVerifying(true);
    try {
      const res = await verifyOtp({ data: { phone: normalizedPhone, code: otp, token, fullName: fullName.trim() || undefined } });
      if (!res.ok) { toast.error(friendly(res.error)); return; }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: res.email!, password: res.password! });
      if (signErr) { toast.error(friendly(signErr.message)); return; }
      toast.success("Signed in");
      // useSupabaseAuth SIGNED_IN handler redirects.
    } catch (err) {
      toast.error(friendly(err instanceof Error ? err.message : null));
    } finally {
      setVerifying(false);
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
          {step === "verify-otp" ? "Verify your mobile" : "Sign in to your campus"}
        </h2>
        <p className="mt-2 text-sm opacity-90">
          {step === "verify-otp"
            ? `We sent a 6-digit code to +${normalizedPhone}.`
            : "Continue with Google, or use your mobile number."}
        </p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          {step === "enter-phone" ? (
            <>
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full h-14 rounded-2xl bg-white border border-border shadow-soft flex items-center justify-center gap-3 font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-70"
              >
                {googleLoading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Signing in with Google…</>) : (<><GoogleIcon className="w-5 h-5" /> Continue with Google</>)}
              </button>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSendOtp} className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Full name <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">(new users)</span>
                  </label>
                  <div className="mt-1.5 relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name (optional if returning)"
                      className="w-full h-12 pl-10 pr-3 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" /> Mobile number
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-12 px-3 rounded-2xl border border-border bg-background text-sm font-bold text-foreground grid place-items-center">
                      +91
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
                      placeholder="9876543210"
                      maxLength={15}
                      className="flex-1 h-12 px-4 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Enter 10 digits for India, or include country code (e.g. 447700900000).</p>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
                >
                  {sending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</>) : (<><ArrowRight className="w-4 h-4" /> Send OTP</>)}
                </button>
              </form>

              <div className="mt-5 flex items-start gap-3 p-3.5 rounded-2xl bg-accent/40 border border-border">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Secure & private</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    New mobile numbers are enrolled as students automatically. Never share your OTP.
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
            </>
          ) : (
            <form onSubmit={handleVerify} className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-accent/40 border border-border">
                <Smartphone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Check your messages</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    A 6-digit code was sent to +{normalizedPhone}. It expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mobile number</label>
                <div className="mt-1.5 h-12 px-4 rounded-2xl border border-border bg-background text-sm font-semibold text-foreground grid place-items-start items-center flex">
                  +{normalizedPhone}
                </div>
              </div>

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
                disabled={verifying}
                className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
              >
                {verifying ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying OTP…</>) : (<><ShieldCheck className="w-4 h-4" /> Verify OTP</>)}
              </button>

              <div className="flex items-center justify-between text-[11px]">
                <button type="button" onClick={() => setStep("enter-phone")} className="text-muted-foreground hover:text-foreground font-semibold">← Change number</button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !canResend}
                  className="text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1"
                >
                  {resending ? (<><Loader2 className="w-3 h-3 animate-spin" /> Resending OTP…</>) : canResend ? "Resend OTP" : `Resend in ${secondsLeft}s`}
                </button>
              </div>
            </form>
          )}
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
