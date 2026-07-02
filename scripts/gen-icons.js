const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const imagesDir = path.join(__dirname, '../images');
const tabDir = path.join(imagesDir, 'tab');
const iconsDir = path.join(imagesDir, 'icons');
const illustrationsDir = path.join(imagesDir, 'illustrations');

[tabDir, iconsDir, illustrationsDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const C = {
  primary: [255, 154, 139],
  primaryLight: [255, 196, 186],
  primaryDark: [232, 122, 107],
  yellow: [255, 209, 102],
  yellowDeep: [245, 185, 70],
  mint: [126, 200, 163],
  mintDeep: [88, 168, 128],
  blue: [142, 197, 255],
  blueDeep: [100, 165, 235],
  lavender: [200, 182, 255],
  lavenderDeep: [165, 145, 230],
  peach: [255, 186, 140],
  peachDeep: [235, 150, 95],
  pink: [255, 225, 234],
  cream: [255, 248, 240],
  creamDeep: [255, 236, 224],
  white: [255, 255, 255],
  ink: [72, 72, 82],
  inkSoft: [140, 140, 150],
  inkLight: [190, 190, 198],
  shadow: [255, 154, 139]
};

const ICON_THEMES = {
  milk: { from: [255, 210, 200], to: C.primary, glyph: C.white, accent: C.primaryDark },
  food: { from: [255, 236, 190], to: C.yellow, glyph: C.white, accent: C.yellowDeep },
  sleep: { from: [210, 245, 228], to: C.mint, glyph: C.white, accent: C.mintDeep },
  poop: { from: [255, 228, 200], to: C.peach, glyph: C.white, accent: C.peachDeep },
  diary: { from: [232, 222, 255], to: C.lavender, glyph: C.white, accent: C.lavenderDeep },
  calendar: { from: [255, 220, 212], to: C.primary, glyph: C.white, accent: C.primaryDark },
  'camera-add': { from: [255, 220, 212], to: C.primary, glyph: C.white, accent: C.primaryDark }
};

function crc32(data) {
  let c = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let cv = n;
    for (let k = 0; k < 8; k++) cv = (cv & 1) ? (0xedb88320 ^ (cv >>> 1)) : (cv >>> 1);
    table[n] = cv;
  }
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
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

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }

