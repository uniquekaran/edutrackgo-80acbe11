import { Link } from "@tanstack/react-router";
import { BookOpen, Compass, Presentation, TrendingUp, Briefcase } from "lucide-react";

const RESOURCES = [
  { name: "MIT OpenCourseWare", url: "https://ocw.mit.edu/", tag: "STEM Fundamentals" },
  { name: "Coursera – Career Certificates", url: "https://www.coursera.org/professional-certificates", tag: "Career Ready" },
  { name: "Harvard Business Publishing", url: "https://hbsp.harvard.edu/home/", tag: "Case Studies" },
  { name: "Khan Academy", url: "https://www.khanacademy.org/", tag: "Concept Mastery" },
  { name: "edX MicroMasters", url: "https://www.edx.org/masters", tag: "Executive Skills" },
];

export function GlobalDashboard({ readinessPct }: { readinessPct: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Link to="/student/materials" className="rounded-2xl glass shadow-soft p-4 active:scale-[0.98] transition">
          <BookOpen className="w-5 h-5 text-primary" />
          <p className="mt-2 text-sm font-bold">Core Coursework Ledger</p>
          <p className="text-[10px] text-muted-foreground">Subject-wise modules</p>
        </Link>
        <Link to="/student/competency" className="rounded-2xl glass shadow-soft p-4 active:scale-[0.98] transition">
          <Presentation className="w-5 h-5 text-primary" />
          <p className="mt-2 text-sm font-bold">Venture Feasibility PPTs</p>
          <p className="text-[10px] text-muted-foreground">5-slot corporate vault</p>
        </Link>
      </div>

      <div className="rounded-2xl glass-strong neon-border shadow-elevated p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Career Readiness Index
            </p>
            <p className="mt-1 text-3xl font-black">{readinessPct}%</p>
            <p className="text-xs text-muted-foreground">Momentum across attendance, coursework and tasks.</p>
          </div>
          <div className="w-14 h-14 rounded-full grid place-items-center gradient-primary text-primary-foreground font-black shadow-elevated">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <p className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5"><Compass className="w-4 h-4" /> Curated Academic Resources</p>
        <p className="text-[11px] text-muted-foreground">Global standard, vetted portals.</p>
      </div>
      <div className="rounded-2xl glass shadow-soft divide-y divide-border/60">
        {RESOURCES.map((r) => (
          <a key={r.url} href={r.url} target="_blank" rel="noreferrer"
             className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">{r.tag}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
