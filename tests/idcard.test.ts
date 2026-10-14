import { describe, expect, it } from 'vitest';
import { papersFor } from '../src/IdCard';
import { personalise } from '../src/guide';
import { DEFAULT_CUSTOMER } from '../src/contract';

const ada = { name: 'Ada Lovelace', account: '5832' };

describe('the ID card', () => {
  it("carries the player's own customer record, so a character asking for ID can be answered", () => {
    const p = papersFor('customer', 'Ada', ada);
    expect(p.holder).toBe('Ada Lovelace');
    expect(p.initials).toBe('AL');
    expect(p.line).toContain('Ada Lovelace');
    expect(p.line).toContain('5832');
    expect(papersFor('customer', '', DEFAULT_CUSTOMER).line).toContain('4471');
  });

  it('turns into a staff card under the manager badge', () => {
    const p = papersFor('manager', 'Ada', ada);
    expect(p.line).toContain('Ada');
    expect(p.line).toMatch(/branch manager/i);
    expect(papersFor('manager', '', ada).line).toMatch(/branch manager/i);
  });

  it("rewrites the suggested lines with the player's name and account", () => {
    const line = personalise("Dana Whitlock, account 4471. Whitlock. Dana Whitlock.", ada);
    expect(line).toBe('Ada Lovelace, account 5832. Ada Lovelace. Ada Lovelace.');
  });
});
