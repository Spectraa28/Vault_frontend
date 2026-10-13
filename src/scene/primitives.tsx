import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { CanvasTexture, InstancedMesh, Object3D, RepeatWrapping, SRGBColorSpace } from 'three';
import { RigidBody } from '@react-three/rapier';
import { Billboard, Text } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
export const C = { brass: '#b99454', pale: '#e9dac0', green: '#173d31', dark: '#0a1816', stone: '#59635c', blue: '#739aaa' };
type Vec = [number, number, number];
export function Box({ at = [0, 0, 0], size, color = C.green, metal = 0, rough = .7, solid = false, children, ...props }: { at?: Vec; size: Vec; color?: string; metal?: number; rough?: number; solid?: boolean; children?: ReactNode } & Omit<ThreeElements['mesh'], 'position' | 'scale'>) {
  const mesh = <mesh position={at} receiveShadow castShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} metalness={metal} roughness={rough}/>{children}</mesh>;
  return solid ? <RigidBody type="fixed" colliders="cuboid">{mesh}</RigidBody> : mesh;
}
export function Cylinder({ at = [0, 0, 0], radius = .3, height = 1, color = C.brass, rotation, metal = .6 }: { at?: Vec; radius?: number; height?: number; color?: string; rotation?: Vec; metal?: number }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, 16]}/><meshStandardMaterial color={color} metalness={metal} roughness={.35}/></mesh>;
}
export function Label({ children, at, size = .25, color = C.brass }: { children: string; at: Vec; size?: number; color?: string }) {
  // Local system-independent font bundled with the app, so text never blocks on a CDN.
  return <Text position={at} font="/fonts/bank.ttf" fontSize={size} color={color} anchorX="center" anchorY="middle" letterSpacing={.12}>{children}</Text>;
}
export function Lamp({ at, green = false }: { at: Vec; green?: boolean }) {
  return <group position={at}><Cylinder radius={.16} height={.08}/><Cylinder at={[0,.28,0]} radius={.035} height={.5}/><mesh position={[0,.55,0]}><coneGeometry args={[.32,.3,12,1,true]}/><meshStandardMaterial color={green ? '#255e36' : '#dfbd7c'} emissive={green ? '#346a38' : '#ffc67c'} emissiveIntensity={green ? .5 : 1.5} side={2}/></mesh><pointLight position={[0,.42,0]} color="#ffcb88" intensity={5} distance={4}/></group>;
}
export function Floor({ at, size, wet = false }: { at: Vec; size: Vec; wet?: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = wet ? '#34484c' : '#9b9e87'; ctx.fillRect(0,0,256,256);
    for (let y=0;y<4;y++) for(let x=0;x<4;x++) {
      ctx.fillStyle = (x+y)%2 ? (wet ? '#304044' : '#7c8576') : (wet ? '#405152' : '#b3b09a'); ctx.fillRect(x*64+1,y*64+1,62,62);
    }
    ctx.globalAlpha=.18;
    for (let i=0;i<50;i++) { ctx.strokeStyle= i%2 ? '#eee5cb' : '#34463f'; ctx.beginPath(); ctx.moveTo((i*79)%256,0); ctx.bezierCurveTo((i*41)%256,90,(i*19)%256,130,(i*113)%256,256); ctx.stroke(); }
    const t = new CanvasTexture(canvas); t.wrapS=t.wrapT=RepeatWrapping; t.repeat.set(size[0]/4,size[2]/4); t.colorSpace=SRGBColorSpace; return t;
  }, [size[0],size[2],wet]);
  return <RigidBody type="fixed" colliders="cuboid"><mesh position={at} receiveShadow><boxGeometry args={size}/><meshStandardMaterial map={texture} roughness={wet ? .2 : .32} metalness={wet ? .45 : .15}/></mesh></RigidBody>;
}
export function Dust({ at }: { at: Vec }) { return <Billboard position={at}><mesh><circleGeometry args={[.035,6]}/><meshBasicMaterial color="#f8d69a" transparent opacity={.4}/></mesh></Billboard>; }

export function BrassBars({ positions, height }: { positions: [number,number,number][]; height:number }) {
 const mesh=useRef<InstancedMesh>(null);
 useLayoutEffect(()=>{if(!mesh.current)return;const dummy=new Object3D();positions.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();mesh.current!.setMatrixAt(i,dummy.matrix);});mesh.current.instanceMatrix.needsUpdate=true;},[positions]);
 return <instancedMesh ref={mesh} args={[undefined,undefined,positions.length]} castShadow><cylinderGeometry args={[.035,.035,height,8]}/><meshStandardMaterial color={C.brass} metalness={.6} roughness={.35}/></instancedMesh>;
}
