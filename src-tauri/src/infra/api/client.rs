/// Cursor REST API 统一客户端
///
/// 封装所有对 Cursor 服务端的 HTTP 请求。
use crate::domain::usage::*;
use crate::error::AppError;
use crate::{log_info, log_error, log_debug};
use anyhow::Result;

/// Cursor API 客户端
pub struct CursorApiClient {
    http: reqwest::Client,
}

impl CursorApiClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .gzip(true)
                .deflate(true)
                .brotli(true)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    pub fn http(&self) -> &reqwest::Client {
        &self.http
    }

    // === Cookie 构建 ===

    /// 构建 WorkOS Cookie
    ///
    /// 规则：
    /// - 如果传入的是完整的 WorkosCursorSessionToken（包含 `::` 或 `%3A%3A`），直接原样使用
    /// - 如果传入的是 access token，则按旧兼容逻辑拼接默认前缀
    pub fn build_workos_cookie(token: &str) -> String {
        if token.contains("::") || token.contains("%3A%3A") {
            format!("WorkosCursorSessionToken={}", token)
        } else {
            format!(
                "WorkosCursorSessionToken=user_01000000000000000000000000::{}",
                token
            )
        }
    }

    /// 构建 WorkOS Cookie（优先从账号列表查找保存的 Session Token）
    pub fn build_workos_cookie_with_accounts(access_token: &str, accounts_json: &str) -> String {
        if let Ok(accounts) = serde_json::from_str::<Vec<serde_json::Value>>(accounts_json) {
            for account in &accounts {
                if account["token"].as_str() == Some(access_token) {
                    if let Some(wt) = account["workos_cursor_session_token"].as_str() {
                        if !wt.is_empty() {
                            return format!("WorkosCursorSessionToken={}", wt);
                        }
                    }
                }
            }
        }
        Self::build_workos_cookie(access_token)
    }

    // === Dashboard 请求头 ===

    /// 构造 Cursor Dashboard API 通用请求头
    pub fn build_dashboard_headers() -> Result<reqwest::header::HeaderMap, AppError> {
        use reqwest::header::HeaderValue;
        let mut h = reqwest::header::HeaderMap::new();
        h.insert("Accept", "application/json, text/plain, */*".parse().map_err(|_| AppError::Internal("header error".into()))?);
        h.insert("Accept-Encoding", "gzip, deflate, br, zstd".parse().map_err(|_| AppError::Internal("header error".into()))?);
        h.insert("Accept-Language", "en,zh-CN;q=0.9,zh;q=0.8,eu;q=0.7".parse().map_err(|_| AppError::Internal("header error".into()))?);
        h.insert("Content-Type", "application/json".parse().map_err(|_| AppError::Internal("header error".into()))?);
        h.insert("Origin", "https://cursor.com".parse().map_err(|_| AppError::Internal("header error".into()))?);
        h.insert("Referer", "https://cursor.com/dashboard".parse().map_err(|_| AppError::Internal("header error".into()))?);
        h.insert("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36".parse().map_err(|_| AppError::Internal("header error".into()))?);
        Ok(h)
    }

    // === 用量 API ===

    /// 获取聚合用量数据
    pub async fn get_aggregated_usage(
        &self,
        cookie: &str,
        start_date: u64,
        end_date: u64,
        team_id: i32,
    ) -> Result<Option<AggregatedUsageData>, AppError> {
        let mut headers = Self::build_dashboard_headers()?;
        headers.insert("Cookie", cookie.parse().map_err(|_| AppError::Internal("cookie error".into()))?);

        let body = serde_json::json!({
            "startDate": start_date,
            "endDate": end_date,
            "teamId": team_id
        });

        let resp = self.http
            .post("https://cursor.com/api/dashboard/get-aggregated-usage-events")
            .headers(headers)
            .json(&body)
            .timeout(std::time::Duration::from_secs(40))
            .send()
            .await?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let text = resp.text().await?;
        let json_data: serde_json::Value = serde_json::from_str(&text)?;

        let mut aggregations = Vec::new();
        if let Some(agg_array) = json_data.get("aggregations").and_then(|v| v.as_array()) {
            for agg in agg_array {
                if let Some(model_intent) = agg.get("modelIntent").and_then(|v| v.as_str()) {
                    aggregations.push(ModelUsage {
                        model_intent: model_intent.to_string(),
                        input_tokens: agg.get("inputTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
                        output_tokens: agg.get("outputTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
                        cache_write_tokens: agg.get("cacheWriteTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
                        cache_read_tokens: agg.get("cacheReadTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
                        total_cents: agg.get("totalCents").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    });
                }
            }
        }

        Ok(Some(AggregatedUsageData {
            aggregations,
            total_input_tokens: json_data.get("totalInputTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
            total_output_tokens: json_data.get("totalOutputTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
            total_cache_write_tokens: json_data.get("totalCacheWriteTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
            total_cache_read_tokens: json_data.get("totalCacheReadTokens").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
            total_cost_cents: json_data.get("totalCostCents").and_then(|v| v.as_f64()).unwrap_or(0.0),
        }))
    }

    /// 获取用户分析数据
    pub async fn get_user_analytics(
        &self,
        cookie: &str,
        team_id: i32,
        user_id: i32,
        start_date: &str,
        end_date: &str,
    ) -> Result<Option<UserAnalyticsData>, AppError> {
        let mut headers = Self::build_dashboard_headers()?;
        headers.insert("Cache-Control", "no-cache".parse().map_err(|_| AppError::Internal("header error".into()))?);
        headers.insert("Cookie", cookie.parse().map_err(|_| AppError::Internal("cookie error".into()))?);

        let body = UserAnalyticsRequest {
            team_id,
            user_id,
            start_date: start_date.to_string(),
            end_date: end_date.to_string(),
        };

        let resp = self.http
            .post("https://cursor.com/api/dashboard/get-user-analytics")
            .headers(headers)
            .json(&body)
            .timeout(std::time::Duration::from_secs(40))
            .send()
            .await?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let text = resp.text().await?;
        match serde_json::from_str::<UserAnalyticsData>(&text) {
            Ok(data) => Ok(Some(data)),
            Err(_) => Ok(None),
        }
    }

    /// 获取过滤的使用事件
    pub async fn get_filtered_usage_events(
        &self,
        cookie: &str,
        team_id: i32,
        start_date: &str,
        end_date: &str,
        page: i32,
        page_size: i32,
    ) -> Result<Option<FilteredUsageEventsData>, AppError> {
        let mut headers = Self::build_dashboard_headers()?;
        headers.insert("Cache-Control", "no-cache".parse().map_err(|_| AppError::Internal("header error".into()))?);
        headers.insert("Cookie", cookie.parse().map_err(|_| AppError::Internal("cookie error".into()))?);

        let body = FilteredUsageRequest {
            team_id,
            start_date: start_date.to_string(),
            end_date: end_date.to_string(),
            page,
            page_size,
        };

        let resp = self.http
            .post("https://cursor.com/api/dashboard/get-filtered-usage-events")
            .headers(headers)
            .json(&body)
            .timeout(std::time::Duration::from_secs(40))
            .send()
            .await?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let text = resp.text().await?;
        match serde_json::from_str::<FilteredUsageEventsData>(&text) {
            Ok(data) => Ok(Some(data)),
            Err(e) => {
                log_error!("get_filtered_usage_events 结构化解析失败（已尝试容错）: {}", e);
                Self::parse_filtered_usage_events_lenient_json(&text)
            }
        }
    }

    /// 当 Cursor API 微调字段格式时仍能尽量取出事件列表
    fn parse_filtered_usage_events_lenient_json(
        text: &str,
    ) -> Result<Option<FilteredUsageEventsData>, AppError> {
        let v: serde_json::Value =
            serde_json::from_str(text).map_err(|e| AppError::Internal(e.to_string()))?;
        let total = v
            .get("totalUsageEventsCount")
            .and_then(|x| {
                x.as_i64().or_else(|| x.as_u64().map(|u| u as i64)).or_else(|| {
                    x.as_f64().map(|f| f as i64)
                })
            })
            .unwrap_or(0) as i32;
        let Some(arr) = v.get("usageEventsDisplay").and_then(|x| x.as_array()) else {
            return Ok(None);
        };
        let mut usage_events_display = Vec::with_capacity(arr.len());
        for item in arr {
            if let Ok(ev) = serde_json::from_value::<UsageEventDisplay>(item.clone()) {
                usage_events_display.push(ev);
            }
        }
        if usage_events_display.is_empty() && total > 0 {
            log_error!("usageEventsDisplay 中无可用事件条目（共 {}）", total);
        }
        Ok(Some(FilteredUsageEventsData {
            total_usage_events_count: total,
            usage_events_display,
        }))
    }
}

impl Clone for CursorApiClient {
    fn clone(&self) -> Self {
        Self::new()
    }
}
