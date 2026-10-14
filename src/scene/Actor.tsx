import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, MathUtils, Vector3 } from 'three';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import { CAST, type Character, type Mood } from '../contract';
import { type Act, actStage, useGame } from '../store';
import { C } from './primitives';
import { footfall, key as keyTap } from '../sound';

import { playerMotion, playerPosition } from './shared';

type Vec = [number, number, number];
const damp = MathUtils.damp;

/* ------------------------------------------------------------------ looks */

/** What makes each figure recognisable at a glance: build, clothes, hair, and what they carry. */
export interface Look {
  coat: string;
  shirt: string;
  trim: string;
  skin: string;
  hair: string;
  trousers: string;
  /** Width and height relative to an average figure. */
  build: [number, number];
  /** Forward lean of the upper body, in radians. Age and attitude live here. */
  stoop: number;
  hat?: 'fedora' | 'peaked';
  hairStyle: 'short' | 'bun' | 'balding' | 'cowlick' | 'wave';
  moustache?: string;
  glasses?: 'round' | 'half';
  /** Whose habits they have: the fidgets, the way they gesture, how they wait. */
  manner: 'gus' | 'wren' | 'marlowe' | 'pip' | 'visitor';
  wears: readonly ('epaulettes' | 'buttons' | 'waistcoat' | 'cardigan' | 'keys' | 'watch' | 'pencil' | 'badge' | 'scarf' | 'tie' | 'belt')[];
}

export const LOOKS = {
  // Gus: broad, upright, uniformed. Twenty years of standing at a door.
  'door-guard': { coat: '#2c4439', shirt: '#d8ceb4', trim: C.brass, skin: '#b88c66', hair: '#8d918c', trousers: '#1b2523', build: [1.2, 1.02], stoop: -0.03, hat: 'peaked', hairStyle: 'short', moustache: '#9a9d97', manner: 'gus', wears: ['epaulettes', 'buttons', 'keys', 'badge', 'belt'] },
  // Wren: slight, quick, sleeves rolled. A pencil she has forgotten is in her hair.
  cashier: { coat: '#e6dcc4', shirt: '#e6dcc4', trim: '#2d5c4a', skin: '#dcb490', hair: '#5b3423', trousers: '#22302c', build: [0.86, 0.94], stoop: 0.04, hairStyle: 'bun', glasses: 'round', manner: 'wren', wears: ['waistcoat', 'pencil', 'badge', 'tie'] },
  // Marlowe: stooped, soft, cardigan over the uniform shirt. Half-moon spectacles and a watch chain.
  'vault-guard': { coat: '#6a533d', shirt: '#cfc6ad', trim: '#3c2f22', skin: '#c79f82', hair: '#e4e0d4', trousers: '#2a2a26', build: [1.02, 0.95], stoop: 0.2, hairStyle: 'balding', moustache: '#ebe7dc', glasses: 'half', manner: 'marlowe', wears: ['cardigan', 'watch', 'tie'] },
  // Pip: all elbows, in a jacket bought for him to grow into.
  'junior-teller': { coat: '#7c7453', shirt: '#e2d9c0', trim: '#4f4a34', skin: '#d8ae8a', hair: '#b4702c', trousers: '#262b28', build: [0.8, 1.05], stoop: 0.06, hairStyle: 'cowlick', manner: 'pip', wears: ['tie', 'badge'] },
  'player-0': { coat: '#2b4a41', shirt: '#d9d0b8', trim: C.brass, skin: '#c6a37c', hair: '#2e2922', trousers: '#1c2422', build: [1, 1], stoop: 0, hat: 'fedora', hairStyle: 'short', manner: 'visitor', wears: ['belt', 'scarf'] },
  'player-1': { coat: '#7a5a44', shirt: '#e1d6bd', trim: '#d9b36a', skin: '#a8795c', hair: '#3a2418', trousers: '#231d1a', build: [0.92, 0.98], stoop: 0, hat: 'fedora', hairStyle: 'wave', manner: 'visitor', wears: ['belt', 'scarf'] },
} as const satisfies Record<string, Look>;

/* ------------------------------------------------------------------ poses */

/** `across` turns the forearm in toward the body's midline, which is what lets arms fold, clasp and rest on hips. */
interface Arm { swing: number; out: number; bend: number; across: number }
interface Pose {
  lean: number; twist: number; bob: number;
  /** Weight on one hip (sideways shift), shoulders lifted, and where the eyes point. */
  sway: number; shrug: number; eyeX: number; eyeY: number;
  headYaw: number; headPitch: number; headRoll: number;
  left: Arm; right: Arm;
  /** Inner brow height: negative is a scowl, positive is surprise. */
  brow: number;
  /** Mouth curve: negative frowns, positive smiles. */
  smile: number;
  jaw: number;
}
const arm = (swing: number, out: number, bend: number, across = 0): Arm => ({ swing, out, bend, across });
const REST: Pose = { lean: 0, twist: 0, bob: 0, sway: 0, shrug: 0, eyeX: 0, eyeY: 0, headYaw: 0, headPitch: 0, headRoll: 0, left: arm(0.04, 0.07, -0.15), right: arm(0.04, 0.07, -0.15), brow: 0, smile: 0, jaw: 0 };

