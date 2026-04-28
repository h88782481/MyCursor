import { Card, useToast, ToastManager, Icon } from "@/components";
import { CloseBehaviorSettings, CacheManagement, DataInfo, AdvancedFeatures } from "./components";
import { useSettingsPageState } from "./hooks/useSettingsPageState";
import { useSettingsPageActions } from "./hooks/useSettingsPageActions";
import { useSettingsPageEffects } from "./hooks/useSettingsPageEffects";

const SettingsPage = () => {
  const {
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
  } = useSettingsPageState();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const {
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
  } = useSettingsPageActions({
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
  });

  useSettingsPageEffects({
    setMinimizeToTray,
    setTelemetryStatus,
    setTelemetryLoading,
    setCurrentCustomPath,
    setCustomCursorPath,
    setAutoUpdateDisabled,
    setIsWindows,
  });

  return (
    <div className="space-y-6">
      <ToastManager toasts={toasts} removeToast={removeToast} />

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <Icon name="settings" size={28} />
          应用设置
        </h2>

        <div className="space-y-6">
          <CloseBehaviorSettings
            minimizeToTray={minimizeToTray}
            onSetBehavior={handleSetCloseBehavior}
          />
        </div>

        <hr style={{ borderColor: "var(--border-primary)", margin: "24px 0" }} />

        <div className="space-y-6">
          <CacheManagement
            onClearUsageData={handleClearUsageData}
            onClearAccountCache={handleClearAccountCache}
            onClearEventsData={handleClearEventsData}
          />
        </div>

        <hr style={{ borderColor: "var(--border-primary)", margin: "24px 0" }} />

        <div className="space-y-6">
          <AdvancedFeatures
            telemetryStatus={telemetryStatus}
            telemetryLoading={telemetryLoading}
            onRefreshTelemetryStatus={handleRefreshTelemetryStatus}
            onApplyTelemetryPatch={handleApplyTelemetryPatch}
            onRestoreTelemetryPatch={handleRestoreTelemetryPatch}
            autoUpdateDisabled={autoUpdateDisabled}
            onToggleAutoUpdate={handleToggleAutoUpdate}
            isWindows={isWindows}
            customCursorPath={customCursorPath}
            currentCustomPath={currentCustomPath}
            onCustomPathChange={setCustomCursorPath}
            onSetCustomPath={handleSetCustomPath}
            onFillDetectedPath={handleFillDetectedPath}
            onClearCustomPath={handleClearCustomPath}
            onBrowseCustomPath={handleBrowseCustomPath}
            onGetLogPath={handleGetLogPath}
            onOpenLogDirectory={handleOpenLogDirectory}
            windowsUsers={windowsUsers}
            syncingUser={syncingUser}
            onDetectWindowsUsers={handleDetectWindowsUsers}
            onSyncUser={handleSyncUser}
          />
        </div>
      </Card>

      <DataInfo />
    </div>
  );
};

export default SettingsPage;
