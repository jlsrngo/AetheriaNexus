//! Credential store data structures and OAuth types.

use crate::paths::now_iso;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub fn default_version() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CredentialEntry {
    #[serde(alias = "provider", default)]
    pub source: String,
    #[serde(default)]
    pub access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_arn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_info: Option<String>,
    #[serde(default = "now_iso")]
    pub updated_at: String,
    #[serde(default)]
    pub auto_harvested: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CredentialStore {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub entries: HashMap<String, CredentialEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthResult {
    pub request_id: String,
    pub target: String,
    pub status: String, // "pending" | "success" | "error"
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_url: Option<String>,
    pub updated_at: u64,
}
