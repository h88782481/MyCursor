/// Machine ID 相关命令入口
///
/// 使用新架构 services::IdentityService 处理所有业务逻辑。
use crate::domain::identity::*;
use crate::services::identity_service::IdentityService;
use crate::{log_info, log_error};
use tauri::State;

/// 获取当前 Machine ID
#[tauri::command]
#[specta::specta]
pub async fn get_current_machine_ids(
    service: State<'_, IdentityService>,
) -> Result<Option<MachineIds>, String> {
    service.read_current()
        .map(|ids| Some(ids))
        .map_err(|e| e.to_string())
}

/// 获取可用备份列表
#[tauri::command]
#[specta::specta]
pub async fn get_available_backups(
    service: State<'_, IdentityService>,
) -> Result<Vec<BackupInfo>, String> {
    service.list_backups()
        .map_err(|e| e.to_string())
}

/// 从备份提取 Machine ID
#[tauri::command]
#[specta::specta]
pub async fn extract_backup_ids(
    service: State<'_, IdentityService>,
    backup_path: String,
) -> Result<MachineIds, String> {
    service.extract_ids_from_backup(&backup_path)
        .map_err(|e| e.to_string())
}

/// 删除备份文件
#[tauri::command]
#[specta::specta]
pub async fn delete_backup(backup_path: String) -> Result<serde_json::Value, String> {
    match std::fs::remove_file(&backup_path) {
        Ok(_) => {
            log_info!("成功删除备份文件: {}", backup_path);
            Ok(serde_json::json!({"success": true, "message": "备份文件删除成功"}))
        }
        Err(e) => {
            log_error!("删除备份文件失败: {}", e);
            Ok(serde_json::json!({"success": false, "message": format!("删除失败: {}", e)}))
        }
    }
}

/// 恢复 Machine ID
#[tauri::command]
#[specta::specta]
pub async fn restore_machine_ids(
    service: State<'_, IdentityService>,
    backup_path: String,
) -> Result<RestoreResult, String> {
    service.restore_from_backup(&backup_path)
        .map_err(|e| e.to_string())
}

/// 重置 Machine ID
#[tauri::command]
#[specta::specta]
pub async fn reset_machine_ids(
    service: State<'_, IdentityService>,
) -> Result<ResetResult, String> {
    service.reset()
        .map_err(|e| e.to_string())
}

/// 获取 Cursor 路径
#[tauri::command]
#[specta::specta]
pub async fn get_cursor_paths(
    service: State<'_, IdentityService>,
) -> Result<(String, String), String> {
    Ok(service.get_cursor_paths())
}

/// 检查 Cursor 安装
#[tauri::command]
#[specta::specta]
pub async fn check_cursor_installation(
    service: State<'_, IdentityService>,
) -> Result<bool, String> {
    Ok(service.check_installation())
}

/// 设置自定义 Cursor 路径
#[tauri::command]
#[specta::specta]
pub async fn set_custom_cursor_path(
    service: State<'_, IdentityService>,
    path: String,
) -> Result<String, String> {
    service.set_custom_path(&path)
        .map_err(|e| e.to_string())
}

/// 获取自定义 Cursor 路径
#[tauri::command]
#[specta::specta]
pub async fn get_custom_cursor_path(
    service: State<'_, IdentityService>,
) -> Result<Option<String>, String> {
    Ok(service.get_custom_path())
}

/// 清除自定义 Cursor 路径
#[tauri::command]
#[specta::specta]
pub async fn clear_custom_cursor_path(
    service: State<'_, IdentityService>,
) -> Result<String, String> {
    service.clear_custom_path()
        .map_err(|e| e.to_string())
}

/// 完全重置（重置 ID + 修改 main.js + workbench.js）
///
/// 除了重置 Machine ID，还修补 main.js 中的 getMachineId 函数
/// 使其不再返回硬编码的原始 ID。
#[tauri::command]
#[specta::specta]
pub async fn complete_cursor_reset(
    service: State<'_, IdentityService>,
) -> Result<ResetResult, String> {
    let mut result = service.reset().map_err(|e| e.to_string())?;

    // 修改 main.js（不再额外生成散落备份文件，统一依赖结构化 backup）
    if let Some(main_js) = &service.cursor().paths.main_js {
        if main_js.exists() {
            match modify_main_js(main_js) {
                Ok(_) => result.details.push("main.js 已修补".to_string()),
                Err(e) => result.details.push(format!("main.js 修补失败: {}", e)),
            }
        }
    }

    Ok(result)
}