/** How a character holds themselves in each mood. This is the part a player reads before any text. */
function moodPose(mood: Mood, t: number): Partial<Pose> {
  switch (mood) {
    case 'wary': return { left: arm(-0.32, 0.06, -1.35, 1.22), right: arm(-0.3, 0.06, -1.5, 1.12), headPitch: -0.04, brow: -0.22, smile: -0.25, lean: -0.03 };
    case 'curious': return { right: arm(-0.75, 0, -2.25, 0.42), left: arm(-0.3, 0.05, -1.35, 1.2), headRoll: 0.17, headPitch: 0.05, brow: 0.2, smile: 0.1 };
    case 'warming': return { left: arm(-0.12, 0.2, -0.45), right: arm(-0.35 + Math.sin(t * 2.2) * 0.06, 0.24, -0.7), lean: 0.07, brow: 0.12, smile: 0.5, headPitch: 0.03 };
    case 'convinced': return { left: arm(-0.1, 0.16, -0.35), right: arm(-0.1, 0.16, -0.35), lean: 0.09, brow: 0.2, smile: 0.9, headPitch: Math.sin(t * 5.5) * 0.11 };
    case 'annoyed': return { left: arm(0.12, 0.78, -0.45, 1.4), right: arm(0.12, 0.78, -0.45, 1.4), twist: 0.32, headYaw: -0.38, headPitch: -0.07, brow: -0.42, smile: -0.7, lean: -0.05 };
    case 'flustered': return { left: arm(-2.25 + Math.sin(t * 9) * 0.1, 0.3, -1.05), right: arm(-2.2 + Math.sin(t * 9 + 1.3) * 0.1, 0.3, -1.1), headRoll: Math.sin(t * 5) * 0.08, brow: 0.45, smile: -0.2, jaw: 0.35, bob: Math.sin(t * 9) * 0.012 };
  }
}

type Manner = Look['manner'];

/** Nobody stands perfectly still. This is what each person does with a quiet moment: slow, continuous, never repeating exactly. */
function idlePose(manner: Manner, t: number, seed: number): Partial<Pose> {
  const slow = Math.sin(t * 0.42 + seed), drift = Math.sin(t * 0.27 + seed * 2.3), quick = Math.sin(t * 1.9 + seed);
  switch (manner) {
    // Gus rocks on his heels and scans the street, hands clasped behind him.
    case 'gus': return { sway: slow * 0.035, bob: Math.max(0, Math.sin(t * 0.9 + seed)) * 0.018, lean: -0.03 + drift * 0.015, headYaw: drift * 0.45, eyeX: drift * 0.8, left: arm(0.42, 0.1, 0.12, 0.95), right: arm(0.42, 0.1, 0.12, 0.95) };
    // Wren cannot keep still: bouncing on her toes, glancing about, fingers going.
    case 'wren': return { sway: slow * 0.05, bob: Math.abs(Math.sin(t * 2.3 + seed)) * 0.012, headYaw: Math.sin(t * 0.8 + seed) * 0.3, headRoll: quick * 0.04, eyeX: Math.sin(t * 1.3) * 0.9, left: arm(-0.35, 0.05, -1.3 + quick * 0.1, 0.75), right: arm(-0.38, 0.05, -1.25 - quick * 0.1, 0.75) };
    // Marlowe sways like a man half asleep, thumbs hooked in his cardigan, eyes on the vault.
    case 'marlowe': return { sway: Math.sin(t * 0.3 + seed) * 0.06, lean: 0.03 + slow * 0.02, headPitch: 0.08 + Math.sin(t * 0.23) * 0.07, headYaw: drift * 0.25, eyeY: -0.3, left: arm(-0.12, 0.1, -1.05, 0.85), right: arm(-0.12, 0.1, -1.05, 0.85) };
    // Pip shifts from foot to foot and looks everywhere at once.
    case 'pip': return { sway: Math.sin(t * 1.1 + seed) * 0.07, bob: Math.abs(Math.sin(t * 1.1 + seed)) * 0.015, headYaw: Math.sin(t * 1.4 + seed) * 0.5, eyeX: Math.sin(t * 2.1) * 1, shrug: 0.02 + quick * 0.01, left: arm(0.05, 0.1, -0.2 + quick * 0.08), right: arm(-0.3, -0.1, -1.6) };
    case 'visitor': return { sway: slow * 0.04, headYaw: drift * 0.2, left: arm(0.05, 0.08, -0.2), right: arm(0.05, 0.08, -0.2) };
  }
}

