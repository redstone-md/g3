import { toast } from "sonner";

/**
 * Universal client-side notification dispatcher.
 *
 * Call `notify(...)` from anywhere on the client. When the tab is visible the
 * message shows as an in-page toast; when the tab is hidden/minimized it shows
 * as a native OS notification (falling back to a queued toast if permission was
 * never granted).
 *
 * Note: native notifications only fire while the browser is running. Delivery
 * with the browser fully closed would require a Service Worker + Web Push.
 */

export type NotifyVariant =
  | "default"
  | "success"
  | "error"
  | "info"
  | "warning";

export interface NotifyOptions {
  title: string;
  description?: string;
  variant?: NotifyVariant;
  /** Toast lifetime in ms (visible-tab path). */
  duration?: number;
  /** Icon URL for the native (hidden-tab) notification. */
  icon?: string;
  /** Coalesces repeat native notifications under the same tag. */
  tag?: string;
  /** Invoked on click — toast action button, or native notification click. */
  onClick?: () => void;
}

const DEFAULT_ICON = "/favicon.ico";

// User preference (set from their account by NotificationSetup). When false,
// notify() always uses the toast channel, never native OS notifications.
let nativeEnabled = true;
export function setNativeNotificationsEnabled(enabled: boolean): void {
  nativeEnabled = enabled;
}

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current OS permission state, or "unsupported". */
export function notificationPermission():
  | NotificationPermission
  | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** Ask for OS notification permission. Returns true when granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function showToast(options: NotifyOptions): void {
  const {
    title,
    description,
    variant = "default",
    duration,
    onClick,
  } = options;
  const opts = {
    description,
    duration,
    ...(onClick ? { action: { label: "View", onClick } } : {}),
  };
  switch (variant) {
    case "success":
      toast.success(title, opts);
      break;
    case "error":
      toast.error(title, opts);
      break;
    case "warning":
      toast.warning(title, opts);
      break;
    case "info":
      toast.info(title, opts);
      break;
    default:
      toast(title, opts);
  }
}

function showNative(options: NotifyOptions): boolean {
  if (!nativeEnabled) return false;
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return false;
  }
  try {
    const native = new Notification(options.title, {
      body: options.description,
      icon: options.icon ?? DEFAULT_ICON,
      tag: options.tag,
    });
    native.onclick = () => {
      window.focus();
      native.close();
      options.onClick?.();
    };
    return true;
  } catch {
    return false;
  }
}

/** Route a notification to the toast or native channel based on tab visibility. */
export function notify(options: NotifyOptions): void {
  if (typeof document === "undefined") return; // SSR guard
  const hidden = document.visibilityState === "hidden";
  if (hidden && showNative(options)) return;
  showToast(options);
}
