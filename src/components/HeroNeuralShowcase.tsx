import React, { useId } from 'react';
import { useTheme } from '../context/ThemeContext';
import { NeuralHeaderBackdrop } from './NeuralHeaderBackdrop';
import { THEME_LOGO_PALETTES } from './VectorIALogo';

interface HeroNeuralShowcaseProps {
  compact?: boolean;
  className?: string;
}

/**
 * Composición visual matemática-neuronal para aprovechar el espacio lateral del
 * encabezado principal. Integra la red neuronal tridimensional, ejes vectoriales,
 * anillos holográficos discretos y el símbolo V ampliado de VectorIA Studio,
 * adaptándose automáticamente a los 6 temas visuales.
 */
export const HeroNeuralShowcase: React.FC<HeroNeuralShowcaseProps> = ({
  compact = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const { theme } = useTheme();
  const palette = THEME_LOGO_PALETTES[theme];
  const isLightTheme = theme === 'light-yellow' || theme === 'classic-mono';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none relative flex items-center justify-center ${className}`}
    >
      <NeuralHeaderBackdrop variant="hero-emblem" />
      <svg
        viewBox={compact ? '20 12 280 184' : '0 0 320 210'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full h-auto overflow-visible"
      >
        <defs>
          <radialGradient
            id={`hero-aura-${uid}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop
              offset="0%"
              stopColor={palette.secondary}
              stopOpacity={isLightTheme ? '0.14' : '0.22'}
            />
            <stop
              offset="55%"
              stopColor={palette.primary}
              stopOpacity={isLightTheme ? '0.07' : '0.12'}
            />
            <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
          </radialGradient>

          <linearGradient
            id={`hero-v-grad-${uid}`}
            x1="104"
            y1="52"
            x2="216"
            y2="156"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={palette.primary} />
            <stop offset="52%" stopColor={palette.secondary} />
            <stop offset="100%" stopColor={palette.tertiary} />
          </linearGradient>

          <linearGradient
            id={`hero-holo-ring-${uid}`}
            x1="46"
            y1="40"
            x2="274"
            y2="170"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.6" />
            <stop offset="50%" stopColor={palette.primary} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.tertiary} stopOpacity="0.6" />
          </linearGradient>

          <marker
            id={`vec-arrow-${uid}`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 1 2 L 8 5 L 1 8 z" fill={palette.secondary} fillOpacity="0.7" />
          </marker>
        </defs>

        {/* Subtle ambient holographic field */}
        <ellipse cx="160" cy="105" rx="126" ry="82" fill={`url(#hero-aura-${uid})`} />

        {/* Isometric R^3 Mathematical Basis Plane */}
        <g opacity={isLightTheme ? '0.45' : '0.35'}>
          <polygon
            points="160,34 268,94 160,154 52,94"
            stroke={palette.border}
            strokeWidth="1"
            fill={palette.bgSecondary}
            fillOpacity={isLightTheme ? '0.35' : '0.28'}
          />
          <line x1="106" y1="64" x2="214" y2="124" stroke={palette.primary} strokeOpacity="0.28" strokeWidth="0.9" />
          <line x1="214" y1="64" x2="106" y2="124" stroke={palette.primary} strokeOpacity="0.28" strokeWidth="0.9" />
          <line x1="79" y1="79" x2="187" y2="139" stroke={palette.secondary} strokeOpacity="0.18" strokeWidth="0.8" />
          <line x1="133" y1="49" x2="241" y2="109" stroke={palette.secondary} strokeOpacity="0.18" strokeWidth="0.8" />
        </g>

        {/* 3D Basis Vectors */}
        <g strokeOpacity="0.62" strokeWidth="1.3">
          <line
            x1="160"
            y1="104"
            x2="262"
            y2="138"
            stroke={palette.secondary}
            markerEnd={`url(#vec-arrow-${uid})`}
          />
          <line
            x1="160"
            y1="104"
            x2="58"
            y2="138"
            stroke={palette.primary}
            markerEnd={`url(#vec-arrow-${uid})`}
          />
          <line
            x1="160"
            y1="104"
            x2="160"
            y2="20"
            stroke={palette.tertiary}
            markerEnd={`url(#vec-arrow-${uid})`}
          />
        </g>

        {/* Discrete Holographic Orbital Rings */}
        <ellipse
          cx="160"
          cy="104"
          rx="114"
          ry="44"
          transform="rotate(-14 160 104)"
          stroke={`url(#hero-holo-ring-${uid})`}
          strokeWidth="1.1"
          strokeDasharray="4 4"
        />
        <ellipse
          cx="160"
          cy="104"
          rx="96"
          ry="34"
          transform="rotate(16 160 104)"
          stroke={palette.secondary}
          strokeOpacity="0.28"
          strokeWidth="0.9"
        />

        {/* Back-Layer 3D Neural Lattice (Input & Projection Nodes) */}
        <g stroke={palette.primary} strokeOpacity={isLightTheme ? '0.32' : '0.36'} strokeWidth="1.1">
          {/* Left 3D input cluster -> Left V vertices */}
          <line x1="48" y1="70" x2="112" y2="58" />
          <line x1="48" y1="70" x2="132" y2="70" />
          <line x1="42" y1="108" x2="112" y2="58" />
          <line x1="42" y1="108" x2="160" y2="116" />
          <line x1="72" y1="146" x2="160" y2="152" />
          <line x1="72" y1="146" x2="132" y2="70" />

          {/* Right 3D output cluster -> Right V vertices */}
          <line x1="272" y1="70" x2="208" y2="58" />
          <line x1="272" y1="70" x2="188" y2="70" />
          <line x1="278" y1="108" x2="208" y2="58" />
          <line x1="278" y1="108" x2="160" y2="116" />
          <line x1="248" y1="146" x2="160" y2="152" />
          <line x1="248" y1="146" x2="188" y2="70" />

          {/* Vertical tensor depth bridges */}
          <line x1="160" y1="30" x2="112" y2="58" strokeDasharray="2.5 2.5" />
          <line x1="160" y1="30" x2="208" y2="58" strokeDasharray="2.5 2.5" />
          <line x1="160" y1="152" x2="160" y2="184" strokeDasharray="2.5 2.5" />
        </g>

        {/* 3D Perimeter Neural Nodes */}
        <g>
          {[
            { cx: 48, cy: 70, r: 3.4, fill: palette.secondary },
            { cx: 42, cy: 108, r: 3.0, fill: palette.primary },
            { cx: 72, cy: 146, r: 3.2, fill: palette.tertiary },
            { cx: 272, cy: 70, r: 3.4, fill: palette.secondary },
            { cx: 278, cy: 108, r: 3.0, fill: palette.primary },
            { cx: 248, cy: 146, r: 3.2, fill: palette.tertiary },
            { cx: 160, cy: 184, r: 3.0, fill: palette.secondary },
          ].map((node, idx) => (
            <g key={idx}>
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.r + 3}
                stroke={node.fill}
                strokeOpacity="0.28"
                strokeWidth="0.9"
              />
              <circle cx={node.cx} cy={node.cy} r={node.r} fill={node.fill} fillOpacity="0.9" />
            </g>
          ))}
        </g>

        {/* Centerpiece Expanded VectorIA Studio Brand Emblem (Preserving Official V + Neural Nodes) */}
        <g>
          {/* Hexagonal containment cradle */}
          <polygon
            points="160,34 228,62 228,142 160,174 92,142 92,62"
            fill={palette.bg}
            fillOpacity={isLightTheme ? '0.88' : '0.78'}
            stroke={palette.border}
            strokeWidth="1.4"
          />

          {/* Cross-synapses */}
          <line
            x1="112"
            y1="58"
            x2="188"
            y2="70"
            stroke={palette.secondary}
            strokeOpacity="0.55"
            strokeWidth="1.8"
          />
          <line
            x1="208"
            y1="58"
            x2="132"
            y2="70"
            stroke={palette.secondary}
            strokeOpacity="0.55"
            strokeWidth="1.8"
          />
          <line
            x1="160"
            y1="116"
            x2="160"
            y2="152"
            stroke={palette.primary}
            strokeOpacity="0.6"
            strokeWidth="1.8"
          />

          {/* Primary geometric V */}
          <path
            d="M112 58L160 152L208 58"
            stroke={`url(#hero-v-grad-${uid})`}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inner neural V */}
          <path
            d="M132 70L160 116L188 70"
            stroke={palette.secondary}
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Core Brand Neural Nodes */}
          <circle cx="112" cy="58" r="9.5" stroke={palette.secondary} strokeOpacity="0.32" strokeWidth="1.2" />
          <circle cx="112" cy="58" r="6" fill={palette.secondary} />

          <circle cx="208" cy="58" r="9.5" stroke={palette.secondary} strokeOpacity="0.32" strokeWidth="1.2" />
          <circle cx="208" cy="58" r="6" fill={palette.secondary} />

          <circle cx="132" cy="70" r="4.2" fill={palette.primary} />
          <circle cx="188" cy="70" r="4.2" fill={palette.primary} />

          <circle cx="160" cy="116" r="5" fill={palette.nodeCenter} />

          <circle cx="160" cy="152" r="10.5" stroke={palette.primary} strokeOpacity="0.36" strokeWidth="1.2" />
          <circle cx="160" cy="152" r="6.8" fill={palette.primary} />
          <circle cx="160" cy="152" r="2.6" fill={palette.nodeCenter} />
        </g>

        {/* Quiet Vector Basis Notation (R^3) */}
        <g
          fill={palette.sub}
          fontSize="9.5"
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          opacity="0.82"
        >
          <text x="167" y="24">ẑ</text>
          <text x="266" y="143">x̂</text>
          <text x="45" y="143">ŷ</text>
        </g>
      </svg>
    </div>
  );
};