/** A fidget is a short habit that plays over the idle pose and fades back out. `u` runs 0 to 1. */
type Fidget = { seconds: number; pose: (u: number, t: number) => Partial<Pose> };
const up = (u: number) => Math.sin(Math.min(1, u * 3) * Math.PI / 2) * Math.sin(Math.min(1, (1 - u) * 3) * Math.PI / 2);
const FIDGETS: Record<Manner, Fidget[]> = {
  gus: [
    { seconds: 2.6, pose: u => ({ left: arm(-1.25 * up(u), -0.35 * up(u), -1.9 * up(u)), headPitch: 0.4 * up(u), headYaw: 0.25 * up(u), eyeY: -0.8 * up(u), brow: -0.15 }) },          // checks his watch
    { seconds: 1.9, pose: u => ({ right: arm(-2.5 * up(u), 0.15, -1.25 * up(u)), headPitch: 0.1 * up(u) }) },                                                                          // squares his cap
    { seconds: 2.2, pose: (u, t) => ({ bob: Math.sin(t * 6) * 0.02 * up(u), shrug: 0.05 * up(u), lean: -0.08 * up(u), left: arm(0.5, 0.1, 0.12, 0.95), right: arm(0.5, 0.1, 0.12, 0.95) }) },       // rolls his shoulders
    { seconds: 2.4, pose: u => ({ headYaw: -0.9 * up(u), twist: -0.25 * up(u), eyeX: -1 * up(u), brow: -0.25 * up(u) }) },                                                             // a noise down the street
  ],
  wren: [
    { seconds: 1.5, pose: u => ({ right: arm(-2.1 * up(u), -0.25 * up(u), -2.0 * up(u)), headPitch: -0.08 * up(u), brow: 0.2 * up(u) }) },                                             // pushes her glasses up
    { seconds: 2.3, pose: (u, t) => ({ left: arm(-0.9, 0, -1.3 + Math.sin(t * 16) * 0.2 * up(u)), right: arm(-0.9, 0, -1.3 - Math.sin(t * 16) * 0.2 * up(u)), headPitch: 0.4 * up(u), eyeY: -0.9 * up(u) }) }, // squares a stack of forms
    { seconds: 1.7, pose: u => ({ left: arm(-2.4 * up(u), 0.2, -1.6 * up(u)), headRoll: -0.15 * up(u) }) },                                                                            // feels for the pencil in her hair
    { seconds: 1.4, pose: (u, t) => ({ bob: Math.abs(Math.sin(t * 9)) * 0.03 * up(u), shrug: 0.06 * up(u), smile: 0.4 * up(u) }) },                                                    // a nervous little bounce
  ],
  marlowe: [
    { seconds: 2.8, pose: u => ({ right: arm(-1.9 * up(u), -0.3 * up(u), -2.2 * up(u)), headPitch: 0.06 * up(u), smile: 0.2 }) },                                                      // strokes his moustache
    { seconds: 3.4, pose: u => ({ right: arm(-2.05 * up(u), -0.15, -2.1 * up(u)), headPitch: -0.3 * up(u), jaw: 0.3 * up(u), eyeY: 0.5 * up(u) }) },                                    // a sip from the thermos
    { seconds: 4.2, pose: u => ({ headPitch: 0.55 * Math.sin(Math.min(1, u * 1.4) * Math.PI / 2) * (u > 0.82 ? 0 : 1), lean: 0.1 * up(u), brow: u > 0.82 ? 0.5 : -0.1, bob: u > 0.82 ? 0.03 : 0 }) }, // nods off, starts awake
    { seconds: 2.6, pose: u => ({ left: arm(-0.9 * up(u), -0.4 * up(u), -1.9 * up(u)), headPitch: 0.42 * up(u), eyeY: -0.8 * up(u) }) },                                               // consults the pocket watch
  ],
  pip: [
    { seconds: 1.8, pose: (u, t) => ({ right: arm(-2.6 * up(u), 0.1, -1.5 * up(u) + Math.sin(t * 14) * 0.12 * up(u)), headRoll: 0.18 * up(u) }) },                                     // scratches his head
    { seconds: 1.6, pose: u => ({ left: arm(-1.3 * up(u), -0.35 * up(u), -2.1 * up(u)), right: arm(-1.3 * up(u), -0.35 * up(u), -2.1 * up(u)), headPitch: 0.35 * up(u) }) },            // straightens his tie
    { seconds: 2, pose: u => ({ headYaw: 1 * Math.sin(u * Math.PI * 2), eyeX: Math.sin(u * Math.PI * 2), shrug: 0.05 * up(u), brow: 0.3 * up(u) }) },                                   // was that someone calling him?
  ],
  visitor: [
    { seconds: 1.8, pose: u => ({ right: arm(-2.45 * up(u), 0.1, -1.3 * up(u)), headPitch: 0.12 * up(u) }) },                                                                          // tips the hat brim
    { seconds: 2.2, pose: u => ({ headYaw: 0.7 * Math.sin(u * Math.PI * 2), sway: 0.05 * up(u) }) },                                                                                   // looks the place over
  ],
};

/** Everyone talks with their hands differently. */
function speakPose(manner: Manner, t: number, base: Pose): Partial<Pose> {
  const jaw = 0.22 + Math.abs(Math.sin(t * 11.5)) * 0.45 * (0.6 + 0.4 * Math.sin(t * 2.3));
  switch (manner) {
    case 'gus': return { jaw, right: arm(-0.75 + Math.max(0, Math.sin(t * 5.2)) * 0.5, 0.05, -1.25), left: arm(0.42, 0.1, 0.12, 0.95), headPitch: base.headPitch + Math.max(0, Math.sin(t * 5.2)) * 0.07, brow: base.brow - 0.05 };
    case 'wren': return { jaw, left: arm(-0.95 + Math.sin(t * 7.3) * 0.25, 0.25 + Math.sin(t * 5) * 0.12, -1.3), right: arm(-0.95 + Math.sin(t * 7.3 + 2) * 0.25, 0.25 + Math.cos(t * 5) * 0.12, -1.3), headRoll: Math.sin(t * 3.4) * 0.09, bob: Math.abs(Math.sin(t * 4)) * 0.012, shrug: 0.03 };
    case 'marlowe': return { jaw: jaw * 0.8, right: arm(-0.7 + Math.sin(t * 1.8) * 0.2, 0.3 + Math.sin(t * 1.3) * 0.15, -0.9), left: arm(-0.12, 0.1, -1.05, 0.85), headRoll: Math.sin(t * 1.5) * 0.07, headPitch: base.headPitch + Math.sin(t * 2.1) * 0.05, sway: Math.sin(t * 0.8) * 0.04 };
    case 'pip': return { jaw, left: arm(-1.4 + Math.sin(t * 9) * 0.2, 0.3, -1.2), right: arm(-1.4 + Math.sin(t * 9 + 1.6) * 0.2, 0.3, -1.2), shrug: 0.06, brow: 0.3 };
    case 'visitor': return { jaw };
  }
}

/** Weighing what they just heard, while the reply is on its way. */
function thinkPose(manner: Manner, t: number): Partial<Pose> {
  switch (manner) {
    case 'gus': return { right: arm(-0.75, 0, -2.25, 0.42), left: arm(-0.3, 0.05, -1.35, 1.2), headRoll: -0.08, headPitch: -0.03, brow: -0.3 + Math.sin(t * 1.1) * 0.05, eyeX: Math.sin(t * 0.7) * 0.5, smile: -0.2 };
    case 'wren': return { left: arm(-0.9, 0.05, -1.4 + Math.sin(t * 13) * 0.08), right: arm(-1.9, -0.3, -2.2), headRoll: 0.12, eyeY: 0.6, eyeX: Math.sin(t * 2.2) * 0.7, brow: 0.25, smile: -0.1, bob: Math.abs(Math.sin(t * 5)) * 0.008 };
    case 'marlowe': return { right: arm(-0.75, 0, -2.25, 0.42), left: arm(-0.12, 0.1, -1.05, 0.85), headPitch: -0.16, eyeY: 0.8, headRoll: 0.1, sway: Math.sin(t * 0.6) * 0.05, smile: 0.15 };
    default: return { headRoll: 0.1, eyeY: 0.5 };
  }
}

