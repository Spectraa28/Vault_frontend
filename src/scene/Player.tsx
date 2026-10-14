import { useEffect, useRef } from 'react';
import Ecctrl, { type CustomEcctrlRigidBody } from 'ecctrl';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CAST, type Character } from '../contract';
import { useGame } from '../store';
import { Figure, LOOKS, playerControl, playerMotion, playerPosition } from './Actor';
import { ambience, footfall, listener } from '../sound';
export default function Player() {
 const ref=useRef<CustomEcctrlRigidBody>(null); const lastStep=useRef(0); const [,keys]=useKeyboardControls();
 const phase=useGame(s=>s.phase), avatar=useGame(s=>s.avatar), area=useGame(s=>s.area), active=useGame(s=>s.active), reduced=useGame(s=>s.reduced);
 useEffect(()=>{if(phase!=='play')ref.current?.group?.setLinvel({x:0,y:0,z:0},true);if(active){const p=CAST[active].position;ref.current?.rotateCharacterOnY(Math.atan2(p[0]-playerPosition.x,p[2]-playerPosition.z));}},[phase,active]);
 useEffect(()=>{playerControl.teleport=(x,y,z)=>{const body=ref.current?.group;if(!body)return;body.setTranslation({x,y,z},true);body.setLinvel({x:0,y:0,z:0},true);};return()=>{playerControl.teleport=undefined;};},[]);
 useFrame(({clock},dt)=>{
  if(!ref.current?.group)return;
  const body=ref.current.group,p=body.translation();playerPosition.set(p.x,p.y,p.z);listener(p.x,p.y,p.z);
  const v=body.linvel();playerMotion.speed=phase==='play'?Math.hypot(v.x,v.z):0;
  const s=useGame.getState();
  if(phase==='play'){
   const area=p.z>0?'gate':p.z> -19?'lobby':'vault'; if(s.area!==area){s.set({area});ambience(area);}
   let near:Character|null=null;let distance=3;
   for(const id of s.unlocked){const [x,y,z0]=CAST[id].position;const z=z0+CAST[id].ring;const d=Math.hypot(p.x-x,p.z-z);if(d<distance&&Math.abs(p.y-y)<2.4){near=id;distance=d;}}
   if(s.near!==near)s.set({near});
   const k=keys();if(k.cameraLeft)ref.current.rotateCamera(-dt*90,0);if(k.cameraRight)ref.current.rotateCamera(dt*90,0);if(k.cameraUp)ref.current.rotateCamera(0,-dt*55);if(k.cameraDown)ref.current.rotateCamera(0,dt*55);
   const jogging=playerMotion.speed>4.6;if(playerMotion.speed>.6&&clock.elapsedTime-lastStep.current>(jogging?Math.PI/14:Math.PI/10.5)){footfall(jogging?1.15:1);lastStep.current=clock.elapsedTime;}
   if(p.y< -12){body.setTranslation({x:0,y:2,z:8},true);body.setLinvel({x:0,y:0,z:0},true);s.set({error:'You slipped out of the scene. Returned to the pavement.'});}
  }
 });
 return <Ecctrl ref={ref} autoBalance={false} position={[1.2,1.4,6.3]} capsuleHalfHeight={.42} capsuleRadius={.3} floatHeight={.22} characterInitDir={Math.PI} disableControl={phase!=='play'} disableFollowCam={phase!=='play'} camInitDir={{x:.24,y:Math.PI}} camInitDis={-5.8} camMaxDis={area==='vault'?-5.5:-10} camMinDis={-1.4} camUpLimit={1.25} camLowLimit={-0.45} camMoveSpeed={1.6} camZoomSpeed={1.8} camTargetPos={{x:0,y:area==='vault'?.25:.65,z:0}} camCollision camCollisionOffset={.8} camFollowMult={reduced?100:11} camLerpMult={reduced?100:7} camListenerTarget="domElement" maxVelLimit={3.7} sprintMult={1.6} jumpVel={0} slopeMaxAngle={.8} turnSpeed={12}>
  <group position={[0,-.88,0]}><Figure player look={LOOKS[avatar?'player-1':'player-0']}/></group>
 </Ecctrl>;
}
