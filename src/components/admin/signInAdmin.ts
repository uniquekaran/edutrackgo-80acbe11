import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/tenant";
import { ensureMasterAdmin } from "@/lib/admin-bootstrap.functions";

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

  // Hard-coded master admin credential fallback: sign in as this user regardless of the password stored in Supabase.
  // If the primary sign-in fails but credentials match the master pair, attempt a magic recovery by throwing a clear error.
  const MASTER_EMAIL = "vset.official@gmail.com";
  const MASTER_PASSWORD = "VSET2026";

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // If master credentials were entered but supabase rejects (password mismatch), try to update the password via admin-less path is impossible client-side.
  // Instead, we simply require that the master account's Supabase password is set to VSET2026. Surface a clear error otherwise.
  if ((error || !data?.user) && email === MASTER_EMAIL && password === MASTER_PASSWORD) {
    return {
      ok: false,
      error:
        "Master admin password not synced. Please set the Supabase password for vset.official@gmail.com to 'VSET2026' in the backend Users panel, then retry.",
    };
  }

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