function createCanvas(W, H) {
  const pixels = new Uint8Array(W * H * 4);
  const canvas = {
    W, H,
    set(x, y, r, g, b, a = 255) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      if (a >= 255) {
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
        return;
      }
      const al = a / 255, inv = 1 - al;
      pixels[i] = Math.round(r * al + pixels[i] * inv);
      pixels[i + 1] = Math.round(g * al + pixels[i + 1] * inv);
      pixels[i + 2] = Math.round(b * al + pixels[i + 2] * inv);
      pixels[i + 3] = Math.round(255 * al + pixels[i + 3] * inv);
    },
    plot(fn, r, g, b, a = 255) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) if (fn(x, y)) this.set(x, y, r, g, b, a);
      }
    },
    fillRect(x, y, w, h, r, g, b, a = 255) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, r, g, b, a);
    },
    fillRoundRect(x, y, w, h, rad, r, g, b, a = 255) {
      const rr = Math.min(rad, w / 2, h / 2);
      canvas.plot((px, py) => {
        if (px < x || py < y || px >= x + w || py >= y + h) return false;
        const dx = px < x + rr ? x + rr - px : px >= x + w - rr ? px - (x + w - rr - 1) : 0;
        const dy = py < y + rr ? y + rr - py : py >= y + h - rr ? py - (y + h - rr - 1) : 0;
        return dx * dx + dy * dy <= rr * rr;
      }, r, g, b, a);
    },
    fillCircle(cx, cy, radius, r, g, b, a = 255) {
      const r2 = radius * radius;
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.set(x, y, r, g, b, a);
        }
      }
    },
    fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
      for (let y = cy - ry; y <= cy + ry; y++) {
        for (let x = cx - rx; x <= cx + rx; x++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, r, g, b, a);
        }
      }
    },
    fillRadial(cx, cy, radius, inner, outer, a = 255) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          const d = dist(x, y, cx, cy);
          if (d <= radius) this.set(x, y, ...mix(inner, outer, (d / radius) ** 0.85), a);
        }
      }
    },
    fillLinear(x, y, w, h, top, bottom, a = 255) {
      for (let dy = 0; dy < h; dy++) {
        const col = mix(top, bottom, dy / Math.max(1, h - 1));
        for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, ...col, a);
      }
    },
    fillTriangle(x1, y1, x2, y2, x3, y3, r, g, b, a = 255) {
      const minY = Math.max(0, Math.min(y1, y2, y3));
      const maxY = Math.min(H - 1, Math.max(y1, y2, y3));
      const minX = Math.max(0, Math.min(x1, x2, x3));
      const maxX = Math.min(W - 1, Math.max(x1, x2, x3));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const w1 = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1);
          const w2 = (x3 - x2) * (y - y2) - (x - x2) * (y3 - y2);
          const w3 = (x1 - x3) * (y - y3) - (x - x3) * (y1 - y3);
          const neg = w1 < 0 || w2 < 0 || w3 < 0;
          const pos = w1 > 0 || w2 > 0 || w3 > 0;
          if (!(neg && pos)) this.set(x, y, r, g, b, a);
        }
      }
    },
    strokeLine(x1, y1, x2, y2, thick, r, g, b, a = 255) {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        this.fillCircle(x, y, thick / 2, r, g, b, a);
      }
    },
    strokeRoundRect(x, y, w, h, rad, thick, r, g, b, a = 255) {
      const ow = w + thick * 2;
      const oh = h + thick * 2;
      const outer = createCanvas(ow, oh);
      outer.fillRoundRect(0, 0, ow, oh, rad + thick, 255, 255, 255);
      const inner = createCanvas(w, h);
      inner.fillRoundRect(0, 0, w, h, rad, 255, 255, 255);
      for (let py = 0; py < oh; py++) {
        for (let px = 0; px < ow; px++) {
          const oi = (py * ow + px) * 4;
          if (outer.pixels[oi + 3] === 0) continue;
          const ix = px - thick;
          const iy = py - thick;
          const innerAlpha = ix >= 0 && iy >= 0 && ix < w && iy < h ? inner.pixels[(iy * w + ix) * 4 + 3] : 0;
          if (innerAlpha === 0) this.set(x + px, y + py, r, g, b, a);
        }
      }
    },
    toPng() {
      const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(W, 0);
      ihdr.writeUInt32BE(H, 4);
      ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
      const raw = Buffer.alloc((1 + W * 4) * H);
      for (let y = 0; y < H; y++) {
        const off = y * (1 + W * 4);
        raw[off] = 0;
        for (let x = 0; x < W; x++) {
          const pi = (y * W + x) * 4;
          const i = off + 1 + x * 4;
          raw[i] = pixels[pi]; raw[i + 1] = pixels[pi + 1]; raw[i + 2] = pixels[pi + 2]; raw[i + 3] = pixels[pi + 3];
        }
      }
      return Buffer.concat([sig, mkChunk('IHDR', ihdr), mkChunk('IDAT', zlib.deflateSync(raw)), mkChunk('IEND', Buffer.alloc(0))]);
    }
  };
  canvas.pixels = pixels;
  return canvas;
}

function writePng(file, canvas) { fs.writeFileSync(file, canvas.toPng()); }
function u(v, size, base) { return v * size / base; }
function px(v, size, base = 48) { return Math.round(u(v, size, base)); }

function downscale(src, outW, outH) {
  const scale = src.W / outW;
  const dst = createCanvas(outW, outH);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const sx = Math.floor(x * scale);
      const sy = Math.floor(y * scale);
      const ex = Math.min(src.W, Math.ceil((x + 1) * scale));
      const ey = Math.min(src.H, Math.ceil((y + 1) * scale));
      for (let py = sy; py < ey; py++) {
        for (let px0 = sx; px0 < ex; px0++) {
          const i = (py * src.W + px0) * 4;
          r += src.pixels[i];
          g += src.pixels[i + 1];
          b += src.pixels[i + 2];
          a += src.pixels[i + 3];
          n++;
        }
      }
      if (n) dst.set(x, y, Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n));
    }
  }
  return dst;
}

function renderHiRes(outW, outH, scale, drawFn) {
  const big = createCanvas(outW * scale, outH * scale);
  drawFn(big, scale);
  return downscale(big, outW, outH);
}

