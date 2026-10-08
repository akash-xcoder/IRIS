import React from 'react';

interface IrisLogoProps {
  className?: string;
  size?: number | string;
}

export const IrisLogo: React.FC<IrisLogoProps> = ({ className = 'w-7 h-7', size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="IRIS Assistive Logo"
    >
      <defs>
        {/* Crisp monochrome silver/white gradient for clean aesthetic */}
        <linearGradient id="irisLinearGrad" x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        <linearGradient id="irisPupilGrad" x1="20%" y1="20%" x2="80%" y2="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Glow filter for tactical presence */}
        <filter id="irisGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Top Outer Circular Arc with Dual Directional Arrows */}
      <path
        d="M 18 36 A 40 40 0 0 1 82 36"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Top Left Arrow Head pointing counter-clockwise down */}
      <path
        d="M 14 39 L 18 24 L 27 34 Z"
        fill="url(#irisLinearGrad)"
      />
      {/* Top Right Arrow Head pointing clockwise down */}
      <path
        d="M 86 39 L 82 24 L 73 34 Z"
        fill="url(#irisLinearGrad)"
      />

      {/* Top Middle Concentric Arc */}
      <path
        d="M 27 33 A 31 31 0 0 1 73 33"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />

      {/* Top Inner Concentric Arc */}
      <path
        d="M 35 32 A 22 22 0 0 1 65 32"
        stroke="url(#irisLinearGrad)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />

      {/* Center Open Eye Contour */}
      {/* Upper Eyelid curve */}
      <path
        d="M 11 50 Q 50 17 89 50"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Lower Eyelid curve */}
      <path
        d="M 11 50 Q 50 83 89 50"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Concentric Iris Outer Ring */}
      <circle
        cx="50"
        cy="50"
        r="17"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3.2"
      />

      {/* Concentric Iris Inner Ring */}
      <circle
        cx="50"
        cy="50"
        r="11.5"
        stroke="url(#irisLinearGrad)"
        strokeWidth="2.4"
        strokeOpacity="0.85"
      />

      {/* Central Pupil with Reflection Cutout */}
      <path
        d="M 50 43 A 7 7 0 1 1 43 50 A 7 7 0 0 1 50 43 Z"
        fill="url(#irisPupilGrad)"
      />
      {/* Catchlight pupil gleam notch at 2 o'clock */}
      <circle
        cx="53"
        cy="47"
        r="2"
        fill="#ffffff"
      />

      {/* Bottom Concentric Inner Arc */}
      <path
        d="M 35 68 A 22 22 0 0 0 65 68"
        stroke="url(#irisLinearGrad)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />

      {/* Bottom Concentric Middle Arc */}
      <path
        d="M 27 67 A 31 31 0 0 0 73 67"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />

      {/* Bottom Outer Circular Arc with Dual Directional Arrows */}
      <path
        d="M 18 64 A 40 40 0 0 0 82 64"
        stroke="url(#irisLinearGrad)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Bottom Left Arrow Head pointing up */}
      <path
        d="M 14 61 L 18 76 L 27 66 Z"
        fill="url(#irisLinearGrad)"
      />
      {/* Bottom Right Arrow Head pointing up */}
      <path
        d="M 86 61 L 82 76 L 73 66 Z"
        fill="url(#irisLinearGrad)"
      />
    </svg>
  );
};