type ActKind = 'inspect' | 'operate' | 'cash' | 'type' | 'wheel' | 'call';
const KIND: Record<string, ActKind> = {
  check_visitor_list: 'inspect', check_balance: 'inspect', read_document: 'inspect', check_vault_status: 'inspect',
  open_public_entrance: 'operate', open_staff_entrance: 'operate', issue_staff_badge: 'operate', disable_alarm: 'operate',
  withdraw_cash: 'cash', wire_transfer: 'type', open_vault: 'wheel', ask_junior_teller: 'call',
};

/** What a character physically does for a tool call, and how they take the decision. */
function actPose(kind: ActKind, stage: Act['stage'], t: number, since: number): Partial<Pose> {
  // The moment a refusal lands: hands come off whatever they were doing, and the head shakes.
  if (stage === 'refused') {
    const snap = Math.max(0, 1 - since / 500);
    const shake = since < 1500 ? Math.sin(since / 70) * 0.28 * (1 - since / 1500) : 0;
    const shrug = kind === 'wheel' || kind === 'operate';
    return { left: arm(shrug ? -0.5 : -1.9, shrug ? 0.6 : 0.35, shrug ? -1.5 : -1.0), right: arm(shrug ? -0.5 : -1.9, shrug ? 0.6 : 0.35, shrug ? -1.5 : -1.0), headYaw: shake, lean: -0.12 * snap - 0.03, brow: shrug ? -0.3 : 0.4, smile: -0.6, jaw: 0.2 * snap };
  }
  if (stage === 'allowed' && kind !== 'cash') return { left: arm(-0.1, 0.14, -0.3), right: arm(-0.35, 0.2, -0.8), headPitch: Math.sin(since / 130) * 0.1 * Math.max(0, 1 - since / 1400), smile: 0.6, brow: 0.15 };
  switch (kind) {
    case 'inspect': return { left: arm(-0.95, -0.12, -1.6), right: arm(-1.15, -0.05, -1.05 + Math.sin(t * 13) * 0.14), headPitch: 0.42, lean: 0.14, brow: -0.1 };
    case 'type': return { left: arm(-1.05, -0.08, -1.2 + Math.sin(t * 19) * 0.16), right: arm(-1.05, -0.08, -1.2 + Math.sin(t * 19 + 1.9) * 0.16), headPitch: 0.36, lean: 0.16, brow: 0.05 };
    case 'operate': return { left: arm(0.05, 0.1, -0.3), right: arm(-1.5 + Math.sin(t * 4) * 0.05, 0.05, -0.25 + Math.sin(t * 7) * 0.1), headPitch: 0.1, lean: 0.08, brow: -0.12 };
    case 'cash':
      if (stage === 'held') return { right: arm(-1.25, 0.34, -2.45), left: arm(-0.5, -0.3, -1.5), headRoll: 0.2, headPitch: 0.05, brow: 0.25, smile: -0.15 };
      if (stage === 'allowed') return { left: arm(-1.4, 0.05, -0.3), right: arm(-1.4, 0.05, -0.3), lean: 0.2, smile: 0.7, brow: 0.2 };
      return { left: arm(-0.95 + Math.sin(t * 8) * 0.22, 0.05, -1.3), right: arm(-0.95 - Math.sin(t * 8) * 0.22, 0.05, -1.3), headPitch: 0.38, lean: 0.12 };
    case 'wheel': { const heave = Math.sin(t * 3.2); return { left: arm(-2.35 + heave * 0.2, 0.2, -0.5), right: arm(-2.35 - heave * 0.2, 0.2, -0.5), lean: 0.16 + heave * 0.05, twist: heave * 0.14, headPitch: -0.3, brow: -0.3, smile: -0.3, jaw: 0.15 }; }
    case 'call': return { right: arm(-2.7 + Math.sin(t * 7) * 0.22, 0.25, -0.5), left: arm(-0.3, 0.3, -1.4), headYaw: 0.5, jaw: 0.45, brow: 0.3, smile: 0.2 };
  }
}

/* ------------------------------------------------------------------ figure */

export interface FigureState { mood?: Mood; speaking?: boolean; thinking?: boolean; /** Engaged with the player, so mood shows; otherwise they are just passing the time. */ engaged?: boolean; act?: { tool: string; stage: Act['stage']; since: number } | null; walking?: number; lookYaw?: number; lookPitch?: number }

function Part({ at, size, color, rot, metal = 0, rough = 0.85, shape = 'box' }: { at?: Vec; size: Vec; color: string; rot?: Vec; metal?: number; rough?: number; shape?: 'box' | 'ball' | 'tube' }) {
  return <mesh position={at} rotation={rot} castShadow>
    {shape === 'box' ? <boxGeometry args={size}/> : shape === 'ball' ? <sphereGeometry args={[size[0], 14, 12]}/> : <cylinderGeometry args={[size[0], size[1], size[2], 14]}/>}
    <meshStandardMaterial color={color} metalness={metal} roughness={rough}/>
  </mesh>;
}

