import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/dal";
import { isSsoConfigured } from "@/lib/oauth/sso-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Authoritative check (not just cookie presence) — a revoked/stale cookie
  // must still render the login form, never bounce, to avoid a redirect loop.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      {/* Ambient gradient backdrop (decorative, transform-free). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.primary/12%),transparent_70%)]"
      />
      <LoginForm
        next={next}
        showSso={isSsoConfigured()}
        ssoError={error?.startsWith("sso_")}
      />
    </main>
  );
}
