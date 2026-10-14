import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { BoxGeometry, CylinderGeometry, CanvasTexture, InstancedMesh, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace } from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store';
import { RigidBody } from '@react-three/rapier';
import { Billboard, Text } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
export const C = { brass: '#b99454', pale: '#e9dac0', green: '#173d31', dark: '#0a1816', stone: '#59635c', blue: '#739aaa' };
type Vec = [number, number, number];
// The level has a fixed set of shapes and colours; keep GPU resources across area mounts.
const boxes = new Map<string, BoxGeometry>(), cylinders = new Map<string, CylinderGeometry>(), materials = new Map<string, MeshStandardMaterial>();
export function surface(color: string, metal: number, rough: number) {
 const key = `${color}/${metal}/${rough}`;
 if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, metalness: metal, roughness: rough }));
 return materials.get(key)!;
}
export function boxShape(size: Vec) {
 const key = size.join('/');
 if (!boxes.has(key)) boxes.set(key, new BoxGeometry(...size));
 return boxes.get(key)!;
}
export function tubeShape(top: number, bottom: number, height: number) {
 const key = `${top}/${bottom}/${height}`;
 if (!cylinders.has(key)) cylinders.set(key, new CylinderGeometry(top,bottom,height,14));
 return cylinders.get(key)!;
}
export function Box({ at = [0, 0, 0], size, color = C.green, metal = 0, rough = .7, solid = false, children, ...props }: { at?: Vec; size: Vec; color?: string; metal?: number; rough?: number; solid?: boolean; children?: ReactNode } & Omit<ThreeElements['mesh'], 'position' | 'scale'>) {
  const mesh = <mesh position={at} receiveShadow castShadow geometry={boxShape(size)} material={surface(color,metal,rough)} dispose={null} {...props}>{children}</mesh>;
  return solid ? <RigidBody type="fixed" colliders="cuboid">{mesh}</RigidBody> : mesh;
}
export function Cylinder({ at = [0, 0, 0], radius = .3, height = 1, color = C.brass, rotation, metal = .6 }: { at?: Vec; radius?: number; height?: number; color?: string; rotation?: Vec; metal?: number }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow geometry={tubeShape(radius,radius,height)} material={surface(color,metal,.35)} dispose={null}/>;
}
export function Label({ children, at, size = .25, color = C.brass }: { children: string; at: Vec; size?: number; color?: string }) {
  // Local system-independent font bundled with the app, so text never blocks on a CDN.
  return <Text position={at} font="/fonts/bank.ttf" fontSize={size} color={color} anchorX="center" anchorY="middle" letterSpacing={.12}>{children}</Text>;
}
export function Lamp({ at, green = false }: { at: Vec; green?: boolean }) {
  const shade=useRef<MeshStandardMaterial>(null); const reduced=useGame(s=>s.reduced);
  useFrame(({clock})=>{if(shade.current)shade.current.emissiveIntensity=(green?.6:1.5)+(reduced?0:Math.sin(clock.elapsedTime*8+at[0])*.035);});
  return <group position={at}><Cylinder radius={.16} height={.08}/><Cylinder at={[0,.28,0]} radius={.035} height={.5}/><mesh position={[0,.55,0]}><coneGeometry args={[.32,.3,12,1,true]}/><meshStandardMaterial ref={shade} color={green ? '#255e36' : '#dfbd7c'} emissive={green ? '#346a38' : '#ffc67c'} emissiveIntensity={green ? .6 : 1.5} side={2}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><circleGeometry args={[.72,24]}/><meshBasicMaterial color="#ebc47c" transparent opacity={.11} depthWrite={false}/></mesh></group>;
}
export function Floor({ at, size, wet = false }: { at: Vec; size: Vec; wet?: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = wet ? '#34484c' : '#9b9e87'; ctx.fillRect(0,0,256,256);
    for (let y=0;y<4;y++) for(let x=0;x<4;x++) {
      ctx.fillStyle = (x+y)%2 ? (wet ? '#304044' : '#7c8576') : (wet ? '#405152' : '#b3b09a'); ctx.fillRect(x*64+1,y*64+1,62,62);
    }
    ctx.globalAlpha=.09;
    for (let i=0;i<12;i++) { ctx.strokeStyle= i%2 ? '#eee5cb' : '#34463f'; ctx.beginPath(); ctx.moveTo((i*79)%256,0); ctx.bezierCurveTo((i*41)%256,90,(i*19)%256,130,(i*113)%256,256); ctx.stroke(); }
    const t = new CanvasTexture(canvas); t.wrapS=t.wrapT=RepeatWrapping; t.repeat.set(size[0]/4,size[2]/4); t.colorSpace=SRGBColorSpace; return t;
  }, [size[0],size[2],wet]);
  return <RigidBody type="fixed" colliders="cuboid"><mesh position={at} receiveShadow><boxGeometry args={size}/><meshStandardMaterial map={texture} roughness={wet ? .2 : .32} metalness={wet ? .45 : .15}/></mesh></RigidBody>;
}
export function Dust({ at }: { at: Vec }) { return <Billboard position={at}><mesh><circleGeometry args={[.035,6]}/><meshBasicMaterial color="#f8d69a" transparent opacity={.4}/></mesh></Billboard>; }

let shadowTexture: CanvasTexture | undefined;
export function GroundShadow() {
 if (!shadowTexture) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!, gradient=ctx.createRadialGradient(32,32,4,32,32,32);
  gradient.addColorStop(0,'rgba(0,8,5,.6)');gradient.addColorStop(1,'rgba(0,8,5,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);shadowTexture=new CanvasTexture(canvas);
 }
 return <mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]} scale={[1,.7,1]}><planeGeometry args={[1.25,1.25]}/><meshBasicMaterial map={shadowTexture} transparent depthWrite={false}/></mesh>;
}

export function BrassBars({ positions, height }: { positions: [number,number,number][]; height:number }) {
 const mesh=useRef<InstancedMesh>(null);
 useLayoutEffect(()=>{if(!mesh.current)return;const dummy=new Object3D();positions.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();mesh.current!.setMatrixAt(i,dummy.matrix);});mesh.current.instanceMatrix.needsUpdate=true;},[positions]);
 return <instancedMesh ref={mesh} args={[undefined,undefined,positions.length]} castShadow><cylinderGeometry args={[.035,.035,height,8]}/><meshStandardMaterial color={C.brass} metalness={.6} roughness={.35}/></instancedMesh>;
}
