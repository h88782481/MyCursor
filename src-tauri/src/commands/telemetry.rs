/// 遥测补丁命令
///
/// 提供状态检测、应用补丁、恢复补丁等高级功能入口。
use crate::{log_info, log_error};

const TELEMETRY_MARKER: &str = "/* __MYCURSOR_TELEMETRY_PATCH__ */";
const TELEMETRY_MAIN_BACKUP_SUFFIX: &str = ".backup.telemetry";
const TELEMETRY_HOST_BACKUP_SUFFIX: &str = ".backup.telemetry";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct TelemetryPatchStatus {
    pub supported: bool,
    pub applied: bool,
    pub backup_exists: bool,
    pub extension_main_path: Option<String>,
    pub extension_host_path: Option<String>,
    pub details: Vec<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_telemetry_patch_status(
    service: tauri::State<'_, crate::services::identity_service::IdentityService>,
) -> Result<TelemetryPatchStatus, String> {
    let patcher = TelemetryPatcher::new(service.cursor().paths.app_dir.clone());
    patcher.status().map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn apply_telemetry_patch(
    service: tauri::State<'_, crate::services::identity_service::IdentityService>,
) -> Result<serde_json::Value, String> {
    let patcher = TelemetryPatcher::new(service.cursor().paths.app_dir.clone());
    let result = patcher.apply().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "success": true,
        "message": "已应用遥测补丁，请重启 Cursor 生效",
        "details": result,
    }))
}

#[tauri::command]
#[specta::specta]
pub async fn restore_telemetry_patch(
    service: tauri::State<'_, crate::services::identity_service::IdentityService>,
) -> Result<serde_json::Value, String> {
    let patcher = TelemetryPatcher::new(service.cursor().paths.app_dir.clone());
    let result = patcher.restore().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "success": true,
        "message": "已恢复遥测补丁，请重启 Cursor 生效",
        "details": result,
    }))
}

struct TelemetryPatcher {
    app_dir: Option<std::path::PathBuf>,
}

impl TelemetryPatcher {
    fn new(app_dir: Option<std::path::PathBuf>) -> Self {
        Self { app_dir }
    }

    fn status(&self) -> Result<TelemetryPatchStatus, crate::error::AppError> {
        let main_path = self.extension_main_path()?;
        let host_path = self.extension_host_path()?;

        let mut details = Vec::new();
        let supported = main_path.exists() && host_path.exists();

        if !main_path.exists() {
            details.push("未找到 cursor-always-local 扩展 main.js".to_string());
        }
        if !host_path.exists() {
            details.push("未找到 extensionHostProcess.js".to_string());
        }

        let applied = if supported {
            let main_content = std::fs::read_to_string(&main_path)?;
            let host_content = std::fs::read_to_string(&host_path)?;
            main_content.contains(TELEMETRY_MARKER) && host_content.contains(TELEMETRY_MARKER)
        } else {
            false
        };

        let backup_exists = self.main_backup_path()?.exists() && self.host_backup_path()?.exists();

        Ok(TelemetryPatchStatus {
            supported,
            applied,
            backup_exists,
            extension_main_path: Some(main_path.to_string_lossy().to_string()),
            extension_host_path: Some(host_path.to_string_lossy().to_string()),
            details,
        })
    }

    fn apply(&self) -> Result<Vec<String>, crate::error::AppError> {
        let main_path = self.extension_main_path()?;
        let host_path = self.extension_host_path()?;

        if !main_path.exists() || !host_path.exists() {
            return Err(crate::error::AppError::WorkbenchNotFound(
                "未找到遥测补丁目标文件，请检查 Cursor 安装路径".to_string(),
            ));
        }

        let mut details = Vec::new();
        let main_backup = self.main_backup_path()?;
        let host_backup = self.host_backup_path()?;

        if !main_backup.exists() {
            std::fs::copy(&main_path, &main_backup)?;
            details.push(format!("已备份扩展文件: {}", main_backup.display()));
        }
        if !host_backup.exists() {
            std::fs::copy(&host_path, &host_backup)?;
            details.push(format!("已备份宿主文件: {}", host_backup.display()));
        }

        let main_content = std::fs::read_to_string(&main_path)?;
        if main_content.contains(TELEMETRY_MARKER) {
            details.push("扩展文件已存在遥测补丁，跳过重复应用".to_string());
        } else {
            let patched_main = self.patch_extension_main(&main_content)?;
            std::fs::write(&main_path, &patched_main)?;
            details.push("已写入遥测拦截逻辑到 cursor-always-local/main.js".to_string());

            let hash = self.sha256_hex(patched_main.as_bytes());
            let host_content = std::fs::read_to_string(&host_path)?;
            let patched_host = self.patch_extension_host(&host_content, &hash)?;
            std::fs::write(&host_path, &patched_host)?;
            details.push("已更新 extensionHostProcess.js 中的完整性哈希".to_string());
        }

        log_info!("遥测补丁应用完成");
        Ok(details)
    }

