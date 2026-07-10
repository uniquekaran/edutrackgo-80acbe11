import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, HelpCircle, Settings as SettingsIcon,
  ShieldAlert, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, signOut as clearLocalUser } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isAdminUser } from "@/lib/auth-helpers";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: AdminLayout,
});

const NAV: Array<{ to: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "User Profiles", icon: Users },
  { to: "/admin/students", label: "All Students", icon: Users },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/quiz", label: "Quiz Bank", icon: HelpCircle },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

function AdminLayout() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const loc = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const authorized = !!user && isAdminUser(user.email);

  // Wait for Supabase session hydration before deciding access.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
      setChecking(false);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (checking) return;
    if (!hasSession && !user) {
      navigate({ to: "/auth/admin" });
      return;
    }
    if (!user) return; // session exists, waiting for store hydration
    if (!authorized) {
      toast.error("Access denied — this area is for administrators only.");
      navigate({ to: "/auth/admin" });
    }
  }, [checking, hasSession, user, authorized, navigate]);

  if (checking || (hasSession && !user)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">Loading admin console…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (!authorized) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center space-y-2">
          <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
          <p className="text-sm font-bold">Redirecting…</p>
        </div>
      </div>
    );
  }

  async function handleSignOut() {
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    clearLocalUser();
    navigate({ to: "/auth/admin" });
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to || loc.pathname === to + "/" : loc.pathname.startsWith(to);

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-6 border-b border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="text-lg font-black mt-0.5">EduTrack Console</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = isActive(n.to, n.exact);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active ? "gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div className="px-2 text-[11px] text-muted-foreground truncate">{user.email}</div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="flex-1 h-9 rounded-xl bg-secondary hover:bg-accent text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-surface border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 no-scrollbar">
          {NAV.map((n) => {
            const active = isActive(n.to, n.exact);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  active ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {n.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
