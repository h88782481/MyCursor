import { useState, useCallback, useMemo } from "react";
import { AccountService } from "@/services/accountService";
import { ConfigService } from "@/services/configService";
import type { AccountListResult, AccountInfo } from "@/types/account";
import { performanceMonitor } from "@/utils/performance";
import { safeStorage } from "@/utils/safeStorage";

export const useAccountManagement = () => {
  const [accountData, setAccountData] = useState<AccountListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [refreshProgress, setRefreshProgress] = useState<{
    current: number;
    total: number;
    isRefreshing: boolean;
  }>({ current: 0, total: 0, isRefreshing: false });
  const [concurrentLimit, setConcurrentLimit] = useState<number>(() => {
    const limit = safeStorage.get<number>("refresh_concurrent_limit", 5, true);
    return limit !== null && limit >= 1 && limit <= 10 ? limit : 5;
  });

  const refreshCurrentAccount = useCallback(async () => {
    try {
      const currentAccount = await AccountService.getCurrentAccount();
      setAccountData((prev) => {
        if (!prev) return prev;
        const accounts = prev.accounts.map((acc) => ({
          ...acc,
          is_current: currentAccount ? acc.email === currentAccount.email : false,
        }));
        return { ...prev, accounts, current_account: currentAccount };
      });
      return { success: true, currentAccount };
    } catch (error) {
      console.error("Failed to refresh current account:", error);
      return { success: false, currentAccount: null };
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    performanceMonitor.start("loadAccounts");

    try {
      performanceMonitor.start("loadAccountCache");
      const cacheResult = await ConfigService.loadAccountCache();
      performanceMonitor.end("loadAccountCache");

      if (cacheResult.success && cacheResult.data && cacheResult.data.length > 0) {
        console.log(`📦 从缓存加载了 ${cacheResult.data.length} 个账户`);

        const currentAccount = await AccountService.getCurrentAccount();
        const cachedAccountData: AccountListResult = {
          success: true,
          message: "从缓存加载",
          accounts: cacheResult.data.map((acc) => ({
            ...acc,
            is_current: currentAccount ? acc.email === currentAccount.email : false,
          })),
          current_account: currentAccount,
        };

        setAccountData(cachedAccountData);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const result = await AccountService.getAccountList();

      if (!result.success) {
        if (cacheResult.success && cacheResult.data) {
          console.log("⚠️ API 加载失败，但已有缓存数据");
          return { success: true, fromCache: true };
        }
        return { success: false, message: "加载账户列表失败" };
      }

      let finalAccounts = result.accounts;
      let hasIncompleteCache = false;

      if (cacheResult.success && cacheResult.data && cacheResult.data.length > 0) {
        finalAccounts = result.accounts.map((account) => {
          const cached = cacheResult.data?.find((c: any) => c.email === account.email);
          if (cached && cached.subscription_type !== undefined) {
            return {
              ...account,
              subscription_type: cached.subscription_type,
              subscription_status: cached.subscription_status,
              trial_days_remaining: cached.trial_days_remaining,
            };
          }
          hasIncompleteCache = true;
          return account;
        });
      } else {
        hasIncompleteCache = result.accounts.length > 0;
      }

      setAccountData({
        ...result,
        accounts: finalAccounts,
      });

      return {
        success: true,
        hasIncompleteCache,
        local_data_changed: result.local_data_changed || false,
        local_fresh_account: result.local_fresh_account || null,
      };
    } catch (error) {
      console.error("Failed to load accounts:", error);
      return { success: false, message: "加载账户列表失败" };
    } finally {
      setLoading(false);
      const duration = performanceMonitor.end("loadAccounts");
      console.log(`✅ 账户列表加载完成，耗时: ${duration.toFixed(2)}ms`);
    }
  }, []);

  const refreshSingleAccount = useCallback(async (account: AccountInfo, _index: number) => {
    performanceMonitor.start(`refreshAccount-${account.email}`);

    try {
      setRefreshProgress({ current: 0, total: 1, isRefreshing: true });

      const authResult = await ConfigService.refreshSingleAccountInfo(account.token);

      if (authResult.success && authResult.user_info?.account_info) {
        let authMeData: Record<string, unknown> = {};
        try {
          const meResult = await AccountService.getAuthMe(
            account.workos_cursor_session_token || "",
            account.token
          );
          if (meResult.success && meResult.data) {
            authMeData = {
              name: meResult.data.name || undefined,
              sub: meResult.data.sub || undefined,
              picture: meResult.data.picture || undefined,
              user_id: meResult.data.id || undefined,
            };
          }
        } catch {
          // 静默失败
        }

        setAccountData((prevData) => {
          if (!prevData?.accounts) return prevData;
          const updatedAccounts = prevData.accounts.map((acc) =>
            acc.email === account.email
              ? {
                  ...acc,
                  subscription_type: authResult.user_info.account_info.subscription_type,
                  subscription_status: authResult.user_info.account_info.subscription_status,
                  trial_days_remaining: authResult.user_info.account_info.trial_days_remaining,
                  ...authMeData,
                }
              : acc
          );

          void ConfigService.saveAccountCache(updatedAccounts);
          return { ...prevData, accounts: updatedAccounts };
        });

        setRefreshProgress({ current: 1, total: 1, isRefreshing: true });
        return { success: true };
      }

      const status = authResult.user_info?.api_status;
      const errMsg = authResult.user_info?.error_message;
      if (status === 401 || status === 403) {
        setAccountData((prevData) => {
          if (!prevData?.accounts) return prevData;
          const updatedAccounts = prevData.accounts.map((acc) =>
            acc.email === account.email ? { ...acc, subscription_type: "token_expired" } : acc
          );
          void ConfigService.saveAccountCache(updatedAccounts);
          return { ...prevData, accounts: updatedAccounts };
        });
        return { success: false, message: `Token 已失效 (${status})` };
      }
      if (errMsg) {
        return { success: false, message: `网络错误: ${errMsg}` };
      }
      return { success: false, message: "刷新失败: 未获取到订阅信息" };
    } catch (error) {
      console.error("刷新账户信息失败:", error);
      return { success: false, message: `请求异常: ${error}` };
    } finally {
      const duration = performanceMonitor.end(`refreshAccount-${account.email}`);
      console.log(`✅ 账户刷新完成: ${account.email}，耗时: ${duration.toFixed(2)}ms`);

      setTimeout(() => {
        setRefreshProgress({ current: 0, total: 0, isRefreshing: false });
      }, 1000);
    }
  }, []);

  const refreshAllAccounts = useCallback(async () => {
    if (!accountData?.accounts || accountData.accounts.length === 0) {
      return { success: false, message: "没有账户需要刷新" };
    }

    const totalAccounts = accountData.accounts.length;
    performanceMonitor.start("refreshAllAccounts");
    console.log(`🚀 开始批量刷新 ${totalAccounts} 个账户...`);

    setRefreshProgress({ current: 0, total: totalAccounts, isRefreshing: true });

    try {
      const accounts = accountData.accounts;
      let refreshedCount = 0;
      let successCount = 0;
      let tokenExpiredCount = 0;
      let networkErrorCount = 0;
      const updatedAccountsMap = new Map();

      const batchSize = concurrentLimit;
      const batches: AccountInfo[][] = [];

      for (let i = 0; i < accounts.length; i += batchSize) {
        batches.push(accounts.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        performanceMonitor.start(`refreshBatch-${batchIndex}`);

        const batchPromises = batch.map(async (account) => {
          try {
            const authResult = await ConfigService.refreshSingleAccountInfo(account.token);
            if (authResult.success && authResult.user_info?.account_info) {
              return {
                email: account.email,
                status: "ok" as const,
                data: {
                  ...account,
                  subscription_type: authResult.user_info.account_info.subscription_type,
                  subscription_status: authResult.user_info.account_info.subscription_status,
                  trial_days_remaining: authResult.user_info.account_info.trial_days_remaining,
                },
              };
            }
            const apiStatus = authResult.user_info?.api_status;
            if (apiStatus === 401 || apiStatus === 403) {
              return {
                email: account.email,
                status: "token_expired" as const,
                data: { ...account, subscription_type: "token_expired" },
              };
            }
            return { email: account.email, status: "network_error" as const, data: account };
          } catch {
            return { email: account.email, status: "network_error" as const, data: account };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            const value = result.value;
            updatedAccountsMap.set(value.email, value.data);
            if (value.status === "ok") successCount++;
            else if (value.status === "token_expired") tokenExpiredCount++;
            else networkErrorCount++;
          }
          refreshedCount++;
        });

        const batchDuration = performanceMonitor.end(`refreshBatch-${batchIndex}`);
        console.log(`📦 批次 ${batchIndex + 1}/${batches.length} 完成，耗时: ${batchDuration.toFixed(2)}ms`);

        setRefreshProgress({ current: refreshedCount, total: totalAccounts, isRefreshing: true });

        setAccountData((prevData) => {
          if (!prevData?.accounts) return prevData;
          const updatedAccounts = prevData.accounts.map((acc) => updatedAccountsMap.get(acc.email) || acc);
          return { ...prevData, accounts: updatedAccounts };
        });

        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const finalAccounts = accounts.map((acc) => updatedAccountsMap.get(acc.email) || acc);
      await ConfigService.saveAccountCache(finalAccounts);

      const failCount = tokenExpiredCount + networkErrorCount;
      const parts: string[] = [`成功 ${successCount}`];
      if (tokenExpiredCount > 0) parts.push(`Token 失效 ${tokenExpiredCount}`);
      if (networkErrorCount > 0) parts.push(`网络错误 ${networkErrorCount}`);
      const message = `刷新完成: ${parts.join("，")}`;

      return { success: failCount === 0, message };
    } catch (error) {
      console.error("刷新所有账户失败:", error);
      return { success: false, message: `刷新异常: ${error}` };
    } finally {
      const totalDuration = performanceMonitor.end("refreshAllAccounts");
      console.log(`✅ 批量刷新完成，总耗时: ${totalDuration.toFixed(2)}ms`);

      setTimeout(() => {
        setRefreshProgress({ current: 0, total: 0, isRefreshing: false });
      }, 1500);
    }
  }, [accountData, concurrentLimit]);

  const addAccountToList = useCallback(async (email: string) => {
    try {
      const result = await AccountService.getAccountList();

      if (result.success) {
        const mergedAccounts = result.accounts.map((newAccount) => {
          const existingAccount = accountData?.accounts.find((acc) => acc.email === newAccount.email);

          if (existingAccount) {
            return {
              ...newAccount,
              subscription_type: existingAccount.subscription_type,
              subscription_status: existingAccount.subscription_status,
              trial_days_remaining: existingAccount.trial_days_remaining,
            };
          }
          return newAccount;
        });

        setAccountData({
          ...result,
          accounts: mergedAccounts,
        });

        const newAccount = mergedAccounts.find((acc) => acc.email === email);
        if (newAccount && !newAccount.subscription_type) {
          try {
            const authResult = await ConfigService.refreshSingleAccountInfo(newAccount.token);
            if (authResult.success && authResult.user_info?.account_info) {
              setAccountData((prev) => {
                if (!prev?.accounts) return prev;
                const updated = prev.accounts.map((acc) =>
                  acc.email === email
                    ? {
                        ...acc,
                        subscription_type: authResult.user_info.account_info.subscription_type,
                        subscription_status: authResult.user_info.account_info.subscription_status,
                        trial_days_remaining: authResult.user_info.account_info.trial_days_remaining,
                      }
                    : acc
                );
                void ConfigService.saveAccountCache(updated);
                return { ...prev, accounts: updated };
              });
            }
          } catch {
            // 刷新失败不影响添加结果
          }
        }

        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (error) {
      console.error("Failed to add account to list:", error);
      return { success: false, message: "添加账户到列表失败" };
    }
  }, [accountData]);

  const removeAccount = useCallback(async (email: string) => {
    try {
      const result = await AccountService.removeAccount(email);
      if (result.success) {
        await loadAccounts();
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (error) {
      console.error("Failed to remove account:", error);
      return { success: false, message: "删除账户失败" };
    }
  }, [loadAccounts]);

  const removeSelectedAccounts = useCallback(async () => {
    if (selectedAccounts.size === 0) {
      return { success: false, message: "没有选中的账户" };
    }

    try {
      const emails = Array.from(selectedAccounts);
      let successCount = 0;
      let failCount = 0;

      for (const email of emails) {
        const result = await AccountService.removeAccount(email);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      setSelectedAccounts(new Set());
      await loadAccounts();

      if (failCount === 0) {
        return { success: true, message: `成功删除 ${successCount} 个账户` };
      }
      return {
        success: true,
        message: `删除完成：成功 ${successCount} 个，失败 ${failCount} 个`,
      };
    } catch (error) {
      console.error("Failed to remove selected accounts:", error);
      return { success: false, message: "批量删除失败" };
    }
  }, [selectedAccounts, loadAccounts]);

  const refreshSelectedAccounts = useCallback(async () => {
    if (selectedAccounts.size === 0) {
      return { success: false, message: "没有选中的账户" };
    }

    try {
      const emails = Array.from(selectedAccounts);
      const total = emails.length;

      setRefreshProgress({ current: 0, total, isRefreshing: true });

      let successCount = 0;
      let tokenExpiredCount = 0;
      let networkErrorCount = 0;
      const updatedAccountsMap = new Map<string, AccountInfo>();

      for (let i = 0; i < emails.length; i += concurrentLimit) {
        const batch = emails.slice(i, i + concurrentLimit);

        await Promise.all(
          batch.map(async (email) => {
            try {
              const account = accountData?.accounts?.find((acc) => acc.email === email);
              if (!account) {
                networkErrorCount++;
                return;
              }
              const result = await ConfigService.refreshSingleAccountInfo(account.token);
              if (result.success && result.user_info?.account_info) {
                successCount++;
                updatedAccountsMap.set(email, {
                  ...account,
                  subscription_type: result.user_info.account_info.subscription_type,
                  subscription_status: result.user_info.account_info.subscription_status,
                  trial_days_remaining: result.user_info.account_info.trial_days_remaining,
                });
              } else {
                const apiStatus = result.user_info?.api_status;
                if (apiStatus === 401 || apiStatus === 403) {
                  tokenExpiredCount++;
                  updatedAccountsMap.set(email, { ...account, subscription_type: "token_expired" });
                } else {
                  networkErrorCount++;
                }
              }
            } catch (error) {
              console.error(`Failed to refresh account ${email}:`, error);
              networkErrorCount++;
            }
          })
        );

        setRefreshProgress({
          current: Math.min(i + concurrentLimit, total),
          total,
          isRefreshing: true,
        });
      }

      if (accountData?.accounts) {
        const mergedAccounts = accountData.accounts.map((acc) => updatedAccountsMap.get(acc.email) || acc);

        setAccountData((prev) => {
          if (!prev?.accounts) return prev;
          return { ...prev, accounts: mergedAccounts };
        });

        await ConfigService.saveAccountCache(mergedAccounts);
      }

      const failCount = tokenExpiredCount + networkErrorCount;
      const parts: string[] = [`成功 ${successCount}`];
      if (tokenExpiredCount > 0) parts.push(`Token 失效 ${tokenExpiredCount}`);
      if (networkErrorCount > 0) parts.push(`网络错误 ${networkErrorCount}`);
      const message = `刷新完成: ${parts.join("，")}`;

      return { success: failCount === 0, message };
    } catch (error) {
      console.error("Failed to refresh selected accounts:", error);
      return { success: false, message: "批量刷新失败" };
    } finally {
      setTimeout(() => {
        setRefreshProgress({ current: 0, total: 0, isRefreshing: false });
      }, 1500);
    }
  }, [selectedAccounts, accountData, concurrentLimit]);

  const toggleAccountSelection = useCallback((email: string) => {
    setSelectedAccounts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  }, []);

  const subscriptionFilterOptions = useMemo(() => {
    const options = [{ value: "all", label: "全部账户" }];
    if (!accountData?.accounts) return options;

    const types = new Set<string>();
    for (const acc of accountData.accounts) {
      const subscriptionType = acc.subscription_type;
      if (subscriptionType) types.add(subscriptionType);
    }

    const labelMap: Record<string, string> = {
      pro: "Pro",
      ultra: "Ultra",
      business: "Business",
      free_trial: "Trial",
      free: "Free",
    };

    for (const type of Array.from(types).sort()) {
      options.push({ value: type, label: labelMap[type] || type });
    }

    if (accountData.accounts.some((account) => !account.subscription_type) && !types.has("free")) {
      options.push({ value: "free", label: "Free" });
    }

    return options;
  }, [accountData]);

  const tagFilterOptions = useMemo(() => {
    const options = [{ value: "all", label: "全部标签" }];
    if (!accountData?.accounts) return options;

    const tags = new Set<string>();
    for (const acc of accountData.accounts) {
      if (acc.tags) {
        for (const tag of acc.tags) tags.add(tag);
      }
    }
    for (const tag of Array.from(tags).sort()) {
      options.push({ value: tag, label: tag });
    }

    if (accountData.accounts.some((account) => !account.tags || account.tags.length === 0)) {
      options.push({ value: "__untagged__", label: "未标记" });
    }

    return options;
  }, [accountData]);

  const filteredAccounts = useMemo(() => {
    if (!accountData?.accounts) return [];

    return accountData.accounts.filter((account) => {
      if (subscriptionFilter !== "all") {
        if (subscriptionFilter === "free") {
          if (account.subscription_type && account.subscription_type !== "free") return false;
        } else if (account.subscription_type !== subscriptionFilter) {
          return false;
        }
      }
      if (tagFilter !== "all") {
        if (tagFilter === "__untagged__") {
          if (account.tags && account.tags.length > 0) return false;
        } else if (!account.tags || !account.tags.includes(tagFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [accountData, subscriptionFilter, tagFilter]);

  const toggleSelectAll = useCallback(() => {
    if (filteredAccounts.length === 0) return;

    const filteredEmails = new Set(filteredAccounts.map((acc) => acc.email));
    const allFilteredSelected = filteredAccounts.every((acc) => selectedAccounts.has(acc.email));

    if (allFilteredSelected) {
      setSelectedAccounts((prev) => {
        const newSet = new Set(prev);
        for (const email of filteredEmails) {
          newSet.delete(email);
        }
        return newSet;
      });
    } else {
      setSelectedAccounts((prev) => {
        const newSet = new Set(prev);
        for (const email of filteredEmails) {
          newSet.add(email);
        }
        return newSet;
      });
    }
  }, [filteredAccounts, selectedAccounts]);

  const updateConcurrentLimit = useCallback((value: number) => {
    setConcurrentLimit(value);
    safeStorage.set("refresh_concurrent_limit", value);
  }, []);

  return {
    accountData,
    loading,
    selectedAccounts,
    subscriptionFilter,
    refreshProgress,
    concurrentLimit,
    filteredAccounts,
    subscriptionFilterOptions,
    tagFilter,
    tagFilterOptions,
    loadAccounts,
    refreshCurrentAccount,
    addAccountToList,
    refreshSingleAccount,
    refreshAllAccounts,
    removeAccount,
    removeSelectedAccounts,
    refreshSelectedAccounts,
    toggleAccountSelection,
    toggleSelectAll,
    setSubscriptionFilter,
    setTagFilter,
    setConcurrentLimit: updateConcurrentLimit,
  };
};
