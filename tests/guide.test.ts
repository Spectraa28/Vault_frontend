import { describe, expect, it } from 'vitest';
import { APPROACHES, LEVEL_ORDER, approachesFor, checklist, objectiveFor, routeTo, standPoint, trail } from '../src/guide';

describe('objectives', () => {
  it('starts at the door, then walks the levels in order, then sends you home', () => {
    expect(objectiveFor({ unlocked: ['door-guard'], cleared: [], role: 'customer' })).toMatchObject({ id: 'gate', who: 'door-guard' });
    const inside = ['door-guard', 'cashier', 'vault-guard'] as const;
    const seen: number[] = [];
    for (const cleared: number[] = []; ; ) {
      const o = objectiveFor({ unlocked: inside, cleared, role: 'customer' });
      if (!o.level) { expect(o.id).toBe('leave'); break; }
      seen.push(o.level); cleared.push(o.level);
    }
    expect(seen).toEqual([...LEVEL_ORDER]);
  });

  it('says to flip the badge when the next level needs the other one', () => {
    const inside = ['door-guard', 'cashier', 'vault-guard'] as const;
    const asCustomer = objectiveFor({ unlocked: inside, cleared: [3], role: 'customer' });
    expect(asCustomer).toMatchObject({ level: 4, flipTo: 'manager' });
    expect(asCustomer.detail).toMatch(/Flip your badge to Manager/);
    expect(objectiveFor({ unlocked: inside, cleared: [3], role: 'manager' }).flipTo).toBeUndefined();
    expect(objectiveFor({ unlocked: inside, cleared: [3, 4], role: 'manager' })).toMatchObject({ level: 2, flipTo: 'customer' });
  });

  it('lists all five levels with what is done', () => {
    const list = checklist([3, 5]);
    expect(list.map(l => l.level)).toEqual([...LEVEL_ORDER]);
    expect(list.filter(l => l.done).map(l => l.level)).toEqual([3, 5]);
  });
});

describe('finding the way', () => {
  it('goes through the front doors to reach the cashier, never through the wall', () => {
    const route = routeTo([1.2, 0, 6.3], standPoint('cashier'));
    expect(route.length).toBe(4);
    expect(route[1][0]).toBe(0);
    expect(route[1][2]).toBeGreaterThan(0);
    expect(route[2][2]).toBeLessThan(0);
  });

  it('takes the gate and the stairs down to the vault, and the same way back', () => {
    const down = routeTo([1.2, 0, 6.3], standPoint('vault-guard'));
    expect(down.map(p => p[2])).toEqual([...down.map(p => p[2])].sort((a, b) => b - a));
    expect(down.at(-2)![1]).toBe(-3);
    const back = routeTo(standPoint('vault-guard'), standPoint('cashier'));
    expect(back.map(p => p[2])).toEqual([...back.map(p => p[2])].sort((a, b) => a - b));
  });

  it('walks straight there when nothing is in between', () => {
    expect(routeTo([1.2, 0, 6.3], standPoint('door-guard')).length).toBe(2);
  });

  it('spaces the trail evenly and stops at the cap', () => {
    const points = trail([[0, 0, 0], [0, 0, -10]], 1, 1);
    expect(points.length).toBe(10);
    expect(points[0][2]).toBeCloseTo(-1);
    expect(points[1][2] - points[0][2]).toBeCloseTo(-1);
    expect(trail([[0, 0, 0], [0, 0, -500]], 1, 1, 20).length).toBe(20);
  });
});

describe('approaches', () => {
  it('puts the opening for the current level first and marks it', () => {
    const inside = ['door-guard', 'cashier', 'vault-guard'] as const;
    const memo = objectiveFor({ unlocked: inside, cleared: [3, 4], role: 'customer' });
    const options = approachesFor('cashier', memo, 'customer');
    expect(options[0]).toMatchObject({ level: 2, suggested: true });
    expect(options.filter(o => o.suggested).length).toBe(1);
  });

  it('only offers openings that fit the badge being worn', () => {
    const o = objectiveFor({ unlocked: ['door-guard', 'cashier', 'vault-guard'], cleared: [3], role: 'manager' });
    const labels = approachesFor('cashier', o, 'manager').map(a => a.label);
    expect(labels).toContain('The same, as the manager');
    expect(labels).not.toContain('Ask for cash');
    expect(labels).not.toContain('Hand over the memo');
  });

  it('suggests nothing while the badge is wrong for the level', () => {
    const o = objectiveFor({ unlocked: ['door-guard', 'cashier', 'vault-guard'], cleared: [3], role: 'customer' });
    expect(approachesFor('cashier', o, 'customer').some(a => a.suggested)).toBe(false);
  });

  it('keeps every opening within what the server accepts', () => {
    for (const list of Object.values(APPROACHES)) for (const a of list) expect(a.line.length).toBeLessThanOrEqual(1500);
  });

  it('offers several tactics without marking multiple lines as the next step', () => {
    for (const who of ['door-guard', 'cashier', 'vault-guard'] as const) {
      for (const level of LEVEL_ORDER) {
        const objective = objectiveFor({ unlocked: ['door-guard', 'cashier', 'vault-guard'], cleared: [], role: 'customer', selectedTask: level });
        const options = approachesFor(who, objective, 'customer');
        expect(options.length).toBeGreaterThanOrEqual(4);
        expect(options.filter(a => a.suggested).length).toBeLessThanOrEqual(1);
        expect(new Set(options.map(a => a.line)).size).toBe(options.length);
      }
    }
  });
});