/// 修改 main.js，移除 getMachineId/getMacMachineId 的硬编码返回
fn modify_main_js(path: &std::path::Path) -> Result<(), String> {
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;

    let patterns = vec![
        (
            regex::Regex::new(r"async getMachineId\(\)\{return [^??]+\?\?([^}]+)\}").unwrap(),
            "async getMachineId(){return $1}",
        ),
        (
            regex::Regex::new(r"async getMacMachineId\(\)\{return [^??]+\?\?([^}]+)\}").unwrap(),
            "async getMacMachineId(){return $1}",
        ),
    ];

    let mut modified = content.clone();
    for (re, replacement) in &patterns {
        modified = re.replace_all(&modified, *replacement).to_string();
    }

    std::fs::write(path, &modified).map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取 machineId 文件内容
#[tauri::command]
#[specta::specta]
pub async fn get_machine_id_file_content() -> Result<Option<String>, String> {
    let machine_id_path = {
        #[cfg(target_os = "windows")]
        {
            let appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
            std::path::PathBuf::from(appdata).join("Cursor").join("machineId")
        }
        #[cfg(target_os = "macos")]
        {
            dirs::home_dir().ok_or("无法获取 home 目录".to_string())?
                .join("Library/Application Support/Cursor/machineId")
        }
        #[cfg(target_os = "linux")]
        {
            dirs::home_dir().ok_or("无法获取 home 目录".to_string())?
                .join(".config/Cursor/machineId")
        }
    };

    if machine_id_path.exists() {
        let content = std::fs::read_to_string(&machine_id_path).map_err(|e| e.to_string())?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

/// 获取备份目录信息
#[tauri::command]
#[specta::specta]
pub async fn get_backup_directory_info(
    _service: State<'_, IdentityService>,
) -> Result<(String, Vec<String>), String> {
    let data_dir = crate::get_data_dir()?;
    let dir = data_dir.join("backup");
    let dir_str = dir.to_string_lossy().to_string();

    let files = if dir.exists() {
        std::fs::read_dir(&dir)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect()
    } else {
        Vec::new()
    };

    Ok((dir_str, files))
}

/// 获取自动更新状态
#[tauri::command]
#[specta::specta]
pub async fn get_auto_update_status() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        let updater_path = get_cursor_updater_target_path()?;
        let updater_blocked = updater_path.is_file();
        let updater_exists = updater_path.exists() || updater_path.with_extension("bak").exists();
        let yml_blocked = get_app_update_yml_path()
            .map(|p| p.exists() && std::fs::metadata(&p).map(|m| m.len() == 0).unwrap_or(false))
            .unwrap_or(false);

        Ok(serde_json::json!({
            "disabled": updater_blocked || yml_blocked,
            "path": updater_path.to_string_lossy(),
            "exists": updater_exists,
            "updater_blocked": updater_blocked,
            "yml_blocked": yml_blocked,
        }))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let cache_blocked = get_cursor_updater_cache_path()
            .map(|p| p.is_file())
            .unwrap_or(false);
        let yml_blocked = get_app_update_yml_path()
            .map(|p| p.exists() && std::fs::metadata(&p).map(|m| m.len() == 0).unwrap_or(false))
            .unwrap_or(false);
        let updater_path = get_cursor_updater_path()?;
        let updater_disabled = !updater_path.exists() && updater_path.with_extension("disabled").exists();

        Ok(serde_json::json!({
            "disabled": cache_blocked || yml_blocked || updater_disabled,
            "path": updater_path.to_string_lossy(),
            "exists": updater_path.exists(),
            "cache_blocked": cache_blocked,
            "yml_blocked": yml_blocked,
        }))
    }
}

/// 禁用自动更新
#[tauri::command]
#[specta::specta]
pub async fn disable_auto_update() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        let updater_path = get_cursor_updater_target_path()?;
        let updater_backup_path = updater_path.with_extension("bak");
        let mut details = Vec::new();

        // 步骤 1: cursor-updater 目录 → 备份后用只读空文件占位
        if updater_path.is_dir() {
            if updater_backup_path.exists() {
                if updater_backup_path.is_dir() {
                    std::fs::remove_dir_all(&updater_backup_path).map_err(|e| e.to_string())?;
                } else {
                    std::fs::remove_file(&updater_backup_path).map_err(|e| e.to_string())?;
                }
            }
            std::fs::rename(&updater_path, &updater_backup_path).map_err(|e| e.to_string())?;
            details.push(format!("已备份更新器目录: {}", updater_backup_path.display()));
        }

        if !updater_path.exists() {
            std::fs::write(&updater_path, b"").map_err(|e| e.to_string())?;
            details.push(format!("已创建更新器占位文件: {}", updater_path.display()));
        }
        set_readonly(&updater_path, true, &mut details);

        // 步骤 2: app-update.yml → 备份后替换为只读空文件
        if let Ok(yml_path) = get_app_update_yml_path() {
            if yml_path.exists() && std::fs::metadata(&yml_path).map(|m| m.len() > 0).unwrap_or(false) {
                let bak = yml_path.with_extension("yml.bak");
                if !bak.exists() {
                    let _ = std::fs::copy(&yml_path, &bak);
                    details.push(format!("已备份 app-update.yml: {}", bak.display()));
                }
                let _ = std::fs::write(&yml_path, b"");
                details.push(format!("已清空 app-update.yml: {}", yml_path.display()));
            }
            set_readonly(&yml_path, true, &mut details);
        }

        log_info!("已禁用自动更新");
        Ok(serde_json::json!({
            "success": true,
            "message": "已禁用自动更新",
            "details": details,
        }))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut details = Vec::new();

        // 步骤 1: cursor-updater 目录/文件处理
        if let Ok(cache_path) = get_cursor_updater_cache_path() {
            if cache_path.is_dir() {
                let _ = std::fs::remove_dir_all(&cache_path);
            }
            if !cache_path.exists() {
                let _ = std::fs::write(&cache_path, b"");
                details.push(format!("已创建更新器占位文件: {}", cache_path.display()));
            }
            set_readonly(&cache_path, true, &mut details);
        }

        // 步骤 2: app-update.yml 处理
        if let Ok(yml_path) = get_app_update_yml_path() {
            if yml_path.exists() && std::fs::metadata(&yml_path).map(|m| m.len() > 0).unwrap_or(false) {
                let bak = yml_path.with_extension("yml.bak");
                if !bak.exists() {
                    let _ = std::fs::copy(&yml_path, &bak);
                    details.push(format!("已备份 app-update.yml: {}", bak.display()));
                }
                let _ = std::fs::write(&yml_path, b"");
                details.push(format!("已清空 app-update.yml: {}", yml_path.display()));
            }
            set_readonly(&yml_path, true, &mut details);
        }

        // 步骤 3: 旧版 cursor-updater 可执行文件（兼容）
        let updater_path = get_cursor_updater_path()?;
        if updater_path.exists() {
            let disabled_path = updater_path.with_extension("disabled");
            std::fs::rename(&updater_path, &disabled_path).map_err(|e| e.to_string())?;
            details.push(format!("已禁用更新器: {}", disabled_path.display()));
        }

        log_info!("已禁用自动更新");
        Ok(serde_json::json!({"success": true, "message": "已禁用自动更新", "details": details}))
    }
}

