import React, { useId } from 'react';
import { useTheme } from '../context/ThemeContext';
import type { ThemeId } from '../types/vectoria';

export function shouldRenderNeuralHeaderBackdrop(themeId: ThemeId): boolean {
  return themeId === 'neural-cyberpunk';
}

interface NeuralHeaderBackdropProps {
  variant?: 'sidebar-header' | 'hero-emblem';
  themeOverride?: ThemeId;
  className?: string;
}

/**
 * Fondo animado ligero de conexiones entre nodos que se renderiza y anima
 * exclusivamente cuando el tema activo es 'neural-cyberpunk'.
 * Utiliza animaciones CSS compuestas en GPU (transform y opacity) para
 * mantener el rendimiento sin impacto en los demás 5 temas.
 */
export const NeuralHeaderBackdrop: React.FC<NeuralHeaderBackdropProps> = ({
  variant = 'sidebar-header',
  themeOverride,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const { theme } = useTheme();
  const activeTheme = themeOverride ?? theme;

  if (!shouldRenderNeuralHeaderBackdrop(activeTheme)) {
    return null;
  }

  if (variant === 'hero-emblem') {
    return (
      <div
        aria-hidden="true"
        data-neural-backdrop="hero-emblem"
        className={`pointer-events-none select-none absolute inset-0 overflow-hidden ${className}`}
      >
        <svg
          viewBox="0 0 320 210"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id={`nhb-hero-${uid}`} x1="20" y1="20" x2="300" y2="190" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2f7cf6" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#d946ef" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <g className="neural-backdrop-edge-a" stroke={`url(#nhb-hero-${uid})`} strokeWidth="0.9">
            <path d="M18 46 L72 28 L126 52 L198 30 L264 56 L304 38" />
            <path d="M26 162 L88 182 L152 164 L224 184 L292 154" />
            <path d="M72 28 L88 182 M264 56 L224 184" strokeOpacity="0.35" strokeDasharray="3 4" />
          </g>
          <g className="neural-backdrop-edge-b" stroke="#22d3ee" strokeOpacity="0.28" strokeWidth="0.8">
            <path d="M18 118 L64 88 L112 110 M208 110 L256 86 L304 114" />
          </g>
          <g className="neural-backdrop-nodes">
            <circle cx="18" cy="46" r="2" fill="#22d3ee" />
            <circle cx="72" cy="28" r="2.2" fill="#2f7cf6" />
            <circle cx="198" cy="30" r="2" fill="#d946ef" />
            <circle cx="264" cy="56" r="2.2" fill="#22d3ee" />
            <circle cx="304" cy="38" r="1.8" fill="#2f7cf6" />
            <circle cx="26" cy="162" r="2" fill="#2f7cf6" />
            <circle cx="88" cy="182" r="2.2" fill="#22d3ee" />
            <circle cx="224" cy="184" r="2.2" fill="#d946ef" />
            <circle cx="292" cy="154" r="2" fill="#22d3ee" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-neural-backdrop="sidebar-header"
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 256 64"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={`nhb-bar-${uid}`} x1="0" y1="0" x2="256" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2f7cf6" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d946ef" stopOpacity="0.38" />
          </linearGradient>
        </defs>

        <g className="neural-backdrop-edge-a" stroke={`url(#nhb-bar-${uid})`} strokeWidth="0.9">
          <path d="M12 50 L44 16 L94 42 L148 14 L196 38 L244 18" />
          <path d="M22 14 L68 50 L124 26 L178 52 L232 42" strokeOpacity="0.55" />
        </g>

        <g className="neural-backdrop-edge-b" stroke="#22d3ee" strokeOpacity="0.28" strokeWidth="0.75">
          <path d="M44 16 L68 50 M94 42 L124 26 M148 14 L178 52 M196 38 L232 42" />
        </g>

        <g className="neural-backdrop-nodes">
          <circle cx="12" cy="50" r="1.8" fill="#2f7cf6" />
          <circle cx="22" cy="14" r="1.6" fill="#22d3ee" />
          <circle cx="44" cy="16" r="2.1" fill="#22d3ee" />
          <circle cx="68" cy="50" r="1.8" fill="#8b5cf6" />
          <circle cx="94" cy="42" r="2" fill="#2f7cf6" />
          <circle cx="124" cy="26" r="1.7" fill="#22d3ee" />
          <circle cx="148" cy="14" r="2.1" fill="#22d3ee" />
          <circle cx="178" cy="52" r="1.8" fill="#d946ef" />
          <circle cx="196" cy="38" r="2" fill="#2f7cf6" />
          <circle cx="232" cy="42" r="1.7" fill="#22d3ee" />
          <circle cx="244" cy="18" r="2" fill="#d946ef" />
        </g>
      </svg>
    </div>
  );
};
