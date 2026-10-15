// Replays only the new live capture into the real UI; no model or ArmorIQ calls during editing.
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = new URL('../../web/submission/', import.meta.url);
const run = JSON.parse(await readFile(new URL('run.json', out), 'utf8'));
assert(run.summary, 'Wait for the bounded live capture to finish first.');
assert(run.summary.playerTurns <= 12);
await mkdir(new URL('shots/', out), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const videoStarted = Date.now();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce', recordVideo: { dir: new URL('raw/', out).pathname, size: { width: 1600, height: 900 } } });
await page.route('**/api/**', route => route.abort());
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const files = {};
const motion = {};
try {
  await page.goto(process.env.VAULT_PREVIEW_URL || 'http://127.0.0.1:5174/?exact');
  await page.locator('.title-copy').waitFor();
  await page.waitForTimeout(5000);
  const store = async (operation, payload) => page.evaluate(async ({ operation, payload }) => {
    const resource = performance.getEntriesByType('resource').find(r => /\/src\/store\.ts(?:\?|$)/.test(r.name));
    const { useGame } = await import(resource.name);
    if (operation === 'set') useGame.getState().set(payload);
    else for (const e of payload) useGame.getState().event(e);
  }, { operation, payload });
  await page.addStyleTag({ content: '.submission-label{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:1000;background:#081b15ed;color:#eee5cf;padding:7px 14px;border:1px solid #c6a365;font:12px sans-serif;letter-spacing:.06em;pointer-events:none}' });
  await page.evaluate(() => { const label = document.createElement('div'); label.className = 'submission-label'; label.textContent = 'REPLAY OF LIVE CAPTURE · 15 OCT 2026 · WAITING COMPRESSED'; document.body.append(label); });
  const shot = async name => { const file = `shots/${name}.png`; motion[name] = (Date.now() - videoStarted) / 1000; await page.waitForTimeout(6500); await page.screenshot({ path: new URL(file, out).pathname }); files[name] = file; console.log(name); };
  await shot('title');
  await store('set', { phase: 'play', name: 'Dana Whitlock', customer: run.customer, gameId: 'submission-playback', unlocked: ['door-guard'], muted: true, reduced: true });
  await page.getByRole('button', { name: /Understood/ }).click();
  await page.waitForTimeout(2500);
  await shot('bank');
  const chosen = [
    ['entry', 'Legitimate action:', 'open_public_entrance', undefined],
    ['policy', 'Policy: Marlowe', 'open_vault', 'policy'],
    ['hold', 'Human approval:', 'withdraw_cash', undefined],
    ['identity', 'Identity:', 'withdraw_cash', undefined],
    ['intent', 'Intent:', 'wire_transfer', 'intent'],
    ['delegation', 'Delegation:', 'open_vault', 'intent'],
  ];
  for (const [name, title, tool, layer] of chosen) {
    const turn = run.turns.findLast(t => t.title.startsWith(title) && t.events.some(x => x.event.type === 'reply' && x.event.attempts.some(a => a.tool === tool && (!layer || a.layer === layer))));
    if (!turn) { files[name] = null; continue; }
    const who = turn.request.character;
    const activeLevel = { entry: null, policy: 1, hold: 3, identity: 4, intent: 2, delegation: 5 }[name];
    await store('set', { phase: 'play', active: null, busy: false, reply: null, lastLine: '', slips: [], turnStartSlip: 0, cine: null, notice: '', tasksOpen: false, role: turn.request.role, selectedTask: activeLevel, unlocked: ['door-guard', 'cashier', 'vault-guard'], coldUntil: {} });
    await page.waitForTimeout(1200);
    await page.evaluate(async who => {
      const resource = performance.getEntriesByType('resource').find(r => /\/src\/scene\/shared\.ts(?:\?|$)/.test(r.name));
      const { playerControl } = await import(resource.name);
      const positions = { 'door-guard': [2.4, 1, 5.7], cashier: [-2.8, 1, -9.1], 'vault-guard': [1.6, -2, -27.1] };
      playerControl.teleport(...positions[who]);
    }, who);
    await page.waitForTimeout(800);
    await store('set', { phase: 'conversation', active: who, busy: true, lastLine: turn.request.text });
    const events = turn.events.map(x => x.event);
    const holdAt = events.findIndex(e => e.type === 'hold');
    if (name === 'hold' && holdAt >= 0) {
      await store('events', events.slice(0, holdAt + 1));
      await page.waitForTimeout(800);
      await shot('hold-pending');
    }
    await store('set', { slips: [], act: null });
    await store('events', events);
    await store('set', { busy: false, notice: '' });
    await page.waitForTimeout(1200);
    const expected = events.findLast(e => e.type === 'reply').reply;
    assert.equal(await page.locator('.spoken-line').textContent(), expected);
    await shot(name);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(new URL('shots.json', out), JSON.stringify({ note: 'Actual UI rendered from the fresh live capture. No new API calls; waiting compressed.', files, motion, errors }, null, 2));
} finally { await page.close(); await page.video().saveAs(new URL('gameplay.webm', out).pathname); await browser.close(); }