    fn restore(&self) -> Result<Vec<String>, crate::error::AppError> {
        let main_path = self.extension_main_path()?;
        let host_path = self.extension_host_path()?;
        let main_backup = self.main_backup_path()?;
        let host_backup = self.host_backup_path()?;
        let mut details = Vec::new();

        if main_backup.exists() {
            std::fs::copy(&main_backup, &main_path)?;
            details.push(format!("已恢复扩展文件: {}", main_path.display()));
        }
        if host_backup.exists() {
            std::fs::copy(&host_backup, &host_path)?;
            details.push(format!("已恢复宿主文件: {}", host_path.display()));
        }

        if details.is_empty() {
            details.push("未找到遥测补丁备份，无需恢复".to_string());
        }

        log_info!("遥测补丁恢复完成");
        Ok(details)
    }

    fn extension_main_path(&self) -> Result<std::path::PathBuf, crate::error::AppError> {
        let app_dir = self.app_dir.clone().ok_or_else(|| {
            crate::error::AppError::WorkbenchNotFound("未找到 Cursor app 目录".to_string())
        })?;
        Ok(app_dir
            .join("extensions")
            .join("cursor-always-local")
            .join("dist")
            .join("main.js"))
    }

    fn extension_host_path(&self) -> Result<std::path::PathBuf, crate::error::AppError> {
        let app_dir = self.app_dir.clone().ok_or_else(|| {
            crate::error::AppError::WorkbenchNotFound("未找到 Cursor app 目录".to_string())
        })?;
        Ok(app_dir
            .join("out")
            .join("vs")
            .join("workbench")
            .join("api")
            .join("node")
            .join("extensionHostProcess.js"))
    }

    fn main_backup_path(&self) -> Result<std::path::PathBuf, crate::error::AppError> {
        let main_path = self.extension_main_path()?;
        Ok(std::path::PathBuf::from(format!("{}{}", main_path.to_string_lossy(), TELEMETRY_MAIN_BACKUP_SUFFIX)))
    }

    fn host_backup_path(&self) -> Result<std::path::PathBuf, crate::error::AppError> {
        let host_path = self.extension_host_path()?;
        Ok(std::path::PathBuf::from(format!("{}{}", host_path.to_string_lossy(), TELEMETRY_HOST_BACKUP_SUFFIX)))
    }

    fn patch_extension_main(&self, content: &str) -> Result<String, crate::error::AppError> {
        let needle = "transport.unary(";
        let idx = content.find(needle).ok_or_else(|| {
            crate::error::AppError::Internal("未找到 transport.unary，当前 Cursor 版本可能不兼容".to_string())
        })?;

        let body_start = content[idx..].find('{').map(|v| idx + v + 1).ok_or_else(|| {
            crate::error::AppError::Internal("未找到 transport.unary 函数体起始位置".to_string())
        })?;

        let injection = r#"
/* __MYCURSOR_TELEMETRY_PATCH__ */
try {
  const svcName = service?.typeName || service?.name || service?.serviceName || "";
  const methodName = method?.name || method?.methodName || method?.localName || "";
  const isAnalytics = svcName.includes("AnalyticsService") && methodName !== "BootstrapStatsig";
  const isAiTelemetry = methodName === "ReportCommitAiAnalytics" || methodName === "ReportAiCodeChangeMetrics";
  if (isAnalytics || isAiTelemetry) {
    return Promise.resolve({});
  }
} catch (_) {}
"#;

        let mut patched = String::with_capacity(content.len() + injection.len() + 16);
        patched.push_str(&content[..body_start]);
        patched.push_str(injection);
        patched.push_str(&content[body_start..]);
        Ok(patched)
    }

    fn patch_extension_host(&self, content: &str, new_hash: &str) -> Result<String, crate::error::AppError> {
        let old_hash = self.find_hash_for_cursor_always_local(content).ok_or_else(|| {
            crate::error::AppError::Internal("未在 extensionHostProcess.js 中找到 cursor-always-local 的完整性哈希".to_string())
        })?;

        if content.contains(TELEMETRY_MARKER) {
            let replaced = content.replacen(&old_hash, new_hash, 1);
            return Ok(replaced);
        }

        let replaced = content.replacen(&old_hash, new_hash, 1);
        if replaced == content {
            return Err(crate::error::AppError::Internal("替换遥测补丁哈希失败".to_string()));
        }

        Ok(format!("{}\n{}", TELEMETRY_MARKER, replaced))
    }

    fn find_hash_for_cursor_always_local(&self, content: &str) -> Option<String> {
        let marker = "cursor-always-local/dist/main.js";
        let pos = content.find(marker)?;
        let start = content[..pos].rfind('"')?;
        let prefix = &content[..start];
        let hash_end = prefix.rfind('"')?;
        let hash_start = prefix[..hash_end].rfind('"')? + 1;
        let hash = &prefix[hash_start..hash_end];
        if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
            Some(hash.to_string())
        } else {
            None
        }
    }

    fn sha256_hex(&self, bytes: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        format!("{:x}", Sha256::digest(bytes))
    }
}
