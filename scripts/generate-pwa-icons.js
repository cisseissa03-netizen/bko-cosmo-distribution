const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function makePng(width, height, getPixel) {
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowLength);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ byte) & 1) crc = (crc >>> 1) ^ 0xEDB88320;
        else crc = crc >>> 1;
        byte >>>= 1;
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Draw a stylized cosmetic & pharmacy icon
function getCosmeticPixel(x, y, width, height, isMaskable = false) {
  // Normalize to 0..1
  const nx = x / width;
  const ny = y / height;

  // Background gradient: Teal (#0d5c75 to #082f49)
  const topColor = [13, 92, 117];
  const bottomColor = [8, 47, 73];
  const bgR = Math.round(topColor[0] + (bottomColor[0] - topColor[0]) * ny);
  const bgG = Math.round(topColor[1] + (bottomColor[1] - topColor[1]) * ny);
  const bgB = Math.round(topColor[2] + (bottomColor[2] - topColor[2]) * ny);

  // If not maskable, apply rounded corners
  if (!isMaskable) {
    const radius = 0.22; // rounded square
    const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - radius));
    const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - radius));
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      return [0, 0, 0, 0]; // Transparent outside
    }
  }

  // Centered Coordinate system (-1 to +1)
  const cx = (nx - 0.5) * 2;
  const cy = (ny - 0.5) * 2;

  // 1. Cosmetic Bottle body (cylinder / rectangle with rounded shoulders)
  // Body: x in [-0.32, 0.32], y in [-0.25, 0.55]
  const inBottleBody = (cx >= -0.32 && cx <= 0.32 && cy >= -0.25 && cy <= 0.52);
  const inBottleShoulder = (cy >= -0.38 && cy < -0.25 && Math.abs(cx) <= (0.16 + (cy + 0.38) * 1.23));
  // Neck: x in [-0.14, 0.14], y in [-0.52, -0.38]
  const inNeck = (Math.abs(cx) <= 0.14 && cy >= -0.52 && cy < -0.38);
  // Cap (Gold pump / cap): x in [-0.18, 0.18], y in [-0.68, -0.52]
  const inCap = (Math.abs(cx) <= 0.18 && cy >= -0.68 && cy < -0.52);

  if (inCap) {
    // Golden amber cap (#d97706 to #fbbf24 highlight)
    const highlight = Math.max(0, 1 - Math.abs(cx - 0.05) * 4);
    const r = Math.min(255, 217 + highlight * 35);
    const g = Math.min(255, 119 + highlight * 70);
    const b = Math.min(255, 6 + highlight * 30);
    return [r, g, b, 255];
  }

  if (inBottleBody || inBottleShoulder || inNeck) {
    // Pure clean white bottle with subtle shading
    const highlight = Math.max(0, 1 - Math.abs(cx - 0.08) * 3);
    const shade = 235 + highlight * 20;

    // Small green pharmacy cross in center of bottle
    // Cross center at (cx: 0, cy: 0.12), arm length 0.16, thickness 0.06
    const crossX = Math.abs(cx);
    const crossY = Math.abs(cy - 0.12);
    const inCross = (crossX <= 0.15 && crossY <= 0.045) || (crossX <= 0.045 && crossY <= 0.15);
    if (inCross) {
      return [16, 185, 129, 255]; // Emerald pharmacy green (#10b981)
    }

    return [shade, shade, shade, 255];
  }

  // Small sparkles / stars around bottle
  const star1Dist = Math.hypot(cx - 0.52, cy - (-0.35));
  if (star1Dist < 0.08) {
    return [254, 240, 138, 255]; // Gold sparkle
  }
  const star2Dist = Math.hypot(cx - (-0.52), cy - 0.25);
  if (star2Dist < 0.065) {
    return [254, 240, 138, 255]; // Gold sparkle
  }

  return [bgR, bgG, bgB, 255];
}

// Generate sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(sz => {
  const buf = makePng(sz, sz, (x, y, w, h) => getCosmeticPixel(x, y, w, h, false));
  fs.writeFileSync(path.join(ICONS_DIR, `icon-${sz}.png`), buf);
});

// Maskable icons (full bleed)
[192, 512].forEach(sz => {
  const buf = makePng(sz, sz, (x, y, w, h) => getCosmeticPixel(x, y, w, h, true));
  fs.writeFileSync(path.join(ICONS_DIR, `icon-maskable-${sz}.png`), buf);
});

// Apple touch icon
const appleBuf = makePng(180, 180, (x, y, w, h) => getCosmeticPixel(x, y, w, h, false));
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), appleBuf);

// Favicon
const favBuf = makePng(64, 64, (x, y, w, h) => getCosmeticPixel(x, y, w, h, false));
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), favBuf);
fs.writeFileSync(path.join(ICONS_DIR, 'favicon.png'), favBuf);

// SVG Vector Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0d5c75"/>
      <stop offset="100%" stop-color="#082f49"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="25%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)"/>

  <!-- Subtle glow ring -->
  <circle cx="256" cy="270" r="170" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- Bottle Group -->
  <g filter="url(#shadow)">
    <!-- Cap -->
    <rect x="210" y="82" width="92" height="42" rx="6" fill="url(#goldGrad)"/>
    <rect x="238" y="60" width="36" height="24" rx="4" fill="url(#goldGrad)"/>
    
    <!-- Neck -->
    <rect x="220" y="124" width="72" height="36" fill="url(#bottleGrad)"/>

    <!-- Body -->
    <path d="M 174 190 Q 174 156 220 156 L 292 156 Q 338 156 338 190 L 338 386 Q 338 412 308 412 L 204 412 Q 174 412 174 386 Z" fill="url(#bottleGrad)"/>

    <!-- Emerald Pharmacy Cross -->
    <path d="M 242 245 L 270 245 L 270 270 L 295 270 L 295 298 L 270 298 L 270 323 L 242 323 L 242 298 L 217 298 L 217 270 L 242 270 Z" fill="#10b981"/>
  </g>

  <!-- Sparkles -->
  <path d="M 390 140 Q 390 160 410 160 Q 390 160 390 180 Q 390 160 370 160 Q 390 160 390 140 Z" fill="#fef08a"/>
  <path d="M 125 310 Q 125 325 140 325 Q 125 325 125 340 Q 125 325 110 325 Q 125 325 125 310 Z" fill="#fef08a"/>

  <!-- Bottom Brand Text Monogram -->
  <text x="256" y="468" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#ffffff" letter-spacing="4">BKO COSMO</text>
</svg>`;

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svgContent);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), svgContent);

console.log('✅ All PWA Icons generated successfully!');
