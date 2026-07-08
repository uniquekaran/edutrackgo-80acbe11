import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, GraduationCap, LogOut, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { signOut as clearLocalUser, useStore } from "@/lib/store";
import { toast } from "sonner";
import { isAdminEmail } from "@/lib/tenant";
import { getMenuForUser } from "@/lib/sidebar-menu";

export function MobileNavbar() {
  const [open, setOpen] = useState(false);
  const user = useStore((s) => s.user);
  const navigate = useNavigate();

  async function handleSignOut() {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    clearLocalUser();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  const admin = isAdminEmail(user?.email) || user?.role === "admin";
  const items = getMenuForUser(user);

  return (
    <header className="md:hidden sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border/60">
      <div className="flex items-center justify-between px-3 h-14">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button aria-label="Open menu" className="w-10 h-10 rounded-xl bg-secondary grid place-items-center active:scale-95 transition">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetHeader className="p-5 border-b border-border">
              <SheetTitle className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl gradient-primary text-primary-foreground grid place-items-center shadow-elevated">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-base font-black tracking-tight">EduTrack</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Multi-Tenant Suite</p>
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {STUDENT_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    activeOptions={{ exact: it.exact }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 data-[status=active]:text-primary-foreground data-[status=active]:gradient-primary transition-all"
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
              {admin && (
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all"
                >
                  <Users className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">Admin Command Center</span>
                </Link>
              )}
            </nav>
            <div className="p-3 border-t border-border">
              <button
                onClick={handleSignOut}
                className="w-full h-11 rounded-xl bg-destructive/10 text-destructive text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-destructive/15 transition"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/student" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary text-primary-foreground grid place-items-center">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="text-sm font-black tracking-tight">EduTrack</span>
        </Link>

        <div className="w-10" aria-hidden />
      </div>
    </header>
  );
}
