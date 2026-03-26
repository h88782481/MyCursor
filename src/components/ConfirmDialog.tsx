import React, { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Icon } from "./Icon";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (checkboxValue?: boolean) => void;
  onCancel: () => void;
  checkboxLabel?: string;
  checkboxDefaultChecked?: boolean;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  checkboxLabel,
  checkboxDefaultChecked = false,
  confirmText = "确认",
  cancelText = "取消",
  type = "info",
}) => {
  const [checkboxValue, setCheckboxValue] = useState(checkboxDefaultChecked);

  const handleConfirm = () => {
    onConfirm(checkboxLabel ? checkboxValue : undefined);
  };

  const typeIcons = {
    danger: <Icon name="alert" size={28} style={{ color: "var(--danger-color)" }} />,
    warning: <Icon name="alert" size={28} style={{ color: "var(--warning-color, #f59e0b)" }} />,
    info: <Icon name="info" size={28} style={{ color: "var(--primary-color)" }} />,
  };

  const confirmButtonVariant = type === "danger" ? "danger" : "primary";

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={confirmButtonVariant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-center py-4">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor:
              type === "danger"
                ? "rgba(239, 68, 68, 0.12)"
                : type === "warning"
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(59, 130, 246, 0.12)",
          }}
        >
          {typeIcons[type]}
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <p className="whitespace-pre-line mb-4 leading-6" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>

        {checkboxLabel && (
          <div
            className="flex items-center justify-center gap-2 mt-6 p-4 rounded-lg"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
          >
            <input
              type="checkbox"
              id="confirm-checkbox"
              checked={checkboxValue}
              onChange={(e) => setCheckboxValue(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: "var(--primary-color)" }}
            />
            <label
              htmlFor="confirm-checkbox"
              className="text-sm cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            >
              {checkboxLabel}
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
};

// useConfirmDialog Hook
// eslint-disable-next-line react-refresh/only-export-components
export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: (checkboxValue?: boolean) => void;
    checkboxLabel?: string;
    checkboxDefaultChecked?: boolean;
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "warning" | "info";
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (options: Omit<typeof dialogState, "show">) => {
    setDialogState({ ...options, show: true });
  };

  const hideConfirm = () => {
    setDialogState((prev) => ({ ...prev, show: false }));
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={dialogState.show}
      title={dialogState.title}
      message={dialogState.message}
      onConfirm={(checkboxValue) => {
        dialogState.onConfirm(checkboxValue);
        hideConfirm();
      }}
      onCancel={hideConfirm}
      checkboxLabel={dialogState.checkboxLabel}
      checkboxDefaultChecked={dialogState.checkboxDefaultChecked}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      type={dialogState.type}
    />
  );

  return {
    showConfirm,
    hideConfirm,
    ConfirmDialog: ConfirmDialogComponent,
  };
};

export default ConfirmDialog;
