import { useState, useEffect, memo, useCallback } from "react";
import { AccountService } from "@/services/accountService";
import type { AccountInfo, MachineIds } from "@/types/account";
import { FormField, TextInput, TextareaInput } from "@/components/form/FormField";
import { TagSelector } from "@/components/TagSelector";
import Modal from "@/components/Modal";

interface EditAccountFormProps {
  isOpen: boolean;
  account: AccountInfo | null;
  onSuccess: () => void;
  onCancel: () => void;
  onToast: (message: string, type: "success" | "error") => void;
}

export const EditAccountForm = memo(({ isOpen, account, onSuccess, onCancel, onToast }: EditAccountFormProps) => {
  const [editEmail, setEditEmail] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editRefreshToken, setEditRefreshToken] = useState("");
  const [editWorkosSessionToken, setEditWorkosSessionToken] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [showMachineIds, setShowMachineIds] = useState(false);
  const [editMachineIds, setEditMachineIds] = useState<Partial<MachineIds>>({});
  const [machineIdsJson, setMachineIdsJson] = useState("");
  const [machineIdsParseError, setMachineIdsParseError] = useState("");

  useEffect(() => {
    if (account) {
      setEditEmail(account.email || "");
      setEditToken(account.token || "");
      setEditRefreshToken(account.refresh_token || "");
      setEditWorkosSessionToken(account.workos_cursor_session_token || "");
      setEditUsername(account.username || "");
      setEditTags(account.tags || []);
      setShowMachineIds(!!account.machine_ids);
      setEditMachineIds(account.machine_ids || {});
      setMachineIdsJson(account.machine_ids ? JSON.stringify(account.machine_ids, null, 2) : "");
      setMachineIdsParseError("");
    }
  }, [account]);

  const REQUIRED_MACHINE_ID_KEYS = [
    "telemetry.devDeviceId",
    "telemetry.macMachineId",
    "telemetry.machineId",
    "telemetry.sqmId",
    "storage.serviceMachineId",
  ] as const;

  const OPTIONAL_MACHINE_ID_KEYS = ["system.machineGuid", "system.sqmClientId"] as const;

  const parseMachineIdsFromJson = useCallback((json: string) => {
    if (!json.trim()) {
      setEditMachineIds({});
      setMachineIdsParseError("");
      return;
    }

    try {
      const data = JSON.parse(json);
      const ids: Record<string, string> = {};
      const missing: string[] = [];

      for (const key of REQUIRED_MACHINE_ID_KEYS) {
        if (data[key] && typeof data[key] === "string") {
          ids[key] = data[key];
        } else {
          missing.push(key.split(".").pop() || key);
        }
      }

      for (const key of OPTIONAL_MACHINE_ID_KEYS) {
        if (data[key] && typeof data[key] === "string") {
          ids[key] = data[key];
        }
      }

      if (missing.length > 0) {
        setMachineIdsParseError(`缺少必须字段: ${missing.join(", ")}`);
        setEditMachineIds({});
      } else {
        setEditMachineIds(ids as unknown as MachineIds);
        setMachineIdsParseError("");
      }
    } catch {
      setMachineIdsParseError("JSON 格式错误，请粘贴完整的 storage.json 内容");
      setEditMachineIds({});
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!account) return;

    try {
      if (!editEmail.trim()) {
        onToast("邮箱地址不能为空", "error");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
        onToast("请输入有效的邮箱地址", "error");
        return;
      }
      if (!editToken.trim()) {
        onToast("Access Token 不能为空", "error");
        return;
      }

      if (showMachineIds && machineIdsJson.trim()) {
        const hasAllRequired = REQUIRED_MACHINE_ID_KEYS.every((key) => editMachineIds[key as keyof typeof editMachineIds]);
        if (machineIdsParseError || !hasAllRequired) {
          onToast("机器码绑定失败：请确保包含全部 5 个必须字段", "error");
          return;
        }
      }

      const hasRequired = REQUIRED_MACHINE_ID_KEYS.every((key) => editMachineIds[key as keyof typeof editMachineIds]);
      const machineIdsToSave = showMachineIds && hasRequired ? editMachineIds : undefined;

      const result = await AccountService.editAccount(
        account.email,
        editEmail !== account.email ? editEmail : undefined,
        editToken || undefined,
        editRefreshToken,
        editWorkosSessionToken,
        editUsername,
        editTags,
        machineIdsToSave
      );

      if (result.success) {
        onToast("账户信息已更新", "success");
        onSuccess();
      } else {
        onToast(result.message, "error");
      }
    } catch (error) {
      console.error("编辑账户失败:", error);
      onToast("更新账户信息失败", "error");
    }
  }, [
    account,
    editEmail,
    editToken,
    editRefreshToken,
    editWorkosSessionToken,
    editUsername,
    editTags,
    showMachineIds,
    editMachineIds,
    machineIdsJson,
    machineIdsParseError,
    onToast,
    onSuccess,
  ]);

  if (!account) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title={`编辑账户 - ${account.email}`}
      size="lg"
      footer={
        <>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "500",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
              transition: "all var(--transition-duration) ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-primary)";
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "500",
              color: "white",
              backgroundColor: "var(--primary-color)",
              border: "none",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
              transition: "all var(--transition-duration) ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--shadow-medium)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            保存更改
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="邮箱地址">
          <TextInput
            type="email"
            value={editEmail}
            onChange={setEditEmail}
            placeholder="设置账户邮箱地址"
          />
        </FormField>

        <FormField label="用户名">
          <TextInput
            type="text"
            value={editUsername}
            onChange={setEditUsername}
            placeholder="设置用户名备注"
          />
        </FormField>

        <FormField label="Access Token">
          <TextareaInput
            value={editToken}
            onChange={setEditToken}
            placeholder="更新 Access Token"
            rows={3}
          />
        </FormField>

        <FormField label="Refresh Token" description="用于自动刷新 Access Token（可选）">
          <TextareaInput
            value={editRefreshToken}
            onChange={setEditRefreshToken}
            placeholder="更新 Refresh Token"
            rows={3}
          />
        </FormField>

        <FormField
          label="WorkOS Session Token"
          description="用于高级功能（如取消订阅、绑卡等）"
        >
          <TextareaInput
            value={editWorkosSessionToken}
            onChange={setEditWorkosSessionToken}
            placeholder="更新 WorkOS Session Token"
            rows={3}
          />
        </FormField>

        <div>
          <button
            type="button"
            onClick={() => setShowMachineIds(!showMachineIds)}
            className="flex items-center gap-1 text-sm font-medium mb-2"
            style={{
              color: "var(--primary-color)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              style={{
                transform: showMachineIds ? "rotate(90deg)" : "rotate(0)",
                transition: "0.2s",
                display: "inline-block",
              }}
            >
              &#9654;
            </span>
            绑定机器码（可选）
          </button>
          {showMachineIds && (
            <div
              className="p-3 rounded"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
                粘贴 storage.json 内容，自动提取 5 个必须字段。
                如需绑定注册表 ID（machineGuid、sqmClientId），请手动添加到 JSON 中。
                <br />路径：%APPDATA%\Cursor\User\globalStorage\storage.json
              </p>
              <TextareaInput
                value={machineIdsJson}
                onChange={(value) => {
                  setMachineIdsJson(value);
                  parseMachineIdsFromJson(value);
                }}
                placeholder="粘贴 storage.json 内容（JSON 格式）"
                rows={4}
              />
              {machineIdsParseError && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                  {machineIdsParseError}
                </p>
              )}
              {!machineIdsParseError && Object.keys(editMachineIds).length >= 5 && (
                <div className="mt-2 text-xs space-y-0.5" style={{ color: "#10b981" }}>
                  {Object.entries(editMachineIds).map(([key, value]) => (
                    <p key={key} className="font-mono truncate">
                      {key.split(".").pop()}: {String(value).slice(0, 30)}...
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <FormField label="标签" description="选择预设标签或输入新标签回车创建">
          <TagSelector selectedTags={editTags} onChange={setEditTags} />
        </FormField>
      </div>
    </Modal>
  );
});

EditAccountForm.displayName = "EditAccountForm";
