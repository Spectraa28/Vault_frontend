import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import gsap from 'gsap';
import { useGame } from '../store';
import { CAST } from '../contract';
import { playerPosition } from './Actor';
export default function Camera() {
 const {camera}=useThree();const phase=useGame(s=>s.phase),active=useGame(s=>s.active),reduced=useGame(s=>s.reduced),delegated=useGame(s=>s.delegateAt);
 const look=useMemo(()=>new Vector3(0,3,0),[]);const transitioning=useRef(false);
 useEffect(()=>{
  let target:Vector3|undefined,focus:Vector3|undefined;
  if(phase==='login'){target=new Vector3(-1.4,2.6,13);focus=new Vector3(-1.4,1.2,7);}
  if(phase==='conversation'&&active){const p=new Vector3(...CAST[active].position);const direction=playerPosition.clone().sub(p).setY(0).normalize();const side=new Vector3(direction.z,0,-direction.x);target=p.clone().addScaledVector(direction,3.7).addScaledVector(side,-1.45);target.y=p.y+1.9;focus=p.clone().add(new Vector3(-.35,1.25,0));}
  if(phase==='ending'||phase==='end'){target=new Vector3(16,12,24);focus=new Vector3(0,5,0);}
  if(!target||!focus)return;
  transitioning.current=true;
  const tl=gsap.timeline({onComplete:()=>{transitioning.current=false;}});
  tl.to(camera.position,{...target,duration:reduced?0:phase==='ending'?2.5:1.2,ease:'power2.inOut'},0).to(look,{...focus,duration:reduced?0:1.2,ease:'power2.inOut'},0);
  return()=>{tl.kill();transitioning.current=false;};
 },[phase,active,reduced,camera,look]);
 const cut=useRef<{position:Vector3;look:Vector3;active:boolean}|null>(null);
 useFrame(({clock})=>{
  if(phase==='title'){const t=reduced?0:clock.elapsedTime*.035;camera.position.set(18+Math.sin(t)*2,9.8,23+Math.cos(t)*2);look.set(0,3.7,0);camera.lookAt(look);}
  else if(phase!=='play'){
   if(delegated&&Date.now()-delegated<1400&&phase==='conversation'&&!reduced){
    if(!cut.current?.active)cut.current={position:camera.position.clone(),look:look.clone(),active:true};
    camera.position.set(1,-.8,-24.5);camera.lookAt(0,-1,-27);
   }else{
    if(cut.current?.active){camera.position.copy(cut.current.position);look.copy(cut.current.look);cut.current.active=false;}
    camera.lookAt(look);
   }
  }else{cut.current=null;}
 });
 return null;
}
