const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = path.join(__dirname, '../images/tab');
fs.mkdirSync(dir, { recursive: true });

const W = 81;
const H = 81;

const COLORS = {
  normal: [153, 153, 153],
  active: [255, 154, 139]
};

function crc32(data) {
  let c = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let cv = n;
    for (let k = 0; k < 8; k++) cv = (cv & 1) ? (0xedb88320 ^ (cv >>> 1)) : (cv >>> 1);
    table[n] = cv;
  }
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function mkChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

function createCanvas() {
  const pixels = new Uint8Array(W * H * 4);
  return {
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    },
    fillRect(x, y, w, h, r, g, b, a = 255) {
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.set(x + dx, y + dy, r, g, b, a);
        }
      }
    },
    fillCircle(cx, cy, radius, r, g, b, a = 255) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
            this.set(x, y, r, g, b, a);
          }
        }
      }
    },
    fillTriangle(x1, y1, x2, y2, x3, y3, r, g, b, a = 255) {
      const minY = Math.max(0, Math.min(y1, y2, y3));
      const maxY = Math.min(H - 1, Math.max(y1, y2, y3));
      const minX = Math.max(0, Math.min(x1, x2, x3));
      const maxX = Math.min(W - 1, Math.max(x1, x2, x3));
      const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
      if (area === 0) return;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const w1 = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1);
          const w2 = (x3 - x2) * (y - y2) - (x - x2) * (y3 - y2);
          const w3 = (x1 - x3) * (y - y3) - (x - x3) * (y1 - y3);
          const hasNeg = (w1 < 0) || (w2 < 0) || (w3 < 0);
          const hasPos = (w1 > 0) || (w2 > 0) || (w3 > 0);
          if (!(hasNeg && hasPos)) this.set(x, y, r, g, b, a);
        }
      }
    },
    toPng() {
      const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(W, 0);
      ihdr.writeUInt32BE(H, 4);
      ihdr[8] = 8;
      ihdr[9] = 6;
      ihdr[10] = 0;
      ihdr[11] = 0;
      ihdr[12] = 0;

      const raw = Buffer.alloc((1 + W * 4) * H);
      for (let y = 0; y < H; y++) {
        const off = y * (1 + W * 4);
        raw[off] = 0;
        for (let x = 0; x < W; x++) {
          const pi = (y * W + x) * 4;
          const i = off + 1 + x * 4;
          raw[i] = pixels[pi];
          raw[i + 1] = pixels[pi + 1];
          raw[i + 2] = pixels[pi + 2];
          raw[i + 3] = pixels[pi + 3];
        }
      }

      return Buffer.concat([
        sig,
        mkChunk('IHDR', ihdr),
        mkChunk('IDAT', zlib.deflateSync(raw)),
        mkChunk('IEND', Buffer.alloc(0))
      ]);
    }
  };
}

function drawHome(c, [r, g, b]) {
  c.fillTriangle(40, 14, 18, 36, 62, 36, r, g, b);
  c.fillRect(24, 36, 32, 30, r, g, b);
  c.fillRect(34, 48, 12, 18, 255, 255, 255, 255);
}

function drawRecords(c, [r, g, b]) {
  c.fillRect(22, 16, 36, 48, r, g, b);
  c.fillRect(26, 20, 28, 40, 255, 255, 255, 255);
  [28, 36, 44, 52].forEach((y) => c.fillRect(30, y, 20, 3, r, g, b));
  c.fillRect(30, 24, 12, 3, r, g, b);
}

function drawStats(c, [r, g, b]) {
  c.fillRect(18, 48, 12, 16, r, g, b);
  c.fillRect(34, 36, 12, 28, r, g, b);
  c.fillRect(50, 24, 12, 40, r, g, b);
  c.fillRect(16, 62, 48, 3, r, g, b);
}

function drawFamily(c, [r, g, b]) {
  c.fillCircle(40, 26, 10, r, g, b);
  c.fillRect(26, 40, 28, 22, r, g, b);
  c.fillRect(22, 40, 8, 14, r, g, b);
  c.fillRect(50, 40, 8, 14, r, g, b);
}

const drawers = {
  home: drawHome,
  records: drawRecords,
  stats: drawStats,
  family: drawFamily
};

Object.keys(drawers).forEach((name) => {
  Object.entries(COLORS).forEach(([state, color]) => {
    const canvas = createCanvas();
    drawers[name](canvas, color);
    const suffix = state === 'active' ? '-active' : '';
    fs.writeFileSync(path.join(dir, `${name}${suffix}.png`), canvas.toPng());
  });
});

console.log('Tab icons created in', dir);
