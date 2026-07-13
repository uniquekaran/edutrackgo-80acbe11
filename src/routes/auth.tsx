import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { lovable } from "@/integrations/lovable";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — EduTrack" },
      { name: "description", content: "Sign in to EduTrack with your Google account." },
      { property: "og:title", content: "Sign in — EduTrack" },
      { property: "og:description", content: "Sign in to EduTrack with your Google account." },
      { property: "og:url", content: "https://edutrackgo.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://edutrackgo.lovable.app/auth" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "",
  }),
  component: AuthPage,
});

function friendly(msg?: string | null): string {
  const m = (msg ?? "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Network error. Check your connection and try again.";
  if (m.includes("popup") || m.includes("closed")) return "Sign-in window was closed before completing. Please try again.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a moment and retry.";
  return msg || "Something went wrong. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const { next } = Route.useSearch();

  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (next) { window.location.href = next; return; }
    navigate({ to: user.role === "admin" ? "/admin" : "/student" });
  }, [user, navigate, next]);

  async function handleGoogle() {
    if (googleLoading) return;
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
      // Tokens set — useSupabaseAuth SIGNED_IN handler redirects.
    } catch (e) {
      toast.error(friendly(e instanceof Error ? e.message : null));
      setGoogleLoading(false);
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
          <h1 className="text-2xl font-black">EduTrack — Modern College Management</h1>
        </div>
        <h2 className="mt-8 text-3xl font-black leading-tight">Sign in to your campus</h2>
        <p className="mt-2 text-sm opacity-90">Continue with your Google account. Students and staff use the same sign-in.</p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full h-14 rounded-2xl bg-white border border-border shadow-soft flex items-center justify-center gap-3 font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-70"
          >
            {googleLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Signing in with Google…</>
            ) : (
              <><GoogleIcon className="w-5 h-5" /> Continue with Google</>
            )}
          </button>

          <div className="mt-5 flex items-start gap-3 p-3.5 rounded-2xl bg-accent/40 border border-border">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">Secure & private</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                Google handles authentication. Administrators and students use the same sign-in.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            By continuing you agree to EduTrack's Terms &amp; Privacy.
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
