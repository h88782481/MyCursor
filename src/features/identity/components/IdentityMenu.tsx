import { Button, Card, Icon } from "@/components";

interface IdentityMenuProps {
  loading: boolean;
  onLoadBackups: () => void;
  onShowResetConfirm: () => void;
  onShowCompleteResetConfirm: () => void;
}

export function IdentityMenu({
  loading,
  onLoadBackups,
  onShowResetConfirm,
  onShowCompleteResetConfirm,
}: IdentityMenuProps) {
  return (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Icon name="settings" size={20} />
          主要操作
        </h2>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="info"
            onClick={onLoadBackups}
            loading={loading}
            className="h-20 flex-col"
            icon={<Icon name="download" size={20} />}
          >
            恢复备份
          </Button>

          <Button
            variant="primary"
            onClick={onShowResetConfirm}
            loading={loading}
            className="h-20 flex-col"
            icon={<Icon name="refresh" size={20} />}
          >
            重置 ID
          </Button>

          <Button
            variant="danger"
            onClick={onShowCompleteResetConfirm}
            loading={loading}
            className="h-20 flex-col"
            icon={<Icon name="trash" size={20} />}
          >
            完全重置
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
