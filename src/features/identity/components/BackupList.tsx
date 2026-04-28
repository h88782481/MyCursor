import React, { useCallback } from "react";
import { Card, Button, Icon, useConfirmDialog } from "@/components";
import type { BackupInfo } from "@/types/auth";

interface BackupListProps {
  backups: BackupInfo[];
  onBackupSelect: (backup: BackupInfo) => void;
  onBack: () => void;
}

export const BackupList: React.FC<BackupListProps> = ({
  backups,
  onBackupSelect,
  onBack,
}) => {
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  const handleDeleteBackup = useCallback(
    async (backup: BackupInfo, event?: React.MouseEvent) => {
      event?.stopPropagation();

      showConfirm({
        title: "删除备份",
        message: `确定要删除备份 "${backup.date_formatted}" 吗？此操作无法撤销。`,
        confirmText: "删除",
        cancelText: "取消",
        type: "danger",
        onConfirm: async () => {
          try {
            const { CursorService } = await import("@/services/cursorService");
            await CursorService.deleteBackup(backup.path);
            window.location.reload();
          } catch {
            console.error("删除备份失败");
          }
        },
      });
    },
    [showConfirm]
  );

  return (
    <>
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              选择备份
            </h2>
            <Button variant="ghost" size="sm" onClick={onBack}>
              返回
            </Button>
          </div>
        </Card.Header>
        <Card.Content>
          {backups.length === 0 ? (
            <p className="py-8 text-center" style={{ color: "var(--text-secondary)" }}>
              没有找到备份文件
            </p>
          ) : (
            <div className="space-y-3">
              {backups.map((backup, index) => (
                <div
                  key={index}
                  className="p-4 cursor-pointer transition-all"
                  style={{
                    border: "1px solid var(--border-primary)",
                    backgroundColor: "var(--bg-primary)",
                    borderRadius: "var(--border-radius)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary-color)";
                    e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-primary)";
                    e.currentTarget.style.backgroundColor = "var(--bg-primary)";
                  }}
                  onClick={() => onBackupSelect(backup)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {backup.date_formatted}
                      </p>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        大小: {backup.size} bytes
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => handleDeleteBackup(backup, e)}
                        icon={<Icon name="trash" size={14} />}
                      >
                        删除
                      </Button>
                      <span style={{ color: "var(--primary-color)" }}>→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>
      <ConfirmDialog />
    </>
  );
};
