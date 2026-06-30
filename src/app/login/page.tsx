"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      {/* Ambient gradient backdrop (decorative, transform-free). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.primary/12%),transparent_70%)]"
      />
      <LoginForm next={next} />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
