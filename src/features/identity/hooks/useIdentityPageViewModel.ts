import { useMemo } from "react";
import type { BackupInfo, MachineIds, ResetResult, RestoreResult } from "@/types/auth";
import type { IdentityStep } from "./useIdentityPageState";

interface UseIdentityPageViewModelParams {
  currentStep: IdentityStep;
  loading: boolean;
  backups: BackupInfo[];
  selectedBackup: BackupInfo | null;
  selectedIds: MachineIds | null;
  currentMachineIds: MachineIds | null;
  machineIdFileContent: string | null;
  restoreResult: RestoreResult | null;
  resetResult: ResetResult | null;
}

export function useIdentityPageViewModel({
  currentStep,
  loading,
  backups,
  selectedBackup,
  selectedIds,
  currentMachineIds,
  machineIdFileContent,
  restoreResult,
  resetResult,
}: UseIdentityPageViewModelParams) {
  const isInitialLoading = useMemo(() => loading && currentStep === "menu", [loading, currentStep]);
  const showCurrentIdsCard = useMemo(
    () => Boolean(currentMachineIds && currentStep === "menu"),
    [currentMachineIds, currentStep]
  );
  const showMenu = useMemo(() => currentStep === "menu", [currentStep]);
  const showBackupSelect = useMemo(() => currentStep === "select", [currentStep]);
  const showBackupPreview = useMemo(
    () => currentStep === "preview" && Boolean(selectedBackup && selectedIds),
    [currentStep, selectedBackup, selectedIds]
  );
  const showRestoreProgress = useMemo(() => currentStep === "confirm", [currentStep]);
  const showRestoreResult = useMemo(
    () => currentStep === "result" && Boolean(restoreResult),
    [currentStep, restoreResult]
  );
  const showResetResult = useMemo(
    () => (currentStep === "reset" || currentStep === "complete_reset") && Boolean(resetResult),
    [currentStep, resetResult]
  );

  return {
    isInitialLoading,
    showCurrentIdsCard,
    showMenu,
    showBackupSelect,
    showBackupPreview,
    showRestoreProgress,
    showRestoreResult,
    showResetResult,
    backups,
    selectedBackup,
    selectedIds,
    currentMachineIds,
    machineIdFileContent,
    restoreResult,
    resetResult,
  };
}
