import { getAuthSession } from "./auth-client";

const DEFAULT_CENTRAL_API_BASE_URL = "https://central.voxicraft.fr/api";

type PresenceEventType = "multiplayer_join" | "multiplayer_leave";

type PresencePayload = {
    player_id: string;
    nickname: string;
    game_domain: string;
    user_id?: string | null;
    central_user_id?: string | null;
};

export class CentralPresenceClient {
    private socket: WebSocket | null = null;
    private opened = false;
    private lastJoinPayload: PresencePayload | null = null;

    connect(): void {
        const session = getAuthSession();

        if (!session?.token || !session.user.id) {
            return;
        }

        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        const socket = new WebSocket(resolveCentralPresenceSocketUrl(session.token));
        this.socket = socket;
        this.opened = false;

        socket.addEventListener("open", () => {
            this.opened = true;

            if (this.lastJoinPayload) {
                this.send("multiplayer_join", this.withCurrentUser(this.lastJoinPayload));
            }
        });

        socket.addEventListener("close", () => {
            if (this.socket === socket) {
                this.socket = null;
                this.opened = false;
            }
        });

        socket.addEventListener("error", () => {
            socket.close();
        });
    }

    join(payload: PresencePayload): void {
        this.lastJoinPayload = this.withCurrentUser(payload);
        this.connect();

        if (this.opened) {
            this.send("multiplayer_join", this.lastJoinPayload);
        }
    }

    leave(): void {
        if (!this.lastJoinPayload) {
            return;
        }

        const payload = this.withCurrentUser(this.lastJoinPayload);
        this.lastJoinPayload = null;

        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.send("multiplayer_leave", payload);
        this.socket.close(1000, "multiplayer_left");
        this.socket = null;
        this.opened = false;
    }

    private send(type: PresenceEventType, payload: PresencePayload): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.socket.send(JSON.stringify({ type, payload: this.withCurrentUser(payload) }));
    }

    private withCurrentUser(payload: PresencePayload): PresencePayload {
        const userId = payload.user_id || payload.central_user_id || getAuthSession()?.user.id || null;
        return {
            ...payload,
            user_id: userId,
            central_user_id: userId,
        };
    }
}

function resolveCentralPresenceSocketUrl(token: string): string {
    const customUrl = import.meta.env.VITE_CENTRAL_PRESENCE_WS_URL as string | undefined;

    if (customUrl && customUrl.trim().length > 0) {
        const url = new URL(customUrl.trim());
        url.searchParams.set("auth", token);
        return url.toString();
    }

    const centralApiUrl =
        (import.meta.env.VITE_CENTRAL_API_URL as string | undefined)?.trim()
        || DEFAULT_CENTRAL_API_BASE_URL;

    const url = new URL(centralApiUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/friends/presence/realtime`;
    url.searchParams.set("auth", token);

    return url.toString();
}
