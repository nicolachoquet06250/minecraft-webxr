use std::collections::{BTreeSet, HashMap};

use serde::Serialize;
use tokio::sync::mpsc;

use crate::protocol::{
    CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, PlayerPublicState, PlayerTransform, ServerMessage,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ChunkCoord {
    pub x: i32,
    pub z: i32,
}

#[derive(Debug, Clone)]
pub struct ChunkState {
    pub blocks: Vec<u8>,
    pub chunk_version: u64,
}

#[derive(Debug, Clone)]
pub struct PlayerState {
    pub id: u64,
    pub lobby_id: String,
    pub nickname: String,
    pub gender: String,
    pub connected_at: String,
    pub stats_session_id: Option<i64>,
    pub transform: PlayerTransform,
}

#[derive(Debug, Clone)]
pub struct LobbyState {
    pub id: String,
    pub players: BTreeSet<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LobbySummary {
    pub lobby_id: String,
    pub players: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectedPlayerSummary {
    pub player_id: String,
    pub lobby_id: String,
    pub nickname: String,
    pub gender: String,
    pub connected_at: String,
    pub transform: PlayerTransform,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServerSummary {
    pub seed: u32,
    pub world_version: u64,
    pub loaded_chunks: usize,
    pub connected_players: usize,
    pub lobbies: Vec<LobbySummary>,
}

pub struct RegisterPlayerResult {
    pub player: PlayerState,
    pub welcome: ServerMessage,
    pub lobby_state: ServerMessage,
}

pub struct ServerState {
    pub seed: u32,
    pub world_version: u64,
    next_player_id: u64,
    chunks: HashMap<ChunkCoord, ChunkState>,
    players: HashMap<u64, PlayerState>,
    lobbies: HashMap<String, LobbyState>,
    sessions: HashMap<u64, mpsc::UnboundedSender<ServerMessage>>,
}

impl ServerState {
    pub fn new(seed: u32) -> Self {
        Self {
            seed,
            world_version: 0,
            next_player_id: 1,
            chunks: HashMap::new(),
            players: HashMap::new(),
            lobbies: HashMap::new(),
            sessions: HashMap::new(),
        }
    }

    pub fn summary(&self) -> ServerSummary {
        let mut lobbies: Vec<LobbySummary> = self
            .lobbies
            .values()
            .map(|lobby| LobbySummary {
                lobby_id: lobby.id.clone(),
                players: lobby.players.len(),
            })
            .collect();

        lobbies.sort_by(|a, b| a.lobby_id.cmp(&b.lobby_id));

        ServerSummary {
            seed: self.seed,
            world_version: self.world_version,
            loaded_chunks: self.chunks.len(),
            connected_players: self.players.len(),
            lobbies,
        }
    }

    pub fn connected_players_summary(&self) -> Vec<ConnectedPlayerSummary> {
        let mut players: Vec<ConnectedPlayerSummary> = self
            .players
            .values()
            .map(|player| ConnectedPlayerSummary {
                player_id: player_id_to_wire(player.id),
                lobby_id: player.lobby_id.clone(),
                nickname: player.nickname.clone(),
                gender: player.gender.clone(),
                connected_at: player.connected_at.clone(),
                transform: player.transform.clone(),
            })
            .collect();

        players.sort_by(|a, b| a.connected_at.cmp(&b.connected_at));
        players
    }

    pub fn register_player(
        &mut self,
        lobby_id: String,
        nickname: String,
        gender: String,
        connected_at: String,
        stats_session_id: Option<i64>,
        tx: mpsc::UnboundedSender<ServerMessage>,
    ) -> RegisterPlayerResult {
        let player_id = self.next_player_id;
        self.next_player_id = self.next_player_id.saturating_add(1);

        let player = PlayerState {
            id: player_id,
            lobby_id: lobby_id.clone(),
            nickname,
            gender,
            connected_at,
            stats_session_id,
            transform: PlayerTransform::default(),
        };

        self.players.insert(player_id, player.clone());
        self.sessions.insert(player_id, tx);

        let lobby = self
            .lobbies
            .entry(lobby_id.clone())
            .or_insert_with(|| LobbyState {
                id: lobby_id.clone(),
                players: BTreeSet::new(),
            });

        lobby.players.insert(player_id);

        let welcome = ServerMessage::Welcome {
            player_id: player_id_to_wire(player_id),
            lobby_id: lobby_id.clone(),
            seed: self.seed,
            chunk_size: [CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z],
            world_version: self.world_version,
        };

        let lobby_state = ServerMessage::LobbyState {
            lobby_id,
            players: self.lobby_players_public(&player.lobby_id),
        };

        RegisterPlayerResult {
            player,
            welcome,
            lobby_state,
        }
    }

    pub fn player(&self, player_id: u64) -> Option<&PlayerState> {
        self.players.get(&player_id)
    }

    pub fn set_player_stats_session_id(&mut self, player_id: u64, stats_session_id: i64) {
        if let Some(player) = self.players.get_mut(&player_id) {
            player.stats_session_id = Some(stats_session_id);
        }
    }

    pub fn update_player_transform(&mut self, player_id: u64, transform: PlayerTransform) -> bool {
        if let Some(player) = self.players.get_mut(&player_id) {
            player.transform = transform;
            self.world_version = self.world_version.saturating_add(1);
            return true;
        }

        false
    }

    pub fn remove_player(&mut self, player_id: u64) -> Option<(PlayerState, String, ServerMessage)> {
        let player = self.players.remove(&player_id)?;
        self.sessions.remove(&player_id);

        if let Some(lobby) = self.lobbies.get_mut(&player.lobby_id) {
            lobby.players.remove(&player_id);
            if lobby.players.is_empty() {
                self.lobbies.remove(&player.lobby_id);
            }
        }

        let lobby_id = player.lobby_id.clone();
        let message = ServerMessage::PlayerLeft {
            lobby_id: lobby_id.clone(),
            player_id: player_id_to_wire(player_id),
        };

        Some((player, lobby_id, message))
    }

    pub fn lobby_state_message(&self, lobby_id: &str) -> ServerMessage {
        ServerMessage::LobbyState {
            lobby_id: lobby_id.to_owned(),
            players: self.lobby_players_public(lobby_id),
        }
    }

    pub fn lobby_players_public(&self, lobby_id: &str) -> Vec<PlayerPublicState> {
        let mut players = Vec::new();

        if let Some(lobby) = self.lobbies.get(lobby_id) {
            for player_id in &lobby.players {
                if let Some(player) = self.players.get(player_id) {
                    players.push(PlayerPublicState {
                        player_id: player_id_to_wire(player.id),
                        nickname: player.nickname.clone(),
                        transform: player.transform.clone(),
                    });
                }
            }
        }

        players
    }

    pub fn get_or_create_chunk(&mut self, chunk_x: i32, chunk_z: i32) -> ChunkState {
        let coord = ChunkCoord { x: chunk_x, z: chunk_z };

        if !self.chunks.contains_key(&coord) {
            let chunk = ChunkState {
                blocks: generate_chunk(chunk_x, chunk_z, self.seed),
                chunk_version: 1,
            };

            self.chunks.insert(coord, chunk);
        }

        self.chunks.get(&coord).expect("chunk should exist").clone()
    }

    pub fn set_block(
        &mut self,
        world_x: i32,
        world_y: i32,
        world_z: i32,
        block_id: u8,
    ) -> Result<u64, &'static str> {
        if !(0..CHUNK_SIZE_Y as i32).contains(&world_y) {
            return Err("world_y out of bounds");
        }

        let chunk_x = div_floor(world_x, CHUNK_SIZE_X as i32);
        let chunk_z = div_floor(world_z, CHUNK_SIZE_Z as i32);
        let local_x = world_x - chunk_x * CHUNK_SIZE_X as i32;
        let local_z = world_z - chunk_z * CHUNK_SIZE_Z as i32;
        let index = block_index(local_x as usize, world_y as usize, local_z as usize);

        let chunk = self
            .chunks
            .entry(ChunkCoord { x: chunk_x, z: chunk_z })
            .or_insert_with(|| ChunkState {
                blocks: generate_chunk(chunk_x, chunk_z, self.seed),
                chunk_version: 1,
            });

        if index >= chunk.blocks.len() {
            return Err("invalid block index");
        }

        chunk.blocks[index] = block_id;
        chunk.chunk_version = chunk.chunk_version.saturating_add(1);
        self.world_version = self.world_version.saturating_add(1);

        Ok(self.world_version)
    }

    pub fn broadcast_to_lobby(
        &self,
        lobby_id: &str,
        message: &ServerMessage,
        skip_player_id: Option<u64>,
    ) {
        let Some(lobby) = self.lobbies.get(lobby_id) else {
            return;
        };

        for player_id in &lobby.players {
            if skip_player_id.is_some_and(|skip| skip == *player_id) {
                continue;
            }

            if let Some(tx) = self.sessions.get(player_id) {
                let _ = tx.send(message.clone());
            }
        }
    }
}

pub fn player_id_to_wire(player_id: u64) -> String {
    format!("p{player_id}")
}

fn block_index(local_x: usize, y: usize, local_z: usize) -> usize {
    y * CHUNK_SIZE_X * CHUNK_SIZE_Z + local_z * CHUNK_SIZE_X + local_x
}

fn div_floor(a: i32, b: i32) -> i32 {
    let d = a / b;
    let r = a % b;

    if r != 0 && (r > 0) != (b > 0) {
        d - 1
    } else {
        d
    }
}

fn generate_chunk(chunk_x: i32, chunk_z: i32, seed: u32) -> Vec<u8> {
    let mut blocks = vec![0_u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];
    let sea_level = 42_i32;

    for local_x in 0..CHUNK_SIZE_X {
        for local_z in 0..CHUNK_SIZE_Z {
            let world_x = chunk_x * CHUNK_SIZE_X as i32 + local_x as i32;
            let world_z = chunk_z * CHUNK_SIZE_Z as i32 + local_z as i32;
            let noise_a = coord_noise(world_x, world_z, seed);
            let noise_b = coord_noise(world_x / 2, world_z / 2, seed.wrapping_add(99));
            let height = 24_i32 + (noise_a % 28) as i32 + (noise_b % 10) as i32;
            let clamped_height = height.min(CHUNK_SIZE_Y as i32 - 1);

            for y in 0..CHUNK_SIZE_Y {
                let yi = y as i32;
                let block = if yi > clamped_height {
                    if yi <= sea_level { 17_u8 } else { 0_u8 }
                } else if yi == clamped_height {
                    if yi < sea_level { 14_u8 } else { 1_u8 }
                } else if yi > clamped_height - 4 {
                    2_u8
                } else {
                    6_u8
                };

                let idx = block_index(local_x, y, local_z);
                blocks[idx] = block;
            }
        }
    }

    blocks
}

fn coord_noise(x: i32, z: i32, seed: u32) -> u32 {
    let mut value = seed as u64;
    value ^= (x as i64 as u64).wrapping_mul(0x9E37_79B1_85EB_CA87);
    value ^= (z as i64 as u64).wrapping_mul(0xC2B2_AE3D_27D4_EB4F);
    value ^= value >> 33;
    value = value.wrapping_mul(0xFF51_AFD7_ED55_8CCD);
    value ^= value >> 33;
    value = value.wrapping_mul(0xC4CE_B9FE_1A85_EC53);
    value ^= value >> 33;
    (value & 0xFFFF_FFFF) as u32
}