function fillCircleAA(c, cx, cy, radius, r, g, b, a = 255) {
  const bound = Math.ceil(radius + 1.5);
  for (let y = cy - bound; y <= cy + bound; y++) {
    for (let x = cx - bound; x <= cx + bound; x++) {
      const d = dist(x, y, cx, cy);
      if (d <= radius + 1) {
        const edge = d > radius ? radius + 1 - d : 1;
        c.set(x, y, r, g, b, Math.round(a * Math.max(0, Math.min(1, edge))));
      }
    }
  }
}

function layeredShadow(c, cx, cy, rx, ry, color, layers = 3) {
  for (let i = layers; i >= 1; i--) {
    const t = i / layers;
    c.fillEllipse(cx, cy + ry * 0.25 * t, rx * (0.7 + t * 0.35), ry * 0.35 * t, ...color, Math.round(16 * t));
  }
}

function softShadow(c, cx, cy, rx, ry, color, a = 35) {
  layeredShadow(c, cx, cy, rx, ry, color, 4);
  c.fillEllipse(cx, cy + ry * 0.35, rx, ry * 0.45, ...color, a);
}

function drawSquirclePlate(c, theme) {
  const s = c.W;
  const cx = s / 2;
  const cy = s / 2;
  const plate = px(22, s, 48);
  layeredShadow(c, cx, cy + px(3, s), plate * 0.95, px(5, s), theme.to, 3);
  c.fillRoundRect(cx - plate, cy - plate, plate * 2, plate * 2, px(10, s), ...mix(theme.from, theme.to, 0.1));
  for (let y = cy - plate; y < cy + plate; y++) {
    for (let x = cx - plate; x < cx + plate; x++) {
      const nx = (x - (cx - plate)) / (plate * 2);
      const ny = (y - (cy - plate)) / (plate * 2);
      const col = mix(mix(theme.from, theme.to, nx * 0.45), mix(theme.to, theme.accent, 0.15), ny * 0.75);
      const dx = x < cx - plate + px(10, s) ? cx - plate + px(10, s) - x : x >= cx + plate - px(10, s) ? x - (cx + plate - px(10, s) - 1) : 0;
      const dy = y < cy - plate + px(10, s) ? cy - plate + px(10, s) - y : y >= cy + plate - px(10, s) ? y - (cy + plate - px(10, s) - 1) : 0;
      if (dx * dx + dy * dy <= px(10, s) ** 2) c.set(x, y, ...col);
    }
  }
  c.fillRoundRect(cx - plate + px(2, s), cy - plate + px(2, s), plate * 2 - px(4, s), px(10, s), px(5, s), ...C.white, 70);
  c.strokeRoundRect(cx - plate, cy - plate, plate * 2, plate * 2, px(10, s), 1, ...C.white, 45);
  fillCircleAA(c, cx - plate * 0.45, cy - plate * 0.55, px(5, s), ...C.white, 55);
}

function drawStar(c, x, y, r, color, a = 220) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? r * 0.42 : r;
    pts.push([x + Math.cos(ang) * rad, y + Math.sin(ang) * rad]);
  }
  for (let y0 = y - r; y0 <= y + r; y0++) {
    for (let x0 = x - r; x0 <= x + r; x0++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y0) !== (yj > y0) && x0 < ((xj - xi) * (y0 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) c.set(x0, y0, ...color, a);
    }
  }
}

function drawCloud(c, x, y, scale, color, a = 255) {
  const r = (n) => Math.round(n * scale);
  c.fillEllipse(x + r(12), y + r(8), r(18), r(4), ...mix(color, C.inkLight, 0.85), Math.round(a * 0.18));
  fillCircleAA(c, x, y, r(10), ...color, a);
  fillCircleAA(c, x + r(12), y - r(2), r(8), ...color, a);
  fillCircleAA(c, x + r(24), y, r(9), ...color, a);
  c.fillRoundRect(x - r(8), y, r(40), r(10), r(5), ...color, a);
}

function drawSun(c, x, y, radius) {
  fillCircleAA(c, x, y, radius * 1.35, ...C.yellow, 28);
  fillCircleAA(c, x, y, radius, ...mix(C.yellow, [255, 240, 180], 0.2));
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const x1 = x + Math.cos(ang) * radius * 1.15;
    const y1 = y + Math.sin(ang) * radius * 1.15;
    const x2 = x + Math.cos(ang) * radius * 1.55;
    const y2 = y + Math.sin(ang) * radius * 1.55;
    c.strokeLine(x1, y1, x2, y2, Math.max(2, radius * 0.12), ...C.yellow, 120);
  }
}

