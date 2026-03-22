/// 系统/调试命令入口
///
/// 包含日志、版本、调试路径等系统级命令。
use crate::{log_info, log_error};

/// 获取日志文件路径
#[tauri::command]
#[specta::specta]
pub async fn get_log_file_path() -> Result<String, String> {
    crate::logger::Logger::get_log_path()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "日志文件路径未初始化".to_string())
}

/// 获取日志配置
#[tauri::command]
#[specta::specta]
pub async fn get_log_config() -> Result<serde_json::Value, String> {
    let (max_size_mb, log_file_name) = crate::logger::get_log_config();
    Ok(serde_json::json!({
        "max_size_mb": max_size_mb,
        "log_file_name": log_file_name,
    }))
}

/// 获取应用版本
#[tauri::command]
#[specta::specta]
pub async fn get_app_version(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

/// 获取预设标签
#[tauri::command]
#[specta::specta]
pub async fn get_preset_tags() -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("preset_tags.json");
    if !path.exists() {
        return Ok(serde_json::json!({"success": true, "tags": []}));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let tags: Vec<String> = serde_json::from_str(&content).unwrap_or_default();
    Ok(serde_json::json!({"success": true, "tags": tags}))
}

/// 保存预设标签
#[tauri::command]
#[specta::specta]
pub async fn save_preset_tags(tags: Vec<String>) -> Result<serde_json::Value, String> {
    let path = crate::get_data_dir()?.join("preset_tags.json");
    let content = serde_json::to_string_pretty(&tags).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"success": true}))
}

/// 测试日志
#[tauri::command]
#[specta::specta]
pub async fn test_logging() -> Result<String, String> {
    log_info!("=== 日志记录功能测试 ===");
    Ok("日志测试完成".to_string())
}

/// 打开日志文件
#[tauri::command]
#[specta::specta]
pub async fn open_log_file() -> Result<String, String> {
    let log_path = crate::logger::Logger::get_log_path()
        .ok_or("日志路径未初始化")?;

    if !log_path.exists() {
        return Err("日志文件不存在".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("notepad")
            .arg(&log_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&log_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&log_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(log_path.to_string_lossy().to_string())
}

/// 打开日志目录
#[tauri::command]
#[specta::specta]
pub async fn open_log_directory() -> Result<String, String> {
    let log_path = crate::logger::Logger::get_log_path()
        .ok_or("日志路径未初始化")?;

    let log_dir = log_path.parent()
        .ok_or("无法获取日志目录")?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(log_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(log_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(log_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(log_dir.to_string_lossy().to_string())
}

/// 打开更新 URL
#[tauri::command]
#[specta::specta]
pub async fn open_update_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/c", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 自动获取 Token
#[tauri::command]
#[specta::specta]
pub async fn get_token_auto(
    auth: tauri::State<'_, crate::services::auth_service::AuthService>,
) -> Result<crate::domain::auth::TokenInfo, String> {
    auth.get_token().map_err(|e| e.to_string())
}

/// 校验用户授权
///
/// 通过请求 Cursor API 判断 Token 是否有效。
#[tauri::command]
#[specta::specta]
pub async fn check_user_authorization(token: String) -> Result<crate::domain::auth::AuthCheckResult, String> {
    let client = reqwest::Client::new();
    let clean_token = crate::infra::api::checksum::TokenParser::extract_token_part(&token);

    let resp = client
        .get("https://api2.cursor.sh/auth/full_stripe_profile")
        .header("Authorization", format!("Bearer {}", clean_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if status == 200 {
        let data: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::json!(null));

        // 从 Stripe profile 响应中解析订阅信息
        // 响应结构: { customer: { email }, subscription: { membershipType, status }, trialDaysRemaining }
        let customer_email = data.get("customer")
            .and_then(|c| c.get("email"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let subscription = data.get("subscription");
        let subscription_type = subscription
            .and_then(|s| s.get("membershipType"))
            .or(data.get("membershipType"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let subscription_status = subscription
            .and_then(|s| s.get("status"))
            .or(data.get("subscriptionStatus"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let trial_days = data.get("trialDaysRemaining")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);

        let email = customer_email.or_else(|| {
            data.get("email").and_then(|v| v.as_str()).map(|s| s.to_string())
        });

        let user_info = crate::domain::auth::UserAuthInfo {
            is_authorized: true,
            token_length: clean_token.len(),
            token_valid: true,
            api_status: Some(status),
            error_message: None,
            checksum: None,
            account_info: Some(crate::domain::auth::AuthAccountInfo {
                email,
                username: data.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()),
                subscription_type,
                subscription_status,
                trial_days_remaining: trial_days,
                usage_info: None,
                aggregated_usage: None,
            }),
        };

        Ok(crate::domain::auth::AuthCheckResult {
            success: true,
            user_info: Some(user_info),
            message: "授权校验成功".to_string(),
            details: vec![],
        })
    } else {
        Ok(crate::domain::auth::AuthCheckResult {
            success: false,
            user_info: Some(crate::domain::auth::UserAuthInfo {
                is_authorized: false,
                token_length: clean_token.len(),
                token_valid: false,
                api_status: Some(status),
                error_message: Some(text),
                checksum: None,
                account_info: None,
            }),
            message: format!("授权失败 (HTTP {})", status),
            details: vec![],
        })
    }
}

/// 获取用户信息
///
/// 综合获取用户的认证状态、订阅信息和用量数据。
#[tauri::command]
#[specta::specta]
pub async fn get_user_info(token: String) -> Result<crate::domain::auth::AuthCheckResult, String> {
    check_user_authorization(token).await
}

/// 获取关闭行为配置
#[tauri::command]
#[specta::specta]
pub async fn get_close_behavior() -> Result<serde_json::Value, String> {
    let minimize = crate::MINIMIZE_TO_TRAY.load(std::sync::atomic::Ordering::SeqCst);
    Ok(serde_json::json!({"minimize_to_tray": minimize}))
}

/// 设置关闭行为
#[tauri::command]
#[specta::specta]
pub async fn set_close_behavior(minimize_to_tray: bool) -> Result<serde_json::Value, String> {
    crate::MINIMIZE_TO_TRAY.store(minimize_to_tray, std::sync::atomic::Ordering::SeqCst);

    let data_dir = crate::get_data_dir()?;
    let config_store = crate::infra::store::ConfigStore::new(&std::path::PathBuf::from(data_dir));
    let mut config = config_store.read();
    config["minimize_to_tray"] = serde_json::json!(minimize_to_tray);
    config_store.write(&config).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "message": if minimize_to_tray { "关闭时最小化到托盘" } else { "关闭时直接退出" }
    }))
}

/// 获取 auth/me 信息
///
/// 使用 WorkOS Session Token 查询 /api/auth/me。
#[tauri::command]
#[specta::specta]
pub async fn get_auth_me(session_token: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let cookie = crate::infra::api::CursorApiClient::build_workos_cookie(&session_token);

    let resp = client
        .get("https://www.cursor.com/api/auth/me")
        .header("Cookie", &cookie)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if status == 200 {
        let data: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::json!(null));
        Ok(serde_json::json!({"success": true, "data": data}))
    } else {
        Ok(serde_json::json!({"success": false, "status": status, "message": text}))
    }
}
