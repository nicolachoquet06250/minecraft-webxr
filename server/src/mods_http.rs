use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use mime_guess::from_path;
use tokio::fs;
use tracing::warn;

use crate::AppState;

pub async fn client_mods_manifest(State(app_state): State<AppState>) -> Response {
    let registry = match app_state.mods_registry.read() {
        Ok(registry) => registry,
        Err(error) => {
            warn!(%error, "mods registry lock poisoned");
            return (StatusCode::INTERNAL_SERVER_ERROR, "mods registry unavailable").into_response();
        }
    };

    Json(registry.client_manifest()).into_response()
}

pub async fn client_mod_file(
    State(app_state): State<AppState>,
    Path(request_path): Path<String>,
) -> Response {
    let file_path = {
        let registry = match app_state.mods_registry.read() {
            Ok(registry) => registry,
            Err(error) => {
                warn!(%error, "mods registry lock poisoned");
                return (StatusCode::INTERNAL_SERVER_ERROR, "mods registry unavailable").into_response();
            }
        };

        registry.resolve_client_file(&request_path)
    };

    let Some(file_path) = file_path else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let bytes = match fs::read(&file_path).await {
        Ok(bytes) => bytes,
        Err(error) => {
            warn!(path = %file_path.display(), %error, "failed to read client mod file");
            return StatusCode::NOT_FOUND.into_response();
        }
    };

    let content_type = from_path(&file_path)
        .first_or_octet_stream()
        .as_ref()
        .to_string();
    let mut response = Response::new(Body::from(bytes));
    *response.status_mut() = StatusCode::OK;

    if let Ok(value) = HeaderValue::from_str(&content_type) {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }

    response
}
