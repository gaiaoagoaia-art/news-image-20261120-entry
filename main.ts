// news-image-20261120-entry — main.ts
// EDITORIAL broadsheet front page for Friday 20 November 2026.
// Design language: EDITORIAL (epic-infographics). Composition: Editorial spread.
// Story angle: "MISSILES OVER POLAND" — Russian missiles cross into NATO Poland.
// Deterministic procedural renderer, Node stdlib only. 1024x1024 PNG.
// Palette: cream paper #FAF7F2, ink #20242C, oxblood accent #A32035,
// emerald #0D7F63, ochre #B07C1F. Seeded PRNG (one master seed, named
// sub-streams, fixed consumption order) drives paper mottle + dotted map.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const SEED = 20261120;

// ---- seeded PRNG (mulberry32), named sub-streams, fixed consumption order ----
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngMottle = mulberry32(SEED ^ 0x11);
const rngSpeckle = mulberry32(SEED ^ 0x22);
const rngMap = mulberry32(SEED ^ 0x33);
const rngArc = mulberry32(SEED ^ 0x44);

// ---- palette ----
const PAPER: RGB = [250, 247, 242];
const INK: RGB = [32, 36, 44];
const MUTED: RGB = [107, 111, 118];
const ACCENT: RGB = [163, 32, 53];
const EMERALD: RGB = [13, 127, 99];
const OCHRE: RGB = [176, 124, 31];
const SURFACE: RGB = [241, 236, 226];
const SURFACE2: RGB = [227, 220, 204];
const FAINT: RGB = [198, 191, 176];
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

// ---- canvas ----
const img = Buffer.alloc(W * H * 3);
function setPx(x: number, y: number, c: RGB) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB) {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1) {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1) {
  fillRect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}
function polyline(pts: Array<[number, number]>, c: RGB, t = 1) {
  for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t);
}
function fillPoly(pts: Array<[number, number]>, c: RGB) {
  // scanline fill
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPx(x, y, c);
  }
}
function circle(cx: number, cy: number, r: number, c: RGB, fill = true) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (fill ? d <= r : Math.abs(d - r) < 0.8) setPx(x, y, c);
    }
}
function quadBezier(p0: [number, number], p1: [number, number], p2: [number, number], n = 48): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return out;
}
function blend(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ---- 5x7 hand-rolled block font (own glyphs, uppercase-first) ----
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "\u00b7": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
  "\u2014": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
};
function glyphFor(ch: string): string[] {
  if (GLYPHS[ch]) return GLYPHS[ch];
  const up = ch.toUpperCase();
  if (GLYPHS[up]) return GLYPHS[up];
  return GLYPHS["?"];
}
function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}
function drawText(x: number, y: number, text: string, scale: number, c: RGB, bold = false) {
  let cx = x;
  for (const ch of text) {
    const g = glyphFor(ch);
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          fillRect(cx + col * scale, y + r * scale, scale + (bold ? 1 : 0), scale, c);
        }
      }
    cx += 6 * scale;
  }
}
function drawTextRight(xRight: number, y: number, text: string, scale: number, c: RGB, bold = false) {
  drawText(xRight - textWidth(text, scale), y, text, scale, c, bold);
}
function drawTextCenter(xCenter: number, y: number, text: string, scale: number, c: RGB, bold = false) {
  drawText(xCenter - Math.floor(textWidth(text, scale) / 2), y, text, scale, c, bold);
}
function wrap(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxWidth) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---- PNG encoder (zlib via node:zlib is stdlib) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", comp),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- background: seeded paper mottle (low-frequency, compresses well) ----
function paintBackground() {
  // coarse 32x32 value-noise grid, bilinear, quantized to 2-unit steps
  const GW = 33, GH = 33;
  const grid: number[] = [];
  for (let i = 0; i < GW * GH; i++) grid.push(rngMottle() * 2 - 1); // -1..1
  for (let y = 0; y < H; y++) {
    const gy = (y / H) * (GH - 1);
    const y0 = Math.floor(gy), y1 = Math.min(GH - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < W; x++) {
      const gx = (x / W) * (GW - 1);
      const x0 = Math.floor(gx), x1 = Math.min(GW - 1, x0 + 1), fx = gx - x0;
      const v =
        grid[y0 * GW + x0] * (1 - fx) * (1 - fy) +
        grid[y0 * GW + x1] * fx * (1 - fy) +
        grid[y1 * GW + x0] * (1 - fx) * fy +
        grid[y1 * GW + x1] * fx * fy;
      const d = Math.round(v * 4 / 2) * 2; // quantize: -4..4 step 2
      const i = (y * W + x) * 3;
      img[i] = PAPER[0] + d; img[i + 1] = PAPER[1] + d; img[i + 2] = PAPER[2] + d;
    }
  }
  // sparse fibre speckles (deterministic sub-stream)
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(rngSpeckle() * W);
    const y = Math.floor(rngSpeckle() * H);
    const dark = rngSpeckle() > 0.5;
    setPx(x, y, dark ? [232, 228, 216] : [255, 253, 248]);
  }
  // (flow-field arcs removed in QA: they read as stray ruled lines
  // across the masthead. Paper mottle + speckles carry the texture.)
}

