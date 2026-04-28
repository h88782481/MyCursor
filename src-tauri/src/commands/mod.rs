/// Tauri 命令入口
///
/// 每个命令文件对应一个功能域，命令函数仅做参数提取 + 委托 + 返回。
pub mod identity;
pub mod account;
pub mod analytics;
pub mod seamless;
pub mod system;
pub mod telemetry;
pub mod window;
