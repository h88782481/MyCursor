import { useState, useEffect } from "react";
import { CursorService } from "@/services/cursorService";
import {
  Button,
  Card,
  LoadingSpinner,
  useToast,
  ToastManager,
  useConfirmDialog,
  Icon,
} from "@/components";
import { BackupList, CustomPathConfig, ResultDisplay } from "@/components/machineId";
import {
  BackupInfo,
  MachineIds,
  RestoreResult,
  ResetResult,
} from "@/types/auth";

type Step =
  | "menu"
  | "select"
  | "preview"
  | "confirm"
  | "result"
  | "reset"
  | "complete_reset"
  | "confirm_reset"
  | "confirm_complete_reset"
  | "custom_path_config";

const MachineIdPage = () => {
  const [currentStep, setCurrentStep] = useState<Step>("menu");
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [selectedIds, setSelectedIds] = useState<MachineIds | null>(null);
  const [currentMachineIds, setCurrentMachineIds] = useState<MachineIds | null>(
    null
  );
  const [machineIdFileContent, setMachineIdFileContent] = useState<
    string | null
  >(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(
    null
  );
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [customCursorPath, setCustomCursorPath] = useState<string>("");
  const [currentCustomPath, setCurrentCustomPath] = useState<string | null>(
    null
  );
  const [isWindows, setIsWindows] = useState<boolean>(false);
  const [autoUpdateDisabled, setAutoUpdateDisabled] = useState<boolean | null>(null);
  const [windowsUsers, setWindowsUsers] = useState<{ username: string; has_cursor: boolean }[]>([]);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);

  // Toast 和确认对话框
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  const loadAutoUpdateStatus = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ disabled: boolean }>("get_auto_update_status");
      setAutoUpdateDisabled(result.disabled);
    } catch {
      // 静默失败
    }
  };

  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const isWindowsOS = platform.includes("win");
    setIsWindows(isWindowsOS);

    loadCurrentMachineIds();
    loadAutoUpdateStatus();
    if (isWindowsOS) {
      loadCustomCursorPath();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomCursorPath = async () => {
    try {
      const path = await CursorService.getCustomCursorPath();
      setCurrentCustomPath(path);
      setCustomCursorPath(path || "");
    } catch (error) {
      // 静默失败，不影响用户体验
    }
  };

  const loadCurrentMachineIds = async () => {
    try {
      setLoading(true);
      const [ids, content] = await Promise.all([
        CursorService.getCurrentMachineIds(),
        CursorService.getMachineIdFileContent(),
      ]);
      setCurrentMachineIds(ids);
      setMachineIdFileContent(content);
    } catch (error) {
      showError("加载 Machine ID 失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAccountToUser = async (username: string) => {
    setSyncingUser(username);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
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
  };

  const loadBackups = async () => {
    try {
      setLoading(true);
      const backupList = await CursorService.getBackups();
      setBackups(backupList);
      setCurrentStep("select");
    } catch (error) {
      showError("加载备份列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBackupSelect = async (backup: BackupInfo) => {
    try {
      setLoading(true);
      setSelectedBackup(backup);
      const ids = await CursorService.extractBackupIds(backup.path);
      setSelectedIds(ids);
      setCurrentStep("preview");
    } catch (error) {
      showError("无法从备份中提取机器ID信息");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;

    try {
      setLoading(true);
      setCurrentStep("confirm");
      const result = await CursorService.restoreMachineIds(selectedBackup.path);
      setRestoreResult(result);
      setCurrentStep("result");

      if (result.success) {
        await loadCurrentMachineIds();
        showSuccess("恢复成功！");
      } else {
        showError(result.message);
      }
    } catch (error) {
      showError("恢复操作失败");
    } finally {
      setLoading(false);
    }
  };

  const showResetConfirm = () => {
    showConfirm({
      title: "确认重置 Machine ID",
      message:
        "此操作将重置所有 Machine ID 为新的随机值。这可能会影响 Cursor 的授权状态。\n\n注意：重置后您可能需要重新登录 Cursor 账户。",
      confirmText: "确认重置",
      cancelText: "取消",
      type: "warning",
      onConfirm: handleReset,
    });
  };

  const showCompleteResetConfirm = () => {
    showConfirm({
      title: "确认完全重置",
      message:
        "此操作将完全清除 Cursor 的所有配置和数据，包括 Machine ID，以及注入脚本等。\n\n危险操作：这将删除所有 Cursor 相关数据，无法撤销！\n- 所有用户设置将被清除\n- 已安装的扩展将被移除\n- 需要重新配置 Cursor\n- 需要重新登录账户",
      confirmText: "确认完全重置",
      cancelText: "取消",
      type: "danger",
      onConfirm: handleCompleteReset,
    });
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const result = await CursorService.resetMachineIds();
      setResetResult(result);
      setCurrentStep("reset");

      if (result.success) {
        await loadCurrentMachineIds();
        showSuccess("重置成功！");
      } else {
        showError(result.message);
      }
    } catch (error) {
      showError("重置操作失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    try {
      setLoading(true);
      const result = await CursorService.completeResetMachineIds();
      setResetResult(result);
      setCurrentStep("complete_reset");

      if (result.success) {
        await loadCurrentMachineIds();
        showSuccess("完全重置成功！");
      } else {
        showError(result.message);
      }
    } catch (error) {
      showError("完全重置操作失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = (backup: BackupInfo, event?: React.MouseEvent) => {
    event?.stopPropagation();

    showConfirm({
      title: "删除备份",
      message: `确定要删除备份 "${backup.date_formatted}" 吗？此操作无法撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
      onConfirm: async () => {
        try {
          const result = await CursorService.deleteBackup(backup.path);

          if (result.success) {
            await loadBackups();
            showSuccess("备份删除成功");
          } else {
            showError(`删除失败: ${result.message}`);
          }
        } catch (error) {
          showError("删除备份时发生错误");
        }
      },
    });
  };

  const handleOpenLogDirectory = async () => {
    try {
      const result = await CursorService.openLogDirectory();
      showSuccess(result);
    } catch (error) {
      showError(`打开日志目录失败: ${error}`);
    }
  };

  const handleGetLogPath = async () => {
    try {
      const logPath = await CursorService.getLogFilePath();
      showSuccess(`日志文件路径: ${logPath}`);
    } catch (error) {
      showError(`获取日志路径失败: ${error}`);
    }
  };

  const handleSetCustomPath = async () => {
    if (!customCursorPath.trim()) {
      showError("请输入Cursor路径");
      return;
    }

    try {
      await CursorService.setCustomCursorPath(
        customCursorPath.trim()
      );
      await loadCustomCursorPath();
      showSuccess("自定义Cursor路径设置成功");
    } catch (error) {
      showError(`设置自定义路径失败: ${error}`);
    }
  };

  const handleClearCustomPath = async () => {
    try {
      const result = await CursorService.clearCustomCursorPath();
      await loadCustomCursorPath();
      showSuccess(result);
    } catch (error) {
      showError(`清除自定义路径失败: ${error}`);
    }
  };

  const handleFillDetectedPath = async () => {
    try {
      const debugInfo = await CursorService.debugWindowsCursorPaths();

      for (const info of debugInfo) {
        if (
          info.includes("- package.json: true") &&
          info.includes("- main.js: true")
        ) {
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
  };

  const handleBrowsePath = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择 Cursor 的 resources/app 目录",
        defaultPath: customCursorPath || undefined,
      });

      if (selected && typeof selected === 'string') {
        setCustomCursorPath(selected);
        showSuccess(`已选择路径: ${selected}`);
      }
    } catch (error) {
      showError(`选择路径失败: ${error}`);
    }
  };

  if (loading && currentStep === "menu") {
    return <LoadingSpinner message="正在加载 Machine ID 信息..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <Icon name="plug" size={32} />
          Machine ID 管理
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
          管理 Cursor 的 Machine ID，包括查看、备份、恢复和重置
        </p>
      </div>

      {/* 当前 Machine IDs */}
      {currentMachineIds && currentStep === "menu" && (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Icon name="info" size={20} />
              当前 Machine ID
            </h2>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {Object.entries(currentMachineIds).map(([key, value]) => (
                <div
                  key={key}
                  className="p-4"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--border-radius)'
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {key}
                  </p>
                  <p className="mt-1 text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {machineIdFileContent && (
              <div
                className="p-4 mt-4"
                style={{
                  backgroundColor: 'rgba(74, 137, 220, 0.1)',
                  border: '1px solid rgba(74, 137, 220, 0.2)',
                  borderRadius: 'var(--border-radius)'
                }}
              >
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
                  machineId 文件内容:
                </p>
                <p className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                  {machineIdFileContent}
                </p>
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 主菜单 */}
      {currentStep === "menu" && (
        <div className="space-y-6">
          {/* 主要操作按钮 */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Icon name="settings" size={20} />
                主要操作
              </h2>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="info"
                  onClick={loadBackups}
                  loading={loading}
                  className="h-20 flex-col"
                  icon={<Icon name="download" size={20} />}
                >
                  恢复备份
                </Button>

                <Button
                  variant="primary"
                  onClick={showResetConfirm}
                  loading={loading}
                  className="h-20 flex-col"
                  icon={<Icon name="refresh" size={20} />}
                >
                  重置 ID
                </Button>

                <Button
                  variant="danger"
                  onClick={showCompleteResetConfirm}
                  loading={loading}
                  className="h-20 flex-col"
                  icon={<Icon name="trash" size={20} />}
                >
                  完全重置
                </Button>
              </div>
            </Card.Content>
          </Card>

          {/* 自动更新管理 */}
          <Card>
            <Card.Header>
              <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Icon name="refresh" size={18} />
                自动更新
              </h3>
            </Card.Header>
            <Card.Content>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Cursor 自动更新
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
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
                  onClick={async () => {
                    try {
                      const { invoke } = await import("@tauri-apps/api/core");
                      const cmd = autoUpdateDisabled ? "enable_auto_update" : "disable_auto_update";
                      const result = await invoke<{ success: boolean; message: string }>(cmd);
                      if (result.success) {
                        showSuccess(result.message);
                        await loadAutoUpdateStatus();
                      } else {
                        showError(result.message);
                      }
                    } catch (error) {
                      showError(`操作失败: ${error}`);
                    }
                  }}
                  icon={autoUpdateDisabled
                    ? <Icon name="refresh" size={16} />
                    : <Icon name="lock" size={16} />}
                >
                  {autoUpdateDisabled ? "恢复更新" : "禁用更新"}
                </Button>
              </div>
            </Card.Content>
          </Card>

          {/* 多用户同步（仅 Windows） */}
          {isWindows && (
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Icon name="user" size={18} />
                    同步到其他用户
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { invoke } = await import("@tauri-apps/api/core");
                        const result = await invoke<{ success: boolean; users: { username: string; has_cursor: boolean }[] }>("list_windows_users");
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
                    }}
                    icon={<Icon name="search" size={14} />}
                  >
                    检测用户
                  </Button>
                </div>
              </Card.Header>
              {windowsUsers.length > 0 && (
                <Card.Content>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    将当前 Cursor 登录的账号和机器码同步到其他 Windows 用户的 Cursor 中。同步前会自动关闭所有 Cursor 进程。
                  </p>
                  <div className="space-y-2">
                    {windowsUsers.map((user) => (
                      <div
                        key={user.username}
                        className="flex items-center justify-between p-3 rounded"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--border-radius)' }}
                      >
                        <div>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.username}</span>
                          <span className="text-xs ml-2" style={{ color: '#10b981' }}>
                            已安装 Cursor
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={syncingUser === user.username}
                          onClick={() => {
                            showConfirm({
                              title: "确认同步到其他用户",
                              message: `确定要将当前账号同步到用户“${user.username}”的 Cursor 中吗？\n\n此操作会关闭所有 Cursor 进程。`,
                              confirmText: "确认同步",
                              cancelText: "取消",
                              type: "warning",
                              onConfirm: () => {
                                void handleSyncAccountToUser(user.username);
                              },
                            });
                          }}
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

          {/* 日志管理 */}
          <Card>
            <Card.Header>
              <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Icon name="settings" size={18} />
                日志管理
              </h3>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleGetLogPath}
                  className="h-16"
                  icon={<Icon name="settings" size={18} />}
                >
                  获取日志路径
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleOpenLogDirectory}
                  className="h-16"
                  icon="📂"
                >
                  打开日志目录
                </Button>
              </div>
            </Card.Content>
          </Card>

          {/* 自定义路径配置 - 仅Windows显示 */}
          {isWindows && (
            <Card>
              <Card.Header>
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Icon name="settings" size={18} />
                  路径配置
                </h3>
              </Card.Header>
              <Card.Content>
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep("custom_path_config")}
                  className="w-full h-16"
                  icon={<Icon name="settings" size={18} />}
                >
                  自定义Cursor路径
                </Button>
                {currentCustomPath && (
                  <div
                    className="p-3 mt-3 text-xs"
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--border-radius)'
                    }}
                  >
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      当前自定义路径:
                    </span>
                    <br />
                    <span style={{ color: 'var(--text-secondary)' }}>{currentCustomPath}</span>
                  </div>
                )}
              </Card.Content>
            </Card>
          )}
        </div>
      )}

      {/* 自定义路径配置页面 */}
      {currentStep === "custom_path_config" && (
        <CustomPathConfig
          customCursorPath={customCursorPath}
          currentCustomPath={currentCustomPath}
          onPathChange={setCustomCursorPath}
          onSetPath={handleSetCustomPath}
          onFillDetectedPath={handleFillDetectedPath}
          onClearPath={handleClearCustomPath}
          onBrowsePath={handleBrowsePath}
          onBack={() => setCurrentStep("menu")}
        />
      )}

      {/* 备份选择 */}
      {currentStep === "select" && (
        <BackupList
          backups={backups}
          onBackupSelect={handleBackupSelect}
          onDeleteBackup={handleDeleteBackup}
          onBack={() => setCurrentStep("menu")}
        />
      )}

      {/* 预览备份 */}
      {currentStep === "preview" && selectedBackup && selectedIds && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                预览备份内容
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep("select")}
              >
                返回
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="space-y-6">
            <div
              className="p-4"
              style={{
                backgroundColor: 'rgba(74, 137, 220, 0.1)',
                border: '1px solid rgba(74, 137, 220, 0.2)',
                borderRadius: 'var(--border-radius)'
              }}
            >
              <h3 className="mb-2 font-medium" style={{ color: 'var(--primary-color)' }}>
                备份信息
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                日期: {selectedBackup.date_formatted}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                大小: {selectedBackup.size} bytes
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                将要恢复的 Machine ID:
              </h3>
              {Object.entries(selectedIds).map(([key, value]) => (
                <div
                  key={key}
                  className="p-3"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--border-radius)'
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {key}
                  </p>
                  <p className="mt-1 text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Card.Content>
          <Card.Footer>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleRestore}
                loading={loading}
              >
                确认恢复
              </Button>
              <Button variant="ghost" onClick={() => setCurrentStep("select")}>
                取消
              </Button>
            </div>
          </Card.Footer>
        </Card>
      )}

      {/* 恢复确认中 */}
      {currentStep === "confirm" && (
        <Card>
          <Card.Content className="py-12 text-center">
            <div className="mb-4 text-4xl">⏳</div>
            <h2 className="mb-2 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              正在恢复...
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>请稍候，正在恢复 Machine ID</p>
          </Card.Content>
        </Card>
      )}

      {/* 恢复结果 */}
      {currentStep === "result" && restoreResult && (
        <ResultDisplay
          result={restoreResult}
          type="restore"
          onBack={() => {
            setCurrentStep("menu");
            setRestoreResult(null);
            setSelectedBackup(null);
            setSelectedIds(null);
          }}
          onRefresh={loadCurrentMachineIds}
        />
      )}

      {/* 重置结果 */}
      {(currentStep === "reset" || currentStep === "complete_reset") &&
        resetResult && (
          <ResultDisplay
            result={resetResult}
            type={currentStep}
            onBack={() => {
              setCurrentStep("menu");
              setResetResult(null);
            }}
            onRefresh={loadCurrentMachineIds}
          />
        )}

      {/* Toast 管理器 */}
      <ToastManager toasts={toasts} removeToast={removeToast} />

      {/* 确认对话框 */}
      <ConfirmDialog />
    </div>
  );
};

export default MachineIdPage;
