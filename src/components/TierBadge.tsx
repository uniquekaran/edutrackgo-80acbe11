import { Crown, Award, Medal, Sparkles } from "lucide-react";
import type { Tier } from "@/lib/tenant";

const CFG: Record<Tier, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  Member:   { bg: "bg-muted",                    text: "text-foreground",       icon: <Sparkles className="w-3 h-3" />, label: "Member" },
  Silver:   { bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-800 dark:text-slate-100", icon: <Medal className="w-3 h-3" />, label: "Silver" },
  Gold:     { bg: "bg-amber-200 dark:bg-amber-500/30", text: "text-amber-900 dark:text-amber-200", icon: <Award className="w-3 h-3" />, label: "Gold" },
  Platinum: { bg: "bg-gradient-to-r from-indigo-200 to-purple-200 dark:from-indigo-500/30 dark:to-purple-500/30", text: "text-indigo-900 dark:text-indigo-100", icon: <Crown className="w-3 h-3" />, label: "Platinum" },
};

export function TierBadge({ tier }: { tier: Tier }) {
  const c = CFG[tier] ?? CFG.Member;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${c.bg} ${c.text}`}>
      {c.icon}
      {c.label}
    </span>
  );
}
