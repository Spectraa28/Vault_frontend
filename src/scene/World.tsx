import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, KeyboardControls, Sparkles, useProgress } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BufferAttribute, Group, Points, Vector3 } from 'three';
import { useGame } from '../store';
import { Actor, Figure, Pip } from './Actor';
import Player from './Player';
import Camera from './Camera';
import { Box, C, Cylinder } from './primitives';
const Gate=lazy(()=>import('./areas/Gate'));
const Lobby=lazy(()=>import('./areas/Lobby'));
const Vault=lazy(()=>import('./areas/Vault'));
const keys=[{name:'forward',keys:['ArrowUp','KeyW']},{name:'backward',keys:['ArrowDown','KeyS']},{name:'leftward',keys:['ArrowLeft','KeyA']},{name:'rightward',keys:['ArrowRight','KeyD']},{name:'run',keys:['ShiftLeft','ShiftRight']},{name:'jump',keys:[]},{name:'cameraLeft',keys:['KeyQ']},{name:'cameraRight',keys:['KeyR']}];
function Rain(){
 const ref=useRef<Points>(null);const quality=useGame(s=>s.graphics);const reduced=useGame(s=>s.reduced);
 const data=useMemo(()=>{const n=quality==='High'?950:quality==='Medium'?450:160;const a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=((i*17.321)%30)-15;a[i*3+1]=(i*.619)%15;a[i*3+2]=(i*7.231)%18+1;}return a;},[quality]);
 useFrame((_,dt)=>{if(!ref.current||reduced)return;const p=ref.current.geometry.attributes.position as BufferAttribute;for(let i=0;i<p.count;i++){let y=p.getY(i)-dt*9;if(y<0)y=15;p.setY(i,y);}p.needsUpdate=true;});
 return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data,3]}/></bufferGeometry><pointsMaterial color="#b7cfca" size={.027} transparent opacity={.45} depthWrite={false}/></points>;
}
function Avatars(){
 const selected=useGame(s=>s.avatar);const [hover,setHover]=useState(-1);const groups=useRef<(Group|null)[]>([]);const reduced=useGame(s=>s.reduced);
 useFrame(({clock},dt)=>groups.current.forEach((g,i)=>{if(g){g.position.z+=( (hover===i||selected===i?.4:0)-g.position.z)*Math.min(1,dt*7);g.rotation.y=reduced?0:Math.sin(clock.elapsedTime*.4)*.18;}}));
 return <group position={[0,0,7]}>{[0,1].map(i=><group key={i} position={[(i-.5)*1.65,0,0]}><Cylinder radius={.7} height={.1} color={selected===i?C.brass:'#48544a'}/><group ref={g=>{groups.current[i]=g;}} onPointerOver={()=>setHover(i)} onPointerOut={()=>setHover(-1)} onClick={()=>useGame.getState().set({avatar:i})}><Figure color={i?'#775b47':'#2b4a41'} variant={i} badge/></group></group>)}<pointLight position={[0,3,2]} color="#ffdaa2" intensity={18} distance={7}/></group>;
}
function Lighting(){const area=useGame(s=>s.area),graphics=useGame(s=>s.graphics);return <><ambientLight intensity={.6}/><hemisphereLight args={['#99baca','#183327',1.5]}/><directionalLight position={area==='vault'?[1,2,-27]:area==='lobby'?[0,7,-6]:[-7,12,8]} intensity={area==='gate'?2.4:1.8} color={area==='gate'?'#aac9d7':'#ffe4b0'} castShadow={graphics!=='Low'} shadow-mapSize={[graphics==='High'?2048:1024,graphics==='High'?2048:1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-bias={-.001}/></>;}
function Scene(){
 const phase=useGame(s=>s.phase),graphics=useGame(s=>s.graphics),reduced=useGame(s=>s.reduced),unlocked=useGame(s=>s.unlocked),active=useGame(s=>s.active);
 const started=['play','conversation','ending','end'].includes(phase);
 return <>
  <color attach="background" args={['#101e23']}/><fog attach="fog" args={['#101e23',25,80]}/>
  <Environment files="/textures/night.hdr" environmentIntensity={.65}/><Lighting/>
  <Physics timeStep={1/60} paused={!started}>
   <Gate/>{started&&<Lobby/>}{unlocked.includes('vault-guard')&&<Vault/>}
   <Box at={[-16,2,9]} size={[.3,4,20]} color="#15292b" solid/><Box at={[16,2,9]} size={[.3,4,20]} color="#15292b" solid/><Box at={[0,1.5,19]} size={[32,3,.3]} color="#15292b" solid/>
   {started&&<><Player/><Actor id="door-guard"/>{unlocked.includes('cashier')&&<Actor id="cashier"/>}{unlocked.includes('vault-guard')&&<><Actor id="vault-guard"/><Pip/></>}</>}
   {phase==='login'&&<Avatars/>}
  </Physics>
  <Rain/>{graphics!=='Low'&&<Sparkles count={70} scale={[14,6,35]} size={1.6} speed={reduced?0:.16} opacity={.3} position={[0,2,-12]} color="#d7bd7c"/>}
  {graphics==='High'&&<mesh position={[3,4,-6]} rotation={[0,0,.25]}><coneGeometry args={[2.1,7,20,1,true]}/><meshBasicMaterial color="#d6c795" transparent opacity={.028} depthWrite={false}/></mesh>}
  <Camera/>
  {graphics!=='Low'&&<EffectComposer multisampling={graphics==='High'?2:0}>
   <Bloom intensity={.35} luminanceThreshold={1.1} mipmapBlur/>
   <DepthOfField target={active?new Vector3(...({'door-guard':[3.1,1.4,4.1],cashier:[-2.8,1.4,-9],'vault-guard':[2,-1.6,-29]} as Record<string,[number,number,number]>)[active]):undefined} focalLength={.08} bokehScale={phase==='conversation'&&graphics==='High'?1.4:0} height={360}/>
   <Vignette eskil={false} offset={.2} darkness={.48}/><Noise opacity={.022}/>
  </EffectComposer>}
 </>;
}
export function Loading(){const {active,progress}=useProgress();return active?<div className="loading-screen" role="status"><img src="/vault.svg" alt=""/><span>WAKING THE NIGHT WATCH</span><small>{Math.round(progress)}%</small></div>:null;}
export default function World(){
 const graphics=useGame(s=>s.graphics);const phase=useGame(s=>s.phase);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>useGame.getState().set({reduced:m.matches});m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 return <div className={`world ${phase==='conversation'?'in-conversation':''}`} aria-label="Three-dimensional bank. Use WASD or arrow keys to walk, E to talk, Q and R to rotate the camera."><KeyboardControls map={keys}><Canvas shadows={graphics!=='Low'} dpr={graphics==='High'?[1,1.75]:graphics==='Medium'?[1,1.25]:[.75,1]} camera={{position:[18,10,25],fov:48,near:.1,far:100}} gl={{antialias:graphics!=='Low',powerPreference:'high-performance'}} fallback={<div className="webgl-error">This bank needs WebGL. Enable hardware acceleration and reload.</div>}><Suspense fallback={null}><Scene/></Suspense></Canvas></KeyboardControls><Loading/></div>;
}
