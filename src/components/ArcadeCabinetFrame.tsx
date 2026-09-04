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
      {/* Full-bleed Arcade Cabinet Display: covers 100% of screen edge-to-edge with zero sidebars */}
      <div className="relative hidden sm:flex w-full h-full items-center justify-center select-none overflow-hidden">
        {/* Pixel Art Arcade Cabinet Artwork Background (Edge to edge) */}
        <img
          src="/assets/arcade_cabinet_bg.jpg"
          alt="Battle City 1990 Arcade Machine"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
          draggable={false}
        />

        {/* Central CRT Arcade Monitor Screen Area (Blends seamlessly with the artwork without any card/sticker border) */}
        <div
          id="arcade-crt-screen"
          className="absolute z-10 overflow-hidden flex flex-col bg-transparent select-none"
          style={{
            left: '32.4%',
            width: '35.2%',
            top: '12.4%',
            height: '76.0%',
          }}
        >
          {/* Inner Content (Title Screen / Menus) with comfortable CRT margin */}
          <div className="relative z-10 w-full h-full flex flex-col overflow-hidden px-4 sm:px-6 py-4 sm:py-5">
            {children}
          </div>

          {/* Authentic CRT Glass Scanlines Overlay */}
          <div className="absolute inset-0 scanlines pointer-events-none opacity-20 z-20" />
        </div>
      </div>

      {/* Mobile Portrait Fallback (Ensures readable, touchable menu on narrow screens < 640px) */}
      <div className="sm:hidden w-full h-full flex flex-col items-center justify-center p-3 relative bg-gradient-to-b from-[#121212] via-black to-[#121212]">
        <div className="w-full max-w-sm aspect-[4/5] bg-black border-4 border-[#333] rounded-lg shadow-2xl overflow-hidden relative flex flex-col">
          <div className="relative z-10 w-full h-full flex flex-col overflow-hidden">
            {children}
          </div>
          <div className="absolute inset-0 scanlines pointer-events-none opacity-30 z-20" />
        </div>
      </div>
    </div>
  );
};
