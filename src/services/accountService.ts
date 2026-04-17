import { invoke } from "@tauri-apps/api/core";
import type {
  AccountInfo,
  AccountListResult,
  SwitchAccountResult,
  AddAccountResult,
  EditAccountResult,
  RemoveAccountResult,
  LogoutResult,
  AuthMeResponse,
} from "../types/account";
import { createLogger } from "../utils/logger";
import { performanceMonitor } from "../utils/performance";
import type {
  DeleteAccountResult,
  ExportAccountsResult,
  ImportAccountsResult,
} from "../types/api";

const logger = createLogger("AccountService");

export class AccountService {
  /** 获取当前登录账户 */
  static async getCurrentAccount(): Promise<AccountInfo | null> {
    return await invoke<AccountInfo | null>("get_current_account");
  }

  /** 获取所有账户列表（含当前账户信息） */
  static async getAccountList(): Promise<AccountListResult> {
    performanceMonitor.start('API_getAccountList');
    const result = await invoke<AccountListResult>("get_account_list");
    performanceMonitor.end('API_getAccountList', 'network');
    return result;
  }

  // 删除 Cursor 账户（调用 Cursor 官方 API）
  static async deleteCursorAccount(
    accessToken: string,
    workosSessionToken?: string
  ): Promise<DeleteAccountResult> {
    try {
      logger.info("调用 Cursor 删除账户 API");

      const result = await invoke<DeleteAccountResult>(
        "delete_cursor_account",
        {
          accessToken,
          workosCursorSessionToken: workosSessionToken || null,
        }
      );

      return {
        success: result.success || false,
        message: result.message || "未知响应",
      };
    } catch (error) {
      logger.error("删除 Cursor 账户失败", error);

      return {
        success: false,
        message: `删除失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  /** 添加新账户（支持传入标签） */
  static async addAccount(
    email: string,
    token: string,
    refreshToken?: string,
    workosSessionToken?: string,
    tags?: string[]
  ): Promise<AddAccountResult> {
    return await invoke<AddAccountResult>("add_account", {
      email,
      token,
      refreshToken: refreshToken || null,
      workosCursorSessionToken: workosSessionToken || null,
      tags: tags && tags.length > 0 ? tags : null,
    });
  }

  /** 切换到指定账户 */
  static async switchAccount(email: string): Promise<SwitchAccountResult> {
    performanceMonitor.start(`API_switchAccount-${email}`);
    const result = await invoke<SwitchAccountResult>("switch_account", { email });
    performanceMonitor.end(`API_switchAccount-${email}`, 'network');
    return result;
  }

  /** 通过邮箱和 token 直接切换账户 */
  static async switchAccountWithToken(
    email: string,
    token: string,
    authType?: string
  ): Promise<SwitchAccountResult> {
    return await invoke<SwitchAccountResult>("switch_account_with_token", {
      email,
      token,
      authType,
    });
  }

  /** 编辑账户信息（支持修改标签、机器码等） */
  static async editAccount(
    email: string,
    newEmail?: string,
    newToken?: string,
    newRefreshToken?: string,
    newWorkosSessionToken?: string,
    newUsername?: string,
    newTags?: string[],
    newMachineIds?: any
  ): Promise<EditAccountResult> {
    return await invoke<EditAccountResult>("edit_account", {
      email,
      newEmail: newEmail || null,
      newToken: newToken || null,
      newRefreshToken: newRefreshToken ?? null,
      newWorkosCursorSessionToken: newWorkosSessionToken ?? null,
      newUsername: newUsername ?? null,
      newTags: newTags ?? null,
      newMachineIds: newMachineIds ?? null,
    });
  }

  /** 删除指定账户 */
  static async removeAccount(email: string): Promise<RemoveAccountResult> {
    return await invoke<RemoveAccountResult>("remove_account", { email });
  }

  /** 注销当前账户（清除所有认证数据） */
  static async logoutCurrentAccount(): Promise<LogoutResult> {
    return await invoke<LogoutResult>("logout_current_account");
  }

  /** 导出账户到指定目录（可选指定导出的邮箱列表） */
  static async exportAccounts(
    exportPath: string,
    selectedEmails?: string[]
  ): Promise<ExportAccountsResult> {
    try {
      logger.info("导出账户", { exportPath, selectedCount: selectedEmails?.length || 0 });
      performanceMonitor.start('API_exportAccounts');

      const result = await invoke<ExportAccountsResult>("export_accounts", {
        exportPath: exportPath,
        selectedEmails: selectedEmails && selectedEmails.length > 0 ? selectedEmails : null,
      });

      performanceMonitor.end('API_exportAccounts', 'operation');
      logger.debug("导出结果", result);

      return {
        success: result.success || false,
        message: result.message || "未知响应",
        exported_path: result.exported_path,
      };
    } catch (error) {
      logger.error("导出账户失败", error);

      return {
        success: false,
        message: `❌ 导出失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  /** 从指定文件导入账户 */
  static async importAccounts(
    importFilePath: string
  ): Promise<ImportAccountsResult> {
    try {
      logger.info("导入账户", { importFilePath });
      performanceMonitor.start('API_importAccounts');

      const result = await invoke<ImportAccountsResult>("import_accounts", {
        importFilePath: importFilePath,
      });

      performanceMonitor.end('API_importAccounts', 'operation');
      logger.debug("导入结果", result);

      return {
        success: result.success || false,
        message: result.message || "未知响应",
      };
    } catch (error) {
      logger.error("导入账户失败", error);

      return {
        success: false,
        message: `❌ 导入失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  /** 通过 session token 调用 /api/auth/me 获取用户详细信息 */
  static async getAuthMe(
    sessionToken: string
  ): Promise<{ success: boolean; data?: AuthMeResponse; message?: string }> {
    try {
      const result = await invoke<{
        success: boolean;
        data?: AuthMeResponse;
        message?: string;
      }>("get_auth_me", { sessionToken });
      return result;
    } catch (error) {
      return {
        success: false,
        message: `获取用户信息失败: ${error instanceof Error ? error.message : error}`,
      };
    }
  }
}
