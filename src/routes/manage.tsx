import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Building2, HelpCircle, FileUp, ShieldAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { isAdminEmail } from "@/lib/tenant";
import { RouteSkeleton } from "@/components/RouteSkeleton";

export const Route = createFileRoute("/manage")({
  head: () => ({ meta: [{ title: "Admin Console — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: ManageLayout,
});

function ManageLayout() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const loc = useLocation();
  const authorized = !!user && (user.role === "admin" || isAdminEmail(user.email));

  useEffect(() => {
    if (!user) { navigate({ to: "/auth/admin" }); return; }
    if (!authorized) navigate({ to: "/" });
  }, [user, authorized, navigate]);

  if (!user) return null;
  if (!authorized) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
          <p className="text-sm font-bold mt-2">Admins only</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: "/manage/companies", label: "Companies", icon: Building2 },
    { to: "/manage/questions", label: "Question Bank", icon: HelpCircle },
    { to: "/manage/syllabus", label: "Syllabi", icon: FileUp },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 sm:px-8 pt-8 pb-4 border-b border-border">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="text-2xl font-black">Management Console</h1>
        <nav className="mt-4 flex gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-full whitespace-nowrap ${active ? "gradient-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="px-5 sm:px-8 py-6 max-w-4xl mx-auto"><Outlet /></main>
    </div>
  );
}