/** A jointed figure. `live` is read every frame, so callers update it without re-rendering. */
export function Figure({ look, live, player = false }: { look: Look; live?: RefObject<FigureState>; player?: boolean }) {
  const reduced = useGame(s => s.reduced);
  const body = useRef<Group>(null), torso = useRef<Group>(null), head = useRef<Group>(null);
  const lArm = useRef<Group>(null), rArm = useRef<Group>(null), lFore = useRef<Group>(null), rFore = useRef<Group>(null);
  const lLeg = useRef<Group>(null), rLeg = useRef<Group>(null);
  const lBrow = useRef<Group>(null), rBrow = useRef<Group>(null), mouth = useRef<Group>(null), lEye = useRef<Group>(null), rEye = useRef<Group>(null);
  const pose = useRef<Pose>(structuredClone(REST));
  const blink = useRef({ next: 1.5 + Math.random() * 3, until: 0 });
  const habit = useRef({ seed: Math.random() * 20, next: 3 + Math.random() * 5, index: 0, from: 0, lastMood: '' as string, popAt: -9 });
  const [w, h] = look.build;

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, s = live?.current ?? {};
    const speed = player ? playerMotion.speed : (s.walking ?? 0);
    const stride = Math.min(speed / 2.6, 1), gait = Math.sin(t * (speed > 4.6 ? 14 : 10.5)) * stride;

    // Layer the target pose. Underneath everything is the idle life of the character; a mood sits on
    // top when they are dealing with the player; then speech or thought; then whatever their hands are doing.
    const h = habit.current, busyHands = !!s.act || stride > 0.05;
    const target: Pose = { ...REST, ...idlePose(look.manner, t, h.seed) };
    if (s.engaged && s.mood && !player) Object.assign(target, moodPose(s.mood, t));
    // A habit surfaces every few seconds when nothing else is going on.
    if (!busyHands && !s.speaking && !s.thinking && !reduced) {
      const list = FIDGETS[look.manner];
      if (t > h.next) { h.index = Math.floor(Math.random() * list.length); h.from = t; h.next = t + list[h.index].seconds + (s.engaged ? 7 : 4) + Math.random() * 6; }
      const clip = list[h.index], u = (t - h.from) / clip.seconds;
      if (u >= 0 && u <= 1) Object.assign(target, clip.pose(u, t));
    } else h.next = Math.max(h.next, t + 2.5);
    if (s.act) Object.assign(target, actPose(KIND[s.act.tool] ?? 'inspect', s.act.stage, t, s.act.since));
    else if (s.speaking) Object.assign(target, speakPose(look.manner, t, target));
    else if (s.thinking) Object.assign(target, thinkPose(look.manner, t));
    if (stride > 0.05) { target.left = arm(gait * 0.75, 0.08, -0.25 - stride * 0.35); target.right = arm(-gait * 0.75, 0.08, -0.25 - stride * 0.35); target.lean = 0.07 * stride; target.twist = gait * 0.12; target.sway = Math.sin(t * (speed > 4.6 ? 14 : 10.5) + Math.PI / 2) * 0.02 * stride; }
    // A change of mood lands with a small start: the body registers it before the pose settles.
    if (s.mood && s.mood !== h.lastMood) { if (h.lastMood && s.engaged) h.popAt = t; h.lastMood = s.mood; }
    const pop = Math.max(0, 1 - (t - h.popAt) / 0.45);
    if (pop > 0) { target.bob += Math.sin(pop * Math.PI) * 0.035; target.brow += 0.35 * pop; target.shrug += 0.05 * pop; }
    target.headYaw += MathUtils.clamp(s.lookYaw ?? 0, -1.1, 1.1); target.headPitch += MathUtils.clamp(s.lookPitch ?? 0, -0.4, 0.5);

    // Ease every joint toward its target. Refusals snap faster than moods settle.
    const k = reduced ? 60 : s.act?.stage === 'refused' && s.act.since < 400 ? 16 : 7, p = pose.current;
    for (const key of ['lean', 'twist', 'bob', 'sway', 'shrug', 'headYaw', 'headPitch', 'headRoll', 'brow', 'smile'] as const) p[key] = damp(p[key], target[key], k, dt);
    p.eyeX = damp(p.eyeX, target.eyeX, 18, dt); p.eyeY = damp(p.eyeY, target.eyeY, 18, dt);
    p.jaw = damp(p.jaw, target.jaw, 22, dt);
    for (const side of ['left', 'right'] as const) for (const key of ['swing', 'out', 'bend', 'across'] as const) p[side][key] = damp(p[side][key], target[side][key], k, dt);

    const breath = reduced ? 0 : Math.sin(t * 1.7 + w * 3) * 0.012;
    if (body.current) { body.current.position.set(p.sway, p.bob + Math.abs(gait) * 0.045, 0); body.current.rotation.set(0, p.twist, -p.sway * 0.9); }
    if (torso.current) { torso.current.rotation.set(look.stoop + p.lean, 0, p.sway * 1.6); torso.current.scale.set(1 + breath * 0.8, 1 + breath, 1 + breath * 1.4); }
    if (head.current) head.current.rotation.set(p.headPitch - look.stoop * 0.6, p.headYaw, p.headRoll);
    const lift = 0.62 + p.shrug + breath * 1.5;
    if (lArm.current) { lArm.current.rotation.set(p.left.swing, 0, -p.left.out); lArm.current.position.y = lift; } if (rArm.current) { rArm.current.rotation.set(p.right.swing, 0, p.right.out); rArm.current.position.y = lift; }
    if (lFore.current) lFore.current.rotation.set(p.left.bend, 0, p.left.across); if (rFore.current) rFore.current.rotation.set(p.right.bend, 0, -p.right.across);
    // Legs lean against the hip shift, so the feet stay planted while the weight moves.
    if (lLeg.current) lLeg.current.rotation.set(-gait * 0.65, 0, p.sway * 0.9); if (rLeg.current) rLeg.current.rotation.set(gait * 0.65, 0, p.sway * 0.9);
    if (lBrow.current) { lBrow.current.rotation.z = -p.brow * 0.9; lBrow.current.position.y = 0.075 + Math.max(p.brow, 0) * 0.03; }
    if (rBrow.current) { rBrow.current.rotation.z = p.brow * 0.9; rBrow.current.position.y = 0.075 + Math.max(p.brow, 0) * 0.03; }
    if (mouth.current) { mouth.current.scale.set(1 + Math.abs(p.smile) * 0.25, 1 + p.jaw * 4.5, 1); mouth.current.position.y = -0.105 + p.smile * 0.012; mouth.current.children.forEach((c, i) => { if (i > 0) c.position.y = p.smile * 0.02; }); }
    if (t > blink.current.next) { blink.current.until = t + 0.12; blink.current.next = t + 2 + Math.random() * 4; }
    const lid = t < blink.current.until ? 0.12 : 1 + Math.max(p.brow, 0) * 0.25;
    if (lEye.current) lEye.current.scale.y = lid; if (rEye.current) rEye.current.scale.y = lid;
    // Eyes move ahead of the head: pupils slide toward whatever has their attention.
    for (const eye of [lEye.current, rEye.current]) { const pupil = eye?.children[1]; if (pupil) { pupil.position.x = MathUtils.clamp(p.eyeX + (s.lookYaw ?? 0) * 0.6, -1, 1) * 0.013; pupil.position.y = MathUtils.clamp(p.eyeY, -1, 1) * 0.009; } }
  });

  const has = (item: Look['wears'][number]) => (look.wears as readonly string[]).includes(item);
  const sleeve = has('waistcoat') ? look.shirt : look.coat;

  return <group scale={[w, h, w]}>
    <group ref={body}>
      {[[-0.13, lLeg], [0.13, rLeg]].map(([x, ref]) => <group key={x as number} ref={ref as RefObject<Group>} position={[x as number, 0.86, 0]}>
        <Part at={[0, -0.4, 0]} size={[0.105, 0.09, 0.8]} color={look.trousers} shape="tube"/>
        <Part at={[0, -0.82, 0.06]} size={[0.2, 0.09, 0.34]} color="#101816"/>
      </group>)}
      <group ref={torso} position={[0, 0.86, 0]}>
        <Part at={[0, 0.31, 0]} size={[0.29, 0.25, 0.62]} color={look.coat} shape="tube"/>
        <Part at={[0, 0.63, 0]} size={[0.31, 0.3, 0.06]} color={look.coat} shape="tube"/>
        {/* coat skirt, which is what makes a trench coat or a uniform read as one */}
        {!has('waistcoat') && !has('cardigan') && <Part at={[0, -0.08, 0]} size={[0.25, 0.3, 0.26]} color={look.coat} shape="tube"/>}
        <Part at={[0, 0.5, 0.265]} size={[0.13, 0.28, 0.03]} color={look.shirt}/>
        {has('tie') && <Part at={[0, 0.45, 0.285]} size={[0.045, 0.3, 0.02]} color={look.trim}/>}
        {has('waistcoat') && <><Part at={[-0.14, 0.33, 0.16]} size={[0.17, 0.5, 0.26]} color={look.trim}/><Part at={[0.14, 0.33, 0.16]} size={[0.17, 0.5, 0.26]} color={look.trim}/></>}
        {has('cardigan') && <><Part at={[-0.17, 0.3, 0.2]} size={[0.11, 0.56, 0.14]} color={look.trim}/><Part at={[0.17, 0.3, 0.2]} size={[0.11, 0.56, 0.14]} color={look.trim}/></>}
        {has('buttons') && [0.52, 0.38, 0.24, 0.1].map(y => <Part key={y} at={[0.085, y, 0.29]} size={[0.022, 0, 0]} color={look.trim} metal={0.7} rough={0.3} shape="ball"/>)}
        {has('belt') && <><Part at={[0, 0.06, 0]} size={[0.285, 0.285, 0.07]} color="#191512" shape="tube"/><Part at={[0, 0.06, 0.28]} size={[0.07, 0.06, 0.02]} color={look.trim} metal={0.7} rough={0.3}/></>}
        {has('epaulettes') && [-0.3, 0.3].map(x => <Part key={x} at={[x, 0.66, 0]} size={[0.16, 0.035, 0.14]} color={look.trim} metal={0.6} rough={0.35}/>)}
        {has('badge') && <Part at={[0.16, 0.48, 0.275]} size={[0.07, 0.085, 0.02]} color={C.brass} metal={0.7} rough={0.3}/>}
        {has('scarf') && <Part at={[0, 0.68, 0.06]} size={[0.17, 0.19, 0.12]} color={look.trim} shape="tube"/>}
        {has('keys') && <><Part at={[-0.27, 0.02, 0.1]} size={[0.045, 0.045, 0.012]} color={C.brass} metal={0.8} rough={0.3} shape="tube" rot={[Math.PI / 2, 0, 0]}/><Part at={[-0.27, -0.07, 0.1]} size={[0.02, 0.11, 0.012]} color={C.brass} metal={0.8} rough={0.3}/></>}
        {has('watch') && <Part at={[0.03, 0.2, 0.275]} size={[0.2, 0.012, 0.012]} color={C.brass} metal={0.8} rough={0.3} rot={[0, 0, -0.3]}/>}

        {[[-1, lArm, lFore], [1, rArm, rFore]].map(([side, upper, fore]) => <group key={side as number} ref={upper as RefObject<Group>} position={[(side as number) * 0.36, 0.62, 0]}>
          <Part at={[0, -0.16, 0]} size={[0.085, 0.078, 0.34]} color={sleeve} shape="tube"/>
          <group ref={fore as RefObject<Group>} position={[0, -0.32, 0]}>
            <Part at={[0, -0.14, 0]} size={[0.075, 0.066, 0.3]} color={sleeve} shape="tube"/>
            <Part at={[0, -0.33, 0]} size={[0.075, 0, 0]} color={look.skin} shape="ball"/>
          </group>
        </group>)}

        <group ref={head} position={[0, 0.9, 0.01]}>
          <Part at={[0, -0.13, 0]} size={[0.075, 0.085, 0.12]} color={look.skin} shape="tube"/>
          <Part size={[0.2, 0, 0]} color={look.skin} shape="ball"/>
          <Part at={[0, -0.035, 0.19]} size={[0.03, 0, 0]} color={look.skin} shape="ball"/>
          {[[-0.075, lEye], [0.075, rEye]].map(([x, ref]) => <group key={x as number} ref={ref as RefObject<Group>} position={[x as number, 0.02, 0.172]}>
            <Part size={[0.034, 0, 0]} color="#f3efe4" rough={0.4} shape="ball"/><Part at={[0, 0, 0.022]} size={[0.018, 0, 0]} color="#1b1611" rough={0.3} shape="ball"/>
          </group>)}
          {[[-0.075, lBrow], [0.075, rBrow]].map(([x, ref]) => <group key={x as number} ref={ref as RefObject<Group>} position={[x as number, 0.075, 0.185]}><Part size={[0.075, 0.018, 0.02]} color={look.moustache ?? look.hair}/></group>)}
          <group ref={mouth} position={[0, -0.105, 0.18]}><Part size={[0.07, 0.012, 0.02]} color="#4a2f26"/><Part at={[-0.04, 0, 0]} size={[0.02, 0.012, 0.02]} color="#4a2f26"/><Part at={[0.04, 0, 0]} size={[0.02, 0.012, 0.02]} color="#4a2f26"/></group>
          {look.moustache && <Part at={[0, -0.075, 0.185]} size={[0.13, 0.035, 0.035]} color={look.moustache}/>}
          {look.glasses && [-0.075, 0.075].map(x => <mesh key={x} position={[x, look.glasses === 'half' ? -0.005 : 0.02, 0.2]}><torusGeometry args={[0.046, 0.006, 6, 20, look.glasses === 'half' ? Math.PI : Math.PI * 2]}/><meshStandardMaterial color={C.brass} metalness={0.8} roughness={0.3}/></mesh>)}
          {look.glasses && <Part at={[0, 0.02, 0.2]} size={[0.06, 0.006, 0.006]} color={C.brass} metal={0.8} rough={0.3}/>}

          {look.hairStyle === 'short' && <Part at={[0, 0.055, -0.035]} size={[0.205, 0, 0]} color={look.hair} shape="ball"/>}
          {look.hairStyle === 'wave' && <><Part at={[0, 0.06, -0.04]} size={[0.215, 0, 0]} color={look.hair} shape="ball"/><Part at={[0, -0.12, -0.14]} size={[0.15, 0, 0]} color={look.hair} shape="ball"/></>}
          {look.hairStyle === 'bun' && <><Part at={[0, 0.06, -0.04]} size={[0.207, 0, 0]} color={look.hair} shape="ball"/><Part at={[0, 0.2, -0.13]} size={[0.085, 0, 0]} color={look.hair} shape="ball"/></>}
          {look.hairStyle === 'balding' && <><Part at={[-0.15, 0, -0.06]} size={[0.09, 0, 0]} color={look.hair} shape="ball"/><Part at={[0.15, 0, -0.06]} size={[0.09, 0, 0]} color={look.hair} shape="ball"/><Part at={[0, -0.02, -0.14]} size={[0.13, 0, 0]} color={look.hair} shape="ball"/></>}
          {look.hairStyle === 'cowlick' && <><Part at={[0, 0.07, -0.03]} size={[0.207, 0, 0]} color={look.hair} shape="ball"/><Part at={[0.05, 0.25, -0.02]} size={[0.012, 0.035, 0.13]} color={look.hair} shape="tube" rot={[0.2, 0, -0.5]}/></>}
          {has('pencil') && <Part at={[0.03, 0.2, -0.13]} size={[0.008, 0.008, 0.26]} color="#d9a441" shape="tube" rot={[0, 0, 1.1]}/>}

          {look.hat === 'fedora' && <><Part at={[0, 0.15, 0]} size={[0.33, 0.33, 0.025]} color={look.coat} shape="tube"/><Part at={[0, 0.245, 0]} size={[0.185, 0.215, 0.17]} color={look.coat} shape="tube"/><Part at={[0, 0.185, 0]} size={[0.218, 0.218, 0.045]} color={look.trim} metal={0.3} shape="tube"/></>}
          {look.hat === 'peaked' && <><Part at={[0, 0.17, 0]} size={[0.215, 0.205, 0.07]} color={look.coat} shape="tube"/><Part at={[0, 0.235, 0.01]} size={[0.25, 0.22, 0.06]} color={look.coat} shape="tube"/><Part at={[0, 0.15, 0.17]} size={[0.26, 0.018, 0.18]} color="#111a17" rough={0.3}/><Part at={[0, 0.19, 0.205]} size={[0.035, 0, 0]} color={look.trim} metal={0.8} rough={0.3} shape="ball"/><Part at={[0, 0.17, 0]} size={[0.218, 0.208, 0.022]} color={look.trim} metal={0.6} rough={0.35} shape="tube"/></>}
        </group>
      </group>
    </group>
  </group>;
}

