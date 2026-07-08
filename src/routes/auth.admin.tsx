import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Lock, Mail, KeyRound, Building2 } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { CollegeSelect } from "@/components/CollegeSelect";
import { useStore } from "@/lib/store";
import { signInAdmin } from "@/components/admin/signInAdmin";

export const Route = createFileRoute("/auth/admin")({
  head: () => ({ meta: [{ title: "Administrator sign in — EduTrack" }] }),
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [college, setCollege] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // If a student is already signed in, kick them out of the admin auth route.
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate({ to: "/admin" });
    else navigate({ to: "/auth" });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signInAdmin({ email, password, college });
    if (!res.ok) {
      toast.error(res.error ?? "Login failed.");
      setLoading(false);
      return;
    }
    try { localStorage.setItem("edutrack-admin-college", college); } catch {}
    toast.success(`Welcome back — ${college}`);
    // useSupabaseAuth SIGNED_IN handler will redirect to /admin.
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
            <h1 className="text-2xl font-black">Administrator sign in</h1>
          </div>
        </div>
        <p className="mt-3 text-sm opacity-90">Restricted access — staff & faculty credentials only.</p>
      </div>

      <div className="flex-1 px-6 -mt-6 pb-8">
        <div className="rounded-3xl bg-surface shadow-soft p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Admin Portal</p>
              <p className="text-[11px] text-muted-foreground">Restricted access</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> College
              </label>
              <div className="mt-1.5">
                <CollegeSelect value={college} onChange={setCollege} label="" placeholder="Select your college first…" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="mt-1.5 relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@college.edu"
                  className="w-full h-12 pl-10 pr-3 rounded-2xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Password</label>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
              disabled={loading}
              className="w-full h-14 mt-2 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70 shadow-soft"
            >
              {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Verifying…</>) : (<><ShieldCheck className="w-5 h-5" /> Login as Admin</>)}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted-foreground leading-relaxed">
            Administrative accounts are provisioned by your campus. Students should use Google sign-in.
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
