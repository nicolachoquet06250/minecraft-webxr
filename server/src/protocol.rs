use std::{collections::HashMap, sync::{Mutex, OnceLock}};

use serde::{ser::SerializeStruct, Deserialize, Deserializer, Serialize, Serializer};

pub const CHUNK_SIZE_X: usize = 16;
pub const CHUNK_SIZE_Y: usize = 96;
pub const CHUNK_SIZE_Z: usize = 16;

static PENDING_HELLO_USER_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static PLAYER_PUBLIC_USER_IDS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerTransform {
    pub position: [f32; 3],
    pub rotation: [f32; 2],
    pub velocity: [f32; 3],
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlayerPublicState {
    pub player_id: String,
    pub nickname: String,
    pub transform: PlayerTransform,
}

impl Serialize for PlayerPublicState {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let user_id = player_public_user_id(&self.player_id);
        let mut fields = serializer.serialize_struct(
            "PlayerPublicState",
            if user_id.is_some() { 4 } else { 3 },
        )?;
        fields.serialize_field("player_id", &self.player_id)?;
        if let Some(user_id) = user_id {
            fields.serialize_field("user_id", &user_id)?;
        }
        fields.serialize_field("nickname", &self.nickname)?;
        fields.serialize_field("transform", &self.transform)?;
        fields.end()
    }
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
enum ClientMessageWire {
    Hello {
        lobby_id: String,
        nickname: String,
        #[serde(default)]
        user_id: Option<String>,
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

impl<'de> Deserialize<'de> for ClientMessage {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let message = ClientMessageWire::deserialize(deserializer)?;

        Ok(match message {
            ClientMessageWire::Hello { lobby_id, nickname, user_id, gender } => {
                remember_pending_hello_user_id(user_id);
                ClientMessage::Hello { lobby_id, nickname, gender }
            }
            ClientMessageWire::RequestChunk { chunk_x, chunk_z } => {
                ClientMessage::RequestChunk { chunk_x, chunk_z }
            }
            ClientMessageWire::SetBlock { world_x, world_y, world_z, block_id } => {
                ClientMessage::SetBlock { world_x, world_y, world_z, block_id }
            }
            ClientMessageWire::PlayerTransform { position, rotation, velocity } => {
                ClientMessage::PlayerTransform { position, rotation, velocity }
            }
            ClientMessageWire::Chat { message } => ClientMessage::Chat { message },
            ClientMessageWire::Ping { client_time_ms } => ClientMessage::Ping { client_time_ms },
        })
    }
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

pub fn take_pending_hello_user_id() -> Option<String> {
    let mut pending = pending_hello_user_id().lock().ok()?;
    pending.take()
}

pub fn remember_player_public_user_id(player_id: &str, user_id: Option<String>) {
    let Some(user_id) = user_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        forget_player_public_user_id(player_id);
        return;
    };

    if let Ok(mut user_ids) = player_public_user_ids().lock() {
        user_ids.insert(player_id.to_string(), user_id);
    }
}

pub fn forget_player_public_user_id(player_id: &str) {
    if let Ok(mut user_ids) = player_public_user_ids().lock() {
        user_ids.remove(player_id);
    }
}

fn remember_pending_hello_user_id(user_id: Option<String>) {
    if let Ok(mut pending) = pending_hello_user_id().lock() {
        *pending = user_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
    }
}

fn player_public_user_id(player_id: &str) -> Option<String> {
    player_public_user_ids()
        .lock()
        .ok()
        .and_then(|user_ids| user_ids.get(player_id).cloned())
}

fn pending_hello_user_id() -> &'static Mutex<Option<String>> {
    PENDING_HELLO_USER_ID.get_or_init(|| Mutex::new(None))
}

fn player_public_user_ids() -> &'static Mutex<HashMap<String, String>> {
    PLAYER_PUBLIC_USER_IDS.get_or_init(|| Mutex::new(HashMap::new()))
}
