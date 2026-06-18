import { consumeCentralJoinTicketFromUrl } from './central-join-ticket';
import { issueAuthRefresh, revokeAuthRefresh, rotateAuthSession } from './auth-refresh-client';

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

const AUTH_TOKEN_STORAGE_KEY = "auth_token";
const AUTH_REFRESH_STORAGE_KEY = "auth_refresh";
const AUTH_USER_STORAGE_KEY = "voxicraft:auth:user";
const AUTH_CHANGED_EVENT = "voxicraft-auth-changed";
const DEFAULT_CENTRAL_AUTH_API_BASE_URL = "https://central.voxicraft.fr/api";
const PROFILE_PIC_ENDPOINT_PATH = "/users/me/profile-pic.svg";

void consumeCentralJoinTicketFromUrl().catch((error) => {
    console.warn("Impossible de consommer le ticket central", error);
});

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
    void revokeAuthRefresh();
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_REFRESH_STORAGE_KEY);
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
    await issueAuthRefresh(session.token);
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
    return session;
}

export async function loadProfilePicSvgObjectUrl(session: AuthSession): Promise<string> {
    const response = await fetchProfilePic(session.token);
    const finalResponse = response.status === 401
        ? await retryProfilePicWithRefresh(response)
        : response;

    if (!finalResponse.ok) {
        throw new Error(`Impossible de récupérer l'image de profil (${finalResponse.status})`);
    }

    const contentType = finalResponse.headers.get("Content-Type") || "image/svg+xml";
    const blob = await finalResponse.blob();
    const typedBlob = blob.type ? blob : new Blob([blob], { type: contentType });

    return URL.createObjectURL(typedBlob);
}

async function fetchProfilePic(token: string): Promise<Response> {
    const url = `${resolveCentralAuthApiBaseUrl()}${PROFILE_PIC_ENDPOINT_PATH}?t=${Date.now()}`;
    console.debug("[Voxicraft] Chargement de la photo de profil", url);

    return fetch(url, {
        method: "GET",
        headers: {
            Accept: "image/svg+xml",
            Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
    });
}

async function retryProfilePicWithRefresh(previousResponse: Response): Promise<Response> {
    const refreshedSession = await rotateAuthSession();
    if (!refreshedSession) return previousResponse;
    return fetchProfilePic(refreshedSession.token);
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
    const customUrl = import.meta.env.VITE_CENTRAL_API_URL as string | undefined;

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
