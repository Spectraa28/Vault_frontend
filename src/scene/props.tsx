import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, MathUtils, MeshStandardMaterial, type PointLight } from 'three';
import { type Act, actStage, useGame } from '../store';
import { Box, C, Cylinder, Label } from './primitives';

type Vec = [number, number, number];
const STATE = { idle: '#6b5a33', working: '#ffc04d', held: '#ff9d2e', allowed: '#3fd17a', refused: '#ff3b2f' } as const;

/** The stage of whichever act uses this prop right now, or null when nobody is using it. */
function stageFor(who: Act['who'] | Act['who'][], tools: readonly string[], now: number): Act['stage'] | null {
  const act = useGame.getState().act;
  if (!act || !tools.includes(act.tool) || !(Array.isArray(who) ? who.includes(act.who) : act.who === who)) return null;
  return actStage(act, now);
}

/**
 * A lamp that shows what the bank's system said about an action: amber while it is being tried,
 * green when it goes through, red when it is refused. It reads the same decision the teller tape
 * prints; it never decides anything.
 */
export function StatusLight({ at, who, tools, size = 0.06 }: { at: Vec; who: Act['who'] | Act['who'][]; tools: readonly string[]; size?: number }) {
  const material = useMemo(() => new MeshStandardMaterial({ color: '#2a2418', emissive: new Color(STATE.idle), emissiveIntensity: 0.4 }), []);
  useFrame(({ clock }) => {
    const stage = stageFor(who, tools, Date.now());
    material.emissive.set(STATE[stage ?? 'idle']);
    material.emissiveIntensity = !stage ? 0.35 : stage === 'working' || stage === 'held' ? 1.6 + Math.sin(clock.elapsedTime * (stage === 'held' ? 3 : 11)) * 1.2 : stage === 'refused' ? 3.2 + Math.sin(clock.elapsedTime * 22) * 1.4 : 3;
  });
  return <mesh position={at}><sphereGeometry args={[size, 14, 12]}/><primitive object={material} attach="material"/></mesh>;
}

/** The brass key panel beside the bank doors. Gus works it; the lamp shows what came back. */
export function KeyPanel({ at }: { at: Vec }) {
  const lever = useRef<Group>(null);
  useFrame((_, dt) => { const stage = stageFor('door-guard', ['open_public_entrance'], Date.now()); if (lever.current) lever.current.rotation.x = MathUtils.damp(lever.current.rotation.x, stage === 'working' || stage === 'allowed' ? -1.1 : 0.5, 8, dt); });
  return <group position={at}>
    <Box size={[0.42, 0.62, 0.1]} color={C.brass} metal={0.75} rough={0.3}/>
    <Box at={[0, 0.02, 0.055]} size={[0.3, 0.42, 0.02]} color="#12211d"/>
    <group ref={lever} position={[0, -0.1, 0.07]}><Cylinder at={[0, 0.11, 0]} radius={0.018} height={0.24}/><mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.04, 10, 10]}/><meshStandardMaterial color="#8b1e16"/></mesh></group>
    <StatusLight at={[0, 0.2, 0.07]} who="door-guard" tools={['open_public_entrance']}/>
  </group>;
}

/**
 * The staff entrance beside the main doors. Its lamp burns red while the door is locked, flickers
 * amber while Gus tries it and flashes when the bank refuses. It goes green, and the door swings
 * open, only if the bank's own record says the door was opened.
 */
