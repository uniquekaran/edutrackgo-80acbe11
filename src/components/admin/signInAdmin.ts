import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/tenant";

export interface AdminSignInResult {
  ok: boolean;
  error?: string;
}

/**
 * Authenticate an administrator.
 * 1) supabase.auth.signInWithPassword
 * 2) Verify user_roles.role === 'admin'
 * 3) Verify profile.college matches the selected college (bypass for master admin emails)
 * On failure, signs out and returns an error string.
 */
export async function signInAdmin(params: {
  email: string;
  password: string;
  college: string;
}): Promise<AdminSignInResult> {
  const email = params.email.trim().toLowerCase();
  const { password, college } = params;

  if (!email || !password) return { ok: false, error: "Email and password are required." };
  if (!college) return { ok: false, error: "Please select your college first." };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Invalid credentials." };
  }

  const userId = data.user.id;

  const [{ data: roleRow }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("profiles").select("college").eq("id", userId).maybeSingle(),
  ]);

  const isAdmin = !!roleRow || isAdminEmail(email);
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { ok: false, error: "Access Denied: administrator account required." };
  }

  // Master admin bypass: skip college match check.
  if (!isAdminEmail(email)) {
    if (!profile?.college || profile.college !== college) {
      await supabase.auth.signOut();
      return { ok: false, error: "This administrator is not registered for the selected college." };
    }
  }

  return { ok: true };
}
