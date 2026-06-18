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

export async function consumeCentralJoinTicketFromUrl(): Promise<boolean> {
  const ticket = readCentralJoinTicketFromHash();
  if (!ticket || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return false;

  const session = await exchangeCentralJoinTicket(ticket);
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
  clearCentralJoinTicketFromHash();
  return true;
}

async function exchangeCentralJoinTicket(ticket: string): Promise<JoinTicketSession> {
  const response = await fetch('/api/auth/central-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ ticket }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `HTTP error! status: ${response.status}`);
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
