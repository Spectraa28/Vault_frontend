import { describe, expect, it } from 'vitest';
import { papersFor } from '../src/IdCard';

describe('the ID card', () => {
  it('carries the customer the bank has on file, so a character asking for ID can be answered', () => {
    const p = papersFor('customer', 'Ada');
    expect(p.holder).toBe('Dana Whitlock');
    expect(p.line).toContain('Dana Whitlock');
    expect(p.line).toContain('4471');
  });

  it('turns into a staff card under the manager badge', () => {
    const p = papersFor('manager', 'Ada');
    expect(p.line).toContain('Ada');
    expect(p.line).toMatch(/branch manager/i);
    expect(papersFor('manager', '').line).toMatch(/branch manager/i);
  });
});
