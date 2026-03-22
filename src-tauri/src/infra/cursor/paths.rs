/// 跨平台路径发现（全项目唯一实现）
///
/// 在 CursorBridge 构造时调用一次，解析所有 Cursor 相关路径。
use crate::error::AppError;
use super::ResolvedPaths;
use std::path::{Path, PathBuf};

/// 解析 Cursor 路径，优先使用自定义路径
pub fn resolve(custom_path: Option<&str>) -> Result<ResolvedPaths, AppError> {
    let (storage_json, sqlite_db) = resolve_data_paths()?;

    let (app_dir, workbench_js, main_js) = if let Some(custom) = custom_path {
        let p = PathBuf::from(custom);
        // 尝试多种子路径组合
        let candidates = vec![
            p.clone(),
            p.join("resources").join("app"),
        ];
        let mut found = (None, None, None);
        for dir in &candidates {
            let wb = dir.join("out").join("vs").join("workbench").join("workbench.desktop.main.js");
            let mj = dir.join("out").join("main.js");
            if wb.exists() {
                found = (Some(dir.clone()), Some(wb), if mj.exists() { Some(mj) } else { None });
                break;
            }
        }
        if found.0.is_some() { found } else { (Some(p), None, None) }
    } else {
        resolve_app_paths()
    };

    Ok(ResolvedPaths {
        storage_json,
        sqlite_db,
        workbench_js,
        main_js,
        app_dir,
    })
}

/// 解析 Cursor 数据目录（storage.json 和 state.vscdb）
fn resolve_data_paths() -> Result<(PathBuf, PathBuf), AppError> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| AppError::CursorNotFound)?;
        let base = PathBuf::from(appdata).join("Cursor").join("User").join("globalStorage");
        Ok((base.join("storage.json"), base.join("state.vscdb")))
    }

    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or(AppError::CursorNotFound)?;
        let base = home.join("Library/Application Support/Cursor/User/globalStorage");
        Ok((base.join("storage.json"), base.join("state.vscdb")))
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir().ok_or(AppError::CursorNotFound)?;
        let base = home.join(".config/Cursor/User/globalStorage");
        Ok((base.join("storage.json"), base.join("state.vscdb")))
    }
}

/// 解析 Cursor 应用目录（workbench.js、main.js 等）
fn resolve_app_paths() -> (Option<PathBuf>, Option<PathBuf>, Option<PathBuf>) {
    #[cfg(target_os = "windows")]
    {
        let candidates = get_windows_candidates();
        for dir in &candidates {
            let wb = dir.join("out").join("vs").join("workbench").join("workbench.desktop.main.js");
            let mj = dir.join("out").join("main.js");
            if wb.exists() {
                return (Some(dir.clone()), Some(wb), if mj.exists() { Some(mj) } else { None });
            }
        }
        (None, None, None)
    }

    #[cfg(target_os = "macos")]
    {
        let candidates = vec![
            PathBuf::from("/Applications/Cursor.app/Contents/Resources/app"),
        ];
        for dir in &candidates {
            let wb = dir.join("out").join("vs").join("workbench").join("workbench.desktop.main.js");
            let mj = dir.join("out").join("main.js");
            if wb.exists() {
                return (Some(dir.clone()), Some(wb), if mj.exists() { Some(mj) } else { None });
            }
        }
        (None, None, None)
    }

    #[cfg(target_os = "linux")]
    {
        let candidates = vec![
            PathBuf::from("/opt/Cursor/resources/app"),
            PathBuf::from("/usr/share/cursor/resources/app"),
        ];
        for dir in &candidates {
            let wb = dir.join("out").join("vs").join("workbench").join("workbench.desktop.main.js");
            let mj = dir.join("out").join("main.js");
            if wb.exists() {
                return (Some(dir.clone()), Some(wb), if mj.exists() { Some(mj) } else { None });
            }
        }
        (None, None, None)
    }
}

#[cfg(target_os = "windows")]
fn get_windows_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(&localappdata).join("Programs").join("Cursor").join("resources").join("app"));
        candidates.push(PathBuf::from(&localappdata).join("Programs").join("cursor").join("resources").join("app"));
        candidates.push(PathBuf::from(&localappdata).join("Cursor").join("resources").join("app"));
    }
    candidates.push(PathBuf::from("C:\\Program Files\\Cursor\\resources\\app"));
    candidates.push(PathBuf::from("C:\\Program Files (x86)\\Cursor\\resources\\app"));
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("AppData").join("Local").join("Programs").join("Cursor").join("resources").join("app"));
    }
    candidates
}
