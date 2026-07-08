import {
  LayoutDashboard, Sparkles, BookOpenCheck, GaugeCircle, Presentation,
  Building2, BookOpen, ListChecks, Wallet, ShieldCheck, ScrollText,
  Compass, Globe, UserCircle, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isAdminEmail } from "@/lib/tenant";
import type { User } from "@/lib/store";

export interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const CORE: MenuItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/student/eduai", label: "EduAI Assistant", icon: Sparkles },
  { to: "/student/exams", label: "Exam Portal & PYQs", icon: BookOpenCheck },
  { to: "/student/tracker", label: "Academic Tracker", icon: GaugeCircle },
  { to: "/student/competency", label: "Success Blueprint", icon: Presentation },
  { to: "/network", label: "Target Companies", icon: Building2 },
  { to: "/student/materials", label: "Academic Hub", icon: BookOpen },
  { to: "/student/tracker", label: "Master Checklist", icon: ListChecks },
  { to: "/student/noc", label: "Fees & Reporting", icon: Wallet },
  { to: "/student/vault", label: "Documents Vault", icon: ShieldCheck },
  { to: "/student/noc", label: "NOC Requests", icon: ScrollText },
  { to: "/student/materials", label: "Academic Portal", icon: BookOpen },
];

const GLOBAL: MenuItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/student/tracker", label: "Career Roadmap", icon: Compass },
  { to: "/student/materials", label: "Global Resources", icon: Globe },
  { to: "/student/profile", label: "My Profile", icon: UserCircle },
  { to: "/student/profile", label: "Settings", icon: Settings },
];

export function isCoreSuiteUser(user: Pick<User, "email" | "role" | "college"> | null | undefined) {
  if (!user) return false;
  if (user.role === "admin" || isAdminEmail(user.email)) return true;
  return user.college === "AKTU" || user.college === "VSET";
}

export function getMenuForUser(user: Pick<User, "email" | "role" | "college"> | null | undefined): MenuItem[] {
  return isCoreSuiteUser(user) ? CORE : GLOBAL;
}
