mod protocol;
mod state;
mod stats;

use std::{
    env,
    fs::{self, OpenOptions},
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
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
const DEFAULT_STATS_DATABASE_PATH: &str = "voxicraft-stats.sqlite3";
const DEFAULT_SSL_CERT_PATH: &str = "certs/localhost.pem";
const DEFAULT_SSL_KEY_PATH: &str = "certs/localhost-key.pem";

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
        .with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=info,axum=info".to_string()))
        .init();

    let mut host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("SERVER_PORT").unwrap_or_else(|_| "3001".to_string());
    let use_https = env_flag("USE_HTTPS");
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
    let scheme = if use_https { "https" } else { "http" };

    println!("{scheme}://{}:{}", host, port);

    let app_state = AppState {
        state: Arc::new(RwLock::new(ServerState::new(seed))),
        stats_db: Arc::new(Mutex::new(stats_connection)),
        auth_http_client: reqwest::Client::new(),
        auth_central_base_url,
    };

    let app = build_router(&cors_client_domain, app_state);

    info!(log_file = %log_file_path, "file logging enabled");
    info!(%addr, seed, use_https, cors_client_domain = %cors_client_domain, auth_central_base_url = %startup_auth_central_base_url, stats_database_path = %stats_database_path, embedded_front = cfg!(feature = "embed_front"), "voxicraft server started");

    if use_https {
        install_rustls_crypto_provider();

        let tls_paths = ensure_ssl_certificate_files(&host).expect("failed to prepare SSL certificates");
        let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem_file(
            &tls_paths.cert_path,
            &tls_paths.key_path,
        )
            .await
            .expect("failed to load SSL certificates");

        info!(
            cert_path = %tls_paths.cert_path.display(),
            key_path = %tls_paths.key_path.display(),
            "HTTPS enabled"
        );

        axum_server::bind_rustls(addr, tls_config)
            .serve(app.into_make_service())
            .await
            .expect("HTTPS server failed unexpectedly");
    } else {
        let listener = tokio::net::TcpListener::bind(addr).await.expect("failed to bind TCP listener");
        axum::serve(listener, app).await.expect("HTTP server failed unexpectedly");
    }
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

fn env_flag(name: &str) -> bool {
    env::var(name)
        .ok()
        .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

fn install_rustls_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn default_stats_database_path() -> String {
    env::var("STATS_DATABASE_PATH")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_STATS_DATABASE_PATH.to_string())
}

struct SslPaths {
    cert_path: PathBuf,
    key_path: PathBuf,
}

fn ensure_ssl_certificate_files(host: &str) -> Result<SslPaths, Box<dyn std::error::Error + Send + Sync>> {
    let cert_path = env_path("SSL_CERT_PATH", DEFAULT_SSL_CERT_PATH);
    let key_path = env_path("SSL_KEY_PATH", DEFAULT_SSL_KEY_PATH);

    if cert_path.exists() && key_path.exists() {
        return Ok(SslPaths { cert_path, key_path });
    }

    generate_self_signed_certificate(host, &cert_path, &key_path)?;
    Ok(SslPaths { cert_path, key_path })
}

fn env_path(name: &str, default_path: &str) -> PathBuf {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(default_path))
}

fn generate_self_signed_certificate(
    host: &str,
    cert_path: &Path,
    key_path: &Path,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    ensure_parent_dir(cert_path)?;
    ensure_parent_dir(key_path)?;

    let certified_key = rcgen::generate_simple_self_signed(certificate_subject_alt_names(host))?;
    fs::write(cert_path, certified_key.cert.pem())?;
    fs::write(key_path, certified_key.key_pair.serialize_pem())?;

    Ok(())
}

fn certificate_subject_alt_names(host: &str) -> Vec<String> {
    let mut names = vec![
        "localhost".to_string(),
        "127.0.0.1".to_string(),
        "::1".to_string(),
    ];
    let normalized_host = host.trim().trim_start_matches('[').trim_end_matches(']');

    if !normalized_host.is_empty()
        && normalized_host != "0.0.0.0"
        && normalized_host != "::"
        && normalized_host != "[::]"
        && !names.iter().any(|name| name == normalized_host)
    {
        names.push(normalized_host.to_string());
    }

    names
}

fn ensure_parent_dir(path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent().filter(|parent| !parent.as_os_str().is_empty()) {
        fs::create_dir_all(parent)?;
    }

    Ok(())
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
    "Usage: voxicraft_server migrate <up|down> [--database <path>]".to_string()
}

fn build_log_file_name() -> String {
    let date = Local::now().format("%Y%m%d");
    format!("voxicraft-{date}.log")
}