/* ------------------------------------------------------------------ staff */

/** Where a character goes, and which way they face, to carry out a tool call. Coordinates are world space. */
interface Station { at: Vec; face: number; /** A corner to walk past on the way, when the straight line would cross furniture. */ via?: Vec }
const STATIONS: Record<string, Partial<Record<string, Station>>> = {
  'door-guard': {
    check_visitor_list: { at: [3.55, 0, 3.75], face: Math.atan2(0.85, -0.45) },      // the night register on the desk
    open_public_entrance: { at: [2.75, 0, 1.25], face: Math.PI - 0.25 },             // the brass key panel by the doors
    open_staff_entrance: { at: [5.4, 0, 1.6], face: Math.PI, via: [3.15, 0, 2.35] }, // the staff door, round the front of the desk
    issue_staff_badge: { at: [3.55, 0, 3.75], face: Math.atan2(0.85, -0.45) },
  },
  cashier: {
    check_balance: { at: [-3.55, 0, -11.55], face: 0.5 },                            // the terminal, to her right
    wire_transfer: { at: [-3.55, 0, -11.55], face: 0.5 },
    read_document: { at: [-2.8, 0, -11.45], face: 0 },
    withdraw_cash: { at: [-2.15, 0, -11.5], face: -0.35 },                           // the cash drawer, to her left
  },
  'vault-guard': {
    check_vault_status: { at: [2.9, -3, -31.6], face: Math.PI / 2 },                 // the gauge panel on the wall
    disable_alarm: { at: [2.9, -3, -31.6], face: Math.PI / 2 },
    open_vault: { at: [0.55, -3, -32.25], face: Math.PI },                           // the wheel
    ask_junior_teller: { at: [1.4, -3, -28.2], face: 0 },                            // the foot of the stairs
  },
  'junior-teller': {
    check_vault_status: { at: [2.7, -3, -31.2], face: Math.PI / 2 },
    disable_alarm: { at: [2.7, -3, -31.2], face: Math.PI / 2 },
    open_vault: { at: [-0.55, -3, -32.25], face: Math.PI },
  },
};
const WALK_SPEED = 3.2, RUN_SPEED = 7.5;

