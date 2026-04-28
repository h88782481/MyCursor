/** 事件数据查询 hooks */
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

/** 查询过滤的使用事件 */
export function useUsageEvents(
  sessionToken: string | null,
  startDate: string,
  endDate: string,
  page?: number,
  pageSize?: number
) {
  return useQuery({
    queryKey: ["usage", "events", sessionToken, startDate, endDate, page],
    queryFn: () =>
      invoke("get_usage_events", { token: sessionToken, teamId: -1, startDate, endDate, page: page ?? 0, pageSize: pageSize ?? 50 }),
    enabled: !!sessionToken,
    staleTime: 5 * 60_000,
  });
}

/** 查询所有使用事件（自动全量拉取） */
export function useAllUsageEvents(
  sessionToken: string | null,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ["usage", "all-events", sessionToken, startDate, endDate],
    queryFn: () =>
      invoke("get_events_v2", { token: sessionToken, teamId: "-1", startDate, endDate }),
    enabled: !!sessionToken,
    staleTime: 5 * 60_000,
  });
}
