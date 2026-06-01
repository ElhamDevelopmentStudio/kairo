export interface AutostartStatus {
  enabled: boolean;
}

export interface NotificationSettings {
  sessionNotificationsEnabled: boolean;
}

export interface SidecarProcessStatus {
  name: string;
  running: boolean;
  pid?: number | null;
}

export interface SidecarStatus {
  dashboardApi: SidecarProcessStatus;
  observer: SidecarProcessStatus;
  observationPaused: boolean;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: Invoke;
      };
    };
  }
}

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI__?.core?.invoke === "function";
}

export async function sidecarStatus(): Promise<SidecarStatus> {
  return invokeDesktop("sidecar_status");
}

export async function startSidecars(): Promise<SidecarStatus> {
  return invokeDesktop("start_sidecars");
}

export async function restartSidecars(): Promise<SidecarStatus> {
  return invokeDesktop("restart_sidecars");
}

export async function pauseObservation(paused: boolean): Promise<SidecarStatus> {
  return invokeDesktop("pause_observation", { paused });
}

export async function autostartStatus(): Promise<AutostartStatus> {
  return invokeDesktop("autostart_status");
}

export async function setAutostart(enabled: boolean): Promise<AutostartStatus> {
  return invokeDesktop("set_autostart", { enabled });
}

export async function notificationSettings(): Promise<NotificationSettings> {
  return invokeDesktop("notification_settings");
}

export async function setSessionNotifications(enabled: boolean): Promise<NotificationSettings> {
  return invokeDesktop("set_session_notifications", { enabled });
}

export async function sendTestSessionNotification(): Promise<void> {
  return invokeDesktop("notify_session_finalized", {
    title: "Kairo session finalized",
    body: "Desktop notifications are connected.",
  });
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (typeof invoke !== "function") {
    throw new Error("Desktop runtime is not available.");
  }
  return invoke<T>(command, args);
}
