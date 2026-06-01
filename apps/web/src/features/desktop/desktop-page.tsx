import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  type AutostartStatus,
  type NotificationSettings,
  type SidecarStatus,
  autostartStatus,
  isDesktopRuntime,
  notificationSettings,
  pauseObservation,
  restartSidecars,
  sendTestSessionNotification,
  setAutostart,
  setSessionNotifications,
  sidecarStatus,
  startSidecars,
} from "./desktop-api";

export function DesktopPage() {
  const [sidecars, setSidecars] = useState<SidecarStatus | null>(null);
  const [autostart, setAutostartState] = useState<AutostartStatus | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktop = isDesktopRuntime();

  useEffect(() => {
    if (!desktop) return;
    void refreshDesktopState();
  }, [desktop]);

  async function refreshDesktopState() {
    try {
      const [sidecarValue, autostartValue, notificationValue] = await Promise.all([
        sidecarStatus(),
        autostartStatus(),
        notificationSettings(),
      ]);
      setSidecars(sidecarValue);
      setAutostartState(autostartValue);
      setNotifications(notificationValue);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Desktop controls are unavailable.");
    }
  }

  if (!desktop) {
    return (
      <DesktopShell>
        <p className="text-muted-foreground text-sm">
          Desktop controls appear when the dashboard is running inside the Kairo desktop app.
        </p>
      </DesktopShell>
    );
  }

  return (
    <DesktopShell>
      <section className="grid gap-4 md:grid-cols-2">
        <Panel title="Sidecars">
          <StatusRow label="Dashboard API" running={sidecars?.dashboardApi.running ?? false} />
          <StatusRow label="Observer" running={sidecars?.observer.running ?? false} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => runAction(() => startSidecars().then(setSidecars))}>
              Start
            </Button>
            <Button
              onClick={() => runAction(() => restartSidecars().then(setSidecars))}
              variant="outline"
            >
              Restart
            </Button>
            <Button
              onClick={() => {
                const paused = !(sidecars?.observationPaused ?? false);
                return runAction(() => pauseObservation(paused).then(setSidecars));
              }}
              variant="outline"
            >
              {sidecars?.observationPaused ? "Resume observation" : "Pause observation"}
            </Button>
          </div>
        </Panel>

        <Panel title="Startup">
          <StatusRow label="Open at login" running={autostart?.enabled ?? false} />
          <div className="mt-4">
            <Button
              onClick={() => {
                const enabled = !(autostart?.enabled ?? false);
                return runAction(() => setAutostart(enabled).then(setAutostartState));
              }}
              variant="outline"
            >
              {autostart?.enabled ? "Disable autostart" : "Enable autostart"}
            </Button>
          </div>
        </Panel>

        <Panel title="Notifications">
          <StatusRow
            label="Session finalized"
            running={notifications?.sessionNotificationsEnabled ?? false}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                runAction(() =>
                  setSessionNotifications(
                    !(notifications?.sessionNotificationsEnabled ?? false),
                  ).then(setNotifications),
                )
              }
              variant="outline"
            >
              {notifications?.sessionNotificationsEnabled ? "Disable" : "Enable"}
            </Button>
            <Button onClick={() => runAction(sendTestSessionNotification)} variant="outline">
              Test
            </Button>
          </div>
        </Panel>
      </section>

      {error !== null ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          {error}
        </div>
      ) : null}
    </DesktopShell>
  );

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Desktop action failed.");
    }
  }
}

function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-semibold text-foreground text-xl">Desktop</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Native app controls for observation, launch, and session notifications.
        </p>
      </div>
      {children}
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-medium text-card-foreground text-sm">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatusRow({ label, running }: { label: string; running: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-2 text-foreground">
        <span
          className={
            running ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-muted"
          }
        />
        {running ? "On" : "Off"}
      </span>
    </div>
  );
}
