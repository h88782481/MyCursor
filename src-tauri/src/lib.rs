/// MyCursor 应用入口
///
/// 新分层架构：Commands → Services → Infrastructure → Domain

// === 分层架构模块 ===
mod error;
mod domain;
mod infra;
mod services;
mod commands;
mod logger;

use services::identity_service::IdentityService;
use services::account_service::AccountService;
use services::analytics_service::AnalyticsService;
use services::auth_service::AuthService;
use services::seamless_service::SeamlessService;

use infra::cursor::CursorBridge;
use infra::api::CursorApiClient;
use infra::store::{AccountStore, ConfigStore, UsageCache, EventsCache};

use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

/// 关闭时最小化到托盘（true）还是直接退出（false）
static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);

/// 获取应用目录
pub fn get_app_dir() -> Result<PathBuf, String> {
    let exe_path = env::current_exe().map_err(|e| format!("获取可执行文件路径失败: {}", e))?;
    let app_dir = exe_path
        .parent()
        .ok_or("获取父目录失败")?
        .to_path_buf();
    Ok(app_dir)
}

/// 获取数据目录
/// - Windows: exe 同级的 cursor_data/
/// - macOS/Linux: ~/.cursor_data/
pub fn get_data_dir() -> Result<PathBuf, String> {
    let data_dir = if cfg!(target_os = "windows") {
        get_app_dir()?.join("cursor_data")
    } else {
        dirs::home_dir()
            .ok_or("无法获取用户主目录".to_string())?
            .join(".cursor_data")
    };
    if let Err(e) = fs::create_dir_all(&data_dir) {
        eprintln!("创建数据目录失败: {:?}, 错误: {}", data_dir, e);
    }
    Ok(data_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // --- 初始化基础设施 ---
    let data_dir = get_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let config = ConfigStore::new(&data_dir);
    let custom_path = config.get_custom_cursor_path();

    let cursor = CursorBridge::new(custom_path.as_deref())
        .unwrap_or_else(|_| {
            eprintln!("CursorBridge 初始化失败，使用默认路径");
            CursorBridge::new(None).unwrap_or_else(|_| panic!("无法初始化 CursorBridge"))
        });

    let api_client = CursorApiClient::new();
    let account_store = AccountStore::new(&data_dir);
    let usage_cache = UsageCache::new(&data_dir);
    let events_cache = EventsCache::new(&data_dir);

    // --- 构造 services ---
    let identity_service = IdentityService::new(cursor.clone(), config);
    let account_service = AccountService::new(cursor.clone(), account_store);
    let auth_service = AuthService::new(cursor.clone(), api_client.clone());
    let analytics_service = AnalyticsService::new(api_client, usage_cache, events_cache);
    let seamless_service = SeamlessService::new(cursor);

    // --- Tauri 启动 ---
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // 注册 services 到 Tauri State
        .manage(identity_service)
        .manage(account_service)
        .manage(auth_service)
        .manage(analytics_service)
        .manage(seamless_service)
        .setup(|app| {
            if let Err(e) = logger::Logger::init() {
                eprintln!("日志初始化失败: {}", e);
            } else {
                log_info!("MyCursor 启动中...");
            }

            // 读取关闭行为配置
            let data_dir = get_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            let config_store = ConfigStore::new(&data_dir);
            let config_val = config_store.read();
            let minimize = config_val.get("minimize_to_tray")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            MINIMIZE_TO_TRAY.store(minimize, Ordering::SeqCst);

            // 配置系统托盘菜单
            let show_item = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let app_handle = app.handle().clone();
            let app_handle_menu = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .tooltip("MyCursor")
                .menu(&tray_menu)
                .on_menu_event(move |_app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app_handle_menu.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 窗口关闭事件处理：最小化到托盘
            let main_window = app.get_webview_window("main");
            if let Some(window) = main_window {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if MINIMIZE_TO_TRAY.load(Ordering::SeqCst) {
                            api.prevent_close();
                            let _ = win.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // === Identity 命令 ===
            commands::identity::get_current_machine_ids,
            commands::identity::get_available_backups,
            commands::identity::extract_backup_ids,
            commands::identity::delete_backup,
            commands::identity::restore_machine_ids,
            commands::identity::reset_machine_ids,
            commands::identity::complete_cursor_reset,
            commands::identity::get_cursor_paths,
            commands::identity::check_cursor_installation,
            commands::identity::set_custom_cursor_path,
            commands::identity::get_custom_cursor_path,
            commands::identity::clear_custom_cursor_path,
            commands::identity::get_machine_id_file_content,
            commands::identity::get_backup_directory_info,
            commands::identity::get_auto_update_status,
            commands::identity::disable_auto_update,
            commands::identity::enable_auto_update,
            commands::identity::debug_cursor_paths,
            commands::identity::debug_windows_cursor_paths,
            commands::identity::launch_cursor,

            // === Account 命令 ===
            commands::account::get_current_account,
            commands::account::get_account_list,
            commands::account::add_account,
            commands::account::edit_account,
            commands::account::switch_account,
            commands::account::switch_account_with_options,
            commands::account::switch_account_with_token,
            commands::account::remove_account,
            commands::account::logout_current_account,
            commands::account::export_accounts,
            commands::account::import_accounts,
            commands::account::check_admin_privileges,
            commands::account::refresh_single_account_info,
            commands::account::refresh_all_accounts_info,
            commands::account::get_saved_accounts,
            commands::account::list_windows_users,
            commands::account::sync_account_to_user,

            // === Analytics 命令 ===
            commands::analytics::save_usage_data_cache,
            commands::analytics::load_usage_data_cache,
            commands::analytics::clear_usage_data,
            commands::analytics::save_events_data_cache,
            commands::analytics::load_events_data_cache,
            commands::analytics::clear_events_data,
            commands::analytics::save_account_cache,
            commands::analytics::load_account_cache,
            commands::analytics::clear_account_cache,
            commands::analytics::get_usage_for_period,
            commands::analytics::get_user_analytics,
            commands::analytics::get_usage_events,
            commands::analytics::get_events_v2,

            // === Seamless 命令 ===
            commands::seamless::start_seamless_server,
            commands::seamless::stop_seamless_server,
            commands::seamless::inject_seamless,
            commands::seamless::restore_seamless,
            commands::seamless::get_seamless_status,

            // === System 命令 ===
            commands::system::get_log_file_path,
            commands::system::get_log_config,
            commands::system::get_app_version,
            commands::system::get_preset_tags,
            commands::system::save_preset_tags,
            commands::system::test_logging,
            commands::system::open_log_file,
            commands::system::open_log_directory,
            commands::system::open_update_url,
            commands::system::get_token_auto,
            commands::system::check_user_authorization,
            commands::system::get_user_info,
            commands::system::get_auth_me,
            commands::system::get_close_behavior,
            commands::system::set_close_behavior,

            // === Window 命令 ===
            commands::window::generate_pkce_params,
            commands::window::open_cancel_subscription_page,
            commands::window::show_cancel_subscription_window,
            commands::window::cancel_subscription_failed,
            commands::window::open_bind_card_info,
            commands::window::delete_cursor_account,
            commands::window::trigger_authorization_login,
            commands::window::trigger_authorization_login_poll,
            commands::window::open_login_for_session_token,
            commands::window::auto_login_and_get_cookie,
            commands::window::verification_code_login,
            commands::window::check_verification_login_cookies,
            commands::window::check_login_cookies,
            commands::window::auto_login_success,
            commands::window::auto_login_failed,
            commands::window::show_auto_login_window,
            commands::window::open_cursor_dashboard,
        ])
        .run(tauri::generate_context!())
        .expect("MyCursor 启动失败");
}
