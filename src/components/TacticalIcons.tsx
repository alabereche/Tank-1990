import React from 'react';

interface IconProps {
  className?: string;
}

/**
 * Pixel-art style SVG for Smoke Canister / Smoke Screen
 */
export const SmokeSvg: React.FC<IconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 16 16"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Canister pin / ring */}
    <rect x="5" y="1" width="3" height="1" fill="#facc15" />
    <rect x="7" y="2" width="2" height="1" fill="#475569" />
    {/* Main Canister Body */}
    <rect x="5" y="3" width="6" height="10" rx="1" fill="#94a3b8" />
    {/* Blue tactical stripe */}
    <rect x="5" y="6" width="6" height="3" fill="#38bdf8" />
    {/* Specular highlight */}
    <rect x="6" y="4" width="1" height="8" fill="#e2e8f0" />
    {/* Shadow rim */}
    <rect x="10" y="4" width="1" height="8" fill="#475569" />
    {/* Smoke puff accents */}
    <path
      d="M12 2C13 1.5 14 2.5 14 3.5C14 4.5 13 5 12 5"
      stroke="#f1f5f9"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.9"
    />
    <circle cx="14" cy="2" r="0.75" fill="#ffffff" opacity="0.8" />
  </svg>
);

/**
 * Pixel-art style SVG for Bouncing Grenade / Bomb
 */
export const GrenadeSvg: React.FC<IconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 16 16"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Glowing fuse spark */}
    <circle cx="12.5" cy="3" r="1.5" fill="#ef4444" />
    <circle cx="12.5" cy="3" r="0.8" fill="#fef08a" />
    {/* Fuse wick curve */}
    <path
      d="M8.5 6C9 4 10.5 4 12 3"
      stroke="#d97706"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    {/* Brass neck */}
    <rect x="7" y="5" width="3" height="2" fill="#b45309" />
    {/* Bomb iron body */}
    <circle cx="8" cy="10" r="5" fill="#1e293b" />
    {/* Specular highlight */}
    <circle cx="6.5" cy="8.5" r="1.2" fill="#64748b" />
    {/* Deep shadow */}
    <path
      d="M5 12.5C6 14.5 10 14.5 11 12.5"
      stroke="#0f172a"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Pixel-art style SVG for Deployable Shield
 */
export const ShieldSvg: React.FC<IconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 16 16"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Shield outer border / rim */}
    <path
      d="M8 1L14 3.5V8.5C14 12 11 14.5 8 15.5C5 14.5 2 12 2 8.5V3.5L8 1Z"
      fill="#0369a1"
      stroke="#38bdf8"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Inner metallic crest plate */}
    <path
      d="M8 3L12 4.8V8.2C12 10.8 10 12.8 8 13.5C6 12.8 4 10.8 4 8.2V4.8L8 3Z"
      fill="#0c4a6e"
    />
    {/* Glowing energy cross */}
    <rect x="7" y="5" width="2" height="6" fill="#7dd3fc" rx="0.5" />
    <rect x="5" y="7" width="6" height="2" fill="#7dd3fc" rx="0.5" />
    <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
  </svg>
);
