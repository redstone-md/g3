import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { verifySession } from "@/lib/dal";

export default async function ChangePasswordPage() {
  const user = await verifySession();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.primary/12%),transparent_70%)]"
      />
      <ChangePasswordForm mustChange={user.mustChangePassword} />
    </main>
  );
}
