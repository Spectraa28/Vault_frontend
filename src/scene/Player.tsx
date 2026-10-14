import { useEffect, useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { CAMERA_LIMITS } from '../cameraMath';
import Ecctrl, { type CustomEcctrlRigidBody } from 'ecctrl';
import { useFrame } from '@react-three/fiber';
import { Html, useKeyboardControls } from '@react-three/drei';
import { WhoYouAre } from '../IdCard';
import { CAST, type Character } from '../contract';
import { useGame } from '../store';
import { Figure, LOOKS } from './Actor';
import { playerControl, playerMotion, playerPosition } from './shared';
import { ambience, footfall, listener } from '../sound';
export default function Player() {
 const ref=useRef<CustomEcctrlRigidBody>(null), visual=useRef<Group>(null); const rendered=useMemo(()=>new Vector3(),[]); const lastStep=useRef(0); const [,keys]=useKeyboardControls();
 const tasksOpen=useGame(s=>s.tasksOpen);
 const phase=useGame(s=>s.phase), avatar=useGame(s=>s.avatar), area=useGame(s=>s.area), active=useGame(s=>s.active), reduced=useGame(s=>s.reduced);
 useEffect(()=>{if(phase!=='play'||tasksOpen)ref.current?.group?.setLinvel({x:0,y:0,z:0},true);if(active){const p=CAST[active].position;ref.current?.rotateCharacterOnY(Math.atan2(p[0]-playerPosition.x,p[2]-playerPosition.z));}},[phase,active,tasksOpen]);
 useEffect(()=>{playerControl.renderedPosition=()=>{visual.current?.getWorldPosition(rendered);return rendered;};return()=>{playerControl.renderedPosition=undefined;};},[rendered]);
 useEffect(()=>{playerControl.teleport=(x,y,z)=>{const body=ref.current?.group;if(!body)return;body.setTranslation({x,y,z},true);body.setLinvel({x:0,y:0,z:0},true);};return()=>{playerControl.teleport=undefined;};},[]);
 useFrame(({clock},dt)=>{
  if(!ref.current?.group)return;
  const body=ref.current.group,p=body.translation();Object.assign(playerPosition,{x:p.x,y:p.y,z:p.z});listener(p.x,p.y,p.z);
  const v=body.linvel();playerMotion.speed=phase==='play'?Math.hypot(v.x,v.z):0;
  const s=useGame.getState();
  if(phase==='play'){
   const area=p.z>0?'gate':p.z> -19?'lobby':'vault'; if(s.area!==area){s.set({area});ambience(area);}
   let near:Character|null=null;let distance=3;
   for(const id of s.unlocked){const [x,y,z0]=CAST[id].position;const z=z0+CAST[id].ring;const d=Math.hypot(p.x-x,p.z-z);if(d<distance&&Math.abs(p.y-y)<2.4){near=id;distance=d;}}
   if(s.near!==near)s.set({near});
   const k=keys();if(k.cameraLeft)ref.current.rotateCamera(0,dt*1.5);if(k.cameraRight)ref.current.rotateCamera(0,-dt*1.5);
   const jogging=playerMotion.speed>4.6;if(playerMotion.speed>.6&&clock.elapsedTime-lastStep.current>(jogging?Math.PI/14:Math.PI/10.5)){footfall(jogging?1.15:1);lastStep.current=clock.elapsedTime;}
   if(p.y< -12){body.setTranslation({x:0,y:2,z:8},true);body.setLinvel({x:0,y:0,z:0},true);s.set({error:'You slipped out of the scene. Returned to the pavement.'});}
  }
 });
 return <Ecctrl ref={ref} autoBalance={false} position={[1.2,1.4,6.3]} capsuleHalfHeight={.42} capsuleRadius={.3} floatHeight={.22} characterInitDir={Math.PI} disableControl={phase!=='play'||tasksOpen} disableFollowCam={phase!=='play'} camInitDir={{x:.24,y:Math.PI}} camInitDis={-5.8} camMaxDis={-CAMERA_LIMITS[area]} camMinDis={-1.4} camUpLimit={.85} camLowLimit={.08} camMoveSpeed={1.6} camZoomSpeed={.65} camTargetPos={{x:0,y:area==='vault'?.25:.65,z:0}} camCollision={false} camFollowMult={10000} camLerpMult={10000} camListenerTarget="domElement" maxVelLimit={3.7} sprintMult={1.6} jumpVel={0} slopeMaxAngle={.8} turnSpeed={12}>
  <group ref={visual} position={[0,-.88,0]}><Figure player look={LOOKS[avatar?'player-1':'player-0']}/></group>
  {phase==='play'&&<Html position={[0,1.3,0]} center distanceFactor={6} zIndexRange={[15,0]} style={{pointerEvents:'none'}}><WhoYouAre/></Html>}
 </Ecctrl>;
}
