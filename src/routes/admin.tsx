import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, HelpCircle, Settings as SettingsIcon,
  LogOut, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, signOut as clearLocalUser, setCurrentUser, type User } from "@/lib/store";
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
  // authState: null = still resolving (Supabase has not emitted INITIAL_SESSION yet)
  //            true = authorized admin, false = not authorized (redirect once)
  const [authState, setAuthState] = useState<null | boolean>(null);
  const [sessionAdmin, setSessionAdmin] = useState<User | null>(null);
  const [redirectScheduled, setRedirectScheduled] = useState(false);
  const displayUser = user ?? sessionAdmin;

  // Single source of truth: Supabase auth events. We wait for INITIAL_SESSION
  // before making ANY authorization decision to prevent redirect loops caused
  // by evaluating auth before the session has been restored from storage.
  useEffect(() => {
    let isMounted = true;

    const applySession = (
      sessionUser: { id: string; email?: string | null; user_metadata?: unknown } | null | undefined,
    ) => {
      const email = sessionUser?.email ?? "";
      if (sessionUser && isAdminUser(email)) {
        const meta = sessionUser.user_metadata as { full_name?: string; name?: string } | undefined;
        const adminUser: User = {
          id: sessionUser.id,
          email,
          name: meta?.full_name ?? meta?.name ?? user?.name ?? email.split("@")[0],
          role: "admin",
          college: user?.college ?? "AKTU",
          department: user?.department,
        };
        setSessionAdmin(adminUser);
        setCurrentUser(adminUser);
        setAuthState(true);
      } else {
        setAuthState(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        toast.dismiss();
        applySession(session?.user);
      } else if (event === "SIGNED_OUT") {
        setAuthState(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect exactly once when we've conclusively determined the user is not an admin.
  useEffect(() => {
    if (authState === false && !redirectScheduled) {
      setRedirectScheduled(true);
      navigate({ to: "/auth/admin", replace: true });
    }
  }, [authState, redirectScheduled, navigate]);

  // Loading — do NOT redirect, do NOT evaluate other branches.
  if (authState === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Not authorized — redirect effect above handles navigation. Render nothing.
  if (authState === false || !displayUser) {
    return null;
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
          <div className="px-2 text-[11px] text-muted-foreground truncate">{displayUser.email}</div>
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
