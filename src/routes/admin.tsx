import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { store, useStore, signOut as clearLocalUser, setCurrentUser, type User } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { ThemeToggle } from "@/components/ThemeToggle";

function isAdminUser(email: string): boolean {
  return email.trim().toLowerCase() === "vset.official@gmail.com";
}

const NAV: Array<{ to: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/students", label: "All Students", icon: Users },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayoutComponent() {
  const navigate = useNavigate();
  const storeUser = useStore((s) => s.user);

  const [authState, setAuthState] = useState<null | boolean>(null);
  const [sessionAdmin, setSessionAdmin] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef(navigate);

  useEffect(() => {
    navRef.current = navigate;
  }, [navigate]);

  const displayUser = storeUser ?? sessionAdmin;

  useEffect(() => {
    console.log("=== ADMIN EFFECT START ===");
    let isMounted = true;
    let decided = false;

    const decide = (session: import("@supabase/supabase-js").Session | null) => {
      if (!isMounted || decided) return;
      decided = true;
      toast.dismiss();

      const sessionUser = session?.user;
      const email = (sessionUser?.email ?? "").trim().toLowerCase();
      const isAdmin = isAdminUser(email);
      console.log("Email from Supabase:", email);
      console.log("Is admin:", isAdmin);

      if (sessionUser && isAdmin) {
        const meta = sessionUser.user_metadata as
          | { full_name?: string; name?: string; college?: string; department?: string }
          | undefined;
        const adminUser: User = {
          id: sessionUser.id,
          email,
          name: meta?.full_name ?? meta?.name ?? email.split("@")[0],
          role: "admin",
          college: meta?.college ?? "AKTU",
          department: meta?.department,
        };
        setSessionAdmin(adminUser);
        setCurrentUser(adminUser);
        setAuthState(true);
        console.log("AuthState set to:", true);
      } else {
        // If a signed-in non-admin (student) tried to reach /admin, warn them
        // and send them to their dashboard instead of the admin login page.
        if (sessionUser && !isAdmin) {
          toast.error("Admin area — students are not permitted here.", {
            description: "Redirected to your dashboard.",
          });
        } else {
          clearLocalUser();
        }
        setAuthState(false);
        console.log("AuthState set to:", false);
      }
    };

    // Trust getSession() as the single source of truth for initial mount.
    supabase.auth.getSession().then(({ data }) => decide(data.session ?? null));

    // Force a decision after 5s if getSession() never resolves.
    const timeout = setTimeout(() => {
      console.log("Timeout fired, forcing decision");
      decide(null);
    }, 5000);

    return () => {
      isMounted = false;
      // Do NOT set decided=true here — initRef already guards duplicate runs.
      clearTimeout(timeout);
      toast.dismiss();
    };
  }, []);

  useEffect(() => {
    if (authState === false) {
      // Non-admin signed-in users go to /student; anonymous go to /auth/admin.
      const target =
        typeof window !== "undefined" && store.get().user?.role === "student"
          ? "/student"
          : "/auth/admin";
      navRef.current({ to: target, replace: true });
    }
  }, [authState]);

  if (authState === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  if (authState === false || !displayUser) {
    return null;
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // noop
    }
    toast.dismiss();
    clearLocalUser();
    navigate({ to: "/auth/admin", replace: true });
  }

  const isActive = (to: string, exact?: boolean) => {
    if (typeof window === "undefined") return false;
    if (exact) return window.location.pathname === to;
    return window.location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <SidebarInner
        displayUser={displayUser}
        onSignOut={handleSignOut}
        onNavigate={() => {}}
        isActive={isActive}
        className="hidden md:flex w-64 shrink-0"
      />

      {/* Mobile drawer + backdrop */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)} />
      )}
      <SidebarInner
        displayUser={displayUser}
        onSignOut={handleSignOut}
        onNavigate={() => setDrawerOpen(false)}
        isActive={isActive}
        className={`md:hidden fixed z-50 top-0 left-0 h-full w-72 transition-transform duration-200 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        showClose
        onClose={() => setDrawerOpen(false)}
      />

      <main className="flex-1 min-w-0">
        {/* Mobile header with hamburger */}
        <header className="md:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 rounded-xl grid place-items-center bg-secondary hover:bg-accent/60"
          >
            <Menu size={22} />
          </button>
          <p className="text-sm font-black">EduTrack Console</p>
        </header>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarInner({
  displayUser,
  onSignOut,
  onNavigate,
  isActive,
  className,
  showClose,
  onClose,
}: {
  displayUser: { name: string; email: string };
  onSignOut: () => void;
  onNavigate: () => void;
  isActive: (to: string, exact?: boolean) => boolean;
  className?: string;
  showClose?: boolean;
  onClose?: () => void;
}) {
  return (
    <aside className={`flex-col border-r border-border bg-surface flex ${className ?? ""}`}>
      <div className="px-5 py-6 border-b border-border flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="text-lg font-black mt-0.5">EduTrack Console</h1>
        </div>
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-lg grid place-items-center bg-secondary hover:bg-accent/60"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((n) => {
          const active = isActive(n.to, n.exact);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2 pb-4">
        <Link
          to="/student"
          onClick={onNavigate}
          className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-primary/10 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/15 transition"
          title="Reviewer: switch to Student View"
        >
          <Eye className="w-3.5 h-3.5" /> Switch to Student View
        </Link>
        <div className="px-2 py-2 rounded-lg bg-muted/40 space-y-1">
          <p className="text-[11px] font-bold truncate">{displayUser.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{displayUser.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onSignOut}
            className="flex-1 h-9 rounded-xl bg-destructive/10 text-destructive text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-destructive/15 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: AdminLayoutComponent,
});
