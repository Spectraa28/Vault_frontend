import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});const errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.abort());
try{
 await page.goto((process.env.VAULT_PREVIEW_URL||'http://127.0.0.1:5174')+'/?exact');await page.waitForTimeout(5000);
 await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(r=>/\/src\/store\.ts(?:\?|$)/.test(r.name)).name;window.game=(await import(url)).useGame;game.getState().set({phase:'play',muted:true,unlocked:['door-guard','cashier','vault-guard']});});
 await page.getByRole('button',{name:/Understood/}).click();await page.waitForTimeout(5000);
 const result=await page.evaluate(async()=>{
  const { _roots }=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const root=_roots.get(document.querySelector('canvas')).store;const r=root.getState();
  const { playerControl,playerPosition }=await import(performance.getEntriesByType('resource').find(r=>/\/src\/scene\/shared\.ts(?:\?|$)/.test(r.name)).name);
  const keyboard=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key:code.replace('Key','').toLowerCase(),code,bubbles:true}));
  r.setFrameloop('never');const render=r.gl.render;r.gl.render=()=>{};let t=0;
  const step=dt=>{t+=dt;r.advance(t,true);};
  const samples=[];
  for(const hz of [60,120,144]){
   playerControl.teleport(0,1,12);for(let i=0;i<hz*2;i++)step(1/hz);
   keyboard('KeyW',true);let oldCamera=r.camera.position.clone(),oldPlayer={...playerControl.renderedPosition()},oldRaw={...playerPosition},maxFollowError=0,renderUpdates=0,physicsUpdates=0;
   for(let i=0;i<hz;i++){step(1/hz);const p=playerControl.renderedPosition(),c=r.camera.position;const err=Math.hypot((c.x-oldCamera.x)-(p.x-oldPlayer.x),(c.z-oldCamera.z)-(p.z-oldPlayer.z));maxFollowError=Math.max(maxFollowError,err);if(Math.abs(p.z-oldPlayer.z)>1e-6)renderUpdates++;if(Math.abs(playerPosition.z-oldRaw.z)>1e-6)physicsUpdates++;oldCamera.copy(c);oldPlayer={...p};oldRaw={...playerPosition};}
   keyboard('KeyW',false);samples.push({hz,maxFollowError,renderUpdates,physicsUpdates});
  }
  const walls=[];
  for(const [area,x,y,z,bound] of [['lobby',7.1,1,-7,7.56],['vault',3.1,-2,-28,3.56]]){
   playerControl.teleport(x,y,z);game.getState().set({area});for(let i=0;i<120;i++)step(1/60);
   document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:3000,bubbles:true}));keyboard('KeyQ',true);let maxX=-Infinity,minX=Infinity,minY=Infinity;
   for(let i=0;i<260;i++){step(1/60);maxX=Math.max(maxX,r.camera.position.x);minX=Math.min(minX,r.camera.position.x);minY=Math.min(minY,r.camera.position.y);}
   keyboard('KeyQ',false);walls.push({area,bound,maxX,minX,minY});
  }
  keyboard('KeyZ',true);for(let i=0;i<300;i++)step(1/60);keyboard('KeyZ',false);const tiltUp=r.camera.position.toArray();keyboard('KeyX',true);for(let i=0;i<300;i++)step(1/60);keyboard('KeyX',false);const tiltDown=r.camera.position.toArray();
  r.gl.render=render;r.setFrameloop('always');return {samples,walls,tiltUp,tiltDown};
 });
 console.log(JSON.stringify(result));await writeFile(new URL('../verification/camera-results.json',import.meta.url),JSON.stringify({result,errors,method:'Controlled render updates; fixed physics at 1/60. Rendering disabled only during deterministic sampling.'},null,2));
 for(const s of result.samples)assert.ok(s.maxFollowError<.01,`${s.hz}Hz follow error ${s.maxFollowError}`);
 for(const wall of result.walls)assert.ok(wall.maxX<=wall.bound+.01,`${wall.area} right wall penetration`);
 assert.equal(errors.length,0);
}finally{await browser.close();}
