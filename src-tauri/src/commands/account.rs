/// 账号管理命令入口
///
/// 使用新架构 services::AccountService 处理业务逻辑。
use crate::domain::account::*;
use crate::services::account_service::AccountService;
use crate::{log_info, log_error};
use tauri::State;

#[cfg(target_os = "windows")]
use rusqlite::{params, Connection};


/// 获取当前账号
#[tauri::command]
#[specta::specta]
pub async fn get_current_account(
    service: State<'_, AccountService>,
) -> Result<Option<AccountInfo>, String> {
    service.get_current()
        .map_err(|e| e.to_string())
}

/// 获取账号列表
#[tauri::command]
#[specta::specta]
pub async fn get_account_list(
    service: State<'_, AccountService>,
) -> Result<AccountListResult, String> {
    service.list_all()
        .map_err(|e| e.to_string())
}

/// 切换账号
#[tauri::command]
#[specta::specta]
pub async fn switch_account(
    service: State<'_, AccountService>,
    email: String,
) -> Result<SwitchAccountResult, String> {
    service.switch(&email)
        .map_err(|e| e.to_string())
}

/// 删除账号
#[tauri::command]
#[specta::specta]
pub async fn remove_account(
    service: State<'_, AccountService>,
    email: String,
) -> Result<serde_json::Value, String> {
    service.remove(&email)
        .map(|_| serde_json::json!({"success": true, "message": format!("已删除 {}", email)}))
        .map_err(|e| e.to_string())
}

/// 登出当前账号
#[tauri::command]
#[specta::specta]
pub async fn logout_current_account(
    service: State<'_, AccountService>,
) -> Result<LogoutResult, String> {
    service.logout()
        .map_err(|e| e.to_string())
}

/// 导出账号
#[tauri::command]
#[specta::specta]
pub async fn export_accounts(
    service: State<'_, AccountService>,
    export_path: String,
    selected_emails: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    service.export(&export_path, selected_emails)
        .map_err(|e| e.to_string())
}

/// 导入账号
#[tauri::command]
#[specta::specta]
pub async fn import_accounts(
    service: State<'_, AccountService>,
    import_file_path: String,
) -> Result<serde_json::Value, String> {
    service.import(&import_file_path)
        .map_err(|e| e.to_string())
}

/// 检查管理员权限
#[tauri::command]
#[specta::specta]
pub async fn check_admin_privileges() -> Result<bool, String> {
    let platform = crate::infra::platform::create();
    Ok(platform.is_admin())
}

/// 添加账号
#[tauri::command]
#[specta::specta]
pub async fn add_account(
    service: State<'_, AccountService>,
    email: String,
    token: String,
    refresh_token: Option<String>,
    workos_cursor_session_token: Option<String>,
    username: Option<String>,
    tags: Option<Vec<String>>,
    machine_ids_json: Option<String>,
) -> Result<serde_json::Value, String> {
    let machine_ids = machine_ids_json
        .and_then(|json| serde_json::from_str(&json).ok())
        .or_else(|| service.cursor().read_full_machine_ids().ok());

    let account = AccountInfo {
        email: email.clone(),
        token,
        refresh_token,
        workos_cursor_session_token,
        is_current: false,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        username,
        tags: tags.unwrap_or_default(),
        machine_ids,
        subscription_type: None,
        subscription_status: None,
        trial_days_remaining: None,
        name: None,
        sub: None,
        picture: None,
        user_id: None,
    };

    service.add(account)
        .map(|_| serde_json::json!({"success": true, "message": format!("账号 {} 添加成功", email)}))
        .map_err(|e| e.to_string())
}

/// 编辑账号
#[tauri::command]
#[specta::specta]
pub async fn edit_account(
    service: State<'_, AccountService>,
    email: String,
    new_email: Option<String>,
    new_token: Option<String>,
    new_refresh_token: Option<String>,
    new_workos_cursor_session_token: Option<String>,
    new_username: Option<String>,
    new_tags: Option<Vec<String>>,
    new_machine_ids: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let mut accounts = service.store().load_all().map_err(|e| e.to_string())?;

    if let Some(acc) = accounts.iter_mut().find(|a| a.email == email) {
        if let Some(ne) = new_email { acc.email = ne; }
        if let Some(nt) = new_token { acc.token = nt; }
        if let Some(nr) = new_refresh_token { acc.refresh_token = Some(nr); }
        if let Some(nw) = new_workos_cursor_session_token { acc.workos_cursor_session_token = Some(nw); }
        if let Some(nu) = new_username { acc.username = Some(nu); }
        if let Some(nt) = new_tags { acc.tags = nt; }
        if let Some(nm) = new_machine_ids {
            acc.machine_ids = serde_json::from_value(nm).ok();
        }
        service.store().save_all(&accounts).map_err(|e| e.to_string())?;
        Ok(serde_json::json!({"success": true, "message": "账号编辑成功"}))
    } else {
        Ok(serde_json::json!({"success": false, "message": format!("账号 {} 不存在", email)}))
    }
}

