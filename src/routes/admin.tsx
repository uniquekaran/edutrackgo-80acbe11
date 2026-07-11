import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  HelpCircle,
  Settings,
  ShieldAlert,
  LogOut,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, signOut as clearLocalUser, setCurrentUser, type User } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

// Single source of truth for admin access.
function isAdminUser(email: string): boolean {
  return email === "vset.official@gmail.com";
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — EduTrack" }] }),
  component: AdminLayoutComponent,
});

function AdminLayoutComponent() {
  const navigate = useNavigate();
  const storeUser = useStore((s) => s.user);

  // Only three pieces of state.
  const [authState, setAuthState] = useState<null | boolean>(null);
  const [sessionAdmin, setSessionAdmin] = useState<User | null>(null);
  const [redirectScheduled, setRedirectScheduled] = useState<boolean>(false);

  // Effect 1: subscribe to Supabase auth events. Do not decide anything
  // until INITIAL_SESSION (or a subsequent SIGNED_IN / SIGNED_OUT) arrives.
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

  // Effect 2: redirect exactly once when we've concluded the user isn't an admin.
  useEffect(() => {
    if (authState === false && !redirectScheduled) {
      setRedirectScheduled(true);
      navigate({ to: "/auth/admin", replace: true });
    }
  }, [authState, redirectScheduled, navigate]);

  const displayUser = sessionAdmin ?? storeUser;

  // Branch 1: LOADING — never redirect, never fall through.
  if (authState === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">
            Verifying access…
          </p>
        </div>
      </div>
    );
  }

  // Branch 2: NOT AUTHORIZED — redirect effect above handles navigation.
  if (authState === false || !displayUser) {
    return null;
  }

  // Sign-out handler (defined here so it can close over navigate).
  async function handleSignOut() {
    toast.dismiss();
    clearLocalUser();
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    navigate({ to: "/auth/admin", replace: true });
  }

  // Branch 3: AUTHORIZED admin dashboard.
  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Admin
              </p>
              <h1 className="text-lg font-black leading-tight">EduTrack Console</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            to="/admin"
            activeOptions={{ exact: true }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition data-[status=active]:gradient-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-soft"
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link
            to="/admin/students"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition data-[status=active]:gradient-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-soft"
          >
            <Users className="w-4 h-4" /> Students
          </Link>
          <Link
            to="/admin/documents"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition data-[status=active]:gradient-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-soft"
          >
            <FileText className="w-4 h-4" /> Documents
          </Link>
          <Link
            to="/admin/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition data-[status=active]:gradient-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-soft"
          >
            <Settings className="w-4 h-4" /> Settings
          </Link>
          <Link
            to="/admin/quiz"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition data-[status=active]:gradient-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-soft"
          >
            <HelpCircle className="w-4 h-4" /> Quiz Bank
          </Link>
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-muted/40">
            <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold truncate">{displayUser.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{displayUser.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full h-9 rounded-xl bg-destructive/10 text-destructive text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-destructive/15 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
