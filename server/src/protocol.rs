use serde::{Deserialize, Serialize};

pub const CHUNK_SIZE_X: usize = 16;
pub const CHUNK_SIZE_Y: usize = 96;
pub const CHUNK_SIZE_Z: usize = 16;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerTransform {
    pub position: [f32; 3],
    pub rotation: [f32; 2],
    pub velocity: [f32; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerPublicState {
    pub player_id: String,
    pub nickname: String,
    pub transform: PlayerTransform,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ClientMessage {
    Hello {
        lobby_id: String,
        nickname: String,
        #[serde(default)]
        gender: Option<String>,
    },
    RequestChunk { chunk_x: i32, chunk_z: i32 },
    SetBlock {
        world_x: i32,
        world_y: i32,
        world_z: i32,
        block_id: u8,
    },
    PlayerTransform {
        position: [f32; 3],
        rotation: [f32; 2],
        velocity: [f32; 3],
    },
    Chat { message: String },
    Ping { client_time_ms: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ServerMessage {
    Welcome {
        player_id: String,
        lobby_id: String,
        seed: u32,
        chunk_size: [usize; 3],
        world_version: u64,
    },
    LobbyState {
        lobby_id: String,
        players: Vec<PlayerPublicState>,
    },
    PlayerJoined {
        lobby_id: String,
        player: PlayerPublicState,
    },
    PlayerLeft {
        lobby_id: String,
        player_id: String,
    },
    ChunkData {
        chunk_x: i32,
        chunk_z: i32,
        blocks: Vec<u8>,
        chunk_version: u64,
        world_version: u64,
    },
    BlockUpdated {
        world_x: i32,
        world_y: i32,
        world_z: i32,
        block_id: u8,
        world_version: u64,
    },
    PlayerTransform {
        player_id: String,
        transform: PlayerTransform,
        world_version: u64,
    },
    Chat {
        player_id: String,
        nickname: String,
        message: String,
        world_version: u64,
    },
    Pong {
        server_time_ms: u64,
        client_time_ms: u64,
    },
    Error {
        code: String,
        message: String,
    },
}
