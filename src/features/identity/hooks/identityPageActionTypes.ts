import type { Dispatch, SetStateAction } from "react";
import type { BackupInfo, MachineIds, ResetResult, RestoreResult } from "@/types/auth";
import type { IdentityStep, WindowsUserInfo } from "./useIdentityPageState";

export type { WindowsUserInfo };

export interface IdentityPageActionsContext {
  selectedBackup: BackupInfo | null;
  setCurrentStep: Dispatch<SetStateAction<IdentityStep>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setBackups: Dispatch<SetStateAction<BackupInfo[]>>;
  setSelectedBackup: Dispatch<SetStateAction<BackupInfo | null>>;
  setSelectedIds: Dispatch<SetStateAction<MachineIds | null>>;
  setRestoreResult: Dispatch<SetStateAction<RestoreResult | null>>;
  setResetResult: Dispatch<SetStateAction<ResetResult | null>>;
  setCurrentMachineIds: Dispatch<SetStateAction<MachineIds | null>>;
  setMachineIdFileContent: Dispatch<SetStateAction<string | null>>;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showConfirm: (options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: "danger" | "warning" | "info";
    onConfirm: () => void | Promise<void>;
  }) => void;
}
