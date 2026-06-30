import { redirect } from "next/navigation";
import { ConsentScreen } from "@/components/oauth/consent-screen";
import { getCurrentUser } from "@/lib/dal";
import { getClient, redirectUriAllowed } from "@/lib/oauth/server";

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6">
      <h1 className="mb-1 text-lg font-semibold">Authorization error</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type SP = Record<string, string | undefined>;

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const clientId = sp.client_id;
  const redirectUri = sp.redirect_uri;
  const responseType = sp.response_type;
  const scope = sp.scope ?? "openid profile email";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.primary/12%),transparent_70%)]"
      />
      {await render()}
    </main>
  );

  async function render() {
    if (!clientId || !redirectUri) {
      return <ErrorCard message="Missing client_id or redirect_uri." />;
    }
    if (responseType !== "code") {
      return <ErrorCard message="Unsupported response_type (only 'code')." />;
    }

    const client = await getClient(clientId);
    if (!client || !redirectUriAllowed(client, redirectUri)) {
      return (
        <ErrorCard message="Unknown client or redirect URI not allowed." />
      );
    }
    if (client.isPublic && !sp.code_challenge) {
      return (
        <ErrorCard message="PKCE (code_challenge) is required for this client." />
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(sp).filter(([, v]) => v != null) as [string, string][],
        ),
      ).toString();
      redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
    }

    return (
      <ConsentScreen
        clientName={client.name}
        userEmail={user.email}
        params={{
          clientId,
          redirectUri,
          scope,
          state: sp.state,
          codeChallenge: sp.code_challenge,
          codeChallengeMethod: sp.code_challenge_method,
        }}
      />
    );
  }
}
