import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Exact NES Battle City 16x16 Player Tank Sprite definition
// Y = #f8b800 (Player Gold)
// W = #ffffff (White highlight / hatch)
// O = #c84c0c (Shade / rust)
// B = #000000 (Black contour)
// . = transparent background

const SPRITE_16 = [
  ".......BB.......", // 0: Cannon tip
  ".......YY.......", // 1
  ".......YY.......", // 2
  ".......YY.......", // 3
  ".......YY.......", // 4: Cannon joins turret
  ".BWW...YYYY...WWB.", // 5: Treads start
  ".BYY..YYYYYY..YYB.", // 6
  ".BYY.YYYYYYYY.YYB.", // 7
  ".BWW.YYWWWWYY.WWB.", // 8: Turret with White Hatch
  ".BYY.YYWWWWYY.YYB.", // 9
  ".BYY.YYYYYYYY.YYB.", // 10
  ".BWW.YYYYYYYY.WWB.", // 11
  ".BYY.YYYYYYYY.YYB.", // 12: Lower chassis
  ".BYY.YYOOOOYY.YYB.", // 13: Engine vents
  ".BWW..YYYYYY..WWB.", // 14
  ".B......BB......B."  // 15
];

// Let's create a 32x32 Icon with this authentic NES tank centered!
// In a 32x32 grid:
// Background: Deep dark #0c0c14 with a golden arcade frame.
// Center the tank with 2x scale or pixel-perfect 1.5x/2x:
// If 16x16 scaled 2x: size is 32x32! It fills the entire icon with the legendary tank!
// Let's test scaled 2x: exactly 32x32!

const C = {
  '.': '#0c0c14',            // Deep arcade background
  'B': '#000000',            // Black outline
  'Y': '#f8b800',            // NES Player Gold
  'W': '#ffffff',            // White highlight
  'O': '#c85a00',            // Shadow / Engine vent
  'G': '#ffe078',            // Gold highlight
};

// 32x32 Authentic NES Tank Pixel Matrix (Tank scaled 2x with arcade bezel)
const ICON_32 = [
  // 0-1: Outer Gold & Black Bezel
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", // 0
  "BGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGB", // 1
  "BG............................GB", // 2
  "BG.............BB.............GB", // 3 (Cannon muzzle)
  "BG.............YY.............GB", // 4
  "BG.............YY.............GB", // 5
  "BG.............YY.............GB", // 6
  "BG.............YY.............GB", // 7
  "BG.............YY.............GB", // 8
  "BG..BBWW......YYYY......WWBB..GB", // 9 (Tread tops & Cannon base)
  "BG..BBWW......YYYY......WWBB..GB", // 10
  "BG..BBYY.....YYYYYY.....YYBB..GB", // 11
  "BG..BBYY.....YYYYYY.....YYBB..GB", // 12
  "BG..BBYY...YYYYYYYYYY...YYBB..GB", // 13
  "BG..BBYY...YYYYYYYYYY...YYBB..GB", // 14
  "BG..BBWW...YYWWWWWWYY...WWBB..GB", // 15 (Turret with White Star/Hatch)
  "BG..BBWW...YYWWWWWWYY...WWBB..GB", // 16
  "BG..BBYY...YYWWWWWWYY...YYBB..GB", // 17
  "BG..BBYY...YYWWWWWWYY...YYBB..GB", // 18
  "BG..BBYY...YYYYYYYYYY...YYBB..GB", // 19
  "BG..BBYY...YYYYYYYYYY...YYBB..GB", // 20
  "BG..BBWW...YYYYYYYYYY...WWBB..GB", // 21
  "BG..BBWW...YYYYYYYYYY...WWBB..GB", // 22
  "BG..BBYY...YYOOOOOOYY...YYBB..GB", // 23 (Rear engine exhaust)
  "BG..BBYY...YYOOOOOOYY...YYBB..GB", // 24
  "BG..BBYY.....YYYYYY.....YYBB..GB", // 25
  "BG..BBYY.....YYYYYY.....YYBB..GB", // 26
  "BG..BBWW......BBBB......WWBB..GB", // 27 (Tread bottom)
  "BG..BB....................BB..GB", // 28
  "BG............................GB", // 29
  "BGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGB", // 30
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"  // 31
];

function buildSvg() {
  const rects = [];
  for (let y = 0; y < 32; y++) {
    const row = ICON_32[y];
    let startX = -1;
    let currentColor = null;

    for (let x = 0; x < 32; x++) {
      const char = row[x];
      const color = C[char];

      if (color === currentColor) {
        // continue
      } else {
        if (currentColor && currentColor !== 'transparent') {
          rects.push(`<rect x="${startX}" y="${y}" width="${x - startX}" height="1" fill="${currentColor}" />`);
        }
        startX = x;
        currentColor = color;
      }
    }

    if (currentColor && currentColor !== 'transparent') {
      rects.push(`<rect x="${startX}" y="${y}" width="${32 - startX}" height="1" fill="${currentColor}" />`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%" shape-rendering="crispEdges">
  ${rects.join('\n  ')}
</svg>`;
}

async function main() {
  const svg = buildSvg();
  const publicDir = path.join(__dirname, '..', 'public');
  const buildDir = path.join(__dirname, '..', 'build');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svg, 'utf8');

  const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
  const pngs = {};

  for (const s of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: s },
      shapeRendering: 2, // crispEdges
    });
    pngs[s] = resvg.render().asPng();
  }

  fs.writeFileSync(path.join(publicDir, 'icon.png'), pngs[512]);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), pngs[512]);
  fs.writeFileSync(path.join(publicDir, 'icon-256.png'), pngs[256]);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), pngs[192]);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngs[180]);
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), pngs[32]);
  fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), pngs[32]);
  fs.writeFileSync(path.join(publicDir, 'favicon-16.png'), pngs[16]);

  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngs[512]);

  const icoBuffers = [
    pngs[16],
    pngs[32],
    pngs[48],
    pngs[64],
    pngs[128],
    pngs[256],
  ];

  const ico = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), ico);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

  console.log('✅ Generated authentic 1:1 NES Battle City pixel art icon!');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
