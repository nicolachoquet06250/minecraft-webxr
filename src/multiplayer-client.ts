import { getAuthSession } from "./auth-client";
import { queueRemotePlayerAppearanceState, setRemotePlayerMiningState } from "./remote-player-appearance";

export type PlayerTransformPayload = {
  position: [number, number, number];
  rotation: [number, number];
  velocity: [number, number, number];
};

export type PlayerPublicState = {
  player_id: string;
  user_id?: string | null;
  nickname: string;
  transform: PlayerTransformPayload;
};

export type MultiplayerSyncEvent =
  | {
      kind: "block_breaking";
      action: "start" | "progress" | "cancel" | "finish";
      x: number;
      y: number;
      z: number;
      blockId: number;
      progress: number;
      stage: number;
    }
  | {
      kind: "drop_spawned";
      dropId: string;
      blockId: number;
      position: [number, number, number];
      velocity: [number, number, number];
    }
  | {
      kind: "drop_picked_up";
      dropId: string;
    };

const GAME_MODE_STORAGE_KEY = "voxicraft:game-mode";
const SYNC_CHAT_PREFIX = "__voxicraft_sync__:";
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_DELAY_MS = 750;
const RECONNECT_MAX_DELAY_MS = 8_000;
let activeMultiplayerClient: MultiplayerClient | null = null;

function isSinglePlayerMode(): boolean {
  try {
    return window.localStorage.getItem(GAME_MODE_STORAGE_KEY) === "singleplayer";
  } catch {
    return false;
  }
}

export type ServerMessage =
  | {
      type: "welcome";
      payload: {
        player_id: string;
        lobby_id: string;
        seed: number;
        chunk_size: [number, number, number];
        world_version: number;
      };
    }
  | {
      type: "lobby_state";
      payload: {
        lobby_id: string;
        players: PlayerPublicState[];
      };
    }
  | {
      type: "player_joined";
      payload: {
        lobby_id: string;
        player: PlayerPublicState;
      };
    }
  | {
      type: "player_left";
      payload: {
        lobby_id: string;
        player_id: string;
      };
    }
  | {
      type: "chunk_data";
      payload: {
        chunk_x: number;
        chunk_z: number;
        blocks: number[];
        chunk_version: number;
        world_version: number;
      };
    }
  | {
      type: "block_updated";
      payload: {
        world_x: number;
        world_y: number;
        world_z: number;
        block_id: number;
        world_version: number;
      };
    }
  | {
      type: "player_transform";
      payload: {
        player_id: string;
        transform: PlayerTransformPayload;
        world_version: number;
      };
    }
  | {
      type: "chat";
      payload: {
        player_id: string;
        nickname: string;
        message: string;
        world_version: number;
      };
    }
  | {
      type: "pong";
      payload: {
        server_time_ms: number;
        client_time_ms: number;
      };
    }
  | {
      type: "error";
      payload: {
        code: string;
        message: string;
      };
    };

type ClientMessage =
  | {
      type: "hello";
      payload: {
        lobby_id: string;
        nickname: string;
        user_id?: string | null;
      };
    }
  | {
      type: "request_chunk";
      payload: {
        chunk_x: number;
        chunk_z: number;
      };
    }
  | {
      type: "set_block";
      payload: {
        world_x: number;
        world_y: number;
        world_z: number;
        block_id: number;
      };
    }
  | {
      type: "player_transform";
      payload: PlayerTransformPayload;
    }
  | {
      type: "chat";
      payload: {
        message: string;
      };
    }
  | {
      type: "ping";
      payload: {
        client_time_ms: number;
      };
    };

export type MultiplayerWelcome = {
  playerId: string;
  lobbyId: string;
  seed: number;
  chunkSize: [number, number, number];
};