/// 启用自动更新
#[tauri::command]
#[specta::specta]
pub async fn enable_auto_update() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        let updater_path = get_cursor_updater_target_path()?;
        let updater_backup_path = updater_path.with_extension("bak");
        let mut details = Vec::new();

        // 恢复 cursor-updater 目录
        set_readonly(&updater_path, false, &mut details);
        if updater_path.is_file() {
            std::fs::remove_file(&updater_path).map_err(|e| e.to_string())?;
            details.push(format!("已移除更新器占位文件: {}", updater_path.display()));
        }
        if updater_backup_path.exists() {
            std::fs::rename(&updater_backup_path, &updater_path).map_err(|e| e.to_string())?;
            details.push(format!("已恢复更新器目录: {}", updater_path.display()));
        }

        // 恢复 app-update.yml
        if let Ok(yml_path) = get_app_update_yml_path() {
            set_readonly(&yml_path, false, &mut details);
            let bak = yml_path.with_extension("yml.bak");
            if bak.exists() {
                let _ = std::fs::copy(&bak, &yml_path);
                let _ = std::fs::remove_file(&bak);
                details.push(format!("已恢复 app-update.yml: {}", yml_path.display()));
            }
        }

        log_info!("已启用自动更新");
        Ok(serde_json::json!({
            "success": true,
            "message": "已启用自动更新",
            "details": details,
        }))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut details = Vec::new();

        // 恢复 cursor-updater 缓存目录
        if let Ok(cache_path) = get_cursor_updater_cache_path() {
            set_readonly(&cache_path, false, &mut details);
            if cache_path.is_file() {
                let _ = std::fs::remove_file(&cache_path);
                details.push(format!("已移除更新器占位文件: {}", cache_path.display()));
            }
        }

        // 恢复 app-update.yml
        if let Ok(yml_path) = get_app_update_yml_path() {
            set_readonly(&yml_path, false, &mut details);
            let bak = yml_path.with_extension("yml.bak");
            if bak.exists() {
                let _ = std::fs::copy(&bak, &yml_path);
                let _ = std::fs::remove_file(&bak);
                details.push(format!("已恢复 app-update.yml: {}", yml_path.display()));
            }
        }

        // 恢复旧版更新器可执行文件
        let updater_path = get_cursor_updater_path()?;
        let disabled_path = updater_path.with_extension("disabled");
        if disabled_path.exists() {
            std::fs::rename(&disabled_path, &updater_path).map_err(|e| e.to_string())?;
            details.push(format!("已恢复更新器: {}", updater_path.display()));
        }

        log_info!("已启用自动更新");
        Ok(serde_json::json!({"success": true, "message": "已启用自动更新", "details": details}))
    }
}