export function StaffDoor({ at }: { at: Vec }) {
  const leaf = useRef<Group>(null), glow = useRef<PointLight>(null);
  const lamp = useMemo(() => new MeshStandardMaterial({ color: '#2a1410', emissive: new Color(STATE.refused), emissiveIntensity: 1 }), []);
  const opened = useGame(s => s.slips.some(x => x.tool === 'open_staff_entrance' && x.executed));
  useFrame(({ clock }, dt) => {
    const stage = stageFor('door-guard', ['open_staff_entrance'], Date.now());
    const trying = stage === 'working' || stage === 'held';
    const colour = trying ? STATE.working : opened || stage === 'allowed' ? STATE.allowed : STATE.refused;
    const t = clock.elapsedTime;
    const k = stage === 'refused' ? 3.6 + Math.sin(t * 22) * 1.8 : trying ? 1.8 + Math.sin(t * 11) * 1.2 : 1.1 + Math.sin(t * 1.6) * 0.15;
    lamp.emissive.set(colour);
    lamp.emissiveIntensity = k;
    if (glow.current) { glow.current.color.set(colour); glow.current.intensity = k * 0.8; }
    if (leaf.current) leaf.current.rotation.y = MathUtils.damp(leaf.current.rotation.y, opened ? 1.25 : 0, 3, dt);
  });
  return <group position={at}>
    <Box at={[0, 2.06, 0.02]} size={[1.5, 3.8, 0.04]} color="#050d0b"/>
    {[-0.8, 0.8].map(x => <Box key={x} at={[x, 2.06, 0.06]} size={[0.1, 3.9, 0.12]} color={C.brass} metal={0.7}/>)}
    <Box at={[0, 4.05, 0.06]} size={[1.7, 0.14, 0.14]} color={C.brass} metal={0.7}/>
    <group ref={leaf} position={[0.72, 0, 0.05]}>
      <Box at={[-0.72, 2.06, 0]} size={[1.42, 3.76, 0.08]} color="#1d3a32" metal={0.3} rough={0.35}/>
      <Box at={[-0.72, 3.15, 0.05]} size={[0.62, 0.55, 0.02]} color="#0b1d19" metal={0.5} rough={0.15}/>
      {[-0.92, -0.72, -0.52].map(x => <Box key={x} at={[x, 3.15, 0.07]} size={[0.025, 0.55, 0.02]} color={C.brass}/>)}
      <Box at={[-0.72, 0.4, 0.05]} size={[1.3, 0.3, 0.02]} color={C.brass} metal={0.75}/>
      <Cylinder at={[-1.28, 2.0, 0.1]} radius={0.03} height={0.5} color={C.brass}/>
    </group>
    <Box at={[0, 4.36, 0.08]} size={[1.3, 0.34, 0.04]} color="#122a24"/>
    <Label at={[0, 4.36, 0.11]} size={0.15}>STAFF ONLY</Label>
    {/* The lock, at eye height beside the door: the lamp is the first thing anyone looks at. */}
    <group position={[-1.02, 2.3, 0.08]}>
      <Box size={[0.24, 0.46, 0.06]} color={C.brass} metal={0.75} rough={0.3}/>
      <Box at={[0, -0.1, 0.035]} size={[0.14, 0.16, 0.01]} color="#12211d"/>
      <mesh position={[0, 0.11, 0.06]}><sphereGeometry args={[0.065, 16, 12]}/><primitive object={lamp} attach="material"/></mesh>
    </group>
    <pointLight ref={glow} position={[-1.02, 2.4, 0.6]} distance={2.6} intensity={1}/>
  </group>;
}

/** The night register: an open ledger on Gus's desk, lit while he reads it. */
export function Register({ at }: { at: Vec }) {
  return <group position={at} rotation={[0, -0.5, 0]}>
    <Box at={[-0.16, 0, 0]} size={[0.3, 0.03, 0.4]} color="#e9dfc7" rotation={[0, 0, 0.08]}/><Box at={[0.16, 0, 0]} size={[0.3, 0.03, 0.4]} color="#e2d7bd" rotation={[0, 0, -0.08]}/>
    <Box at={[0, -0.012, 0]} size={[0.66, 0.02, 0.44]} color="#4a2f22"/>
    <StatusLight at={[0.42, 0.05, -0.12]} who="door-guard" tools={['check_visitor_list', 'issue_staff_badge']} size={0.04}/>
  </group>;
}

/** Wren's laptop, open on the counter. The screen faces her; the lid and its lamp face the customer. */
export function Terminal({ at }: { at: Vec }) {
  const screen = useMemo(() => new MeshStandardMaterial({ color: '#0d1f1b', emissive: new Color('#2f8f7a'), emissiveIntensity: 0.7 }), []);
  const glow = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const stage = stageFor('cashier', ['check_balance', 'wire_transfer', 'read_document'], Date.now());
    screen.emissive.set(stage === 'refused' ? '#ff3b2f' : stage === 'allowed' ? '#3fd17a' : '#3aa791');
    screen.emissiveIntensity = stage === 'working' ? 1.4 + Math.sin(clock.elapsedTime * 17) * 0.5 : stage ? 2.3 : 0.8;
    // The screen lights her face from below, and the colour changes with the answer that comes back.
    if (glow.current) { glow.current.color.copy(screen.emissive); glow.current.intensity = screen.emissiveIntensity * 1.6; }
  });
  return <group position={at}>
    <Box at={[0, 0.016, 0]} size={[0.56, 0.032, 0.38]} color="#3b4442" metal={0.55} rough={0.35}/>
    <Box at={[0, 0.034, -0.04]} size={[0.46, 0.006, 0.2]} color="#161c1b"/>
    <Box at={[0, 0.034, -0.155]} size={[0.16, 0.006, 0.07]} color="#2a3230"/>
    {/* The lid is hinged along the customer's edge and leans back toward them. */}
    <group position={[0, 0.032, 0.185]} rotation={[0.3, 0, 0]}>
      <Box at={[0, 0.185, 0]} size={[0.56, 0.37, 0.018]} color="#3b4442" metal={0.55} rough={0.35}/>
      <mesh position={[0, 0.185, -0.0105]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.5, 0.31]}/><primitive object={screen} attach="material"/></mesh>
      <mesh position={[0, 0.2, 0.0105]}><circleGeometry args={[0.045, 6]}/><meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3}/></mesh>
      <StatusLight at={[0, 0.39, 0]} who="cashier" tools={['check_balance', 'wire_transfer', 'read_document']} size={0.035}/>
    </group>
    <pointLight ref={glow} position={[0, 0.25, -0.3]} color="#3aa791" intensity={1.2} distance={1.8}/>
  </group>;
}

