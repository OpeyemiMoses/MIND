/**
 * Mind Launch Film — Web Audio engine.
 * Prestige 98 BPM ambient score (pad + sub pulse + bell arps), choreographed SFX,
 * the soothing female voiceover clips, and sidechain-style ducking (-10dB under VO).
 * Everything is routed to the speakers AND to a MediaStream for video export.
 */
import { BEAT, FILM_DURATION, SFX_CUES, SfxType, VO_CUES } from './timeline';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Dmaj9 -> Bm11 -> Gmaj9 -> A(add9)
const PROGRESSION: number[][] = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 64],
  [43, 50, 54, 57, 59],
  [45, 52, 59, 61, 64],
];
const BELLS = [74, 76, 78, 81, 83, 86];
const DUCK = 0.32; // ~ -10dB

export class FilmAudio {
  ctx: AudioContext | null = null;
  recDest: MediaStreamAudioDestinationNode | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private padFilter!: BiquadFilterNode;
  private voBus!: GainNode;
  private sfxBus!: GainNode;
  private bellBus!: GainNode;
  private buffers: (AudioBuffer | null)[] = [];
  private raw: (ArrayBuffer | null)[] = [];
  private noise!: AudioBuffer;
  private nodes: AudioScheduledSourceNode[] = [];
  private startCtxTime = 0;
  private offset = 0;
  playing = false;

  /** Fetch voiceover bytes early (no AudioContext needed yet). */
  async prefetch(): Promise<void> {
    this.raw = await Promise.all(
      VO_CUES.map(async (c) => {
        try {
          const r = await fetch(c.src);
          return r.ok ? await r.arrayBuffer() : null;
        } catch {
          return null;
        }
      })
    );
  }

  /** Must be called from a user gesture. */
  async init(): Promise<void> {
    if (this.ctx) return;
    const ctx = new AudioContext({ latencyHint: 'playback' });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.recDest = ctx.createMediaStreamDestination();
    comp.connect(this.recDest);

    this.music = ctx.createGain();
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.6;
    this.padFilter.connect(this.music);
    this.music.connect(this.master);

    // Bells go through a soft feedback delay for space.
    this.bellBus = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.bellBus.connect(this.music);
    this.bellBus.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(this.music);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);