const MX = 36;            // margin
const RX = W - MX;        // right edge of content

// ---- masthead / folio / kicker / headline / standfirst ----
function paintHeader() {
  drawText(MX, 10, "THE DAILY WORLD", 2, INK, true);
  drawTextRight(RX, 10, "EST. 13 NOV 2026", 2, MUTED);
  hline(MX, 30, RX - MX, INK, 1);
  drawText(MX, 38, "FRIDAY 20 NOVEMBER 2026", 5, INK, true);
  drawText(MX, 84, "THE WORLD'S NEWS OF ONE DAY", 2, INK, true);
  drawTextRight(RX, 84, "24 STORIES \u00b7 5 REGIONS \u00b7 ONE PAGE", 2, ACCENT, true);
  hline(MX, 106, RX - MX, INK, 3);
  // headline: MISSILES OVER (ink) + POLAND (oxblood)
  drawText(MX, 118, "MISSILES OVER", 7, INK, true);
  const w1 = textWidth("MISSILES OVER ", 7);
  drawText(MX + w1, 118, "POLAND", 7, ACCENT, true);
  hline(MX, 172, RX - MX, ACCENT, 2);
  drawText(MX, 182, "RUSSIAN MISSILES CROSSED INTO NATO POLAND OVERNIGHT; WARSAW COUNTS 3 OBJECTS.", 2, INK);
}

// ---- hero map panel: Poland + missile arcs ----
function paintHeroMap(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, SURFACE);
  vline(x, y, h, INK, 1); vline(x + w - 1, y, h, INK, 1);
  hline(x, y, w, INK, 1); hline(x, y + h - 1, w, INK, 1);
  drawText(x + 12, y + 8, "1 \u00b7 THE WAR TOUCHES NATO SOIL", 2, ACCENT, true);
  // simplified Poland polygon (own drawing, panel-local)
  const P: Array<[number, number]> = [
    [170, 66], [225, 52], [300, 48], [365, 60], [425, 52], [468, 72],
    [478, 112], [448, 148], [428, 176], [380, 188], [318, 176],
    [258, 184], [208, 166], [172, 128], [160, 92],
  ].map(([px, py]) => [x + px, y + py] as [number, number]);
  fillPoly(P, SURFACE2);
  polyline([...P, P[0]], INK, 2);
  // neighbours (labels only, hairline borders suggested)
  drawText(x + 96, y + 58, "BALTIC SEA", 2, MUTED);
  drawText(x + 52, y + 118, "GERMANY", 2, MUTED);
  drawText(x + 458, y + 30, "RUSSIA", 2, MUTED, true);
  drawText(x + 448, y + 150, "BELARUS", 2, MUTED);
  drawText(x + 455, y + 164, "UKRAINE", 2, MUTED);
  drawText(x + 258, y + 108, "POLAND", 3, INK, true);
  // missile arcs from the east, seeded jitter on control points
  const arcs: Array<[[number, number], [number, number], [number, number]]> = [
    [[x + 536, y + 60], [x + 470, y + 40 + rngArc() * 10], [x + 392, y + 96]],
    [[x + 536, y + 120], [x + 480, y + 118], [x + 372, y + 132]],
    [[x + 528, y + 190], [x + 450, y + 180], [x + 330, y + 158]],
  ];
  for (const [p0, p1, p2] of arcs) {
    polyline(quadBezier(p0, p1, p2), ACCENT, 2);
    // arrowhead at impact
    const end = p2;
    fillPoly([[end[0], end[1] - 7], [end[0] - 9, end[1] + 5], [end[0] + 2, end[1] + 8]], ACCENT);
    // impact starburst
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      line(end[0], end[1], end[0] + Math.round(Math.cos(a) * 10), end[1] + Math.round(Math.sin(a) * 10), ACCENT, 1);
    }
  }
  // drone marker (third object): small dashed path, emerald
  const dp = quadBezier([x + 536, y + 88], [x + 480, y + 70], [x + 420, y + 84]);
  for (let i = 0; i < dp.length; i += 4) line(dp[i][0], dp[i][1], dp[Math.min(i + 2, dp.length - 1)][0], dp[Math.min(i + 2, dp.length - 1)][1], EMERALD, 1);
  circle(x + 420, y + 84, 4, EMERALD);
  drawText(x + 12, y + h - 31, "3 OBJECTS: TWO MISSILES, ONE DRONE.", 2, INK);
  drawText(x + 12, y + h - 14, "VIOLATED POLISH AIRSPACE. CONFIRMED \u2014 AP", 2, INK, true);
}

