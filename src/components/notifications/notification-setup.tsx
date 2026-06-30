"use client";

import { useEffect } from "react";
import {
  requestNotificationPermission,
  setNativeNotificationsEnabled,
} from "@/lib/notify";

/**
 * Applies the account's notification preference to the `notify()` dispatcher
 * and, when enabled, requests OS permission on first mount. Renders nothing.
 */
export function NotificationSetup({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    setNativeNotificationsEnabled(enabled);
    if (enabled) void requestNotificationPermission();
  }, [enabled]);

  return null;
}
