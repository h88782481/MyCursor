import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseSettingsPageEffectsParams {
  setMinimizeToTray: (value: boolean) => void;
  setTelemetryStatus: (value: any) => void;
  setTelemetryLoading: (value: boolean) => void;
  setCurrentCustomPath: (value: string | null) => void;
  setCustomCursorPath: (value: string) => void;
  setAutoUpdateDisabled: (value: boolean | null) => void;
  setIsWindows: (value: boolean) => void;
}

export function useSettingsPageEffects({
  setMinimizeToTray,
  setTelemetryStatus,
  setTelemetryLoading,
  setCurrentCustomPath,
  setCustomCursorPath,
  setAutoUpdateDisabled,
  setIsWindows,
}: UseSettingsPageEffectsParams) {
  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const isWindowsOS = platform.includes("win");
    setIsWindows(isWindowsOS);

    invoke<{ minimize_to_tray: boolean }>("get_close_behavior")
      .then((result) => setMinimizeToTray(result.minimize_to_tray))
      .catch(() => {});

    setTelemetryLoading(true);
    invoke("get_telemetry_patch_status")
      .then((result) => setTelemetryStatus(result))
      .catch(() => {})
      .finally(() => setTelemetryLoading(false));

    invoke<{ disabled: boolean }>("get_auto_update_status")
      .then((result) => setAutoUpdateDisabled(result.disabled))
      .catch(() => {});

    if (isWindowsOS) {
      invoke<string>("get_custom_cursor_path")
        .then((path) => {
          setCurrentCustomPath(path);
          setCustomCursorPath(path || "");
        })
        .catch(() => {});
    }
  }, [setMinimizeToTray, setTelemetryLoading, setTelemetryStatus, setCurrentCustomPath, setCustomCursorPath, setAutoUpdateDisabled, setIsWindows]);
}
