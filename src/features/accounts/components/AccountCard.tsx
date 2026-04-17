import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components";
import type { AccountInfo } from "@/types/account";

interface AccountCardProps {
  account: AccountInfo;
  index: number;
  isSelected: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  isClosing: boolean;
  onSelect: (email: string) => void;
  onRefresh: (account: AccountInfo, index: number) => void;
  onSwitch: (account: AccountInfo) => void;
  onViewUsage: (account: AccountInfo) => void;
  onEdit: (account: AccountInfo) => void;
  onRemove: (email: string) => void;
  onToggleExpand: (email: string) => void;
  onCloseMenu: () => void;
  onViewDashboard: (account: AccountInfo) => void;
  onViewBindCard: (account: AccountInfo) => void;
  onDeleteCursorAccount: (account: AccountInfo) => void;
  onLogout?: () => void;
  onToast: (message: string, type: "success" | "error") => void;
}

export const AccountCard = memo(
  ({
    account,
    index,
    isSelected,
    isCurrent,
    isExpanded,
    isClosing,
    onSelect,
    onRefresh,
    onSwitch,
    onViewUsage,
    onEdit,
    onRemove,
    onToggleExpand,
    onCloseMenu,
    onViewDashboard,
    onViewBindCard,
    onDeleteCursorAccount,
    onLogout,
    onToast,
  }: AccountCardProps) => {
    const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

    useEffect(() => {
      const updatePosition = () => {
        if (!toggleButtonRef.current) return;
        const rect = toggleButtonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + 8,
        });
      };

      if (isExpanded) {
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
          window.removeEventListener("resize", updatePosition);
          window.removeEventListener("scroll", updatePosition, true);
        };
      }

      setMenuPosition(null);
    }, [isExpanded]);

    useEffect(() => {
      if (!isExpanded) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          menuRef.current &&
          !menuRef.current.contains(target) &&
          toggleButtonRef.current &&
          !toggleButtonRef.current.contains(target)
        ) {
          onCloseMenu();
        }
      };

      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isExpanded, onCloseMenu]);

    const handleCopyEmail = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(account.email);
          onToast(`已复制: ${account.email}`, "success");
        } catch (error) {
          console.error("复制失败:", error);
          onToast("复制失败", "error");
        }
      },
      [account.email, onToast]
    );

    const getSubscriptionBadge = useCallback(() => {
      if (account.subscription_type === undefined) {
        return (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            加载中...
          </span>
        );
      }

      if (account.subscription_type === "token_expired") {
        return (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: "rgba(244, 135, 113, 0.15)", color: "#f48771" }}
          >
            <Icon name="alert" size={12} style={{ marginRight: "2px" }} />
            Token 失效
          </span>
        );
      }

      const subType = (account.subscription_type || "free").toLowerCase();
      const daysRemaining =
        account.trial_days_remaining !== undefined ? ` - ${account.trial_days_remaining}天` : "";

      const styleMap: Record<string, { bg: string; color: string; icon: string; label: string }> = {
        pro: { bg: "rgba(168, 85, 247, 0.15)", color: "#9333ea", icon: "crown", label: "Pro" },
        pro_plus: {
          bg: "rgba(168, 85, 247, 0.2)",
          color: "#7c3aed",
          icon: "crown",
          label: "Pro+",
        },
        ultra: {
          bg: "rgba(168, 85, 247, 0.2)",
          color: "#7c3aed",
          icon: "crown",
          label: "Ultra",
        },
        business: {
          bg: "rgba(168, 85, 247, 0.15)",
          color: "#6d28d9",
          icon: "crown",
          label: "Business",
        },
        free_trial: {
          bg: "rgba(74, 137, 220, 0.15)",
          color: "var(--primary-color)",
          icon: "gift",
          label: `Trial${daysRemaining}`,
        },
        free: {
          bg: "var(--bg-secondary)",
          color: "var(--text-secondary)",
          icon: "free",
          label: "Free",
        },
      };

      const style = styleMap[subType] || {
        bg: "rgba(74, 137, 220, 0.1)",
        color: "var(--primary-color)",
        icon: "bolt",
        label: account.subscription_type || "Free",
      };

      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          <Icon name={style.icon as never} size={12} style={{ marginRight: "2px" }} />
          {style.label}
        </span>
      );
    }, [account.subscription_type, account.trial_days_remaining]);

    return (
      <div
        className="rounded-lg border transition-colors"
        style={{
          padding: "8px 12px",
          backgroundColor: isCurrent ? "rgba(16, 185, 129, 0.1)" : "var(--bg-primary)",
          borderColor: isCurrent ? "rgba(16, 185, 129, 0.3)" : "var(--border-primary)",
          backdropFilter: "blur(var(--backdrop-blur))",
          WebkitBackdropFilter: "blur(var(--backdrop-blur))",
          position: "relative",
          zIndex: isExpanded ? 10 : 1,
          overflow: "visible",
        }}
        onMouseEnter={(e) => {
          if (!isCurrent) {
            e.currentTarget.style.borderColor = "var(--border-hover)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isCurrent) {
            e.currentTarget.style.borderColor = "var(--border-primary)";
          }
        }}
      >
        <div className="flex items-center justify-between gap-2" style={{ position: "relative", overflow: "visible" }}>
          <div className="flex items-center flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(account.email)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "16px",
                height: "16px",
                accentColor: "var(--primary-color)",
                cursor: "pointer",
              }}
            />
          </div>

          <div
            className="flex-shrink min-w-0 cursor-pointer group"
            style={{ maxWidth: "180px" }}
            title={`${account.email}\n点击复制邮箱`}
            onClick={handleCopyEmail}
          >
            <span
              className="text-sm font-medium truncate block transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--primary-color)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
              }}
            >
              {account.email}
            </span>
          </div>

          {account.username && (
            <div className="flex-shrink-0">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: "rgba(74, 137, 220, 0.15)", color: "var(--primary-color)" }}
              >
                <Icon name="tag" size={12} style={{ marginRight: "2px" }} />
                {account.username}
              </span>
            </div>
          )}

          {account.tags && account.tags.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1">
              {account.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    color: "#d97706",
                    fontSize: "10px",
                    lineHeight: "1",
                  }}
                >
                  {tag}
                </span>
              ))}
              {account.tags.length > 3 && (
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  +{account.tags.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex-shrink-0">{getSubscriptionBadge()}</div>

          {isCurrent && (
            <div className="flex-shrink-0">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}
              >
                <Icon name="check" size={12} style={{ marginRight: "2px" }} />
                当前
              </span>
            </div>
          )}

          <div className="flex-shrink-0 ml-auto" style={{ position: "relative", overflow: "visible" }}>
            {(isExpanded || isClosing) && <div style={{ display: "none" }} />}

            <div className="flex items-center justify-end gap-1.5 action-buttons-container">
              <button
                ref={toggleButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(account.email);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: "500",
                  borderRadius: "var(--border-radius)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all var(--transition-duration) ease",
                  backgroundColor: isExpanded ? "var(--primary-color)" : "var(--bg-secondary)",
                  color: isExpanded ? "white" : "var(--text-primary)",
                  boxShadow: "var(--shadow-light)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-medium)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--shadow-light)";
                }}
                title={isExpanded ? "收起操作" : "更多操作"}
              >
                <Icon name="dots" size={18} />
              </button>
            </div>
          </div>
        </div>

        {isExpanded &&
          menuPosition &&
          createPortal(
            <>
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1999,
                  background: "transparent",
                  pointerEvents: "none",
                }}
              />
              <div
                ref={menuRef}
                className="flex items-center gap-1.5"
                style={{
                  position: "fixed",
                  top: menuPosition.top,
                  right: menuPosition.right,
                  transform: "translateY(-50%)",
                  zIndex: 2000,
                  whiteSpace: "nowrap",
                  backgroundColor: "var(--bg-primary)",
                  padding: "6px",
                  borderRadius: "var(--border-radius)",
                  boxShadow: "var(--shadow-heavy)",
                  pointerEvents: "auto",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onRefresh(account, index);
                  }}
                  style={menuButtonStyle()}
                  onMouseEnter={handleMenuButtonMouseEnter}
                  onMouseLeave={handleMenuButtonMouseLeave}
                  title="刷新账户信息"
                >
                  <Icon name="refresh" size={12} style={{ marginRight: "2px" }} />
                  刷新
                </button>

                {account.workos_cursor_session_token && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onViewDashboard(account);
                    }}
                    style={menuButtonStyle()}
                    onMouseEnter={handleMenuButtonMouseEnter}
                    onMouseLeave={handleMenuButtonMouseLeave}
                    title="打开Cursor主页"
                  >
                    <Icon name="home" size={12} style={{ marginRight: "2px" }} />
                    主页
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onViewBindCard(account);
                  }}
                  style={menuButtonStyle()}
                  onMouseEnter={handleMenuButtonMouseEnter}
                  onMouseLeave={handleMenuButtonMouseLeave}
                  title="查看绑卡/订阅信息"
                >
                  <Icon name="key" size={12} style={{ marginRight: "2px" }} />
                  绑卡
                </button>

                {isCurrent ? (
                  onLogout && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onLogout();
                      }}
                      style={warningMenuButtonStyle()}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.05)";
                        e.currentTarget.style.backgroundColor = "#ffedd5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.backgroundColor = "#fff7ed";
                      }}
                      title="登出当前账号（清除本地认证数据）"
                    >
                      <Icon name="logout" size={12} style={{ marginRight: "2px" }} />
                      登出
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onSwitch(account);
                      }}
                      style={menuButtonStyle()}
                      onMouseEnter={handleMenuButtonMouseEnter}
                      onMouseLeave={handleMenuButtonMouseLeave}
                      title="切换到此账户"
                    >
                      <Icon name="arrows-exchange" size={12} style={{ marginRight: "2px" }} />
                      切换
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onRemove(account.email);
                      }}
                      style={dangerMenuButtonStyle()}
                      onMouseEnter={handleDangerButtonMouseEnter}
                      onMouseLeave={handleDangerButtonMouseLeave}
                      title="从本地列表中删除"
                    >
                      <Icon name="trash" size={12} style={{ marginRight: "2px" }} />
                      删除
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onViewUsage(account);
                  }}
                  style={menuButtonStyle()}
                  onMouseEnter={handleMenuButtonMouseEnter}
                  onMouseLeave={handleMenuButtonMouseLeave}
                  title="查看用量"
                >
                  <Icon name="chart" size={12} style={{ marginRight: "2px" }} />
                  用量
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onEdit(account);
                  }}
                  style={menuButtonStyle()}
                  onMouseEnter={handleMenuButtonMouseEnter}
                  onMouseLeave={handleMenuButtonMouseLeave}
                  title="编辑账户"
                >
                  <Icon name="edit" size={12} style={{ marginRight: "2px" }} />
                  编辑
                </button>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onDeleteCursorAccount(account);
                    }}
                    style={dangerMenuButtonStyle()}
                    onMouseEnter={handleDangerButtonMouseEnter}
                    onMouseLeave={handleDangerButtonMouseLeave}
                    title="注销 Cursor 账户（调用官方 API，永久删除，不可恢复）"
                  >
                    <Icon name="close" size={12} style={{ marginRight: "2px" }} />
                    注销
                  </button>
                )}
              </div>
            </>,
            document.body
          )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.account.email !== nextProps.account.email) return false;
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.isCurrent !== nextProps.isCurrent) return false;
    if (prevProps.isExpanded !== nextProps.isExpanded) return false;
    if (prevProps.isClosing !== nextProps.isClosing) return false;
    if (prevProps.account.subscription_type !== nextProps.account.subscription_type) return false;
    if (prevProps.account.subscription_status !== nextProps.account.subscription_status) return false;
    if (prevProps.account.trial_days_remaining !== nextProps.account.trial_days_remaining) return false;
    if (prevProps.account.username !== nextProps.account.username) return false;
    if (JSON.stringify(prevProps.account.tags) !== JSON.stringify(nextProps.account.tags)) return false;
    if (prevProps.account.token !== nextProps.account.token) return false;
    if (prevProps.account.refresh_token !== nextProps.account.refresh_token) return false;
    if (prevProps.account.workos_cursor_session_token !== nextProps.account.workos_cursor_session_token) return false;
    return true;
  }
);

const menuButtonStyle = (): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: "500",
  borderRadius: "var(--border-radius)",
  border: "1px solid var(--border-primary)",
  cursor: "pointer",
  transition: "all var(--transition-duration) ease",
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
});

const dangerMenuButtonStyle = (): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: "500",
  borderRadius: "var(--border-radius)",
  border: "1px solid #ef4444",
  cursor: "pointer",
  transition: "all var(--transition-duration) ease",
  backgroundColor: "#fef2f2",
  color: "#dc2626",
  whiteSpace: "nowrap",
});

const warningMenuButtonStyle = (): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: "500",
  borderRadius: "var(--border-radius)",
  border: "1px solid #f97316",
  cursor: "pointer",
  transition: "all var(--transition-duration) ease",
  backgroundColor: "#fff7ed",
  color: "#ea580c",
  whiteSpace: "nowrap",
});

const handleMenuButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = "scale(1.05)";
  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
};

const handleMenuButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
};

const handleDangerButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = "scale(1.05)";
  e.currentTarget.style.backgroundColor = "#fee2e2";
};

const handleDangerButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.backgroundColor = "#fef2f2";
};

AccountCard.displayName = "AccountCard";
