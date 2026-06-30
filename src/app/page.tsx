"use client";

import { useEffect } from "react";

/** Root entry — the static SPA bounces straight to the dashboard. */
export default function Home() {
  useEffect(() => {
    window.location.replace("/dashboard");
  }, []);
  return null;
}
