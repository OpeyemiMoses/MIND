'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'sidebar';
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  className = '',
  showLabel = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer border ${
          isDark
            ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-[#9CA3AF] hover:text-[#F8E296]'
            : 'bg-black/[0.03] hover:bg-black/[0.06] border-black/[0.08] text-[#4B5563] hover:text-[#B89025]'
        } ${className}`}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-300 ${
              isDark
                ? 'bg-[#1C1810] border border-[#D4AF37]/30 text-[#F5D76E]'
                : 'bg-[#FAF7EE] border border-[#B89025]/30 text-[#B89025]'
            }`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </div>
          {showLabel && (
            <span className="text-xs font-medium font-sora">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
        </div>
        {showLabel && (
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isDark
                ? 'bg-[#D4AF37]/15 text-[#E7C45D]'
                : 'bg-[#B89025]/15 text-[#A07817]'
            }`}
          >
            {isDark ? 'Obsidian' : 'Alabaster'}
          </span>
        )}
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
          isDark
            ? 'bg-[#14120C] border-[#D4AF37]/25 text-[#D1D5DB] hover:border-[#F5D76E]/50 hover:text-white'
            : 'bg-[#FFFFFF] border-[#B89025]/25 text-[#374151] hover:border-[#B89025]/50 hover:text-[#111827] shadow-sm'
        } ${className}`}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <>
            <Sun className="w-3.5 h-3.5 text-[#F5D76E]" />
            <span className="font-sora text-[11px]">Light Mode</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-[#B89025]" />
            <span className="font-sora text-[11px]">Dark Mode</span>
          </>
        )}
      </button>
    );
  }

  // Default 'icon' button
  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer border relative group ${
        isDark
          ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-[#E5E7EB] hover:text-[#F8E296] hover:border-[#D4AF37]/40'
          : 'bg-white hover:bg-[#FAF9F5] border-black/[0.1] text-[#374151] hover:text-[#B89025] hover:border-[#B89025]/40 shadow-sm'
      } ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="transition-transform duration-300 group-hover:rotate-12">
        {isDark ? (
          <Sun className="w-4 h-4 text-[#F5D76E]" />
        ) : (
          <Moon className="w-4 h-4 text-[#B89025]" />
        )}
      </div>
    </button>
  );
};

