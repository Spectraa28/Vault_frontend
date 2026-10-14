import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import gsap from 'gsap';
import { useGame } from '../store';
import { CAST } from '../contract';
import { playerPosition } from './Actor';
export default function Camera() {
 const {camera}=useThree();const phase=useGame(s=>s.phase),active=useGame(s=>s.active),reduced=useGame(s=>s.reduced),delegated=useGame(s=>s.delegateAt),cine=useGame(s=>s.cine?.at??0);
 const look=useMemo(()=>new Vector3(0,3,0),[]);const transitioning=useRef(false);
 // During a conversation the camera is framed for you, but it is not locked: move the mouse to lean
 // around the character and scroll to step closer or further back.
 const home=useRef<Vector3|null>(null), sideways=useMemo(()=>new Vector3(),[]), lean=useRef({x:0,y:0,zoom:1,tx:0,ty:0,tz:1});
 useEffect(()=>{
  const move=(e:PointerEvent)=>{lean.current.tx=(e.clientX/innerWidth-.5)*2;lean.current.ty=(e.clientY/innerHeight-.5)*2;};
  const wheel=(e:WheelEvent)=>{if(useGame.getState().phase!=='conversation'||(e.target as HTMLElement)?.closest?.('textarea, .teller-tape'))return;lean.current.tz=Math.min(1.35,Math.max(.62,lean.current.tz+Math.sign(e.deltaY)*.07));};
  window.addEventListener('pointermove',move);window.addEventListener('wheel',wheel,{passive:true});
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('wheel',wheel);};
 },[]);
 useEffect(()=>{
  let target:Vector3|undefined,focus:Vector3|undefined;
  if(phase==='login'){target=new Vector3(-1.4,2.6,13);focus=new Vector3(-1.4,1.2,7);}
  if(phase==='conversation'&&active){const p=new Vector3(...CAST[active].position);const direction=playerPosition.clone().sub(p).setY(0).normalize();const side=new Vector3(direction.z,0,-direction.x);target=p.clone().addScaledVector(direction,4.3).addScaledVector(side,-2.25);target.y=p.y+2.0;focus=p.clone().add(new Vector3(-.2,1.15,0));sideways.copy(side);}
  if(phase==='ending'||phase==='end'){target=new Vector3(16,12,24);focus=new Vector3(0,5,0);}
  // The doors get a shot of their own: square on, a little below eye level, so both leaves are seen swinging in.
  let seconds=phase==='ending'?2.5:1.2;
  if(cine&&phase==='conversation'){target=new Vector3(.5,2.1,10.2);focus=new Vector3(0,2.7,0);seconds=1.5;}
  home.current=phase==='conversation'&&target&&!cine?target.clone():null;lean.current.tz=1;
  if(!target||!focus)return;
  transitioning.current=true;
  const tl=gsap.timeline({onComplete:()=>{transitioning.current=false;}});
  tl.to(camera.position,{...target,duration:reduced?0:seconds,ease:'power2.inOut'},0).to(look,{...focus,duration:reduced?0:Math.min(seconds,1.3),ease:'power2.inOut'},0);
  return()=>{tl.kill();transitioning.current=false;};
 },[phase,active,reduced,camera,look,cine]);
 const cut=useRef<{position:Vector3;look:Vector3;active:boolean}|null>(null);
 useFrame(({clock})=>{
  if(phase==='title'){const t=reduced?0:clock.elapsedTime*.035;camera.position.set(18+Math.sin(t)*2,9.8,23+Math.cos(t)*2);look.set(0,3.7,0);camera.lookAt(look);}
  else if(phase!=='play'){
   if(delegated&&Date.now()-delegated<1400&&phase==='conversation'&&!reduced){
    if(!cut.current?.active)cut.current={position:camera.position.clone(),look:look.clone(),active:true};
    camera.position.set(1,-.8,-24.5);camera.lookAt(0,-1,-27);
   }else{
    if(cut.current?.active){camera.position.copy(cut.current.position);look.copy(cut.current.look);cut.current.active=false;}
    if(phase==='conversation'&&home.current&&!transitioning.current&&!reduced){
     const l=lean.current;l.x+=(l.tx-l.x)*.06;l.y+=(l.ty-l.y)*.06;l.zoom+=(l.tz-l.zoom)*.08;
     camera.position.copy(look).addScaledVector(home.current.clone().sub(look),l.zoom).addScaledVector(sideways,-l.x*.95);camera.position.y+=-l.y*.45;
    }
    camera.lookAt(look);
   }
  }else{cut.current=null;}
 });
 return null;
}
