import type { AuthSession, AuthUser } from './auth-client';

const ACCESS_STORAGE_KEY = 'auth_token';
const RENEW_STORAGE_KEY = 'auth_refresh';
const USER_STORAGE_KEY = 'voxicraft:auth:user';
const AUTH_CHANGED_EVENT = 'voxicraft-auth-changed';
const DEFAULT_CENTRAL_API_BASE_URL = 'https://central.voxicraft.fr/api';

type IssueResponse = {
  refresh: string;
};

type RotateResponse = {
  token: string;
  refresh: string;
  user: AuthUser;
};

export async function issueAuthRefresh(accessToken: string): Promise<void> {
  const response = await fetch(`${resolveCentralApiBaseUrl()}/auth/refresh/issue`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return;
  const body = await response.json().catch(() => null) as IssueResponse | null;
  if (body?.refresh) localStorage.setItem(RENEW_STORAGE_KEY, body.refresh);
}

export async function rotateAuthSession(): Promise<AuthSession | null> {
  const refresh = localStorage.getItem(RENEW_STORAGE_KEY);
  if (!refresh) return null;

  const response = await fetch(`${resolveCentralApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearStoredAuth();
    return null;
  }

  const body = await response.json().catch(() => null) as RotateResponse | null;
  if (!body?.token || !body.refresh || !body.user) {
    clearStoredAuth();
    return null;
  }

  const session = { token: body.token, user: body.user };
  localStorage.setItem(ACCESS_STORAGE_KEY, body.token);
  localStorage.setItem(RENEW_STORAGE_KEY, body.refresh);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(body.user));
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
  return session;
}

export async function revokeAuthRefresh(): Promise<void> {
  const refresh = localStorage.getItem(RENEW_STORAGE_KEY);
  if (!refresh) return;

  await fetch(`${resolveCentralApiBaseUrl()}/auth/refresh/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh }),
  }).catch(() => undefined);
}

export function clearStoredAuth(): void {
  localStorage.removeItem(ACCESS_STORAGE_KEY);
  localStorage.removeItem(RENEW_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: null }));
}

function resolveCentralApiBaseUrl(): string {
  const customUrl = import.meta.env.VITE_CENTRAL_API_URL as string | undefined;
  if (customUrl && customUrl.trim().length > 0) return customUrl.trim().replace(/\/$/, '');
  return DEFAULT_CENTRAL_API_BASE_URL;
}
