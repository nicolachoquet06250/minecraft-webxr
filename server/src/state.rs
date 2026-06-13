use std::collections::{BTreeSet, HashMap};

use serde::Serialize;
use tokio::sync::mpsc;

use crate::protocol::{
    forget_player_public_user_id, remember_player_public_user_id, take_pending_hello_user_id,
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
    pub user_id: Option<String>,
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
    pub user_id: Option<String>,
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
                user_id: player.user_id.clone(),
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
        let user_id = take_pending_hello_user_id();

        let player = PlayerState {
            id: player_id,
            user_id,
            lobby_id: lobby_id.clone(),
            nickname,
            gender,
            connected_at,
            stats_session_id,
            transform: PlayerTransform::default(),
        };

        self.players.insert(player_id, player.clone());
        self.sessions.insert(player_id, tx);
        remember_player_public_user_id(&player_id_to_wire(player_id), player.user_id.clone());

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
        forget_player_public_user_id(&player_id_to_wire(player_id));

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
                    let wire_player_id = player_id_to_wire(player.id);
                    remember_player_public_user_id(&wire_player_id, player.user_id.clone());
                    players.push(PlayerPublicState {
                        player_id: wire_player_id,
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
                blocks: voxel_wasm::generate_chunk(chunk_x, chunk_z, self.seed),
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
                blocks: voxel_wasm::generate_chunk(chunk_x, chunk_z, self.seed),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_server_chunks_match_voxel_wasm_generator() {
        let seed = 12345;
        let mut state = ServerState::new(seed);

        for (chunk_x, chunk_z) in [(0, 0), (1, 0), (0, 1), (-1, 2), (3, -4)] {
            let server_chunk = state.get_or_create_chunk(chunk_x, chunk_z);
            let wasm_chunk = voxel_wasm::generate_chunk(chunk_x, chunk_z, seed);

            assert_eq!(server_chunk.blocks, wasm_chunk);
        }
    }

    #[test]
    fn server_chunk_dimensions_match_voxel_wasm_module() {
        assert_eq!(CHUNK_SIZE_X, voxel_wasm::chunk_size_x());
        assert_eq!(CHUNK_SIZE_Y, voxel_wasm::chunk_size_y());
        assert_eq!(CHUNK_SIZE_Z, voxel_wasm::chunk_size_z());
    }
}
