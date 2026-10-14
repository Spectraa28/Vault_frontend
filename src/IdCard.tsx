import { MOCK } from './api';
import { useGame } from './store';
import type { Customer, Role } from './contract';

/** What the player is carrying, by badge. The characters only ever hear words, so showing ID means saying it. */
export function papersFor(role: Role, name: string, customer: Customer) {
  const initials = (n: string) => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return role === 'customer'
    ? { initials: initials(customer.name), holder: customer.name, title: 'Customer', detail: `Account ${customer.account} · driving licence and bank card`, line: `Here's my ID: ${customer.name}, account ${customer.account}. My driving licence and my bank card.` }
    : { initials: 'FM', holder: name || 'The manager', title: 'Branch manager', detail: 'Branch manager · First Meridian staff card', line: `Here's my staff card: ${name || 'branch manager'}, branch manager at First Meridian.` };
}

export function IdCard({ onShow }: { onShow: (line: string) => void }) {
  const role = useGame(s => s.role), name = useGame(s => s.name), busy = useGame(s => s.busy), customer = useGame(s => s.customer);
  if (MOCK) return null;
  const p = papersFor(role, name, customer);
  return <div className={`id-card ${role}`} aria-label={`Your ID: ${p.holder}, ${p.detail}`}>
    <span className="id-photo" aria-hidden="true">{p.initials}</span>
    <span className="id-text"><strong>{p.holder}</strong><small>{p.detail}</small></span>
    <button type="button" disabled={busy} onClick={() => onShow(p.line)}>Show ID</button>
  </div>;
}

/** Floats over the player while they walk: who they are tonight, and the ID to give when asked. */
export function WhoYouAre() {
  const role = useGame(s => s.role), name = useGame(s => s.name), customer = useGame(s => s.customer);
  const p = papersFor(role, name, customer);
  return <div className={`who-you-are ${role}`}>
    <span>You are</span>
    <strong>{p.holder}</strong>
    <small>{role === 'customer' ? `Customer · account ${customer.account}` : 'Branch manager · staff card'}</small>
  </div>;
}