// ---- hero 2: Anthropic slide ----
function paintHero2(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, SURFACE);
  vline(x, y, h, INK, 1); vline(x + w - 1, y, h, INK, 1);
  hline(x, y, w, INK, 1); hline(x, y + h - 1, w, INK, 1);
  drawText(x + 12, y + 8, "2 \u00b7 THE AI PARTY STUMBLES", 2, ACCENT, true);
  drawText(x + 12, y + 28, "-10%", 6, ACCENT, true);
  // sparkline right of the big number: debut high, then slide
  const sx = x + 168, sy = y + 40, sw = w - 184, sh = 28;
  drawText(sx, y + 24, "DEBUT: ABOVE $2T", 2, INK, true);
  line(sx, sy + sh, sx + sw, sy + sh, INK, 1); // baseline
  const pts: Array<[number, number]> = [
    [sx, sy + 4], [sx + sw * 0.25, sy + 7], [sx + sw * 0.45, sy + 6],
    [sx + sw * 0.6, sy + 16], [sx + sw * 0.8, sy + 23], [sx + sw, sy + 26],
  ];
  polyline(pts, ACCENT, 2);
  circle(pts[pts.length - 1][0], pts[pts.length - 1][1], 4, ACCENT);
  drawText(x + 12, y + h - 34, "ANTHROPIC SLIDES AFTER RECORD", 2, INK);
  drawText(x + 12, y + h - 17, "S&P 500, DOW NEAR CORRECTION", 2, INK);
}

// ---- hero 3: Iran waits ----
function paintHero3(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, SURFACE);
  vline(x, y, h, INK, 1); vline(x + w - 1, y, h, INK, 1);
  hline(x, y, w, INK, 1); hline(x, y + h - 1, w, INK, 1);
  drawText(x + 12, y + 8, "3 \u00b7 THE WORLD WAITS ON IRAN", 2, ACCENT, true);
  // small clock pictogram (hourglass of waiting): circle + hands
  const cx = x + w - 34, cy = y + 40;
  circle(cx, cy, 20, INK, false);
  line(cx, cy, cx + 12, cy - 8, INK, 2);
  line(cx, cy, cx - 4, cy + 12, INK, 2);
  circle(cx, cy, 3, INK);
  drawText(x + 12, y + 30, '"I AM NOT RUSHING INTO ANY', 2, INK, true);
  drawText(x + 12, y + 46, 'DECISION" \u2014 TRUMP TO AXIOS', 2, INK, true);
  drawText(x + 12, y + 68, "DECISION AFTER THE NEW YEAR;", 2, INK);
  drawText(x + 12, y + 85, "SENATE BLOCKS WAR-POWERS 51-48.", 2, INK);
}

// ---- UTC timeline strip ----
function paintTimeline(x: number, y: number, w: number) {
  drawText(x, y, "THE DAY IN UTC", 2, INK, true);
  hline(x, y + 20, w, INK, 2);
  const stops: Array<[number, string, string, string]> = [
    [0.06, "OVERNIGHT", "MISSILES CROSS", "INTO POLAND"],
    [0.34, "18:58 UTC", "AP CONFIRMS", "3 OBJECTS"],
    [0.62, "19:13 UTC", "TRUMP THREATENS", "DATA-CENTER TAX"],
    [0.88, "EVENING", "SENATE BLOCKS", "WAR-POWERS 51-48"],
  ];
  for (const [f, t, l1, l2] of stops) {
    const px = x + Math.round(f * w);
    circle(px, y + 20, 5, ACCENT);
    circle(px, y + 20, 2, WHITE);
    const lx = (txt: string) => Math.max(x, Math.min(px - Math.floor(textWidth(txt, 2) / 2), x + w - textWidth(txt, 2)));
    drawText(lx(t), y + 27, t, 2, ACCENT, true);
    drawText(lx(l1), y + 42, l1, 2, INK);
    drawText(lx(l2), y + 57, l2, 2, MUTED);
  }
}

