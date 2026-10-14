"""Synthesises the game's music, footsteps and key taps. Original, no samples.

    python3 scripts/make-sound.py        (needs numpy and ffmpeg)

The music is eight bars of slow lounge, written out note by note below and played on a
synthesised vibraphone and bass. Footsteps are a soft low "pomp", in four slightly different
takes. scripts/make-audio.py still makes the remaining effects (stamp, printer, door).
"""
import subprocess, wave
from pathlib import Path
import numpy as np

SR = 44100
rng = np.random.default_rng(1931)
OUT = Path(__file__).resolve().parent.parent / 'public' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)


def band(x, lo, hi, tilt=0.0):
    """Keep the frequencies between lo and hi, with soft edges. tilt > 0 darkens the sound."""
    spectrum = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = 1e-6
    gain = 1 / (1 + (lo / f) ** 4) / (1 + (f / hi) ** 4)
    if tilt:
        gain = gain / np.maximum(f, 20) ** tilt
    return np.fft.irfft(spectrum * gain, len(x))


def norm(x, peak):
    return x * (peak / (np.max(np.abs(x)) + 1e-9))


def level(x, rms):
    """Set a layer's average loudness. Balancing by peak lets one stray loud drop bury all the others."""
    return x * (rms / (np.sqrt(np.mean(x ** 2)) + 1e-9))


def decay(n, seconds, attack=0.0008):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / seconds)


def scatter(n, per_second, kernel, loud=0.6):
    """Drop a short sound at random moments: the basis of anything made of many small events."""
    hits = np.zeros(n)
    count = int(per_second * n / SR)
    hits[rng.integers(0, n, count)] += rng.uniform(0.2, 1, count) ** (1 + loud)
    size = n + len(kernel)
    return np.fft.irfft(np.fft.rfft(hits, size) * np.fft.rfft(kernel, size), size)[:n]


def slow(n, hz):
    """A wandering value between 0 and 1, for gusts and swells."""
    x = band(rng.standard_normal(n), 0.001, hz)
    x = x - x.min()
    return x / (x.max() + 1e-9)


def room(x, seconds, wet):
    """A little hall: the dry sound plus a decaying smear of itself."""
    n = int(seconds * SR)
    tail = rng.standard_normal(n) * np.exp(-np.arange(n) / (seconds * SR / 5))
    tail = band(tail, 300, 6000)
    size = len(x) + n
    echo = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(tail, size), size)
    out = np.zeros(size)
    out[:len(x)] = x
    return out + norm(echo, np.max(np.abs(x)) * wet)


def loopable(x, fade):
    """Blend the tail into the head so the loop has no seam."""
    f = int(fade * SR)
    ramp = np.linspace(0, 1, f)[:, None] if x.ndim == 2 else np.linspace(0, 1, f)
    body = x[:-f].copy()
    body[:f] = body[:f] * ramp + x[-f:] * (1 - ramp)
    return body


def save(name, x, bitrate='128k', loop=False):
    x = np.clip(x, -1, 1)
    path = OUT / f'{name}.wav'
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1 if x.ndim == 1 else 2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(path), '-codec:a', 'libmp3lame', '-b:a', bitrate, str(OUT / f'{name}.mp3')], check=True)
    # MP3 pads the start of every file, which leaves a gap each time a loop comes round. Ogg does not,
    # so loops are offered as Ogg first and MP3 only for browsers that cannot play it.
    if loop:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(path), '-codec:a', 'libvorbis', '-q:a', '5', str(OUT / f'{name}.ogg')], check=True)
    path.unlink()
    print(f'  {name}.mp3  {len(x) / SR:.2f}s')


# ------------------------------------------------------------------ music

BPM = 76
BEAT = 60 / BPM
BARS = 8
LOOP = int(round(BARS * 4 * BEAT * SR))
hz = lambda midi: 440 * 2 ** ((midi - 69) / 12)


def place(buffer, start_beats, wave_l, wave_r):
    """Add a note into the loop. Anything that rings past the end wraps round to the start, so the loop has no seam."""
    at = int(round(start_beats * BEAT * SR)) % LOOP
    for channel, wave_ in ((0, wave_l), (1, wave_r)):
        idx = (at + np.arange(len(wave_))) % LOOP
        np.add.at(buffer[:, channel], idx, wave_)


def vibes(midi, beats, level, pan):
    """A vibraphone: a pure bar tone with a soft mallet knock and the slow shimmer of the motor."""
    n = int((beats * BEAT + 2.2) * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    tone = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.35) + 0.1 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.08)
    held = np.where(t < beats * BEAT, 1.0, np.exp(-(t - beats * BEAT) / 0.35))   # the damper comes down when the note ends
    env = np.minimum(1, t / 0.004) * np.exp(-t / 1.7) * held * (1 + 0.1 * np.sin(2 * np.pi * 4.6 * t))
    wave_ = tone * env * level
    return wave_ * np.cos(pan * np.pi / 2), wave_ * np.sin(pan * np.pi / 2)


