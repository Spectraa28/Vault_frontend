import { useEffect } from 'react';
import { AUTO, bank } from './api';
import { CAST } from './contract';
import { useGame } from './store';
import { sound } from './sound';
import { playerControl } from './scene/shared';

/**
 * Plays the recorded tour hands-free: signs in, walks the visitor to each character in the order
 * the night was recorded, and sends each saved line. It drives the same screens a player uses and
 * decides nothing itself. Every outcome still comes from the recording. Open with ?replay=auto.
 */
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('stopped', 'AbortError')); }, { once: true });
});
const until = async (test: () => boolean, signal: AbortSignal, limitMs = 60000) => {
  for (const started = Date.now(); !test(); ) { if (Date.now() - started > limitMs) throw new Error('The tour stalled.'); await pause(150, signal); }
};

async function tour(signal: AbortSignal) {
  const game = () => useGame.getState();
  await pause(3200, signal);
  game().set({ phase: 'login' });
  await pause(2600, signal);
  const first = await bank.start('customer', 'A stranger in the rain');
  game().set({ gameId: first.gameId, name: 'A stranger in the rain', role: 'customer', unlocked: first.unlocked, phase: 'play' });
  sound('door');
  await pause(2800, signal);

  for (let turn = bank.upcoming(); turn; turn = bank.upcoming()) {
    const { character, role } = turn.request;
    if (!game().unlocked.includes(character)) break;
    if (game().role !== role) {
      if (game().phase === 'conversation') { game().leave(); await pause(1200, signal); }
      await bank.role(game().gameId, role);
      game().set({ role, reply: null, lastLine: '', trust: null });
      sound('stamp');
      await pause(1600, signal);
    }
    if (game().active !== character) {
      if (game().phase === 'conversation') { game().leave(); await pause(1400, signal); }
      // Stand the visitor in front of the character, on the side the room is entered from.
      const [x, y, z] = CAST[character].position;
      playerControl.teleport?.(x - 0.5, (CAST[character].ring ? 0 : y) + 1.4, z + CAST[character].ring + (CAST[character].ring ? 0.2 : 2.3));
      await until(() => game().near === character, signal, 8000).catch(() => undefined);
      await pause(1500, signal);
      game().talk(character);
      await until(() => game().phase === 'conversation', signal, 5000);
      await pause(3200, signal);
    }
    // The recorded line is already in the box; sending it is the one thing a player would do here.
    await until(() => !document.querySelector<HTMLButtonElement>('.send-button')?.disabled, signal, 8000);
    document.querySelector<HTMLButtonElement>('.send-button')?.click();
    await until(() => game().busy, signal, 4000).catch(() => undefined);
    await until(() => !game().busy, signal, 120000);
    await pause(game().reply?.delegate ? 6500 : 4500, signal);
    // If a scripted shot is playing (the doors opening), let it finish and hand the camera back first.
    if (game().reply?.unlocked.length) await until(() => game().phase !== 'conversation', signal, 12000).catch(() => undefined);
  }

  if (game().phase === 'conversation') { game().leave(); await pause(1500, signal); }
  document.querySelector<HTMLButtonElement>('.leave-bank')?.click();
}

export default function Autoplay() {
  useEffect(() => {
    if (!AUTO) return;
    const stop = new AbortController();
    tour(stop.signal).catch((error: Error) => { if (error.name !== 'AbortError') useGame.getState().set({ error: `The recorded tour stopped: ${error.message}` }); });
    // Any key or click hands control back to the viewer.
    const takeOver = (e: Event) => { if (e.isTrusted) stop.abort(); };
    window.addEventListener('keydown', takeOver); window.addEventListener('pointerdown', takeOver);
    return () => { stop.abort(); window.removeEventListener('keydown', takeOver); window.removeEventListener('pointerdown', takeOver); };
  }, []);
  return null;
}
