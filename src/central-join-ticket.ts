import { getAuthSession, loginWithCentralJoinTicket } from './auth-client';

const CENTRAL_JOIN_TICKET_HASH_KEY = 'central_join_ticket';

export async function consumeCentralJoinTicketFromUrl(): Promise<boolean> {
  const ticket = readCentralJoinTicketFromHash();
  if (!ticket || getAuthSession()) return false;

  await loginWithCentralJoinTicket(ticket);
  clearCentralJoinTicketFromHash();
  return true;
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