export type MultiplayerClientHandlers = {
  onWelcome?: (welcome: MultiplayerWelcome) => void;
  onLobbyState?: (players: PlayerPublicState[]) => void;
  onPlayerJoined?: (player: PlayerPublicState) => void;
  onPlayerLeft?: (playerId: string) => void;
  onChunkData?: (chunkX: number, chunkZ: number, blocks: Uint8Array) => void;
  onBlockUpdated?: (x: number, y: number, z: number, blockId: number) => void;
  onPlayerTransform?: (playerId: string, transform: PlayerTransformPayload) => void;
  onError?: (code: string, message: string) => void;
  onClose?: () => void;
  onReconnect?: () => void;
};

type MultiplayerClientOptions = {
  wsUrl: string;
  lobbyId: string;
  nickname: string;
  userId?: string | null;
  handlers?: MultiplayerClientHandlers;
};

export class MultiplayerClient {
  private readonly wsUrl: string;
  private readonly lobbyId: string;
  private readonly nickname: string;
  private readonly userId: string | null;
  private readonly handlers: MultiplayerClientHandlers;
  private readonly knownPlayers = new Map<string, PlayerPublicState>();
  private socket: WebSocket | null = null;
  private connected = false;
  private localPlayerId: string | null = null;
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimerId: number | null = null;
  private heartbeatTimerId: number | null = null;
  private watchdogTimerId: number | null = null;
  private lastPongAt = 0;
  private lifecycleListenersInstalled = false;
  private manualDisconnect = false;

  static disconnectActiveSession(): void {
    activeMultiplayerClient?.disconnect();
  }

  static syncEvent(event: MultiplayerSyncEvent): void {
    activeMultiplayerClient?.sendSyncEvent(event);
  }

  constructor(options: MultiplayerClientOptions) {
    this.wsUrl = options.wsUrl;
    this.lobbyId = options.lobbyId;
    this.nickname = options.nickname;
    this.userId = options.userId?.trim() || getAuthSession()?.user.id?.trim() || null;
    this.handlers = options.handlers ?? {};
  }

  isConnected(): boolean {
    return this.connected;
  }

  connect(timeoutMs = 5000): Promise<MultiplayerWelcome> {
    if (isSinglePlayerMode()) {
      return Promise.reject(new Error("Mode solo local: WebSocket désactivé"));
    }

    if (this.socket && this.connected) {
      return Promise.reject(new Error("WebSocket déjà connecté"));
    }

    this.shouldReconnect = true;
    this.manualDisconnect = false;
    this.installLifecycleListeners();

    return this.openSocket(timeoutMs);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.manualDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.connected = false;
    this.localPlayerId = null;
    this.knownPlayers.clear();

    if (activeMultiplayerClient === this) {
      activeMultiplayerClient = null;
    }

    this.socket?.close(1000, "client_disconnect");
    this.socket = null;
  }

  requestChunk(chunkX: number, chunkZ: number): void {
    this.sendRaw({
      type: "request_chunk",
      payload: {
        chunk_x: chunkX,
        chunk_z: chunkZ,
      },
    });
  }

  setBlock(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    this.sendRaw({
      type: "set_block",
      payload: {
        world_x: worldX,
        world_y: worldY,
        world_z: worldZ,
        block_id: blockId,
      },
    });
  }

  sendTransform(transform: PlayerTransformPayload): void {
    this.sendRaw({
      type: "player_transform",
      payload: transform,
    });
  }

  sendPing(clientTimeMs = Date.now()): void {
    this.sendRaw({
      type: "ping",
      payload: {
        client_time_ms: clientTimeMs,
      },
    });
  }