/// 带选项切换账号
///
/// 根据选项处理机器码：
/// - use_bound_machine_id=true：恢复账号绑定的机器码到所有存储位置
/// - reset_machine_id=true：生成新机器码并写入所有存储位置，同时更新账号绑定
/// - 都为 false：保持当前机器码不变
///
/// 执行顺序：关闭 Cursor → 写入机器码 → 注入认证信息
#[tauri::command]
#[specta::specta]
pub async fn switch_account_with_options(
    service: State<'_, AccountService>,
    email: String,
    reset_machine_id: bool,
    use_bound_machine_id: bool,
) -> Result<SwitchAccountResult, String> {
    let cursor = service.cursor();

    // 先关闭 Cursor（避免 SQLite 锁定、storage.json 被回写覆盖）
    let process = cursor.process();
    if process.is_running() {
        process.force_close();
    }

    if use_bound_machine_id {
        let accounts = service.store().load_all().map_err(|e| e.to_string())?;
        if let Some(account) = accounts.iter().find(|a| a.email == email) {
            if let Some(ref ids) = account.machine_ids {
                let _ = cursor.storage().write_machine_ids(ids);
                let _ = cursor.sqlite().update_service_machine_id(&ids.service_machine_id);
                let platform = crate::infra::platform::create();
                let _ = platform.update_system_ids(ids);
            }
        }
    } else if reset_machine_id {
        let new_ids = crate::domain::identity::MachineIds::generate();
        let _ = cursor.storage().write_machine_ids(&new_ids);
        let _ = cursor.sqlite().update_service_machine_id(&new_ids.service_machine_id);
        let platform = crate::infra::platform::create();
        let _ = platform.update_system_ids(&new_ids);

        // 将新生成的机器码保存到该账号的绑定数据（含系统注册表值）
        let mut accounts = service.store().load_all().map_err(|e| e.to_string())?;
        if let Some(acc) = accounts.iter_mut().find(|a| a.email == email) {
            let mut bound_ids = new_ids;
            let (guid, sqm) = crate::infra::platform::read_registry_ids();
            bound_ids.machine_guid = guid;
            bound_ids.sqm_client_id = sqm;
            acc.machine_ids = Some(bound_ids);
            let _ = service.store().save_all(&accounts);
        }
    }

    // switch 内部会再次检测 Cursor 进程，已关闭则自动跳过
    service.switch(&email).map_err(|e| e.to_string())
}

/// 使用 token 直接切换（无缝切号场景）
#[tauri::command]
#[specta::specta]
pub async fn switch_account_with_token(
    service: State<'_, AccountService>,
    email: String,
    token: String,
    auth_type: Option<String>,
) -> Result<SwitchAccountResult, String> {
    let cursor = service.cursor();
    let clean_token = crate::infra::api::checksum::TokenParser::extract_token_part(&token);

    let _ = cursor.storage().write_auth(&email, &clean_token);
    let _ = cursor.sqlite().inject_email(&email);
    let _ = cursor.sqlite().inject_token(&clean_token);

    Ok(SwitchAccountResult {
        success: true,
        message: format!("已通过 Token 切换至 {}", email),
        details: vec!["Token 直接注入完成".to_string()],
    })
}

/// 刷新单个账号信息（通过 Token 查询授权 + 订阅状态）
///
/// 返回完整的 AuthCheckResult，与前端 configService.refreshSingleAccountInfo 对接。
#[tauri::command]
#[specta::specta]
pub async fn refresh_single_account_info(token: String) -> Result<serde_json::Value, String> {
    match crate::commands::system::check_user_authorization(token).await {
        Ok(result) => Ok(serde_json::json!(result)),
        Err(e) => Err(format!("获取账户信息失败: {}", e)),
    }
}

