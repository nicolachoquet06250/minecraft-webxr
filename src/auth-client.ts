export type AuthUser = {
  id: string;
  username: string;
  email: string;
  avatar?: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

type LoginPayload = {
  email: string;
  password: string;
};

type CentralPresenceSession = {
  nickname: string;
  playerId: string | null;
  joined: boolean;
  socket: WebSocket | null;
};

type WebSocketSendPayload = Parameters<WebSocket["send"]>[0];

const AUTH_TOKEN_STORAGE_KEY = "auth_token";
const AUTH_USER_STORAGE_KEY = "voxicraft:auth:user";
const AUTH_CHANGED_EVENT = "voxicraft-auth-changed";
const DEFAULT_CENTRAL_AUTH_API_BASE_URL = "https://central.voxicraft.fr/api";
const PROFILE_PIC_ENDPOINT_PATH = "/users/me/profile-pic.svg";
const MULTIPLAYER_HELLO_TYPE = "hello";
const MULTIPLAYER_WELCOME_TYPE = "welcome";
const CENTRAL_JOIN_TYPE = "multiplayer_join";
const CENTRAL_LEAVE_TYPE = "multiplayer_leave";
const centralPresenceSessions = new WeakMap<WebSocket, CentralPresenceSession>();
let websocketBridgeInstalled = false;

installCentralPresenceBridge();

export function getAuthSession(): AuthSession | null {
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const rawUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!token) {
      return null;
    }

    if (!rawUser) {
      return {
        token,
        user: {
          id: "",
          username: "joueur",
          email: "",
        },
      };
    }

    const user = JSON.parse(rawUser) as AuthUser;

    if (!user || typeof user.username !== "string") {
      return null;
    }

    return { token, user };
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAuthSession() !== null;
}

export function logoutFromRelaySession(): void {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: null }));
}

