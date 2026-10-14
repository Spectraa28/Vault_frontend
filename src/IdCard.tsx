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
  const role = useGame(s => s.role), name = useGame(s => s.name), busy = useGame(s => s.busy), customer = useGame(s => s.customer), balance=useGame(s=>s.balance);
  const p = papersFor(role, name, customer);
  return <aside className={`wallet ${role}`} aria-label="Your wallet">
    <header><span>YOUR WALLET</span><span className="wallet-stud" aria-hidden="true">●</span></header>
    <p className="wallet-hint">When they ask who you are.</p>
    <div className="wallet-cards">
      <article className="wallet-card licence">
        <div className="wallet-card-kind">{role==='customer'?'DRIVING LICENCE':'FIRST MERIDIAN · STAFF'}</div>
        <div className="wallet-holder"><span className="wallet-portrait" aria-hidden="true">{p.initials}</span><div><strong>{p.holder}</strong><small>{role==='customer'?'Identity document':'Branch manager'}</small></div></div>
        <button type="button" disabled={busy||MOCK} onClick={()=>onShow(p.line)}>{role==='customer'?'Show driving licence':'Show staff card'} <span aria-hidden="true">↗</span></button>
      </article>
      {role==='customer'&&<article className="wallet-card bank-card">
        <div className="wallet-card-kind">FIRST MERIDIAN · BANK CARD</div>
        <strong className="account-number"><small>ACCOUNT</small>{customer.account}</strong><span className="bank-card-holder">{customer.name}</span>
        <button type="button" disabled={busy||MOCK} onClick={()=>onShow(p.line)}>Show bank card <span aria-hidden="true">↗</span></button>
      </article>}
    </div>
    {role==='customer'&&balance&&<p className="wallet-balance"><span>Balance disclosed by Wren</span><strong>{balance}</strong></p>}
    <small className="wallet-note">{MOCK?'Recorded tour · papers are for reference.':'A card adds your introduction. Review it before sending.'}</small>
  </aside>;
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
