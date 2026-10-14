import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Group, MathUtils } from 'three';
import { useGame } from '../../store';
import { Box, BrassBars, C, Cylinder, Floor, Label, Lamp } from '../primitives';
import { CashPoint, Terminal } from '../props';
export default function Lobby() {
 const gate = useRef<Group>(null); const open = useGame(s=>s.unlocked.includes('vault-guard')); const reduced=useGame(s=>s.reduced);
 useFrame((_,dt)=>{ if(gate.current) gate.current.position.x=MathUtils.damp(gate.current.position.x,open?3.3:0,reduced?100:2,dt); });
 return <group>
  <Floor at={[0,-.18,-8]} size={[16,.35,16]}/>
  {[-8,8].map(x=><group key={x}><Box at={[x,4,-8]} size={[.4,8,16]} color="#304a3b" solid/><Box at={[x,1,-8]} size={[.5,2,16]} color="#142d25"/>{[-3,-8,-13].map(z=><group key={z}><Box at={[x*.97,4,z]} size={[.4,8,.55]} color="#a3a994"/><Lamp at={[x*.94,3.4,z]}/></group>)}</group>)}
  <Box at={[-5.5,3,-16]} size={[5,6,.4]} solid/><Box at={[5.5,3,-16]} size={[5,6,.4]} solid/><Box at={[0,5,-16]} size={[6,2,.4]}/>
  {/* A waist-high counter: low enough to see the teller over, as the old banking halls had. */}
  <group position={[-3,0,-10.5]}>
    <Box at={[0,.5,0]} size={[7,1,1.3]} color="#254637" solid/>
    <Box at={[0,1.06,0]} size={[7.3,.12,1.55]} color="#b5b9a0"/>
    <BrassBars positions={[-3.3,-2.7,-2.1,1.5,2.1,2.7,3.3].map(x=>[x,2.05,0])} height={1.9}/>
    <Box at={[0,3.02,0]} size={[7.3,.14,.2]} color={C.brass}/>
    <Label at={[0,3.4,.1]} size={.27}>ACCOUNTS & ENQUIRIES</Label>
    <Lamp at={[-1.75,1.12,.45]} green/>
    <Terminal at={[-.95,1.12,-.2]}/>
    <CashPoint at={[.95,1.12,-.05]}/>
  </group>
  {[-5.7,5.7].map(x=>[-3.5,-13].map(z=><group key={`${x}${z}`}><Cylinder at={[x,3,z]} radius={.4} height={6} color="#a7af9c" metal={.1}/><Cylinder at={[x,.2,z]} radius={.6} height={.4}/><Cylinder at={[x,5.9,z]} radius={.6} height={.35}/></group>))}
  <Label at={[0,4.2,-15.74]} size={.3}>SAFE DEPOSIT</Label>
  <Label at={[0,3.7,-15.74]} size={.14}>DOWNSTAIRS · BY APPOINTMENT</Label>
  <group ref={gate} position={[0,0,-16]}><BrassBars positions={Array.from({length:13},(_,i)=>[-2.7+i*.45,1.6,0])} height={3.2}/><Box at={[0,.3,0]} size={[5.7,.08,.08]} color={C.brass}/><Box at={[0,3.2,0]} size={[5.7,.12,.12]} color={C.brass}/></group>
  {!open&&<RigidBody type="fixed"><CuboidCollider args={[3,1.8,.2]} position={[0,1.8,-16]}/></RigidBody>}
  <mesh position={[0,5.7,-8]}><torusGeometry args={[1.8,.035,8,40]}/><meshStandardMaterial color={C.brass} emissive="#b58743" emissiveIntensity={1}/></mesh>
  <pointLight position={[0,5,-7]} color="#ffda9b" intensity={70} distance={17}/>
  <Box at={[5,1,-8]} size={[2,2,1]} color={C.green} solid/><Label at={[5,2.5,-7.4]} size={.19}>SINCE 1931</Label>
 </group>;
}
