import { MOCK } from './api';
import { useGame } from './store';
import type { Role } from './contract';

/** What the player is carrying, by badge. The characters only ever hear words, so showing ID means saying it. */
export function papersFor(role: Role, name: string) {
  return role === 'customer'
    ? { initials: 'DW', holder: 'Dana Whitlock', detail: 'Account 4471 · driving licence and bank card', line: "Here's my ID: Dana Whitlock, account 4471. My driving licence and my bank card." }
    : { initials: 'FM', holder: `${name || 'The manager'}`, detail: 'Branch manager · First Meridian staff card', line: `Here's my staff card: ${name || 'branch manager'}, branch manager at First Meridian.` };
}

export function IdCard({ onShow }: { onShow: (line: string) => void }) {
  const role = useGame(s => s.role), name = useGame(s => s.name), busy = useGame(s => s.busy);
  if (MOCK) return null;
  const p = papersFor(role, name);
  return <div className={`id-card ${role}`} aria-label={`Your ID: ${p.holder}, ${p.detail}`}>
    <span className="id-photo" aria-hidden="true">{p.initials}</span>
    <span className="id-text"><strong>{p.holder}</strong><small>{p.detail}</small></span>
    <button type="button" disabled={busy} onClick={() => onShow(p.line)}>Show ID</button>
  </div>;
}
