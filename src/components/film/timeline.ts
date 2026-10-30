/**
 * Mind Launch Film — master timeline (locked to the real voiceover clip durations).
 * All values are in seconds. Total runtime 150s (02:30.000).
 */

export const FILM_DURATION = 150;
export const BPM = 98;
export const BEAT = 60 / BPM; // 0.6122s

export interface VoCue {
  id: string;
  src: string;
  start: number;
  duration: number;
  text: string;
}

export const VO_CUES: VoCue[] = [
  { id: 'vo-01', src: '/audio/launch/vo-01.mp3', start: 1.0, duration: 9.312, text: 'Every day, billions of dollars move across decentralized networks. Yet the tools built to manage your wealth suffer from complete amnesia.' },
  { id: 'vo-02', src: '/audio/launch/vo-02.mp3', start: 11.4, duration: 8.88, text: 'They show you raw balances and transaction hashes, but they never remember why your capital is there, or the boundaries you set to protect it.' },
  { id: 'vo-03', src: '/audio/launch/vo-03.mp3', start: 21.6, duration: 4.872, text: 'Meet Mind. Your financial life on Sui, finally remembered.' },
  { id: 'vo-04', src: '/audio/launch/vo-04.mp3', start: 29.3, duration: 14.832, text: 'Designed with the calm clarity of a private wealth studio, Mind connects directly to Sui Mainnet through live Tatum streams, indexing ninety-seven token positions and over seven point eight million dollars, in real time.' },
  { id: 'vo-05', src: '/audio/launch/vo-05.mp3', start: 45.6, duration: 11.472, text: 'Every goal you set, from holding a stablecoin reserve, to capping single-protocol exposure, is structured, tracked, and measured against every onchain movement.' },
  { id: 'vo-06', src: '/audio/launch/vo-06.mp3', start: 58.6, duration: 11.4, text: 'Whether in obsidian dark or warm alabaster, the interface adapts effortlessly, turning complex blockchain telemetry into calm, actionable conviction.' },
  { id: 'vo-07', src: '/audio/launch/vo-07.mp3', start: 71.6, duration: 13.2, text: 'Beneath the surface runs a continuous intelligence loop. Mind observes live Sui state, encrypts your financial memories with SEAL, and commits them as verifiable blobs on Walrus Mainnet.' },
  { id: 'vo-08', src: '/audio/launch/vo-08.mp3', start: 86.0, duration: 12.264, text: "With Memory Replay, you don't just trust that memory works. You prove it. The same question, answered twice. Without memory, the advice is generic, and risky." },
  { id: 'vo-09', src: '/audio/launch/vo-09.mp3', start: 99.4, duration: 9.168, text: "With memory, Mind recalls your encrypted Walrus history, and delivers counsel that respects every rule you've ever set." },
  { id: 'vo-10', src: '/audio/launch/vo-10.mp3', start: 110.6, duration: 13.344, text: 'Built natively for Sui, Mind unites five production layers into one seamless architecture. Sui Mainnet. Tatum. Walrus. SEAL encryption. And Groq inference.' },
  { id: 'vo-11', src: '/audio/launch/vo-11.mp3', start: 125.6, duration: 9.936, text: 'One hundred percent real mainnet data. Zero mock fallbacks. Private by default. Your financial intelligence belongs to you, alone.' },
  { id: 'vo-12', src: '/audio/launch/vo-12.mp3', start: 137.8, duration: 9.96, text: 'Step into financial clarity that grows wiser with every block. Experience Mind, live today. Your financial life, remembered.' },
];

export interface ActMarker {
  label: string;
  start: number;
  end: number;
}

export const ACTS: ActMarker[] = [
  { label: 'ACT I  ·  THE AMNESIA PROBLEM', start: 0, end: 28.5 },
  { label: 'ACT II  ·  THE INTERFACE', start: 28.5, end: 70.4 },
  { label: 'ACT III  ·  THE ENGINE', start: 70.4, end: 110.2 },
  { label: 'ACT IV  ·  THE ECOSYSTEM', start: 110.2, end: 137.0 },
  { label: 'ACT V  ·  REMEMBERED', start: 137.0, end: FILM_DURATION },
];

/** Relay-race handoff moments (exit velocity = entry velocity). */
export const HANDOFFS = {
  dive: 28.5, // Act I -> II   Push-Through Dive
  cascade: 70.4, // Act II -> III Element Morph + Shutter Cascade
  split: 85.8, // pipeline -> A/B studio
  orbit: 110.2, // Act III -> IV divider bends into orbit
  prism: 137.0, // Act IV -> V  2D-to-3D prism shift
} as const;

export type SfxType = 'drop' | 'whoosh' | 'pop' | 'laser' | 'chime' | 'tick' | 'shutter' | 'lock' | 'glitch' | 'hit';

export interface SfxCue {
  t: number;
  type: SfxType;
  dur?: number;
}

export const SFX_CUES: SfxCue[] = [
  { t: 0.0, type: 'drop' },
  { t: 0.05, type: 'tick' },
  { t: 7.6, type: 'glitch' },
  { t: 8.3, type: 'hit' },
  { t: 11.0, type: 'whoosh', dur: 1.2 },
  { t: 12.5, type: 'laser', dur: 3.5 },
  { t: 16.5, type: 'chime' },
  { t: 19.6, type: 'whoosh', dur: 2.0 },
  { t: 21.0, type: 'tick' },
  { t: 21.6, type: 'drop' },
  { t: 22.7, type: 'chime' },
  { t: 26.4, type: 'whoosh', dur: 2.2 },
  { t: 28.5, type: 'hit' },
  { t: 31.0, type: 'pop' },
  { t: 37.4, type: 'chime' },
  { t: 45.6, type: 'pop' },
  { t: 46.1, type: 'pop' },
  { t: 51.4, type: 'lock' },
  { t: 58.8, type: 'whoosh', dur: 4.5 },
  { t: 65.5, type: 'whoosh', dur: 2.8 },
  { t: 68.6, type: 'shutter' },
  { t: 70.4, type: 'hit' },
  { t: 77.6, type: 'pop' },
  { t: 81.5, type: 'lock' },
  { t: 82.2, type: 'chime' },
  { t: 84.3, type: 'whoosh', dur: 1.6 },
  { t: 85.8, type: 'hit' },
  { t: 92.0, type: 'laser', dur: 3.5 },
  { t: 95.2, type: 'glitch' },
  { t: 105.0, type: 'chime' },
  { t: 107.6, type: 'whoosh', dur: 2.6 },
  { t: 110.2, type: 'drop' },
  { t: 117.4, type: 'pop' },
  { t: 118.7, type: 'pop' },
  { t: 119.8, type: 'pop' },
  { t: 121.0, type: 'pop' },
  { t: 122.6, type: 'pop' },
  { t: 125.8, type: 'hit' },
  { t: 129.3, type: 'hit' },
  { t: 132.6, type: 'hit' },
  { t: 135.3, type: 'whoosh', dur: 1.8 },
  { t: 137.0, type: 'drop' },
  { t: 137.1, type: 'chime' },
  { t: 143.5, type: 'pop' },
  { t: 144.1, type: 'pop' },
  { t: 144.7, type: 'pop' },
  { t: 146.5, type: 'chime' },
];

