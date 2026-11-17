// All sound is synthesised with WebAudio: no audio files, no network. A
// quiet pentatonic (slendro-like) pluck loop under the campaign, war drums in
// battle, and one-shot effects for clicks, swords, coins, horns and gongs.

const AudioSys = {
  ctx: null,
  muted: false,
  musicTimer: null,
  musicStep: 0,
  mode: 'campaign', // 'campaign' | 'battle' | 'off'

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  setMuted(m) {
    this.muted = m;
    if (m) this.stopMusic();
    else this.startMusic(this.mode);
  },

  // A short oscillator blip with an exponential decay envelope.
  tone(freq, dur, type, vol, when, slideTo) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  // A filtered noise burst: swords, hits, drums.
  noise(dur, vol, freq, when) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
  },

  click() { this.tone(660, 0.06, 'triangle', 0.08); },
  coin() { this.tone(988, 0.08, 'sine', 0.10); this.tone(1319, 0.14, 'sine', 0.10, 0.07); },
  sword() { this.noise(0.12, 0.18, 3200); this.tone(220, 0.08, 'sawtooth', 0.05, 0, 110); },
  hit() { this.noise(0.08, 0.12, 900); },
  horn() { this.tone(196, 0.5, 'sawtooth', 0.14, 0, 185); this.tone(294, 0.5, 'sawtooth', 0.10, 0.05); this.tone(392, 0.4, 'sawtooth', 0.08, 0.1); },
  drum() { this.tone(90, 0.18, 'sine', 0.22, 0, 45); this.noise(0.1, 0.10, 300); },
  gong() { this.tone(98, 1.6, 'sine', 0.20); this.tone(147, 1.4, 'sine', 0.12, 0.02); this.tone(196, 1.0, 'sine', 0.08, 0.05); },
  defeat() { this.tone(330, 0.4, 'sawtooth', 0.10, 0, 165); this.tone(220, 0.6, 'sawtooth', 0.10, 0.3, 110); },
  levelup() { this.tone(523, 0.12, 'triangle', 0.12); this.tone(659, 0.12, 'triangle', 0.12, 0.1); this.tone(784, 0.22, 'triangle', 0.12, 0.2); },

  // Pentatonic pluck loop. Campaign: slow and sparse; battle: drums drive it.
  startMusic(mode) {
    this.mode = mode || this.mode;
    this.stopMusic();
    if (this.muted) return;
    const scale = [262, 294, 330, 392, 440, 523, 587];
    const stepMs = this.mode === 'battle' ? 300 : 520;
    let step = 0;
    const tick = () => {
      if (this.muted) return;
      step++;
      this.musicStep = step;
      if (this.mode === 'battle') {
        if (step % 2 === 0) this.drum();
        if (step % 8 === 3) this.tone(scale[(step * 3) % scale.length], 0.25, 'triangle', 0.05);
      } else {
        if (step % 2 === 1) this.tone(scale[(step * 2 + 1) % scale.length], 0.5, 'triangle', 0.045);
        if (step % 8 === 0) this.tone(scale[0] / 2, 0.9, 'sine', 0.05);
      }
    };
    tick();
    this.musicTimer = setInterval(tick, stepMs);
  },

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  },
};
