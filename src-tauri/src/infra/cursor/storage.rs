/// Cursor storage.json 文件操作
use crate::domain::identity::MachineIds;
use crate::error::AppError;
use std::path::Path;

/// storage.json 读写操作
pub struct StorageJson<'a> {
    path: &'a Path,
}

impl<'a> StorageJson<'a> {
    pub fn new(path: &'a Path) -> Self {
        Self { path }
    }

    /// 读取 storage.json 的完整内容
    pub fn read_all(&self) -> Result<serde_json::Value, AppError> {
        let content = std::fs::read_to_string(self.path)?;
        let value: serde_json::Value = serde_json::from_str(&content)?;
        Ok(value)
    }

    /// 读取 Machine ID 集合
    pub fn read_machine_ids(&self) -> Result<MachineIds, AppError> {
        let data = self.read_all()?;
        let ids = MachineIds {
            dev_device_id: data["telemetry.devDeviceId"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            mac_machine_id: data["telemetry.macMachineId"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            machine_id: data["telemetry.machineId"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            sqm_id: data["telemetry.sqmId"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            service_machine_id: data["storage.serviceMachineId"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            machine_guid: data["system.machineGuid"]
                .as_str()
                .map(|s| s.to_string()),
            sqm_client_id: data["system.sqmClientId"]
                .as_str()
                .map(|s| s.to_string()),
        };
        Ok(ids)
    }

    /// 写入 Machine ID 集合到 storage.json
    pub fn write_machine_ids(&self, ids: &MachineIds) -> Result<(), AppError> {
        let mut data = self.read_all().unwrap_or_else(|_| serde_json::json!({}));

        if let Some(obj) = data.as_object_mut() {
            obj.insert("telemetry.devDeviceId".to_string(), serde_json::json!(ids.dev_device_id));
            obj.insert("telemetry.macMachineId".to_string(), serde_json::json!(ids.mac_machine_id));
            obj.insert("telemetry.machineId".to_string(), serde_json::json!(ids.machine_id));
            obj.insert("telemetry.sqmId".to_string(), serde_json::json!(ids.sqm_id));
            obj.insert("storage.serviceMachineId".to_string(), serde_json::json!(ids.service_machine_id));
        }

        self.write_all(&data)
    }

    /// 读取当前邮箱
    pub fn read_email(&self) -> Result<Option<String>, AppError> {
        let data = self.read_all()?;
        Ok(data["cursorAuth/cachedEmail"]
            .as_str()
            .map(|s| s.to_string()))
    }

    /// 读取当前 Token
    pub fn read_token(&self) -> Result<Option<String>, AppError> {
        let data = self.read_all()?;
        Ok(data["cursorAuth/accessToken"]
            .as_str()
            .map(|s| s.to_string()))
    }

    /// 读取当前 Refresh Token
    pub fn read_refresh_token(&self) -> Result<Option<String>, AppError> {
        let data = self.read_all()?;
        Ok(data["cursorAuth/refreshToken"]
            .as_str()
            .map(|s| s.to_string()))
    }

    /// 写入认证信息（邮箱 + Token + 全部关联字段）
    pub fn write_auth(&self, email: &str, token: &str) -> Result<(), AppError> {
        let mut data = self.read_all().unwrap_or_else(|_| serde_json::json!({}));

        if let Some(obj) = data.as_object_mut() {
            obj.insert("cursorAuth/cachedEmail".to_string(), serde_json::json!(email));
            obj.insert("cursorAuth/accessToken".to_string(), serde_json::json!(token));
            obj.insert("cursorAuth/refreshToken".to_string(), serde_json::json!(token));
            obj.insert("cursorAuth/cachedSignUpType".to_string(), serde_json::json!("Auth_0"));
            obj.insert("cursor.email".to_string(), serde_json::json!(email));
            obj.insert("cursor.accessToken".to_string(), serde_json::json!(token));
        }

        self.write_all(&data)
    }

    /// 清除所有认证数据
    pub fn clear_auth_data(&self) -> Result<(), AppError> {
        let mut data = self.read_all().unwrap_or_else(|_| serde_json::json!({}));

        if let Some(obj) = data.as_object_mut() {
            let auth_fields = [
                "cursorAuth/cachedEmail",
                "cursorAuth/accessToken",
                "cursorAuth/refreshToken",
                "cursorAuth/cachedSignUpType",
                "cursor.email",
                "cursor.accessToken",
            ];
            for field in auth_fields {
                obj.remove(field);
            }
        }

        self.write_all(&data)
    }

    /// 原子写入 storage.json
    fn write_all(&self, data: &serde_json::Value) -> Result<(), AppError> {
        let content = serde_json::to_string_pretty(data)?;
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, &content)?;
        std::fs::rename(&tmp, self.path)?;
        Ok(())
    }
}
