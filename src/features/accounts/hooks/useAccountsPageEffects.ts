import { useEffect, useRef } from "react";
import type { AccountsPageToastState } from "./useAccountsPageState";

interface UseAccountsPageEffectsParams {
  loadAccounts: () => Promise<unknown>;
  addAccountToList: (email: string) => Promise<unknown>;
  toast: AccountsPageToastState | null;
  setToast: (toast: AccountsPageToastState | null) => void;
}

export function useAccountsPageEffects({
  loadAccounts,
  addAccountToList,
  toast,
  setToast,
}: UseAccountsPageEffectsParams) {
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const addAccountToListRef = useRef(addAccountToList);
  addAccountToListRef.current = addAccountToList;
  const setToastRef = useRef(setToast);
  setToastRef.current = setToast;

  useEffect(() => {
    void loadAccounts();

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
