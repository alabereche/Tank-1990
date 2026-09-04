const fs = require('fs');
const path = require('path');

// 32x32 Battle City Legendary Pixel Art Icon Matrix
// Colors:
const PALETTE = {
  '.': 'transparent',        // Outside
  'B': '#0b0c10',            // Outer bezel black
  'D': '#14141c',            // Dark bezel gray
  'G': '#0f1016',            // Badge inner background
  'g': '#1a1b24',            // Badge background subtle grid
  '1': '#ffe078',            // Gold bright highlight
  '2': '#f8b800',            // Gold primary armor
  '3': '#c87800',            // Gold medium shade
  '4': '#703800',            // Gold dark outline / shadow
  'T': '#22222a',            // Tread dark metal
  't': '#424250',            // Tread base metal
  'H': '#747488',            // Tread highlight
  'W': '#ffffff',            // White star / specular glint
  'C': '#00e5ff',            // Cyan sensor / optics
  'c': '#0088aa',            // Cyan dark sensor
  'O': '#b84418',            // Amber/orange accent
};

// 32x32 ASCII Art definition
const ICON_32 = [
  // 0-3: Top bezel & Cannon muzzle
  "....BBBBBBBBBBBBBBBBBBBBBBBB....", // 0
  "..BB111111111111111111111111BB..", // 1
  ".B122222222224422222222222221B.", // 2
  ".B12GGGGGGGG4114GGGGGGGGGG221B.", // 3
  "B12GGGGGGGGG4114GGGGGGGGGGG221B", // 4
  "B12GGGGGGGGG4114GGGGGGGGGGG221B", // 5  (Cannon muzzle: cols 12-19)
  "B12GGGGGGGGG4114GGGGGGGGGGG221B", // 6
  "B12GGGGGGGGG4224GGGGGGGGGGG221B", // 7
  "B12GGGGGGGGG4224GGGGGGGGGGG221B", // 8
  "B12GGGGGGGG442244GGGGGGGGGG221B", // 9  (Cannon collar)
  "B12GGGGGGGG412234GGGGGGGGGG221B", // 10
  // 11-20: Turret and upper chassis
  "B12GTTTTGG44422444GGTTTTGGG221B", // 11 (Treads start cols 4-7, 24-27)
  "B12GTtHTG4111223334GTtHTGGG221B", // 12
  "B12GTttTG41C1221C34GTttTGGG221B", // 13 (Cyan sensors at 11, 20)
  "B12GTtHTG4442222444GTtHTGGG221B", // 14
  "B12GTttTG4111WW2334GTttTGGG221B", // 15 (White Star center)
  "B12GTtHTG411WWWW334GTtHTGGG221B", // 16
  "B12GTttTG4111WW2334GTttTGGG221B", // 17
  "B12GTtHTG4444444444GTtHTGGG221B", // 18
  "B12GTttTG4111111334GTttTGGG221B", // 19 (Chassis plate)
  "B12GTtHTG4122222334GTtHTGGG221B", // 20
  // 21-27: Lower chassis and treads
  "B12GTttTG4122222334GTttTGGG221B", // 21
  "B12GTtHTG4122222334GTtHTGGG221B", // 22
  "B12GTttTG4122222334GTttTGGG221B", // 23
  "B12GTtHTG4124444334GTtHTGGG221B", // 24 (Rear exhaust vents)
  "B12GTttTG414T44T334GTttTGGG221B", // 25
  "B12GTTTTG4444444444GTTTTGGG221B", // 26
  "B12GGGGGGGGGGGGGGGGGGGGGGGG221B", // 27
  // 28-31: Bottom bezel
  "B12222222222222222222222222221B", // 28
  ".B122222222222222222222222221B.", // 29
  "..BB333333333333333333333333BB..", // 30
  "....BBBBBBBBBBBBBBBBBBBBBBBB...."  // 31
];

function generateSvg() {
  let rects = [];
  for (let r = 0; r < 32; r++) {
    const row = ICON_32[r];
    let startC = -1;
    let curChar = '';

    for (let c = 0; c < 32; c++) {
      const ch = row[c];
      if (ch === startC) {
        // continue run
      } else {
        if (curChar && curChar !== '.' && PALETTE[curChar]) {
          rects.push(`<rect x="${startC}" y="${r}" width="${c - startC}" height="1" fill="${PALETTE[curChar]}" />`);
        }
        startC = c;
        curChar = ch;
      }
    }
    if (curChar && curChar !== '.' && PALETTE[curChar]) {
      rects.push(`<rect x="${startC}" y="${r}" width="${32 - startC}" height="1" fill="${PALETTE[curChar]}" />`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%" shape-rendering="crispEdges">
  <defs>
    <filter id="pixelGlow">
      <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#f8b800" flood-opacity="0.3" />
    </filter>
  </defs>
  ${rects.join('\n  ')}
</svg>`;
  return svg;
}

const svgContent = generateSvg();
const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf8');
console.log('✅ Generated authentic 8-bit Battle City pixel art SVG: public/favicon.svg');
