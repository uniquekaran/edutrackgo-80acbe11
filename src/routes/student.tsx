import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { MobileNavbar } from "@/components/MobileNavbar";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { store } from "@/lib/store";

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
