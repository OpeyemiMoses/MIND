'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  ChevronDown,
  Activity,
  Brain,
  History,
  Sparkles,
  Radio,
  Database,
  Cpu,
  RefreshCcw,
  Check,
  Menu,
  X,
} from 'lucide-react';
import heroLaptopScene from '../../../public/hero-laptop-seamless.png';
import heroLaptopLightScene from '../../../public/hero-laptop-light.png';
import { MindLogo } from '../common/MindLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { Reveal } from '../common/Reveal';
import { useTheme } from '@/context/ThemeContext';

interface LandingPageProps {
  onLaunchApp: () => void;
  onExploreFeatures: (tab: 'dashboard' | 'wallet' | 'ask' | 'memories' | 'replay') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onExploreFeatures,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const activeHeroImage = isLight ? heroLaptopLightScene : heroLaptopScene;

  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const faqs = [
    {
      q: 'How does Mind use Tatum for Sui blockchain data?',
      a: 'Mind queries Tatum’s high-performance Sui RPC Gateway (https://sui-mainnet.gateway.tatum.io) to fetch live coin balances (suix_getAllBalances) and paginated transaction blocks (suix_queryTransactionBlocks). All data is verified onchain with direct links to SuiVision.',
    },
    {
      q: 'What is Walrus Memory and why does it matter?',
      a: 'Unlike generic chatbots that reset each time you reload the page, Walrus Memory (@mysten-incubation/memwal) stores your confirmed savings goals, reserve limits, and past decisions on Sui decentralized storage. Mind recalls relevant memories whenever analyzing your wallet.',
    },
    {
      q: 'What is Memory Replay?',
      a: 'Memory Replay is Mind’s signature evaluation feature. It runs a controlled A/B test on the exact same onchain evidence snapshot: once without memories (generic analysis) and once with recalled context (personalized guidance) so you can clearly see the impact of remembered history.',
    },
    {
      q: 'Does Mind require my private key or seed phrase?',
      a: 'Never. Mind is strictly read-only for consumer financial intelligence. It connects via standard Sui browser wallets or public addresses inside the app and will never execute transactions or request signatures over your assets.',
    },
  ];

