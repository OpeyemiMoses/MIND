'use client';

import React, { useEffect, useRef, useState } from 'react';

export type RevealAnimation = 'fade-up' | 'pop' | 'slide-left' | 'slide-right' | 'zoom-in';

interface RevealProps {
  children: React.ReactNode;
  animation?: RevealAnimation;
  delayMs?: number;
  durationMs?: number;
  className?: string;
  threshold?: number;
  once?: boolean;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  animation = 'fade-up',
  delayMs = 0,
  durationMs = 600,
  className = '',
  threshold = 0.05,
  once = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check if user prefers reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -10px 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const animationStyles: Record<RevealAnimation, { hidden: string; visible: string }> = {
    'fade-up': {
      hidden: 'opacity-0 translate-y-8 scale-[0.98]',
      visible: 'opacity-100 translate-y-0 scale-100',
    },
    pop: {
      hidden: 'opacity-0 scale-90 translate-y-4',
      visible: 'opacity-100 scale-100 translate-y-0',
    },
    'slide-left': {
      hidden: 'opacity-0 -translate-x-10',
      visible: 'opacity-100 translate-x-0',
    },
    'slide-right': {
      hidden: 'opacity-0 translate-x-10',
      visible: 'opacity-100 translate-x-0',
    },
    'zoom-in': {
      hidden: 'opacity-0 scale-95',
      visible: 'opacity-100 scale-100',
    },
  };

  const currentVariant = animationStyles[animation];

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: `${durationMs}ms`,
        transitionDelay: `${delayMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`transform transition-all will-change-[transform,opacity] ${
        isVisible ? currentVariant.visible : currentVariant.hidden
      } ${className}`}
    >
      {children}
    </div>
  );
};