    this.voBus = ctx.createGain();
    this.voBus.gain.value = 1.15;
    this.voBus.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if (this.raw.length === 0) await this.prefetch();
    this.buffers = await Promise.all(
      this.raw.map(async (ab) => {
        if (!ab) return null;
        try {
          return await ctx.decodeAudioData(ab.slice(0));
        } catch {
          return null;
        }
      })
    );
  }

  now(): number {
    if (!this.ctx || !this.playing) return this.offset;
    return Math.max(0, this.ctx.currentTime - this.startCtxTime + this.offset);
  }

  pause(): void {
    this.offset = this.now();
    this.stopAll();
    this.playing = false;
  }

  seek(t: number): void {
    const wasPlaying = this.playing;
    this.stopAll();
    this.playing = false;
    this.offset = Math.min(Math.max(0, t), FILM_DURATION);
    if (wasPlaying) this.play(this.offset);
  }

  play(from?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    void ctx.resume();
    this.stopAll();
    if (typeof from === 'number') this.offset = from;
    if (this.offset >= FILM_DURATION - 0.05) this.offset = 0;
    this.startCtxTime = ctx.currentTime + 0.06;
    this.playing = true;
    this.schedule();
  }

  private at(t: number): number {
    return this.startCtxTime + (t - this.offset);
  }

  private track<T extends AudioScheduledSourceNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  private stopAll(): void {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* not started */
      }
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.nodes = [];
    if (this.ctx && this.music) {
      const g = this.music.gain;
      g.cancelScheduledValues(0);
      g.setValueAtTime(g.value, this.ctx.currentTime);
    }
  }

  private schedule(): void {
    const ctx = this.ctx!;
    const off = this.offset;
    const t0 = this.startCtxTime;

    // ---- Ducking automation ----
    const g = this.music.gain;
    g.cancelScheduledValues(0);
    const inVo = VO_CUES.some((c) => off >= c.start - 0.3 && off <= c.start + c.duration + 0.3);
    g.setValueAtTime(inVo ? DUCK : 1, t0);
    for (const c of VO_CUES) {
      const s = c.start - 0.35;
      const e = c.start + c.duration + 0.25;
      if (e < off) continue;
      if (s > off) g.setTargetAtTime(DUCK, this.at(s), 0.12);
      g.setTargetAtTime(1, this.at(e), 0.45);
    }

    // ---- Voiceover ----
    VO_CUES.forEach((c, i) => {
      const buf = this.buffers[i];
      if (!buf) return;
      const end = c.start + buf.duration;
      if (end <= off) return;
      const src = this.track(ctx.createBufferSource());
      src.buffer = buf;
      src.connect(this.voBus);
      if (c.start >= off) src.start(this.at(c.start));
      else src.start(t0, off - c.start);
    });

    // ---- Pad LFO ----
    const lfo = this.track(ctx.createOscillator());
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 420;
    lfo.connect(lfoGain);
    lfoGain.connect(this.padFilter.frequency);
    lfo.start(t0);

    // ---- Pad chords (16 beats per chord) ----
    const seg = BEAT * 16;
    const segCount = Math.ceil(FILM_DURATION / seg) + 1;
    for (let i = 0; i < segCount; i++) {
      const s = i * seg;
      const e = s + seg + 2.2;
      if (e < off || s > FILM_DURATION) continue;
      const chord = PROGRESSION[i % PROGRESSION.length];
      const level = s < 4 ? 0.026 : 0.034;
      for (const note of chord) {
        const ng = ctx.createGain();
        ng.connect(this.padFilter);
        const begin = Math.max(this.at(s), t0);
        if (s >= off) {
          ng.gain.setValueAtTime(0, begin);
          ng.gain.linearRampToValueAtTime(level, this.at(s + 1.8));
        } else {
          ng.gain.setValueAtTime(level, begin);
        }
        ng.gain.setValueAtTime(level, Math.max(begin + 0.01, this.at(s + seg - 0.2)));
        ng.gain.linearRampToValueAtTime(0, this.at(e));
        [-5, 5].forEach((cents, k) => {
          const o = this.track(ctx.createOscillator());
          o.type = k === 0 ? 'sine' : 'triangle';
          o.frequency.value = midi(note);
          o.detune.value = cents;
          o.connect(ng);
          o.start(begin);
          o.stop(this.at(e) + 0.05);
        });
      }
    }

    // ---- Sub pulse (heartbeat in Act I, full beat afterwards) ----
    for (let b = 0; b * BEAT < FILM_DURATION - 1; b++) {
      const t = b * BEAT;
      if (t < off) continue;
      const act1 = t < 28.5;
      if (act1 && (t < 2 || b % 2 !== 0)) continue;
      if (t > 147.5) continue;
      const level = act1 ? 0.16 : b % 4 === 0 ? 0.24 : 0.14;
      this.kick(this.at(t), level);
    }

    // ---- Bell arps from Act II onwards ----
    let k = 0;
    for (let b = 0; b * BEAT < FILM_DURATION; b += 2) {
      const t = b * BEAT;
      k++;
      if (t < 28.5 || t > 146 || t < off) continue;
      const note = BELLS[(k * 3 + Math.floor(k / 4)) % BELLS.length];
      this.bell(this.at(t), midi(note), 0.035);
    }

    // ---- SFX ----
    for (const c of SFX_CUES) {
      if (c.t < off) continue;
      this.sfx(c.type, this.at(c.t), c.dur ?? 1.5);
    }
  }

  private kick(when: number, level: number): void {
    const ctx = this.ctx!;
    const o = this.track(ctx.createOscillator());
    const gg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(92, when);
    o.frequency.exponentialRampToValueAtTime(44, when + 0.16);
    gg.gain.setValueAtTime(0.0001, when);
    gg.gain.linearRampToValueAtTime(level, when + 0.01);
    gg.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
    o.connect(gg);
    gg.connect(this.music);
    o.start(when);
    o.stop(when + 0.5);
  }

  private bell(when: number, freq: number, level: number): void {
    const ctx = this.ctx!;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, when);
    gg.gain.linearRampToValueAtTime(level, when + 0.008);
    gg.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    gg.connect(this.bellBus);
    [1, 2.01].forEach((mult, i) => {
      const o = this.track(ctx.createOscillator());
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const pg = ctx.createGain();
      pg.gain.value = i === 0 ? 1 : 0.25;
      o.connect(pg);
      pg.connect(gg);
      o.start(when);
      o.stop(when + 1.7);
    });
  }

  private noiseBurst(when: number, dur: number, type: BiquadFilterType, f0: number, f1: number, level: number, q = 0.9): void {
    const ctx = this.ctx!;
    const src = this.track(ctx.createBufferSource());
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, when);
    f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, when);
    gg.gain.linearRampToValueAtTime(level, when + dur * 0.7);
    gg.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f);
    f.connect(gg);
    gg.connect(this.sfxBus);
    src.start(when, Math.random());
    src.stop(when + dur + 0.05);
  }

  private tone(when: number, type: OscillatorType, f0: number, f1: number, dur: number, level: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = this.track(ctx.createOscillator());
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, when);
    gg.gain.linearRampToValueAtTime(level, when + attack);
    gg.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(gg);
    gg.connect(this.sfxBus);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private sfx(type: SfxType, when: number, dur: number): void {
    switch (type) {
      case 'drop':
        this.tone(when, 'sine', 72, 30, 2.6, 0.5, 0.02);
        this.noiseBurst(when, 1.2, 'lowpass', 300, 80, 0.06);
        break;
      case 'whoosh':
        this.noiseBurst(when, dur, 'bandpass', 180, 5200, 0.22, 0.7);
        break;
      case 'pop':
        this.tone(when, 'sine', 700, 230, 0.22, 0.12);
        this.noiseBurst(when, 0.05, 'highpass', 3000, 6000, 0.03);
        break;
      case 'laser':
        this.tone(when, 'sine', 800, 3200, dur, 0.035, 0.3);
        this.tone(when, 'triangle', 400, 1600, dur, 0.02, 0.3);
        break;
      case 'chime':
        [86, 93, 90].forEach((n, i) => this.tone(when + i * 0.07, 'sine', midi(n), midi(n), 3.2, 0.045));
        break;
      case 'tick':
        this.tone(when, 'square', 2400, 2400, 0.04, 0.02);
        break;
      case 'shutter':
        for (let i = 0; i < 4; i++) {
          this.tone(when + i * 0.12, 'square', 1200 - i * 120, 900 - i * 100, 0.06, 0.025);
          this.noiseBurst(when + i * 0.12, 0.08, 'highpass', 2000, 4000, 0.04);
        }
        break;
      case 'lock':
        this.tone(when, 'square', 1800, 1800, 0.03, 0.03);
        this.tone(when + 0.09, 'square', 2200, 2200, 0.03, 0.03);
        this.tone(when + 0.12, 'sine', midi(76), midi(76), 1.4, 0.06);
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this.noiseBurst(when + i * 0.045, 0.04, 'bandpass', 900 + i * 400, 1200 + i * 400, 0.06, 4);
        break;
      case 'hit':
        this.tone(when, 'sine', 110, 48, 1.4, 0.42, 0.01);
        this.tone(when, 'triangle', midi(62), midi(62), 1.8, 0.05, 0.01);
        this.noiseBurst(when, 0.5, 'lowpass', 1800, 200, 0.08);
        break;
    }
  }
}

