import { useEffect, useMemo, useState } from 'react';
import { MOCK } from './api';
import { CAST, type Character } from './contract';
import { READ_THE_ROOM, approachesFor, checklist, nextStep, objectiveFor, personalise, standPoint } from './guide';
import { useGame } from './store';
import { playerPosition } from './scene/shared';

const useObjective = () => {
  const selectedTask=useGame(s=>s.selectedTask);
  const unlocked = useGame(s => s.unlocked), cleared = useGame(s => s.cleared), role = useGame(s => s.role);
  return useMemo(() => objectiveFor({ unlocked, cleared, role, selectedTask }), [unlocked, cleared, role, selectedTask]);
};

/** Always on screen while walking: what to do next, who to see, and how far away they are. */
export function ObjectiveCard() {
  const objective = useObjective(), cleared = useGame(s => s.cleared), customer = useGame(s => s.customer);
  const [metres, setMetres] = useState<number | null>(null);
  useEffect(() => {
    if (!objective.who) { setMetres(null); return; }
    const [x, , z] = standPoint(objective.who);
    const tick = () => setMetres(Math.round(Math.hypot(playerPosition.x - x, playerPosition.z - z)));
    tick(); const t = setInterval(tick, 400); return () => clearInterval(t);
  }, [objective.who]);
  const here = metres !== null && metres <= 2;
  return <aside className="objective-card" aria-live="polite">
    <span className="objective-eyebrow">{objective.level ? `NEXT · LEVEL ${objective.level} OF 5` : 'NEXT'}</span>
    <h3>{objective.title}</h3>
    <p>{personalise(objective.detail, customer)}</p>
    {objective.who && <div className="objective-where"><b>{CAST[objective.who].name}</b><span>{here ? 'right here · press E' : `${metres ?? '…'} m · follow the brass trail`}</span></div>}
  </aside>;
}

/** Shown once, the first time the player has control: the whole game in three lines. */
export function Briefing() {
  const phase = useGame(s => s.phase), customer = useGame(s => s.customer), role = useGame(s => s.role), name = useGame(s => s.name);
  const [seen, setSeen] = useState(MOCK);
  useEffect(() => {
    if (seen || phase !== 'play') return;
    const key = (e: KeyboardEvent) => { if (['Enter', 'Escape', 'Space'].includes(e.code)) setSeen(true); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [seen, phase]);
  if (seen || phase !== 'play') return null;
  return <div className="briefing" role="dialog" aria-label="How to play">
    <span className="objective-eyebrow">BEFORE YOU GO IN</span>
    <h2>Talk your way to the vault.</h2>
    <ol>
      <li><b>Everyone here can be persuaded.</b> Walk up to someone, press <kbd>E</kbd>, and say whatever you think will work.</li>
      <li><b>Persuading them is not the same as getting in.</b> Every action they try is printed on the teller tape, with the bank’s decision stamped on it.</li>
      <li><b>{role === 'customer' ? `You are ${customer.name}, account ${customer.account}.` : `You are ${name || 'the branch manager'}, branch manager.`}</b> When someone asks for ID, use the cards in your wallet in the conversation. Your name floats over your head as a reminder.</li>
      <li><b>Follow the brass trail.</b> The card at the top left always says what to try next. There are five things to see.</li>
    </ol>
    <button className="primary-button" onClick={() => setSeen(true)} autoFocus>Understood <span>⟶</span></button>
  </div>;
}

/** Openings the player can borrow, so nobody is left staring at an empty box. Live games only. */
export function Approaches({ character, onPick }: { character: Character; onPick: (line: string) => void }) {
  const objective = useObjective(), role = useGame(s => s.role), busy = useGame(s => s.busy), customer = useGame(s => s.customer);
  const options = approachesFor(character, objective, role);
  if (MOCK || !options.length) return null;
  return <div className="approaches" aria-label="Ways to open">
    <span>{objective.who === character && objective.flipTo ? `For the next level, flip your badge to ${objective.flipTo} first. Or try:` : READ_THE_ROOM[character]} Borrow a line or invent your own:</span>
    <div>{options.map(o => <button type="button" key={o.label} aria-pressed={o.suggested} className={o.suggested ? 'suggested' : ''} disabled={busy} onClick={() => onPick(personalise(o.line, customer))}>{o.suggested && <i>NEXT</i>}{o.label}</button>)}</div>
  </div>;
}

/** Navigation only: selecting a task never changes the cleared list or the signed-in badge. */
export function TaskPanel() {
 const cleared=useGame(s=>s.cleared), selected=useGame(s=>s.selectedTask), unlocked=useGame(s=>s.unlocked);
 const choose=(value:number|'staff-door')=>useGame.getState().set({selectedTask:value});
 return <section className="task-panel" aria-label="Guardrail task list">
  <header><div><span>TONIGHT’S FIVE</span><h2>Test the guardrails.</h2></div><button onClick={()=>useGame.getState().set({tasksOpen:false})} aria-label="Close task list">×</button></header>
  <p>Convince the person. Watch the permission.</p>
  <ol>{checklist(cleared).sort((a,b)=>a.level-b.level).map(item=><li key={item.level}>
   <button className={selected===item.level?'chosen':''} aria-pressed={selected===item.level} onClick={()=>choose(item.level)}>
    <span className="task-number">{item.done?'✓':String(item.level).padStart(2,'0')}</span><span><strong>{item.title}</strong><small>{item.who} · {item.role==='manager'?'Manager badge':item.role==='customer'?'Customer badge':'Either badge'}{!unlocked.includes(item.character)?' · reach them first':''}</small><span>{item.hint}</span><em>{item.done?'Shown by the server':'Not yet shown'}</em></span>
   </button>
  </li>)}</ol>
  <button className={`staff-door-task ${selected==='staff-door'?'chosen':''}`} onClick={()=>choose('staff-door')} aria-pressed={selected==='staff-door'}><strong>Also try the staff door ↗</strong><span>Ask Gus for the staff entrance: it is forbidden for everyone, even the manager. Watch the lamp.</span></button>
  {selected!==null&&<button className="automatic-route" onClick={()=>useGame.getState().set({selectedTask:null})}>Return to the suggested route</button>}
 </section>;
}

/** The bar at the top of the screen: one sentence saying what to do right now. */
export function NowBar() {
  const s = useGame();
  // Only this conversation's last turn counts, so an old refusal elsewhere never steers the advice.
  const lastTurn = s.phase === 'conversation' && (s.reply || s.busy) ? s.slips.filter(x => x.id > s.turnStartSlip) : s.slips.filter(x => x.decision === 'held');
  const text = nextStep({ phase: s.phase, active: s.active, near: s.near, busy: s.busy, unlocked: s.unlocked, cleared: s.cleared, role: s.role, selectedTask: s.selectedTask, lastTurn, customer: s.customer });
  if (!text || MOCK) return null;
  return <div className="now-bar" role="status" aria-live="polite"><span>Now</span><p key={text}>{text}</p></div>;
}
