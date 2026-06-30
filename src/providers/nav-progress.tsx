"use client";

import { ProgressProvider } from "@bprogress/next/app";

/** Global top navigation progress bar (project UX convention). */
export function NavProgress({ children }: { children: React.ReactNode }) {
  return (
    <ProgressProvider
      height="2px"
      color="var(--primary)"
      options={{ showSpinner: false }}
      shallowRouting
    >
      {children}
    </ProgressProvider>
  );
}
