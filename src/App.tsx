import { useState, lazy, Suspense, useEffect } from "react";
import { Spinner } from "@/components/Spinner";
import { ThemeModal } from "@/components/ThemeModal";
import { Icon } from "@/components/Icon";
import ErrorBoundary from "@/components/ErrorBoundary";
import { hybridStorage } from "@/utils/hybridStorage";

const MachineIdPage = lazy(() => import("@/features/identity/IdentityPage"));
const AccountsPage = lazy(() => import("@/features/accounts/AccountsPage"));
const SeamlessPage = lazy(() => import("@/features/seamless/SeamlessPage"));
const AdvancedFeaturesPage = lazy(() => import("@/features/advanced/AdvancedFeaturesPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));

type PageType = "machineId" | "account" | "seamless" | "advanced" | "settings";

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>("machineId");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // ✅ 初始化混合存储（IndexedDB + localStorage）
  useEffect(() => {
    hybridStorage.init().catch((error) => {
      console.error('混合存储初始化失败:', error);
    });

    // ✅ 开发环境：加载性能测试工具
    if (import.meta.env.DEV) {
      import('./utils/performanceTest').catch((error) => {
        console.error('性能测试工具加载失败:', error);
      });
    }
  }, []);

  // 获取导航按钮样式
  const getNavButtonStyle = (isActive: boolean) => {
    if (isActive) {
      return {
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        boxShadow: 'var(--shadow-medium)',
      };
    }
    return {
      color: 'var(--text-primary)',
    };
  };

  // 获取导航按钮类名
  const getNavButtonClass = (isActive: boolean) => {
    return `w-full flex items-center justify-center rounded-lg font-medium transition-all duration-200 ${
      isSidebarCollapsed ? "p-3" : "px-4 py-3 space-x-3"
    } ${!isActive ? 'hover:bg-[var(--bg-hover)]' : ''}`;
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* 左侧导航栏 */}
      <aside
        className={`shadow-lg flex flex-col transition-all duration-300 flex-shrink-0 ${
          isSidebarCollapsed ? "w-16" : "w-48"
        }`}
        style={{
          backgroundColor: 'var(--bg-primary)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        onMouseEnter={() => { if (!isSidebarPinned) setIsSidebarCollapsed(false); }}
        onMouseLeave={() => { if (!isSidebarPinned) setIsSidebarCollapsed(true); }}
      >
        {/* 标题区域 */}
        <div
          className="transition-all duration-300 flex items-center justify-center"
          style={{
            borderBottom: '1px solid var(--border-primary)',
            minHeight: '88px',
            height: '88px',
            padding: isSidebarCollapsed ? '1rem 0' : '1.5rem',
            position: 'relative',
          }}
        >
          {isSidebarCollapsed ? (
            <Icon name="feather" size={32} style={{ color: 'var(--primary-color)' }} />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Icon name="feather" size={28} style={{ color: 'var(--primary-color)' }} />
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>
                    MyCursor
                  </h1>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Cursor管理工具</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSidebarPinned(!isSidebarPinned);
                  if (isSidebarPinned) setIsSidebarCollapsed(true);
                }}
                title={isSidebarPinned ? "取消固定侧边栏" : "固定侧边栏"}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: isSidebarPinned ? 'var(--primary-color)' : 'var(--text-tertiary)',
                  transform: isSidebarPinned ? 'rotate(0deg)' : 'rotate(45deg)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon name="lock" size={14} />
              </button>
            </>
          )}
        </div>

        {/* 导航菜单 */}
        <nav
          className={`flex-1 space-y-2 transition-all duration-300 ${
            isSidebarCollapsed ? "p-2" : "p-4"
          }`}
        >
          <button
            onClick={() => setCurrentPage("machineId")}
            className={getNavButtonClass(currentPage === "machineId")}
            style={getNavButtonStyle(currentPage === "machineId")}
            title="Machine ID"
          >
            <Icon name="plug" size={isSidebarCollapsed ? 24 : 20} />
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap">Machine ID</span>
            )}
          </button>

          <button
            onClick={() => setCurrentPage("account")}
            className={getNavButtonClass(currentPage === "account")}
            style={getNavButtonStyle(currentPage === "account")}
            title="账号管理"
          >
            <Icon name="user" size={isSidebarCollapsed ? 24 : 20} />
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap">账号管理</span>
            )}
          </button>

          <button
            onClick={() => setCurrentPage("seamless")}
            className={getNavButtonClass(currentPage === "seamless")}
            style={getNavButtonStyle(currentPage === "seamless")}
            title="无感换号"
          >
            <Icon name="bolt" size={isSidebarCollapsed ? 24 : 20} />
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap">无感换号</span>
            )}
          </button>

          <button
            onClick={() => setCurrentPage("advanced")}
            className={getNavButtonClass(currentPage === "advanced")}
            style={getNavButtonStyle(currentPage === "advanced")}
            title="高级功能"
          >
            <Icon name="power" size={isSidebarCollapsed ? 24 : 20} />
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap">高级功能</span>
            )}
          </button>

          <button
            onClick={() => setCurrentPage("settings")}
            className={getNavButtonClass(currentPage === "settings")}
            style={getNavButtonStyle(currentPage === "settings")}
            title="设置"
          >
            <Icon name="settings" size={isSidebarCollapsed ? 24 : 20} />
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap">设置</span>
            )}
          </button>
        </nav>

        {/* 主题设置按钮 */}
        <div className={isSidebarCollapsed ? 'p-2' : 'p-4'} style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={() => setIsThemeModalOpen(true)}
            className={getNavButtonClass(false)}
            style={{ color: 'var(--text-primary)' }}
            title="主题设置"
          >
            <Icon name="palette" size={isSidebarCollapsed ? 24 : 20} />
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap">主题</span>
            )}
          </button>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="w-full px-6 py-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" />
              </div>
            }
          >
            <div key={currentPage} className="animate-fadeIn">
              {currentPage === "machineId" && <MachineIdPage />}
              {currentPage === "account" && <AccountsPage />}
              {currentPage === "seamless" && <SeamlessPage />}
              {currentPage === "advanced" && <AdvancedFeaturesPage />}
              {currentPage === "settings" && <SettingsPage />}
            </div>
          </Suspense>
        </div>
      </main>

      {/* 主题设置 Modal */}
      <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
