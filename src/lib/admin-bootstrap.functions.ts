import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Master admin credential allowlist. Kept in sync with signInAdmin.ts.
const MASTER_CREDENTIALS: Record<string, string> = {
  "vset.official@gmail.com": "VSET2026",
};

/**
 * If the caller supplies credentials matching a master admin pair, ensure the
 * corresponding auth user exists and its password is synced to the expected
 * value. This lets us hard-code a working admin login without shipping the
 * password in a client-side check.
 */
export const ensureMasterAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const expected = MASTER_CREDENTIALS[email];
    if (!expected || expected !== data.password) {
      return { ok: false as const, reason: "not-master" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing user by email.
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return { ok: false as const, reason: listErr.message };

    const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email);

    let userId: string;
    if (existing) {
      userId = existing.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
      });
      if (updErr) return { ok: false as const, reason: updErr.message };
    } else {
      const { data: created, error: crErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
      });
      if (crErr || !created.user) return { ok: false as const, reason: crErr?.message ?? "create-failed" };
      userId = created.user.id;
    }

    // Ensure profile + admin role rows exist.
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, email, full_name: "VSET Admin", college: "AKTU" },
      { onConflict: "id" },
    );
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    return { ok: true as const };
  });
