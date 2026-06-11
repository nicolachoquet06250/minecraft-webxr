mod protocol;
mod state;

use std::{
    env,
    fs::OpenOptions,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    body::{Body, Bytes},
    extract::{
        RawQuery,
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Local;
use futures::{SinkExt, StreamExt};
use protocol::{
    ClientMessage, PlayerPublicState, PlayerTransform, ServerMessage,
};
use state::{player_id_to_wire, ServerState};
use tokio::sync::{RwLock, mpsc};
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

const DEFAULT_ALLOWED_CORS_ORIGIN: &str = "https://central.voxicraft.fr";

#[derive(Clone)]
struct AppState {
    state: Arc<RwLock<ServerState>>,
    auth_http_client: reqwest::Client,
    auth_central_base_url: String,
}

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    let log_file_path = build_log_file_name();
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .expect("failed to open log file");
    let (log_writer, _log_guard) = tracing_appender::non_blocking(log_file);

    tracing_subscriber::fmt()
        .with_ansi(false)
        .with_writer(log_writer)
        .with_env_filter(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "minecraft_server=info,tower_http=info,axum=info".to_string()),
        )
        .init();

    let mut host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("SERVER_PORT").unwrap_or_else(|_| "3001".to_string());
    let seed = env::var("WORLD_SEED")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(12345);
    let cors_client_domain = env::var("CORS_CLIENT_DOMAIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_ALLOWED_CORS_ORIGIN.to_string());
    let auth_central_base_url = env::var("AUTH_CENTRAL_BASE_URL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "https://central.voxicraft.fr".to_string());
    let startup_auth_central_base_url = auth_central_base_url.clone();

    if host.contains(':') {
        host = format!("[{}]", host);
    }

    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .expect("invalid SERVER_HOST or SERVER_PORT");

    eprintln!(format!("https://{}:{}", host, port));

    let app_state = AppState {
        state: Arc::new(RwLock::new(ServerState::new(seed))),
        auth_http_client: reqwest::Client::new(),
        auth_central_base_url,
    };

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/state", get(state_snapshot))
        .route("/ws", get(ws_handler))
        .route("/api/auth/register", post(auth_register_proxy))
        .route("/api/auth/login", post(auth_login_proxy))
        .route("/api/auth/discord/url", get(auth_discord_url_proxy))
        .route("/api/auth/discord/callback", get(auth_discord_callback_proxy))
        .layer(build_cors_layer(&cors_client_domain))
        .with_state(app_state);

    info!(log_file = %log_file_path, "file logging enabled");
    info!(%addr, seed, cors_client_domain = %cors_client_domain, auth_central_base_url = %startup_auth_central_base_url, "minecraft server started");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind TCP listener");

    axum::serve(listener, app)
        .await
        .expect("server failed unexpectedly");
}

fn build_log_file_name() -> String {
    let date = Local::now().format("%Y%m%d");
    format!("minecraft-xr-{date}.log")
}

fn build_cors_layer(cors_client_domain: &str) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::ORIGIN,
            header::COOKIE,
        ]);

    match HeaderValue::from_str(cors_client_domain) {
        Ok(origin_header) => base.allow_origin(origin_header).allow_credentials(true),
        Err(error) => {
            warn!(%error, origin = %cors_client_domain, fallback_origin = %DEFAULT_ALLOWED_CORS_ORIGIN, "invalid CORS_CLIENT_DOMAIN, using default central origin");
            base.allow_origin(HeaderValue::from_static(DEFAULT_ALLOWED_CORS_ORIGIN)).allow_credentials(true)
        }
    }
}

async fn healthz() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "ok": true,
        "service": "minecraft_server",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn state_snapshot(State(app_state): State<AppState>) -> Json<state::ServerSummary> {
    let state = app_state.state.read().await;
    Json(state.summary())
}

async fn ws_handler(ws: WebSocketUpgrade, State(app_state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, app_state))
}

