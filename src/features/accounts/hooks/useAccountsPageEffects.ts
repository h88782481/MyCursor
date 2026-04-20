import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { AccountService } from "@/services/accountService";
import type { AccountInfo } from "@/types/account";
import type { AccountsPageToastState, AccountsPageConfirmDialogState } from "./useAccountsPageState";

interface UseAccountsPageEffectsParams {
  loadAccounts: () => Promise<unknown>;
  addAccountToList: (email: string) => Promise<unknown>;
  toast: AccountsPageToastState | null;
  setToast: (toast: AccountsPageToastState | null) => void;
  setConfirmDialog: Dispatch<SetStateAction<AccountsPageConfirmDialogState>>;
}

export function useAccountsPageEffects({
  loadAccounts,
  addAccountToList,
  toast,
  setToast,
  setConfirmDialog,
}: UseAccountsPageEffectsParams) {
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const addAccountToListRef = useRef(addAccountToList);
  addAccountToListRef.current = addAccountToList;
  const setToastRef = useRef(setToast);
  setToastRef.current = setToast;
  const setConfirmDialogRef = useRef(setConfirmDialog);
  setConfirmDialogRef.current = setConfirmDialog;
  const loadAccountsRef = useRef(loadAccounts);
  loadAccountsRef.current = loadAccounts;

  useEffect(() => {
    const init = async () => {
      const result = await loadAccounts() as {
        success?: boolean;
        local_data_changed?: boolean;
        local_fresh_account?: AccountInfo | null;
      } | undefined;

      if (result?.local_data_changed && result.local_fresh_account) {
        const fresh = result.local_fresh_account;
        setConfirmDialogRef.current({
          show: true,
          title: "检测到本地账号数据变更",
          message: `本地 Cursor 的账号 ${fresh.email} 数据（Token/机器码等）与缓存不一致，是否用本地最新数据覆盖？`,
          type: "info",
          confirmText: "覆盖更新",
          onConfirm: async () => {
            setConfirmDialogRef.current((prev) => ({ ...prev, show: false }));
            try {
              await AccountService.addAccount(
                fresh.email,
                fresh.token,
                fresh.refresh_token || undefined,
                fresh.workos_cursor_session_token || undefined,
                undefined,
                fresh.machine_ids ? JSON.stringify(fresh.machine_ids) : undefined,
              );
              await loadAccountsRef.current();
              setToastRef.current({ message: `${fresh.email} 数据已更新`, type: "success" });
            } catch (error) {
              setToastRef.current({ message: `更新失败: ${error}`, type: "error" });
            }
          },
        });
      }
    };
    void init();

    const setupListeners = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const listeners: Array<() => void> = [];

      const unlistenSuccess = await listen<{ token?: string }>("auto-login-success", async (event) => {
        const webToken = event.payload?.token;
        if (webToken) {
          setToastRef.current({ message: "登录成功！", type: "success" });
          await addAccountToListRef.current("");
        }
      });
      listeners.push(unlistenSuccess);

      const unlistenFailed = await listen("auto-login-failed", () => {
        setToastRef.current({ message: "自动登录失败", type: "error" });
      });
      listeners.push(unlistenFailed);

      cleanupListenersRef.current = () => {
        listeners.forEach((unlisten) => unlisten());
      };
    };

    void setupListeners();

    return () => {
      cleanupListenersRef.current?.();
    };
  }, [loadAccounts]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast, setToast]);
}
