import { useRef } from 'react';
import type React from 'react';
import { sound } from '../../sound';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Group, MathUtils } from 'three';
import { useGame } from '../../store';
import { Box, C, Cylinder, Floor, Label, Lamp } from '../primitives';
import { KeyPanel, Register } from '../props';
export default function Gate() {
  const left = useRef<Group>(null), right = useRef<Group>(null), openAt = useRef(0);
  const unlocked = useGame(s => s.unlocked.includes('cashier'));
  const reduced = useGame(s => s.reduced);
  // Both leaves swing inward from their hinges. The motion is timed, not chased, so it eases in and
  // out at the same pace on every machine, and it waits for the camera when there is a shot of it.
  useFrame(() => {
    if (!unlocked) { openAt.current = 0; if (left.current) left.current.rotation.y = 0; if (right.current) right.current.rotation.y = 0; return; }
    if (!openAt.current) { const cine = useGame.getState().cine; openAt.current = cine ? cine.at + 900 : Date.now(); if (!reduced) setTimeout(() => sound('door'), Math.max(0, openAt.current - Date.now())); }
    const t = reduced ? 1 : MathUtils.clamp((Date.now() - openAt.current) / 2600, 0, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (left.current) left.current.rotation.y = eased * 1.78;
    if (right.current) right.current.rotation.y = -eased * 1.78;
  });
  return <group>
    <Floor at={[0,-.18,9]} size={[32,.35,20]} wet/>
    <Box at={[0,.08,2]} size={[16,.16,4]} color="#758078"/>
    <Box at={[-5.2,4.7,0]} size={[6.1,9.4,1]} color="#254239" solid/>
    <Box at={[5.2,4.7,0]} size={[6.1,9.4,1]} color="#254239" solid/>
    <Box at={[0,7.5,0]} size={[4.3,3.8,1]} color="#254239" solid/>
    <Box at={[0,9.35,.15]} size={[17,.3,1.5]} color={C.brass} metal={.5}/>
    <Box at={[0,9.65,0]} size={[16,.25,1.3]} color={C.stone}/>
    <Box at={[0,10,0]} size={[11,.5,1]} color={C.green}/>
    <Box at={[0,10.35,0]} size={[7,.2,1]} color={C.brass}/>
    <Label at={[0,8.1,.56]} size={.61}>FIRST MERIDIAN</Label>
    <Label at={[0,7.05,.57]} size={.23}>BANK & TRUST · EST. 1931</Label>
    <Label at={[0,6.1,.57]} size={.17}>YOUR SECRETS. OUR KEEPING.</Label>
    {[-7,-4.1,4.1,7].map(x=><group key={x} position={[x,0,.7]}>
      <Box at={[0,.3,0]} size={[.9,.6,1]} color={C.stone}/>
      <Box at={[0,4.4,0]} size={[.55,7.6,.55]} color="#829082"/>
      {[-.16,0,.16].map(v=><Box key={v} at={[v,4.4,.29]} size={[.035,7.3,.025]} color={C.brass} metal={.6}/>)}
      <Box at={[0,8.3,0]} size={[.9,.28,.8]} color={C.brass}/>
    </group>)}
    {[-5.55,5.55].map(x=><group key={x}>
      <Box at={[x,4.1,.53]} size={[2,4.6,.1]} color="#091d1a"/>
      {[-.9,.9].map(v=><Box key={v} at={[x+v,4.1,.6]} size={[.06,4.7,.06]} color={C.brass}/>)}
      {[2,4.1,6.3].map(y=><Box key={y} at={[x,y,.6]} size={[1.85,.06,.06]} color={C.brass}/>)}
      <Box at={[x,4.1,.6]} size={[.06,4.5,.06]} color={C.brass}/>
      <Lamp at={[x,2.8,1.1]}/>
    </group>)}
    {[-2.15,2.15].map(x=><Box key={x} at={[x,2.65,.2]} size={[.18,5.3,1]} color={C.brass} metal={.7}/>)}
    <Box at={[0,5.35,.2]} size={[4.45,.25,1]} color={C.brass}/>
    {[[-2, left, 1], [2, right, -1]].map(([hinge, ref, dir]) => <group key={hinge as number} ref={ref as React.RefObject<Group>} position={[hinge as number, 0, .05]}>
      <Box at={[(dir as number) * 1, 2.5, 0]} size={[1.98, 5, .1]} color="#183c34" metal={.3} rough={.2}/>
      {[.06, 1.93].map(x => <Box key={x} at={[(dir as number) * x, 2.5, .08]} size={[.08, 5, .08]} color={C.brass}/>)}
      {[1.1, 2.5, 3.9].map(y => <Box key={y} at={[(dir as number) * 1, y, .09]} size={[1.9, .07, .07]} color={C.brass}/>)}
      <Box at={[(dir as number) * 1, 3.2, .07]} size={[1.3, 1.1, .03]} color="#0c241f" metal={.5} rough={.15}/>
      <Cylinder at={[(dir as number) * 1.72, 2.3, .16]} radius={.035} height={.9} color={C.brass} metal={.85}/>
    </group>)}
    {!unlocked && <RigidBody type="fixed"><CuboidCollider args={[2.15,2.6,.4]} position={[0,2.6,0]}/></RigidBody>}
    <group position={[4.4,0,3.3]}><Box at={[0,.65,0]} size={[1.4,1.3,.9]} color={C.green} solid/><Lamp at={[0,1.32,0]}/><Label at={[0,.7,.46]} size={.14}>NIGHT WATCH</Label></group>
    <Register at={[4.25,1.345,3.3]}/>
    <KeyPanel at={[2.62,1.5,.78]}/>
    {[-10,10].map(x=><group key={x}><Cylinder at={[x,2.5,5]} radius={.065} height={5}/><mesh position={[x,5.1,5]}><sphereGeometry args={[.3,12,12]}/><meshStandardMaterial color="#ffdc9b" emissive="#ffbf60" emissiveIntensity={3}/></mesh><pointLight position={[x,4.9,5]} color="#ffbf80" intensity={24} distance={11}/></group>)}
    <Box at={[-12,4,-5]} size={[6,8,9]} color="#1a292d"/><Box at={[12,5,-5]} size={[6,10,9]} color="#1a292d"/>
    <Label at={[8.3,6,1]} size={.3} color="#bde5d2">OPEN LATE</Label>
  </group>;
}
