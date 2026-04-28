/// 遥测补丁命令
///
/// 参考 <https://github.com/lyon-le/patch-cursor-telemetry>：在 `unary(t,n,…)` 包装层注入，
/// 并更新 `extensionHostProcess.js` 内 `anysphere.cursor-always-local` 的 main.js 完整性哈希。
///
/// 若新版 bundle 与正则不兼容，则回退到在内部 `transport.unary(` 处注入（旧逻辑）。
use crate::log_info;
use regex::Regex;
use std::sync::OnceLock;

/// 与 lyon-le/patch-cursor-telemetry 中 Node 正则等价（宿主内 anysphere.cursor-always-local 的 main.js 哈希）。
fn regex_anysphere_main_js_hash() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(concat!(
            r#"("anysphere\.cursor-always-local":\{dist:\{"gitWorker\.js":"[a-f0-9]+","main\.js":")"#,
            r#"([a-f0-9]{64})(["])"#
        ))
        .expect("anysphere main.js hash regex")
    })
}

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

    fn sha256_hex_static(bytes: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        format!("{:x}", Sha256::digest(bytes))
    }

    /// 与 patch-cursor-telemetry 一致：补丁注释或 Analytics 拦截字符串
    fn main_looks_patched(main: &str) -> bool {
        main.contains(TELEMETRY_MARKER)
            || main.contains("\"aiserver.v1.AnalyticsService\"===t.typeName")
    }

    /// 从宿主哈希表中读出 cursor-always-local main.js 的 SHA256（优先 upstream 正则）
    fn extract_main_js_hash_from_host(content: &str) -> Option<String> {
        let re_upstream = regex_anysphere_main_js_hash();
        if let Some(caps) = re_upstream.captures(content) {
            return caps.get(2).map(|m| m.as_str().to_string());
        }
        TelemetryPatcher::find_hash_near_marker_fallback(content)
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
            let main_patched = Self::main_looks_patched(&main_content);
            let main_hash = Self::sha256_hex_static(main_content.as_bytes());
            let host_reports_same_hash =
                Self::extract_main_js_hash_from_host(&host_content).as_deref() == Some(main_hash.as_str());
            main_patched && host_reports_same_hash
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

        // 扩展无补丁则先写入 main；宿主必须始终与当前 main 的 SHA256 一致并带补丁标记，
        // 否则会出现「扩展已补丁、宿主仍原味」的中间态，表现为状态一直「未应用」。
        let mut main_content = std::fs::read_to_string(&main_path)?;
        if !Self::main_looks_patched(&main_content) {
            let patched_main = self.patch_extension_main(&main_content)?;
            std::fs::write(&main_path, &patched_main)?;
            details.push("已写入遥测拦截逻辑到 cursor-always-local/main.js".to_string());
            main_content = patched_main;
        }

        let hash = self.sha256_hex(main_content.as_bytes());
        let host_content = std::fs::read_to_string(&host_path)?;
        let patched_host = self.patch_extension_host(&host_content, &hash)?;
        if patched_host != host_content {
            std::fs::write(&host_path, &patched_host)?;
            details.push("已更新 extensionHostProcess.js（完整性哈希与补丁标记）".to_string());
        } else {
            details.push("扩展与宿主已同步，无需变更".to_string());
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

    /// 优先使用与 <https://github.com/lyon-le/patch-cursor-telemetry> 相同的包装层注入
    fn patch_extension_main(&self, content: &str) -> Result<String, crate::error::AppError> {
        if let Some(p) = Self::patch_extension_main_upstream(content) {
            return Ok(p);
        }
        Self::patch_extension_main_legacy_inner_transport(content)
    }

    /// `unary(t,n,r,s,o,i,a){` → `_getTransportForService` → `transport.unary`（与 patch-telemetry.sh 一致）
    fn patch_extension_main_upstream(content: &str) -> Option<String> {
        let Ok(re) = Regex::new(
            r"unary\(t,n,r,s,o,i,a\)\{const ([a-zA-Z_$][a-zA-Z0-9_$]*)=e\._getTransportForService\(t\.typeName,n\.name\);if\(void 0===\1\)throw new Error\(\"INVARIANT VIOLATION: Transport is undefined for service: \"\+t\.typeName\);return \1\.transport\.unary\(t,n,r,s,o,i,a\)\}",
        ) else {
            return None;
        };
        let m = re.find(content)?;
        let full = m.as_str();
        let prefix = "unary(t,n,r,s,o,i,a){";
        let insert_at = full.find(prefix)? + prefix.len();
        // 与上游脚本同一拦截语义；仅多一层注释便于识别
        let intercept = concat!(
            "/* __MYCURSOR_TELEMETRY_PATCH__ */",
            "try{if((\"aiserver.v1.AnalyticsService\"===t.typeName&&\"BootstrapStatsig\"!==n.name)",
            "||\"ReportCommitAiAnalytics\"===n.name||\"ReportAiCodeChangeMetrics\"===n.name)",
            "{const _O=typeof n.O===\"function\"?new n.O:{};",
            "return Promise.resolve({stream:!1,service:t,method:n,",
            "header:new Headers,message:_O,trailer:new Headers})}}catch(_){}",
        );
        let mut out = String::with_capacity(content.len() + intercept.len());
        out.push_str(&content[..m.start()]);
        out.push_str(&full[..insert_at]);
        out.push_str(intercept);
        out.push_str(&full[insert_at..]);
        out.push_str(&content[m.end()..]);
        Some(out)
    }

    /// 旧版 main 未压缩成上游正则时，在内部 `transport.unary` 处注入
    fn patch_extension_main_legacy_inner_transport(content: &str) -> Result<String, crate::error::AppError> {
        let needle = "transport.unary(";
        let idx = content.find(needle).ok_or_else(|| {
            crate::error::AppError::Internal(
                "未找到 transport.unary / unary 包装层，当前 Cursor 版本可能不兼容遥测补丁".to_string(),
            )
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
        let re = regex_anysphere_main_js_hash();
        if re.is_match(content) {
            let replaced = re
                .replace(content, |caps: &regex::Captures| {
                    format!("{}{}{}", &caps[1], new_hash, &caps[3])
                })
                .into_owned();
            if replaced != content {
                return Ok(replaced);
            }
        }

        let old_hash =
            TelemetryPatcher::find_hash_near_marker_fallback(content).ok_or_else(|| {
                crate::error::AppError::Internal(
                    "未在 extensionHostProcess.js 中找到 anysphere.cursor-always-local 的 main.js 哈希".to_string(),
                )
            })?;

        let replaced = content.replacen(&old_hash, new_hash, 1);
        if replaced != content {
            return Ok(if content.contains(TELEMETRY_MARKER) {
                replaced
            } else {
                format!("{}\n{}", TELEMETRY_MARKER, replaced)
            });
        }

        Err(crate::error::AppError::Internal("替换遥测宿主完整性哈希失败".to_string()))
    }

    fn find_hash_near_marker_fallback(content: &str) -> Option<String> {
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
        Self::sha256_hex_static(bytes)
    }
}
