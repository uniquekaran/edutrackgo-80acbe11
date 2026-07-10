import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, BarChart3, ArrowRight } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://edutrackgo.lovable.app/" }],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <MobileShell>
      <div className="flex-1 flex flex-col gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-40 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative px-6 pt-12 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur grid place-items-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-80">College OS</p>
            <h1 className="text-xl font-black">EduTrack — Modern College Management</h1>

          </div>
        </div>

        <div className="relative px-6 mt-10 flex-1 flex flex-col">
          <p className="text-sm font-semibold opacity-80">Welcome to</p>
          <h2 className="text-5xl font-black leading-[1.05] mt-1">
            One campus.<br />Zero friction.
          </h2>
          <p className="mt-4 text-base opacity-90 leading-relaxed">
            Track attendance, submit documents, and stay in sync with announcements — built for students and administrators.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <Feature icon={<BarChart3 className="w-5 h-5" />} label="Attendance" />
            <Feature icon={<ShieldCheck className="w-5 h-5" />} label="Verified Docs" />
            <Feature icon={<GraduationCap className="w-5 h-5" />} label="Broadcasts" />
          </div>

          <div className="mt-auto pb-8 pt-10 space-y-3">
            <Link
              to="/auth"
              className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-white text-primary font-bold shadow-elevated active:scale-[0.98] transition-transform"
            >
              Teacher / Student Login <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/network"
              className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-white/10 backdrop-blur border border-white/20 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              Explore the EduAI Network →
            </Link>
            <p className="text-center text-xs opacity-80">
              One tap. No passwords. New users join as students.
            </p>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-3 flex flex-col items-center gap-1.5">
      {icon}
      <span className="text-[11px] font-semibold opacity-90">{label}</span>
    </div>
  );
}
