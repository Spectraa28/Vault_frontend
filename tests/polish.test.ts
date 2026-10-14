import { beforeEach, describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, cameraDistance, floorHeight, smoothCamera } from '../src/cameraMath';
import { useGame } from '../src/store';
import { approachesFor, checklist, objectiveFor } from '../src/guide';
import { disclosedBalance } from '../src/wallet';
import type { Reply } from '../src/contract';

describe('camera bounds and timing',()=>{
 it('keeps the same zoom response at 60, 120 and 144 Hz',()=>{
  const outputs=[60,120,144].map(hz=>{let value=6;for(let i=0;i<hz/2;i++)value=smoothCamera(value,2,1/hz);return value;});
  expect(outputs[0]).toBeCloseTo(outputs[1],10);expect(outputs[1]).toBeCloseTo(outputs[2],10);
 });
 it('clamps runaway scrolls and follows the ramp floor',()=>{
  for(const area of ['gate','lobby','vault'] as const){expect(cameraDistance(100,area)).toBe(CAMERA_LIMITS[area]);expect(cameraDistance(-100,area)).toBe(1.4);}
  expect(floorHeight(4)).toBe(0);expect(floorHeight(-19)).toBe(-1.5);expect(floorHeight(-28)).toBe(-3);
 });
});

describe('wallet and task selection',()=>{
 beforeEach(()=>useGame.getState().reset());
 it('only displays an explicit balance, not a request amount or a guess',()=>{
  expect(disclosedBalance('Your balance is $1,243.50.')).toBe('$1,243.50');
  expect(disclosedBalance('I can request $100 for your cab.')).toBeNull();
  expect(disclosedBalance('Your balance is unavailable.')).toBeNull();
 });
 it('keeps the balance hidden until Wren discloses it and retains it on later replies',()=>{
  const reply:Reply={type:'reply',name:'Wren',reply:'Your balance is $1,243.50.',mood:'warming',trust:2,attempts:[],unlocked:[],cleared:[],enforcementHeld:true,coldShoulder:false,ms:2000};
  const s=useGame.getState();s.set({active:'door-guard'});s.event({...reply,name:'Gus'});expect(useGame.getState().balance).toBeNull();
  s.set({active:null});s.event(reply);expect(useGame.getState().balance).toBe('$1,243.50');
  s.event({...reply,reply:'What else can I help with?'});expect(useGame.getState().balance).toBe('$1,243.50');
 });
 it('task selection changes navigation and approach only, never progress or role',()=>{
  useGame.getState().set({selectedTask:2});const s=useGame.getState();const o=objectiveFor(s);
  expect(o.who).toBe('cashier');expect(approachesFor('cashier',o,s.role)[0]).toMatchObject({level:2,suggested:true});
  expect(checklist(s.cleared).some(l=>l.done)).toBe(false);expect(s.role).toBe('customer');
  expect(objectiveFor({...s,selectedTask:'staff-door'}).who).toBe('door-guard');
  expect(approachesFor('door-guard',objectiveFor({...s,selectedTask:'staff-door'}),s.role)[0].label).toBe('Pull rank');
 });
});
