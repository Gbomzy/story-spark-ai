import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      if (typeof window !== "undefined") window.location.href = immediate;
      return null;
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <AuthShell title="Authorization error" subtitle="This authorization request could not be loaded.">
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </AuthShell>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as OAuthDetails | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const redirectUri = details?.client?.redirect_uris?.[0];
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <AuthShell
      title={`Connect ${clientName} to StorySpark AI`}
      subtitle="This lets the app use StorySpark AI as you."
    >
      <div className="space-y-4">
        {redirectUri && (
          <p className="text-xs text-muted-foreground break-all">
            Redirects to <span className="font-mono">{redirectUri}</span>
          </p>
        )}
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">{clientName} will be able to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Call StorySpark AI tools while you are signed in</li>
            <li>Read and modify only your own projects, credits, and assets</li>
          </ul>
          {scopes.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Requested scopes: <span className="font-mono">{scopes.join(" ")}</span>
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            This does not bypass StorySpark AI's permissions or backend policies.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1 rounded-xl gradient-primary text-white shadow-glow hover:opacity-95"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => decide(false)}
            disabled={busy}
            className="flex-1 rounded-xl"
          >
            Cancel connection
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}