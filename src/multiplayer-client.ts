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

const GAME_MODE_STORAGE_KEY = "voxicraft:game-mode";

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
  private socket: WebSocket | null = null;
  private connected = false;

  constructor(options: MultiplayerClientOptions) {
    this.wsUrl = options.wsUrl;
    this.lobbyId = options.lobbyId;
    this.nickname = options.nickname;
    this.userId = options.userId?.trim() || null;
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
          this.handlers.onWelcome?.(welcome);

          if (!settled) {
            settled = true;
            window.clearTimeout(timeoutHandle);
            resolve(welcome);
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
        this.connected = false;

        if (!settled) {
          settled = true;
          window.clearTimeout(timeoutHandle);
          reject(new Error("Connexion WebSocket fermée avant welcome"));
        }

        this.handlers.onClose?.();
      });
    });
  }

  disconnect(): void {
    this.connected = false;
    this.socket?.close();
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

  sendPing(clientTimeMs: number): void {
    this.sendRaw({
      type: "ping",
      payload: {
        client_time_ms: clientTimeMs,
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

  private dispatchMessage(message: ServerMessage): void {
    switch (message.type) {
      case "lobby_state":
        this.handlers.onLobbyState?.(message.payload.players);
        return;
      case "player_joined":
        this.handlers.onPlayerJoined?.(message.payload.player);
        return;
      case "player_left":
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
      case "player_transform":
        this.handlers.onPlayerTransform?.(message.payload.player_id, message.payload.transform);
        return;
      case "error":
        this.handlers.onError?.(message.payload.code, message.payload.message);
        return;
      case "chat":
      case "pong":
      case "welcome":
        return;
      default:
        return;
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
