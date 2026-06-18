import { issueAuthRefresh } from './auth-refresh-client';

const CENTRAL_JOIN_TICKET_HASH_KEY = 'central_join_ticket';
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
const AUTH_USER_STORAGE_KEY = 'voxicraft:auth:user';
const AUTH_CHANGED_EVENT = 'voxicraft-auth-changed';

type JoinTicketSession = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
};

export type CentralJoinTicketResult =
  | { status: 'none' }
  | { status: 'authenticated' }
  | { status: 'invalid'; message: string };

export async function consumeCentralJoinTicketFromUrl(): Promise<CentralJoinTicketResult> {
  const ticket = readCentralJoinTicketFromHash();
  if (!ticket) return { status: 'none' };

  try {
    const session = await exchangeCentralJoinTicket(ticket);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
    await issueAuthRefresh(session.token);
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
    clearCentralJoinTicketFromHash();
    return { status: 'authenticated' };
  } catch (error) {
    clearCentralJoinTicketFromHash();
    const message = error instanceof Error
      ? error.message
      : 'Ticket de connexion central invalide ou expiré';
    return { status: 'invalid', message };
  }
}

async function exchangeCentralJoinTicket(ticket: string): Promise<JoinTicketSession> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ central_join_ticket: ticket }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Ticket de connexion central invalide ou expiré (${response.status})`);
  }

  if (!body || typeof body.token !== 'string' || !body.user || typeof body.user.id !== 'string') {
    throw new Error('Réponse de connexion central invalide');
  }

  return body as JoinTicketSession;
}

function readCentralJoinTicketFromHash(): string | null {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const ticket = params.get(CENTRAL_JOIN_TICKET_HASH_KEY)?.trim();
  return ticket || null;
}

function clearCentralJoinTicketFromHash(): void {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  params.delete(CENTRAL_JOIN_TICKET_HASH_KEY);
  const nextHash = params.toString();
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ''}`;
  window.history.replaceState(null, document.title, nextUrl);
}