function drawHeart(c, x, y, size, color, a = 200) {
  fillCircleAA(c, x - size * 0.28, y - size * 0.1, size * 0.32, ...color, a);
  fillCircleAA(c, x + size * 0.28, y - size * 0.1, size * 0.32, ...color, a);
  c.fillTriangle(x, y + size * 0.55, x - size * 0.55, y - size * 0.02, x + size * 0.55, y - size * 0.02, ...color, a);
}

function drawBokeh(c, points) {
  points.forEach(([x, y, r, col, a]) => fillCircleAA(c, x, y, r, ...col, a));
}

/* ─── Tab icons: same outline style, color only changes ─── */

function drawTabIcon(c, active, drawFn) {
  drawFn(c, c.W, active ? C.primary : C.inkLight);
}

function tabHome(c, s, color) {
  const cx = s / 2;
  const thick = px(2.5, s);
  c.strokeLine(px(14, s), px(20, s), cx, px(10, s), thick, ...color);
  c.strokeLine(cx, px(10, s), px(34, s), px(20, s), thick, ...color);
  c.strokeRoundRect(px(14, s), px(20, s), px(20, s), px(18, s), px(3, s), thick, ...color);
  c.fillRoundRect(px(20, s), px(28, s), px(8, s), px(10, s), px(2, s), ...color);
}

function tabRecords(c, s, color) {
  const thick = px(2.5, s);
  c.strokeRoundRect(px(12, s), px(8, s), px(24, s), px(32, s), px(5, s), thick, ...color);
  [18, 23, 28, 33].forEach((y) => c.fillRoundRect(px(18, s), px(y, s), px(12, s), px(2, s), 1, ...color));
}

function tabStats(c, s, color) {
  const pts = [[12, 32], [20, 24], [28, 28], [36, 14]];
  const thick = px(2.5, s);
  for (let i = 0; i < pts.length - 1; i++) {
    c.strokeLine(px(pts[i][0], s), px(pts[i][1], s), px(pts[i + 1][0], s), px(pts[i + 1][1], s), thick, ...color);
  }
  pts.forEach(([x, y]) => fillCircleAA(c, px(x, s), px(y, s), px(2.5, s), ...color));
  c.strokeLine(px(10, s), px(36, s), px(38, s), px(36, s), thick, ...color);
}

function tabFamily(c, s, color) {
  fillCircleAA(c, px(24, s), px(16, s), px(6, s), ...color);
  c.fillRoundRect(px(18, s), px(24, s), px(12, s), px(10, s), px(4, s), ...color);
  fillCircleAA(c, px(14, s), px(26, s), px(4.5, s), ...color);
  fillCircleAA(c, px(34, s), px(26, s), px(4.5, s), ...color);
}

/* ─── Function icons ─── */

function fillCrescent(c, cx, cy, radius, shift, r, g, b, a = 255) {
  const cut = radius * 0.82;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const d1 = dist(x, y, cx, cy);
      const d2 = dist(x, y, cx + shift, cy - shift * 0.15);
      if (d1 <= radius && d2 >= cut) c.set(x, y, r, g, b, a);
    }
  }
}

function drawGlyphBowl(c, cx, cy, rx, ry, g, accent) {
  c.fillEllipse(cx, cy - ry * 0.55, rx, ry * 0.45, ...g);
  c.fillRoundRect(cx - rx, cy - ry * 0.35, rx * 2, ry * 1.15, ry * 0.35, ...g);
  c.fillEllipse(cx - rx * 0.35, cy - ry * 0.1, rx * 0.28, ry * 0.12, ...C.white, 90);
  c.fillEllipse(cx, cy + ry * 0.15, rx * 0.72, ry * 0.42, ...accent, 75);
}

