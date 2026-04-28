import { useState } from "react";
import type { TelemetryPatchStatus } from "../components/AdvancedFeatures";
import type { WindowsUserInfo } from "@/features/identity/hooks/useIdentityPageState";

export function useSettingsPageState() {
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryPatchStatus | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [customCursorPath, setCustomCursorPath] = useState("");
  const [currentCustomPath, setCurrentCustomPath] = useState<string | null>(null);
  const [autoUpdateDisabled, setAutoUpdateDisabled] = useState<boolean | null>(null);
  const [isWindows, setIsWindows] = useState(false);
  const [windowsUsers, setWindowsUsers] = useState<WindowsUserInfo[]>([]);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);

  return {
    minimizeToTray,
    setMinimizeToTray,
    telemetryStatus,
    setTelemetryStatus,
    telemetryLoading,
    setTelemetryLoading,
    customCursorPath,
    setCustomCursorPath,
    currentCustomPath,
    setCurrentCustomPath,
    autoUpdateDisabled,
    setAutoUpdateDisabled,
    isWindows,
    setIsWindows,
    windowsUsers,
    setWindowsUsers,
    syncingUser,
    setSyncingUser,
  };
}
