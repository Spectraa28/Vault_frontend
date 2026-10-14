import { disclosedBalance } from './wallet';
import { create } from 'zustand';
import { CAST, DEFAULT_CUSTOMER, type Character, type Customer, type GameEvent, type Mood, type Reply, type Role, type Summary } from './contract';
export type Phase = 'title' | 'login' | 'play' | 'conversation' | 'ending' | 'end';
export type Area = 'gate' | 'lobby' | 'vault';
/** The tool call a character is physically carrying out, and how it turned out. Drives their animation and the props. */
export interface Act { who: Character | 'junior-teller'; tool: string; stage: 'working' | 'held' | 'allowed' | 'refused'; at: number }
/** A decided act is shown for a few seconds, then the character goes back to their post. */
export function actStage(act: Act, now: number): Act['stage'] | null {
  return act.stage === 'working' || act.stage === 'held' ? act.stage : now - act.at < 3400 ? act.stage : null;
}
export interface Slip { id: number; tool: string; args: Record<string, unknown>; delegatedTo?: string; decision?: string; layer?: string; reason?: string; heldAt?: number; executed?: boolean }
interface GameState {
  phase: Phase; name: string; role: Role; avatar: number; gameId: string; unlocked: Character[]; cleared: number[];
  /** The player's own record at this game's bank: their name and account. */
  customer: Customer; balance: string | null; selectedTask: number | 'staff-door' | null; tasksOpen: boolean;
  area: Area; near: Character | null; active: Character | null; busy: boolean; roleBusy: boolean; error: string; retryUntil: number;
  slips: Slip[]; turnStartSlip: number; reply: Reply | null; lastLine: string; mood: Mood; trust: number | null; summary: Summary | null;
  graphics: Graphics; muted: boolean; reduced: boolean; vaultAttempt: number; delegateAt: number;
  act: Act | null; speakUntil: number;
  /** A short scripted shot, such as the doors opening. While it runs the dialogue steps aside. */
  cine: { shot: 'door'; at: number } | null; fade: boolean;
  notice: string; plaque: number[]; coldUntil: Partial<Record<Character, number>>; enforcementFault: boolean;
  set: (state: Partial<GameState>) => void; event: (e: GameEvent) => void; talk: (id: Character) => void; leave: () => void; reset: () => void;
}
const initial = { phase: 'title' as Phase, name: '', role: 'customer' as Role, avatar: 0, gameId: '', customer: DEFAULT_CUSTOMER, balance: null as string|null, selectedTask: null as number|'staff-door'|null, tasksOpen: false, unlocked: [] as Character[], cleared: [] as number[], area: 'gate' as Area, near: null, active: null, busy: false, roleBusy: false, error: '', retryUntil: 0, slips: [] as Slip[], turnStartSlip: 0, reply: null, lastLine: '', mood: 'wary' as Mood, trust: null, summary: null, vaultAttempt: 0, delegateAt: 0, act: null as Act | null, speakUntil: 0, cine: null as { shot: 'door'; at: number } | null, fade: false, notice: '', plaque: [] as number[], coldUntil: {}, enforcementFault: false };
export function updateSlips(slips: Slip[], e: GameEvent): Slip[] {
  if (e.type === 'tool') return [...slips, { id: (slips.at(-1)?.id ?? 0) + 1, tool: e.tool, args: e.args, delegatedTo: e.delegatedTo }].slice(-30);
  if (e.type !== 'hold' && e.type !== 'decision') return slips;
  const index = slips.findLastIndex(s => s.tool === e.tool && (!s.decision || s.decision === 'held') && (e.type !== 'decision' || s.delegatedTo === e.delegatedTo));
  if (index < 0) return slips; // Do not invent an attempt when no matching tool event was received.
  return slips.map((s, i) => i !== index ? s : e.type === 'hold' ? { ...s, decision: 'held', heldAt: Date.now() } : { ...s, decision: e.decision, layer: e.layer, reason: e.reason, heldAt: e.decision === 'held' ? Date.now() : undefined });
}
export type Graphics = 'Medium' | 'Low';
/** Low unless the player picked Medium before: the game should run on any laptop first, and look nicer by choice. */
function savedGraphics(): Graphics {
  try { return localStorage.getItem('vault-graphics') === 'Medium' ? 'Medium' : 'Low'; } catch { return 'Low'; }
}
export function saveGraphics(g: Graphics): void {
  try { localStorage.setItem('vault-graphics', g); } catch { /* private mode: the choice lasts this visit only */ }
}
export const useGame = create<GameState>((set, get) => ({
  ...initial, graphics: savedGraphics(), muted: false, reduced: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  set,
  event: e => {
    const s = get();
    if (e.type === 'error') { set({ error: e.message, retryUntil: Date.now() + (e.retryAfterMs ?? 0) }); return; }
    if (e.type === 'reply') {
      const newAreas = e.unlocked.filter(id => !s.unlocked.includes(id));
      let slips = [...s.slips];
      for (const a of e.attempts) {
        const index = slips.findIndex(v => v.id > s.turnStartSlip && v.tool === a.tool && v.delegatedTo === a.delegatedTo && v.executed === undefined);
        if (index >= 0) slips[index] = { ...slips[index], ...a, heldAt: undefined };
        else slips.push({ id: (slips.at(-1)?.id ?? 0) + 1, ...a });
      }
      set({ ...(e.name==='Wren' && disclosedBalance(e.reply) && {balance:disclosedBalance(e.reply)}), slips, reply: e, mood: e.mood, trust: e.trust, speakUntil: Date.now() + 700 + e.reply.length * 55, unlocked: [...new Set([...s.unlocked, ...e.unlocked])], cleared: [...new Set([...s.cleared, ...e.cleared])], plaque: [...s.plaque, ...e.cleared.filter(n => !s.cleared.includes(n))], notice: newAreas.includes('cashier') ? 'The lobby is open' : newAreas.includes('vault-guard') ? 'The vault corridor is open' : s.notice, coldUntil: e.coldShoulder && s.active ? { ...s.coldUntil, [s.active]: Date.now() + 12000 } : s.coldUntil, enforcementFault: s.enforcementFault || e.enforcementHeld === false || e.attempts.some(a => a.tool === 'open_vault' && a.executed) });
    } else set({ slips: updateSlips(s.slips, e),
      ...(e.type === 'tool' && s.active && { act: { who: e.delegatedTo ? 'junior-teller' as const : s.active, tool: e.tool, stage: 'working' as const, at: Date.now() } }),
      ...(e.type === 'hold' && s.act && { act: { ...s.act, stage: 'held' as const, at: Date.now() } }),
      ...(e.type === 'decision' && s.act && s.act.tool === e.tool && { act: { ...s.act, stage: ['allowed', 'approved'].includes(e.decision) ? 'allowed' as const : 'refused' as const, at: Date.now() } }), ...(e.type === 'tool' && e.tool === 'open_vault' && { vaultAttempt: s.vaultAttempt + 1 }), ...(((e.type === 'decision' && e.tool === 'ask_junior_teller' && ['allowed','approved'].includes(e.decision)) || (e.type === 'tool' && e.delegatedTo && !s.delegateAt)) && { delegateAt: Date.now() }) });
  },
  talk: id => { const s = get(); if (s.busy || !s.unlocked.includes(id) || (s.coldUntil[id] ?? 0) > Date.now()) return; set({ phase: 'conversation', active: id, reply: null, lastLine: '', error: '', mood: 'wary', trust: null, delegateAt: 0, act: null, speakUntil: Date.now() + 2600 }); },
  leave: () => set({ phase: 'play', active: null, cine: null }),
  reset: () => set({ ...initial }),
}));
export const greeting = () => { const s = useGame.getState(); return s.active ? CAST[s.active].greeting : ''; };
