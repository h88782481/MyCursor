import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseSettingsPageActionsParams {
  setMinimizeToTray: (value: boolean) => void;
  setTelemetryStatus: (value: any) => void;
  setTelemetryLoading: (value: boolean) => void;
  customCursorPath: string;
  autoUpdateDisabled: boolean | null;
  setCurrentCustomPath: (value: string | null) => void;
  setCustomCursorPath: (value: string) => void;
  setAutoUpdateDisabled: (value: boolean | null) => void;
  setWindowsUsers: (value: any[]) => void;
  setSyncingUser: (value: string | null) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

export function useSettingsPageActions({
  setMinimizeToTray,
  setTelemetryStatus,
  setTelemetryLoading,
  customCursorPath,
  autoUpdateDisabled,
  setCurrentCustomPath,
  setCustomCursorPath,
  setAutoUpdateDisabled,
  setWindowsUsers,
  setSyncingUser,
  showSuccess,
  showError,
}: UseSettingsPageActionsParams) {
  const handleSetCloseBehavior = useCallback(
    async (minimize: boolean) => {
      try {
        const result = await invoke<{ success: boolean; message: string }>(
          "set_close_behavior",
          { minimizeToTray: minimize }
        );
        if (result.success) {
          setMinimizeToTray(minimize);
          showSuccess(result.message);
        }
      } catch {
        showError("设置关闭行为失败");
      }
    },
    [setMinimizeToTray, showSuccess, showError]
  );

  const handleClearUsageData = useCallback(async () => {
    try {
      const result = await invoke<{ success: boolean; message: string }>("clear_usage_data");
      if (result.success) showSuccess("用量数据已清除");
      else showError(result.message);
    } catch {
      showError("清除数据失败");
    }
  }, [showSuccess, showError]);

  const handleClearAccountCache = useCallback(async () => {
    try {
      const result = await invoke<{ success: boolean; message: string }>("clear_account_cache");
      if (result.success) showSuccess("账户缓存已清除");
      else showError(result.message);
    } catch {
      showError("清除缓存失败");
    }
  }, [showSuccess, showError]);

  const handleClearEventsData = useCallback(async () => {
    try {
      const result = await invoke<{ success: boolean; message: string }>("clear_events_data");
      if (result.success) showSuccess("事件数据已清除");
      else showError(result.message);
    } catch {
      showError("清除数据失败");
    }
  }, [showSuccess, showError]);

  const handleRefreshTelemetryStatus = useCallback(async () => {
    setTelemetryLoading(true);
    try {
      const result = await invoke("get_telemetry_patch_status");
      setTelemetryStatus(result);
    } catch {
      showError("获取遥测补丁状态失败");
    } finally {
      setTelemetryLoading(false);
    }
  }, [setTelemetryLoading, setTelemetryStatus, showError]);

  const handleApplyTelemetryPatch = useCallback(async () => {
    setTelemetryLoading(true);
    try {
      const result = await invoke<{ success: boolean; message: string }>("apply_telemetry_patch");
      if (result.success) {
        showSuccess(result.message);
        await handleRefreshTelemetryStatus();
      } else {
        showError(result.message);
      }
    } catch {
      showError("应用遥测补丁失败");
    } finally {
      setTelemetryLoading(false);
    }
  }, [handleRefreshTelemetryStatus, setTelemetryLoading, showError, showSuccess]);

  const handleRestoreTelemetryPatch = useCallback(async () => {
    setTelemetryLoading(true);
    try {
      const result = await invoke<{ success: boolean; message: string }>("restore_telemetry_patch");
      if (result.success) {
        showSuccess(result.message);
        await handleRefreshTelemetryStatus();
      } else {
        showError(result.message);
      }
    } catch {
      showError("恢复遥测补丁失败");
    } finally {
      setTelemetryLoading(false);
    }
  }, [handleRefreshTelemetryStatus, setTelemetryLoading, showError, showSuccess]);

  const handleToggleAutoUpdate = useCallback(async () => {
    try {
      const cmd = autoUpdateDisabled ? "enable_auto_update" : "disable_auto_update";
      const result = await invoke<{ success: boolean; message: string }>(cmd);
      if (result.success) {
        showSuccess(result.message);
        const status = await invoke<{ disabled: boolean }>("get_auto_update_status");
        setAutoUpdateDisabled(status.disabled);
      } else {
        showError(result.message);
      }
    } catch (error) {
      showError(`操作失败: ${error}`);
    }
  }, [autoUpdateDisabled, setAutoUpdateDisabled, showError, showSuccess]);

  const handleSetCustomPath = useCallback(async () => {
    if (!customCursorPath.trim()) {
      showError("请输入Cursor路径");
      return;
    }

    try {
      await invoke("set_custom_cursor_path", { path: customCursorPath.trim() });
      const path = await invoke<string>("get_custom_cursor_path");
      setCurrentCustomPath(path);
      setCustomCursorPath(path || "");
      showSuccess("自定义Cursor路径设置成功");
    } catch (error) {
      showError(`设置自定义路径失败: ${error}`);
    }
  }, [customCursorPath, setCurrentCustomPath, setCustomCursorPath, showError, showSuccess]);

  const handleClearCustomPath = useCallback(async () => {
    try {
      await invoke("clear_custom_cursor_path");
      setCurrentCustomPath(null);
      setCustomCursorPath("");
      showSuccess("已清除自定义路径");
    } catch (error) {
      showError(`清除自定义路径失败: ${error}`);
    }
  }, [setCurrentCustomPath, setCustomCursorPath, showError, showSuccess]);

  const handleFillDetectedPath = useCallback(async () => {
    try {
      const debugInfo = await invoke<string[]>("debug_windows_cursor_paths");
      for (const info of debugInfo) {
        if (info.includes("- package.json: true") && info.includes("- main.js: true")) {
          const pathMatch = info.match(/路径\d+: (.+)/);
          if (pathMatch) {
            const detectedPath = pathMatch[1].trim();
            setCustomCursorPath(detectedPath);
            showSuccess(`已填充检测到的路径: ${detectedPath}`);
            return;
          }
        }
      }
      showError("未检测到有效的Cursor安装路径");
    } catch (error) {
      showError(`自动填充路径失败: ${error}`);
    }
  }, [setCustomCursorPath, showError, showSuccess]);

  const handleBrowseCustomPath = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择 Cursor 的 resources/app 目录",
        defaultPath: customCursorPath || undefined,
      });

      if (selected && typeof selected === "string") {
        setCustomCursorPath(selected);
        showSuccess(`已选择路径: ${selected}`);
      }
    } catch (error) {
      showError(`选择路径失败: ${error}`);
    }
  }, [customCursorPath, setCustomCursorPath, showError, showSuccess]);

  const handleGetLogPath = useCallback(async () => {
    try {
      const logPath = await invoke<string>("get_log_file_path");
      showSuccess(`日志文件路径: ${logPath}`);
    } catch (error) {
      showError(`获取日志路径失败: ${error}`);
    }
  }, [showError, showSuccess]);

  const handleOpenLogDirectory = useCallback(async () => {
    try {
      const result = await invoke<string>("open_log_directory");
      showSuccess(result);
    } catch (error) {
      showError(`打开日志目录失败: ${error}`);
    }
  }, [showError, showSuccess]);

  const handleDetectWindowsUsers = useCallback(async () => {
    try {
      const result = await invoke<{ success: boolean; users: any[] }>("list_windows_users");
      if (result.success) {
        const availableUsers = result.users.filter((user) => user.has_cursor);
        setWindowsUsers(availableUsers);
        if (result.users.length === 0) {
          showSuccess("未检测到其他 Windows 用户");
        } else if (availableUsers.length === 0) {
          showSuccess("已检测到其他 Windows 用户，但没有发现可用的 Cursor 数据目录");
        }
      }
    } catch (error) {
      showError(`检测用户失败: ${error}`);
    }
  }, [setWindowsUsers, showError, showSuccess]);

  const handleSyncUser = useCallback(
    async (username: string) => {
      setSyncingUser(username);
      try {
        const result = await invoke<{ success: boolean; message: string }>("sync_account_to_user", {
          targetUsername: username,
        });

        if (result.success) {
          showSuccess(result.message);
        } else {
          showError(result.message);
        }
      } catch (error) {
        showError(`同步失败: ${error}`);
      } finally {
        setSyncingUser(null);
      }
    },
    [setSyncingUser, showError, showSuccess]
  );

  return {
    handleSetCloseBehavior,
    handleClearUsageData,
    handleClearAccountCache,
    handleClearEventsData,
    handleRefreshTelemetryStatus,
    handleApplyTelemetryPatch,
    handleRestoreTelemetryPatch,
    handleToggleAutoUpdate,
    handleSetCustomPath,
    handleClearCustomPath,
    handleFillDetectedPath,
    handleBrowseCustomPath,
    handleGetLogPath,
    handleOpenLogDirectory,
    handleDetectWindowsUsers,
    handleSyncUser,
  };
}
