import { DEFAULT_CUSTOMER, eventSchema, recordingSchema, startSchema, summarySchema, type Character, type GameEvent, type RecordedTurn, type Role, type Summary } from './contract';
const REPLAY = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('replay');
export const MOCK = REPLAY === '1' || REPLAY === 'auto';
/** ?replay=auto plays the recorded tour without the viewer touching anything. */
export const AUTO = REPLAY === 'auto';
// In development the API runs on its own port; a production build is served by the back end itself, so it asks its own address.
const BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8787' : '')).replace(/\/$/, '');

/** Handles byte-split UTF-8, CRLF, comments and multiline SSE data fields. */
export async function readEvents(stream: ReadableStream<Uint8Array>, receive: (event: GameEvent) => void, signal?: AbortSignal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '', terminal = false;
  const abort = () => { void reader.cancel(); };
  signal?.addEventListener('abort', abort, { once: true });
  const dispatch = (block: string) => {
    const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return;
    if (terminal) throw new Error('The server sent events after the turn ended.');
    const event = eventSchema.parse(JSON.parse(data));
    // A live reply must contain a measured trust value. Only legacy recordings allow null.
    if (event.type === 'reply' && event.trust === null) throw new Error('Missing trust in server reply.');
    terminal = event.type === 'reply' || event.type === 'error';
    receive(event);
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1_000_000) throw new Error('Server event exceeded the size limit.');
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        dispatch(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
      if (done) break;
    }
    signal?.throwIfAborted();
    if (buffer.trim()) dispatch(buffer);
    if (!terminal) throw new Error('The connection ended before the character replied. Pending actions have no confirmed decision.');
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

async function request(path: string, body?: unknown, signal?: AbortSignal, code?: string) {
  const response = await fetch(`${BASE}/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(code && { 'x-access-code': code }) }, ...(body !== undefined && { body: JSON.stringify(body) }), signal });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? `The bank returned HTTP ${response.status}.`);
  }
  return response;
}
const delay = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
});

export class BankClient {
  private recording?: Awaited<ReturnType<typeof this.loadRecording>>;
  private played = new Set<number>();
  private cleared = new Set<number>();
  private turns = 0;
  private async loadRecording() {
    const response = await fetch('/recordings/mock-run.json');
    if (!response.ok) throw new Error('The saved recording could not be loaded.');
    return recordingSchema.parse(await response.json());
  }
  async start(role: Role, name: string, code?: string) {
    if (!MOCK) return startSchema.parse(await (await request('/game', { role, name }, AbortSignal.timeout(20000), code)).json());
    this.recording = await this.loadRecording(); this.played.clear(); this.cleared.clear(); this.turns = 0;
    return { gameId: 'recorded-night-shift', unlocked: ['door-guard'] as Character[], customer: DEFAULT_CUSTOMER };
  }
  /** The next recorded turn in the order the night happened, whoever it was with. */
  upcoming(): RecordedTurn | undefined {
    return this.recording?.turns.find((_, i) => !this.played.has(i));
  }
  next(character: Character, role: Role): RecordedTurn | undefined {
    return this.recording?.turns.find((t, i) => t.request.character === character && t.request.role === role && !this.played.has(i));
  }
  async say(id: string, character: Character, text: string, role: Role, receive: (event: GameEvent) => void, signal: AbortSignal) {
    if (!MOCK) {
      const response = await request(`/game/${encodeURIComponent(id)}/say`, { character, text }, signal);
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('The bank did not return an event stream.');
      return readEvents(response.body, receive, signal);
    }
    const turn = this.next(character, role);
    if (!turn) throw new Error('No more recorded turns for this character and role. Switch badges or speak to another character.');
    if (text !== turn.request.text) throw new Error('Replay uses the original recorded line. Use live mode for your own words.');
    for (const event of turn.events) {
      await delay(event.type === 'decision' && event.decision === 'timeout' ? 12000 : turn.events.length === 1 ? 2000 : event.type === 'reply' ? 1200 : 1700, signal);
      receive(event);
      if (event.type === 'reply') event.cleared.forEach(n => this.cleared.add(n));
    }
    this.played.add(this.recording!.turns.indexOf(turn)); this.turns++;
  }
  async health() {
    if (MOCK) return { needsCode: false };
    const data = await (await request('/health', undefined, AbortSignal.timeout(10000))).json();
    if (typeof data.needsCode !== 'boolean') throw new Error('Invalid response from the bank health endpoint.');
    return data as { needsCode: boolean };
  }
  async close(id: string) {
    if (!MOCK && id) { const response = await fetch(`${BASE}/api/game/${encodeURIComponent(id)}`, { method: 'DELETE', signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error('The bank could not close this session.'); }
  }
  async role(id: string, role: Role) {
    if (!MOCK) { const response = await (await request(`/game/${encodeURIComponent(id)}/role`, { role }, AbortSignal.timeout(15000))).json(); if (response.role !== role) throw new Error('The bank did not confirm the requested badge.'); }
  }
  async summary(id: string): Promise<Summary> {
    if (!MOCK) return summarySchema.parse(await (await request(`/game/${encodeURIComponent(id)}/summary`, undefined, AbortSignal.timeout(15000))).json());
    return { cleared: [...this.cleared], turns: this.turns, rank: 'Recorded night shift' };
  }
}
export const bank = new BankClient();