  private openSocket(timeoutMs): Promise<MultiplayerWelcome> {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.localPlayerId = null;

    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;

      const timeoutHandle = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        socket.close();
        reject(new Error("Timeout de connexion WebSocket"));
      }, timeoutMs);

      socket.addEventListener("open", () => {
        this.sendRaw({
          type: "hello",
          payload: {
            lobby_id: this.lobbyId,
            nickname: this.nickname,
            user_id: this.userId,
          },
        });
      });

      socket.addEventListener("message", (event) => {
        const message = this.parseServerMessage(event.data);

        if (!message) {
          return;
        }

        if (message.type === "welcome") {
          const welcome: MultiplayerWelcome = {
            playerId: message.payload.player_id,
            lobbyId: message.payload.lobby_id,
            seed: message.payload.seed,
            chunkSize: message.payload.chunk_size,
          };

          this.connected = true;
          this.localPlayerId = welcome.playerId;
          this.reconnectAttempts = 0;
          this.lastPongAt = Date.now();
          activeMultiplayerClient = this;
          this.startHeartbeat();
          this.handlers.onWelcome?.(welcome);

          if (!settled) {
            settled = true;
            window.clearTimeout(timeoutHandle);
            resolve(welcome);
          } else {
            this.handlers.onReconnect?.();
          }

          return;
        }

        this.dispatchMessage(message);
      });

      socket.addEventListener("error", () => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutHandle);
        reject(new Error("Erreur de connexion WebSocket"));
      });

      socket.addEventListener("close", () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.localPlayerId = null;
        this.stopHeartbeat();

        if (activeMultiplayerClient === this) {
          activeMultiplayerClient = null;
        }

        if (!settled) {
          settled = true;
          window.clearTimeout(timeoutHandle);
          reject(new Error("Connexion WebSocket fermée avant welcome"));
        }

        if (wasConnected) {
          this.handlers.onClose?.();
        }

        if (!this.manualDisconnect && this.shouldReconnect && !isSinglePlayerMode()) {
          this.scheduleReconnect();
        }
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimerId !== null || document.visibilityState === "hidden") {
      return;
    }

    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
    );
    this.reconnectAttempts += 1;

    this.reconnectTimerId = window.setTimeout(() => {
      this.reconnectTimerId = null;
      void this.openSocket().catch((error) => {
        console.warn("[Voxicraft] Reconnexion multijoueur impossible", error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimerId === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimerId);
    this.reconnectTimerId = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();

    this.heartbeatTimerId = window.setInterval(() => {
      this.sendPing(Date.now());
    }, HEARTBEAT_INTERVAL_MS);

    this.watchdogTimerId = window.setInterval(() => {
      if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        console.warn("[Voxicraft] WebSocket multijoueur inactif, reconnexion forcée");
        this.socket.close(4000, "heartbeat_timeout");
      }
    }, HEARTBEAT_INTERVAL_MS);

    this.sendPing(Date.now());
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimerId !== null) {
      window.clearInterval(this.heartbeatTimerId);
      this.heartbeatTimerId = null;
    }

    if (this.watchdogTimerId !== null) {
      window.clearInterval(this.watchdogTimerId);
      this.watchdogTimerId = null;
    }
  }

  private installLifecycleListeners(): void {
    if (this.lifecycleListenersInstalled) {
      return;
    }

    this.lifecycleListenersInstalled = true;

    document.addEventListener("visibilitychange", () => {
      if (!this.shouldReconnect || this.manualDisconnect) {
        return;
      }

      if (document.visibilityState === "hidden") {
        this.socket?.close(1001, "page_hidden");
        return;
      }

      if (!this.connected) {
        this.reconnectAttempts = 0;
        this.scheduleReconnect();
      }
    });

    window.addEventListener("pagehide", () => {
      if (!this.manualDisconnect) {
        this.socket?.close(1001, "page_hidden");
      }
    });

    window.addEventListener("online", () => {
      if (this.shouldReconnect && !this.connected && !this.manualDisconnect) {
        this.reconnectAttempts = 0;
        this.scheduleReconnect();
      }
    });
  }

  private sendSyncEvent(event: MultiplayerSyncEvent): void {
    this.sendRaw({
      type: "chat",
      payload: {
        message: `${SYNC_CHAT_PREFIX}${JSON.stringify(event)}`,
      },
    });
  }

  private parseServerMessage(raw: unknown): ServerMessage | null {
    if (typeof raw !== "string") {
      return null;
    }

    try {
      return JSON.parse(raw) as ServerMessage;
    } catch {
      return null;
    }
  }

  private sendRaw(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private rememberPlayer(player: PlayerPublicState): PlayerPublicState {
    const previous = this.knownPlayers.get(player.player_id);
    const merged: PlayerPublicState = {
      ...previous,
      ...player,
      nickname: player.nickname || previous?.nickname || "",
      user_id: player.user_id ?? previous?.user_id ?? null,
      transform: player.transform ?? previous?.transform,
    };

    this.knownPlayers.set(player.player_id, merged);
    return merged;
  }

  private queueRemoteAppearance(player: PlayerPublicState): void {
    if (player.player_id !== this.localPlayerId) {
      queueRemotePlayerAppearanceState(player);
    }
  }

  private dispatchMessage(message: ServerMessage): void {
    switch (message.type) {
      case "lobby_state": {
        const players = message.payload.players.map((player) => this.rememberPlayer(player));

        for (const player of players) {
          this.queueRemoteAppearance(player);
        }

        this.handlers.onLobbyState?.(players);
        return;
      }
      case "player_joined": {
        const player = this.rememberPlayer(message.payload.player);
        this.queueRemoteAppearance(player);
        this.handlers.onPlayerJoined?.(player);
        return;
      }
      case "player_left":
        this.knownPlayers.delete(message.payload.player_id);
        setRemotePlayerMiningState(message.payload.player_id, false);
        this.handlers.onPlayerLeft?.(message.payload.player_id);
        return;
      case "chunk_data":
        this.handlers.onChunkData?.(
          message.payload.chunk_x,
          message.payload.chunk_z,
          Uint8Array.from(message.payload.blocks),
        );
        return;
      case "block_updated":
        this.handlers.onBlockUpdated?.(
          message.payload.world_x,
          message.payload.world_y,
          message.payload.world_z,
          message.payload.block_id,
        );
        return;
      case "player_transform": {
        const knownPlayer = this.knownPlayers.get(message.payload.player_id);

        if (!knownPlayer) {
          return;
        }

        this.knownPlayers.set(message.payload.player_id, {
          ...knownPlayer,
          transform: message.payload.transform,
        });
        this.handlers.onPlayerTransform?.(message.payload.player_id, message.payload.transform);
        return;
      }
      case "error":
        this.handlers.onError?.(message.payload.code, message.payload.message);
        return;
      case "chat":
        this.dispatchSyncChat(message.payload.player_id, message.payload.message);
        return;
      case "pong":
        this.lastPongAt = Date.now();
        return;
      case "welcome":
        return;
      default:
        return;
    }
  }

  private dispatchSyncChat(playerId: string, message: string): void {
    if (!message.startsWith(SYNC_CHAT_PREFIX)) {
      return;
    }

    try {
      const event = JSON.parse(message.slice(SYNC_CHAT_PREFIX.length)) as MultiplayerSyncEvent;

      if (event.kind === "block_breaking") {
        setRemotePlayerMiningState(playerId, event.action === "start" || event.action === "progress");
      } else if (event.kind === "drop_picked_up") {
        setRemotePlayerMiningState(playerId, false);
      }

      window.dispatchEvent(new CustomEvent("voxicraft:multiplayer-sync", {
        detail: {
          playerId,
          event,
        },
      }));
    } catch (error) {
      console.warn("[Voxicraft] Sync multijoueur invalide", error);
    }
  }
}

export function resolveDefaultWsUrl(): string {
  const customUrl = import.meta.env.VITE_MULTIPLAYER_WS_URL as string | undefined;

  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.DEV ? window.location.host : window.location.hostname;

  return `${protocol}//${host}/ws`;
}
