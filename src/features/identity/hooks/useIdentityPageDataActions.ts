import { useCallback } from "react";
import { CursorService } from "@/services/cursorService";
import type { BackupInfo } from "@/types/auth";
import type { IdentityPageActionsContext, WindowsUserInfo } from "./identityPageActionTypes.ts";

export function useIdentityPageDataActions({
  selectedBackup,
  setCurrentStep,
  setLoading,
  setBackups,
  setSelectedBackup,
  setSelectedIds,
  setRestoreResult,
  setResetResult,
  setCurrentMachineIds,
  setMachineIdFileContent,
  showSuccess,
  showError,
}: IdentityPageActionsContext) {
  const loadCurrentMachineIds = useCallback(async () => {
    try {
      setLoading(true);
      const [ids, content] = await Promise.all([
        CursorService.getCurrentMachineIds(),
        CursorService.getMachineIdFileContent(),
      ]);
      setCurrentMachineIds(ids);
      setMachineIdFileContent(content);
    } catch {
      showError("加载 Machine ID 失败");
    } finally {
      setLoading(false);
    }
  }, [setCurrentMachineIds, setLoading, setMachineIdFileContent, showError]);

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      const backupList = await CursorService.getBackups();
      setBackups(backupList);
      setCurrentStep("select");
    } catch {
      showError("加载备份列表失败");
    } finally {
      setLoading(false);
    }
  }, [setBackups, setCurrentStep, setLoading, showError]);

  const handleBackupSelect = useCallback(async (backup: BackupInfo) => {
    try {
      setLoading(true);
      setSelectedBackup(backup);
      const ids = await CursorService.extractBackupIds(backup.path);
      setSelectedIds(ids);
      setCurrentStep("preview");
    } catch {
      showError("无法从备份中提取机器ID信息");
    } finally {
      setLoading(false);
    }
  }, [setCurrentStep, setLoading, setSelectedBackup, setSelectedIds, showError]);

  const handleRestore = useCallback(async () => {
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
    } catch {
      showError("恢复操作失败");
    } finally {
      setLoading(false);
    }
  }, [loadCurrentMachineIds, selectedBackup, setCurrentStep, setLoading, setRestoreResult, showError, showSuccess]);

  const handleReset = useCallback(async () => {
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
    } catch {
      showError("重置操作失败");
    } finally {
      setLoading(false);
    }
  }, [loadCurrentMachineIds, setCurrentStep, setLoading, setResetResult, showError, showSuccess]);

  const handleCompleteReset = useCallback(async () => {
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
    } catch {
      showError("完全重置操作失败");
    } finally {
      setLoading(false);
    }
  }, [loadCurrentMachineIds, setCurrentStep, setLoading, setResetResult, showError, showSuccess]);

  return {
    loadCurrentMachineIds,
    loadBackups,
    handleBackupSelect,
    handleRestore,
    handleReset,
    handleCompleteReset,
  };
}