/// 调试 Cursor 路径
#[tauri::command]
#[specta::specta]
pub async fn debug_cursor_paths(
    service: State<'_, IdentityService>,
) -> Result<Vec<String>, String> {
    let (storage, sqlite) = service.get_cursor_paths();
    Ok(vec![
        format!("storage.json: {}", storage),
        format!("state.vscdb: {}", sqlite),
        format!("storage.json 存在: {}", std::path::Path::new(&storage).exists()),
        format!("state.vscdb 存在: {}", std::path::Path::new(&sqlite).exists()),
    ])
}

/// 调试 Windows Cursor 路径
#[tauri::command]
#[specta::specta]
pub async fn debug_windows_cursor_paths() -> Result<Vec<String>, String> {
    let mut info = Vec::new();
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "未设置".to_string());
        info.push(format!("LOCALAPPDATA: {}", localappdata));
    }
    #[cfg(not(target_os = "windows"))]
    {
        info.push("此功能仅在 Windows 上可用".to_string());
    }
    Ok(info)
}

/// 获取 Windows 上的 cursor-updater 目标路径（目录/占位文件同名）
#[cfg(target_os = "windows")]
fn get_cursor_updater_target_path() -> Result<std::path::PathBuf, String> {
    let localappdata = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
    Ok(std::path::PathBuf::from(localappdata).join("cursor-updater"))
}

/// 获取 cursor-updater 缓存路径（macOS/Linux）
#[cfg(not(target_os = "windows"))]
fn get_cursor_updater_cache_path() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        Ok(std::path::PathBuf::from(home).join("Library/Caches/cursor-updater"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        Ok(std::path::PathBuf::from(home).join(".cache/cursor-updater"))
    }
}

/// 获取 app-update.yml 路径
fn get_app_update_yml_path() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
        Ok(std::path::PathBuf::from(localappdata)
            .join("Programs")
            .join("cursor")
            .join("resources")
            .join("app-update.yml"))
    }
    #[cfg(target_os = "macos")]
    {
        Ok(std::path::PathBuf::from("/Applications/Cursor.app/Contents/Resources/app-update.yml"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let candidates = [
            std::path::PathBuf::from(&home).join(".local/share/cursor/resources/app-update.yml"),
            std::path::PathBuf::from("/opt/cursor/resources/app-update.yml"),
            std::path::PathBuf::from("/usr/share/cursor/resources/app-update.yml"),
        ];
        for p in &candidates {
            if p.exists() { return Ok(p.clone()); }
        }
        Ok(candidates[0].clone())
    }
}

/// 设置文件只读/可写属性
fn set_readonly(path: &std::path::Path, readonly: bool, details: &mut Vec<String>) {
    if !path.exists() { return; }
    if let Ok(meta) = std::fs::metadata(path) {
        let mut perms = meta.permissions();
        perms.set_readonly(readonly);
        if std::fs::set_permissions(path, perms).is_ok() {
            details.push(format!(
                "已设置 {} 为{}",
                path.display(),
                if readonly { "只读" } else { "可写" }
            ));
        }
    }
}

/// 获取 cursor-updater 可执行文件路径（旧版兼容）
fn get_cursor_updater_path() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(get_cursor_updater_target_path()?.join("cursor-updater.exe"))
    }
    #[cfg(target_os = "macos")]
    {
        Ok(std::path::PathBuf::from("/Applications/Cursor.app/Contents/Frameworks/Cursor Helper (Renderer).app/Contents/MacOS/Cursor Helper (Renderer)"))
    }
    #[cfg(target_os = "linux")]
    {
        Ok(std::path::PathBuf::from("/usr/bin/cursor-updater"))
    }
}

