# A soft, warm bed: slow pad chords, a gentle marimba-like arpeggio, a deep sub note. 76 s, 84 bpm.
import numpy as np, soundfile as sf
SR=48000; DUR=76.0; N=int(SR*DUR)
t=np.arange(N)/SR
beat=60/84; bar=beat*4
def hz(n): return 440*2**((n-69)/12)
# progression (midi triads), one chord per 2 bars: Cmaj9 - Am9 - Fmaj9 - G6
CH=[[48,55,59,64,71],[45,52,60,64,67],[41,48,57,60,67],[43,50,59,64,69]]
out=np.zeros((2,N))
def env(n,a,r,length):
    e=np.ones(n); na=int(a*SR); nr=int(r*SR)
    e[:na]=np.linspace(0,1,na)**1.5
    e[-nr:]*=np.linspace(1,0,nr)**1.5
    return e
# pad
for k in range(int(DUR/(2*bar))+1):
    t0=k*2*bar; ch=CH[k%4]
    n0=int(t0*SR); L=int((2*bar+1.6)*SR); n1=min(N,n0+L)
    if n0>=N: break
    tt=np.arange(n1-n0)/SR
    sig=np.zeros(n1-n0)
    for j,m in enumerate(ch):
        f=hz(m)
        for det in (-0.12,0.12):
            ph=np.random.rand()*6.28
            sig+=(np.sin(2*np.pi*(f+det)*tt+ph)+0.35*np.sin(2*np.pi*2*(f+det)*tt+ph)+0.12*np.sin(2*np.pi*3*f*tt))/ (1+0.4*j)
    sig*=env(n1-n0,1.4,1.6,0)*0.05
    pan=0.5
    out[0,n0:n1]+=sig*0.9; out[1,n0:n1]+=sig*0.9
# gentle arpeggio (marimba-ish: sine + quick decaying 4th harmonic), 8ths with soft accents
rng=np.random.default_rng(3)
pattern=[0,2,4,2,3,2,4,1]
step=beat/2
i=0; tcur=0.0
while tcur<DUR-2:
    chord=CH[int(tcur//(2*bar))%4]
    note=chord[pattern[i%8]%len(chord)]+12
    if tcur>3.0 and rng.random()<0.82:
        f=hz(note); n0=int(tcur*SR); L=int(1.6*SR); n1=min(N,n0+L); tt=np.arange(n1-n0)/SR
        s_=np.sin(2*np.pi*f*tt)*np.exp(-tt*3.2)+0.25*np.sin(2*np.pi*4*f*tt)*np.exp(-tt*11)+0.1*np.sin(2*np.pi*2*f*tt)*np.exp(-tt*5)
        amp=0.075*(1.0 if i%8==0 else 0.7)
        p=0.3+0.4*rng.random()
        out[0,n0:n1]+=s_*amp*(1-p); out[1,n0:n1]+=s_*amp*p
    tcur+=step; i+=1
# soft sub
for k in range(int(DUR/(2*bar))+1):
    t0=k*2*bar; n0=int(t0*SR); n1=min(N,n0+int(2*bar*SR))
    if n0>=N: break
    tt=np.arange(n1-n0)/SR; f=hz(CH[k%4][0]-12)
    sg=np.sin(2*np.pi*f*tt)*env(n1-n0,0.8,0.8,0)*0.07
    out[0,n0:n1]+=sg; out[1,n0:n1]+=sg
# film fade in/out
fade=np.ones(N); fi=int(2.5*SR); fo=int(4.5*SR); fade[:fi]=np.linspace(0,1,fi); fade[-fo:]=np.linspace(1,0,fo)
out*=fade
# simple stereo reverb via decaying noise convolution
ir_len=int(1.6*SR); irn=np.random.default_rng(7).standard_normal((2,ir_len))*np.exp(-np.arange(ir_len)/SR*3.0)
from numpy.fft import rfft,irfft
M=N+ir_len
wet=np.stack([irfft(rfft(out[c],M)*rfft(irn[c],M),M)[:N] for c in range(2)])*0.018
mix=out+wet
mix/=np.max(np.abs(mix))*1.1
import sys; sf.write(sys.argv[1] if len(sys.argv)>1 else 'bed.wav',mix.T,SR)
print('bed ok')
