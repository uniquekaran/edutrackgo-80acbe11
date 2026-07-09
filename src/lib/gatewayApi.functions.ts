import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/gatewayapi";

async function gatewayFetch(path: string, init: RequestInit = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GATEWAYAPI_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("GatewayAPI configuration missing");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connKey);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[gatewayapi] ${path} -> ${res.status}: ${text}`);
    throw new Error(`GatewayAPI request failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

/** Verify credentials via the connector gateway's verify endpoint (non-destructive). */
export const testGatewayApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GATEWAYAPI_API_KEY;
    if (!lovableKey || !connKey) {
      return { ok: false, error: "GatewayAPI configuration missing" as const };
    }
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
        },
      });
      const body = await res.text();
      if (!res.ok) {
        console.error(`[gatewayapi/verify] ${res.status}: ${body}`);
        return { ok: false, error: `Verify failed [${res.status}]` };
      }
      const parsed = (() => { try { return JSON.parse(body); } catch { return {}; } })() as {
        outcome?: string; latency_ms?: number; error?: string;
      };
      return { ok: parsed.outcome === "verified" || parsed.outcome === "skipped", outcome: parsed.outcome, latency_ms: parsed.latency_ms, error: parsed.error };
    } catch (err) {
      console.error("[gatewayapi/verify] error", err);
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  });

/** Send a single SMS via GatewayAPI Mobile Messaging. */
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient: number; message: string; sender?: string; reference?: string }) => input)
  .handler(async ({ data }) => {
    try {
      const res = await gatewayFetch("/mobile/single", {
        method: "POST",
        body: JSON.stringify({
          sender: data.sender ?? "EduTrack",
          recipient: data.recipient,
          message: data.message,
          reference: data.reference,
        }),
      });
      return { ok: true, res };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  });
