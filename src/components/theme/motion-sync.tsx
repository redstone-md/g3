"use client";

import { useEffect } from "react";
import { applyMotionClass, MOTION_COOKIE } from "@/lib/motion";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Reconciles the rendered animation preset with the account's DB value on load
 * (corrects a stale cookie when changed on another device). Renders nothing.
 */
export function MotionSync({ motion }: { motion: string }) {
  useEffect(() => {
    applyMotionClass(motion);
    document.cookie = `${MOTION_COOKIE}=${motion};path=/;max-age=${ONE_YEAR};samesite=lax`;
  }, [motion]);

  return null;
}
