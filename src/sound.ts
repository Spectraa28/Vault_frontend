import { Howl, Howler } from 'howler';
import type { Area } from './store';

/** The music loops as Ogg first, because MP3 leaves a gap each time round. Regenerated effects are MP3; the rest are the original WAVs. */
const sources = (name: string) => name === 'music' ? ['/audio/music.ogg', '/audio/music.mp3'] : /^(step|key)\d$/.test(name) ? [`/audio/${name}.mp3`] : [`/audio/${name}.wav`];
const MUSIC_LEVEL = 0.34;

const sounds = new Map<string, Howl>();
let current: Howl | undefined;
let speech: Howl | undefined;

const get = (name: string, loop = false) => {
  let s = sounds.get(name);
  if (!s) { s = new Howl({ src: sources(name), loop, volume: loop ? MUSIC_LEVEL : 0.4, preload: true }); sounds.set(name, s); }
  return s;
};

export function sound(name: string, position?: [number, number, number]) {
  const s = get(name === 'vault' ? 'groan' : name);
  if (position) s.pos(...position);
  s.play();
}

let lastTake = 0;

/** One footfall: a soft, low "pomp". Four takes, with the pitch and loudness drifting a little, so a walk never sounds like a loop. */
export function footfall(loudness = 1) {
  let take = 1 + Math.floor(Math.random() * 4);
  if (take === lastTake) take = (take % 4) + 1;
  lastTake = take;
  const s = get(`step${take}`);
  const id = s.play();
  s.rate(0.94 + Math.random() * 0.12, id);
  s.volume(0.5 * loudness * (0.85 + Math.random() * 0.25), id);
}

/** One key on Wren's laptop. */
export function key() {
  const s = get(`key${1 + Math.floor(Math.random() * 4)}`);
  const id = s.play();
  s.rate(0.9 + Math.random() * 0.25, id);
  s.volume(0.16 + Math.random() * 0.1, id);
}

/**
 * The music starts when the player first steps into the night and then simply keeps playing. Moving
 * between the street, the lobby and the vault does not restart it, so nothing jumps at a doorway.
 */
export function ambience(_area: Area) {
  const music = get('music', true);
  if (current === music && music.playing()) return;
  music.volume(0);
  if (!music.playing()) music.play();
  music.fade(0, MUSIC_LEVEL, 2400);
  current = music;
}

export function mute(value: boolean) { Howler.mute(value); }
export function stopAudio() { sounds.forEach(s => s.stop()); speech?.stop(); current = undefined; }
export function voice(url?: string) { speech?.unload(); if (url && /^https?:\/\//.test(url)) { speech = new Howl({ src: [url], html5: true, volume: 0.8 }); speech.play(); } }
export function listener(x: number, y: number, z: number) { Howler.pos(x, y, z); }
