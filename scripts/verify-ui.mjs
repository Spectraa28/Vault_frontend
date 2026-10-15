import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.VAULT_PREVIEW_URL||'http://127.0.0.1:5174';
const out=new URL('../verification/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];let liveTurns=0;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/api/**',async route=>{if(route.request().url().endsWith('/say')){liveTurns++;return route.abort();}if(route.request().url().endsWith('/health'))return route.fulfill({json:{ok:true,needsCode:true}});if(route.request().url().endsWith('/role'))return route.fulfill({json:JSON.parse(route.request().postData())});return route.abort();});
const set=async state=>page.evaluate(async state=>(await import(performance.getEntriesByType('resource').find(r=>/\/src\/store\.ts(?:\?|$)/.test(r.name)).name)).useGame.getState().set(state),state);
const state=async()=>page.evaluate(async()=>{const s=(await import(performance.getEntriesByType('resource').find(r=>/\/src\/store\.ts(?:\?|$)/.test(r.name)).name)).useGame.getState();return {phase:s.phase,selectedTask:s.selectedTask,cleared:s.cleared,role:s.role};});
const snap=async name=>page.screenshot({path:new URL(name+'.png',out).pathname});
const results=[];
try {
for(const [width,height] of [[1440,900],[390,844],[1280,720],[1920,1080]]){
 console.log('Viewport',width,height);await page.setViewportSize({width,height});await page.goto(url+'/?exact');await page.locator('.title-copy').waitFor();await page.waitForTimeout(6500);
 if(width===1440||width===390)await snap(`landing-${width}`);
 await set({phase:'play',name:'Dana Whitlock',gameId:'verification-only',customer:{name:'Dana Whitlock',account:'4471'},unlocked:['door-guard','cashier','vault-guard'],muted:true});
 await page.getByRole('button',{name:/Understood/}).click();await page.waitForTimeout(2800);
 if(width===1440||width===390)await snap(`gate-${width}`);
 await page.evaluate(async()=>{const {playerControl}=await import(performance.getEntriesByType('resource').find(r=>/\/src\/scene\/shared\.ts(?:\?|$)/.test(r.name)).name);playerControl.teleport?.(2.4,1,5.7);});await page.waitForTimeout(500);
 await page.evaluate(async()=>(await import(performance.getEntriesByType('resource').find(r=>/\/src\/store\.ts(?:\?|$)/.test(r.name)).name)).useGame.getState().talk('door-guard'));await page.waitForTimeout(1000);
 if(width===1440||width===390)await snap(`conversation-${width}`);console.log('Conversation',width);
 await page.getByRole('button',{name:/Show driving licence/}).click();assert.match(await page.locator('#player-line').inputValue(),/Dana Whitlock, account 4471/);
 await page.getByRole('button',{name:/Guardrails/}).click();assert.equal(await page.locator('.task-panel').count(),1);
 if(width===1440||width===390)await snap(`tasks-${width}`);
 await page.getByRole('button',{name:/The forged memo/}).click();assert.equal((await state()).selectedTask,2);assert.deepEqual((await state()).cleared,[]);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.task-panel').count(),0);
 await page.getByRole('button',{name:/Current role customer/}).click();await page.getByText('Branch manager',{exact:true}).waitFor();assert.equal(await page.locator('.bank-card').count(),0);
 const spoken='A very long reply. '.repeat(45);
 await set({role:'customer',busy:true,notice:'The lobby is open',name:'A'.repeat(40),customer:{name:'A'.repeat(40),account:'4471'}});
 await page.waitForFunction(()=>document.querySelector('#player-line')?.disabled);
 await set({busy:false,reply:{name:'Gus',reply:spoken,mood:'wary',trust:1,attempts:[],coldShoulder:false,enforcementHeld:true,unlocked:[],cleared:[]}});
 await page.waitForFunction(text=>document.querySelector('.spoken-line')?.textContent===text,spoken,{polling:100,timeout:10000});
 await page.waitForFunction(()=>document.activeElement?.id==='player-line',undefined,{polling:100,timeout:10000});
 await page.waitForTimeout(2500);assert.equal((await state()).phase,'conversation','An old unlock notice must not end a conversation');
 const rects=await page.evaluate(()=>{const r={};for(const selector of ['.wallet','.dialogue','.teller-tape','.game-hud','.utility-hud']){const el=document.querySelector(selector),b=el.getBoundingClientRect();r[selector]={x:b.x,y:b.y,w:b.width,h:b.height,scroll:el.scrollWidth>el.clientWidth+2};}return r;});
 results.push({width,height,rects});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#player-line').fill('walking wasd should stay in the message box');assert.equal((await state()).phase,'conversation');
 await page.keyboard.press('Escape');assert.equal((await state()).phase,'play');
 }
 assert.equal(liveTurns,0);await writeFile(new URL('ui-results.json',out),JSON.stringify({results,errors,liveTurns},null,2));console.log(JSON.stringify({errors,liveTurns,viewports:results.length}));
}catch(error){await snap('failure');await writeFile(new URL('ui-failure.json',out),JSON.stringify({results,errors,liveTurns,message:String(error)},null,2));throw error;}finally{await browser.close();}
