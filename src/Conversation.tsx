import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { apiUrl, bank, MOCK } from './api';
import { CAST } from './contract';
import { useGame } from './store';
import { sound, voice, wantsVoice } from './sound';
import { useSpeech } from './useSpeech';
import TellerTape from './TellerTape';
import { Approaches, TaskPanel } from './Guide';
import { IdCard } from './IdCard';
function Typewriter({text}:{text:string}){const reduced=useGame(s=>s.reduced);const [count,setCount]=useState(0);useEffect(()=>{setCount(reduced?text.length:0);if(reduced)return;const t=setInterval(()=>setCount(n=>{if(n>=text.length){clearInterval(t);return n;}return n+2;}),25);return()=>clearInterval(t);},[text,reduced]);return <><span aria-hidden="true">{text.slice(0,count)}{count>=text.length&&<span className="next-arrow">▾</span>}</span><span className="sr-only">{text}</span></>;}
let activeRequest:AbortController|null=null;
export function cancelTurn(){activeRequest?.abort();activeRequest=null;}
export default function Conversation(){
 const s=useGame();const [text,setText]=useState('');const [revision,setRevision]=useState(0);const input=useRef<HTMLTextAreaElement>(null);const [elapsed,setElapsed]=useState(0);
 const character=s.active!;const cast=CAST[character];const next=MOCK?bank.next(character,s.role):undefined;
 // In the recorded tour a character only has lines for the badge worn when the night was recorded.
 // When there is nothing to play here, say where the tour continues, so the button is never a dead end.
 const upcoming=MOCK&&!next?bank.upcoming():undefined;
 const nowhere=!MOCK||next?'':upcoming?`Nothing was recorded for ${cast.name} as the ${s.role}. The tour continues with ${CAST[upcoming.request.character].name}, signed in as the ${upcoming.request.role}.`:'The recorded tour is finished. Use “Leave the bank” to see how the night went.';
 const speech=useSpeech(setText,m=>s.set({error:m}));
 useEffect(()=>{const t=setTimeout(()=>input.current?.focus(),s.reduced?0:1250);return()=>clearTimeout(t);},[character,s.reduced]);
 // Each character says their opening line aloud as the dialogue appears. Recorded once in their own voice (scripts/make-greetings.mts), so it costs nothing and starts at once.
 useEffect(()=>{if(useGame.getState().reply)return;const t=setTimeout(()=>voice(`/audio/voice/${character}.mp3`),s.reduced?0:700);return()=>clearTimeout(t);},[character]);
 useEffect(()=>{setText(MOCK?(next?.request.text??''):'');},[character,s.role,revision,next]);
 useEffect(()=>{if(!s.busy){setElapsed(0);return;}const t=setInterval(()=>setElapsed(n=>n+1),1000);return()=>clearInterval(t);},[s.busy]);
 useEffect(()=>{
  if(!s.reply||s.busy)return;
  const g=()=>useGame.getState();
  // Gus opening the doors is worth watching: step the dialogue aside, show the doors swing in, then
  // fade through black to hand the camera back, so there is no jump from one view to the other.
  if(s.notice&&character==='door-guard'&&s.reply.unlocked.includes('cashier')&&!s.reduced){
   const timers=[setTimeout(()=>g().set({cine:{shot:'door',at:Date.now()}}),1300),setTimeout(()=>g().set({fade:true}),5600),setTimeout(()=>g().leave(),5950),setTimeout(()=>g().set({fade:false}),6250)];
   return()=>{timers.forEach(clearTimeout);g().set({fade:false});};
  }
  if(s.reply.coldShoulder||s.notice){const t=setTimeout(()=>g().leave(),s.reply.coldShoulder?3000:2200);return()=>clearTimeout(t);}
 },[s.reply,s.busy,s.notice]);
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{if(e.code==='Escape'){e.preventDefault();if(useGame.getState().tasksOpen){useGame.getState().set({tasksOpen:false});return;}speech.end();s.leave();}else if(e.code==='Space'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)&&!(e.target instanceof HTMLButtonElement)&&!s.busy&&!MOCK){e.preventDefault();if(!e.repeat)speech.begin();}else if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)&&!(e.target as HTMLElement).closest('button, select, .task-panel, .wallet, .teller-tape')){s.leave();}};
  const up=(e:KeyboardEvent)=>{if(e.code==='Space'&&speech.listening)speech.end();};window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
 },[s.busy,speech.listening]);
 async function send(){
  if(s.busy||s.roleBusy||!text.trim()||Date.now()<s.retryUntil)return;
  const line=text.trim();s.set({busy:true,error:'',lastLine:line,reply:null,turnStartSlip:s.slips.at(-1)?.id??0});speech.end();activeRequest=new AbortController();
  try{await bank.say(s.gameId,character,line,s.role,event=>{
   useGame.getState().event(event);
   if(event.type==='tool')sound('printer');
   if(event.type==='decision'){sound('stamp');if(!useGame.getState().reduced){document.querySelector('.world')?.animate([{transform:'translate(0,0)'},{transform:'translate(2px,1px)'},{transform:'translate(-1px,0)'},{transform:'translate(0,0)'}],{duration:180});}}
   if(event.type==='reply'){voice(event.audioUrl&&apiUrl(event.audioUrl),event.delegateAudioUrl&&apiUrl(event.delegateAudioUrl));if(event.unlocked.length)sound('door');}
  },activeRequest.signal,wantsVoice());setRevision(n=>n+1);if(!MOCK)setText('');}
  catch(error){if((error as Error).name!=='AbortError')useGame.getState().set({error:error instanceof Error?error.message:'The connection was interrupted. No decision has been inferred.'});}
  finally{useGame.getState().set({busy:false});activeRequest=null;}
 }
 const reply=s.reply?.reply??(s.busy?'':cast.greeting);
 return <div className={`conversation-layer ${s.cine?'cine':''}`}>
  <div className="letterbox top"/><div className="letterbox bottom"/>
  <div className="conversation-heading"><span className="eyebrow">A PRIVATE CONVERSATION</span><button className="text-button" onClick={()=>{speech.end();s.leave();}}>Leave <kbd>Esc</kbd></button></div>
  <div className="character-label"><span>{cast.title}</span><h2>{cast.name}<i>.</i></h2><div className="trust" aria-label={s.trust===null?'Trust not yet known':`Trust ${s.trust} out of 5`}>{Array.from({length:5},(_,i)=><b key={i} className={s.trust!==null&&i<s.trust?'filled':''}/>)}<small>{s.trust===null?'READING THE ROOM':s.mood.toUpperCase()}</small></div></div>
  <IdCard onShow={line=>{setText(t=>(t.trim()?`${t.trim()} ${line}`:line).slice(0,1500));input.current?.focus();}}/>
  {s.tasksOpen&&<TaskPanel/>}
  <TellerTape/>
  <motion.section className="dialogue" initial={s.reduced?false:{y:40,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:s.reduced?0:.7,duration:.4}} aria-label={`Conversation with ${cast.name}`}>
   {s.lastLine&&<p className="last-line">“{s.lastLine}”</p>}
   {s.reply?.delegate&&<div className="delegate-line"><span>PIP · JUNIOR TELLER</span><p>{s.reply.delegate.reply}</p></div>}
   <div className="dialogue-frame"><span className="nameplate">{cast.name}</span>
    <div className="spoken-line" aria-live="polite">{s.busy?<div className="thinking"><span className="ellipsis">•••</span><small>{elapsed<3?'Choosing their words':s.slips.some(a=>a.decision==='held')?'Your request needs time to review. Please wait while our management reviews it':character==='door-guard'?'Gus is checking the night register':character==='cashier'?'Wren is working through the paperwork':'Marlowe is checking the mechanism'}<span>{elapsed}s</span></small></div>:<Typewriter text={reply}/>}</div>
    <form onSubmit={e=>{e.preventDefault();void send();}}>
     <label className="sr-only" htmlFor="player-line">Your line to {cast.name}</label>
     <Approaches character={character} onPick={line=>{setText(line);input.current?.focus();}}/>
     <div className="input-row"><button type="button" className={`talk-button ${speech.listening?'listening':''}`} aria-label="Hold to talk" disabled={MOCK||s.busy||!speech.available} title={MOCK?'Recorded mode uses the original line':!speech.available?'Speech input is unavailable in this browser. Use the text field.':'Hold to talk; release to review the transcript'} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);speech.begin();}} onPointerUp={speech.end} onPointerCancel={speech.end} onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)speech.begin();}}} onKeyUp={e=>{if([' ','Enter'].includes(e.key))speech.end();}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0012 0v-1M12 18v3M8 21h8"/></svg></button>
      <textarea ref={input} id="player-line" maxLength={1500} rows={2} value={text} readOnly={MOCK} disabled={s.busy} placeholder={MOCK?nowhere:'A little charm. A convincing story. Your move.'} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
      <button className="send-button" type="submit" disabled={s.busy||s.roleBusy||!text.trim()||Date.now()<s.retryUntil}>{s.busy?'WAIT':MOCK?(next?'REPLAY':'NO LINE'):'SAY IT'}<span>↵</span></button>
     </div>
     {nowhere&&<p className="replay-nowhere" role="status">{nowhere}</p>}
     <div className="input-help"><span>{MOCK?'ORIGINAL RECORDED LINE · OUTCOMES ARE FIXED':speech.listening?'LISTENING · RELEASE TO REVIEW':speech.available?'HOLD TO TALK  /  TYPE YOUR LINE':'TYPE YOUR LINE · VOICE UNAVAILABLE'}</span><span>{text.length}/1500</span></div>
    </form>
   </div>
  </motion.section>
 </div>;
}
