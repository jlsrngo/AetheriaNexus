//! Plugin Registry Schema & Persistence Store (`.aetheria/plugins.json`).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginSkillEntry {
    pub name: String,
    pub path: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuleEntry {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String,
    pub enabled: bool,
    pub installed_at: u64,
    pub commit_hash: Option<String>,
    pub sub_path: Option<String>,
    pub path: String,
    pub skills: Vec<PluginSkillEntry>,
    pub rules: Vec<PluginRuleEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginRegistry {
    pub version: u32,
    pub plugins: Vec<InstalledPluginRecord>,
}

fn get_registry_path(ws: &Path) -> PathBuf {
    ws.join(".aetheria").join("plugins.json")
}

pub fn load_plugin_registry(ws: &Path) -> PluginRegistry {
    let reg_file = get_registry_path(ws);
    if let Ok(data) = std::fs::read_to_string(&reg_file) {
        if let Ok(reg) = serde_json::from_str::<PluginRegistry>(&data) {
            return reg;
        }
    }
    PluginRegistry {
        version: 1,
        plugins: Vec::new(),
    }
}

pub fn save_plugin_registry(ws: &Path, reg: &PluginRegistry) {
    let reg_file = get_registry_path(ws);
    if let Some(parent) = reg_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json_str) = serde_json::to_string_pretty(reg) {
        let _ = std::fs::write(&reg_file, json_str);
    }
}

