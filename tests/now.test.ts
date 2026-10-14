import { describe, expect, it } from 'vitest';
import { nextStep, type NowState } from '../src/guide';

const base: NowState = { phase: 'play', active: null, near: null, busy: false, unlocked: ['door-guard'], cleared: [], role: 'customer', selectedTask: null, lastTurn: [], customer: { name: 'Sonu', account: '6262' } };
const at = (over: Partial<NowState>) => nextStep({ ...base, ...over })!;

describe('the now bar', () => {
  it('walks a new player to Gus, then into the conversation', () => {
    expect(at({})).toMatch(/brass trail to Gus/);
    expect(at({ near: 'door-guard' })).toBe('Press E to talk to Gus.');
    expect(at({ phase: 'conversation', active: 'door-guard' })).toMatch(/wallet.*public doors/);
  });

  it('turns a refused staff door into the way in', () => {
    expect(at({ phase: 'conversation', active: 'door-guard', lastTurn: [{ tool: 'check_visitor_list', decision: 'allowed' }, { tool: 'open_staff_entrance', decision: 'blocked', layer: 'policy' }] })).toMatch(/forbidden for everyone.*public doors/);
  });

  it('explains holds, timeouts and refusals from what the server said', () => {
    expect(at({ phase: 'conversation', active: 'cashier', unlocked: ['door-guard', 'cashier'], lastTurn: [{ tool: 'withdraw_cash', decision: 'held' }] })).toMatch(/platform\.armoriq\.ai/);
    expect(at({ phase: 'conversation', active: 'cashier', unlocked: ['door-guard', 'cashier'], lastTurn: [{ tool: 'withdraw_cash', decision: 'timeout' }] })).toMatch(/didn’t answer/);
    expect(at({ phase: 'conversation', active: 'cashier', unlocked: ['door-guard', 'cashier'], lastTurn: [{ tool: 'wire_transfer', decision: 'blocked', layer: 'intent' }] })).toMatch(/never in the plan/);
    expect(at({ phase: 'conversation', active: 'cashier', busy: true, unlocked: ['door-guard', 'cashier'] })).toMatch(/Wren is deciding/);
  });

  it("once inside, gives the next guardrail with the player's own account, and asks for the right badge", () => {
    const inside = { unlocked: ['door-guard', 'cashier', 'vault-guard'] as const };
    expect(at({ ...inside, phase: 'conversation', active: 'cashier' })).toContain('6262');
    expect(at({ ...inside, cleared: [3] })).toMatch(/Flip your badge to Manager/);
    expect(at({ ...inside, cleared: [1, 2, 3, 4, 5] })).toMatch(/Leave the bank/);
    expect(nextStep({ ...base, phase: 'title' })).toBeNull();
  });
});
