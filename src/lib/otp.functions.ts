import { createServerFn } from "@tanstack/react-start";

export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((i: { phone: string }) => i)
  .handler(async ({ data }) => {
    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) return { ok: false as const, error: "OTP signing secret not configured" };

    const {
      normalizePhone, generateOtp, hashOtp, signToken, sendSms, nonce, OTP_TTL_SEC,
    } = await import("@/lib/otp.server");

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false as const, error: "Enter a valid mobile number" };

    const otp = generateOtp();
    const exp = Math.floor(Date.now() / 1000) + OTP_TTL_SEC;
    const n = nonce();
    const hash = hashOtp(otp, phone, secret);
    const token = signToken({ phone, hash, exp, nonce: n }, secret);

    try {
      await sendSms(
        Number(phone),
        `Your EduTrack verification code is ${otp}. It expires in 5 minutes.`,
        `otp-${n}`,
      );
    } catch (err) {
      console.error("[otp/send] SMS failure", err);
      return { ok: false as const, error: err instanceof Error ? err.message : "Failed to send OTP" };
    }

    return { ok: true as const, token, phone, expiresAt: exp };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((i: { phone: string; code: string; token: string; fullName?: string }) => i)
  .handler(async ({ data }) => {
    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) return { ok: false as const, error: "OTP signing secret not configured" };

    const {
      normalizePhone, hashOtp, verifyToken, bufEq, randomPassword,
    } = await import("@/lib/otp.server");

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false as const, error: "Invalid mobile number" };

    const payload = verifyToken(data.token, secret);
    if (!payload || payload.phone !== phone) {
      return { ok: false as const, error: "OTP session invalid or expired. Request a new code." };
    }

    const code = (data.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return { ok: false as const, error: "Enter the 6-digit code" };

    const expected = hashOtp(code, phone, secret);
    if (!bufEq(expected, payload.hash)) {
      return { ok: false as const, error: "Incorrect code. Please try again." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const syntheticEmail = `mobile+${phone}@vset-otp.local`;
    const oneTimePassword = randomPassword();

    const { data: profileByPhone } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("phone", `+${phone}`)
      .maybeSingle();

    let userId = profileByPhone?.id ?? null;
    const signInEmail = profileByPhone?.email ?? syntheticEmail;

    if (userId) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: oneTimePassword });
      if (updErr) {
        console.error("[otp/verify] updateUserById", updErr);
        return { ok: false as const, error: "Failed to prepare sign-in. Try again." };
      }
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: oneTimePassword,
        email_confirm: true,
        phone: `+${phone}`,
        phone_confirm: true,
        user_metadata: { phone: `+${phone}`, full_name: data.fullName ?? null, signup_method: "mobile_otp" },
      });
      if (createErr || !created?.user) {
        console.error("[otp/verify] createUser", createErr);
        return { ok: false as const, error: createErr?.message ?? "Failed to create account" };
      }
      userId = created.user.id;

      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        email: syntheticEmail,
        full_name: data.fullName?.trim() || `Student ${phone.slice(-4)}`,
        phone: `+${phone}`,
      });
    }

    return { ok: true as const, email: signInEmail, password: oneTimePassword };
  });
