// Procedural WebAudio SFX — no asset files needed.
export class SFX {
  constructor() { this.ctx = null; this.master = null; }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _osc(type, freq, dur, { gain = 0.3, slideTo = null, delay = 0 } = {}) {
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(dur, { gain = 0.25, freq = 1000, q = 1, delay = 0 } = {}) {
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  play(name) {
    try {
      this.ensure();
      switch (name) {
        case 'swing':  this._noise(0.14, { gain: 0.2, freq: 2200, q: 0.7 }); break;
        case 'heavy':  this._noise(0.22, { gain: 0.3, freq: 1400, q: 0.6 }); break;
        case 'hit':    this._noise(0.1, { gain: 0.4, freq: 700 }); this._osc('square', 160, 0.12, { gain: 0.25, slideTo: 60 }); break;
        case 'hurt':   this._osc('sawtooth', 220, 0.25, { gain: 0.3, slideTo: 80 }); this._noise(0.15, { gain: 0.2, freq: 500 }); break;
        case 'roll':   this._noise(0.25, { gain: 0.14, freq: 400, q: 0.5 }); break;
        case 'sip':    this._osc('sine', 520, 0.1, { gain: 0.2 }); this._osc('sine', 780, 0.14, { gain: 0.2, delay: 0.1 }); break;
        case 'shoot':  this._osc('sawtooth', 900, 0.18, { gain: 0.18, slideTo: 300 }); break;
        case 'explode':this._noise(0.5, { gain: 0.45, freq: 300, q: 0.4 }); this._osc('sine', 90, 0.5, { gain: 0.4, slideTo: 30 }); break;
        case 'die':    this._osc('sawtooth', 300, 1.2, { gain: 0.35, slideTo: 40 }); this._noise(0.8, { gain: 0.3, freq: 250 }); break;
        case 'pickup': this._osc('sine', 660, 0.1, { gain: 0.2 }); this._osc('sine', 990, 0.15, { gain: 0.2, delay: 0.08 }); break;
        case 'checkpoint':
          [440, 554, 659, 880].forEach((f, i) => this._osc('sine', f, 0.35, { gain: 0.18, delay: i * 0.12 }));
          break;
        case 'bossroar':
          this._osc('sawtooth', 70, 1.4, { gain: 0.5, slideTo: 45 });
          this._noise(1.2, { gain: 0.35, freq: 180, q: 0.4 });
          break;
        case 'win':
          [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, 0.5, { gain: 0.22, delay: i * 0.16 }));
          break;
      }
    } catch (_) { /* audio is best-effort */ }
  }
}
