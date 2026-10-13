import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { Group, MeshStandardMaterial } from 'three';
import { useGame } from '../../store';
import { Box, C, Cylinder, Floor, Label, Lamp } from '../primitives';
import { sound } from '../../sound';
export default function Vault() {
 const wheel=useRef<Group>(null), door=useRef<Group>(null), bolts=useMemo(()=>new MeshStandardMaterial({color:C.brass,emissive:'#e52b1f',emissiveIntensity:0,metalness:.7}),[]);
 const attempt=useGame(s=>s.vaultAttempt), reduced=useGame(s=>s.reduced);
 useEffect(()=>{
  if(!attempt||!wheel.current||!door.current)return;
  sound('vault'); const ctx=gsap.context(()=>{
   if(reduced){gsap.fromTo(bolts,{emissiveIntensity:2},{emissiveIntensity:0,duration:.7});return;}
   const tl=gsap.timeline(); tl.to(wheel.current!.rotation,{z:Math.PI*5/6,duration:1.3,ease:'power2.inOut'}).to(bolts,{emissiveIntensity:3,duration:.15}).to(door.current!.position,{x:.05,duration:.07,yoyo:true,repeat:7}).to(wheel.current!.rotation,{z:0,duration:1.1,ease:'power3.out'}).to(bolts,{emissiveIntensity:0,duration:.6});
  });return()=>ctx.revert();
 },[attempt,reduced]);
 return <group>
  {/* A smooth invisible ramp under the shallow steps lets the capsule walk down without jumping. */}
  <Box at={[0,-1.65,-19]} size={[6,.3,6.72]} color="#646960" rotation={[-Math.atan(.5),0,0]} solid/>
  {Array.from({length:12},(_,i)=><Box key={i} at={[0,-.125-i*.25,-16.25-i*.5]} size={[6,.18,.5]} color={i%2?'#667265':'#738074'}/>)}
  <Floor at={[0,-3.18,-28]} size={[8,.35,12]}/>
  {[-4,4].map(x=><Box key={x} at={[x,-.5,-28]} size={[.4,5,13]} color="#32413b" solid/>)}
  {[-3.2,3.2].map(x=><Box key={x} at={[x,1,-19]} size={[.25,6,6]} color={C.green} solid/>)}
  {[-23,-28,-32].map(z=><group key={z}><Box at={[0,2,z]} size={[8,.2,.5]} color={C.brass}/><Lamp at={[-3.7,-.4,z]}/></group>)}
  <Box at={[0,0,-34.3]} size={[8,6,.7]} color="#34433f" solid/>
  <group position={[0,-.6,-33.7]}><group ref={door}>
    <Cylinder radius={2.65} height={.65} color="#252f30" rotation={[Math.PI/2,0,0]}/>
    <Cylinder at={[0,0,.4]} radius={2.4} height={.25} color="#73847e" rotation={[Math.PI/2,0,0]}/>
    <mesh position={[0,0,.58]}><torusGeometry args={[2.27,.12,12,64]}/><meshStandardMaterial color={C.brass} metalness={.82} roughness={.28}/></mesh>
    {Array.from({length:12},(_,i)=><mesh key={i} position={[Math.cos(i*Math.PI/6)*2.03,Math.sin(i*Math.PI/6)*2.03,.6]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.1,.1,.22,8]}/><primitive object={bolts} attach="material"/></mesh>)}
    <Label at={[0,1.25,.72]} size={.18}>MERIDIAN SAFE WORKS</Label>
    <Label at={[0,-1.4,.72]} size={.13}>NO. 001 · AUTHORITY REQUIRED</Label>
    <group ref={wheel} position={[0,0,.94]}>
      <mesh><torusGeometry args={[1,.055,10,48]}/><meshStandardMaterial color={C.brass} metalness={.9} roughness={.23}/></mesh>
      {Array.from({length:8},(_,i)=><group key={i} rotation={[0,0,i*Math.PI/4]}><Cylinder at={[0,.5,0]} radius={.035} height={1}/><Cylinder at={[0,1,.12]} radius={.055} height={.28} rotation={[Math.PI/2,0,0]}/></group>)}
      <Cylinder radius={.22} height={.22} rotation={[Math.PI/2,0,0]}/>
    </group>
  </group></group>
  <group position={[2.8,-3,-30.7]}><Box at={[0,.5,0]} size={[.8,.15,.8]} color="#544531"/><Box at={[0,1,-.35]} size={[.8,1,.1]} color="#544531"/>{[-.3,.3].map(x=><Box key={x} at={[x,.25,0]} size={[.1,.5,.65]} color={C.brass}/>)}<Lamp at={[.6,.8,0]}/></group>
  <group position={[-2.7,-3,-30]}><Box at={[0,.65,0]} size={[1.2,.12,1.2]} color="#b9b49a"/><Cylinder at={[0,.3,0]} radius={.08} height={.6}/><Box at={[0,.74,0]} size={[.65,.02,.65]} color="#23382d"/>{Array.from({length:8},(_,i)=><Cylinder key={i} at={[-.26+(i%4)*.17,.8,i<4?-.24:.24]} radius={.035} height={.12} color={i<4?C.pale:C.dark}/>)}<Cylinder at={[.45,.9,.3]} radius={.09} height={.42} color={C.brass}/></group>
  <pointLight position={[0,1,-31]} color="#f6d59f" intensity={30} distance={10}/>
 </group>;
}
