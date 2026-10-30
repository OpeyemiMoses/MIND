'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Captions, Download, Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import { FilmAudio } from './audioEngine';
import { drawFrame, FilmAssets, FilmFonts, H, W } from './renderer';
import { FILM_DURATION } from './timeline';

const POSTER_T = 25.7;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Soft-feathers rectangular edges of studio renders so they dissolve seamlessly into the obsidian void. */
function featherStudioImage(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 1376;
  c.height = img.naturalHeight || 768;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  // Horizontal edge feather
  const gx = ctx.createLinearGradient(0, 0, c.width, 0);
  gx.addColorStop(0, 'rgba(0,0,0,0)');
  gx.addColorStop(0.14, 'rgba(0,0,0,1)');
  gx.addColorStop(0.86, 'rgba(0,0,0,1)');
  gx.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, c.width, c.height);
  // Vertical edge feather
  const gy = ctx.createLinearGradient(0, 0, 0, c.height);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.14, 'rgba(0,0,0,1)');
  gy.addColorStop(0.88, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [m, e] of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: e };
  }
  return { mime: '', ext: 'webm' };
}

export function LaunchFilm({ fonts }: { fonts: FilmFonts }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<FilmAudio | null>(null);
  const assetsRef = useRef<FilmAssets | null>(null);
  const startedRef = useRef(false);
  const captionsRef = useRef(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [cc, setCc] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [isStillPreview, setIsStillPreview] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load assets + fonts
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('t')) {
      requestAnimationFrame(() => setIsStillPreview(true));
    }
    let cancelled = false;
    const audio = new FilmAudio();
    audioRef.current = audio;
    void audio.prefetch();
    (async () => {
      const [rawDark, rawLight] = await Promise.all([loadImage('/hero-laptop-seamless.png'), loadImage('/hero-laptop-light.png')]);
      const loads: Promise<unknown>[] = [];
      for (const fam of [fonts.display, fonts.sans, fonts.mono]) {
        for (const wt of [500, 600, 700, 800]) loads.push(document.fonts.load(`${wt} 32px ${fam}`).catch(() => null));
      }
      await Promise.all(loads);
      if (cancelled) return;
      assetsRef.current = { laptopDark: featherStudioImage(rawDark), laptopLight: featherStudioImage(rawLight) };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      audio.pause();
      void audio.ctx?.close();
    };
  }, [fonts]);

  // Render loop: runs every animation frame, forever (zero dead frames, even when paused).
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    let raf = 0;
    let lastUi = 0;
    const params = new URLSearchParams(window.location.search);
    const stillT = params.get('t');
    const posterT = stillT !== null ? Number(stillT) : POSTER_T;
    const loop = (now: number) => {
      const audio = audioRef.current!;
      const wall = now / 1000;
      let t: number;
      let amb: number;
      if (!startedRef.current) {
        t = posterT;
        amb = stillT !== null ? posterT : POSTER_T + wall;
      } else {
        t = audio.now();
        amb = audio.playing ? t : t + wall;
        if (audio.playing && t >= FILM_DURATION) {
          // keep the end frame alive while the final shimmer rings out
          amb = t;
          if (t >= FILM_DURATION + 0.6) {
            audio.pause();
            setPlaying(false);
            if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
          }
        }
      }
      drawFrame(ctx, Math.min(t, FILM_DURATION + 0.6), amb, assetsRef.current!, fonts, { captions: captionsRef.current });
      if (now - lastUi > 200) {
        lastUi = now;
        setTime(Math.min(t, FILM_DURATION));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, fonts]);

  const pokeUi = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 2600);
  }, []);

  const ensureAudio = useCallback(async () => {
    const audio = audioRef.current!;
    await audio.init();
    return audio;
  }, []);

  const play = useCallback(
    async (from?: number) => {
      const audio = await ensureAudio();
      startedRef.current = true;
      setStarted(true);
      audio.play(from);
      setPlaying(true);
      pokeUi();
    },
    [ensureAudio, pokeUi]
  );

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (recording) return;
    if (audio?.playing) {
      audio.pause();
      setPlaying(false);
      setUiVisible(true);
    } else {
      await play();
    }
  }, [play, recording]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (recording || !startedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioRef.current?.seek(p * FILM_DURATION);
    setTime(p * FILM_DURATION);
  };

  const fullscreen = () => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;
    const audio = await ensureAudio();
    const { mime, ext } = pickMime();
    const stream = canvas.captureStream(60);
    audio.recDest?.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 18_000_000, audioBitsPerSecond: 256_000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mind-launch-film.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setRecording(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setRecording(true);
    rec.start(1000);
    await play(0);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        void toggle();
      } else if (e.key === 'f') fullscreen();
      else if (e.key === 'c') {
        captionsRef.current = !captionsRef.current;
        setCc(captionsRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const showUi = uiVisible || !playing;

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden select-none"
      onMouseMove={pokeUi}
      style={{ cursor: showUi ? 'default' : 'none' }}
    >
      <div className="relative" style={{ width: 'min(100vw, calc(100vh * 16 / 9))', aspectRatio: '16 / 9' }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full h-full block" onClick={() => void toggle()} />

        {!started && !isStillPreview && (
          <button
            onClick={() => void play(0)}
            disabled={!ready}
            className="absolute inset-0 flex flex-col items-center justify-end pb-[4.5%] gap-3 cursor-pointer"
            aria-label="Play launch film"
          >
            <span className="flex items-center gap-3 rounded-full px-8 py-4 text-sm font-semibold tracking-[0.2em] uppercase bg-[#D4AF37] text-black shadow-[0_0_60px_rgba(212,175,55,0.55)] hover:scale-105 transition-transform">
              <Play className="w-4 h-4 fill-black" />
              {ready ? 'Play launch film' : 'Loading film'}
            </span>
            <span className="text-[11px] tracking-[0.3em] uppercase text-white/50 font-mono">2:30 · sound on · F fullscreen · C captions</span>
          </button>
        )}

        {recording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-mono tracking-widest text-[#E5484D] border border-[#E5484D]/40">
            <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-pulse" />
            RECORDING {fmt(time)} / {fmt(FILM_DURATION)} — keep this tab visible
          </div>
        )}
      </div>

      {started && (
        <div
          className={`absolute bottom-0 inset-x-0 px-6 pb-5 pt-16 bg-gradient-to-t from-black/85 to-transparent transition-opacity duration-500 ${
            showUi && !recording ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="h-1.5 rounded-full bg-white/15 cursor-pointer mb-4 relative" onClick={seek}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#D4AF37]" style={{ width: `${(time / FILM_DURATION) * 100}%` }} />
          </div>
          <div className="flex items-center gap-3 text-white/85">
            <button onClick={() => void toggle()} className="p-2 rounded-full hover:bg-white/10 cursor-pointer" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => void play(0)} className="p-2 rounded-full hover:bg-white/10 cursor-pointer" aria-label="Restart">
              <RotateCcw className="w-5 h-5" />
            </button>
            <span className="font-mono text-xs tracking-widest text-white/60">
              {fmt(time)} / {fmt(FILM_DURATION)}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => {
                captionsRef.current = !captionsRef.current;
                setCc(captionsRef.current);
              }}
              className={`p-2 rounded-full hover:bg-white/10 cursor-pointer ${cc ? 'text-[#E7C45D]' : ''}`}
              aria-label="Toggle captions"
            >
              <Captions className="w-5 h-5" />
            </button>
            <button
              onClick={() => void exportVideo()}
              className="flex items-center gap-2 rounded-full border border-[#D4AF37]/50 px-4 py-2 text-xs font-semibold tracking-widest uppercase text-[#E7C45D] hover:bg-[#D4AF37]/10 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export video
            </button>
            <button onClick={fullscreen} className="p-2 rounded-full hover:bg-white/10 cursor-pointer" aria-label="Fullscreen">
              <Maximize2 className="w-5 h-5" />
            </button>
            <Link href="/" className="p-2 rounded-full hover:bg-white/10" aria-label="Back to Mind">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
