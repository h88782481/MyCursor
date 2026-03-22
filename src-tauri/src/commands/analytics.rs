/// 用量统计命令入口
///
/// 用量缓存和事件缓存的读写命令。
/// API 请求命令仍在 lib.rs 中（过渡期间）。
use crate::{log_info, log_error};
use crate::error::AppError;

/// 保存用量缓存
#[tauri::command]
#[specta::specta]
pub async fn save_usage_data_cache(cache_data: String) -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("usage_data.json");
    std::fs::write(&path, &cache_data).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"success": true}))
}

/// 加载用量缓存
#[tauri::command]
#[specta::specta]
pub async fn load_usage_data_cache(email: String) -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("usage_data.json");
    if !path.exists() {
        return Ok(serde_json::json!({"success": false, "message": "缓存文件不存在"}));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(cached_email) = data.get("email").and_then(|e| e.as_str()) {
        if cached_email == email {
            return Ok(serde_json::json!({"success": true, "data": data}));
        }
    }
    Ok(serde_json::json!({"success": false, "message": "缓存邮箱不匹配"}))
}

/// 清除用量缓存
#[tauri::command]
#[specta::specta]
pub async fn clear_usage_data() -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("usage_data.json");
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({"success": true, "message": "用量缓存已清除"}))
}

/// 保存事件缓存
#[tauri::command]
#[specta::specta]
pub async fn save_events_data_cache(events_data: String) -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("events_data.json");
    std::fs::write(&path, &events_data).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"success": true}))
}

/// 加载事件缓存
#[tauri::command]
#[specta::specta]
pub async fn load_events_data_cache() -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("events_data.json");
    if !path.exists() {
        return Ok(serde_json::json!({"success": false, "message": "缓存不存在"}));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"success": true, "data": data}))
}

/// 清除事件缓存
#[tauri::command]
#[specta::specta]
pub async fn clear_events_data() -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("events_data.json");
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({"success": true, "message": "事件缓存已清除"}))
}

/// 保存账号缓存
#[tauri::command]
#[specta::specta]
pub async fn save_account_cache(accounts_json: String) -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("account_cache.json");
    std::fs::write(&path, &accounts_json).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"success": true}))
}

/// 加载账号缓存
#[tauri::command]
#[specta::specta]
pub async fn load_account_cache() -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("account_cache.json");
    if !path.exists() {
        return Ok(serde_json::json!([]));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(data)
}

/// 清除账号缓存
#[tauri::command]
#[specta::specta]
pub async fn clear_account_cache() -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("account_cache.json");
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({"success": true, "message": "账号缓存已清除"}))
}

/// 获取指定时间段的用量数据
#[tauri::command]
#[specta::specta]
pub async fn get_usage_for_period(
    token: String,
    start_date: u64,
    end_date: u64,
    team_id: i32,
) -> Result<serde_json::Value, String> {
    let client = crate::infra::api::CursorApiClient::new();
    let cookie = crate::infra::api::CursorApiClient::build_workos_cookie(&token);
    match client.get_aggregated_usage(&cookie, start_date, end_date, team_id).await {
        Ok(Some(usage_data)) => Ok(serde_json::json!({
            "success": true,
            "message": "Successfully retrieved usage data",
            "data": usage_data
        })),
        Ok(None) => Ok(serde_json::json!({
            "success": false,
            "message": "No usage data found"
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": format!("Failed to get usage data: {}", e)
        })),
    }
}

/// 获取用户分析数据
#[tauri::command]
#[specta::specta]
pub async fn get_user_analytics(
    token: String,
    team_id: i32,
    user_id: i32,
    start_date: String,
    end_date: String,
) -> Result<serde_json::Value, String> {
    let client = crate::infra::api::CursorApiClient::new();
    let cookie = crate::infra::api::CursorApiClient::build_workos_cookie(&token);
    match client.get_user_analytics(&cookie, team_id, user_id, &start_date, &end_date).await {
        Ok(Some(analytics_data)) => Ok(serde_json::json!({
            "success": true,
            "message": "Successfully retrieved user analytics data",
            "data": analytics_data
        })),
        Ok(None) => Ok(serde_json::json!({
            "success": false,
            "message": "No user analytics data found"
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": format!("Failed to get user analytics data: {}", e)
        })),
    }
}