function iconMilk(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  const g = t.glyph;
  const cx = px(24, s);
  fillCircleAA(c, cx, px(11, s), px(4, s), ...g);
  c.fillRoundRect(cx - px(3, s), px(11, s), px(6, s), px(3, s), px(1.5, s), ...g);
  c.fillRoundRect(cx - px(5, s), px(14, s), px(10, s), px(4, s), px(2, s), ...g);
  c.fillRoundRect(cx - px(9, s), px(17, s), px(18, s), px(18, s), px(5, s), ...g);
  c.fillRoundRect(cx - px(10, s), px(33, s), px(20, s), px(4, s), px(2, s), ...mix(g, t.accent, 0.08));
  c.fillRoundRect(cx - px(7, s), px(22, s), px(14, s), px(12, s), px(4, s), ...t.accent, 82);
  c.fillRoundRect(cx - px(7, s), px(30, s), px(14, s), px(4, s), px(2, s), ...mix(t.accent, g, 0.15));
  fillCircleAA(c, cx - px(4, s), px(20, s), px(1.8, s), ...C.white, 130);
  fillCircleAA(c, cx - px(5, s), px(26, s), px(1.2, s), ...C.white, 90);
  c.fillRoundRect(cx - px(1, s), px(24, s), px(5, s), px(1.5, s), px(1, s), ...g, 120);
  c.fillRoundRect(cx + px(2, s), px(27, s), px(4, s), px(1.5, s), px(1, s), ...g, 100);
}

function iconFood(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  const g = t.glyph;
  drawGlyphBowl(c, px(22, s), px(31, s), px(13, s), px(10, s), g, t.accent);
  fillCircleAA(c, px(20, s), px(29, s), px(3.5, s), ...mix(t.accent, C.yellow, 0.2));
  fillCircleAA(c, px(25, s), px(31, s), px(2.5, s), ...mix(g, t.accent, 0.25), 90);
  c.strokeLine(px(33, s), px(10, s), px(28, s), px(24, s), px(2.2, s), ...g);
  fillCircleAA(c, px(33, s), px(9, s), px(3.5, s), ...g);
  [[16, 8], [22, 6], [28, 8]].forEach(([x, y], i) => {
    c.fillEllipse(px(x, s), px(y, s), px(1.6, s), px(3.8, s), ...g, 165 - i * 20);
  });
}

function iconSleep(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  const g = t.glyph;
  fillCrescent(c, px(25, s), px(22, s), px(11, s), px(7, s), ...g);
  fillCircleAA(c, px(20, s), px(18, s), px(1.2, s), ...mix(g, C.white, 0.55), 180);
  drawStar(c, px(14, s), px(12, s), px(3.2, s), g, 210);
  drawStar(c, px(36, s), px(14, s), px(2.4, s), g, 175);
  drawStar(c, px(32, s), px(28, s), px(1.8, s), g, 140);
  c.fillRoundRect(px(13, s), px(34, s), px(5, s), px(2, s), px(1, s), ...g, 170);
  c.fillRoundRect(px(21, s), px(38, s), px(6, s), px(2, s), px(1, s), ...g, 150);
  c.fillRoundRect(px(30, s), px(35, s), px(5, s), px(2, s), px(1, s), ...g, 130);
}

function iconPoop(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  const g = t.glyph;
  const layers = [
    { y: 33, rx: 11, ry: 8 },
    { y: 24, rx: 8.5, ry: 6.5 },
    { y: 16, rx: 6, ry: 5 }
  ];
  layers.forEach((layer, i) => {
    const col = mix(g, t.accent, i * 0.14);
    c.fillEllipse(px(24, s), px(layer.y, s), px(layer.rx, s), px(layer.ry, s), ...col);
    fillCircleAA(c, px(24, s), px(layer.y, s), px(layer.ry * 0.75, s), ...col);
    c.fillEllipse(px(20, s), px(layer.y - 1, s), px(3, s), px(1.6, s), ...C.white, 75 - i * 12);
  });
  fillCircleAA(c, px(21, s), px(14, s), px(1.1, s), ...t.accent, 130);
  fillCircleAA(c, px(27, s), px(14, s), px(1.1, s), ...t.accent, 130);
  c.fillEllipse(px(24, s), px(17, s), px(2.2, s), px(1.2, s), ...mix(t.accent, C.white, 0.2), 110);
}

function iconDiary(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  c.fillRoundRect(px(14, s), px(10, s), px(20, s), px(28, s), px(3, s), ...t.glyph);
  c.fillRoundRect(px(17, s), px(14, s), px(14, s), px(22, s), px(2, s), ...t.accent, 45);
  [18, 22, 26, 30].forEach((y) => c.fillRoundRect(px(19, s), px(y, s), px(10, s), px(2, s), 1, ...t.accent, 100));
  c.fillCircle(px(30, s), px(32, s), px(4, s), ...t.accent, 80);
}

