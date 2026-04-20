/// 账号领域模型
///
/// 包含账号信息、切换结果、导入结果等纯数据结构。
use crate::domain::identity::MachineIds;
use serde::{Deserialize, Serialize};

/// 账号信息（唯一键为 email）
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AccountInfo {
    pub email: String,
    pub token: String,
    pub refresh_token: Option<String>,
    pub workos_cursor_session_token: Option<String>,
    pub is_current: bool,
    pub created_at: String,
    pub username: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub machine_ids: Option<MachineIds>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trial_days_remaining: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub picture: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<i64>,
}

/// 账号列表查询结果
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AccountListResult {
    pub success: bool,
    pub accounts: Vec<AccountInfo>,
    pub current_account: Option<AccountInfo>,
    pub message: String,
    /// 本地检测到的已有账号数据与缓存不一致
    #[serde(default)]
    pub local_data_changed: bool,
    /// 本地检测到的最新账号数据（仅当 local_data_changed 为 true 时有值）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_fresh_account: Option<AccountInfo>,
}

/// 账号切换结果
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SwitchAccountResult {
    pub success: bool,
    pub message: String,
    pub details: Vec<String>,
}

/// 登出结果
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LogoutResult {
    pub success: bool,
    pub message: String,
    pub details: Vec<String>,
}
