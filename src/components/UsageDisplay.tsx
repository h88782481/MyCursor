import React, { useState, useEffect, useCallback, Suspense } from "react";
import type { DateRange } from "../types/usage";
import { AggregatedUsageDisplay } from "./AggregatedUsageDisplay";
import { UsageDetailsModal } from "./UsageDetailsModal";
import { performanceMonitor } from "../utils/performance";
import { Icon } from "./Icon";
import { useTheme } from "../context/ThemeContext";

// 懒加载图表组件，减少初始包大小
const EventBasedUsageChart = React.lazy(() => import("./EventBasedUsageChart"));

interface UsageDisplayProps {
  token: string;
  email?: string;
  className?: string;
  hideHeader?: boolean; // 是否隐藏标题栏
}

export const UsageDisplay: React.FC<UsageDisplayProps> = ({
  token,
  email,
  className = "",
  hideHeader = false,
}) => {
  // 本地状态管理（不使用Context，完全本地化）
  const [localUsageData, setLocalUsageData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // 用于触发子组件重新加载
  const [isRefreshing, setIsRefreshing] = useState(false); // 防止重复刷新
  const { config } = useTheme(); // 获取主题配置

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log("📅 初始化日期范围:", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return { startDate, endDate };
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shouldAutoRefresh, setShouldAutoRefresh] = useState(false);

  // 组件挂载时加载本地数据
  useEffect(() => {
    if (token && email) {
      loadFromLocal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, email]);

  // 手动刷新：从API获取新数据并保存到本地
  const handleManualRefresh = useCallback(async () => {
    if (!email) {
      setError("无法刷新：未找到邮箱信息");
      return;
    }

    if (!token) {
      setError("无法刷新：未找到认证令牌");
      return;
    }

    // 防止重复刷新
    if (isRefreshing) {
      console.log("⏸️ 刷新正在进行中，请稍候...");
      return;
    }

    performanceMonitor.start('UsageDisplay_manualRefresh');
    console.log("🔄 用户手动刷新 - 从API获取新数据");
    setIsRefreshing(true);
    setLoading(true);
    setError(null);

    try {
      const { UsageService } = await import("../services/usageService");
      const { ConfigService } = await import("../services/configService");
      const { invoke } = await import("@tauri-apps/api/core");

      // 从API获取聚合数据
      const result = await UsageService.getUsageForPeriod(
        token,
      dateRange.startDate.getTime(),
      dateRange.endDate.getTime(),
        -1
      );

      if (result.success && result.data) {
        // 更新本地显示
        setLocalUsageData(result.data);

        // 构建历史快照
        const timestamp = Date.now();
        const newSnapshot = {
          timestamp,
          total_cost: result.data.total_cost_cents || 0,
          models: {} as Record<string, number>,
        };

        // 提取各模型费用
        if (
          result.data.aggregations &&
          Array.isArray(result.data.aggregations)
        ) {
          result.data.aggregations.forEach((model: any) => {
            if (model.model_intent && typeof model.total_cents === "number") {
              newSnapshot.models[model.model_intent] = model.total_cents;
            }
          });
        }

        // 读取现有历史记录
        const existingData = await ConfigService.loadUsageData(email);
        const existingSnapshots =
          existingData.success && existingData.data?.history_snapshots
            ? existingData.data.history_snapshots
            : [];

        // 追加新快照（最多保留100条记录）
        const updatedSnapshots = [...existingSnapshots, newSnapshot].slice(
          -100
        );

        // 构建包含历史快照的数据
        const dataToSave = {
          ...result.data,
          history_snapshots: updatedSnapshots,
        };

        // 保存到本地（包含历史快照）
        await ConfigService.saveUsageData(
          email,
          token,
          dateRange.startDate.toISOString(),
          dateRange.endDate.toISOString(),
          dataToSave
        );
        console.log("💾 用量数据已保存到本地（包含历史快照）");

        // ========== 同时获取并保存事件数据 ==========
        try {
          const eventsResponse: any = await invoke("get_events_v2", {
            token,
            // 与 get_aggregated_usage / 刷新聚合用量 的 teamId 一致（个人用量用 -1）
            teamId: "-1",
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString(),
          });

          if (eventsResponse.success && eventsResponse.events) {
            console.log(
              `✅ 获取到 ${eventsResponse.events.length} 条事件数据`
            );

            /** API：usageBasedCosts 为 "-" | "$35.11" */
            const parseUsageBasedCostsToCents = (raw: unknown): number | null => {
              if (raw == null) return null;
              const s = String(raw).trim();
              if (!s || s === "-") return null;
              const m = s.match(/\$\s*([\d,]+\.?\d*)/);
              if (m) {
                const dollars = parseFloat(m[1].replace(/,/g, ""));
                return Number.isFinite(dollars) ? dollars * 100 : null;
              }
              const n = parseFloat(s);
              return Number.isFinite(n) ? n * 100 : null;
            };

            // 转换后端数据格式为前端期望的格式（使用reduce优化性能）
            const convertedEvents = eventsResponse.events.reduce((acc: any[], event: any) => {
              // 解析时间戳（支持 ISO、毫秒、秒级 Unix）
              let timestamp = 0;

              if (typeof event.timestamp === "string") {
                const parsed = parseInt(event.timestamp, 10);
                if (!isNaN(parsed) && String(parsed) === event.timestamp.trim()) {
                  timestamp = parsed;
                } else {
                  const dateTimestamp = new Date(event.timestamp).getTime();
                  if (!isNaN(dateTimestamp)) {
                    timestamp = dateTimestamp;
                  }
                }
              } else if (typeof event.timestamp === "number") {
                timestamp = event.timestamp;
              }

              if (timestamp > 0 && timestamp < 1e12) {
                timestamp *= 1000;
              }

              if (timestamp <= 0 || !Number.isFinite(timestamp)) {
                return acc;
              }

              let costCents = 0;
              const tokenUsage = event.tokenUsage;
              if (tokenUsage && typeof tokenUsage.totalCents === "number" && Number.isFinite(tokenUsage.totalCents)) {
                costCents = tokenUsage.totalCents;
              } else if (typeof event.chargedCents === "number" && Number.isFinite(event.chargedCents)) {
                costCents = event.chargedCents;
              } else {
                const fromUbc = parseUsageBasedCostsToCents(event.usageBasedCosts);
                if (fromUbc != null) {
                  costCents = fromUbc;
                }
              }

              acc.push({
                timestamp,
                model_intent: event.model || "unknown",
                cost_cents: costCents,
                input_tokens: tokenUsage?.inputTokens || 0,
                output_tokens: tokenUsage?.outputTokens || 0,
                cache_write_tokens: tokenUsage?.cacheWriteTokens || 0,
                cache_read_tokens: tokenUsage?.cacheReadTokens || 0,
              });
              
              return acc;
            }, []);

            // 如果大量事件被过滤掉，说明数据有问题
            if (convertedEvents.length === 0 && eventsResponse.events.length > 0) {
              console.error("❌ 所有事件的时间戳都无效！请检查后端返回的数据格式");
            } else if (convertedEvents.length < eventsResponse.events.length * 0.5) {
              console.warn(`⚠️ 过滤掉了 ${eventsResponse.events.length - convertedEvents.length}/${eventsResponse.events.length} 个无效事件`);
            } else {
              console.log(`✅ 转换成功 ${convertedEvents.length} 个事件`);
            }

            // 构建事件数据缓存
            const eventsCache = {
              email: email,
              start_date: dateRange.startDate.toISOString(),
              end_date: dateRange.endDate.toISOString(),
              events: convertedEvents,
              total_events: convertedEvents.length,
              cached_at: new Date().toISOString(),
            };

            // 保存到本地
            const saveResult = await ConfigService.saveEventsData(eventsCache);
            
            if (saveResult.success) {
              console.log(`✅ 事件数据已保存: ${convertedEvents.length} 个事件`);
            } else {
              console.error("❌ 保存事件数据失败:", saveResult.message);
            }

            // 触发图表刷新
            setRefreshKey((prev) => prev + 1);
          } else if (!eventsResponse.success) {
            console.warn("⚠️ API 返回失败:", eventsResponse.message || "未知错误");
          } else {
            console.warn("⚠️ API 返回但无事件数据");
          }
        } catch (eventError) {
          console.error("❌ 获取事件数据异常:", eventError);
          // 事件数据获取失败不影响主要功能，只记录错误
        }
        // ========================================

        console.log("✅ 刷新完成");
      } else {
        setError(result.message || "获取用量数据失败");
      }
    } catch (error) {
      console.error("❌ 刷新失败:", error);
      setError(
        `刷新失败: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      const duration = performanceMonitor.end('UsageDisplay_manualRefresh');
      console.log(`✅ 用量数据刷新完成，耗时: ${duration.toFixed(2)}ms`);
    }
  }, [email, token, dateRange, isRefreshing]);

  // 自动刷新逻辑（当需要时触发）
  useEffect(() => {
    if (shouldAutoRefresh && token && email) {
      console.log("🔄 触发自动刷新...");
      setShouldAutoRefresh(false);
      handleManualRefresh();
    }
  }, [shouldAutoRefresh, token, email, handleManualRefresh]);

  // 从本地加载数据（只从本地读取，不从API获取）
  const loadFromLocal = async () => {
    performanceMonitor.start('UsageDisplay_loadFromLocal');
    
    try {
      console.log("📂 尝试从本地加载用量数据...", { email });
      const { ConfigService } = await import("../services/configService");
      
      // 同时检查聚合数据和事件数据
      const usageResult = await ConfigService.loadUsageData(email || "");
      const eventsResult = await ConfigService.loadEventsData();

      console.log("📦 本地数据加载结果:", { 
        usage: usageResult.success, 
        events: eventsResult.success,
        eventsCount: eventsResult.data?.events?.length || 0
      });

      // 检查是否有聚合用量数据
      const hasUsageData = usageResult.success && usageResult.data && usageResult.data.data;

      if (hasUsageData && usageResult.data) {
        console.log("✅ 成功从本地加载聚合用量数据");
        console.log("📅 保存的日期范围:", {
          start: usageResult.data.start_date,
          end: usageResult.data.end_date
        });
        
        // 恢复保存的日期
        setDateRange({
          startDate: new Date(usageResult.data.start_date),
          endDate: new Date(usageResult.data.end_date),
        });
        // 恢复保存的用量数据
        setLocalUsageData(usageResult.data.data);
        setError(null);
        
        console.log("📊 已恢复本地缓存的用量数据");
        
        // 触发图表刷新以加载事件数据（如果有的话）
        setRefreshKey((prev) => prev + 1);
      } else {
        // 只有在完全没有用量数据时才提示
        console.log("⚠️ 本地没有缓存数据，请点击刷新按钮获取数据");
        // 不设置 error，以免阻挡界面显示
      }
    } catch (error) {
      console.error("❌ 加载本地数据失败:", error);
      setError("加载本地数据时发生错误");
    } finally {
      const duration = performanceMonitor.end('UsageDisplay_loadFromLocal');
      console.log(`✅ 本地数据加载完成，耗时: ${duration.toFixed(2)}ms`);
    }
  };

  // 日期变化时只保存，不获取数据
  const handleDateRangeChange = useCallback(async (newDateRange: DateRange) => {
    setDateRange(newDateRange);
    console.log("📅 日期范围已更新并保存");

    // 保存新的日期到本地（保持原有数据）
    if (email && localUsageData) {
      try {
        const { ConfigService } = await import("../services/configService");
        await ConfigService.saveUsageData(
          email,
          token,
          newDateRange.startDate.toISOString(),
          newDateRange.endDate.toISOString(),
          localUsageData
        );
        console.log("💾 日期已保存，请点击刷新获取该时间段的数据");
      } catch (error) {
        console.error("保存日期失败:", error);
      }
    }
  }, [email, token, localUsageData]);

  // Preset period change function - commented out as it's not currently used
  // const handlePresetPeriodChange = async (period: string) => {
  //   const endDate = new Date();
  //   const startDate = new Date();
  //   switch (period) {
  //     case "7days":
  //       startDate.setDate(startDate.getDate() - 7);
  //       break;
  //     case "30days":
  //       startDate.setDate(startDate.getDate() - 30);
  //       break;
  //     default:
  //       startDate.setDate(startDate.getDate() - 30);
  //   }
  //   await handleDateRangeChange({ startDate, endDate });
  // };

  const formatDate = useCallback((date: Date): string => {
    return date.toISOString().split("T")[0];
  }, []);

  // 检测是否开启了自定义背景或透明主题
  const hasCustomBackground = !!(config.customBackground?.enabled && config.customBackground?.imageUrl);
  const isTranslucentTheme = config.mode === 'transparent' || hasCustomBackground;

  if (!token) {
    return (
      <div
        className={`p-4 rounded-lg ${className}`}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          backdropFilter: isTranslucentTheme ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: isTranslucentTheme ? 'blur(10px)' : 'none',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>请先登录以查看用量数据</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        boxShadow: 'var(--shadow-light)',
        backdropFilter: isTranslucentTheme ? 'blur(10px)' : 'none',
        WebkitBackdropFilter: isTranslucentTheme ? 'blur(10px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          {!hideHeader && (
            <h3 className="text-lg font-medium leading-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Icon name="chart" size={20} />
              用量统计 {email && `- ${email}`}
            </h3>
          )}
          <div className="flex space-x-2" style={{ marginLeft: hideHeader ? '0' : 'auto' }}>
            <button
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                fontSize: '14px',
                fontWeight: '500',
                color: loading || isRefreshing ? 'var(--text-secondary)' : 'var(--primary-color)',
                backgroundColor: loading || isRefreshing ? 'var(--bg-secondary)' : 'rgba(74, 137, 220, 0.15)',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: loading || isRefreshing ? 'not-allowed' : 'pointer',
                opacity: loading || isRefreshing ? 0.5 : 1,
                transition: 'all var(--transition-duration) ease',
              }}
              onMouseEnter={(e) => {
                if (!loading && !isRefreshing) {
                  e.currentTarget.style.backgroundColor = 'rgba(74, 137, 220, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !isRefreshing) {
                  e.currentTarget.style.backgroundColor = 'rgba(74, 137, 220, 0.15)';
                }
              }}
            >
              {loading ? (
                <>
                  <Icon name="loading" size={14} className="animate-spin" style={{ marginRight: '4px' }} />
                  刷新中...
                </>
              ) : (
                <>
                  <Icon name="refresh" size={14} style={{ marginRight: '4px' }} />
                  刷新
                </>
              )}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!localUsageData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                fontSize: '14px',
                fontWeight: '500',
                color: !localUsageData ? 'var(--text-secondary)' : '#10b981',
                backgroundColor: !localUsageData ? 'var(--bg-secondary)' : 'rgba(16, 185, 129, 0.15)',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: !localUsageData ? 'not-allowed' : 'pointer',
                opacity: !localUsageData ? 0.5 : 1,
                transition: 'all var(--transition-duration) ease',
              }}
              onMouseEnter={(e) => {
                if (localUsageData) {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (localUsageData) {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                }
              }}
            >
              <Icon name="eye" size={14} style={{ marginRight: '4px' }} />
              查看明细
            </button>
          </div>
        </div>

        {/* Time Period Selection - 只保留自定义 */}
        <div className="mb-4 space-y-3">
          <div>
            <label className="block mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              时间段选择
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  开始日期
                </label>
                <input
                  type="date"
                  value={formatDate(dateRange.startDate)}
                  onChange={(e) => {
                    const newStartDate = new Date(e.target.value);
                    handleDateRangeChange({
                      startDate: newStartDate,
                      endDate: dateRange.endDate,
                    });
                  }}
                  className="block w-full mt-1 rounded-md sm:text-sm"
                  style={{
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px',
                    transition: 'all var(--transition-duration) ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74, 137, 220, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  aria-label="开始日期"
                />
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  结束日期
                </label>
                <input
                  type="date"
                  value={formatDate(dateRange.endDate)}
                  onChange={(e) => {
                    const newEndDate = new Date(e.target.value);
                    handleDateRangeChange({
                      startDate: dateRange.startDate,
                      endDate: newEndDate,
                    });
                  }}
                  className="block w-full mt-1 rounded-md sm:text-sm"
                  style={{
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px',
                    transition: 'all var(--transition-duration) ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74, 137, 220, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  aria-label="结束日期"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="inline-flex items-center">
              <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24" style={{ color: 'var(--primary-color)' }}>
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载用量数据中...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div 
            className="p-4 rounded-md"
            style={{
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <p className="text-sm" style={{ color: '#dc2626' }}>❌ {error}</p>
          </div>
        )}

        {/* Empty State - 友好提示 */}
        {!localUsageData && !loading && !error && (
          <div 
            className="p-12 text-center rounded-lg"
            style={{
              border: '1px solid rgba(74, 137, 220, 0.3)',
              backgroundColor: 'rgba(74, 137, 220, 0.1)',
            }}
          >
            <div className="mb-4 flex justify-center">
              <Icon name="chart" size={64} color="var(--text-secondary)" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-color)' }}>暂无本地缓存数据</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              点击"刷新"按钮获取最新的用量数据
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              💡 提示：数据获取后会自动保存到本地，下次打开时直接显示
            </p>
          </div>
        )}

        {/* Usage Data Display */}
        {localUsageData && !loading && (
          <>
          <AggregatedUsageDisplay
              aggregatedUsage={localUsageData}
            showTitle={false}
            variant="detailed"
          />

            {/* 模型使用费用趋势图（基于事件数据） */}
            <div className="mt-6">
              <Suspense 
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-flex items-center">
                      <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">加载图表中...</span>
                    </div>
                  </div>
                }
              >
                <EventBasedUsageChart key={refreshKey} email={email} />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* Usage Details Modal */}
      <UsageDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        token={token}
      />
    </div>
  );
};
