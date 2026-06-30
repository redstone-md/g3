"use client";

import { useEffect } from "react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { useMeQuery } from "@/hooks/use-auth";
import { QueryProvider } from "@/providers/query-provider";

function ChangePasswordInner() {
  const { data: user, isError } = useMeQuery();

  useEffect(() => {
    if (isError) window.location.assign("/login");
  }, [isError]);

  if (!user) return null;

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

export default function ChangePasswordPage() {
  return (
    <QueryProvider>
      <ChangePasswordInner />
    </QueryProvider>
  );
}
