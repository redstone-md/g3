"use client";

import { Clock01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  notificationPermission,
  notify,
  requestNotificationPermission,
} from "@/lib/notify";

export function NotifyDemo() {
  // Read permission only after mount — the value differs between server
  // ("unsupported") and client, which would break hydration.
  const [perm, setPerm] = useState("…");
  useEffect(() => setPerm(notificationPermission()), []);
  function fireDelayed() {
    notify({
      variant: "info",
      title: "Heads up",
      description: "This is what a minimized-tab notification looks like.",
    });
    window.setTimeout(() => {
      notify({
        variant: "success",
        title: "Delayed notification",
        description:
          "Fired 4s later — minimize this tab to see the native push.",
        tag: "demo-delayed",
      });
    }, 4000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        onClick={() =>
          notify({
            variant: "success",
            title: "Saved",
            description: "Your changes are live.",
          })
        }
      >
        <HugeiconsIcon icon={Notification01Icon} />
        Success
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          notify({
            variant: "error",
            title: "Failed",
            description: "Could not reach the server.",
          })
        }
      >
        Error
      </Button>
      <Button variant="outline" onClick={fireDelayed}>
        <HugeiconsIcon icon={Clock01Icon} />
        Fire after 4s
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          void requestNotificationPermission().then(() =>
            setPerm(notificationPermission()),
          )
        }
      >
        Enable native ({perm})
      </Button>
    </div>
  );
}