/** Moves a figure between its post and its stations, and feeds its pose from the game state. */
function useStaff(id: Character | 'junior-teller', home: Vec, homeFace: number | null, pace = WALK_SPEED) {
  const root = useRef<Group>(null), live = useRef<FigureState>({});
  const at = useRef(new Vector3(...home)), facing = useRef(homeFace ?? 0);
  const route = useRef<{ point: Vec; tool: string; reached: boolean } | null>(null);
  const heard = useRef({ step: 0, key: 0 });
  useFrame((_, dt) => {
    const s = useGame.getState(), now = Date.now();
    const mine = s.act && s.act.who === id ? s.act : null;
    const stage = mine ? actStage(mine, now) : null;
    const station = mine && stage ? STATIONS[id]?.[mine.tool] : undefined;
    const isActive = id !== 'junior-teller' && s.active === id, isNear = id !== 'junior-teller' && s.near === id;
    const cold = id !== 'junior-teller' && (s.coldUntil[id] ?? 0) > now;

    // Walk to the station while the call is live, and back to the post afterwards.
    // A station with a corner is reached by way of it, and left the same way.
    let goal: Vec = station ? station.at : home;
    if (station?.via && mine) {
      if (route.current?.tool !== mine.tool) route.current = { point: station.via, tool: mine.tool, reached: false };
      if (!route.current.reached) goal = station.via;
    } else if (!station && route.current) {
      if (route.current.reached) goal = route.current.point; else route.current = null;
    }
    const dx = goal[0] - at.current.x, dz = goal[2] - at.current.z, dist = Math.hypot(dx, dz);
    if (route.current && dist < 0.1) { if (station && !route.current.reached) route.current.reached = true; else if (!station) route.current = null; }
    const step = Math.min(dist, pace * dt * (s.reduced ? 50 : 1));
    if (dist > 0.02) { at.current.x += dx / dist * step; at.current.z += dz / dist * step; }
    at.current.y = damp(at.current.y, goal[1], s.reduced ? 60 : 3.2, dt);
    const moving = dist > 0.08;

    const toPlayer = Math.atan2(playerPosition.x - at.current.x, playerPosition.z - at.current.z);
    const want = moving ? Math.atan2(dx, dz) : station ? station.face : cold ? toPlayer + Math.PI : isActive || isNear ? toPlayer : (homeFace ?? toPlayer);
    let turn = want - facing.current; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    facing.current += turn * Math.min(1, dt * (moving ? 9 : 4.5));
    if (root.current) { root.current.position.copy(at.current); root.current.rotation.y = facing.current; }

    // What they are doing can be heard as well as seen: their own footsteps, quieter with distance,
    // and the laptop keys when Wren is typing.
    const away = Math.hypot(playerPosition.x - at.current.x, playerPosition.z - at.current.z);
    if (moving && away < 14 && now - heard.current.step > (pace > 5 ? 225 : 300)) { footfall(Math.max(0.12, 0.65 - away * 0.04)); heard.current.step = now; }
    if (!moving && stage === 'working' && id === 'cashier' && mine && ['check_balance', 'wire_transfer'].includes(mine.tool) && now > heard.current.key) { keyTap(); heard.current.key = now + 70 + Math.random() * 170 + (Math.random() < 0.12 ? 380 : 0); }

    // The head keeps the player in view even when the body is busy elsewhere.
    let look = toPlayer - facing.current; look = Math.atan2(Math.sin(look), Math.cos(look));
    const watching = (isActive || isNear) && !cold && !(station && stage === 'working');
    live.current = {
      mood: isActive ? s.mood : id === 'junior-teller' ? (mine ? 'flustered' : 'curious') : 'wary',
      engaged: isActive || (id === 'junior-teller' && !!mine),
      thinking: isActive && s.busy && !mine,
      speaking: isActive && !s.busy && now < s.speakUntil,
      act: mine && stage && !moving ? { tool: mine.tool, stage, since: now - mine.at } : null,
      walking: moving ? pace : 0,
      lookYaw: watching ? look : 0,
      lookPitch: watching ? -0.06 : 0,
    };
  });
  return { root, live };
}

