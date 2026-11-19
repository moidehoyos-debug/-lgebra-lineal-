import React, { useId } from 'react';
import type { ThemeId } from '../types/vectoria';

export type VectorIALogoVariant = 'full' | 'mark' | 'app-icon' | 'favicon';
export type VectorIALogoTone = 'auto' | 'light' | 'dark' | 'mono';
export type VectorIALogoSize = 'sm' | 'md' | 'lg' | 'xl';

export interface VectorIALogoPalette {
  bg: string;
  bgSecondary: string;
  border: string;
  primary: string;
  secondary: string;
  tertiary: string;
  nodeCenter: string;
  text: string;
  sub: string;
  isMono?: boolean;
}

export const THEME_LOGO_PALETTES: Record<ThemeId, VectorIALogoPalette> = {
  'dark-purple': {
    bg: '#101018',
    bgSecondary: '#19192a',
    border: 'rgba(167, 139, 250, 0.42)',
    primary: '#8b5cf6',
    secondary: '#22d3ee',
    tertiary: '#c4b5fd',
    nodeCenter: '#f4f4f8',
    text: '#f4f4f8',
    sub: '#9b9bb8',
  },
  'light-yellow': {
    bg: '#fafaf7',
    bgSecondary: '#f3efe0',
    border: 'rgba(202, 138, 4, 0.36)',
    primary: '#b45309',
    secondary: '#0284c7',
    tertiary: '#ca8a04',
    nodeCenter: '#18181b',
    text: '#18181b',
    sub: '#52525b',
  },
  'classic-mono': {
    bg: '#ffffff',
    bgSecondary: '#f4f4f5',
    border: 'rgba(24, 24, 27, 0.28)',
    primary: '#18181b',
    secondary: '#52525b',
    tertiary: '#3f3f46',
    nodeCenter: '#09090b',
    text: '#09090b',
    sub: '#52525b',
  },
  holographic: {
    bg: '#0c1324',
    bgSecondary: '#16223e',
    border: 'rgba(56, 189, 248, 0.48)',
    primary: '#38bdf8',
    secondary: '#e879f9',
    tertiary: '#2dd4bf',
    nodeCenter: '#f8fafc',
    text: '#f8fafc',
    sub: '#94a3b8',
  },
  'black-gold': {
    bg: '#0e0d0b',
    bgSecondary: '#1b1710',
    border: 'rgba(212, 175, 55, 0.42)',
    primary: '#d4af37',
    secondary: '#f3e5ab',
    tertiary: '#c59b27',
    nodeCenter: '#faf6eb',
    text: '#faf6eb',
    sub: '#b8aa88',
  },
  'neural-cyberpunk': {
    bg: '#0e131e',
    bgSecondary: '#162033',
    border: 'rgba(34, 211, 238, 0.42)',
    primary: '#2f7cf6',
    secondary: '#22d3ee',
    tertiary: '#d946ef',
    nodeCenter: '#eef4ff',
    text: '#eef4ff',
    sub: '#8da3c8',
  },
};

export function resolveVectorIALogoPalette(
  tone: VectorIALogoTone,
  themeOverride?: ThemeId
): VectorIALogoPalette {
  if (themeOverride) {
    return THEME_LOGO_PALETTES[themeOverride];
  }
  if (tone === 'light') {
    return {
      bg: '#ffffff',
      bgSecondary: '#f8fafc',
      border: 'rgba(79, 70, 229, 0.30)',
      primary: '#4f46e5',
      secondary: '#0284c7',
      tertiary: '#6366f1',
      nodeCenter: '#0f172a',
      text: '#0f172a',
      sub: '#475569',
    };
  }
  if (tone === 'dark') {
    return {
      bg: '#09090f',
      bgSecondary: '#141524',
      border: 'rgba(167, 139, 250, 0.40)',
      primary: '#8b5cf6',
      secondary: '#22d3ee',
      tertiary: '#a78bfa',
      nodeCenter: '#f8fafc',
      text: '#f8fafc',
      sub: '#94a3b8',
    };
  }
  if (tone === 'mono') {
    return {
      bg: 'transparent',
      bgSecondary: 'transparent',
      border: 'currentColor',
      primary: 'currentColor',
      secondary: 'currentColor',
      tertiary: 'currentColor',
      nodeCenter: 'currentColor',
      text: 'currentColor',
      sub: 'currentColor',
      isMono: true,
    };
  }
  return {
    bg: 'var(--bg-elevated)',
    bgSecondary: 'var(--bg-surface)',
    border: 'var(--border-strong)',
    primary: 'var(--accent-primary)',
    secondary: 'var(--accent-secondary)',
    tertiary: 'var(--accent-magenta, var(--accent-primary))',
    nodeCenter: 'var(--text-primary)',
    text: 'var(--text-primary)',
    sub: 'var(--text-muted)',
  };
}

interface VectorIALogoProps {
  variant?: VectorIALogoVariant;
  tone?: VectorIALogoTone;
  size?: VectorIALogoSize;
  themeOverride?: ThemeId;
  className?: string;
}

