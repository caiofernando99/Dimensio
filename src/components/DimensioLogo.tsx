import React from 'react';

interface DimensioLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'auto';
  showWordmark?: boolean;
}

interface DimensioMonogramProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'auto';
  standaloneTile?: boolean;
}

// Contour path for the letter 'D'
const LETTER_PATH =
  'M 14 10 H 23 C 33 10 37 15.5 37 24 C 37 32.5 33 38 23 38 H 14 Z';

// Flowchart / network nodes inside the letter D
const NODES = [
  { x: 19, y: 18 },
  { x: 19, y: 24 },
  { x: 19, y: 30 },
  { x: 26, y: 18 },
  { x: 26, y: 24 },
  { x: 26, y: 30 },
];

export const DimensioMonogram: React.FC<DimensioMonogramProps> = ({
  className = '',
  size = 'md',
  variant = 'auto',
  standaloneTile = true,
}) => {
  const box = standaloneTile
    ? {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10',
      }[size]
    : {
        sm: 'h-3.5 w-auto',
        md: 'h-4 w-auto sm:h-[1.125rem]',
        lg: 'h-[1.125rem] w-auto sm:h-5',
      }[size];

  // Tile background: if variant is 'dark' or 'auto', match the theme primary/accent color inside app
  const tileFill = variant === 'light' ? '#0f172a' : 'var(--primary)';

  if (!standaloneTile) {
    return (
      <svg
        viewBox="11 7 29 34"
        className={`${box} shrink-0 ${className} transition-colors duration-200`}
        role="img"
        aria-label="D"
      >
        {/* Traço da letra D com peso equivalente ao texto */}
        <path
          d={LETTER_PATH}
          fill="none"
          stroke="#ffffff"
          strokeWidth={3.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Trilhas estilo fluxograma dentro da letra D */}
        <g stroke="#ffffff" strokeOpacity={0.88} strokeWidth={1.5} strokeLinecap="round">
          <line x1={19} y1={18} x2={19} y2={30} />
          <line x1={26} y1={18} x2={26} y2={30} />
          <line x1={19} y1={18} x2={26} y2={18} />
          <line x1={19} y1={24} x2={26} y2={24} />
          <line x1={19} y1={30} x2={26} y2={30} />
        </g>
        <g fill="#ffffff">
          {NODES.map((n) => (
            <circle key={`${n.x}-${n.y}`} cx={n.x} cy={n.y} r={1.9} />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      className={`${box} shrink-0 ${className} drop-shadow-xs transition-colors duration-200`}
      role="img"
      aria-label="Dimensio"
    >
      {/* Fundo quadrado com cantos arredondados acompanhando o tema do app */}
      <rect x="2" y="2" width="44" height="44" rx="12" fill={tileFill} />
      
      {/* Traço da letra D com peso equivalente ao texto */}
      <path
        d={LETTER_PATH}
        fill="none"
        stroke="#ffffff"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Trilhas estilo fluxograma dentro da letra D */}
      <g stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.5} strokeLinecap="round">
        <line x1={19} y1={18} x2={19} y2={30} />
        <line x1={26} y1={18} x2={26} y2={30} />
        <line x1={19} y1={18} x2={26} y2={18} />
        <line x1={19} y1={24} x2={26} y2={24} />
        <line x1={19} y1={30} x2={26} y2={30} />
      </g>
      <g fill="#ffffff">
        {NODES.map((n) => (
          <circle key={`${n.x}-${n.y}`} cx={n.x} cy={n.y} r={1.9} />
        ))}
      </g>
    </svg>
  );
};

export const DimensioLogo: React.FC<DimensioLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'auto',
  showWordmark = true,
}) => {
  if (!showWordmark) {
    return <DimensioMonogram size={size} variant={variant} className={className} />;
  }

  const containerPadding = {
    sm: 'pl-2 pr-2.5 py-1 gap-0 rounded-lg',
    md: 'pl-2 pr-3 py-1 gap-0 rounded-xl',
    lg: 'pl-3 pr-4 py-1.5 gap-0 rounded-xl',
  }[size];

  const textSize = {
    sm: 'text-sm font-semibold',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
  }[size];

  const bgStyle =
    variant === 'light'
      ? 'bg-slate-900 text-white border-slate-800'
      : 'bg-[var(--primary)] text-white border-white/15';

  return (
    <div
      className={`inline-flex items-end ${containerPadding} ${bgStyle} border shadow-xs transition-all duration-200 select-none ${className}`}
    >
      <DimensioMonogram size={size} variant={variant} standaloneTile={false} />
      <span className={`font-black ${textSize} tracking-normal text-white leading-none`}>
        imensio
      </span>
    </div>
  );
};


