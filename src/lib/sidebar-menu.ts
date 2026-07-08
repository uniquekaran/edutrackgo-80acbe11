import {
  LayoutDashboard, Sparkles, BookOpenCheck, GaugeCircle, Presentation,
  Building2, BookOpen, Wallet, ShieldCheck, ScrollText, Brain,
  Compass, Globe, UserCircle, Settings, ShieldAlert,
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
  { to: "/student/quiz", label: "Daily Quiz", icon: Brain },
  { to: "/student/tracker", label: "Academic Tracker", icon: GaugeCircle },
  { to: "/student/competency", label: "Success Blueprint", icon: Presentation },
  { to: "/student/companies", label: "Target Companies", icon: Building2 },
  { to: "/student/materials", label: "Academic Hub", icon: BookOpen },
  { to: "/student/noc", label: "Fees & Reporting", icon: Wallet },
  { to: "/student/vault", label: "Documents Vault", icon: ShieldCheck },
  { to: "/student/noc", label: "NOC Requests", icon: ScrollText },
];

const GLOBAL: MenuItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/student/quiz", label: "Daily Quiz", icon: Brain },
  { to: "/student/tracker", label: "Career Roadmap", icon: Compass },
  { to: "/student/companies", label: "Target Companies", icon: Building2 },
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
  const base = isCoreSuiteUser(user) ? CORE : GLOBAL;
  if (user && (user.role === "admin" || isAdminEmail(user.email))) {
    return [...base, { to: "/manage/companies", label: "Admin Console", icon: ShieldAlert }];
  }
  return base;
}