  const loopSteps = [
    {
      num: '01',
      phase: 'OBSERVE',
      title: 'Live Sui Activity',
      desc: 'Tatum RPC Gateway streams fresh token balances, swap history, and verified contract digests in real time.',
      tag: 'suix_getAllBalances',
      icon: Radio,
    },
    {
      num: '02',
      phase: 'RECALL',
      title: 'Walrus Memory',
      desc: 'Retrieves your confirmed savings targets, reserve thresholds, and prior decisions stored on Walrus Mainnet.',
      tag: '@mysten-incubation/memwal',
      icon: Database,
    },
    {
      num: '03',
      phase: 'REASON',
      title: 'Grounded Synthesis',
      desc: 'Cross-references live onchain price action against your personal context to craft explainable guidance.',
      tag: 'Evidence + Context',
      icon: Cpu,
    },
    {
      num: '04',
      phase: 'REPLAY',
      title: 'Memory Replay',
      desc: 'Proves exactly how remembered context changed the recommendation via side-by-side snapshot comparison.',
      tag: 'Deterministic A/B',
      icon: RefreshCcw,
    },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F5F5] flex flex-col relative overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-[#F5D76E]">
      {/* Top Navigation Bar — Fixed Executive Layout */}
      <header className="fixed top-0 left-0 right-0 w-full px-6 md:px-14 lg:px-20 z-50 bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] transition-colors duration-200">
        <div className="h-20 md:h-22 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div
            className="cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <MindLogo size="md" />
          </div>

          <nav className="hidden lg:flex items-center gap-10 text-sm font-medium text-[#9CA3AF]">
            <a href="#hero" className="text-[#E7C45D] font-semibold transition-colors">
              Home
            </a>
            <a href="#features" className="hover:text-[#F5F5F5] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#F5F5F5] transition-colors">
              About
            </a>
            <a href="#replay-preview" className="hover:text-[#F5F5F5] transition-colors">
              Memory Replay
            </a>
            <a href="/film" className="hover:text-[#E7C45D] transition-colors">
              Launch Film
            </a>
            <a href="#faq" className="hover:text-[#F5F5F5] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle variant="icon" />

            <button
              onClick={onLaunchApp}
              className="btn-gold-primary px-6 py-2.5 rounded-full font-semibold text-xs md:text-sm cursor-pointer"
            >
              Get Started
            </button>

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden w-10 h-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-[#E5E7EB] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <nav className="lg:hidden pb-5 pt-3 border-t border-white/[0.06] flex flex-col gap-3 text-sm font-medium text-[#D1D5DB]">
            <div className="flex items-center justify-between pb-1">
              <MindLogo size="sm" showWordmark={true} />
            </div>
            <a
              href="#hero"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#E7C45D] py-1.5"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1.5"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1.5"
            >
              About
            </a>
            <a
              href="#replay-preview"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1.5"
            >
              Memory Replay
            </a>
            <a
              href="/film"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E7C45D] py-1.5"
            >
              Launch Film
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1.5"
            >
              FAQ
            </a>

            <div className="pt-2 border-t border-white/[0.08]">
              <ThemeToggle variant="sidebar" showLabel />
            </div>
          </nav>
        )}
      </header>

      {/* =====================================================================
          1. UNIFIED FULL-BLEED CINEMATIC HERO STAGE
         ===================================================================== */}
      <section
        id="hero"
        className={`relative w-full min-h-[680px] lg:min-h-[760px] xl:min-h-[810px] flex items-center overflow-hidden pt-20 md:pt-22 transition-colors duration-200 ${
          isLight ? 'bg-[#FAF9F5]' : 'bg-[#080808]'
        }`}
      >
        {/* Ambient Signature Gold Aura & Sweeping Vector Light Trails (Active in Dark Mode) */}
        {!isLight && (
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            <div className="hero-ambient-dark absolute top-[10%] left-[-8%] w-[680px] h-[560px] bg-[radial-gradient(ellipse_at_center,rgba(198,152,42,0.11)_0%,rgba(8,8,8,0)_70%)] blur-3xl" />
            <div className="hero-ambient-dark absolute top-[4%] right-[-4%] w-[860px] h-[720px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.20)_0%,rgba(180,130,25,0.08)_44%,rgba(8,8,8,0)_72%)] blur-3xl" />
            <div className="hero-ambient-dark hidden lg:block absolute top-[48.5%] left-[12%] right-[6%] h-14 bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent blur-2xl" />

            <svg
              viewBox="0 0 1600 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
              className="w-full h-full opacity-95"
            >
              <defs>
                <linearGradient id="heroSweepBottom" x1="15%" y1="95%" x2="95%" y2="65%">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity="0" />
                  <stop offset="32%" stopColor="#D4AF37" stopOpacity="0.32" />
                  <stop offset="68%" stopColor="#F8E296" stopOpacity="0.68" />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                </linearGradient>
                <filter id="goldSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path
                d="M 240,892 C 590,856 935,788 1340,668"
                stroke="url(#heroSweepBottom)"
                strokeWidth="1.75"
                filter="url(#goldSoftGlow)"
              />
              <path
                d="M 370,906 C 700,866 1025,802 1410,688"
                stroke="url(#heroSweepBottom)"
                strokeWidth="0.9"
                opacity="0.7"
              />
            </svg>
          </div>
        )}

        {/* DESKTOP FULL-BLEED INTEGRATED LAPTOP SCENE */}
        <div
          onClick={onLaunchApp}
          title="Click to launch Mind Interactive Dashboard"
          className="hidden lg:flex items-center justify-end absolute inset-y-0 right-[-4%] xl:right-[-2%] w-[88%] xl:w-[85%] max-w-[1560px] z-10 cursor-pointer group select-none"
        >
          <div className="relative w-full h-full flex items-center justify-end animate-float-subtle">
            <Image
              src={activeHeroImage}
              alt="Mind Financial Intelligence Agent Interface"
              loading="eager"
              fetchPriority="high"
              quality={95}
              sizes="(min-width: 1024px) 85vw, 100vw"
              className="w-full h-auto max-h-[860px] object-contain object-right scale-[1.06] xl:scale-[1.08] origin-right transition-transform duration-700 ease-out group-hover:scale-[1.095]"
            />

            <div className="gold-glass-plaque absolute bottom-[20%] xl:bottom-[21%] right-[6.5%] xl:right-[7.5%] px-6 py-4.5 rounded-2xl min-w-[260px] max-w-[295px] transition-all duration-500 group-hover:translate-y-[-3px] group-hover:border-[#F5D76E]/60 z-20">
              <div className="absolute -top-px left-6 right-10 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/80 to-transparent" />
              <div className="flex items-center justify-between mb-2">
                <MindLogo size="sm" />
                <Sparkles className="w-3.5 h-3.5 text-[#E7C45D]/85" />
              </div>
              <p
                className={`text-[13px] font-normal leading-snug tracking-[-0.01em] ${
                  isLight ? 'text-[#374151]' : 'text-[#D1D5DB]'
                }`}
              >
                Your goals, your money,
                <br />
                <span className={isLight ? 'text-[#946F14] font-semibold' : 'text-[#F5E6B8] font-medium'}>
                  our focus.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* FOREGROUND CONTENT CONTAINER */}
        <div className="relative z-20 max-w-7xl mx-auto w-full px-6 md:px-14 lg:px-16 pt-10 pb-16 lg:py-20 pointer-events-none">
          <div className="max-w-xl lg:max-w-[540px] text-left space-y-6 pointer-events-auto">
            <Reveal animation="fade-up" delayMs={40}>
              <p className="text-sm md:text-[15px] font-medium tracking-wide">
                <span className={isLight ? 'text-[#946F14] font-semibold' : 'text-[#E7C45D] font-semibold'}>
                  Smarter
                </span>{' '}
                <span className={isLight ? 'text-[#374151]' : 'text-[#D1D5DB]'}>money. Bigger goals.</span>
              </p>
            </Reveal>

            <Reveal animation="fade-up" delayMs={120}>
              <h1
                className={`text-4xl sm:text-5xl lg:text-[58px] font-sora font-bold tracking-[-0.03em] leading-[1.08] ${
                  isLight ? 'text-[#111827]' : 'text-[#F7F7F5]'
                }`}
              >
                Your financial life,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E2BE52] via-[#F7DF94] to-[#C99E2C] drop-shadow-[0_4px_24px_rgba(212,175,55,0.22)]">
                  remembered.
                </span>
              </h1>
            </Reveal>

            <Reveal animation="fade-up" delayMs={200}>
              <p
                className={`text-[15px] sm:text-base lg:text-[17px] font-inter leading-[1.65] max-w-[490px] ${
                  isLight ? 'text-[#4B5563]' : 'text-[#9CA3AF]'
                }`}
              >
                Mind is an AI financial agent that tracks your onchain activity, understands your goals, and learns from your decisions — over time.
              </p>
            </Reveal>

            <Reveal animation="fade-up" delayMs={280}>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={onLaunchApp}
                  className="btn-gold-primary inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-semibold text-sm cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                </button>

                <a
                  href="#features"
                  className={`btn-gold-secondary inline-flex items-center justify-center px-8 py-3.5 rounded-full font-medium text-sm ${
                    isLight ? 'text-[#111827]' : 'text-[#F5F5F5]'
                  }`}
                >
                  Learn More
                </a>

                <a
                  href="/film"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full font-medium text-sm text-[#E7C45D] hover:text-[#FFF0B3] transition-colors"
                >
                  <span className="relative flex w-7 h-7 items-center justify-center rounded-full border border-[#D4AF37]/60">
                    <span className="absolute inset-0 rounded-full border border-[#D4AF37]/40 animate-ping" />
                    <span className="ml-0.5 w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-[#E7C45D]" />
                  </span>
                  Watch the film
                </a>
              </div>
            </Reveal>

            {/* MOBILE / TABLET SEAMLESS LAPTOP STAGE */}
            <div
              onClick={onLaunchApp}
              className="lg:hidden relative -mx-6 sm:-mx-10 pt-4 pb-6 cursor-pointer"
            >
              <div className="relative w-full">
                <Image
                  src={activeHeroImage}
                  alt="Mind Financial Intelligence Agent Interface"
                  loading="eager"
                  quality={92}
                  sizes="100vw"
                  className="w-full h-auto object-contain hero-scene-mask scale-110 sm:scale-105"
                />
                <div className="gold-glass-plaque absolute bottom-2 right-6 sm:right-10 px-4 py-3 rounded-xl max-w-[230px]">
                  <div className="flex items-center justify-between mb-1">
                    <MindLogo size="sm" />
                    <Sparkles className="w-3 h-3 text-[#E7C45D]/80" />
                  </div>
                  <p className={`text-[11px] leading-snug ${isLight ? 'text-[#374151]' : 'text-[#D1D5DB]'}`}>
                    Your goals, your money,{' '}
                    <span className={isLight ? 'text-[#946F14] font-semibold' : 'text-[#F5E6B8]'}>
                      our focus.
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Proof Columns */}
            <Reveal animation="fade-up" delayMs={360}>
              <div className="pt-8 lg:pt-12 grid grid-cols-3 gap-4 sm:gap-7 max-w-[500px]">
                <div className="space-y-1">
                  <span
                    className={`text-xs sm:text-[13px] font-semibold block tracking-[-0.01em] ${
                      isLight ? 'text-[#111827]' : 'text-[#F5F5F5]'
                    }`}
                  >
                    Real Onchain Data
                  </span>
                  <span className={`text-[11px] sm:text-xs block ${isLight ? 'text-[#6B7280]' : 'text-[#8E939E]'}`}>
                    via Tatum
                  </span>
                </div>

                <div
                  className={`space-y-1 border-l pl-4 sm:pl-6 ${
                    isLight ? 'border-black/[0.12]' : 'border-white/[0.12]'
                  }`}
                >
                  <span
                    className={`text-xs sm:text-[13px] font-semibold block tracking-[-0.01em] ${
                      isLight ? 'text-[#111827]' : 'text-[#F5F5F5]'
                    }`}
                  >
                    Persistent Memory
                  </span>
                  <span className={`text-[11px] sm:text-xs block ${isLight ? 'text-[#6B7280]' : 'text-[#8E939E]'}`}>
                    via Walrus
                  </span>
                </div>

                <div
                  className={`space-y-1 border-l pl-4 sm:pl-6 ${
                    isLight ? 'border-black/[0.12]' : 'border-white/[0.12]'
                  }`}
                >
                  <span
                    className={`text-xs sm:text-[13px] font-semibold block tracking-[-0.01em] ${
                      isLight ? 'text-[#111827]' : 'text-[#F5F5F5]'
                    }`}
                  >
                    Smarter Decisions
                  </span>
                  <span className={`text-[11px] sm:text-xs block ${isLight ? 'text-[#6B7280]' : 'text-[#8E939E]'}`}>
                    Every Session
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. THE CONTINUOUS INTELLIGENCE LOOP (Luxury Smoked-Obsidian Cards)
         ===================================================================== */}
      <section
        id="how-it-works"
        className="py-24 px-6 md:px-14 lg:px-16 max-w-7xl mx-auto w-full text-left relative"
      >
        {/* Specular Golden Horizon Section Divider */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[75%] h-px bg-gradient-to-r from-transparent via-[#D4AF37]/35 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[38%] h-12 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12)_0%,transparent_70%)] pointer-events-none" />

        <Reveal animation="fade-up">
          <div className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#17140D] border border-[#D4AF37]/30 text-[11px] font-mono uppercase tracking-[0.16em] text-[#E7C45D]">
                <Sparkles className="w-3 h-3" />
                <span>How Mind Operates</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-sora font-bold text-white mt-3.5 tracking-tight">
                The Continuous{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E2BE52] via-[#F7DF94] to-[#C99E2C]">
                  Intelligence Loop
                </span>
              </h2>
              <p className="text-sm md:text-[15px] text-[#9CA3AF] mt-3 leading-relaxed">
                Traditional wallets show static numbers. Generic AI chats forget your goals the moment you close the tab. Mind bridges live chain state with permanent user memory.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="relative">
          {/* Subtle Horizontal Golden Stream Line Connecting the 4 Cards on Desktop */}
          <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/25 to-transparent -translate-y-1/2 pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {loopSteps.map((item, idx) => {
              const StepIcon = item.icon;
              return (
                <Reveal key={item.num} animation="pop" delayMs={idx * 110}>
                  <div className="mind-luxury-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group h-full">
                    {/* Top Specular Champagne-Gold Hairline */}
                    <div className="absolute -top-px left-7 right-7 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/65 to-transparent" />
                    <div className="absolute -top-16 -right-16 w-36 h-36 bg-[radial-gradient(circle,rgba(212,175,55,0.14)_0%,transparent_70%)] opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#231D10] to-[#110F0A] border border-[#D4AF37]/40 shadow-[inset_0_1px_0_rgba(255,240,185,0.25)] flex items-center justify-center text-[#E7C45D] group-hover:scale-105 transition-transform">
                          <StepIcon className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#15130D] border border-[#D4AF37]/25 font-mono text-[10px] tracking-[0.14em] text-[#F5D76E]">
                          {item.num} • {item.phase}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        <h3 className="text-lg font-semibold text-white font-sora tracking-tight group-hover:text-[#F8E296] transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-[#9CA3AF] leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 mt-6 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-[#8E939E] relative z-10">
                      <span className="truncate">{item.tag}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E7C45D]/70 shrink-0" />
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. CORE CAPABILITIES — BESPOKE INTERACTIVE SHOWCASE CARDS
         ===================================================================== */}
      <section
        id="features"
        className="py-24 px-6 md:px-14 lg:px-16 max-w-7xl mx-auto w-full text-left relative"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[75%] h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />

        <Reveal animation="fade-up">
          <div className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#17140D] border border-[#D4AF37]/30 text-[11px] font-mono uppercase tracking-[0.16em] text-[#E7C45D]">
                <Activity className="w-3 h-3" />
                <span>Core Capabilities</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-sora font-bold text-white mt-3.5 tracking-tight">
                Everything for Your{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E2BE52] via-[#F7DF94] to-[#C99E2C]">
                  Sui Portfolio
                </span>
              </h2>
            </div>

            <button
              onClick={onLaunchApp}
              className="btn-gold-secondary px-5 py-2.5 rounded-full text-xs md:text-sm text-[#F8E296] flex items-center gap-2 font-semibold cursor-pointer self-start md:self-auto"
            >
              <span>Open Full App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
          {/* FEATURE CARD 1: WALLET INTELLIGENCE */}
          <Reveal animation="fade-up" delayMs={60}>
            <div
              onClick={() => onExploreFeatures('wallet')}
              className="mind-luxury-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer relative overflow-hidden group h-full"
            >
              <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
              <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-[radial-gradient(circle,rgba(212,175,55,0.12)_0%,transparent_70%)] pointer-events-none" />

              <div>
                {/* Mini Smoked-Glass UI Preview Matching Screen 3 */}
                <div className="rounded-2xl bg-[#0B0B0B]/95 border border-white/[0.07] group-hover:border-[#D4AF37]/30 p-4 mb-6 transition-colors">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#8E939E] mb-3">
                    <span>TOKEN &amp; FLOW METRICS</span>
                    <span className="text-[#E7C45D]">7D • 30D • 90D</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    {/* Mini Donut SVG */}
                    <div className="flex items-center gap-3">
                      <svg className="w-12 h-12 -rotate-90 shrink-0" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#1F1F1F" strokeWidth="4.5" />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#E7C45D"
                          strokeWidth="4.5"
                          strokeDasharray="50 88"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#2CCD9A"
                          strokeWidth="4.5"
                          strokeDasharray="24 88"
                          strokeDashoffset="-52"
                        />
                      </svg>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5 text-white font-medium">
                          <span className="w-2 h-2 rounded-full bg-[#E7C45D]" />
                          <span>SUI 52%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                          <span className="w-2 h-2 rounded-full bg-[#2CCD9A]" />
                          <span>USDC 24%</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini Golden Activity Bars */}
                    <div className="flex items-end gap-1.5 h-11 pr-1">
                      {[38, 65, 48, 86, 58, 95, 72].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className="w-2 rounded-full bg-gradient-to-t from-[#8C6D14] via-[#D4AF37] to-[#FFF0B3]"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#231D10] to-[#110F0A] border border-[#D4AF37]/40 flex items-center justify-center text-[#E7C45D]">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-semibold text-white font-sora group-hover:text-[#F8E296] transition-colors">
                    Wallet Intelligence
                  </h3>
                </div>

                <p className="text-xs sm:text-[13px] text-[#9CA3AF] leading-relaxed">
                  Deep token concentration rings, 7D/30D/90D transaction cadence charts, and one-click SuiVision explorer verification powered by Tatum RPC.
                </p>
              </div>

              <div className="pt-5 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-[#E7C45D]">
                <span>Explore Wallet Analytics</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Reveal>

          {/* FEATURE CARD 2: ASK MIND */}
          <Reveal animation="fade-up" delayMs={160}>
            <div
              onClick={() => onExploreFeatures('ask')}
              className="mind-luxury-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer relative overflow-hidden group h-full"
            >
              <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
              <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-[radial-gradient(circle,rgba(212,175,55,0.12)_0%,transparent_70%)] pointer-events-none" />

              <div>
                {/* Mini Smoked-Glass UI Preview Matching Screen 4 */}
                <div className="rounded-2xl bg-[#0B0B0B]/95 border border-white/[0.07] group-hover:border-[#D4AF37]/30 p-4 mb-6 space-y-2.5 transition-colors">
                  <div className="flex justify-end">
                    <span className="px-2.5 py-1 rounded-xl bg-white/[0.06] text-[10px] text-[#E5E7EB]">
                      Take profit on SUI or keep holding?
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#1A160C] border border-[#D4AF37]/35 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#F8E296]">
                      <Sparkles className="w-3 h-3 text-[#E7C45D]" />
                      <span>Lock 30–50% gains into USDC reserve</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[9px] text-[#E7C45D]">
                        Savings goal
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[9px] text-[#E7C45D]">
                        Risk preference
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#231D10] to-[#110F0A] border border-[#D4AF37]/40 flex items-center justify-center text-[#E7C45D]">
                    <Brain className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-semibold text-white font-sora group-hover:text-[#F8E296] transition-colors">
                    Ask Mind AI
                  </h3>
                </div>

                <p className="text-xs sm:text-[13px] text-[#9CA3AF] leading-relaxed">
                  Conversational guidance grounded in your live Sui balances and recalled Walrus memories—complete with explicit provenance tags and honest uncertainty.
                </p>
              </div>

              <div className="pt-5 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-[#E7C45D]">
                <span>Ask Mind a Question</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Reveal>

          {/* FEATURE CARD 3: MEMORY REPLAY */}
          <Reveal animation="fade-up" delayMs={260}>
            <div
              onClick={() => onExploreFeatures('replay')}
              className="mind-luxury-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer relative overflow-hidden group h-full"
            >
              <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
              <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-[radial-gradient(circle,rgba(212,175,55,0.12)_0%,transparent_70%)] pointer-events-none" />

              <div>
                {/* Mini Smoked-Glass UI Preview Matching Screen 6 */}
                <div className="rounded-2xl bg-[#0B0B0B]/95 border border-white/[0.07] group-hover:border-[#D4AF37]/30 p-4 mb-6 transition-colors">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#8E939E] mb-2.5">
                    <span>CONTROLLED SNAPSHOT</span>
                    <span className="text-[#2CCD9A]">A/B VERIFIED</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                      <span className="text-[9px] font-mono text-[#6B7280] block">GENERIC</span>
                      <p className="text-[10px] text-[#9CA3AF] leading-tight">
                        Hold momentum if comfortable.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1D180C] border border-[#D4AF37]/45 space-y-1">
                      <span className="text-[9px] font-mono text-[#F8E296] block">WITH WALRUS</span>
                      <p className="text-[10px] text-white font-medium leading-tight">
                        Protect $5k USDC goal first.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#231D10] to-[#110F0A] border border-[#D4AF37]/40 flex items-center justify-center text-[#E7C45D]">
                    <History className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-semibold text-white font-sora group-hover:text-[#F8E296] transition-colors">
                    Memory Replay
                  </h3>
                </div>

                <p className="text-xs sm:text-[13px] text-[#9CA3AF] leading-relaxed">
                  Run side-by-side evaluations on the exact same onchain evidence snapshot to prove how persistent Walrus context elevates financial decisions.
                </p>
              </div>

              <div className="pt-5 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-[#E7C45D]">
                <span>Launch Replay Comparison</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* =====================================================================
          4. MEMORY REPLAY EXECUTIVE SHOWCASE STAGE
         ===================================================================== */}
      <section
        id="replay-preview"
        className="py-24 px-6 md:px-14 lg:px-16 max-w-7xl mx-auto w-full text-left relative"
      >
        <Reveal animation="zoom-in" durationMs={800}>
          <div className="gold-glass-plaque rounded-[32px] p-7 sm:p-10 md:p-14 relative overflow-hidden">
            <div className="absolute -top-px left-14 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/85 to-transparent" />
            <div className="absolute -top-32 -right-24 w-[480px] h-[480px] bg-[radial-gradient(circle,rgba(212,175,55,0.18)_0%,transparent_70%)] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-24 w-[420px] h-[420px] bg-[radial-gradient(circle,rgba(212,175,55,0.10)_0%,transparent_70%)] blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 relative z-10">
              <div className="max-w-2xl space-y-2.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C170B] border border-[#D4AF37]/35 text-[11px] font-mono uppercase tracking-[0.16em] text-[#F8E296]">
                  <Sparkles className="w-3 h-3" />
                  <span>The Total Recall Differentiator</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-sora font-bold text-white tracking-tight">
                  See How Memory Changes Decisions
                </h2>
                <p className="text-xs sm:text-sm text-[#9CA3AF]">
                  Identical Tatum Sui Mainnet snapshot evaluated twice—proving remembered context transforms generic commentary into tailored strategy.
                </p>
              </div>

              <button
                onClick={() => onExploreFeatures('replay')}
                className="btn-gold-primary px-7 py-3.5 rounded-full font-semibold text-xs sm:text-sm inline-flex items-center gap-2 self-start lg:self-auto shrink-0 cursor-pointer"
              >
                <span>Run Live Replay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Prompt Context Bar (Matching Screen 6 in Reference Sheet) */}
            <div className="mb-6 p-3.5 sm:px-5 rounded-2xl bg-[#0B0B0B]/90 border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3 text-xs sm:text-sm">
                <span className="text-[#8E939E] font-mono text-[11px] uppercase tracking-wider">
                  Selected Analysis:
                </span>
                <span className="text-white font-medium">
                  &ldquo;Should I keep holding SUI or take some profit?&rdquo;
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#E7C45D]">
                Snapshot • Sui Mainnet RPC
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
              {/* Baseline Generic Card */}
              <Reveal animation="slide-left" delayMs={100} durationMs={650}>
                <div className="p-6 sm:p-7 rounded-2xl bg-[#0E0E0E]/95 border border-white/[0.08] flex flex-col justify-between space-y-5 h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#D1D5DB] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#6B7280]" />
                        Without Remembered Context
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.05] text-[10px] font-mono text-[#9CA3AF]">
                        Generic Analysis
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                      &ldquo;SUI shows strong short-term upward momentum (+12.4%) with active DEX volume. Market indicators suggest potential continuation; consider holding if you are comfortable with volatility.&rdquo;
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-1.5 text-xs text-[#6B7280]">
                    <p>• Sees positive price momentum &amp; onchain volume</p>
                    <p>• Blind to your $5,000 emergency reserve &amp; 20% profit rule</p>
                  </div>
                </div>
              </Reveal>

              {/* Personalized Walrus Context Card */}
              <Reveal animation="slide-right" delayMs={200} durationMs={650}>
                <div className="relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#231D0E] via-[#15120A] to-[#0E0D09] border border-[#D4AF37]/55 shadow-[inset_0_1px_0_rgba(255,240,185,0.28),0_0_40px_-10px_rgba(212,175,55,0.25)] flex flex-col justify-between space-y-5 h-full">
                  <div className="animate-laser-sweep pointer-events-none opacity-30" />
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#FFF0B3] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E7C45D] shadow-[0_0_8px_#E7C45D] animate-pulse-ring" />
                        With Remembered Context
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[10px] font-mono text-[#F8E296]">
                        Personalized Analysis
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#F7F7F5] font-medium leading-relaxed">
                      &ldquo;Given your $5,000 emergency savings goal and conservative baseline, lock in partial profits (30–50%) into USDC now. This secures your target reserve and protects against sharp reversals.&rdquo;
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#D4AF37]/25 space-y-3 relative z-10">
                    <div className="flex items-center gap-2 text-xs text-[#E5E7EB]">
                      <Check className="w-3.5 h-3.5 text-[#E7C45D] shrink-0" />
                      <span>Aligns directly with your recalled Walrus memories:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#F8E296]">
                      <span className="px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35">
                        Savings goal ($5,000)
                      </span>
                      <span className="px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35">
                        Risk preference
                      </span>
                      <span className="px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35">
                        Past swap outcome
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </section>

      {/* =====================================================================
          5. FAQ SECTION (Smoked-Obsidian Luxury Accordions)
         ===================================================================== */}
      <section
        id="faq"
        className="py-24 px-6 md:px-14 lg:px-16 max-w-4xl mx-auto w-full text-left relative"
      >
        <Reveal animation="fade-up">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#17140D] border border-[#D4AF37]/30 text-[11px] font-mono uppercase tracking-[0.16em] text-[#E7C45D]">
              <span>Got Questions?</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-sora font-bold text-white mt-3 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>
        </Reveal>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <Reveal key={idx} animation="fade-up" delayMs={idx * 60}>
                <div
                  className={`rounded-2xl transition-all duration-300 relative overflow-hidden ${
                    isOpen
                      ? 'gold-glass-plaque'
                      : 'bg-[#101010]/90 border border-white/[0.08] hover:border-[#D4AF37]/35'
                  }`}
                >
                  {isOpen && (
                    <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
                  )}
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between text-sm sm:text-[15px] font-semibold text-white hover:text-[#F8E296] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-4 border transition-all ${
                        isOpen
                          ? 'bg-[#262010] border-[#D4AF37]/50 text-[#F8E296] rotate-180'
                          : 'bg-white/[0.03] border-white/[0.08] text-[#8E939E]'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 text-xs sm:text-[13px] text-[#B0B6C1] leading-relaxed border-t border-white/[0.06] pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          6. GRAND EXECUTIVE BOTTOM CTA
         ===================================================================== */}
      <section className="py-20 px-6 md:px-14 lg:px-16 max-w-6xl mx-auto w-full">
        <Reveal animation="pop">
          <div className="gold-glass-plaque rounded-[32px] px-6 py-16 sm:px-14 sm:py-20 text-center relative overflow-hidden">
            <div className="absolute -top-px left-16 right-16 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/85 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.16)_0%,transparent_65%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <MindLogo size="md" framed showWordmark={false} className="mb-6" />
              <h2 className="text-3xl sm:text-4xl font-sora font-bold text-white mb-4 tracking-tight max-w-2xl">
                Ready to Experience Your Financial Life,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E2BE52] via-[#F7DF94] to-[#C99E2C]">
                  Remembered?
                </span>
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] mb-8 max-w-xl mx-auto leading-relaxed">
                Enter Mind, connect your Sui wallet inside the app to create your permanent account, and unlock personalized intelligence powered by Tatum &amp; Walrus.
              </p>
              <button
                onClick={onLaunchApp}
                className="btn-gold-primary px-9 py-4 rounded-full font-semibold text-sm inline-flex items-center gap-2.5 cursor-pointer"
              >
                <span>Enter Mind App</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="py-9 border-t border-white/[0.07] px-6 md:px-14 lg:px-16 flex flex-col md:flex-row items-center justify-between text-xs text-[#8E939E] max-w-7xl mx-auto w-full gap-4">
        <div className="flex items-center gap-3">
          <MindLogo size="sm" />
          <span>• Personal Onchain Financial Intelligence</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[#E7C45D]">Powered by Tatum &amp; Walrus</span>
          <span>Sui Mainnet</span>
        </div>
      </footer>
    </div>
  );
};
