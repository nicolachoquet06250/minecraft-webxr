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
