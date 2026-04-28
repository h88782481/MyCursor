import React from "react";
import { Card, Button, Input, Alert, Icon } from "@/components";
import type { TelemetryPatchStatus } from "./AdvancedFeatures";

export interface AdvancedWindowsUserInfo {
  username: string;
  has_cursor: boolean;
}

interface AdvancedFeaturesProps {
  telemetryStatus: TelemetryPatchStatus | null;
  telemetryLoading: boolean;
  onRefreshTelemetryStatus: () => void;
  onApplyTelemetryPatch: () => void;
  onRestoreTelemetryPatch: () => void;
  autoUpdateDisabled: boolean | null;
  onToggleAutoUpdate: () => void;
  isWindows: boolean;
  customCursorPath: string;
  currentCustomPath: string | null;
  onCustomPathChange: (path: string) => void;
  onSetCustomPath: () => void;
  onFillDetectedPath: () => void;
  onClearCustomPath: () => void;
  onBrowseCustomPath: () => void;
  onGetLogPath: () => void;
  onOpenLogDirectory: () => void;
  windowsUsers: AdvancedWindowsUserInfo[];
  syncingUser: string | null;
  onDetectWindowsUsers: () => void;
  onSyncUser: (username: string) => void;
}

export function AdvancedFeatures({
  telemetryStatus,
  telemetryLoading,
  onRefreshTelemetryStatus,
  onApplyTelemetryPatch,
  onRestoreTelemetryPatch,
  autoUpdateDisabled,
  onToggleAutoUpdate,
  isWindows,
  customCursorPath,
  currentCustomPath,
  onCustomPathChange,
  onSetCustomPath,
  onFillDetectedPath,
  onClearCustomPath,
  onBrowseCustomPath,
  onGetLogPath,
  onOpenLogDirectory,
  windowsUsers,
  syncingUser,
  onDetectWindowsUsers,
  onSyncUser,
}: AdvancedFeaturesProps) {
  const statusText = telemetryLoading
    ? "检测中..."
    : !telemetryStatus
      ? "未获取到状态"
      : telemetryStatus.supported
        ? telemetryStatus.applied
          ? "已应用 — Cursor 遥测将被拦截"
          : "未应用 — 将按默认行为发送遥测"
        : "当前 Cursor 版本或安装路径不支持此补丁";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Icon name="power" size={20} />
          高级功能
        </h3>
      </div>

      <Card>
        <Card.Header>
          <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Icon name="refresh" size={18} />
            自动更新
          </h4>
        </Card.Header>
        <Card.Content>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Cursor 自动更新
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                {autoUpdateDisabled === null
                  ? "检测中..."
                  : autoUpdateDisabled
                    ? "已禁用 — Cursor 不会自动更新"
                    : "已启用 — Cursor 会自动下载并安装更新"}
              </p>
            </div>
            <Button
              variant={autoUpdateDisabled ? "primary" : "danger"}
              size="sm"
              onClick={onToggleAutoUpdate}
              icon={
                autoUpdateDisabled ? <Icon name="refresh" size={16} /> : <Icon name="lock" size={16} />
              }
            >
              {autoUpdateDisabled ? "恢复更新" : "禁用更新"}
            </Button>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                关闭 Cursor 遥测
              </h4>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                通过补丁内置扩展与完整性校验文件，拦截 AnalyticsService 和部分 AI 遥测上报。
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshTelemetryStatus}
              loading={telemetryLoading}
              icon={<Icon name="refresh" size={14} />}
            >
              刷新状态
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {statusText}
            </p>
            {telemetryStatus?.extension_main_path && (
              <p className="text-xs mt-2 break-all" style={{ color: "var(--text-tertiary)" }}>
                扩展文件: {telemetryStatus.extension_main_path}
              </p>
            )}
            {telemetryStatus?.extension_host_path && (
              <p className="text-xs mt-1 break-all" style={{ color: "var(--text-tertiary)" }}>
                宿主文件: {telemetryStatus.extension_host_path}
              </p>
            )}
          </div>

          {telemetryStatus?.details && telemetryStatus.details.length > 0 && (
            <div className="space-y-2">
              {telemetryStatus.details.map((detail, index) => (
                <p key={`${detail}-${index}`} className="text-xs flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                  <Icon name="info" size={14} />
                  <span>{detail}</span>
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              onClick={onApplyTelemetryPatch}
              disabled={telemetryLoading || !telemetryStatus?.supported || !!telemetryStatus?.applied}
              icon={<Icon name="power" size={16} />}
            >
              应用补丁
            </Button>
            <Button
              variant="primary"
              onClick={onRestoreTelemetryPatch}
              disabled={telemetryLoading || !telemetryStatus?.backup_exists}
              icon={<Icon name="refresh" size={16} />}
            >
              恢复原始文件
            </Button>
          </div>
        </Card.Content>
      </Card>

      {isWindows && (
        <Card>
          <Card.Header>
            <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Icon name="settings" size={18} />
              路径配置
            </h4>
          </Card.Header>
          <Card.Content className="space-y-6">
            <Alert type="info">
              <p className="text-sm">
                如果自动检测无法找到 Cursor 安装路径，你可以手动指定。
                <br />
                路径应该指向 Cursor 的 <code className="px-1" style={{ backgroundColor: "rgba(74, 137, 220, 0.15)", borderRadius: "var(--border-radius-small)" }}>resources/app</code> 目录。
              </p>
            </Alert>

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={customCursorPath}
                    onChange={(e) => onCustomPathChange(e.target.value)}
                    placeholder="点击“浏览选择”按钮或手动输入完整路径"
                  />
                </div>
                <Button variant="info" onClick={onBrowseCustomPath} icon={<Icon name="download" size={16} />}>
                  浏览选择
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={onSetCustomPath} icon={<Icon name="check" size={16} />}>
                  保存路径
                </Button>
                <Button variant="ghost" onClick={onFillDetectedPath} icon={<Icon name="search" size={16} />}>
                  自动检测并填充
                </Button>
                <Button variant="danger" onClick={onClearCustomPath} icon={<Icon name="trash" size={16} />}>
                  清除自定义路径
                </Button>
              </div>

              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {currentCustomPath ? `当前自定义路径: ${currentCustomPath}` : "未设置自定义路径，使用自动检测"}
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      <Card>
        <Card.Header>
          <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Icon name="settings" size={18} />
            日志管理
          </h4>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="ghost"
              onClick={onGetLogPath}
              className="h-16"
              icon={<Icon name="settings" size={18} />}
            >
              获取日志路径
            </Button>

            <Button
              variant="ghost"
              onClick={onOpenLogDirectory}
              className="h-16"
              icon={<Icon name="download" size={18} />}
            >
              打开日志目录
            </Button>
          </div>
        </Card.Content>
      </Card>

      {isWindows && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Icon name="user" size={18} />
                同步到其他用户
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDetectWindowsUsers}
                icon={<Icon name="search" size={14} />}
              >
                检测用户
              </Button>
            </div>
          </Card.Header>
          {windowsUsers.length > 0 && (
            <Card.Content>
              <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                将当前 Cursor 登录的账号和机器码同步到其他 Windows 用户的 Cursor 中。同步前会自动关闭所有 Cursor 进程。
              </p>
              <div className="space-y-2">
                {windowsUsers.map((user) => (
                  <div
                    key={user.username}
                    className="flex items-center justify-between p-3 rounded"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: "var(--border-radius)",
                    }}
                  >
                    <div>
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {user.username}
                      </span>
                      <span className="text-xs ml-2" style={{ color: "#10b981" }}>
                        已安装 Cursor
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={syncingUser === user.username}
                      onClick={() => onSyncUser(user.username)}
                      icon={<Icon name="arrows-exchange" size={14} />}
                    >
                      同步
                    </Button>
                  </div>
                ))}
              </div>
            </Card.Content>
          )}
        </Card>
      )}
    </div>
  );
}