async fn auth_register_proxy(
    State(app_state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    forward_auth_request(
        &app_state,
        reqwest::Method::POST,
        "/api/auth/register",
        None,
        Some(body),
        headers.get(header::CONTENT_TYPE),
    )
    .await
}

async fn auth_login_proxy(
    State(app_state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    forward_auth_request(
        &app_state,
        reqwest::Method::POST,
        "/api/auth/login",
        None,
        Some(body),
        headers.get(header::CONTENT_TYPE),
    )
    .await
}

async fn auth_discord_url_proxy(
    State(app_state): State<AppState>,
    RawQuery(raw_query): RawQuery,
) -> Response {
    forward_auth_request(
        &app_state,
        reqwest::Method::GET,
        "/api/auth/discord/url",
        raw_query,
        None,
        None,
    )
    .await
}

async fn auth_discord_callback_proxy(
    State(app_state): State<AppState>,
    RawQuery(raw_query): RawQuery,
) -> Response {
    forward_auth_request(
        &app_state,
        reqwest::Method::GET,
        "/api/auth/discord/callback",
        raw_query,
        None,
        None,
    )
    .await
}

async fn forward_auth_request(
    app_state: &AppState,
    method: reqwest::Method,
    remote_path: &str,
    raw_query: Option<String>,
    body: Option<Bytes>,
    content_type: Option<&HeaderValue>,
) -> Response {
    let url = build_proxy_url(&app_state.auth_central_base_url, remote_path, raw_query.as_deref());

    let mut request = app_state.auth_http_client.request(method, &url);

    if let Some(content_type_value) = content_type
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
    {
        request = request.header(reqwest::header::CONTENT_TYPE, content_type_value);
    }

    if let Some(payload) = body {
        request = request.body(payload.to_vec());
    }

    let upstream_response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            error!(%error, %url, "failed to proxy auth request");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": "auth_proxy_unreachable",
                    "message": "Le serveur d'authentification est indisponible"
                })),
            )
                .into_response();
        }
    };

    let status = StatusCode::from_u16(upstream_response.status().as_u16())
        .unwrap_or(StatusCode::BAD_GATEWAY);
    let upstream_content_type = upstream_response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let body_bytes = match upstream_response.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => {
            error!(%error, %url, "failed to read auth proxy response body");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": "auth_proxy_invalid_response",
                    "message": "Reponse invalide du serveur d'authentification"
                })),
            )
                .into_response();
        }
    };

    let mut response = Response::new(Body::from(body_bytes));
    *response.status_mut() = status;

    if let Some(content_type) = upstream_content_type {
        if let Ok(value) = HeaderValue::from_str(&content_type) {
            response.headers_mut().insert(header::CONTENT_TYPE, value);
        }
    }

    response
}

fn build_proxy_url(base_url: &str, remote_path: &str, raw_query: Option<&str>) -> String {
    let base = base_url.trim_end_matches('/');
    let path = remote_path.trim_start_matches('/');

    match raw_query.filter(|value| !value.is_empty()) {
        Some(query) => format!("{base}/{path}?{query}"),
        None => format!("{base}/{path}"),
    }
}