export const VectorIALogo: React.FC<VectorIALogoProps> = ({
  variant = 'full',
  tone = 'auto',
  size = 'md',
  themeOverride,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const palette = resolveVectorIALogoPalette(tone, themeOverride);

  const iconDim =
    variant === 'favicon'
      ? size === 'sm'
        ? 16
        : size === 'lg'
          ? 32
          : 24
      : size === 'xl'
        ? 64
        : size === 'lg'
          ? 44
          : size === 'sm'
            ? 28
            : 34;

  const showDetailedReticle = variant === 'app-icon' || size === 'lg' || size === 'xl';
  const showContainerFrame = variant !== 'mark';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {!palette.isMono && (
          <defs>
            <linearGradient
              id={`vec-bg-${uid}`}
              x1="4"
              y1="4"
              x2="60"
              y2="60"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={palette.bgSecondary} />
              <stop offset="100%" stopColor={palette.bg} />
            </linearGradient>
            <linearGradient
              id={`vec-prim-${uid}`}
              x1="14"
              y1="16"
              x2="50"
              y2="50"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={palette.primary} />
              <stop offset="60%" stopColor={palette.secondary} />
              <stop offset="100%" stopColor={palette.tertiary} />
            </linearGradient>
            <linearGradient
              id={`vec-sec-${uid}`}
              x1="20"
              y1="18"
              x2="44"
              y2="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={palette.secondary} />
              <stop offset="100%" stopColor={palette.primary} />
            </linearGradient>
          </defs>
        )}

        {showContainerFrame && (
          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx={variant === 'app-icon' ? '16' : '14'}
            fill={palette.isMono ? 'transparent' : `url(#vec-bg-${uid})`}
            stroke={palette.isMono ? 'currentColor' : palette.border}
            strokeOpacity={palette.isMono ? '0.38' : '0.85'}
            strokeWidth={variant === 'favicon' ? '2.5' : '1.8'}
          />
        )}

        {showDetailedReticle && showContainerFrame && (
          <>
            <rect
              x="6.5"
              y="6.5"
              width="51"
              height="51"
              rx="11"
              stroke={palette.secondary}
              strokeOpacity="0.16"
              strokeWidth="0.9"
            />
            {variant === 'app-icon' && (
              <circle
                cx="32"
                cy="32"
                r="21.5"
                stroke={palette.primary}
                strokeOpacity="0.22"
                strokeWidth="0.9"
                strokeDasharray="2.5 2.5"
              />
            )}
          </>
        )}

        {variant !== 'favicon' && (
          <path
            d="M11 15H15M49 15H53M11 49H15M49 49H53"
            stroke={palette.secondary}
            strokeOpacity={palette.isMono ? '0.28' : '0.32'}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        )}

        {/* Cross-layer synaptic vectors */}
        <line
          x1="15"
          y1="17"
          x2="42"
          y2="21"
          stroke={palette.secondary}
          strokeOpacity="0.45"
          strokeWidth={variant === 'favicon' ? '1.8' : '1.5'}
        />
        <line
          x1="49"
          y1="17"
          x2="22"
          y2="21"
          stroke={palette.secondary}
          strokeOpacity="0.45"
          strokeWidth={variant === 'favicon' ? '1.8' : '1.5'}
        />
        <line
          x1="32"
          y1="37"
          x2="32"
          y2="49"
          stroke={palette.primary}
          strokeOpacity="0.52"
          strokeWidth="1.4"
        />

        {/* Outer geometric V */}
        <path
          d="M15 17L32 49L49 17"
          stroke={palette.isMono ? 'currentColor' : `url(#vec-prim-${uid})`}
          strokeWidth={variant === 'favicon' ? '5' : '4.5'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner neural V */}
        <path
          d="M22 21L32 37L42 21"
          stroke={palette.isMono ? 'currentColor' : `url(#vec-sec-${uid})`}
          strokeWidth={variant === 'favicon' ? '2.8' : '2.4'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Neural nodes */}
        {showDetailedReticle && (
          <>
            <circle cx="15" cy="17" r="6" fill="none" stroke={palette.secondary} strokeOpacity="0.28" strokeWidth="1" />
            <circle cx="49" cy="17" r="6" fill="none" stroke={palette.secondary} strokeOpacity="0.28" strokeWidth="1" />
            <circle cx="32" cy="49" r="6.5" fill="none" stroke={palette.primary} strokeOpacity="0.32" strokeWidth="1" />
          </>
        )}
        <circle cx="15" cy="17" r="3.8" fill={palette.secondary} />
        <circle cx="49" cy="17" r="3.8" fill={palette.secondary} />
        <circle cx="22" cy="21" r="2.6" fill={palette.primary} />
        <circle cx="42" cy="21" r="2.6" fill={palette.primary} />
        <circle cx="32" cy="37" r="2.8" fill={palette.nodeCenter} />
        <circle cx="32" cy="49" r="4.2" fill={palette.primary} />
        {!palette.isMono && <circle cx="32" cy="49" r="1.6" fill={palette.nodeCenter} />}
      </svg>

      {variant === 'full' && (
        <div className="leading-tight whitespace-nowrap">
          <div
            className={`font-bold tracking-tight ${
              size === 'xl'
                ? 'text-xl'
                : size === 'lg'
                  ? 'text-lg'
                  : size === 'sm'
                    ? 'text-sm'
                    : 'text-base'
            }`}
            style={{ color: palette.text }}
          >
            VectorIA Studio
          </div>
          {(size === 'lg' || size === 'xl') && (
            <div className="text-[11px] font-medium" style={{ color: palette.sub }}>
              Álgebra Lineal · Redes Neuronales
            </div>
          )}
        </div>
      )}
    </div>
  );
};
