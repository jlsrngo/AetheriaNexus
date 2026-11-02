use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockVideoRecord {
    pub id: String,
    pub title: String,
    pub category: String,
    pub duration: String,
    pub rendered_at: String,
    pub status: String,
    pub theme: String,
    pub file_path: Option<String>,
}

pub struct DbManager {
    db_path: PathBuf,
}

impl DbManager {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        use tauri::Manager;
        let base_dir = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));

        if !base_dir.exists() {
            let _ = fs::create_dir_all(&base_dir);
        }

        let db_path = base_dir.join("arunakinexus.db");
        let manager = Self { db_path };
        if let Err(e) = manager.init_tables() {
            eprintln!("Database initialization warning: {}", e);
        }
        manager
    }

    pub fn get_connection(&self) -> Result<Connection> {
        Connection::open(&self.db_path)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.get_connection()?;

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS stock_videos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                duration TEXT NOT NULL,
                rendered_at TEXT NOT NULL,
                status TEXT NOT NULL,
                theme TEXT NOT NULL,
                file_path TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;

        // Seed initial items if stock table is empty
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM stock_videos",
            [],
            |row| row.get(0),
        )?;

        if count == 0 {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;

            conn.execute(
                "INSERT INTO stock_videos (id, title, category, duration, rendered_at, status, theme, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    "v-01",
                    "3 Kebiasaan Pagi Orang Sukses",
                    "Produktivitas",
                    "00:05",
                    "Hari ini, 11:30",
                    "ready",
                    "emerald",
                    now
                ],
            )?;

            conn.execute(
                "INSERT INTO stock_videos (id, title, category, duration, rendered_at, status, theme, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    "v-02",
                    "Stop Lakukan Ini Kalau Mau Disiplin",
                    "Mindset",
                    "00:05",
                    "Hari ini, 10:15",
                    "scheduled",
                    "rose",
                    now - 3600
                ],
            )?;

            conn.execute(
                "INSERT INTO stock_videos (id, title, category, duration, rendered_at, status, theme, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    "v-03",
                    "5 Tools AI Gratis yang Jarang Diketahui",
                    "Teknologi",
                    "00:05",
                    "Kemarin, 19:40",
                    "published",
                    "cyan",
                    now - 86400
                ],
            )?;
        }

        Ok(())
    }

    pub fn get_all_stock(&self) -> Result<Vec<StockVideoRecord>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, title, category, duration, rendered_at, status, theme, file_path 
             FROM stock_videos ORDER BY created_at DESC",
        )?;

        let iter = stmt.query_map([], |row| {
            Ok(StockVideoRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                category: row.get(2)?,
                duration: row.get(3)?,
                rendered_at: row.get(4)?,
                status: row.get(5)?,
                theme: row.get(6)?,
                file_path: row.get(7)?,
            })
        })?;

        let mut results = Vec::new();
        for item in iter {
            results.push(item?);
        }
        Ok(results)
    }

    pub fn insert_stock(&self, item: &StockVideoRecord) -> Result<()> {
        let conn = self.get_connection()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        conn.execute(
            "INSERT INTO stock_videos (id, title, category, duration, rendered_at, status, theme, file_path, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                item.id,
                item.title,
                item.category,
                item.duration,
                item.rendered_at,
                item.status,
                item.theme,
                item.file_path,
                now
            ],
        )?;
        Ok(())
    }

    pub fn delete_stock(&self, id: &str) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute("DELETE FROM stock_videos WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2) 
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

