import { createServerFn } from "@tanstack/react-start";
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/gatewayapi";
const OTP_TTL_SEC = 300; // 5 minutes

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hashOtp(otp: string, phone: string, secret: string): string {
  return createHash("sha256").update(`${otp}|${phone}|${secret}`).digest("hex");
}

function signToken(payload: { phone: string; hash: string; exp: number; nonce: string }, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken(token: string, secret: string): { phone: string; hash: string; exp: number; nonce: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(createHmac("sha256", secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8"));
    if (typeof payload?.phone !== "string" || typeof payload?.hash !== "string" || typeof payload?.exp !== "number") return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Normalize a raw mobile input to E.164 digits (no leading +). Defaults to +91 for 10-digit inputs. */
function normalizePhone(input: string): string | null {
  const digits = (input ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  // Bare 10-digit → prefix India country code.
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

async function sendSms(recipient: number, message: string, reference?: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GATEWAYAPI_API_KEY;
  if (!lovableKey || !connKey) throw new Error("SMS gateway not configured");
  const res = await fetch(`${GATEWAY_URL}/mobile/single`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender: "EduTrack", recipient, message, reference }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[otp/sendSms] ${res.status}: ${text}`);
    throw new Error(`SMS provider error [${res.status}]`);
  }
  return text;
}

export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((i: { phone: string }) => i)
  .handler(async ({ data }) => {
    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) return { ok: false, error: "OTP signing secret not configured" };

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Enter a valid mobile number" };

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const exp = Math.floor(Date.now() / 1000) + OTP_TTL_SEC;
    const nonce = randomBytes(8).toString("hex");
    const hash = hashOtp(otp, phone, secret);
    const token = signToken({ phone, hash, exp, nonce }, secret);

    try {
      await sendSms(Number(phone), `Your EduTrack verification code is ${otp}. It expires in 5 minutes.`, `otp-${nonce}`);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to send OTP" };
    }

    return { ok: true, token, phone, expiresAt: exp };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((i: { phone: string; code: string; token: string; fullName?: string }) => i)
  .handler(async ({ data }) => {
    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) return { ok: false as const, error: "OTP signing secret not configured" };

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false as const, error: "Invalid mobile number" };

    const payload = verifyToken(data.token, secret);
    if (!payload || payload.phone !== phone) return { ok: false as const, error: "OTP session invalid or expired. Request a new code." };

    const code = (data.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return { ok: false as const, error: "Enter the 6-digit code" };

    const expected = hashOtp(code, phone, secret);
    const a = Buffer.from(expected);
    const b = Buffer.from(payload.hash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false as const, error: "Incorrect code. Please try again." };
    }

    // OTP verified — provision or refresh the auth user.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const syntheticEmail = `mobile+${phone}@vset-otp.local`;
    const oneTimePassword = randomBytes(24).toString("base64url");

    // Look up existing profile by phone
    const { data: profileByPhone } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("phone", `+${phone}`)
      .maybeSingle();

    let userId = profileByPhone?.id ?? null;
    let signInEmail = profileByPhone?.email ?? syntheticEmail;

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
      signInEmail = syntheticEmail;

      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        email: syntheticEmail,
        full_name: data.fullName?.trim() || `Student ${phone.slice(-4)}`,
        phone: `+${phone}`,
      });
    }

    return { ok: true as const, email: signInEmail, password: oneTimePassword };
  });
