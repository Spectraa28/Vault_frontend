import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import { cameraDistance, floorHeight, smoothCamera } from '../cameraMath';
import { Vector3 } from 'three';
import gsap from 'gsap';
import { useGame } from '../store';
import { CAST } from '../contract';
import { playerControl, playerPosition } from './shared';
export default function Camera() {
 const {camera,size}=useThree(); const {world,rapier}=useRapier();
 const [,keys]=useKeyboardControls();const tilt=useRef(0);
 const sphere=useMemo(()=>new rapier.Ball(.24),[rapier]);
 const anchor=useMemo(()=>new Vector3(),[]), direction=useMemo(()=>new Vector3(),[]), desired=useMemo(()=>new Vector3(),[]);
 const zoom=useRef(5), previous=useRef(new Vector3(18,10,25)), returnTime=useRef(0);
 const clip=(origin:Vector3,to:Vector3)=>{direction.copy(to).sub(origin);const distance=direction.length();if(distance<.001)return;direction.divideScalar(distance);const hit=world.castShape(origin,{x:0,y:0,z:0,w:1},direction,sphere,0,distance,true,rapier.QueryFilterFlags.EXCLUDE_DYNAMIC|rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,c=>!(c.parent()?.userData as {cameraIgnore?:boolean}|undefined)?.cameraIgnore);if(hit)to.copy(origin).addScaledVector(direction,Math.max(0,hit.time_of_impact-.05));};const phase=useGame(s=>s.phase),active=useGame(s=>s.active),reduced=useGame(s=>s.reduced),delegated=useGame(s=>s.delegateAt),cine=useGame(s=>s.cine?.at??0);
 const look=useMemo(()=>new Vector3(0,3,0),[]);const transitioning=useRef(false);
 // During a conversation the camera is framed for you, but it is not locked: move the mouse to lean
 // around the character and scroll to step closer or further back.
 const home=useRef<Vector3|null>(null), sideways=useMemo(()=>new Vector3(),[]), lean=useRef({x:0,y:0,zoom:1,tx:0,ty:0,tz:1});
 useEffect(()=>{
  const move=(e:PointerEvent)=>{lean.current.tx=(e.clientX/innerWidth-.5)*2;lean.current.ty=(e.clientY/innerHeight-.5)*2;};
  const wheel=(e:WheelEvent)=>{if(useGame.getState().phase!=='conversation'||(e.target as HTMLElement)?.closest?.('textarea, .teller-tape, .wallet, .task-panel'))return;lean.current.tz=Math.min(1.35,Math.max(.62,lean.current.tz+e.deltaY*.0005));};
  window.addEventListener('pointermove',move);window.addEventListener('wheel',wheel,{passive:true});
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('wheel',wheel);};
 },[]);
 useEffect(()=>{
  let target:Vector3|undefined,focus:Vector3|undefined;
  if(phase==='login'){target=new Vector3(-1.4,2.6,13);focus=new Vector3(-1.4,1.2,7);}
  if(phase==='conversation'&&active){const p=new Vector3(...CAST[active].position);const direction=new Vector3(playerPosition.x,playerPosition.y,playerPosition.z).sub(p).setY(0).normalize();const side=new Vector3(direction.z,0,-direction.x);const phone=size.width<=800;target=p.clone().addScaledVector(direction,4.3).addScaledVector(side,phone?-.55:-2.25);target.y=p.y+2.0;focus=p.clone().add(new Vector3(phone?0:-.2,phone?.7:1.15,0));if(phone)focus.addScaledVector(side,-.35);sideways.copy(side);}
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
 },[phase,active,reduced,camera,look,cine,size.width]);
 const cut=useRef<{position:Vector3;look:Vector3;active:boolean}|null>(null);
 useFrame(({clock},dt)=>{
  if(phase==='play'){
   const s=useGame.getState(), rendered=playerControl.renderedPosition?.();
   if(!rendered)return;
   anchor.set(playerPosition.x,playerPosition.y+.57+(s.area==='vault'?.25:.65),playerPosition.z);
   desired.copy(camera.position).sub(anchor);
   const requested=cameraDistance(desired.length(),s.area);
   const k=keys(), rawPitch=Math.atan2(desired.y,Math.hypot(desired.x,desired.z));
   tilt.current=Math.min(.85-rawPitch,Math.max(.08-rawPitch,tilt.current+((k.cameraUp?1:0)-(k.cameraDown?1:0))*dt*.85));
   desired.y=Math.tan(rawPitch+tilt.current)*Math.hypot(desired.x,desired.z);
   desired.normalize();zoom.current=smoothCamera(zoom.current,requested,dt);
   anchor.set(rendered.x,rendered.y+.88+.57+(s.area==='vault'?.25:.65),rendered.z);
   desired.multiplyScalar(Math.min(zoom.current,cameraDistance(100,s.area))).add(anchor);
   desired.y=Math.max(floorHeight(desired.z)+.28,desired.y);
   if(returnTime.current>0&&!reduced){desired.lerp(previous.current,Math.exp(-10*dt));returnTime.current-=dt;}
   clip(anchor,desired);camera.position.copy(desired);camera.lookAt(anchor);previous.current.copy(desired);cut.current=null;return;
  }
  returnTime.current=.8;
  if(phase==='title'){const t=reduced?0:clock.elapsedTime*.035;camera.position.set(18+Math.sin(t)*2,9.8,23+Math.cos(t)*2);look.set(0,3.7,0);camera.lookAt(look);}
  else {
   if(delegated&&Date.now()-delegated<1400&&phase==='conversation'&&!reduced){
    if(!cut.current?.active)cut.current={position:camera.position.clone(),look:look.clone(),active:true};
    camera.position.set(1,-.8,-24.5);camera.lookAt(0,-1,-27);
   }else{
    if(cut.current?.active){camera.position.copy(cut.current.position);look.copy(cut.current.look);cut.current.active=false;}
    if(phase==='conversation'&&home.current&&!transitioning.current&&!reduced){
     const l=lean.current;l.x=smoothCamera(l.x,l.tx,dt);l.y=smoothCamera(l.y,l.ty,dt);l.zoom=smoothCamera(l.zoom,l.tz,dt);
     camera.position.copy(look).addScaledVector(home.current.clone().sub(look),l.zoom).addScaledVector(sideways,-l.x*.95);camera.position.y+=-l.y*.45;
    }
    if(phase==='conversation'&&!cine){clip(look,camera.position);camera.position.y=Math.max(floorHeight(camera.position.z)+.28,camera.position.y);}
    camera.lookAt(look);
   }
  }
  previous.current.copy(camera.position);
 });
 return null;
}
