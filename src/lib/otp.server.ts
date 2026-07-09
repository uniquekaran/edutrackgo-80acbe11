// Server-only helpers for OTP token signing and SMS delivery.
// This file must NOT be imported at module scope from any client-reachable file.
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/gatewayapi";
export const OTP_TTL_SEC = 300;

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function hashOtp(otp: string, phone: string, secret: string): string {
  return createHash("sha256").update(`${otp}|${phone}|${secret}`).digest("hex");
}

export interface OtpPayload { phone: string; hash: string; exp: number; nonce: string }

export function signToken(payload: OtpPayload, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): OtpPayload | null {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) return null;
  const expected = b64url(createHmac("sha256", secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as OtpPayload;
    if (typeof payload?.phone !== "string" || typeof payload?.hash !== "string" || typeof payload?.exp !== "number") return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Normalize a raw mobile input to E.164 digits (no leading +). Defaults to +91 for 10-digit inputs. */
export function normalizePhone(input: string): string | null {
  const digits = (input ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function generateOtp(): string {
  // 6-digit code using crypto-strong randomness.
  const buf = randomBytes(3);
  const n = ((buf[0]! << 16) | (buf[1]! << 8) | buf[2]!) % 1_000_000;
  return String(n).padStart(6, "0");
}

export function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}

export function nonce(): string {
  return randomBytes(8).toString("hex");
}

export async function sendSms(recipient: number, message: string, reference?: string) {
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

export function bufEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