def bass(midi, beats, level):
    """An upright bass, plucked: round, short, mostly fundamental."""
    n = int((beats * BEAT + 0.25) * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.25) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.1)
    held = np.where(t < beats * BEAT * 0.9, 1.0, np.exp(-(t - beats * BEAT * 0.9) / 0.05))
    wave_ = tone * np.minimum(1, t / 0.008) * np.exp(-t / 0.55) * held * level
    return wave_ * 0.72, wave_ * 0.69


def music():
    """Eight bars of slow, late-night lounge: a ii-V-I-VI turnaround, vibes over a walking bass. Something to creep about a bank to."""
    out = np.zeros((LOOP, 2))
    # Two bars per chord. Voicings leave the root to the bass.
    chords = [(53, 57, 60, 64), (53, 57, 59, 64), (52, 55, 59, 62), (55, 58, 61, 64)]            # Dm9, G13, Cmaj9, A7b9
    walk = [(38, 41, 45, 48, 38, 40, 41, 42), (43, 47, 50, 53, 43, 41, 40, 38), (36, 40, 43, 47, 36, 38, 40, 43), (33, 37, 40, 43, 33, 35, 37, 40)]
    tune = [                                                                                     # (beat within the two bars, note, length)
        [(0, 69, 1.5), (1.5, 65, 0.5), (2, 62, 1.5), (4, 64, 1), (5, 67, 1), (6, 69, 2)],
        [(0, 71, 1.5), (1.5, 69, 0.5), (2, 67, 1.5), (4, 64, 2), (6.5, 62, 1)],
        [(0, 67, 1), (1, 64, 1), (2, 62, 1), (3, 60, 1), (4, 64, 3)],
        [(0, 73, 1.5), (1.5, 70, 0.5), (2, 69, 1.5), (4, 67, 1), (5, 64, 1), (6, 61, 2)],
    ]
    for i, (chord, line, phrase) in enumerate(zip(chords, walk, tune)):
        at = i * 8
        for hit, length, level in ((0, 3.2, 0.05), (5.5, 1.6, 0.036)):                           # a chord on the one, and a nudge before the next bar
            for k, note in enumerate(chord):
                place(out, at + hit + k * 0.012, *vibes(note, length, level, 0.3 + 0.13 * k))
        for beat, note in enumerate(line):
            place(out, at + beat, *bass(note, 0.85, 0.2 if beat % 4 == 0 else 0.16))
        for beat, note, length in phrase:
            place(out, at + beat, *vibes(note, length, 0.085, 0.62))
    # A warm room around it, wrapped round the loop the same way the notes are.
    n = int(1.8 * SR)
    for channel in (0, 1):
        tail = band(rng.standard_normal(n) * np.exp(-np.arange(n) / (0.42 * SR)), 250, 5000)
        wet = np.fft.irfft(np.fft.rfft(out[:, channel]) * np.fft.rfft(tail, LOOP), LOOP)
        out[:, channel] += norm(wet, np.max(np.abs(out[:, channel])) * 0.3)
    return norm(np.stack([band(out[:, 0], 30, 7000), band(out[:, 1], 30, 7000)], axis=1), 0.7)


# ------------------------------------------------------------------ footsteps and keys

def footstep(take):
    """A soft, round step: pomp. A low note that drops as it lands, with no click and no splash."""
    n = int(0.26 * SR)
    t = np.arange(n) / SR
    base = 68 * (1 + [0.0, 0.07, -0.05, 0.03][take - 1])
    phase = 2 * np.pi * np.cumsum(base + 95 * np.exp(-t / 0.028)) / SR
    thump = np.sin(phase) * np.minimum(1, t / 0.006) * np.exp(-t / 0.062)
    felt = norm(band(rng.standard_normal(n), 120, 650), 1) * np.minimum(1, t / 0.004) * np.exp(-t / 0.018) * 0.13   # the sole meeting the floor
    return norm(thump + felt, 0.8)


def strike(length, parts):
    """One impact, summed from (kind, frequency range or pitch, decay seconds, level) parts."""
    n = int(length * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for kind, a, b, seconds, level in parts:
        if kind == 'noise':
            x += norm(band(rng.standard_normal(n), a, b), 1) * decay(n, seconds) * level
        else:
            x += np.sin(2 * np.pi * a * t * (1 - b * t)) * decay(n, seconds) * level
    return x


def key():
    """A laptop key: the click of the switch, then the softer knock of the cap bottoming out."""
    v = 1 + rng.uniform(-0.15, 0.15)
    x = strike(0.07, [('noise', 2800 * v, 9000, 0.0025, 0.7), ('tone', 760 * v, 0, 0.009, 0.3)])
    at = int(0.022 * SR)
    up = strike(0.04, [('noise', 3500 * v, 9000, 0.002, 0.25)])
    x[at:at + len(up)] += up
    return norm(x, 0.6)


if __name__ == '__main__':
    print('music')
    save('music', music(), '160k', loop=True)
    print('footsteps')
    for take in range(1, 5):
        save(f'step{take}', footstep(take), '96k')
    print('keys')
    for take in range(1, 5):
        save(f'key{take}', key(), '96k')
