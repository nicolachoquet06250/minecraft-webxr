use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;

use crate::state::ConnectedPlayerSummary;

#[derive(Debug, Clone, Serialize)]
pub struct CountByGender {
    pub gender: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CountByMonth {
    pub month: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CountByMonthAndGender {
    pub month: String,
    pub gender: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AverageDurationByGender {
    pub gender: String,
    pub average_duration_seconds: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AverageSessionDuration {
    pub average_duration_seconds: f64,
    pub by_gender: Vec<AverageDurationByGender>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServerStats {
    pub generated_at: String,
    pub total_connections: i64,
    pub current_connected_players: usize,
    pub connected_players: Vec<ConnectedPlayerSummary>,
    pub connections_by_gender: Vec<CountByGender>,
    pub connections_by_month: Vec<CountByMonth>,
    pub connections_by_month_and_gender: Vec<CountByMonthAndGender>,
    pub average_session_duration: AverageSessionDuration,
}

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

pub fn normalize_gender(gender: Option<&str>) -> String {
    gender
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "unknown".to_string())
}

pub fn init_stats_database(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS player_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT NOT NULL,
            lobby_id TEXT NOT NULL,
            nickname TEXT NOT NULL,
            gender TEXT NOT NULL DEFAULT 'unknown',
            connected_at TEXT NOT NULL,
            disconnected_at TEXT,
            duration_seconds INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_player_sessions_connected_at
            ON player_sessions (connected_at);

        CREATE INDEX IF NOT EXISTS idx_player_sessions_gender
            ON player_sessions (gender);

        CREATE INDEX IF NOT EXISTS idx_player_sessions_disconnected_at
            ON player_sessions (disconnected_at);
        "#,
    )
}

pub fn start_player_session(
    connection: &Connection,
    player_id: &str,
    lobby_id: &str,
    nickname: &str,
    gender: &str,
    connected_at: &str,
) -> rusqlite::Result<i64> {
    connection.execute(
        r#"
        INSERT INTO player_sessions (
            player_id,
            lobby_id,
            nickname,
            gender,
            connected_at
        ) VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![player_id, lobby_id, nickname, gender, connected_at],
    )?;

    Ok(connection.last_insert_rowid())
}

pub fn finish_player_session(
    connection: &Connection,
    session_id: i64,
    disconnected_at: &str,
) -> rusqlite::Result<()> {
    connection.execute(
        r#"
        UPDATE player_sessions
        SET
            disconnected_at = ?1,
            duration_seconds = MAX(0, CAST((julianday(?1) - julianday(connected_at)) * 86400 AS INTEGER))
        WHERE id = ?2
          AND disconnected_at IS NULL
        "#,
        params![disconnected_at, session_id],
    )?;

    Ok(())
}

pub fn collect_server_stats(
    connection: &Connection,
    connected_players: Vec<ConnectedPlayerSummary>,
) -> rusqlite::Result<ServerStats> {
    let total_connections = connection.query_row(
        "SELECT COUNT(*) FROM player_sessions",
        [],
        |row| row.get::<_, i64>(0),
    )?;

    let connections_by_gender = query_connections_by_gender(connection)?;
    let connections_by_month = query_connections_by_month(connection)?;
    let connections_by_month_and_gender = query_connections_by_month_and_gender(connection)?;
    let average_session_duration = query_average_session_duration(connection)?;

    Ok(ServerStats {
        generated_at: now_rfc3339(),
        total_connections,
        current_connected_players: connected_players.len(),
        connected_players,
        connections_by_gender,
        connections_by_month,
        connections_by_month_and_gender,
        average_session_duration,
    })
}

fn query_connections_by_gender(connection: &Connection) -> rusqlite::Result<Vec<CountByGender>> {
    let mut statement = connection.prepare(
        r#"
        SELECT gender, COUNT(*) AS total
        FROM player_sessions
        GROUP BY gender
        ORDER BY total DESC, gender ASC
        "#,
    )?;

    statement
        .query_map([], |row| {
            Ok(CountByGender {
                gender: row.get(0)?,
                total: row.get(1)?,
            })
        })?
        .collect()
}

fn query_connections_by_month(connection: &Connection) -> rusqlite::Result<Vec<CountByMonth>> {
    let mut statement = connection.prepare(
        r#"
        SELECT strftime('%Y-%m', connected_at) AS month, COUNT(*) AS total
        FROM player_sessions
        GROUP BY month
        ORDER BY month ASC
        "#,
    )?;

    statement
        .query_map([], |row| {
            Ok(CountByMonth {
                month: row.get(0)?,
                total: row.get(1)?,
            })
        })?
        .collect()
}

fn query_connections_by_month_and_gender(
    connection: &Connection,
) -> rusqlite::Result<Vec<CountByMonthAndGender>> {
    let mut statement = connection.prepare(
        r#"
        SELECT strftime('%Y-%m', connected_at) AS month, gender, COUNT(*) AS total
        FROM player_sessions
        GROUP BY month, gender
        ORDER BY month ASC, gender ASC
        "#,
    )?;

    statement
        .query_map([], |row| {
            Ok(CountByMonthAndGender {
                month: row.get(0)?,
                gender: row.get(1)?,
                total: row.get(2)?,
            })
        })?
        .collect()
}

fn query_average_session_duration(connection: &Connection) -> rusqlite::Result<AverageSessionDuration> {
    let average_duration_seconds = connection.query_row(
        r#"
        SELECT COALESCE(AVG(
            CASE
                WHEN duration_seconds IS NOT NULL THEN duration_seconds
                ELSE MAX(0, CAST((julianday('now') - julianday(connected_at)) * 86400 AS INTEGER))
            END
        ), 0.0)
        FROM player_sessions
        "#,
        [],
        |row| row.get::<_, f64>(0),
    )?;

    let mut statement = connection.prepare(
        r#"
        SELECT
            gender,
            COALESCE(AVG(
                CASE
                    WHEN duration_seconds IS NOT NULL THEN duration_seconds
                    ELSE MAX(0, CAST((julianday('now') - julianday(connected_at)) * 86400 AS INTEGER))
                END
            ), 0.0) AS average_duration_seconds
        FROM player_sessions
        GROUP BY gender
        ORDER BY gender ASC
        "#,
    )?;

    let by_gender = statement
        .query_map([], |row| {
            Ok(AverageDurationByGender {
                gender: row.get(0)?,
                average_duration_seconds: row.get(1)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(AverageSessionDuration {
        average_duration_seconds,
        by_gender,
    })
}
