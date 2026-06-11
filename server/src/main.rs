mod protocol;
mod state;
mod stats;

use std::{env, fs::OpenOptions, net::SocketAddr, sync::{Arc, Mutex}, time::{SystemTime, UNIX_EPOCH}};
use axum::{
    body::{Body, Bytes},
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, RawQuery, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Local;
use futures::{SinkExt, StreamExt};
#[cfg(feature = "embed_front")]
use include_dir::{Dir, include_dir};
use protocol::{ClientMessage, PlayerPublicState, PlayerTransform, ServerMessage};
use rusqlite::Connection;
use state::{player_id_to_wire, ServerState};
use tokio::sync::{mpsc, RwLock};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{error, info, warn};

const DEFAULT_ALLOWED_CORS_ORIGIN: &str = "https://central.voxicraft.fr";
const DEFAULT_STATS_DATABASE_PATH: &str = "minecraft-xr-stats.sqlite3";

#[cfg(feature = "embed_front")]
static FRONT_DIST: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../dist");

#[derive(Clone)]
struct AppState {
    state: Arc<RwLock<ServerState>>,
    stats_db: Arc<Mutex<Connection>>,
    auth_http_client: reqwest::Client,
    auth_central_base_url: String,
}

#[tokio::main]
async fn main() {
    load_env();

    let args = env::args().collect::<Vec<_>>();
    match run_migration_command(&args) {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }

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
        .with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "minecraft_server=info,tower_http=info,axum=info".to_string()))
        .init();

    let mut host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("SERVER_PORT").unwrap_or_else(|_| "3001".to_string());
    let seed = env::var("WORLD_SEED").ok().and_then(|value| value.parse::<u32>().ok()).unwrap_or(12345);
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
    let stats_database_path = default_stats_database_path();

    let mut stats_connection = Connection::open(&stats_database_path).expect("failed to open stats SQLite database");
    stats::migrate_up(&mut stats_connection).expect("failed to run stats SQLite migrations");

    if host.contains(':') && !host.starts_with('[') {
        host = format!("[{host}]");
    }

    let addr: SocketAddr = format!("{host}:{port}").parse().expect("invalid SERVER_HOST or SERVER_PORT");
    println!("http://{}:{}", host, port);

    let app_state = AppState {
        state: Arc::new(RwLock::new(ServerState::new(seed))),
        stats_db: Arc::new(Mutex::new(stats_connection)),
        auth_http_client: reqwest::Client::new(),
        auth_central_base_url,
    };

    let app = build_router(&cors_client_domain, app_state);

    info!(log_file = %log_file_path, "file logging enabled");
    info!(%addr, seed, cors_client_domain = %cors_client_domain, auth_central_base_url = %startup_auth_central_base_url, stats_database_path = %stats_database_path, embedded_front = cfg!(feature = "embed_front"), "minecraft server started");

    let listener = tokio::net::TcpListener::bind(addr).await.expect("failed to bind TCP listener");
    axum::serve(listener, app).await.expect("server failed unexpectedly");
}

fn build_router(cors_client_domain: &str, app_state: AppState) -> Router {
    let router = Router::new()
        .route("/healthz", get(healthz))
        .route("/state", get(state_snapshot))
        .route("/stats", get(stats_snapshot))
        .route("/ws", get(ws_handler))
        .route("/api/auth/register", post(auth_register_proxy))
        .route("/api/auth/login", post(auth_login_proxy))
        .route("/api/auth/discord/url", get(auth_discord_url_proxy))
        .route("/api/auth/discord/callback", get(auth_discord_callback_proxy));

    #[cfg(feature = "embed_front")]
    let router = router.fallback(get(embedded_front_handler));

    router
        .layer(build_cors_layer(cors_client_domain))
        .with_state(app_state)
}

fn load_env() {
    match dotenvy::dotenv() {
        Ok(path) => println!(".env auto chargé depuis: {}", path.display()),
        Err(error) => println!("Aucun .env auto chargé: {error}"),
    }
}

fn default_stats_database_path() -> String {
    env::var("STATS_DATABASE_PATH")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_STATS_DATABASE_PATH.to_string())
}

fn run_migration_command(args: &[String]) -> Result<bool, String> {
    if args.get(1).map(String::as_str) != Some("migrate") {
        return Ok(false);
    }

    let action = args.get(2).map(String::as_str).ok_or_else(migration_usage)?;
    let database_path = migration_database_path(args)?;
    let mut connection = Connection::open(&database_path)
        .map_err(|error| format!("Impossible d'ouvrir la base SQLite {database_path}: {error}"))?;

    match action {
        "up" => {
            stats::migrate_up(&mut connection).map_err(|error| format!("Erreur pendant les migrations up: {error}"))?;
            println!("Migrations appliquées sur {database_path}");
        }
        "down" => {
            let rolled_back = stats::rollback_last_migration(&mut connection)
                .map_err(|error| format!("Erreur pendant la migration down: {error}"))?;
            match rolled_back {
                Some(version) => println!("Migration {version} annulée sur {database_path}"),
                None => println!("Aucune migration à annuler sur {database_path}"),
            }
        }
        _ => return Err(migration_usage()),
    }

    Ok(true)
}