/// 获取过滤的使用事件
#[tauri::command]
#[specta::specta]
pub async fn get_usage_events(
    token: String,
    team_id: i32,
    start_date: String,
    end_date: String,
    page: i32,
    page_size: i32,
) -> Result<serde_json::Value, String> {
    let client = crate::infra::api::CursorApiClient::new();
    let cookie = crate::infra::api::CursorApiClient::build_workos_cookie(&token);
    match client.get_filtered_usage_events(&cookie, team_id, &start_date, &end_date, page, page_size).await {
        Ok(Some(events_data)) => Ok(serde_json::json!({
            "success": true,
            "message": "Successfully retrieved usage events data",
            "data": events_data
        })),
        Ok(None) => Ok(serde_json::json!({
            "success": false,
            "message": "No usage events data found"
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": format!("Failed to get usage events data: {}", e)
        })),
    }
}

/// 获取事件数据 v2（全量拉取）
#[tauri::command]
#[specta::specta]
pub async fn get_events_v2(
    token: String,
    team_id: String,
    start_date: String,
    end_date: String,
) -> Result<serde_json::Value, String> {
    let client = crate::infra::api::CursorApiClient::new();
    let cookie = crate::infra::api::CursorApiClient::build_workos_cookie(&token);
    let team_id_int = team_id.parse::<i32>().unwrap_or(0);

    fn to_millis_string(input: &str) -> String {
        if input.chars().all(|c| c.is_ascii_digit()) {
            return input.to_string();
        }
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(input) {
            return dt.timestamp_millis().to_string();
        }
        if let Ok(naive) = chrono::NaiveDate::parse_from_str(input, "%Y-%m-%d") {
            if let Some(dt) = naive.and_hms_opt(0, 0, 0) {
                let dt_utc = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt, chrono::Utc);
                return dt_utc.timestamp_millis().to_string();
            }
        }
        input.to_string()
    }

    let start_param = to_millis_string(&start_date);
    let end_param = to_millis_string(&end_date);

    let page_sizes: [i32; 4] = [200, 100, 50, 20];

    for page_size in page_sizes {
        let mut current_page: i32 = 1;
        let mut all_events: Vec<serde_json::Value> = Vec::new();

        match client.get_filtered_usage_events(
            &cookie, team_id_int, &start_param, &end_param, current_page, page_size
        ).await {
            Ok(Some(events_data)) => {
                let total_count = events_data.total_usage_events_count as usize;
                for ev in events_data.usage_events_display.into_iter() {
                    if let Ok(val) = serde_json::to_value(ev) {
                        all_events.push(val);
                    }
                }

                while all_events.len() < total_count {
                    current_page += 1;
                    match client.get_filtered_usage_events(
                        &cookie, team_id_int, &start_param, &end_param, current_page, page_size
                    ).await {
                        Ok(Some(page_data)) => {
                            let mut fetched = 0;
                            for ev in page_data.usage_events_display.into_iter() {
                                if let Ok(val) = serde_json::to_value(ev) {
                                    all_events.push(val);
                                    fetched += 1;
                                }
                            }
                            if fetched == 0 { break; }
                        }
                        _ => break,
                    }
                }

                return Ok(serde_json::json!({
                    "success": true,
                    "events": all_events,
                    "total": total_count,
                    "fetched": all_events.len()
                }));
            }
            Ok(None) => continue,
            Err(_) => continue,
        }
    }

    Ok(serde_json::json!({
        "success": false,
        "message": "所有 page_size 均失败"
    }))
}
