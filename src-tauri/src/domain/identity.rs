/// Machine ID 领域模型
///
/// 包含机器标识、备份信息、操作结果等纯数据结构。
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 机器标识集合（对应 Cursor 的 storage.json 中的 ID 字段）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
pub struct MachineIds {
    #[serde(rename = "telemetry.devDeviceId")]
    pub dev_device_id: String,
    #[serde(rename = "telemetry.macMachineId")]
    pub mac_machine_id: String,
    #[serde(rename = "telemetry.machineId")]
    pub machine_id: String,
    #[serde(rename = "telemetry.sqmId")]
    pub sqm_id: String,
    #[serde(rename = "storage.serviceMachineId")]
    pub service_machine_id: String,
    /// Windows 注册表 HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "system.machineGuid"
    )]
    pub machine_guid: Option<String>,
    /// Windows 注册表 HKLM\SOFTWARE\Microsoft\SQMClient\MachineId
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "system.sqmClientId"
    )]
    pub sqm_client_id: Option<String>,
}

impl MachineIds {
    /// 生成全新的随机 Machine ID 集合
    pub fn generate() -> Self {
        Self {
            dev_device_id: Uuid::new_v4().to_string(),
            machine_id: Uuid::new_v4().to_string(),
            mac_machine_id: Uuid::new_v4().to_string(),
            sqm_id: format!("{{{}}}", Uuid::new_v4().to_string().to_uppercase()),
            service_machine_id: Uuid::new_v4().to_string(),
            machine_guid: None,
            sqm_client_id: None,
        }
    }
}

/// 结构化 Machine ID 备份文件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineIdBackupFile {
    pub version: u32,
    pub backup_type: String,
    pub created_at: String,
    pub reason: String,
    pub machine_ids: MachineIds,
}

/// 备份文件信息
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct BackupInfo {
    pub path: String,
    pub filename: String,
    pub timestamp: String,
    pub size: u64,
    pub date_formatted: String,
}

/// Machine ID 重置操作结果
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ResetResult {
    pub success: bool,
    pub message: String,
    pub details: Vec<String>,
    pub new_ids: Option<MachineIds>,
}

/// Machine ID 恢复操作结果
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RestoreResult {
    pub success: bool,
    pub message: String,
    pub details: Vec<String>,
}