/// 批量刷新账号信息
#[tauri::command]
#[specta::specta]
pub async fn refresh_all_accounts_info(tokens: Vec<String>) -> Result<serde_json::Value, String> {
    let mut results = Vec::new();

    for token in &tokens {
        match crate::commands::system::check_user_authorization(token.clone()).await {
            Ok(result) => {
                results.push(serde_json::json!({
                    "token": token,
                    "success": result.success,
                    "user_info": result.user_info
                }));
            }
            Err(e) => {
                results.push(serde_json::json!({
                    "token": token,
                    "success": false,
                    "error": e.to_string()
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "results": results,
        "total": tokens.len()
    }))
}

/// 获取已保存账号列表（原始 JSON）
#[tauri::command]
#[specta::specta]
pub async fn get_saved_accounts() -> Result<Vec<serde_json::Value>, String> {
    let path = crate::get_data_dir()?.join("account_cache.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let accounts: Vec<serde_json::Value> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(accounts)
}

/// 列出 Windows 用户
#[tauri::command]
#[specta::specta]
pub async fn list_windows_users() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        let users_dir = std::path::PathBuf::from("C:\\Users");
        if !users_dir.exists() {
            return Ok(serde_json::json!({"success": false, "message": "C:\\Users 不存在"}));
        }

        let current_user = std::env::var("USERNAME").unwrap_or_default();
        let mut users = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&users_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let skip = ["Public", "Default", "Default User", "All Users", "desktop.ini"];
                if skip.contains(&name.as_str()) { continue; }

                if entry.path().is_dir() {
                    let cursor_dir = entry.path().join("AppData").join("Roaming").join("Cursor");
                    users.push(serde_json::json!({
                        "username": name,
                        "is_current": name == current_user,
                        "has_cursor": cursor_dir.exists(),
                        "path": entry.path().to_string_lossy(),
                    }));
                }
            }
        }

        Ok(serde_json::json!({"success": true, "users": users}))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(serde_json::json!({"success": false, "message": "仅 Windows 支持"}))
    }
}

