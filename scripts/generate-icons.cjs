const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const pngToIco = require('png-to-ico');

async function main() {
  const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');

  const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
  const pngBuffers = {};

  for (const size of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: size,
      },
    });
    const pngData = resvg.render();
    pngBuffers[size] = pngData.asPng();
  }

  const publicDir = path.join(__dirname, '..', 'public');
  const buildDir = path.join(__dirname, '..', 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Save standard web PNGs
  fs.writeFileSync(path.join(publicDir, 'icon.png'), pngBuffers[512]);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), pngBuffers[512]);
  fs.writeFileSync(path.join(publicDir, 'icon-256.png'), pngBuffers[256]);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), pngBuffers[192]);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngBuffers[180]);
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), pngBuffers[32]);
  fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), pngBuffers[32]);
  fs.writeFileSync(path.join(publicDir, 'favicon-16.png'), pngBuffers[16]);

  // Save build icons for future Electron build
  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngBuffers[512]);

  // Generate multi-resolution Windows ICO (16, 32, 48, 64, 128, 256)
  const icoBuffers = [
    pngBuffers[16],
    pngBuffers[32],
    pngBuffers[48],
    pngBuffers[64],
    pngBuffers[128],
    pngBuffers[256],
  ];

  const ico = await pngToIco(icoBuffers);

  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), ico);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

  console.log('✅ Successfully generated all icons:');
  console.log(' - public/favicon.svg (Scalable vector favicon)');
  console.log(' - public/favicon.ico (Multi-size Windows/browser ICO)');
  console.log(' - public/favicon.png (32x32)');
  console.log(' - public/apple-touch-icon.png (180x180)');
  console.log(' - public/icon.png & icon-512.png (512x512 master app icon)');
  console.log(' - public/icon.ico & build/icon.ico (Windows exe application icon)');
  console.log(' - build/icon.png (Electron app icon)');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
