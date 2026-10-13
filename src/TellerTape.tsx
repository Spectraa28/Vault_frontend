import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { decisionLabel } from './contract';
import { useGame } from './store';
import { MOCK } from './api';
export default function TellerTape(){
 const slips=useGame(s=>s.slips),busy=useGame(s=>s.busy),reduced=useGame(s=>s.reduced);const end=useRef<HTMLDivElement>(null);
 const held=slips.findLast(s=>s.decision==='held');const [now,setNow]=useState(Date.now());
 useEffect(()=>{end.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'nearest'});},[slips,reduced]);
 useEffect(()=>{if(!held)return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[held]);
 const elapsed=held?Math.max(0,Math.floor((now-(held.heldAt??now))/1000)):0;
 return <aside className={`teller-tape ${busy?'printing':''}`} aria-label="ArmorIQ teller tape">
  <div className="printer"><div className="printer-top"><span className="printer-light"/><span>THE TELLER TAPE</span><span className="printer-number">№ 01</span></div><div className="printer-slot"/></div>
  <div className="tape-scroll" tabIndex={0} aria-label="Scroll tool receipts">
   {!slips.length&&<div className="blank-slip"><span className="receipt-mark">M</span><p>Every action leaves<br/>a paper trail.</p><small>THE CHARACTER CAN BE CONVINCED.<br/>PERMISSION IS ANOTHER MATTER.</small><div className="receipt-divider"/> <span>AWAITING FIRST ATTEMPT</span></div>}
   <AnimatePresence initial={false}>{slips.map((slip,i)=><motion.article key={slip.id} className={`slip ${i<slips.length-2?'old-slip':''}`} initial={reduced?false:{y:-24,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:.45}}>
    <div className="receipt-meta"><span>ATTEMPT {String(slip.id).padStart(3,'0')}</span><span>{slip.delegatedTo?'PIP · DELEGATED':'BANK ACTION'}</span></div>
    <h3>{slip.tool}</h3><pre>{JSON.stringify(slip.args,null,2)}</pre>
    {slip.decision?<motion.div key={slip.decision} initial={reduced?false:{scale:1.5,opacity:0,rotate:-12}} animate={{scale:1,opacity:1,rotate:-5}} transition={{duration:.18}} className={`stamp ${slip.decision==='held'?'amber':['allowed','approved'].includes(slip.decision)?'green':'red'}`}>{decisionLabel(slip.decision,slip.layer)}</motion.div>:<div className="pending-ink">AWAITING A DECISION<span className="ellipsis">...</span></div>}
    {slip.reason&&<p className="receipt-reason">{slip.reason}</p>}
    {slip.executed!==undefined&&<small className="world-record">BANK RECORD: {slip.executed?'WORLD CHANGED':'NO WORLD CHANGE'}</small>}
   </motion.article>)}</AnimatePresence><div ref={end}/>
  </div>
  <div className="printer-credit"><span className="mini-shield">◇</span> Decided by <b>ArmorIQ</b></div>
  {held&&<div className="hold-state" role="status"><div className="watch"><span/></div><div><strong>{!busy?'No final decision received':'Waiting for the manager'}</strong><span>{String(Math.floor(elapsed/60)).padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')} elapsed{MOCK?' · shortened replay':''}</span><small>Only the server can resolve this hold.</small></div></div>}
 </aside>;
}
