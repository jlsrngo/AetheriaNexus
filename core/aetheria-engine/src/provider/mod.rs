pub mod catalog;
pub mod catalog_crud;
pub mod catalog_probe;
pub mod cli_diagnostics;
pub mod cloud_manager;
pub mod config;
pub mod key_rotation;
pub mod local_cli;
pub mod local_cli_auth;
pub mod local_cli_registry;
pub mod oauth;
pub mod protocol_adapters;
pub mod workspace_routes;

#[allow(unused_imports)]
pub use config::{read_aetheria_config, write_aetheria_config};

use axum::{
    routing::{delete, get, post, put},
    Router,
};

pub fn router() -> Router {
    Router::new()
        .merge(oauth::router())
        .route("/api/model", get(catalog::handle_model_list))
        .route("/model", get(catalog::handle_model_list))
        .route("/api/provider", get(catalog::handle_provider_list))
        .route("/provider", get(catalog::handle_provider_list))
        .route("/api/provider/:id", get(catalog::handle_provider_get))
        .route("/api/agent", get(catalog::handle_agent_list))
        .route("/agent", get(catalog::handle_agent_list))
        .route("/api/agent/:id", get(catalog::handle_agent_get))
        // UI Provider CRUD & probe endpoints
        .route(
            "/api/providers",
            get(catalog::handle_ui_providers_list)
                .post(catalog_crud::handle_ui_providers_upsert),
        )
        .route(
            "/providers",
            get(catalog::handle_ui_providers_list)
                .post(catalog_crud::handle_ui_providers_upsert),
        )
        .route(
            "/api/providers/status",
            get(catalog_probe::handle_providers_status),
        )
        .route(
            "/api/providers/connect",
            post(catalog_crud::handle_providers_connect),
        )
        .route(
            "/api/providers/test",
            post(catalog_probe::handle_providers_test),
        )
        .route(
            "/providers/test",
            post(catalog_probe::handle_providers_test),
        )
        .route(
            "/api/providers/fetch-models",
            post(catalog_probe::handle_providers_fetch_models),
        )
        .route(
            "/providers/fetch-models",
            post(catalog_probe::handle_providers_fetch_models),
        )
        // Cloud Provider management & Model Pool routes
        .route(
            "/api/providers/cloud/classify",
            post(cloud_manager::handle_classify_provider),
        )
        .route(
            "/providers/cloud/classify",
            post(cloud_manager::handle_classify_provider),
        )
        .route(
            "/api/providers/cloud/pool",
            post(cloud_manager::handle_combine_model_pool),
        )
        .route(
            "/providers/cloud/pool",
            post(cloud_manager::handle_combine_model_pool),
        )
        // Local-CLI status & connect routes
        .route(
            "/api/providers/local-cli/status",
            get(local_cli::handle_local_cli_status),
        )
        .route(
            "/providers/local-cli/status",
            get(local_cli::handle_local_cli_status),
        )
        .route(
            "/api/providers/local-cli/ping",
            post(cli_diagnostics::handle_local_cli_ping),
        )
        .route(
            "/providers/local-cli/ping",
            post(cli_diagnostics::handle_local_cli_ping),
        )
        .route(
            "/api/providers/local-cli/quotas",
            get(local_cli::handle_local_cli_quotas).post(local_cli::handle_local_cli_quota_post),
        )
        .route(
            "/api/providers/local-cli/quota",
            get(local_cli::handle_local_cli_quota_post)
                .post(local_cli::handle_local_cli_quota_post),
        )
        .route(
            "/providers/local-cli/quota",
            get(local_cli::handle_local_cli_quota_post)
                .post(local_cli::handle_local_cli_quota_post),
        )
        .route(
            "/api/providers/local-cli/models",
            post(local_cli::handle_local_cli_models),
        )
        .route(
            "/providers/local-cli/models",
            post(local_cli::handle_local_cli_models),
        )
        .route(
            "/api/providers/local-cli/discovered",
            get(local_cli::handle_local_cli_discovered),
        )
        .route(
            "/providers/local-cli/discovered",
            get(local_cli::handle_local_cli_discovered),
        )
        .route(
            "/api/providers/local-cli/connect",
            post(local_cli::handle_local_cli_connect),
        )
        .route(
            "/providers/local-cli/connect",
            post(local_cli::handle_local_cli_connect),
        )
        .route(
            "/api/providers/local-cli/inject",
            post(local_cli::handle_local_cli_inject),
        )
        .route(
            "/providers/local-cli/inject",
            post(local_cli::handle_local_cli_inject),
        )
        // Local-CLI authentication & OAuth routes
        .route(
            "/api/providers/local-cli/login",
            post(local_cli_auth::handle_local_cli_login),
        )
        .route(
            "/providers/local-cli/login",
            post(local_cli_auth::handle_local_cli_login),
        )
        .route(
            "/api/providers/local-cli/oauth/start",
            post(local_cli_auth::handle_local_cli_oauth_start),
        )
        .route(
            "/providers/local-cli/oauth/start",
            post(local_cli_auth::handle_local_cli_oauth_start),
        )
        .route(
            "/api/providers/local-cli/oauth/status",
            post(local_cli_auth::handle_local_cli_oauth_status),
        )
        .route(
            "/providers/local-cli/oauth/status",
            post(local_cli_auth::handle_local_cli_oauth_status),
        )
        .route(
            "/api/providers/local-cli/harvest",
            post(local_cli_auth::handle_local_cli_harvest),
        )
        .route(
            "/api/providers/local-cli/signin",
            post(local_cli_auth::handle_local_cli_signin),
        )
        .route(
            "/api/providers/local-cli/token",
            post(local_cli_auth::handle_local_cli_token),
        )
        .route(
            "/api/providers/local-cli/refresh",
            post(local_cli_auth::handle_local_cli_refresh),
        )
        .route(
            "/providers/local-cli/refresh",
            post(local_cli_auth::handle_local_cli_refresh),
        )
        .route(
            "/api/providers/local-cli/:source",
            delete(local_cli_auth::handle_local_cli_delete),
        )
        // Wildcard provider ID routes
        .route(
            "/api/providers/:providerId",
            put(catalog_crud::handle_ui_providers_update)
                .delete(catalog_crud::handle_providers_delete),
        )
        .route(
            "/providers/:providerId",
            put(catalog_crud::handle_ui_providers_update)
                .delete(catalog_crud::handle_providers_delete),
        )
        .route(
            "/api/providers/:providerId/state",
            put(catalog_crud::handle_ui_providers_state),
        )
        .route(
            "/providers/:providerId/state",
            put(catalog_crud::handle_ui_providers_state),
        )
        .route(
            "/api/providers/:providerId/test",
            post(catalog_probe::handle_ui_provider_id_test),
        )
        .route(
            "/providers/:providerId/test",
            post(catalog_probe::handle_ui_provider_id_test),
        )
        // Engine config & workspace path metadata routes
        .route("/config", get(workspace_routes::handle_config_get))
        .route("/api/config", get(workspace_routes::handle_config_get))
        .route("/project", get(workspace_routes::handle_project_list))
        .route(
            "/project/current",
            get(workspace_routes::handle_project_current),
        )
        .route("/path", get(workspace_routes::handle_path_get))
        .route("/vcs", get(workspace_routes::handle_vcs_get))
}
