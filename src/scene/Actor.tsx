import { Suspense, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { Group, MathUtils, Vector3 } from 'three';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import gsap from 'gsap';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { useMemo } from 'react';
import { CAST, type Character, type Mood } from '../contract';
import { useGame } from '../store';
import { Box, C, Cylinder } from './primitives';
export const playerPosition = new Vector3(1.2,1,6.3);
export const playerMotion = { speed: 0 };
// Add licensed compressed GLBs here; clips should be named Idle, Walk, Jog and the mood names.
export const characterModels: Partial<Record<string,string>> = {};
function Model({ url, clip }: { url: string; clip: string }) {
 const gltf=useGLTF(url), scene=useMemo(()=>clone(gltf.scene),[gltf.scene]); const {actions}=useAnimations(gltf.animations,scene);
 useEffect(()=>{const action=actions[clip]??actions.Idle;action?.reset().fadeIn(.25).play();return()=>{action?.fadeOut(.25);};},[actions,clip]);
 return <primitive object={scene}/>;
}
export function Figure({ color=C.green, mood='wary', working=false, player=false, variant=0, badge=false }: {color?:string;mood?:Mood;working?:boolean;player?:boolean;variant?:number;badge?:boolean}) {
 const root=useRef<Group>(null), head=useRef<Group>(null), left=useRef<Group>(null),right=useRef<Group>(null), legs=useRef<Group>(null);
 const reduced=useGame(s=>s.reduced);
 useFrame(({clock},dt)=>{
  const t=clock.elapsedTime; const walk=player?Math.min(playerMotion.speed/2,1):0; const swing=Math.sin(t*(playerMotion.speed>3?13:8))*walk;
  if(root.current) root.current.position.y=reduced?0:Math.sin(t*2)*.012+Math.abs(swing)*.035;
  if(head.current){head.current.rotation.z=MathUtils.damp(head.current.rotation.z,mood==='curious'?.17:mood==='flustered'?Math.sin(t*4)*.09:0,5,dt);head.current.rotation.x=mood==='convinced'&&!reduced?Math.sin(t*3)*.05:0;}
  if(left.current){left.current.rotation.x=MathUtils.damp(left.current.rotation.x,working?-1.2+Math.sin(t*5)*.25:mood==='flustered'?-1.9:mood==='wary'?-.75:swing*.55,6,dt);left.current.rotation.z=mood==='wary'?-.3:.1;}
  if(right.current){right.current.rotation.x=MathUtils.damp(right.current.rotation.x,working?-.9+Math.sin(t*5+1)*.3:mood==='flustered'?-1.9:mood==='wary'?-.75:-swing*.55,6,dt);right.current.rotation.z=mood==='wary'?.3:-.1;}
  if(legs.current){legs.current.children[0].rotation.x=swing*.5;legs.current.children[1].rotation.x=-swing*.5;}
 });
 return <group ref={root}>
  <group ref={legs} position={[0,.58,0]}>{[-.14,.14].map(x=><group key={x} position={[x,0,0]}><Box at={[0,-.28,0]} size={[.19,.56,.22]} color="#1e2726"/><Box at={[0,-.56,.07]} size={[.22,.12,.37]} color="#121c1a"/></group>)}</group>
  <mesh position={[0,1,0]} castShadow><capsuleGeometry args={[.29,.45,4,8]}/><meshStandardMaterial color={color} roughness={.85}/></mesh>
  <Box at={[0,.85,0]} size={[.62,.7,.36]} color={color}/>
  <Box at={[0,1.22,.22]} size={[.13,.3,.035]} color={C.pale} rotation={[0,0,.15]}/>
  <Box at={[0,1.2,.25]} size={[.045,.28,.025]} color="#ad8c50"/>
  {[-1,1].map(side=><group ref={side<0?left:right} key={side} position={[side*.36,1.3,0]}><Box at={[0,-.22,0]} size={[.17,.48,.19]} color={color}/><mesh position={[0,-.49,0]}><sphereGeometry args={[.1,8,8]}/><meshStandardMaterial color="#bb9673"/></mesh></group>)}
  <group ref={head} position={[0,1.65,0]}>
   <mesh castShadow><sphereGeometry args={[.235,10,10]}/><meshStandardMaterial color={variant?'#a4795d':'#c6a37c'} roughness={.85}/></mesh>
   <mesh position={[0,.05,-.1]}><sphereGeometry args={[.22,10,10]}/><meshStandardMaterial color="#302b24"/></mesh>
   <Box at={[-.08,.02,.2]} size={[.034,.033,.025]} color="#1c2823"/><Box at={[.08,.02,.2]} size={[.034,.033,.025]} color="#1c2823"/>
   <Box at={[0,-.11,.195]} size={[.08,.012,.025]} color="#5e4a36"/>
   <Cylinder at={[0,.2,0]} radius={.34} height={.05} color={color} metal={0}/><Cylinder at={[0,.3,0]} radius={.23} height={.21} color={color} metal={0}/><Cylinder at={[0,.24,0]} radius={.236} height={.05} color={C.brass} metal={.3}/>
  </group>
  {badge&&<Box at={[.19,1.23,.205]} size={[.14,.18,.035]} color={C.brass} metal={.6}/>}
 </group>;
}
export function Actor({ id }: {id:Character}) {
 const spec=CAST[id], root=useRef<Group>(null), headTurn=useRef(0);
 const near=useGame(s=>s.near===id), active=useGame(s=>s.active===id), busy=useGame(s=>s.busy), mood=useGame(s=>s.mood), cold=useGame(s=>s.coldUntil[id]??0);
 useFrame((_,dt)=>{
  if(!root.current)return;
  const target=near||active?Math.atan2(playerPosition.x-spec.position[0],playerPosition.z-spec.position[2]):0;
  headTurn.current=MathUtils.damp(headTurn.current,target,6,dt);
  root.current.rotation.y=MathUtils.damp(root.current.rotation.y,Date.now()<cold?Math.PI:headTurn.current,2,dt);
 });
 return <group position={spec.position}>
  <RigidBody type="fixed" colliders={false}><CapsuleCollider args={[.6,.34]} position={[0,1,0]}/></RigidBody>
  <group ref={root}>
   {characterModels[id]?<Suspense fallback={<Figure color={spec.color}/>}><Model url={characterModels[id]!} clip={active&&busy?'Working':active?mood:'Idle'}/></Suspense>:<Figure color={spec.color} mood={active?mood:'wary'} working={active&&busy} badge/>}
  </group>
  {(near||active)&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><ringGeometry args={[.62,.68,48]}/><meshBasicMaterial color={C.brass} transparent opacity={.75}/></mesh>}
  {near&&!active&&<Html position={[0,2.4,0]} center distanceFactor={10} zIndexRange={[20,0]}><button className="world-prompt" onClick={()=>useGame.getState().talk(id)}><kbd>E</kbd> {Date.now()<cold?'Give them a minute':`Talk to ${spec.name}`}</button></Html>}
 </group>;
}
export function Pip() {
 const ref=useRef<Group>(null); const at=useGame(s=>s.delegateAt), reduced=useGame(s=>s.reduced), busy=useGame(s=>s.busy);
 useEffect(()=>{
  if(!ref.current||!at)return;
  const timeline=gsap.timeline();
  if(reduced)timeline.set(ref.current.position,{x:-.7,y:-3,z:-31});
  else timeline.to(ref.current.position,{x:0,y:0,z:-16,duration:.4}).to(ref.current.position,{x:0,y:-3,z:-22,duration:.8,ease:'none'}).to(ref.current.position,{x:-.7,y:-3,z:-31,duration:1.2,ease:'power2.out'});
  return()=>{timeline.kill();};
 },[at,reduced]);
 return <group ref={ref} position={[2.3,0,-14.7]} scale={.88}><Figure color="#7d7555" working={!!at&&busy} mood={at?'flustered':'curious'} variant={1} badge/></group>;
}
