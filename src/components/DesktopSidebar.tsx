import { Link } from "@tanstack/react-router";
import { GraduationCap, LogOut, Eye } from "lucide-react";
import { signOut as clearLocalUser, useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isAdminEmail } from "@/lib/tenant";
import { getMenuForUser } from "@/lib/sidebar-menu";

export function DesktopSidebar() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const items = getMenuForUser(user);
  const isMasterAdmin = isAdminEmail(user?.email);

  async function handleSignOut() {
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    clearLocalUser();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-64 shrink-0 flex-col glass-strong border-r border-border/60 px-4 py-6 z-20 no-select">
      <div className="flex items-center gap-2.5 px-2">
        <div className="w-10 h-10 rounded-2xl gradient-primary text-primary-foreground grid place-items-center shadow-elevated">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-black tracking-tight">EduTrack</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Student Suite</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <Link
              key={`${it.to}-${i}`}
              to={it.to}
              activeOptions={{ exact: it.exact }}
              className="group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 data-[status=active]:text-primary-foreground data-[status=active]:gradient-primary data-[status=active]:shadow-elevated transition-all"
            >
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary-glow opacity-0 group-data-[status=active]:opacity-100 transition-opacity" />
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {isMasterAdmin && (
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="mb-3 w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-primary/10 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/15 transition"
          title="Reviewer: switch to Admin View"
        >
          <Eye className="w-3.5 h-3.5" /> Switch to Admin View
        </button>
      )}
      <div className="rounded-2xl glass p-3 space-y-3 pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent text-primary grid place-items-center shrink-0 font-black text-sm">
            {(user?.name ?? user?.email ?? "S").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{user?.name ?? "Student"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={handleSignOut}
          className="w-full h-9 rounded-xl bg-destructive/10 text-destructive text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-destructive/15 transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}

export default DesktopSidebar;