fn format_log_datetime() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
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
        "service": "voxicraft_server",
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
        let mut heartbeat = tokio::time::interval(tokio::time::Duration::from_secs(25));
        heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                outbound = out_rx.recv() => {
                    let Some(message) = outbound else {
                        break;
                    };

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
                _ = heartbeat.tick() => {
                    if ws_sender.send(Message::Ping(Bytes::new())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let mut active_player_id: Option<u64> = None;
    let mut active_central_session_id: Option<u64> = None;

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

                if active_player_id.is_none() && active_central_session_id.is_none() {
                    match client_message {
                        ClientMessage::Hello { lobby_id, nickname, user_id, gender } => {
                            let normalized_gender = stats::normalize_gender(gender.as_deref());
                            let connected_at = stats::now_rfc3339();

                            let (new_player_id, welcome_message, lobby_state_message, joined_message, central_joined_message) = {
                                let mut state = app_state.state.write().await;
                                let result = state.register_player(
                                    lobby_id,
                                    nickname,
                                    user_id.clone(),
                                    normalized_gender.clone(),
                                    connected_at.clone(),
                                    None,
                                    out_tx.clone(),
                                );

                                let joined_player = PlayerPublicState {
                                    player_id: player_id_to_wire(result.player.id),
                                    user_id: result.player.user_id.clone(),
                                    nickname: result.player.nickname.clone(),
                                    transform: result.player.transform.clone(),
                                };

                                let joined_message = ServerMessage::PlayerJoined {
                                    lobby_id: result.player.lobby_id.clone(),
                                    player: joined_player,
                                };
                                let central_joined_message = ServerMessage::CentralPlayerConnected {
                                    player: state.connected_player_public_state(&result.player),
                                    world_version: state.world_version,
                                };

                                (result.player.id, result.welcome, result.lobby_state, joined_message, central_joined_message)
                            };

                            let player_id_wire = player_id_to_wire(new_player_id);
                            if let ServerMessage::PlayerJoined { lobby_id, player } = &joined_message {
                                let connected_log_at = format_log_datetime();
                                info!(
                                    nickname = %player.nickname,
                                    lobby_id = %lobby_id,
                                    connected_at = %connected_log_at,
                                    "Le joueur avec le pseudo {} s'est connecté le {}",
                                    player.nickname,
                                    connected_log_at,
                                );
                            }

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
                                state.broadcast_to_central(&central_joined_message);
                            }

                            active_player_id = Some(new_player_id);
                            continue;
                        }
                        ClientMessage::CentralSubscribe { server_id, .. } => {
                            let (central_session_id, snapshot_message) = {
                                let mut state = app_state.state.write().await;
                                let central_session_id = state.register_central_session(out_tx.clone());
                                let snapshot_message = ServerMessage::CentralConnectedPlayers {
                                    players: state.connected_players_public_state(),
                                    world_version: state.world_version,
                                };
                                (central_session_id, snapshot_message)
                            };

                            info!(central_session_id, server_id = ?server_id, "central websocket subscribed");
                            let _ = out_tx.send(snapshot_message);
                            active_central_session_id = Some(central_session_id);
                            continue;
                        }
                        _ => {
                            let _ = out_tx.send(ServerMessage::Error {
                                code: "hello_or_central_subscribe_required".to_string(),
                                message: "Le premier message doit etre hello ou central_subscribe".to_string(),
                            });
                            continue;
                        }
                    }
                }

                if let Some(player_id) = active_player_id {
                    process_player_message(&app_state, &out_tx, player_id, client_message).await;
                } else if active_central_session_id.is_some() {
                    process_central_message(&out_tx, client_message).await;
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
                    let central_left_message = ServerMessage::CentralPlayerDisconnected {
                        player_id: player_id_to_wire(player.id),
                        lobby_id: lobby_id.clone(),
                        world_version: state.world_version,
                    };
                    state.broadcast_to_central(&central_left_message);
                    Some(player)
                }
                None => None,
            }
        };

        if let Some(player) = removed_player {
            let player_id_wire = player_id_to_wire(player.id);
            let disconnected_log_at = format_log_datetime();
            info!(
                nickname = %player.nickname,
                lobby_id = %player.lobby_id,
                disconnected_at = %disconnected_log_at,
                "Le joueur avec le pseudo {} s'est déconnecté le {}",
                player.nickname,
                disconnected_log_at,
            );

            if let Some(session_id) = player.stats_session_id {
                let disconnected_at = stats::now_rfc3339();
                match app_state.stats_db.lock() {
                    Ok(connection) => {
                        if let Err(error) = stats::finish_player_session(&connection, session_id, &disconnected_at) {
                            error!(%error, player_id = %player_id_wire, session_id, "failed to finish player stats session");
                        }
                    }
                    Err(error) => error!(%error, "stats SQLite mutex poisoned"),
                }
            }
        }
    }

    if let Some(central_session_id) = active_central_session_id {
        let mut state = app_state.state.write().await;
        state.remove_central_session(central_session_id);
        info!(central_session_id, "central websocket disconnected");
    }

    writer.abort();
}

async fn process_central_message(
    out_tx: &mpsc::UnboundedSender<ServerMessage>,
    message: ClientMessage,
) {
    match message {
        ClientMessage::CentralSubscribe { .. } => {
            let _ = out_tx.send(ServerMessage::Error {
                code: "central_already_subscribed".to_string(),
                message: "Le central est deja abonne au canal joueurs".to_string(),
            });
        }
        ClientMessage::Ping { client_time_ms } => {
            let _ = out_tx.send(ServerMessage::Pong { server_time_ms: now_ms(), client_time_ms });
        }
        _ => {
            let _ = out_tx.send(ServerMessage::Error {
                code: "central_message_not_allowed".to_string(),
                message: "Message non autorise sur le canal central".to_string(),
            });
        }
    }
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
        ClientMessage::CentralSubscribe { .. } => {
            let _ = out_tx.send(ServerMessage::Error {
                code: "player_cannot_subscribe_as_central".to_string(),
                message: "Un joueur connecte ne peut pas ouvrir le canal central".to_string(),
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
