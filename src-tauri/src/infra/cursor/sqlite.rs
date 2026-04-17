/// Cursor SQLite (state.vscdb) 操作
use crate::error::AppError;
use rusqlite::{params, Connection};
use std::path::Path;

/// Cursor SQLite 数据库操作
pub struct CursorSqlite<'a> {
    path: &'a Path,
}

impl<'a> CursorSqlite<'a> {
    pub fn new(path: &'a Path) -> Self {
        Self { path }
    }

    /// 注入邮箱到 SQLite（含兼容字段）
    pub fn inject_email(&self, email: &str) -> Result<(), AppError> {
        self.upsert("cursorAuth/cachedEmail", email)?;
        self.upsert("cursor.email", email)?;
        Ok(())
    }

    /// 注入 Token 到 SQLite（含 refreshToken、cachedSignUpType 等完整认证字段）
    pub fn inject_token(&self, token: &str) -> Result<(), AppError> {
        self.upsert("cursorAuth/accessToken", token)?;
        self.upsert("cursorAuth/refreshToken", token)?;
        self.upsert("cursor.accessToken", token)?;
        self.upsert("cursorAuth/cachedSignUpType", "Auth_0")?;
        Ok(())
    }

    /// 注入 Token 并指定认证类型
    pub fn inject_token_with_auth_type(&self, token: &str, auth_type: &str) -> Result<(), AppError> {
        let value = format!("{}::{}", auth_type, token);
        self.upsert("cursorAuth/accessToken", &value)
    }

    /// 从 SQLite 读取当前邮箱
    pub fn read_email(&self) -> Result<Option<String>, AppError> {
        self.get_value("cursorAuth/cachedEmail")
    }

    /// 从 SQLite 读取当前 Token
    pub fn read_token(&self) -> Result<Option<String>, AppError> {
        self.get_value("cursorAuth/accessToken")
    }

    /// 从 SQLite 读取当前 Refresh Token
    pub fn read_refresh_token(&self) -> Result<Option<String>, AppError> {
        self.get_value("cursorAuth/refreshToken")
    }

    /// 读取 serviceMachineId
    pub fn read_service_machine_id(&self) -> Result<Option<String>, AppError> {
        if !self.path.exists() {
            return Ok(None);
        }
        self.get_value("storage.serviceMachineId")
    }

    /// 更新 serviceMachineId
    pub fn update_service_machine_id(&self, id: &str) -> Result<(), AppError> {
        self.upsert("storage.serviceMachineId", id)
    }

    /// 清除所有认证数据
    pub fn clear_auth_data(&self) -> Result<(), AppError> {
        if !self.path.exists() {
            return Ok(());
        }
        let conn = Connection::open(self.path)?;
        conn.execute(
            "DELETE FROM ItemTable WHERE key LIKE 'cursorAuth/%' OR key IN ('cursor.email', 'cursor.accessToken')",
            [],
        )?;
        Ok(())
    }

    /// 统一的 upsert 操作，消除重复的 SELECT COUNT 模式
    fn upsert(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = Connection::open(self.path)?;
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    /// 读取单个值
    fn get_value(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = Connection::open(self.path)?;
        let result: Result<String, _> = conn.query_row(
            "SELECT value FROM ItemTable WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );
        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }
}
