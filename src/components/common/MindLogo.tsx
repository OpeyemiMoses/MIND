import React, { useId } from 'react';

interface MindLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  showTagline?: boolean;
  framed?: boolean;
  className?: string;
}

export const MindLogo: React.FC<MindLogoProps> = ({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  framed = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');

  const pixelSizes = {
    sm: { icon: 24, box: 34, font: 'text-lg', sub: 'text-[9px]', gap: 'gap-2.5' },
    md: { icon: 30, box: 42, font: 'text-[22px]', sub: 'text-[10px]', gap: 'gap-3' },
    lg: { icon: 42, box: 56, font: 'text-3xl', sub: 'text-xs', gap: 'gap-3.5' },
    xl: { icon: 56, box: 72, font: 'text-4xl', sub: 'text-sm', gap: 'gap-4' },
  }[size];

  const iconSvg = (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full drop-shadow-[0_4px_14px_rgba(212,175,55,0.32)]"
    >
      <defs>
        <linearGradient id={`mindGoldLeft-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBE69B" />
          <stop offset="48%" stopColor="#D9B343" />
          <stop offset="100%" stopColor="#947114" />
        </linearGradient>
        <linearGradient id={`mindGoldCenter-${uid}`} x1="0%" y1="15%" x2="100%" y2="85%">
          <stop offset="0%" stopColor="#A67F1A" />
          <stop offset="50%" stopColor="#E6C35C" />
          <stop offset="100%" stopColor="#FFF0B3" />
        </linearGradient>
        <linearGradient id={`mindGoldRight-${uid}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFF1B8" />
          <stop offset="45%" stopColor="#E2BE52" />
          <stop offset="100%" stopColor="#9E7916" />
        </linearGradient>
      </defs>

      {/* Left Isometric Vertical Ribbon */}
      <path
        d="M 16,26 L 34,15 L 34,84 L 16,72 Z"
        fill={`url(#mindGoldLeft-${uid})`}
      />

      {/* Center Folded Isometric Bridge */}
      <path
        d="M 34,36 L 51,49 L 66,33 L 66,54 L 50,70 L 34,57 Z"
        fill={`url(#mindGoldCenter-${uid})`}
      />

      {/* Right Taller Isometric Vertical Ribbon */}
      <path
        d="M 66,21 L 85,10 L 85,79 L 66,91 Z"
        fill={`url(#mindGoldRight-${uid})`}
      />
    </svg>
  );

  return (
    <div className={`inline-flex items-center ${pixelSizes.gap} select-none ${className}`}>
      {framed ? (
        <div
          className="relative flex items-center justify-center shrink-0 rounded-xl bg-[#0D0D0D]/90 border border-[#D4AF37]/40 shadow-[inset_0_1px_0_rgba(245,215,110,0.22),0_4px_16px_rgba(0,0,0,0.6)]"
          style={{ width: pixelSizes.box, height: pixelSizes.box }}
        >
          <div style={{ width: pixelSizes.icon * 0.72, height: pixelSizes.icon * 0.72 }}>
            {iconSvg}
          </div>
        </div>
      ) : (
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: pixelSizes.icon, height: pixelSizes.icon }}
        >
          {iconSvg}
        </div>
      )}

      {showWordmark && (
        <div className="flex flex-col">
          <span
            className={`font-sora font-bold tracking-[-0.02em] text-[#F7F3E8] leading-none ${pixelSizes.font}`}
            style={{ fontFamily: 'var(--font-sora), sans-serif' }}
          >
            Mind
          </span>
          {showTagline && (
            <span
              className={`font-inter text-[#9CA3AF] tracking-[0.22em] uppercase font-medium mt-1.5 ${pixelSizes.sub}`}
            >
              Your financial intelligence agent
            </span>
          )}
        </div>
      )}
    </div>
  );
};
