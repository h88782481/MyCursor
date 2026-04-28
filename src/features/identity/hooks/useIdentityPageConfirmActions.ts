import { useCallback } from "react";

interface UseIdentityPageConfirmActionsParams {
  handleReset: () => Promise<void>;
  handleCompleteReset: () => Promise<void>;
  showConfirm: (options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: "danger" | "warning" | "info";
    onConfirm: () => void | Promise<void>;
  }) => void;
}

export function useIdentityPageConfirmActions({
  handleReset,
  handleCompleteReset,
  showConfirm,
}: UseIdentityPageConfirmActionsParams) {
  const showResetConfirm = useCallback(() => {
    showConfirm({
      title: "确认重置 Machine ID",
      message: "此操作将生成新的 Machine ID，但不会修改 Cursor 内部文件。是否继续？",
      confirmText: "确认重置",
      cancelText: "取消",
      type: "warning",
      onConfirm: handleReset,
    });
  }, [handleReset, showConfirm]);

  const showCompleteResetConfirm = useCallback(() => {
    showConfirm({
      title: "确认完全重置",
      message: "此操作将重置 Machine ID 并修改 Cursor 内部文件（main.js 和 workbench.js）。这是最彻底的重置方式。是否继续？",
      confirmText: "确认完全重置",
      cancelText: "取消",
      type: "danger",
      onConfirm: handleCompleteReset,
    });
  }, [handleCompleteReset, showConfirm]);

  return {
    showResetConfirm,
    showCompleteResetConfirm,
  };
}
