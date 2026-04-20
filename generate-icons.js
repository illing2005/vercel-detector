const fs = require("fs");
const zlib = require("zlib");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([len, payload, crc]);
}

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter none
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawIcon(size, palette) {
  const pixels = new Uint8Array(size * size * 4);
  const [bgR, bgG, bgB] = hexToRGB(palette.bg);
  const [fgR, fgG, fgB] = hexToRGB(palette.fg);
  const [acR, acG, acB] = hexToRGB(palette.accent);
  const radius = Math.floor(size * 0.2);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }

  function isInRoundedRect(x, y) {
    if (x >= radius && x < size - radius) return true;
    if (y >= radius && y < size - radius) return true;
    const corners = [
      [radius, radius],
      [size - radius - 1, radius],
      [radius, size - radius - 1],
      [size - radius - 1, size - radius - 1],
    ];
    for (const [cx, cy] of corners) {
      const dx = x - cx;
      const dy = y - cy;
      if (
        (x < radius || x >= size - radius) &&
        (y < radius || y >= size - radius) &&
        dx * dx + dy * dy <= radius * radius
      ) {
        return true;
      }
    }
    return false;
  }

  // Background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isInRoundedRect(x, y)) {
        setPixel(x, y, bgR, bgG, bgB, 255);
      }
    }
  }

  // Triangle (Vercel-style)
  const cx = size / 2;
  const triTop = size * 0.18;
  const triBot = size * 0.78;
  const triH = triBot - triTop;
  const triHalfW = triH * 0.55;

  for (let y = Math.floor(triTop); y <= Math.ceil(triBot); y++) {
    const progress = (y - triTop) / triH;
    const halfW = triHalfW * progress;
    const left = Math.floor(cx - halfW);
    const right = Math.ceil(cx + halfW);
    for (let x = left; x <= right; x++) {
      if (isInRoundedRect(x, y)) {
        setPixel(x, y, fgR, fgG, fgB, 255);
      }
    }
  }

  // Exclamation mark for warning colors
  if (palette.warn) {
    const excTop = Math.floor(triTop + triH * 0.3);
    const excBot = Math.floor(triTop + triH * 0.6);
    const excW = Math.max(1, Math.round(size * 0.06));
    const dotY = Math.floor(triTop + triH * 0.7);
    const dotR = Math.max(1, Math.round(size * 0.04));

    for (let y = excTop; y <= excBot; y++) {
      for (let dx = -Math.floor(excW / 2); dx <= Math.floor(excW / 2); dx++) {
        setPixel(Math.floor(cx) + dx, y, bgR, bgG, bgB, 255);
      }
    }
    for (let dy = -dotR; dy <= dotR; dy++) {
      for (let dx = -dotR; dx <= dotR; dx++) {
        if (dx * dx + dy * dy <= dotR * dotR) {
          setPixel(Math.floor(cx) + dx, dotY + dy, bgR, bgG, bgB, 255);
        }
      }
    }
  }

  return createPNG(size, size, pixels);
}

const sizes = [16, 48, 128];
const palettes = {
  gray: { bg: "#2a2a3a", fg: "#555566", accent: "#777788", warn: false },
  yellow: { bg: "#2a2518", fg: "#f59e0b", accent: "#fbbf24", warn: true },
  red: { bg: "#2a1818", fg: "#ef4444", accent: "#f87171", warn: true },
};

for (const [name, palette] of Object.entries(palettes)) {
  for (const size of sizes) {
    const png = drawIcon(size, palette);
    const path = `icons/icon-${name}-${size}.png`;
    fs.writeFileSync(path, png);
    console.log(`Generated ${path} (${png.length} bytes)`);
  }
}

console.log("All icons generated!");
