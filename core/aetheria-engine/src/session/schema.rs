//! Strict Session, Message, Tool & Subagent Schema Contracts — mirrors `packages/schema/src/`.
//! Provides strongly-typed Rust structs and validation helpers for session state, tool payloads,
//! subagent envelopes, and provider protocols.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionState {
    Idle,
    Running,
    Completed,
    Incomplete,
    Error,
    Aborted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderProtocol {
    OpenAiCompatible,
    AnthropicMessages,
    GeminiGenerateContent,
    LocalCliBridge,
}

impl ProviderProtocol {
    /// Detects the native wire protocol from a base URL or provider identifier.
    pub fn detect(base_url: &str, provider_id: &str) -> Self {
        let lower_url = base_url.to_lowercase();
        let lower_id = provider_id.to_lowercase();
        if lower_url.contains("api.anthropic.com") && !lower_url.contains("/v1/chat") {
            Self::AnthropicMessages
        } else if lower_url.contains("generativelanguage.googleapis.com")
            && !lower_url.contains("/openai")
        {
            Self::GeminiGenerateContent
        } else if lower_id == "local-cli" || lower_id == "antigravity" {
            Self::LocalCliBridge
        } else {
            Self::OpenAiCompatible
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubagentEnvelopeSchema {
    pub session_id: String,
    pub parent_session_id: String,
    pub subagent_type: String,
    pub state: SessionState,
    pub background: bool,
    pub steps_executed: usize,
    pub tools_called: Vec<String>,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallSchema {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_provider_protocol() {
        assert_eq!(
            ProviderProtocol::detect("https://api.anthropic.com/v1", "anthropic"),
            ProviderProtocol::AnthropicMessages
        );
        assert_eq!(
            ProviderProtocol::detect(
                "https://generativelanguage.googleapis.com/v1beta",
                "google"
            ),
            ProviderProtocol::GeminiGenerateContent
        );
        assert_eq!(
            ProviderProtocol::detect("https://api.openai.com/v1", "openai"),
            ProviderProtocol::OpenAiCompatible
        );
    }
}