fn migration_database_path(args: &[String]) -> Result<String, String> {
    let mut database_path = default_stats_database_path();
    let mut index = 3;

    while index < args.len() {
        match args[index].as_str() {
            "--database" | "--db" => {
                database_path = args.get(index + 1).ok_or_else(|| "Option --database sans chemin".to_string())?.clone();
                index += 2;
            }
            option => return Err(format!("Option de migration inconnue: {option}\n{}", migration_usage())),
        }
    }

    Ok(database_path)
}

fn migration_usage() -> String {
    "Usage: minecraft_server migrate <up|down> [--database <path>]".to_string()
}

fn build_log_file_name() -> String {
    let date = Local::now().format("%Y%m%d");
    format!("minecraft-xr-{date}.log")
}

fn build_cors_layer(cors_client_domain: &str) -> CorsLayer {
    let mut origins = Vec::new();
    push_cors_origin(&mut origins, DEFAULT_ALLOWED_CORS_ORIGIN);
    push_cors_origin(&mut origins, cors_client_domain);

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::ORIGIN,
            header::COOKIE,
        ])
}

fn push_cors_origin(origins: &mut Vec<HeaderValue>, origin: &str) {
    let normalized_origin = origin.trim().trim_end_matches('/');

    if normalized_origin.is_empty() {
        return;
    }

    match HeaderValue::from_str(normalized_origin) {
        Ok(origin_header) => {
            if !origins.iter().any(|origin| origin == &origin_header) {
                origins.push(origin_header);
            }
        }
        Err(error) => warn!(%error, origin = %origin, "invalid CORS origin ignored"),
    }
}

#[cfg(feature = "embed_front")]
async fn embedded_front_handler(uri: axum::http::Uri) -> Response {
    if uri.path().starts_with("/api/") {
        return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "not_found" }))).into_response();
    }

    let requested_path = uri.path().trim_start_matches('/');
    let file_path = if requested_path.is_empty() { "index.html" } else { requested_path };

    if let Some(file) = FRONT_DIST.get_file(file_path) {
        return embedded_file_response(file_path, file.contents());
    }

    if let Some(index) = FRONT_DIST.get_file("index.html") {
        return embedded_file_response("index.html", index.contents());
    }

    (StatusCode::NOT_FOUND, "Front embarqué introuvable").into_response()
}

#[cfg(feature = "embed_front")]
fn embedded_file_response(path: &str, bytes: &'static [u8]) -> Response {
    let content_type = mime_guess::from_path(path)
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

async fn stats_snapshot(State(app_state): State<AppState>) -> Response {
    let connected_players = {
        let state = app_state.state.read().await;
        state.connected_players_summary()
    };

    let stats_result = {
        let connection = match app_state.stats_db.lock() {
            Ok(connection) => connection,
            Err(error) => {
                error!(%error, "stats SQLite mutex poisoned");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": "stats_database_unavailable",
                        "message": "La base de statistiques est indisponible"
                    })),
                )
                    .into_response();
            }
        };
        stats::collect_server_stats(&connection, connected_players)
    };

    match stats_result {
        Ok(stats) => Json(stats).into_response(),
        Err(error) => {
            error!(%error, "failed to collect server stats");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "stats_query_failed",
                    "message": "Impossible de récupérer les statistiques serveur"
                })),
            )
                .into_response()
        }
    }
}

async fn ws_handler(ws: WebSocketUpgrade, State(app_state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, app_state))
}

