import { useEffect, useRef } from 'react';
import Ecctrl, { type CustomEcctrlRigidBody } from 'ecctrl';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CAST, type Character } from '../contract';
import { useGame } from '../store';
import { Figure, playerMotion, playerPosition } from './Actor';
import { ambience, listener, sound } from '../sound';
export default function Player() {
 const ref=useRef<CustomEcctrlRigidBody>(null); const lastStep=useRef(0); const [,keys]=useKeyboardControls();
 const phase=useGame(s=>s.phase), avatar=useGame(s=>s.avatar), area=useGame(s=>s.area), active=useGame(s=>s.active), reduced=useGame(s=>s.reduced);
 useEffect(()=>{if(phase!=='play')ref.current?.group?.setLinvel({x:0,y:0,z:0},true);if(active){const p=CAST[active].position;ref.current?.rotateCharacterOnY(Math.atan2(p[0]-playerPosition.x,p[2]-playerPosition.z));}},[phase,active]);
 useFrame(({clock},dt)=>{
  if(!ref.current?.group)return;
  const body=ref.current.group,p=body.translation();playerPosition.set(p.x,p.y,p.z);listener(p.x,p.y,p.z);
  const v=body.linvel();playerMotion.speed=phase==='play'?Math.hypot(v.x,v.z):0;
  const s=useGame.getState();
  if(phase==='play'){
   const area=p.z>0?'gate':p.z> -19?'lobby':'vault'; if(s.area!==area){s.set({area});ambience(area);}
   let near:Character|null=null;let distance=3;
   for(const id of s.unlocked){const [x,y,z]=CAST[id].position;const d=Math.hypot(p.x-x,p.z-z);if(d<distance&&Math.abs(p.y-y)<2.4){near=id;distance=d;}}
   if(s.near!==near)s.set({near});
   const k=keys();if(k.cameraLeft)ref.current.rotateCamera(-dt*90,0);if(k.cameraRight)ref.current.rotateCamera(dt*90,0);
   if(playerMotion.speed>.5&&clock.elapsedTime-lastStep.current>(playerMotion.speed>3?.3:.5)){sound(area==='gate'?'wet':area==='lobby'?'marble':'concrete');lastStep.current=clock.elapsedTime;}
   if(p.y< -12){body.setTranslation({x:0,y:2,z:8},true);body.setLinvel({x:0,y:0,z:0},true);s.set({error:'You slipped out of the scene. Returned to the pavement.'});}
  }
 });
 return <Ecctrl ref={ref} autoBalance={false} position={[1.2,1.4,6.3]} capsuleHalfHeight={.42} capsuleRadius={.3} floatHeight={.22} characterInitDir={Math.PI} disableControl={phase!=='play'} disableFollowCam={phase!=='play'} camInitDir={{x:.24,y:Math.PI}} camInitDis={-5.8} camMaxDis={area==='vault'?-3.8:-6.5} camMinDis={-1} camTargetPos={{x:0,y:area==='vault'?.25:.65,z:0}} camCollision camCollisionOffset={.8} camFollowMult={reduced?100:8} camLerpMult={reduced?100:4} camListenerTarget="domElement" maxVelLimit={2.4} sprintMult={1.65} jumpVel={0} slopeMaxAngle={.8} turnSpeed={12}>
  <group position={[0,-.88,0]}><Figure player color={avatar?'#775b47':'#2b4a41'} variant={avatar} badge/></group>
 </Ecctrl>;
}