/** The cash drawer slides open while Wren counts, and a stack of notes lands on the counter only if the payout went through. */
export function CashPoint({ at }: { at: Vec }) {
  const drawer = useRef<Group>(null), cash = useRef<Group>(null), phone = useRef<Group>(null);
  useFrame((_, dt) => {
    const stage = stageFor('cashier', ['withdraw_cash'], Date.now());
    if (drawer.current) drawer.current.position.z = MathUtils.damp(drawer.current.position.z, stage === 'working' || stage === 'allowed' ? -0.42 : 0, 7, dt);
    if (cash.current) { const s = MathUtils.damp(cash.current.scale.x, stage === 'allowed' ? 1 : 0.001, 9, dt); cash.current.scale.setScalar(s); }
    if (phone.current) phone.current.rotation.z = MathUtils.damp(phone.current.rotation.z, stage === 'held' ? 0.9 : 0, 8, dt);
  });
  return <group position={at}>
    <group ref={drawer} position={[0, -0.32, -0.45]}><Box size={[0.7, 0.14, 0.5]} color="#3a2c1f"/><Box at={[0, 0.04, 0]} size={[0.6, 0.05, 0.4]} color="#5b7d58"/><Box at={[0, 0, -0.26]} size={[0.16, 0.04, 0.03]} color={C.brass} metal={0.7}/></group>
    <group ref={cash} position={[0.15, 0.03, 0.42]} scale={0.001}>{[0, 1, 2].map(i => <Box key={i} at={[i * 0.012, i * 0.022, -i * 0.01]} size={[0.3, 0.02, 0.15]} color={i % 2 ? '#7fae79' : '#93bd8c'}/>)}<Box at={[0.012, 0.035, 0]} size={[0.06, 0.024, 0.155]} color="#e9dfc7"/></group>
    <group position={[0.78, 0.03, -0.1]}><Box size={[0.24, 0.06, 0.2]} color="#191d1c"/><group ref={phone} position={[-0.08, 0.05, 0]}><Box at={[0.08, 0.02, 0]} size={[0.26, 0.05, 0.07]} color="#101413"/></group></group>
    <StatusLight at={[-0.5, 0.05, 0.4]} who="cashier" tools={['withdraw_cash']} size={0.045}/>
  </group>;
}

/** The alarm and gauge panel on the vault wall. The alarm lamp pulses for as long as it is armed, which is always. */
export function AlarmPanel({ at }: { at: Vec }) {
  const needle = useRef<Group>(null);
  const armed = useMemo(() => new MeshStandardMaterial({ color: '#3a0f0c', emissive: new Color('#ff3b2f'), emissiveIntensity: 1 }), []);
  useFrame(({ clock }, dt) => {
    const stage = stageFor(['vault-guard', 'junior-teller'], ['disable_alarm', 'check_vault_status'], Date.now());
    armed.emissiveIntensity = stage === 'refused' ? 4 + Math.sin(clock.elapsedTime * 24) * 2 : 1.1 + Math.sin(clock.elapsedTime * 2.2) * 0.7;
    if (needle.current) needle.current.rotation.x = MathUtils.damp(needle.current.rotation.x, stage === 'working' ? Math.sin(clock.elapsedTime * 6) * 0.5 : -0.6, 6, dt);
  });
  return <group position={at}>
    <Box size={[0.1, 0.95, 0.75]} color={C.brass} metal={0.7} rough={0.35}/>
    <mesh position={[-0.06, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.2, 0.2, 0.03, 24]}/><meshStandardMaterial color="#efe7d2"/></mesh>
    <group ref={needle} position={[-0.08, 0.2, 0]}><Box at={[0, 0.08, 0]} size={[0.012, 0.17, 0.016]} color="#8b1e16"/></group>
    <mesh position={[-0.07, -0.22, 0.18]}><sphereGeometry args={[0.07, 14, 12]}/><primitive object={armed} attach="material"/></mesh>
    <StatusLight at={[-0.07, -0.22, -0.18]} who={['vault-guard', 'junior-teller']} tools={['disable_alarm', 'check_vault_status']}/>
    <pointLight position={[-0.4, -0.22, 0.18]} color="#ff4a3a" intensity={2.5} distance={3}/>
  </group>;
}