/// 启动 Cursor 应用
///
/// 优先使用用户设置的自定义路径，否则搜索多个默认安装位置。
#[tauri::command]
#[specta::specta]
pub async fn launch_cursor(
    service: State<'_, IdentityService>,
) -> Result<serde_json::Value, String> {
    use std::path::PathBuf;

    let custom_path = service.get_custom_path();

    #[cfg(target_os = "windows")]
    {
        let mut candidates = Vec::new();

        // 自定义路径优先：可能是 resources/app 目录或安装根目录
        if let Some(ref custom) = custom_path {
            let p = PathBuf::from(custom);
            // 自定义路径本身就是 exe
            if p.extension().map(|e| e == "exe").unwrap_or(false) {
                candidates.push(p.clone());
            }
            // 自定义路径是目录，尝试向上查找 Cursor.exe
            candidates.push(p.join("Cursor.exe"));
            candidates.push(p.parent().unwrap_or(&p).join("Cursor.exe"));
            // resources/app → resources → Cursor 根目录
            if let Some(resources) = p.parent() {
                if let Some(root) = resources.parent() {
                    candidates.push(root.join("Cursor.exe"));
                }
            }
        }

        // 默认安装路径
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(&localappdata).join("Programs").join("Cursor").join("Cursor.exe"));
            candidates.push(PathBuf::from(&localappdata).join("Programs").join("cursor").join("Cursor.exe"));
            candidates.push(PathBuf::from(&localappdata).join("Cursor").join("Cursor.exe"));
        }
        candidates.push(PathBuf::from("C:\\Program Files\\Cursor\\Cursor.exe"));
        candidates.push(PathBuf::from("C:\\Program Files (x86)\\Cursor\\Cursor.exe"));
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join("AppData").join("Local").join("Programs").join("Cursor").join("Cursor.exe"));
        }

        for exe in &candidates {
            if exe.exists() {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;

                std::process::Command::new(exe)
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
                    .map_err(|e| format!("启动 Cursor 失败: {}", e))?;
                return Ok(serde_json::json!({"success": true, "message": "Cursor 已启动"}));
            }
        }

        return Err("未找到 Cursor.exe，请检查是否已安装或设置自定义路径".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(ref custom) = custom_path {
            let p = PathBuf::from(custom);
            // resources/app → Contents/Resources/app, 往上找 .app
            let mut dir = p.as_path();
            while let Some(parent) = dir.parent() {
                if dir.extension().map(|e| e == "app").unwrap_or(false) {
                    std::process::Command::new("open")
                        .arg(dir)
                        .spawn()
                        .map_err(|e| format!("启动 Cursor 失败: {}", e))?;
                    return Ok(serde_json::json!({"success": true, "message": "Cursor 已启动"}));
                }
                dir = parent;
            }
        }

        std::process::Command::new("open")
            .arg("-a").arg("Cursor")
            .spawn()
            .map_err(|e| format!("启动 Cursor 失败: {}", e))?;
        return Ok(serde_json::json!({"success": true, "message": "Cursor 已启动"}));
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(ref custom) = custom_path {
            let p = PathBuf::from(custom);
            let mut dir = p.as_path();
            while let Some(parent) = dir.parent() {
                let exe = dir.join("cursor");
                if exe.exists() {
                    std::process::Command::new(&exe)
                        .spawn()
                        .map_err(|e| format!("启动 Cursor 失败: {}", e))?;
                    return Ok(serde_json::json!({"success": true, "message": "Cursor 已启动"}));
                }
                dir = parent;
            }
        }

        std::process::Command::new("cursor")
            .spawn()
            .map_err(|e| format!("启动 Cursor 失败: {}", e))?;
        return Ok(serde_json::json!({"success": true, "message": "Cursor 已启动"}));
    }

    #[allow(unreachable_code)]
    Err("未找到 Cursor".to_string())
}