/// 同步账号到其他 Windows 用户
#[tauri::command]
#[specta::specta]
pub async fn sync_account_to_user(target_username: String) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        fn upsert_sqlite_value(conn: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
            conn.execute(
                "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
            Ok(())
        }

        let current_username = std::env::var("USERNAME").unwrap_or_default();
        if target_username.eq_ignore_ascii_case(&current_username) {
            return Ok(serde_json::json!({
                "success": false,
                "message": "不能同步到当前登录用户自身"
            }));
        }

        let source_appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
        let source_cursor_dir = std::path::PathBuf::from(&source_appdata).join("Cursor");
        let source_global_storage = source_cursor_dir.join("User").join("globalStorage");
        let source_storage = source_global_storage.join("storage.json");
        let source_sqlite = source_global_storage.join("state.vscdb");

        if !source_storage.exists() {
            return Ok(serde_json::json!({"success": false, "message": "源 storage.json 不存在"}));
        }

        let cursor = crate::infra::cursor::CursorBridge::new(None).map_err(|e| e.to_string())?;
        let process = cursor.process();
        let mut details = Vec::new();
        if process.is_running() {
            if process.force_close() {
                details.push("已关闭所有 Cursor 进程".to_string());
            } else {
                details.push("警告：关闭 Cursor 进程失败，部分文件可能被占用".to_string());
            }
        } else {
            details.push("Cursor 当前未运行".to_string());
        }

        let target_user_dir = std::path::PathBuf::from("C:\\Users").join(&target_username);
        if !target_user_dir.exists() {
            return Ok(serde_json::json!({
                "success": false,
                "message": format!("目标用户目录不存在: {}", target_user_dir.to_string_lossy())
            }));
        }

        let target_cursor_dir = target_user_dir.join("AppData").join("Roaming").join("Cursor");
        let target_global_storage = target_cursor_dir.join("User").join("globalStorage");
        std::fs::create_dir_all(&target_global_storage).map_err(|e| e.to_string())?;

        let machine_ids = cursor.read_full_machine_ids().map_err(|e| e.to_string())?;

        let mut target_storage_data = if target_global_storage.join("storage.json").exists() {
            let content = std::fs::read_to_string(target_global_storage.join("storage.json")).map_err(|e| e.to_string())?;
            serde_json::from_str::<serde_json::Value>(&content).unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        if let Some(obj) = target_storage_data.as_object_mut() {
            obj.insert("telemetry.devDeviceId".to_string(), serde_json::json!(machine_ids.dev_device_id));
            obj.insert("telemetry.macMachineId".to_string(), serde_json::json!(machine_ids.mac_machine_id));
            obj.insert("telemetry.machineId".to_string(), serde_json::json!(machine_ids.machine_id));
            obj.insert("telemetry.sqmId".to_string(), serde_json::json!(machine_ids.sqm_id));
            obj.insert("storage.serviceMachineId".to_string(), serde_json::json!(machine_ids.service_machine_id));
            if let Some(machine_guid) = &machine_ids.machine_guid {
                obj.insert("system.machineGuid".to_string(), serde_json::json!(machine_guid));
            }
            if let Some(sqm_client_id) = &machine_ids.sqm_client_id {
                obj.insert("system.sqmClientId".to_string(), serde_json::json!(sqm_client_id));
            }
        }

        let target_storage = target_global_storage.join("storage.json");
        std::fs::write(
            &target_storage,
            serde_json::to_string_pretty(&target_storage_data).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        details.push("已同步 storage.json 中的机器码字段".to_string());

        let source_email = cursor.storage().read_email().map_err(|e| e.to_string())?.unwrap_or_default();
        let source_token = cursor.storage().read_token().map_err(|e| e.to_string())?.unwrap_or_default();

        if source_email.is_empty() || source_token.is_empty() {
            return Ok(serde_json::json!({
                "success": false,
                "message": "未读取到当前 Cursor 登录的账号或 Token"
            }));
        }

        let auth_keys = [
            "cursorAuth/accessToken",
            "cursorAuth/refreshToken",
            "cursorAuth/cachedEmail",
            "cursorAuth/userId",
            "cursorAuth/cachedSignUpType",
            "cursorAuth/stripeMembershipType",
            "cursorAuth/stripeSubscriptionStatus",
            "cursorai/donotchange/newPrivacyMode2",
            "cursorai/donotchange/privacyMode",
            "cursorai/donotchange/partnerDataShare",
            "cursorai/donotchange/hasReconciledNewPrivacyModeWithServerOnUpgrade",
            "cursorai/donotchange/newPrivacyModeHoursRemainingInGracePeriod",
            "storage.serviceMachineId",
            "cursorai/featureConfigCache",
            "cursorai/serverConfig",
            "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
            "adminSettings.cached",
            "autorun.cachedAdminSettings",
            "cursor.email",
            "cursor.accessToken",
        ];

        let mut auth_values = std::collections::HashMap::new();
        if source_sqlite.exists() {
            let source_conn = Connection::open(&source_sqlite).map_err(|e| e.to_string())?;
            for key in auth_keys {
                let value = source_conn.query_row(
                    "SELECT value FROM ItemTable WHERE key = ?1",
                    params![key],
                    |row| row.get::<_, String>(0),
                );
                if let Ok(v) = value {
                    auth_values.insert(key.to_string(), v);
                }
            }
        }

        auth_values.insert("cursorAuth/cachedEmail".to_string(), source_email.clone());
        auth_values.insert("cursor.email".to_string(), source_email.clone());
        auth_values.insert("cursorAuth/accessToken".to_string(), source_token.clone());
        auth_values.insert("cursorAuth/refreshToken".to_string(), source_token.clone());
        auth_values.insert("cursor.accessToken".to_string(), source_token.clone());
        auth_values.entry("cursorAuth/cachedSignUpType".to_string()).or_insert_with(|| "Auth_0".to_string());
        auth_values.insert("storage.serviceMachineId".to_string(), machine_ids.service_machine_id.clone());

        let target_sqlite = target_global_storage.join("state.vscdb");
        if target_sqlite.exists() {
            let conn = Connection::open(&target_sqlite).map_err(|e| e.to_string())?;

            for (key, value) in auth_values {
                upsert_sqlite_value(&conn, &key, &value).map_err(|e| e.to_string())?;
            }

            details.push("已按参考脚本同步 state.vscdb 中的认证与账号字段".to_string());
        } else {
            details.push("目标用户不存在 state.vscdb，已跳过认证信息注入".to_string());
        }

        crate::log_info!("已同步到用户: {}", target_username);
        Ok(serde_json::json!({
            "success": true,
            "message": format!("已将当前账号与机器码同步到 {}", target_username),
            "details": details,
            "target_storage": target_storage,
            "target_sqlite": target_sqlite
        }))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(serde_json::json!({"success": false, "message": "仅 Windows 支持"}))
    }
}
