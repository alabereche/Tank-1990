const fs = require('fs');
const path = require('path');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

async function packIco() {
  const tempDir = path.join(__dirname, '../build/temp_ico');
  const sizes = [16, 32, 48, 64, 128, 256];
  const files = sizes.map((s) => path.join(tempDir, `ico-${s}.png`));

  console.log('Generating multi-resolution Windows ICO (16, 32, 48, 64, 128, 256)...');
  const icoBuffer = await pngToIco(files);

  const targets = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../public/favicon.ico'),
    path.join(__dirname, '../public/icon.ico'),
  ];

  for (const t of targets) {
    fs.writeFileSync(t, icoBuffer);
    console.log('Saved ICO to:', t);
  }

  // Also embed high-res 64x64 PNG in public/favicon.svg so any SVG icon request loads the new tank
  const icon32Base64 = fs.readFileSync(path.join(__dirname, '../public/icon-192.png')).toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">
  <image href="data:image/png;base64,${icon32Base64}" width="192" height="192" />
</svg>
`;
  fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), svgContent, 'utf8');
  console.log('Updated public/favicon.svg with embedded high-res tank icon.');

  // Clean up temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Done packing icons!');
}

packIco().catch((err) => {
  console.error('Error packing ICO:', err);
  process.exit(1);
});
