"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { disablePush, enablePush, getPushPermissionState, isPushSubscribed } from "@/lib/push";

export function PushNotificationSettings() {
  const { dict } = useI18n();
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "on" | "off">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const permission = await getPushPermissionState();
      if (permission === "unsupported") return setState("unsupported");
      if (permission === "denied") return setState("denied");
      setState((await isPushSubscribed()) ? "on" : "off");
    })();
  }, []);

  async function handleToggle() {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
      } else {
        const ok = await enablePush();
        setState((await getPushPermissionState()) === "denied" ? "denied" : ok ? "on" : "off");
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-6">
      <h2 className="text-sm font-semibold text-[var(--fg-muted)]">{dict.settings.pushTitle}</h2>
      <p className="text-xs text-[var(--fg-muted)]">{dict.settings.pushDescription}</p>
      {state === "denied" ? (
        <p className="text-xs text-red-600">{dict.settings.pushDenied}</p>
      ) : state === "loading" ? null : (
        <button type="button" onClick={handleToggle} disabled={busy} className="btn-secondary w-full">
          {state === "on" ? dict.settings.pushDisable : dict.settings.pushEnable}
        </button>
      )}
    </div>
  );
}
