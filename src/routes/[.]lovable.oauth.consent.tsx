import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuthorizationDetails {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oauth = (supabase.auth as unknown as { oauth: any }).oauth;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const details = data as AuthorizationDetails | null;
    const immediate = details?.redirect_url ?? details?.redirect_to;
    if (immediate && !details?.client) throw redirect({ href: immediate });
    return details;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-lg font-black mb-2">Could not load this authorization request</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oauth = (supabase.auth as unknown as { oauth: any }).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = (data as AuthorizationDetails | null)?.redirect_url ?? (data as AuthorizationDetails | null)?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const name = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl glass-strong shadow-elevated p-6 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Authorize connection</p>
          <h1 className="text-2xl font-black mt-1">Connect {name} to your EduTrack account</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This lets <span className="font-bold">{name}</span> access EduTrack tools as you. You can revoke access anytime.
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 bg-secondary text-foreground font-bold text-sm py-3 rounded-2xl disabled:opacity-50"
          >
            Deny
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-3 rounded-2xl shadow-elevated disabled:opacity-50"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
}
