// Multi-tenant tenant helpers.
// isCoreMember: user is part of the AKTU/VSET core committee (or the master admin).
// The rest of the world sees the "Enterprise Mode" experience with global terminology.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const CORE_COLLEGES = ["AKTU", "VSET"] as const;
export const ADMIN_EMAILS = ["vset.official@gmail.com", "630karan@gmail.com", "630karan2@gmail.com"] as const;

export type Tier = "Member" | "Silver" | "Gold" | "Platinum";
export type College = "AKTU" | "VSET" | "Others";

export interface TenantProfile {
  id: string;
  email: string;
  full_name: string | null;
  college: string | null;
  phone: string | null;
  batch: string | null;
  professional_tier: Tier;
  onboarded_at: string | null;
}

export function isCoreMember(profile: Pick<TenantProfile, "college" | "email"> | null | undefined) {
  if (!profile) return false;
  const email = (profile.email ?? "").toLowerCase();
  if (email === "vset.official@gmail.com") return true;
  return profile.college === "AKTU" || profile.college === "VSET";
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase());
}

/**
 * Live tenant profile hook (client-side, RLS-scoped to current user).
 * Returns { profile, isCoreMember, tier, loading }.
 */
export function useTenant() {
  const user = useStore((s) => s.user);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,college,phone,batch,professional_tier,onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;
      setProfile((data ?? null) as TenantProfile | null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  return {
    profile,
    isCoreMember: isCoreMember(profile),
    tier: (profile?.professional_tier ?? "Member") as Tier,
    loading,
  };
}

// Terminology map: swap internal shorthand for professional labels in Global mode.
const GLOBAL_TERMS: Record<string, string> = {
  "Helping Hand": "Social Impact Initiative",
  "Command Center": "Enterprise Dashboard",
  "Core Committee": "Enterprise Members",
  "Physical Registers": "Compliance Ledgers",
  "VSDT Readiness": "Venture Readiness",
  "Meeting Alerts": "Executive Alerts",
  "AKTU Channels": "Curated Learning Feeds",
};

export function t(term: string, isCore: boolean) {
  if (isCore) return term;
  return GLOBAL_TERMS[term] ?? term;
}
