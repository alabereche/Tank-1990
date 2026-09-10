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
    <div className="relative w-screen h-screen bg-[#060608] flex items-center justify-center overflow-hidden select-none">
      <style>{`
        /* Landscape view (Phones, Tablets, PC):
           Perfect 16:9 arcade cabinet containment so the CRT screen sits
           with sub-pixel precision directly inside the arcade cabinet monitor bezel. */
        @media (orientation: landscape) and (min-width: 480px) {
          #arcade-ambient-bg {
            display: block !important;
          }
          #arcade-cabinet-wrapper {
            display: block !important;
            position: relative !important;
            width: min(100vw, calc(100vh * 16 / 9)) !important;
            height: min(100vh, calc(100vw * 9 / 16)) !important;
            aspect-ratio: 16 / 9 !important;
          }
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
            max-height: none !important;
            aspect-ratio: auto !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          #arcade-crt-inner {
            padding: 2px 4px !important;
          }
        }

        /* Portrait view (Phones held vertically):
           Authentic retro arcade monitor with metallic rivet borders and dark pixel theme */
        @media (orientation: portrait), (max-width: 479px) {
          #arcade-ambient-bg {
            display: none !important;
          }
          #arcade-cabinet-wrapper {
            display: flex !important;
            width: 100vw !important;
            height: 100vh !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 6px !important;
          }
          #arcade-cabinet-art {
            display: none !important;
          }
          #arcade-crt-screen {
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 540px !important;
            max-height: 100% !important;
            background: #08080a !important;
            border: 3px solid #282830 !important;
            border-radius: 8px !important;
            box-shadow: inset 0 0 30px rgba(0,0,0,0.9), 0 0 15px rgba(0,0,0,0.8) !important;
          }
        }
      `}</style>

      {/* Ambient background filling ultrawide side bars on wide phones (e.g. 19.5:9 / 20:9) */}
      <img
        id="arcade-ambient-bg"
        src="./assets/arcade_cabinet_bg.webp"
        alt=""
        aria-hidden="true"
        className="hidden absolute inset-0 w-full h-full object-cover opacity-25 filter blur-[3px] pointer-events-none select-none z-0"
        draggable={false}
      />

      {/* Sized 16:9 Cabinet Wrapper */}
      <div id="arcade-cabinet-wrapper" className="relative z-10 overflow-hidden">
        {/* Crisp pixel-art arcade cabinet artwork */}
        <img
          id="arcade-cabinet-art"
          src="./assets/arcade_cabinet_bg.webp"
          alt="Battle City 1990 Arcade Machine"
          className="hidden absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
          draggable={false}
        />

        {/* Central CRT Arcade Monitor Screen Area */}
        <div
          id="arcade-crt-screen"
          className="relative z-10 overflow-hidden flex flex-col select-none w-full h-full p-1"
        >
          {/* Inner Content (Title Screen / Menus) */}
          <div id="arcade-crt-inner" className="relative z-10 w-full h-full flex flex-col overflow-hidden px-2 sm:px-4 py-1 sm:py-2">
            {children}
          </div>

          {/* Authentic CRT Glass Scanlines Overlay */}
          <div className="absolute inset-0 scanlines pointer-events-none opacity-20 z-20" />
        </div>
      </div>
    </div>
  );
};

