import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { setCurrentUser, signOut as clearLocalUser, randomDepartment, store } from "@/lib/store";
import type { User } from "@/lib/store";
import { isAdminUser } from "@/lib/auth-helpers";

// Kept for profile-side college defaulting only. Never used to block sign-in.
const LEGACY_MASTER_EMAILS = new Set(["vset.official@gmail.com", "630karan@gmail.com", "630karan2@gmail.com"]);
function isLegacyMaster(email: string) { return LEGACY_MASTER_EMAILS.has(email.toLowerCase()); }


interface HydrateResult {
  user: User;
  needsOnboarding: boolean;
}

async function hydrateUser(userId: string, email: string, fallbackName?: string, avatarUrl?: string): Promise<HydrateResult | null> {
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, department, college").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);

  const adminByEmail = isAdminUser(email);
  const role: "admin" | "student" = roleRow || adminByEmail ? "admin" : "student";
  const name = profile?.full_name || fallbackName || email.split("@")[0];

  let department = profile?.department ?? undefined;
  if (role === "student" && !department && profile) {
    department = randomDepartment();
    await supabase.from("profiles").update({ department }).eq("id", userId);
  }

  const legacyMaster = isLegacyMaster(email);
  if (!profile) {
    await supabase.from("profiles").upsert({
      id: userId,
      email,
      full_name: name,
      avatar_url: avatarUrl ?? null,
      department: role === "student" ? randomDepartment() : null,
      college: legacyMaster ? "AKTU" : null,
    });
  }

  let college = profile?.college ?? (legacyMaster ? "AKTU" : null);
  if (legacyMaster && profile?.college !== "AKTU") {
    await supabase.from("profiles").update({ college: "AKTU" }).eq("id", userId);
    college = "AKTU";
  }
  if (adminByEmail && !roleRow) {
    await supabase.from("user_roles").insert({ user_id: userId, role: "admin" }).select().maybeSingle();
  }

  const needsOnboarding = role === "student" && !adminByEmail && !college;
  return { user: { id: userId, name, email, role, department, college }, needsOnboarding };
}


export function useSupabaseAuth() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let mounted = true;
    // Track the last authenticated user id so repeat SIGNED_IN events
    // (fired when a mobile browser resumes the tab after the native file
    // picker, or when Supabase re-hydrates on focus) do NOT trigger a
    // navigation. Only a genuinely new sign-in should redirect.
    let lastUserId: string | null = null;

    const sync = async (session: import("@supabase/supabase-js").Session | null, opts?: { redirect?: boolean }) => {
      if (!session?.user) {
        clearLocalUser();
        return;
      }
      const u = session.user;
      const email = (u.email ?? "").toLowerCase();

      // Admin gating is enforced only on admin routes themselves (see /admin route guard
      // and /auth/admin page). Do NOT sign users out here — student sessions (mobile OTP
      // or Google) are always valid on non-admin surfaces.

      const result = await hydrateUser(
        u.id,
        u.email ?? "",
        (u.user_metadata as { full_name?: string; name?: string })?.full_name ??
          (u.user_metadata as { name?: string })?.name,
        (u.user_metadata as { avatar_url?: string })?.avatar_url,
      );
      if (!mounted || !result) return;
      setCurrentUser(result.user);

      if (result.needsOnboarding) {
        if (window.location.pathname !== "/onboarding") {
          navigate({ to: "/onboarding" });
        }
        return;
      }
      if (opts?.redirect) {
        // Only navigate away from the auth entry pages. If the user is
        // already inside the app (e.g. returning from the mobile file
        // picker on /student/documents), preserve their current route.
        const path = window.location.pathname;
        const onAuthPage = path === "/" || path.startsWith("/auth");
        if (onAuthPage) {
          navigate({ to: result.user.role === "admin" ? "/admin" : "/student" });
        }
      }
    };


    supabase.auth.getSession().then(({ data }) => {
      lastUserId = data.session?.user?.id ?? null;
      sync(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        const uid = session?.user?.id ?? null;
        // Supabase re-fires SIGNED_IN on tab resume / token refresh on
        // some mobile browsers. Skip the redirect when it's the same
        // user we already had — this is what caused mobile users to be
        // kicked back to the dashboard after picking a file.
        const isNewLogin = !!uid && uid !== lastUserId;
        lastUserId = uid;
        setTimeout(() => sync(session, { redirect: isNewLogin }), 0);
      } else if (event === "SIGNED_OUT") {
        lastUserId = null;
        clearLocalUser();
        navigate({ to: "/auth" });
      } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setTimeout(() => sync(session), 0);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  void pathname;
  void store;
}