// ---- mid stories 4-13 (two columns, numbered, hairline-ruled) ----
const MID: Array<[string, string]> = [
  ["TRUMP: NO DATA CENTERS ABROAD", "THREATENS TREMENDOUS TAX \u2014 REUTERS"],
  ["EUROPE BRISTLES AT TRILATERAL", "NO UKRAINE DEAL WITHOUT US \u2014 REUTERS"],
  ["KUSHNER: NATO FOR KYIV IF IT CEDES", "TERRITORY TO RUSSIA \u2014 WSJ"],
  ["TRUMP JOINS CALL: 'PUTIN WANTS", "TO END THE WAR' \u2014 AXIOS"],
  ["RUSSIA REJECTS NATO-STYLE", "GUARANTEES FOR UKRAINE \u2014 REUTERS"],
  ["CONGRESS RACES A SHUTDOWN", "AS IRAN WAR DIVIDES IT \u2014 REUTERS"],
  ["JUDGE BLOCKS TRUMP'S ARCH", "CALLS IT A 'RUSHED JOB' \u2014 REUTERS"],
  ["WHITE HOUSE FIRES CYBER CHIEF", "AFTER A RUN OF OUTAGES \u2014 BBC"],
  ["IRAQ MOVES ON IRAN-LINKED STRONGHOLD", "OIL-SMUGGLING PROBE \u2014 REUTERS"],
  ["FAIRFORD TRIAL SET FOR NOV 2027", "PM: IRAN LIKELY INVOLVED \u2014 REUTERS"],
];
function paintMid(x: number, y: number, w: number) {
  drawText(x, y, "THE REST OF THE DAY", 2, INK, true);
  hline(x, y + 18, w, INK, 1);
  const colW = Math.floor((w - 32) / 2);
  for (let i = 0; i < MID.length; i++) {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const cx = x + col * (colW + 32);
    const ry = y + 26 + row * 33;
    const num = String(i + 4).padStart(2, "0");
    drawText(cx, ry, num, 2, ACCENT, true);
    drawText(cx + 36, ry, MID[i][0], 2, INK, true);
    drawText(cx + 36, ry + 16, MID[i][1], 2, MUTED);
  }
}

// ---- dotted world map with numbered pins ----
const BLOBS: Array<[number, number, number, number]> = [
  // [u centre 0..1 (lon -180..180), v centre 0..1 (lat 84..-58), ru, rv] ellipses
  [0.14, 0.22, 0.085, 0.13], [0.22, 0.30, 0.07, 0.115], // N America
  [0.30, 0.58, 0.052, 0.14], [0.33, 0.72, 0.035, 0.09], // S America
  [0.50, 0.28, 0.04, 0.08], // Europe
  [0.53, 0.48, 0.058, 0.14], [0.56, 0.62, 0.04, 0.09], // Africa
  [0.62, 0.30, 0.07, 0.115], [0.72, 0.28, 0.09, 0.13], [0.82, 0.38, 0.058, 0.09], // Asia
  [0.86, 0.68, 0.046, 0.065], // Australia
  [0.475, 0.24, 0.012, 0.02], // UK
  [0.85, 0.30, 0.012, 0.025], // Japan
];
function inLand(u: number, v: number): boolean {
  for (const [cu, cv, ru, rv] of BLOBS) {
    const du = (u - cu) / ru, dv = (v - cv) / rv;
    if (du * du + dv * dv <= 1) return true;
  }
  return false;
}
const PINS: Array<[number, number, string]> = [
  // [lon -180..180, lat -58..84, label]
  [19, 52, "1"], [-100, 39, "2"], [51, 32, "3"], [10, 50, "5"],
  [44, 33, "12"], [0, 52, "13"], [-102, 20, "19"], [35, 38, "21"], [78, 21, "22"],
];
function paintWorldMap(x: number, y: number, w: number, h: number) {
  drawText(x, y, "THE WORLD AT A GLANCE \u2014 WHERE THE DAY HAPPENED", 2, INK, true);
  const my = y + 18, mh = h - 18;
  // dotted land: deterministic jittered grid (rngMap sub-stream)
  const step = 4;
  for (let gy = my; gy < my + mh; gy += step) {
    for (let gx = x; gx < x + w; gx += step) {
      const u = (gx - x) / w, v = (gy - my) / mh;
      if (inLand(u, v)) {
        const jx = gx + Math.floor((rngMap() - 0.5) * 2);
        const jy = gy + Math.floor((rngMap() - 0.5) * 2);
        fillRect(jx, jy, 2, 2, INK);
      }
    }
  }
  // pins
  for (const [lon, lat, label] of PINS) {
    const px = x + Math.round(((lon + 180) / 360) * w);
    const py = my + Math.round(((84 - lat) / 142) * mh);
    circle(px, py, 8, ACCENT);
    circle(px, py, 8, ACCENT, false);
    drawText(px - 3, py - 3, label, 1, WHITE, true);
  }
}