async fn auth_register_proxy(State(app_state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    forward_auth_request(&app_state, reqwest::Method::POST, "/api/auth/register", None, Some(body), headers.get(header::CONTENT_TYPE)).await
}

async fn auth_login_proxy(State(app_state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    forward_auth_request(&app_state, reqwest::Method::POST, "/api/auth/login", None, Some(body), headers.get(header::CONTENT_TYPE)).await
}

async fn auth_discord_url_proxy(State(app_state): State<AppState>, RawQuery(raw_query): RawQuery) -> Response {
    forward_auth_request(&app_state, reqwest::Method::GET, "/api/auth/discord/url", raw_query, None, None).await
}

async fn auth_discord_callback_proxy(State(app_state): State<AppState>, RawQuery(raw_query): RawQuery) -> Response {
    forward_auth_request(&app_state, reqwest::Method::GET, "/api/auth/discord/callback", raw_query, None, None).await
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

    if let Some(content_type_value) = content_type.and_then(|value| value.to_str().ok()).filter(|value| !value.is_empty()) {
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

    let status = StatusCode::from_u16(upstream_response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
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
                    let ClientMessage::Hello { lobby_id, nickname, gender } = client_message else {
                        let _ = out_tx.send(ServerMessage::Error {
                            code: "hello_required".to_string(),
                            message: "Le premier message doit etre hello".to_string(),
                        });
                        continue;
                    };

                    let normalized_gender = stats::normalize_gender(gender.as_deref());
                    let connected_at = stats::now_rfc3339();

                    let (new_player_id, welcome_message, lobby_state_message, joined_message) = {
                        let mut state = app_state.state.write().await;
                        let result = state.register_player(
                            lobby_id,
                            nickname,
                            normalized_gender.clone(),
                            connected_at.clone(),
                            None,
                            out_tx.clone(),
                        );

                        let joined_player = PlayerPublicState {
                            player_id: player_id_to_wire(result.player.id),
                            nickname: result.player.nickname.clone(),
                            transform: result.player.transform.clone(),
                        };

                        let joined_message = ServerMessage::PlayerJoined {
                            lobby_id: result.player.lobby_id.clone(),
                            player: joined_player,
                        };

                        (result.player.id, result.welcome, result.lobby_state, joined_message)
                    };

                    let player_id_wire = player_id_to_wire(new_player_id);
                    let stats_session_id = match app_state.stats_db.lock() {
                        Ok(connection) => match stats::start_player_session(
                            &connection,
                            &player_id_wire,
                            match &joined_message { ServerMessage::PlayerJoined { lobby_id, .. } => lobby_id, _ => "unknown" },
                            match &joined_message { ServerMessage::PlayerJoined { player, .. } => &player.nickname, _ => "unknown" },
                            &normalized_gender,
                            &connected_at,
                        ) {
                            Ok(session_id) => Some(session_id),
                            Err(error) => {
                                error!(%error, player_id = %player_id_wire, "failed to create player stats session");
                                None
                            }
                        },
                        Err(error) => {
                            error!(%error, "stats SQLite mutex poisoned");
                            None
                        }
                    };

                    if let Some(session_id) = stats_session_id {
                        let mut state = app_state.state.write().await;
                        state.set_player_stats_session_id(new_player_id, session_id);
                    }

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

                if let Some(player_id) = active_player_id {
                    process_player_message(&app_state, &out_tx, player_id, client_message).await;
                }
            }
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) | Message::Binary(_) => {}
        }
    }

    if let Some(player_id) = active_player_id {
        let removed_player = {
            let mut state = app_state.state.write().await;
            match state.remove_player(player_id) {
                Some((player, lobby_id, left_message)) => {
                    state.broadcast_to_lobby(&lobby_id, &left_message, None);
                    let lobby_state = state.lobby_state_message(&lobby_id);
                    state.broadcast_to_lobby(&lobby_id, &lobby_state, None);
                    Some(player)
                }
                None => None,
            }
        };

        if let Some(player) = removed_player {
            if let Some(session_id) = player.stats_session_id {
                let disconnected_at = stats::now_rfc3339();
                match app_state.stats_db.lock() {
                    Ok(connection) => {
                        if let Err(error) = stats::finish_player_session(&connection, session_id, &disconnected_at) {
                            let player_id_wire = player_id_to_wire(player.id);
                            error!(%error, player_id = %player_id_wire, session_id, "failed to finish player stats session");
                        }
                    }
                    Err(error) => error!(%error, "stats SQLite mutex poisoned"),
                }
            }
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
        ClientMessage::SetBlock { world_x, world_y, world_z, block_id } => {
            let mut state = app_state.state.write().await;
            let Some(player) = state.player(player_id).cloned() else { return; };
            match state.set_block(world_x, world_y, world_z, block_id) {
                Ok(world_version) => {
                    let message = ServerMessage::BlockUpdated { world_x, world_y, world_z, block_id, world_version };
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
        ClientMessage::PlayerTransform { position, rotation, velocity } => {
            let mut state = app_state.state.write().await;
            let Some(player) = state.player(player_id).cloned() else { return; };
            let transform = PlayerTransform { position, rotation, velocity };
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
            let Some(player) = state.player(player_id).cloned() else { return; };
            let outbound = ServerMessage::Chat {
                player_id: player_id_to_wire(player_id),
                nickname: player.nickname,
                message,
                world_version: state.world_version,
            };
            state.broadcast_to_lobby(&player.lobby_id, &outbound, None);
        }
        ClientMessage::Ping { client_time_ms } => {
            let _ = out_tx.send(ServerMessage::Pong { server_time_ms: now_ms(), client_time_ms });
        }
    }
}

fn now_ms() -> u64 {
    let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return 0;
    };
    duration.as_millis() as u64
}
