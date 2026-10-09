// frontend/src/components/AffyLogo.tsx
import React from 'react';

interface AffyLogoProps {
  variant?: 'light' | 'dark' | 'violet' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export const AffyLogo: React.FC<AffyLogoProps> = ({
  variant = 'light',
  size = 'md',
  className = '',
  showText = true,
}) => {
  // Height map based on size
  const heightClasses = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-16',
    xl: 'h-24',
  }[size];

  // Colors matching the exact brand specifications
  const bagColors = {
    light: {
      leftSide: '#1E0A3C',
      front: '#25104E',
      handle: '#FFFFFF',
      text: '#25104E',
    },
    dark: {
      leftSide: '#E2E8F0',
      front: '#FFFFFF',
      handle: '#25104E',
      text: '#FFFFFF',
    },
    violet: {
      leftSide: '#7E22CE',
      front: '#9333EA',
      handle: '#FFFFFF',
      text: '#9333EA',
    },
    'icon-only': {
      leftSide: '#1E0A3C',
      front: '#25104E',
      handle: '#FFFFFF',
      text: '#25104E',
    },
  }[variant];

  // SVG Unique IDs to prevent gradient conflicts when multiple logos render
  const idSuffix = React.useId().replace(/:/g, '');
  const gradId = `affyGradient_${idSuffix}`;
  const shadowId = `affyShadow_${idSuffix}`;
  const bevelId = `affyBevel_${idSuffix}`;

  // If icon-only, viewBox width is truncated
  const viewBox = showText && variant !== 'icon-only' ? '0 0 340 125' : '0 0 150 125';

  return (
    <svg
      viewBox={viewBox}
      className={`inline-block ${heightClasses} w-auto transition-transform ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Affy FoodBank Logo"
    >
      <defs>
        {/* Exact Multi-Color Rainbow/Spectrum Gradient of the "A" Ribbon */}
        <linearGradient id={gradId} x1="0%" y1="100%" x2="90%" y2="10%">
          <stop offset="0%" stopColor="#EAB308" />     {/* Warm Golden Yellow */}
          <stop offset="16%" stopColor="#FACC15" />    {/* Bright Lemon Yellow */}
          <stop offset="35%" stopColor="#4ADE80" />    {/* Fresh Lime Green */}
          <stop offset="55%" stopColor="#00D2D3" />    {/* Electric Aqua / Cyan */}
          <stop offset="78%" stopColor="#EC4899" />    {/* Vivid Hot Pink */}
          <stop offset="100%" stopColor="#FF1378" />   {/* Deep Neon Magenta */}
        </linearGradient>

        {/* 3D Depth Shadow for the overlapping "A" */}
        <filter id={shadowId} x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="-2" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
        </filter>

        {/* Soft highlight overlay for 3D tubular shine */}
        <linearGradient id={bevelId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* --- 1. 3D SHOPPING BAG --- */}
      <g id="shopping-bag">
        {/* Bag Left Perspective Flap / Depth */}
        <polygon
          points="14,24 28,18 28,108 14,103"
          fill={bagColors.leftSide}
        />
        {/* Top fold line */}
        <polygon
          points="28,18 132,15 132,20 28,23"
          fill={variant === 'dark' ? '#CBD5E1' : '#170630'}
          opacity="0.6"
        />
        {/* Front Face of Bag */}
        <polygon
          points="28,20 132,16 132,112 28,108"
          fill={bagColors.front}
        />
        {/* Bag Die-Cut / Handle Curve (Smiley Cutout) */}
        <path
          d="M 64,36 C 64,54 94,54 94,36"
          stroke={bagColors.handle}
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* --- 2. THE SIGNATURE 3D RIBBON "A" --- */}
      <g id="ribbon-a" filter={`url(#${shadowId})`}>
        {/* Main 3D tubular Arch */}
        <path
          d="M 52,94 L 95,24 C 99,17 109,17 113,24 L 126,86"
          stroke={`url(#${gradId})`}
          strokeWidth="19"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 3D Tubular Glass / Light Shine Layer */}
        <path
          d="M 52,94 L 95,24 C 99,17 109,17 113,24 L 126,86"
          stroke={`url(#${bevelId})`}
          strokeWidth="19"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.65"
        />
      </g>

      {/* --- 3. BRAND TYPOGRAPHY: "ffy" & "food bank" --- */}
      {showText && variant !== 'icon-only' && (
        <g id="brand-text" fill={bagColors.text}>
          {/* "ffy" - Bold modern geometric sans typography */}
          <text
            x="142"
            y="78"
            fontFamily="'Poppins', 'Inter', system-ui, sans-serif"
            fontWeight="900"
            fontSize="62"
            letterSpacing="-3.5"
          >
            ffy
          </text>

          {/* "food bank" - clean modern lowercase under "ffy" */}
          <text
            x="146"
            y="108"
            fontFamily="'Poppins', 'Inter', system-ui, sans-serif"
            fontWeight="800"
            fontSize="21"
            letterSpacing="-0.8"
          >
            food bank
          </text>
        </g>
      )}
    </svg>
  );
};

export default AffyLogo;
