"use client";

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  // App is dark-only (no next-themes provider); fall back to "dark" not "system".
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-4 animate-spin"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          // Per-type theming via the same CSS vars Sonner consumes, so colors
          // follow the theme tokens (no richColors override).
          default:
            "[--normal-bg:var(--popover)] [--normal-text:var(--popover-foreground)] [--normal-border:var(--border)]",
          error:
            "[--normal-bg:var(--destructive)] [--normal-text:#fff] [--normal-border:var(--destructive)]",
          success:
            "[--normal-bg:var(--primary)] [--normal-text:var(--primary-foreground)] [--normal-border:var(--primary)]",
          info: "[--normal-bg:var(--accent)] [--normal-text:var(--accent-foreground)] [--normal-border:var(--accent)]",
          warning:
            "[--normal-bg:var(--muted)] [--normal-text:var(--foreground)] [--normal-border:var(--border)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