export async function loginWithRelay(payload: LoginPayload): Promise<AuthSession> {
  const response = await fetch(`${resolveRelayAuthApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status));
  }

  const session = parseAuthSession(body);
  saveAuthSession(session);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
  return session;
}

export async function loadProfilePicSvgObjectUrl(session: AuthSession): Promise<string> {
  const url = `${resolveCentralAuthApiBaseUrl()}${PROFILE_PIC_ENDPOINT_PATH}?t=${Date.now()}`;
  console.debug("[Voxicraft] Chargement de la photo de profil", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "image/svg+xml",
      Authorization: `Bearer ${session.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Impossible de récupérer l'image de profil (${response.status})`);
  }

  const contentType = response.headers.get("Content-Type") || "image/svg+xml";
  const blob = await response.blob();
  const typedBlob = blob.type ? blob : new Blob([blob], { type: contentType });

  return URL.createObjectURL(typedBlob);
}

function installCentralPresenceBridge(): void {
  if (websocketBridgeInstalled || typeof window === "undefined") {
    return;
  }

  websocketBridgeInstalled = true;
  const originalSend = window.WebSocket.prototype.send;
  const originalClose = window.WebSocket.prototype.close;
  const originalAddEventListener = window.WebSocket.prototype.addEventListener;

  window.WebSocket.prototype.send = function patchedSend(this: WebSocket, data: WebSocketSendPayload): void {
    rememberMultiplayerHello(this, data);
    originalSend.call(this, data);
  };

  window.WebSocket.prototype.close = function patchedClose(this: WebSocket, code?: number, reason?: string): void {
    notifyCentralPresenceLeave(this);
    originalClose.call(this, code, reason);
  };

  window.WebSocket.prototype.addEventListener = function patchedAddEventListener(
    this: WebSocket,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (type !== "message") {
      originalAddEventListener.call(this, type, listener, options);
      return;
    }

    const wrappedListener: EventListener = (event) => {
      inspectMultiplayerWelcome(this, event);
      if (typeof listener === "function") {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
    };

    originalAddEventListener.call(this, type, wrappedListener, options);
  };
}

function rememberMultiplayerHello(socket: WebSocket, data: unknown): void {
  if (typeof data !== "string") {
    return;
  }

  try {
    const message = JSON.parse(data) as { type?: string; payload?: { nickname?: string } };
    if (message.type !== MULTIPLAYER_HELLO_TYPE || !message.payload?.nickname) {
      return;
    }

    centralPresenceSessions.set(socket, {
      nickname: message.payload.nickname,
      playerId: null,
      joined: false,
      socket: null,
    });
  } catch {
    // Ignore non JSON websocket frames.
  }
}

function inspectMultiplayerWelcome(socket: WebSocket, event: Event): void {
  const messageEvent = event as MessageEvent;
  if (typeof messageEvent.data !== "string") {
    return;
  }

  const presenceSession = centralPresenceSessions.get(socket);
  if (!presenceSession) {
    return;
  }

  try {
    const message = JSON.parse(messageEvent.data) as { type?: string; payload?: { player_id?: string } };
    if (message.type !== MULTIPLAYER_WELCOME_TYPE || !message.payload?.player_id) {
      return;
    }

    presenceSession.playerId = message.payload.player_id;
    notifyCentralPresenceJoin(presenceSession);
  } catch {
    // Ignore non protocol frames.
  }
}

function notifyCentralPresenceJoin(presenceSession: CentralPresenceSession): void {
  if (presenceSession.joined || !presenceSession.playerId) {
    return;
  }

  const authSession = getAuthSession();
  if (!authSession?.token || !authSession.user.id) {
    return;
  }

  const centralSocket = new WebSocket(resolveCentralPresenceSocketUrl(authSession.token));
  presenceSession.socket = centralSocket;
  centralSocket.addEventListener("open", () => {
    centralSocket.send(JSON.stringify({
      type: CENTRAL_JOIN_TYPE,
      payload: {
        player_id: presenceSession.playerId,
        nickname: presenceSession.nickname,
        game_domain: window.location.origin,
      },
    }));
    presenceSession.joined = true;
  });
  centralSocket.addEventListener("error", () => centralSocket.close());
}

function notifyCentralPresenceLeave(multiplayerSocket: WebSocket): void {
  const presenceSession = centralPresenceSessions.get(multiplayerSocket);
  if (!presenceSession?.joined || !presenceSession.playerId || !presenceSession.socket) {
    return;
  }

  const centralSocket = presenceSession.socket;
  const payload = JSON.stringify({
    type: CENTRAL_LEAVE_TYPE,
    payload: {
      player_id: presenceSession.playerId,
      nickname: presenceSession.nickname,
      game_domain: window.location.origin,
    },
  });

  if (centralSocket.readyState === WebSocket.OPEN) {
    centralSocket.send(payload);
    centralSocket.close(1000, "multiplayer_left");
  }

  presenceSession.joined = false;
  presenceSession.socket = null;
  centralPresenceSessions.delete(multiplayerSocket);
}

function resolveCentralPresenceSocketUrl(token: string): string {
  const customUrl = import.meta.env.VITE_CENTRAL_PRESENCE_WS_URL as string | undefined;
  if (customUrl && customUrl.trim().length > 0) {
    const url = new URL(customUrl.trim());
    url.searchParams.set("auth", token);
    return url.toString();
  }

  const baseUrl = new URL(resolveCentralAuthApiBaseUrl());
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/friends/presence/realtime`;
  baseUrl.searchParams.set("auth", token);
  return baseUrl.toString();
}

function saveAuthSession(session: AuthSession): void {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
}

function resolveRelayAuthApiBaseUrl(): string {
  const customUrl = import.meta.env.VITE_AUTH_API_URL as string | undefined;

  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim().replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return `${window.location.origin}/api`;
  }

  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : "";

  return `${protocol}//${host}${port}/api`;
}

function resolveCentralAuthApiBaseUrl(): string {
  const customUrl = import.meta.env.VITE_AUTH_API_URL as string | undefined;

  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim().replace(/\/$/, "");
  }

  return DEFAULT_CENTRAL_AUTH_API_BASE_URL;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parseAuthSession(body: unknown): AuthSession {
  if (!isRecord(body) || typeof body.token !== "string" || !isRecord(body.user)) {
    throw new Error("Réponse de connexion invalide");
  }

  const user = body.user;

  if (
    typeof user.id !== "string"
    || typeof user.username !== "string"
    || typeof user.email !== "string"
  ) {
    throw new Error("Profil utilisateur invalide");
  }

  return {
    token: body.token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: typeof user.avatar === "string" ? user.avatar : undefined,
    },
  };
}

function getErrorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.message === "string") {
    return body.message;
  }

  if (status === 401) {
    return "Email ou mot de passe incorrect";
  }

  if (status === 400) {
    return "Identifiants invalides";
  }

  return "Connexion impossible pour le moment";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
