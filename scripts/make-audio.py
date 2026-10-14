"""Small, original procedural sounds for the asset-free prototype. No external samples."""
import math, random, wave, struct
from pathlib import Path
random.seed(1931)
out = Path(__file__).resolve().parent.parent / 'public' / 'audio'
out.mkdir(parents=True, exist_ok=True)
rate = 22050
# Music, footsteps and key taps are made by make-sound.py. This file keeps only the interface effects.
for name, seconds in [('printer',1),('stamp',.25),('door',.6),('groan',2.7),('chime',1.8)]:
    data=[]; low=0
    for i in range(int(rate*seconds)):
        t=i/rate; noise=random.uniform(-1,1); low=.97*low+.03*noise
        if name=='gate': v=.12*noise+.4*low
        elif name=='lobby': v=.05*math.sin(t*math.tau*55)+(.14*noise*math.exp(-(t%1)*70))
        elif name=='vault': v=.08*math.sin(t*math.tau*48)+.04*math.sin(t*math.tau*72)+.05*low
        elif name=='printer': v=(.12*noise+.15*math.sin(t*math.tau*130))*(.6+.4*math.sin(t*math.tau*20))
        elif name=='chime': v=sum(math.sin(t*math.tau*f)*math.exp(-t*(2+j))*.15 for j,f in enumerate([220,330,440,554]))
        elif name in ('groan','thunder'): v=(.3*low+.15*math.sin(t*math.tau*(37+5*math.sin(t*4))))*math.sin(math.pi*t/seconds)
        else: v=(.4*noise+.4*math.sin(t*math.tau*(100 if name=='stamp' else 180)))*math.exp(-t*35)
        data.append(struct.pack('<h',int(max(-1,min(1,v))*32767)))
    with wave.open(str(out/(name+'.wav')),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(b''.join(data))
print('Generated original ambience and effect placeholders.')
