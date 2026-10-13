import { create } from 'zustand';
import { CAST, type Character, type GameEvent, type Mood, type Reply, type Role, type Summary } from './contract';
export type Phase = 'title' | 'login' | 'play' | 'conversation' | 'ending' | 'end';
export type Area = 'gate' | 'lobby' | 'vault';
export interface Slip { id: number; tool: string; args: Record<string, unknown>; delegatedTo?: string; decision?: string; layer?: string; reason?: string; heldAt?: number; executed?: boolean }
interface GameState {
  phase: Phase; name: string; role: Role; avatar: number; gameId: string; unlocked: Character[]; cleared: number[];
  area: Area; near: Character | null; active: Character | null; busy: boolean; roleBusy: boolean; error: string; retryUntil: number;
  slips: Slip[]; turnStartSlip: number; reply: Reply | null; lastLine: string; mood: Mood; trust: number | null; summary: Summary | null;
  graphics: 'High' | 'Medium' | 'Low'; muted: boolean; reduced: boolean; vaultAttempt: number; delegateAt: number;
  notice: string; plaque: number[]; coldUntil: Partial<Record<Character, number>>; enforcementFault: boolean;
  set: (state: Partial<GameState>) => void; event: (e: GameEvent) => void; talk: (id: Character) => void; leave: () => void; reset: () => void;
}
const initial = { phase: 'title' as Phase, name: '', role: 'customer' as Role, avatar: 0, gameId: '', unlocked: [] as Character[], cleared: [] as number[], area: 'gate' as Area, near: null, active: null, busy: false, roleBusy: false, error: '', retryUntil: 0, slips: [] as Slip[], turnStartSlip: 0, reply: null, lastLine: '', mood: 'wary' as Mood, trust: null, summary: null, vaultAttempt: 0, delegateAt: 0, notice: '', plaque: [] as number[], coldUntil: {}, enforcementFault: false };
export function updateSlips(slips: Slip[], e: GameEvent): Slip[] {
  if (e.type === 'tool') return [...slips, { id: (slips.at(-1)?.id ?? 0) + 1, tool: e.tool, args: e.args, delegatedTo: e.delegatedTo }].slice(-30);
  if (e.type !== 'hold' && e.type !== 'decision') return slips;
  const index = slips.findLastIndex(s => s.tool === e.tool && (!s.decision || s.decision === 'held') && (e.type !== 'decision' || s.delegatedTo === e.delegatedTo));
  if (index < 0) return slips; // Do not invent an attempt when no matching tool event was received.
  return slips.map((s, i) => i !== index ? s : e.type === 'hold' ? { ...s, decision: 'held', heldAt: Date.now() } : { ...s, decision: e.decision, layer: e.layer, reason: e.reason, heldAt: e.decision === 'held' ? Date.now() : undefined });
}
export const useGame = create<GameState>((set, get) => ({
  ...initial, graphics: 'Medium', muted: false, reduced: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
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
      set({ slips, reply: e, mood: e.mood, trust: e.trust, unlocked: [...new Set([...s.unlocked, ...e.unlocked])], cleared: [...new Set([...s.cleared, ...e.cleared])], plaque: [...s.plaque, ...e.cleared.filter(n => !s.cleared.includes(n))], notice: newAreas.includes('cashier') ? 'The lobby is open' : newAreas.includes('vault-guard') ? 'The vault corridor is open' : s.notice, coldUntil: e.coldShoulder && s.active ? { ...s.coldUntil, [s.active]: Date.now() + 12000 } : s.coldUntil, enforcementFault: s.enforcementFault || e.enforcementHeld === false || e.attempts.some(a => a.tool === 'open_vault' && a.executed) });
    } else set({ slips: updateSlips(s.slips, e), ...(e.type === 'tool' && e.tool === 'open_vault' && { vaultAttempt: s.vaultAttempt + 1 }), ...(((e.type === 'decision' && e.tool === 'ask_junior_teller' && ['allowed','approved'].includes(e.decision)) || (e.type === 'tool' && e.delegatedTo && !s.delegateAt)) && { delegateAt: Date.now() }) });
  },
  talk: id => { const s = get(); if (s.busy || !s.unlocked.includes(id) || (s.coldUntil[id] ?? 0) > Date.now()) return; set({ phase: 'conversation', active: id, reply: null, lastLine: '', error: '', mood: 'wary', trust: null, delegateAt: 0 }); },
  leave: () => set({ phase: 'play', active: null }),
  reset: () => set({ ...initial }),
}));
export const greeting = () => { const s = useGame.getState(); return s.active ? CAST[s.active].greeting : ''; };
