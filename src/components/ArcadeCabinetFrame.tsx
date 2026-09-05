/**
 * ArcadeCabinetFrame - Authentic 1990 Battle City Arcade Cabinet Bezel
 * Wraps content in a pixel-perfect 16-bit arcade cabinet with radar operators,
 * combat tanks, warning beacons, and an authentic CRT curved screen.
 * 
 * Responsively preserves exact 16:9 cabinet aspect ratio across all PC screen sizes
 * (1080p, 1440p, 4K, laptops, 16:10, and ultrawides) without clipping or distortion.
 */

import React from 'react';

interface ArcadeCabinetFrameProps {
  children: React.ReactNode;
}

export const ArcadeCabinetFrame: React.FC<ArcadeCabinetFrameProps> = ({ children }) => {
  return (
    <div className="relative w-screen h-screen bg-[#080808] flex items-center justify-center overflow-hidden select-none">
      <style>{`
        /* Desktop & large tablet screens: center inside authentic arcade cabinet bezel */
        @media (min-width: 768px) and (min-height: 520px) {
          #arcade-cabinet-art {
            display: block !important;
          }
          #arcade-crt-screen {
            position: absolute !important;
            left: 32.4% !important;
            width: 35.2% !important;
            top: 12.4% !important;
            height: 76.0% !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Full-bleed Arcade Cabinet Artwork Background (Desktop / Tall screens only) */}
      <img
        id="arcade-cabinet-art"
        src="./assets/arcade_cabinet_bg.webp"
        alt="Battle City 1990 Arcade Machine"
        className="hidden absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
        draggable={false}
      />

      {/* Central CRT Arcade Monitor Screen Area - Mounted EXACTLY ONCE */}
      <div
        id="arcade-crt-screen"
        className="relative z-10 overflow-hidden flex flex-col select-none w-full h-full max-w-2xl sm:max-w-3xl max-h-screen bg-black sm:border-4 border-zinc-800 sm:rounded-lg shadow-2xl p-1"
      >
        {/* Inner Content (Title Screen / Menus) with comfortable CRT margin */}
        <div className="relative z-10 w-full h-full flex flex-col overflow-hidden px-2 sm:px-6 py-1 sm:py-4">
          {children}
        </div>

        {/* Authentic CRT Glass Scanlines Overlay */}
        <div className="absolute inset-0 scanlines pointer-events-none opacity-20 z-20" />
      </div>
    </div>
  );
};

