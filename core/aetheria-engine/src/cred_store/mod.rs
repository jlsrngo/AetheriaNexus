//! Local CLI Credential Harvesting, Storage, and OAuth Token Refresh engine.
//!
//! Submodules:
//! - `types`: CredentialEntry, CredentialStore, and OauthResult data structures.
//! - `store`: Disk persistence, memory caching, JWT decoding, and config registration.
//! - `harvest`: Automatic credential harvesting from local developer CLIs.
//! - `refresh`: Automatic token refreshing via OAuth refresh tokens.
//! - `oauth`: Interactive browser and device-code OAuth authorization sessions.
//! - `quota`: Live provider quota checking and usage reporting.

pub mod harvest;
pub mod oauth;
pub mod quota;
pub mod refresh;
pub mod store;
pub mod types;

pub use harvest::{harvest_all, harvest_antigravity, harvest_claude, harvest_codex, harvest_kiro, harvest_opencode};
pub use oauth::{get_oauth_status, open_browser_url, start_oauth_session};
pub use quota::{fetch_all_quotas, fetch_live_quotas_list};
pub use refresh::{ensure_fresh_credential, refresh_credential_source};
pub use store::{
    cred_file_path, decode_jwt_payload, get_all_credentials, get_credential, is_expired,
    load_store_from_disk, parse_iso_to_ms, read_windows_generic_credential,
    register_local_cli_to_config, remove_credential, save_store_to_disk, set_credential,
};
pub use types::{default_version, CredentialEntry, CredentialStore, OauthResult};