async fn handle_socket(socket: WebSocket, app_state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<ServerMessage>();

    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            let text = match serde_json::to_string(&message) {
                Ok(text) => text,
                Err(error) => {
                    error!(%error, "unable to serialize outbound websocket message");
                    continue;
                }
            };

            if ws_sender.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    let mut active_player_id: Option<u64> = None;

    while let Some(incoming) = ws_receiver.next().await {
        let Ok(frame) = incoming else {
            warn!("socket disconnected with transport error");
            break;
        };

        match frame {
            Message::Text(payload) => {
                let parsed = serde_json::from_str::<ClientMessage>(&payload);
                let client_message = match parsed {
                    Ok(msg) => msg,
                    Err(error) => {
                        let _ = out_tx.send(ServerMessage::Error {
                            code: "invalid_json".to_string(),
                            message: format!("JSON invalide: {error}"),
                        });
                        continue;
                    }
                };

                if active_player_id.is_none() {
                    let ClientMessage::Hello { lobby_id, nickname } = client_message else {
                        let _ = out_tx.send(ServerMessage::Error {
                            code: "hello_required".to_string(),
                            message: "Le premier message doit etre hello".to_string(),
                        });
                        continue;
                    };

                    let (new_player_id, welcome_message, lobby_state_message, joined_message) = {
                        let mut state = app_state.state.write().await;
                        let result = state.register_player(lobby_id, nickname, out_tx.clone());

                        let joined_player = PlayerPublicState {
                            player_id: player_id_to_wire(result.player.id),
                            nickname: result.player.nickname.clone(),
                            transform: result.player.transform.clone(),
                        };

                        let joined_message = ServerMessage::PlayerJoined {
                            lobby_id: result.player.lobby_id.clone(),
                            player: joined_player,
                        };

                        (
                            result.player.id,
                            result.welcome,
                            result.lobby_state,
                            joined_message,
                        )
                    };

                    let _ = out_tx.send(welcome_message);
                    let _ = out_tx.send(lobby_state_message);

                    {
                        let state = app_state.state.read().await;
                        if let ServerMessage::PlayerJoined { ref lobby_id, .. } = joined_message {
                            state.broadcast_to_lobby(lobby_id, &joined_message, Some(new_player_id));
                        }
                    }

                    active_player_id = Some(new_player_id);
                    continue;
                }

                let player_id = match active_player_id {
                    Some(id) => id,
                    None => continue,
                };

                process_player_message(&app_state, &out_tx, player_id, client_message).await;
            }
            Message::Close(_) => {
                break;
            }
            Message::Ping(_) | Message::Pong(_) | Message::Binary(_) => {}
        }
    }

    if let Some(player_id) = active_player_id {
        let mut state = app_state.state.write().await;
        if let Some((lobby_id, left_message)) = state.remove_player(player_id) {
            state.broadcast_to_lobby(&lobby_id, &left_message, None);
            let lobby_state = state.lobby_state_message(&lobby_id);
            state.broadcast_to_lobby(&lobby_id, &lobby_state, None);
        }
    }

    writer.abort();
}
async fn process_player_message(
    app_state: &AppState,
    out_tx: &mpsc::UnboundedSender<ServerMessage>,
    player_id: u64,
    message: ClientMessage,
) {
    match message {
        ClientMessage::Hello { .. } => {
            let _ = out_tx.send(ServerMessage::Error {
                code: "already_joined".to_string(),
                message: "Le joueur est deja enregistre".to_string(),
            });
        }
        ClientMessage::RequestChunk { chunk_x, chunk_z } => {
            let mut state = app_state.state.write().await;
            let chunk = state.get_or_create_chunk(chunk_x, chunk_z);

            let _ = out_tx.send(ServerMessage::ChunkData {
                chunk_x,
                chunk_z,
                blocks: chunk.blocks,
                chunk_version: chunk.chunk_version,
                world_version: state.world_version,
            });
        }
        ClientMessage::SetBlock {
            world_x,
            world_y,
            world_z,
            block_id,
        } => {
            let mut state = app_state.state.write().await;
            let Some(player) = state.player(player_id).cloned() else {
                return;
            };

            match state.set_block(world_x, world_y, world_z, block_id) {
                Ok(world_version) => {
                    let message = ServerMessage::BlockUpdated {
                        world_x,
                        world_y,
                        world_z,
                        block_id,
                        world_version,
                    };

                    state.broadcast_to_lobby(&player.lobby_id, &message, None);
                }
                Err(reason) => {
                    let _ = out_tx.send(ServerMessage::Error {
                        code: "invalid_block_update".to_string(),
                        message: reason.to_string(),
                    });
                }
            }
        }
        ClientMessage::PlayerTransform {
            position,
            rotation,
            velocity,
        } => {
            let mut state = app_state.state.write().await;
            let Some(player) = state.player(player_id).cloned() else {
                return;
            };

            let transform = PlayerTransform {
                position,
                rotation,
                velocity,
            };

            if state.update_player_transform(player_id, transform.clone()) {
                let message = ServerMessage::PlayerTransform {
                    player_id: player_id_to_wire(player_id),
                    transform,
                    world_version: state.world_version,
                };

                state.broadcast_to_lobby(&player.lobby_id, &message, Some(player_id));
            }
        }
        ClientMessage::Chat { message } => {
            let state = app_state.state.write().await;
            let Some(player) = state.player(player_id).cloned() else {
                return;
            };

            let outbound = ServerMessage::Chat {
                player_id: player_id_to_wire(player_id),
                nickname: player.nickname,
                message,
                world_version: state.world_version,
            };

            state.broadcast_to_lobby(&player.lobby_id, &outbound, None);
        }
        ClientMessage::Ping { client_time_ms } => {
            let _ = out_tx.send(ServerMessage::Pong {
                server_time_ms: now_ms(),
                client_time_ms,
            });
        }
    }
}

fn now_ms() -> u64 {
    let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return 0;
    };

    duration.as_millis() as u64
}