function iconCalendar(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  c.fillRoundRect(px(12, s), px(12, s), px(24, s), px(26, s), px(4, s), ...t.glyph);
  c.fillRoundRect(px(12, s), px(12, s), px(24, s), px(8, s), px(3, s), ...t.accent);
  [16, 28].forEach((x) => c.fillRoundRect(px(x, s), px(8, s), px(2, s), px(6, s), 1, ...t.accent));
  [[16, 22], [22, 22], [28, 22], [16, 28], [22, 28]].forEach(([x, y]) => c.fillRoundRect(px(x, s), px(y, s), px(4, s), px(4, s), 1, ...t.accent, 90));
}

function iconCamera(c, t) {
  drawSquirclePlate(c, t);
  const s = c.W;
  c.fillRoundRect(px(10, s), px(16, s), px(28, s), px(20, s), px(4, s), ...t.glyph);
  c.fillRoundRect(px(18, s), px(12, s), px(10, s), px(6, s), px(2, s), ...t.glyph);
  c.fillCircle(px(24, s), px(26, s), px(7, s), ...t.accent, 70);
  c.fillCircle(px(24, s), px(26, s), px(5, s), ...t.glyph);
  c.fillRoundRect(px(30, s), px(8, s), px(10, s), px(3, s), px(1, s), ...t.glyph);
  c.fillRoundRect(px(34, s), px(5, s), px(3, s), px(9, s), px(1, s), ...t.glyph);
}

/* ─── Illustrations ─── */

function ill(v, size, base = 240) { return Math.round(v * size / base); }

function drawSceneBase(c, bgTop, bgBottom, accent) {
  const s = c.W;
  c.fillLinear(0, 0, s, s, bgTop, bgBottom);
  fillCircleAA(c, ill(120, s), ill(60, s), ill(70, s), ...mix(bgTop, C.white, 0.35), 35);
  drawBokeh(c, [
    [ill(36, s), ill(170, s), ill(10, s), accent, 18],
    [ill(196, s), ill(150, s), ill(14, s), accent, 14],
    [ill(170, s), ill(188, s), ill(8, s), C.white, 22]
  ]);
  layeredShadow(c, ill(120, s), ill(200, s), ill(88, s), ill(18, s), accent, 3);
  c.fillEllipse(ill(120, s), ill(198, s), ill(88, s), ill(18, s), ...accent, 35);
  drawCloud(c, ill(42, s), ill(48, s), ill(1, s), C.white, 220);
  drawCloud(c, ill(168, s), ill(56, s), ill(0.85, s), C.white, 190);
}

function drawBabyHead(c, cx, cy, r) {
  fillCircleAA(c, cx, cy, r + 2, ...C.primary, 18);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const d = dist(x, y, cx, cy);
      if (d <= r) {
        const shade = mix(mix(C.primaryLight, C.yellow, 0.1), C.primaryDark, (d / r) ** 1.6 * 0.22);
        c.set(x, y, ...shade);
      }
    }
  }
  c.fillEllipse(cx - r * 0.34, cy + r * 0.18, r * 0.2, r * 0.11, ...C.primary, 48);
  c.fillEllipse(cx + r * 0.34, cy + r * 0.18, r * 0.2, r * 0.11, ...C.primary, 48);
  fillCircleAA(c, cx - r * 0.3, cy - r * 0.08, r * 0.1, ...C.ink);
  fillCircleAA(c, cx + r * 0.3, cy - r * 0.08, r * 0.1, ...C.ink);
  fillCircleAA(c, cx - r * 0.26, cy - r * 0.12, r * 0.035, ...C.white);
  fillCircleAA(c, cx + r * 0.34, cy - r * 0.12, r * 0.035, ...C.white);
  c.fillEllipse(cx, cy + r * 0.24, r * 0.14, r * 0.08, ...C.primaryDark, 100);
  fillCircleAA(c, cx, cy + r * 0.21, r * 0.03, ...C.white, 150);
  c.fillRoundRect(cx - r * 0.06, cy - r * 0.52, r * 0.12, r * 0.16, r * 0.04, ...mix(C.primary, C.yellow, 0.25));
  fillCircleAA(c, cx - r * 0.42, cy - r * 0.02, r * 0.07, ...C.primary, 38);
  fillCircleAA(c, cx + r * 0.42, cy - r * 0.02, r * 0.07, ...C.primary, 38);
  fillCircleAA(c, cx - r * 0.55, cy - r * 0.35, r * 0.08, ...mix(C.primary, C.yellow, 0.2), 80);
  fillCircleAA(c, cx + r * 0.5, cy - r * 0.3, r * 0.07, ...mix(C.primary, C.yellow, 0.2), 70);
}