// ---- ALSO ON index 14-24 ----
const ALSO: string[] = [
  "ALPHABET RAISES $4.19BN IN CANADA",
  "UK FIXES FRIDGE HACK FLAW",
  "DANES 'HIRED BY RUSSIA' TO KILL RAPPER",
  "ANTHROPIC IPO BANK ENDS STABILISATION",
  "HONDA RECALLS 810,592 CARS IN US",
  "300 MIGRANTS CROSS INTO MEXICO",
  "TEXAS EXECUTION TOOK OVER AN HOUR",
  "MALAYSIA TO RESETTLE 10,000 ROHINGYA",
  "INDIA LURES RECORD FOREIGN BUYING",
  "US ARMY DELAYS IOWA DETONATION",
  "JUDGE LETS $15BN NYT SUIT PROCEED",
];
function paintAlsoOn(x: number, y: number, w: number) {
  drawText(x, y, "ALSO ON \u2014 11 MORE FROM THE DAY", 2, INK, true);
  drawTextRight(x + w, y, "BY FIELD: SEC 7 \u00b7 MKT 7 \u00b7 POL 6 \u00b7 LAW 2 \u00b7 WORLD 2", 2, MUTED);
  const colW = Math.floor((w - 32) / 2);
  for (let i = 0; i < ALSO.length; i++) {
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    const cx = x + col * (colW + 32);
    const ry = y + 22 + row * 15;
    drawText(cx, ry, String(i + 14), 2, ACCENT, true);
    drawText(cx + 30, ry, ALSO[i], 2, INK);
  }
}

// ---- DATE CHECK box (older news, explicitly NOT 20 Nov) ----
const DATECHECK: string[] = [
  "KYIV BRIDGES STRUCK \u2014 19 NOV",
  "ICJ: MYANMAR GUILTY \u2014 19 NOV",
  "TRILATERAL SUMMIT \u2014 19 NOV",
  "IPO PRICED AT $83 \u2014 18 NOV",
  "VOYAGER 1: 1 LIGHT-DAY \u2014 18 NOV",
  "GTA VI ON SALE IN NZ \u2014 19 NOV",
];
function paintDateCheck(x: number, y: number, w: number) {
  drawText(x, y, "DATE CHECK \u2014 LEFT OUT: OLDER NEWS", 2, ACCENT, true);
  const colW = Math.floor((w - 32) / 2);
  for (let i = 0; i < DATECHECK.length; i++) {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const cx = x + col * (colW + 32);
    const ry = y + 22 + row * 15;
    drawText(cx, ry, "\u00b7 " + DATECHECK[i], 2, MUTED);
  }
}

// ---- footer ----
function paintFooter(x: number, y: number, w: number) {
  hline(x, y, w, INK, 1);
  drawText(x, y + 8, "EVERY STORY HERE HAPPENED, OR WAS FIRST REPORTED, ON FRIDAY 20 NOVEMBER 2026;", 2, INK);
  drawText(x, y + 22, "CLAIMS ARE ATTRIBUTED. SOURCES: REUTERS, AP, NYT, WSJ, AXIOS, BBC, COGNOSCERE.", 2, INK);
  drawText(x, y + 36, "ORIGINAL DRAWINGS.", 2, MUTED);
}

// ---- compose ----
function main() {
  paintBackground();
  paintHeader();
  const heroY = 204, heroH = 220;
  paintHeroMap(MX, heroY, 544, heroH);
  paintHero2(592, heroY, RX - 592, 112);
  paintHero3(592, heroY + 118, RX - 592, 102);
  paintTimeline(MX, 426, RX - MX);
  paintMid(MX, 502, RX - MX);
  paintWorldMap(MX, 696, RX - MX, 80);
  paintAlsoOn(MX, 782, RX - MX);
  paintDateCheck(MX, 899, RX - MX);
  paintFooter(MX, 969, RX - MX);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), encodePNG());
}

main();
