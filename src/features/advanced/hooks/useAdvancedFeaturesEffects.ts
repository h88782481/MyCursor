import { useEffect, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TelemetryPatchStatus } from "@/features/settings/types/telemetryPatchStatus";

interface Params {
  setTelemetryStatus: Dispatch<SetStateAction<TelemetryPatchStatus | null>>;
  setTelemetryLoading: (value: boolean) => void;
  setCurrentCustomPath: (value: string | null) => void;
  setCustomCursorPath: (value: string) => void;
  setAutoUpdateDisabled: (value: boolean | null) => void;
  setIsWindows: (value: boolean) => void;
}

export function useAdvancedFeaturesEffects({
  setTelemetryStatus,
  setTelemetryLoading,
  setCurrentCustomPath,
  setCustomCursorPath,
  setAutoUpdateDisabled,
  setIsWindows,
}: Params) {
  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const isWindowsOS = platform.includes("win");
    setIsWindows(isWindowsOS);

    setTelemetryLoading(true);
    invoke<TelemetryPatchStatus>("get_telemetry_patch_status")
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
  }, [
    setTelemetryStatus,
    setTelemetryLoading,
    setCurrentCustomPath,
    setCustomCursorPath,
    setAutoUpdateDisabled,
    setIsWindows,
  ]);
}