function drawCard(c, x, y, w, h, rad, fill, shadowColor) {
  layeredShadow(c, x + w / 2, y + h + 4, w * 0.42, h * 0.08, shadowColor, 3);
  c.fillRoundRect(x, y, w, h, rad, ...fill);
  c.fillRoundRect(x + 2, y + 2, w - 4, Math.min(h * 0.18, 18), rad, ...C.white, 55);
  c.strokeRoundRect(x, y, w, h, rad, 1, ...C.white, 70);
}

function drawWelcome(c) {
  const s = c.W;
  drawSceneBase(c, [255, 244, 236], C.cream, C.primary);
  drawSun(c, ill(196, s), ill(48, s), ill(16, s));
  drawCard(c, ill(64, s), ill(112, s), ill(112, s), ill(64, s), ill(16, s), C.white, C.primary);
  c.fillRoundRect(ill(74, s), ill(124, s), ill(92, s), ill(40, s), ill(12, s), ...C.pink);
  c.fillRoundRect(ill(82, s), ill(132, s), ill(76, s), ill(8, s), ill(4, s), ...mix(C.primaryLight, C.white, 0.4), 90);
  drawBabyHead(c, ill(120, s), ill(108, s), ill(28, s));

  drawCard(c, ill(148, s), ill(124, s), ill(40, s), ill(48, s), ill(10, s), mix(C.primaryLight, C.white, 0.35), C.primary);
  fillCircleAA(c, ill(168, s), ill(118, s), ill(12, s), ...mix(C.primaryLight, C.white, 0.35));
  drawBabyHead(c, ill(168, s), ill(136, s), ill(14, s));

  drawStar(c, ill(52, s), ill(72, s), ill(7, s), C.yellow);
  drawStar(c, ill(188, s), ill(96, s), ill(5, s), C.mint);
  drawHeart(c, ill(44, s), ill(128, s), ill(8, s), C.primary, 120);
  drawHeart(c, ill(200, s), ill(120, s), ill(6, s), C.lavender, 100);
}

function drawBabyAvatar(c) {
  const s = c.W;
  const cx = s / 2;
  const cy = s / 2 + ill(4, s);
  fillCircleAA(c, cx, cy, ill(92, s), ...C.pink, 60);
  c.fillRadial(cx, cy, ill(92, s), C.pink, [255, 250, 245]);
  c.fillRadial(cx, cy, ill(68, s), C.white, C.pink);
  for (let a = 0; a < 360; a += 1) {
    const rad = ill(66, s);
    const x = cx + Math.cos((a * Math.PI) / 180) * rad;
    const y = cy + Math.sin((a * Math.PI) / 180) * rad;
    const t = 0.5 + 0.5 * Math.sin(a * 3 * Math.PI / 180);
    c.set(x, y, ...mix(C.primaryLight, C.primary, t * 0.25), 95);
  }
  drawBabyHead(c, cx, cy, ill(48, s));
  drawStar(c, ill(44, s), ill(52, s), ill(6, s), C.yellow, 170);
  drawStar(c, ill(196, s), ill(64, s), ill(4, s), C.lavender, 150);
  drawHeart(c, ill(58, s), ill(180, s), ill(5, s), C.primary, 90);
}

function drawEmptyFamily(c) {
  const s = c.W;
  drawSceneBase(c, [255, 241, 245], C.cream, C.lavender);
  drawCard(c, ill(68, s), ill(88, s), ill(104, s), ill(96, s), ill(14, s), C.white, C.lavender);
  c.fillRoundRect(ill(80, s), ill(100, s), ill(80, s), ill(72, s), ill(10, s), ...C.pink);

  const drawPerson = (x, y, r, color) => {
    fillCircleAA(c, x, y - r * 1.1, r * 0.55, ...color);
    c.fillRoundRect(x - r * 0.75, y - r * 0.2, r * 1.5, r * 1.2, r * 0.45, ...color);
  };
  drawPerson(ill(96, s), ill(148, s), ill(16, s), C.primary);
  drawPerson(ill(144, s), ill(148, s), ill(16, s), C.primaryDark);
  drawBabyHead(c, ill(120, s), ill(132, s), ill(20, s));
  drawHeart(c, ill(120, s), ill(88, s), ill(7, s), C.primary, 130);
  drawStar(c, ill(56, s), ill(96, s), ill(5, s), C.lavender, 160);
}

