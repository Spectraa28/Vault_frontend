import { Howl, Howler } from 'howler';
import type { Area } from './store';
const sounds = new Map<string, Howl>();
let current: Howl | undefined;
let speech: Howl | undefined;
const get = (name: string, loop = false) => {
 let s=sounds.get(name); if(!s){ s=new Howl({src:[`/audio/${name}.wav`],loop,volume:loop?.25:.4,preload:true});sounds.set(name,s); } return s;
};
export function sound(name: string, position?: [number,number,number]) { const s=get(name==='vault'?'groan':name); if(position)s.pos(...position); s.play(); }
export function ambience(area: Area) { const next=get(area,true); if(current===next)return; const previous=current; if(previous){ previous.fade(previous.volume(),0,900); setTimeout(()=>{if(current!==previous)previous.stop();},950); } next.volume(0); if(!next.playing())next.play(); next.fade(0,.25,1000); current=next; }
export function mute(value: boolean) { Howler.mute(value); }
export function stopAudio() { sounds.forEach(s=>s.stop()); speech?.stop(); current=undefined; }
export function voice(url?: string) { speech?.unload(); if(url && /^https?:\/\//.test(url)) { speech=new Howl({src:[url],html5:true,volume:.8});speech.play(); } }
export function listener(x: number,y: number,z: number) { Howler.pos(x,y,z); }
