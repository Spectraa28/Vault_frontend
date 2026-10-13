import { useEffect, useRef, useState } from 'react';
interface Recognition { lang:string; continuous:boolean; interimResults:boolean; onresult:((event:{results: ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null; onerror:((event:{error:string})=>void)|null; onend:(()=>void)|null; start():void; stop():void; abort():void }
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export function useSpeech(onText:(text:string)=>void,onError:(message:string)=>void){
 const ref=useRef<Recognition|null>(null); const [listening,setListening]=useState(false);
 const Constructor=(window as SpeechWindow).SpeechRecognition??(window as SpeechWindow).webkitSpeechRecognition;
 const begin=()=>{
  if(!Constructor||ref.current)return;
  const recognition=new Constructor();ref.current=recognition;recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=e=>onText(Array.from(e.results).map(r=>r[0].transcript).join(' '));
  recognition.onerror=e=>{if(e.error!=='aborted')onError(e.error==='not-allowed'?'Microphone access was declined. You can still type.':`Speech input: ${e.error}. You can still type.`);setListening(false);ref.current=null;};
  recognition.onend=()=>{setListening(false);ref.current=null;};
  try{recognition.start();setListening(true);}catch{ref.current=null;onError('Could not start the microphone. You can still type.');}
 };
 const end=()=>ref.current?.stop();
 useEffect(()=>()=>{ref.current?.abort();},[]);
 return {available:!!Constructor,listening,begin,end};
}