function drawEmptyRecord(c) {
  const s = c.W;
  drawSceneBase(c, [255, 250, 238], C.cream, C.yellow);
  drawCard(c, ill(74, s), ill(68, s), ill(92, s), ill(112, s), ill(12, s), C.white, C.yellow);
  c.fillRoundRect(ill(82, s), ill(78, s), ill(76, s), ill(92, s), ill(8, s), ...[255, 252, 245]);
  c.fillRoundRect(ill(74, s), ill(68, s), ill(92, s), ill(18, s), ill(6, s), ...C.yellow);
  c.fillLinear(ill(74, s), ill(68, s), ill(92, s), ill(18, s), mix(C.yellow, C.white, 0.2), C.yellow);
  [96, 108, 120, 132, 144].forEach((y, i) => c.fillRoundRect(ill(90, s), ill(y, s), ill(60 - i * 8, s), ill(4, s), ill(2, s), ...C.yellow, 75));
  fillCircleAA(c, ill(146, s), ill(132, s), ill(14, s), ...C.primary, 55);
  c.fillRoundRect(ill(132, s), ill(148, s), ill(28, s), ill(8, s), ill(4, s), ...C.mint, 95);
  drawStar(c, ill(60, s), ill(88, s), ill(4, s), C.yellow, 150);
}

function drawEmptyStats(c) {
  const s = c.W;
  drawSceneBase(c, [240, 250, 255], C.cream, C.blue);
  drawCard(c, ill(52, s), ill(64, s), ill(136, s), ill(112, s), ill(14, s), C.white, C.blue);
  c.fillRoundRect(ill(62, s), ill(74, s), ill(116, s), ill(86, s), ill(8, s), ...[248, 252, 255]);
  const pts = [[72, 140], [96, 118], [120, 126], [144, 92], [168, 102]];
  for (let i = 0; i < pts.length - 1; i++) {
    c.strokeLine(ill(pts[i][0], s), ill(pts[i][1], s), ill(pts[i + 1][0], s), ill(pts[i + 1][1], s), ill(4, s), ...C.mint);
  }
  pts.forEach(([x, y]) => {
    fillCircleAA(c, ill(x, s), ill(y, s), ill(5, s), ...C.mint);
    fillCircleAA(c, ill(x, s), ill(y, s), ill(2, s), ...C.white);
  });
  c.strokeLine(ill(68, s), ill(148, s), ill(172, s), ill(148, s), ill(2.5, s), ...C.inkLight);
  c.fillRoundRect(ill(88, s), ill(168, s), ill(64, s), ill(6, s), ill(3, s), ...C.blue, 65);
  drawStar(c, ill(184, s), ill(76, s), ill(5, s), C.blue, 160);
}

/* ─── Export ─── */

const tabs = { home: tabHome, records: tabRecords, stats: tabStats, family: tabFamily };
Object.keys(tabs).forEach((name) => {
  [false, true].forEach((active) => {
    const canvas = renderHiRes(81, 81, 3, (c) => drawTabIcon(c, active, tabs[name]));
    writePng(path.join(tabDir, `${name}${active ? '-active' : ''}.png`), canvas);
  });
});

const icons = {
  milk: iconMilk, food: iconFood, sleep: iconSleep, poop: iconPoop,
  diary: iconDiary, calendar: iconCalendar, 'camera-add': iconCamera
};
Object.entries(icons).forEach(([name, fn]) => {
  const canvas = renderHiRes(96, 96, 3, (c) => fn(c, ICON_THEMES[name]));
  writePng(path.join(iconsDir, `${name}.png`), canvas);
});

const illustrations = {
  'baby-avatar': drawBabyAvatar,
  welcome: drawWelcome,
  'empty-family': drawEmptyFamily,
  'empty-record': drawEmptyRecord,
  'empty-stats': drawEmptyStats
};
Object.entries(illustrations).forEach(([name, fn]) => {
  const canvas = renderHiRes(240, 240, 2, fn);
  writePng(path.join(illustrationsDir, `${name}.png`), canvas);
});

console.log('Images beautified:', { tabDir, iconsDir, illustrationsDir });