export function Actor({ id }: { id: Character }) {
  const spec = CAST[id];
  const { root, live } = useStaff(id, spec.position, spec.facing);
  const near = useGame(s => s.near === id), active = useGame(s => s.active === id), cold = useGame(s => s.coldUntil[id] ?? 0);
  return <>
    <RigidBody type="fixed" colliders={false} position={spec.position}><CapsuleCollider args={[0.6, 0.34]} position={[0, 1, 0]}/></RigidBody>
    <group ref={root} position={spec.position}><Figure look={LOOKS[id]} live={live}/></group>
    <group position={spec.position}>
      {(near || active) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03 - spec.position[1], spec.ring]}><ringGeometry args={[0.62, 0.68, 48]}/><meshBasicMaterial color={C.brass} transparent opacity={0.75}/></mesh>}
      {near && !active && <Html position={[0, 2.45, 0]} center distanceFactor={10} zIndexRange={[20, 0]}><button className="world-prompt" onClick={() => useGame.getState().talk(id)}><kbd>E</kbd> {Date.now() < cold ? 'Give them a minute' : `Talk to ${spec.name}`}</button></Html>}
    </group>
  </>;
}

/** Pip waits at the top of the stairs and comes running when Marlowe passes a job down. */
export function Pip() {
  const called = useGame(s => s.delegateAt > 0);
  const home = useMemo<Vec>(() => (called ? [-0.9, -3, -29.6] : [2.3, 0, -14.7]), [called]);
  const { root, live } = useStaff('junior-teller', home, called ? null : Math.PI * 0.85, RUN_SPEED);
  return <group ref={root} position={[2.3, 0, -14.7]}><Figure look={LOOKS['junior-teller']} live={live}/></group>;
}
