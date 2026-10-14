import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Object3D } from 'three';
import { objectiveFor, routeTo, standPoint, trail, type Vec } from '../guide';
import { useGame } from '../store';
import { playerPosition } from './Actor';
import { C } from './primitives';

const MAX = 70;

/**
 * Shows the way to whoever the player should see next: a line of brass markers on the floor,
 * routed through the doors and down the stairs, and a beacon over the spot to stand on.
 */
export default function Waypoint() {
  const unlocked = useGame(s => s.unlocked), cleared = useGame(s => s.cleared), role = useGame(s => s.role), reduced = useGame(s => s.reduced);
  const target = useMemo<Vec | null>(() => { const o = objectiveFor({ unlocked, cleared, role }); return o.who ? standPoint(o.who) : null; }, [unlocked, cleared, role]);
  const dots = useRef<InstancedMesh>(null), beacon = useRef<Group>(null), dummy = useMemo(() => new Object3D(), []);
  const state = useRef({ points: [] as Vec[], last: [9e9, 0, 9e9] as Vec });
  useLayoutEffect(() => { state.current.last = [9e9, 0, 9e9]; }, [target]);

  useFrame(({ clock }) => {
    const mesh = dots.current; if (!mesh) return;
    const s = state.current, t = clock.elapsedTime;
    if (!target) { mesh.count = 0; if (beacon.current) beacon.current.visible = false; return; }
    // Re-plot only when the player has actually moved, not every frame.
    const feet: Vec = [playerPosition.x, playerPosition.y - 0.85, playerPosition.z];
    if (Math.hypot(feet[0] - s.last[0], feet[2] - s.last[2]) > 0.6) { s.points = trail(routeTo(feet, target), 1.15, 1.3, MAX); s.last = feet; }
    const near = Math.hypot(feet[0] - target[0], feet[2] - target[2]) < 2.2;
    mesh.count = near ? 0 : s.points.length;
    s.points.forEach((p, i) => {
      // A pulse runs along the line toward the target, so the direction reads at a glance.
      const wave = reduced ? 0.75 : 0.55 + 0.45 * Math.max(0, Math.sin(t * 3.2 - i * 0.55));
      dummy.position.set(p[0], p[1] + 0.045, p[2]); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(wave); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (beacon.current) { beacon.current.visible = !near; beacon.current.position.set(target[0], target[1], target[2]); beacon.current.children[1].position.y = 2.75 + (reduced ? 0 : Math.sin(t * 2.4) * 0.12); beacon.current.children[1].rotation.y = t * 1.3; }
  });

  return <>
    <instancedMesh ref={dots} args={[undefined, undefined, MAX]} frustumCulled={false}><circleGeometry args={[0.13, 4]}/><meshBasicMaterial color="#e8c47a" transparent opacity={0.85} depthWrite={false}/></instancedMesh>
    <group ref={beacon}>
      <mesh position={[0, 2.6, 0]}><cylinderGeometry args={[0.16, 0.34, 5.2, 16, 1, true]}/><meshBasicMaterial color="#f1cf85" transparent opacity={0.1} depthWrite={false} side={2}/></mesh>
      <mesh><octahedronGeometry args={[0.2, 0]}/><meshStandardMaterial color={C.brass} emissive="#e0b45c" emissiveIntensity={1.6} metalness={0.7} roughness={0.25}/></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}><ringGeometry args={[0.55, 0.66, 40]}/><meshBasicMaterial color="#e8c47a" transparent opacity={0.9} depthWrite={false}/></mesh>
    </group>
  </>;
}
