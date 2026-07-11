import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, signOut as clearLocalUser, setCurrentUser, type User } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { ThemeToggle } from "@/components/ThemeToggle";

function isAdminUser(email: string): boolean {
  return email === "vset.official@gmail.com";
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
  const [redirectScheduled, setRedirectScheduled] = useState(false);

  const displayUser = storeUser ?? sessionAdmin;

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        toast.dismiss();

        const sessionUser = session?.user;
        const email = sessionUser?.email ?? "";

        if (sessionUser && isAdminUser(email)) {
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
        } else {
          setAuthState(false);
        }
      } else if (event === "SIGNED_OUT") {
        setSessionAdmin(null);
        setAuthState(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      toast.dismiss();
    };
  }, []);

  useEffect(() => {
    if (authState === false && !redirectScheduled) {
      setRedirectScheduled(true);
      navigate({ to: "/auth/admin", replace: true });
    }
  }, [authState, redirectScheduled, navigate]);

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
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-6 border-b border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
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

        <div className="p-3 border-t border-border space-y-2">
          <div className="px-2 py-2 rounded-lg bg-muted/40 space-y-1">
            <p className="text-[11px] font-bold truncate">{displayUser.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{displayUser.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="flex-1 h-9 rounded-xl bg-destructive/10 text-destructive text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-destructive/15 transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: AdminLayoutComponent,
});
