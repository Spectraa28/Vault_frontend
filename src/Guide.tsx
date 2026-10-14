import { useEffect, useMemo, useState } from 'react';
import { MOCK } from './api';
import { CAST, type Character } from './contract';
import { approachesFor, checklist, objectiveFor, standPoint } from './guide';
import { useGame } from './store';
import { playerPosition } from './scene/Actor';

const useObjective = () => {
  const unlocked = useGame(s => s.unlocked), cleared = useGame(s => s.cleared), role = useGame(s => s.role);
  return useMemo(() => objectiveFor({ unlocked, cleared, role }), [unlocked, cleared, role]);
};

/** Always on screen while walking: what to do next, who to see, and how far away they are. */
export function ObjectiveCard() {
  const objective = useObjective(), cleared = useGame(s => s.cleared);
  const [metres, setMetres] = useState<number | null>(null), [open, setOpen] = useState(false);
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
    <p>{objective.detail}</p>
    {objective.who && <div className="objective-where"><b>{CAST[objective.who].name}</b><span>{here ? 'right here · press E' : `${metres ?? '…'} m · follow the brass trail`}</span></div>}
    <button className="objective-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide the list' : `Tonight’s five · ${cleared.length} shown`}</button>
    {open && <ol className="objective-list">{checklist(cleared).map(item => <li key={item.level} className={item.done ? 'done' : ''}><i>{item.done ? '✓' : '○'}</i><div><b>{item.title}</b> <small>with {item.who}</small><span>{item.hint}</span></div></li>)}</ol>}
  </aside>;
}

/** Shown once, the first time the player has control: the whole game in three lines. */
export function Briefing() {
  const phase = useGame(s => s.phase);
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
      <li><b>Follow the brass trail.</b> The card at the top left always says what to try next. There are five things to see.</li>
    </ol>
    <button className="primary-button" onClick={() => setSeen(true)} autoFocus>Understood <span>⟶</span></button>
  </div>;
}

/** Openings the player can borrow, so nobody is left staring at an empty box. Live games only. */
export function Approaches({ character, onPick }: { character: Character; onPick: (line: string) => void }) {
  const objective = useObjective(), role = useGame(s => s.role), busy = useGame(s => s.busy);
  const options = approachesFor(character, objective, role);
  if (MOCK || !options.length) return null;
  return <div className="approaches" aria-label="Ways to open">
    <span>{objective.who === character && objective.flipTo ? `For the next level, flip your badge to ${objective.flipTo} first. Or try:` : 'Not sure what to say? Borrow an opening, then make it yours:'}</span>
    <div>{options.map(o => <button type="button" key={o.label} className={o.suggested ? 'suggested' : ''} disabled={busy} onClick={() => onPick(o.line)}>{o.suggested && <i>NEXT</i>}{o.label}</button>)}</div>
  </div>;
}
