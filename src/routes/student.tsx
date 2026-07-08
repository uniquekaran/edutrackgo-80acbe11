import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { MobileNavbar } from "@/components/MobileNavbar";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { store, useStore } from "@/lib/store";
import { isAdminEmail } from "@/lib/tenant";

export const Route = createFileRoute("/student")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const u = store.get().user;
    if (!u) throw redirect({ to: "/auth" });
    if (u.role !== "student") throw redirect({ to: "/admin" });
  },
  pendingComponent: RouteSkeleton,
  component: StudentLayout,
});

function StudentLayout() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const needsOnboarding = !!user && user.role === "student" && !isAdminEmail(user.email) && !user.college;

  useEffect(() => {
    if (!needsOnboarding) return;
    const t = setTimeout(() => navigate({ to: "/onboarding" }), 500);
    return () => clearTimeout(t);
  }, [needsOnboarding, navigate]);

  if (needsOnboarding) {
    return (
      <div className="min-h-screen w-full grid place-items-center bg-background">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">Redirecting to onboarding…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      <DesktopSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileNavbar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-md md:max-w-3xl">
            <Outlet />
          </div>
        </div>
        <div className="md:hidden mx-auto w-full max-w-md">
          <BottomNav />
        </div>
      </main>
    </div>
  );
}

