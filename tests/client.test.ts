import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readEvents } from '../src/api';
import { decisionLabel, recordingSchema, type GameEvent } from '../src/contract';
import { updateSlips, useGame } from '../src/store';
const recording=recordingSchema.parse(JSON.parse(readFileSync(new URL('../public/recordings/mock-run.json',import.meta.url),'utf8')));
const reply=recording.turns[0].events[0];
function stream(text:string,bytes=7){const encoded=new TextEncoder().encode(text);return new ReadableStream<Uint8Array>({start(controller){for(let i=0;i<encoded.length;i+=bytes)controller.enqueue(encoded.slice(i,i+bytes));controller.close();}});}
describe('POST event stream',()=>{
 it('handles UTF-8 split inside a character, CRLF, heartbeat comments and an unterminated final block',async()=>{
  const events:GameEvent[]=[];await readEvents(stream(': waiting\r\n\r\ndata: '+JSON.stringify({...reply,reply:'A brass key — voilà.'}),1),e=>events.push(e));expect(events).toEqual([{...reply,reply:'A brass key — voilà.'}]);
 });
 it('keeps the recorded event order intact across arbitrary chunk boundaries',async()=>{
  const events:GameEvent[]=[];const saved=recording.turns[6].events;await readEvents(stream(saved.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')),e=>events.push(e));expect(events).toEqual(saved);
 });
 it('does not turn a broken connection into an allowed or blocked decision',async()=>{
  const events:GameEvent[]=[];await expect(readEvents(stream('data: {"type":"tool","tool":"open_vault","args":{}}\n\n'),e=>events.push(e))).rejects.toThrow('before the character replied');expect(events).toHaveLength(1);
 });
 it('rejects unknown outcomes and invalid server trust',async()=>{
  await expect(readEvents(stream('data: {"type":"decision","tool":"x","decision":"maybe"}\n\n'),()=>{})).rejects.toThrow();
  await expect(readEvents(stream('data: '+JSON.stringify({...reply,trust:6})+'\n\n'),()=>{})).rejects.toThrow();
 });
 it('surfaces the server error as a terminal event without inventing a reply',async()=>{const events:GameEvent[]=[];await readEvents(stream('data: {"type":"error","code":"RATE_LIMITED","message":"Slow down","retryAfterMs":1000}\n\n'),e=>events.push(e));expect(events[0].type).toBe('error');});
});
describe('server-driven presentation',()=>{
 it('separates intention, policy, hold and human decisions',()=>{expect(decisionLabel('blocked','intent')).toBe('NOT IN PLAN');expect(decisionLabel('blocked','policy')).toBe('BLOCKED');expect(decisionLabel('timeout','policy')).toBe('TIMED OUT');expect(decisionLabel('approved')).toBe('APPROVED');});
 it('matches repeated tool calls and delegation independently',()=>{
  let slips=updateSlips([],{type:'tool',tool:'open_vault',args:{}});slips=updateSlips(slips,{type:'tool',tool:'open_vault',args:{},delegatedTo:'junior-teller'});
  slips=updateSlips(slips,{type:'decision',tool:'open_vault',decision:'blocked',layer:'policy'});expect(slips[0].decision).toBe('blocked');expect(slips[1].decision).toBeUndefined();
  slips=updateSlips(slips,{type:'decision',tool:'open_vault',decision:'blocked',layer:'intent',delegatedTo:'junior-teller'});expect(slips[1].layer).toBe('intent');
 });
 it('only unlocks from a reply, preserves prior unlocks, and never claims five levels from this recording',()=>{
  useGame.getState().reset();for(const turn of recording.turns)for(const e of turn.events)useGame.getState().event(e);
  expect(useGame.getState().unlocked).toEqual(['cashier','vault-guard']);expect(useGame.getState().cleared.sort()).toEqual([2,3,5]);expect(useGame.getState().enforcementFault).toBe(false);
 });
 it('keeps evidence of a hold and reconciles receipts from final bank attempts',()=>{
  useGame.getState().reset();for(const e of recording.turns[2].events)useGame.getState().event(e);const s=useGame.getState().slips;expect(s).toHaveLength(1);expect(s[0].decision).toBe('timeout');expect(s[0].executed).toBe(false);expect(s[0].heldAt).toBeUndefined();
 });
 it('surfaces an enforcement failure rather than silently keeping the success story',()=>{useGame.getState().reset();useGame.getState().event({...reply,enforcementHeld:false} as GameEvent);expect(useGame.getState().enforcementFault).toBe(true);});
 it('uses the exact supplied recording without rewritten outcomes',()=>{expect(readFileSync(new URL('../public/recordings/mock-run.json',import.meta.url),'utf8')).toBe(readFileSync(new URL('../../web/mock-run.json',import.meta.url),'utf8'));});
});
