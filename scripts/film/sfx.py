# Small synthesised sound effects for the film (no service needed): chimes, pings, pops, a whoosh,
# a glass clink and a bell. Cues are in seconds on the film's clock.
#   python3 scripts/film/sfx.py out.wav 87
import sys
import numpy as np, soundfile as sf
SR = 48000
out_path = sys.argv[1]; DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
N = int(SR * DUR); out = np.zeros((2, N)); rng = np.random.default_rng(5)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

def put(t, sig, gain=1.0, pan=0.5):
    n0 = int(t * SR); n1 = min(N, n0 + len(sig))
    if n0 < 0 or n0 >= N: return
    out[0, n0:n1] += sig[: n1 - n0] * gain * (1 - pan) * 1.4
    out[1, n0:n1] += sig[: n1 - n0] * gain * pan * 1.4

def tone(f, dur=1.4, decay=3.5, h=(1, .35, .12)):
    t = np.arange(int(dur * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(h)) * np.exp(-t * decay)
    s[: int(.004 * SR)] *= np.linspace(0, 1, int(.004 * SR))
    return s

def pop(f=700, dur=.18):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * (f * (1 + .6 * np.exp(-t * 40))) * t) * np.exp(-t * 28)

def clink():
    t = np.arange(int(1.1 * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in ((3150, 1, 7), (4720, .5, 11), (6300, .3, 16)))

def whoosh(dur=1.4):
    n = int(dur * SR); x = rng.standard_normal(n)
    k = np.convolve(x, np.ones(60) / 60, 'same')  # roll off the highs
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return k * env * 1.2

def down(dur=.9):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * (520 - 150 * t) * t) * np.exp(-t * 3.5)

# cues: film seconds
put(.5, tone(hz(84), 2.2, 2.2), .22)                       # open: a first soft chime
for i in range(6): put(12.2 + .33 * i, pop(620 + 45 * i), .18, .3 + .08 * i)  # six tables appear
put(20.45, clink(), .20, .6); put(20.75, down(), .12)     # slip: glass clink, small "oops"
for i, m in enumerate((76, 79, 83)): put(26.0 + i * .55, tone(hz(m), 1.5, 3.2), .2, .5)  # three next moves
put(36.0, tone(hz(88), .5, 9, (1, .6)), .22); put(38.4, tone(hz(79), 1.8, 2.8), .18); put(38.55, tone(hz(84), 1.8, 2.8), .16)  # alert, then relief
put(42.5, whoosh(), .13)                                  # delays follow the timeline
put(52.15, tone(hz(86), 1.8, 3.4), .18)                   # manager ding
put(60.7, pop(520), .2, .35); put(61.4, pop(760), .2, .65)  # a chat sent, a chat answered
put(69.4, tone(hz(81), 1.8, 3), .18)                      # everyone
for i, m in enumerate((72, 76, 79, 84, 88)): put(84.6 + i * .09, tone(hz(m), 2.4, 1.8), .16, .5)  # closing sparkle
out /= max(1.0, np.max(np.abs(out)) * 1.05)
sf.write(out_path, out.T, SR)
print('sfx ok')
