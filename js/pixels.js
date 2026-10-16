// Pixel art: kitty sprites, kitty hearts, and little icons.

// ---------- helpers ----------
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function lum(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

// Turns a grid of characters into an SVG path made of 1x1 squares.
export function gridPath(rows, chars) {
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (chars.includes(row[x])) d += `M${x} ${y}h1v1h-1z`;
  });
  return d;
}

// Adds a 1 pixel outline ("O") around every filled cell.
function outlined(rows) {
  const h = rows.length, w = rows[0].length, out = [];
  const filled = (x, y) => { const c = rows[y] && rows[y][x]; return c && c !== '.'; };
  for (let y = -1; y <= h; y++) {
    let s = '';
    for (let x = -1; x <= w; x++) {
      if (filled(x, y)) { s += rows[y][x]; continue; }
      s += (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) ? 'O' : '.';
    }
    out.push(s);
  }
  return out;
}

export function pixSvg(rows, layers, cls = '') {
  const w = rows[0].length, h = rows.length;
  const paths = layers.map(([chars, style]) => `<path d="${gridPath(rows, chars)}" style="${style}"/>`).join('');
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${paths}</svg>`;
}

// ---------- kitty hearts ----------
const HEART = outlined([
  '.X.....X.',
  '.XX...XX.',
  'XLXX.XXXX',
  'XLXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
]);
export function heartSvg(full, cls = '') {
  return full
    ? pixSvg(HEART, [['O', 'fill:var(--line)'], ['X', 'fill:var(--heart)'], ['L', 'fill:var(--heart-hi)']], 'heart ' + cls)
    : pixSvg(HEART, [['O', 'fill:var(--line)'], ['XL', 'fill:var(--heart-empty)']], 'heart hollow ' + cls);
}

// ---------- icons (single colour, follow text colour) ----------
const ICONS = {
  paw: ['..XX.XX..', '..XX.XX..', 'XX.....XX', 'XX.XXX.XX', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', '..XX.XX..'],
  cake: ['....X....', '....X....', '.XXXXXXX.', '.X.X.X.X.', '.XXXXXXX.', 'XXXXXXXXX', 'X.X.X.X.X', 'XXXXXXXXX'],
  yarn: ['...XXX...', '.XX..XXX.', '.X.XX..X.', 'X.X..XX.X', 'XX.XX..XX', 'X..X.XX.X', '.XX.X..X.', '.XXX.XX..', '...XXX..X'],
  plus: ['...XXX...', '...XXX...', '...XXX...', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '...XXX...', '...XXX...', '...XXX...'],
  back: ['...XX', '..XX.', '.XX..', 'XX...', '.XX..', '..XX.', '...XX'],
  x: ['XX...XX', '.XX.XX.', '..XXX..', '.XX.XX.', 'XX...XX'],
  star: ['....X....', '...XXX...', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '.XXX.XXX.', '.XX...XX.'],
  dice: ['XXXXXXXXX', 'X.......X', 'X.X...X.X', 'X.......X', 'X...X...X', 'X.......X', 'X.X...X.X', 'X.......X', 'XXXXXXXXX'],
  camera: ['..XXX....', 'XXXXXXXXX', 'X..XXX..X', 'X.X...X.X', 'X.X...X.X', 'X..XXX..X', 'XXXXXXXXX'],
};
export function icon(name, cls = '') {
  return pixSvg(ICONS[name], [['X', 'fill:currentColor']], 'icon ' + cls);
}
export function pawBackground() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" shape-rendering="crispEdges"><g transform="translate(6 6) scale(1.4)"><path d="${gridPath(ICONS.paw, 'X')}" fill="#b0408a" fill-opacity=".06"/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------- kitty sprite ----------
// O outline, F fur, I inner ear, E eye, H eye shine, B blush, N nose, M mouth
const CAT = [
  '.O............O.',
  '.OO..........OO.',
  '.OIO........OIO.',
  '.OIFO......OFIO.',
  '.OFFFOOOOOOFFFO.',
  'OFFFFFFFFFFFFFFO',
  'OFFFFFFFFFFFFFFO',
  'OFFHEFFFFFFHEFFO',
  'OFFEEFFFFFFEEFFO',
  'OFBBFFFNNFFFBBFO',
  'OFFFFFMFFMFFFFFO',
  'OFFFFFFMMFFFFFFO',
  '.OFFFFFFFFFFFFO.',
  '..OOFFFFFFFFOO..',
  '....OOOOOOOO....',
];
const SIZE = 20, OX = 2, OY = 4;

export const FURS = [
  { id: 'ginger', name: 'Ginger', c: '#f4a259' },
  { id: 'cream', name: 'Cream', c: '#f3d9b1' },
  { id: 'gray', name: 'Gray', c: '#a3abb8' },
  { id: 'black', name: 'Black', c: '#3b3343' },
  { id: 'white', name: 'Snow', c: '#f7f2ea' },
  { id: 'brown', name: 'Cocoa', c: '#a9744f' },
  { id: 'lilac', name: 'Lilac', c: '#c9b6e4' },
  { id: 'peach', name: 'Peach', c: '#f7b7a3' },
];
export const PATTERNS = [
  { id: 'solid', name: 'Solid' },
  { id: 'tabby', name: 'Tabby' },
  { id: 'tuxedo', name: 'Tuxedo' },
  { id: 'calico', name: 'Calico' },
  { id: 'siamese', name: 'Points' },
];
export const EYES = [
  { id: 'green', name: 'Green', c: '#4cbf6a' },
  { id: 'gold', name: 'Gold', c: '#f2b632' },
  { id: 'blue', name: 'Blue', c: '#4aa3ea' },
  { id: 'amber', name: 'Amber', c: '#e07b2e' },
  { id: 'violet', name: 'Violet', c: '#a66ee0' },
];
export const ACCS = [
  { id: 'none', name: 'None' },
  { id: 'bow', name: 'Bow' },
  { id: 'bell', name: 'Bell' },
  { id: 'wizard', name: 'Wizard' },
  { id: 'crown', name: 'Crown' },
  { id: 'flower', name: 'Flower' },
];

const ACC_ART = {
  bow: { x: 12, y: 6, rows: ['PP.PP', 'PPKPP', 'PP.PP'], col: { P: '#ff6f9c', K: '#c93d6d' } },
  flower: { x: 2, y: 6, rows: ['.P.', 'PYP', '.P.'], col: { P: '#ff8fc8', Y: '#ffd84d' } },
  crown: { x: 7, y: 5, rows: ['Y.YY.Y', 'YYYYYY', 'YRYYRY'], col: { Y: '#ffc93c', R: '#ff4f86' } },
  wizard: { x: 6, y: 1, rows: ['...HH...', '...HH...', '..HHHH..', '..HSHH..', '.HHHHHH.', '.HHHHHH.', 'BBBBBBBB'], col: { H: '#7a5bd6', S: '#ffd84d', B: '#4e3a99' } },
  bell: { x: 6, y: 17, rows: ['RRRRRRRR', '...YY...', '...YK...'], col: { R: '#e8486b', Y: '#ffc93c', K: '#a8741a' } },
};

export function randomCat(seed) {
  const r = rng(hashStr(String(seed)));
  const pick = arr => arr[Math.floor(r() * arr.length)].id;
  return {
    fur: pick(FURS),
    pattern: pick(PATTERNS),
    eyes: pick(EYES),
    acc: r() < 0.45 ? 'none' : pick(ACCS.slice(1)),
  };
}

function furColour(cfg, r, c) {
  const base = (FURS.find(f => f.id === cfg.fur) || FURS[0]).c;
  const dark = lum(base) < 0.35;
  const stripe = dark ? mix(base, '#ffffff', 0.18) : mix(base, '#2a1530', 0.32);
  switch (cfg.pattern) {
    case 'tabby': {
      const forehead = (r === 5 && (c === 6 || c === 7 || c === 8 || c === 9)) || (r === 6 && (c === 6 || c === 9));
      const cheeks = (r === 8 || r === 10) && (c === 1 || c === 14);
      return forehead || cheeks ? stripe : base;
    }
    case 'tuxedo': {
      const white = (r >= 9 && c >= 4 && c <= 11) || r >= 12;
      return white ? '#fbf7f1' : base;
    }
    case 'calico': {
      const patchA = c <= 5 && r <= 7;
      const patchB = (c >= 10 && r >= 8 && r <= 11) || (c >= 11 && r <= 4);
      if (patchA) return base === '#f7f2ea' ? '#f4a259' : base;
      if (patchB) return dark ? '#f4a259' : '#3d3240';
      return '#fbf6ee';
    }
    case 'siamese': {
      const point = r <= 4 || (r >= 7 && r <= 11 && c >= 5 && c <= 10);
      return point ? mix(base, '#3a2230', 0.45) : '#f3e6d3';
    }
    default:
      return base;
  }
}

const catCache = new Map();
export function catURL(cfg) {
  const key = `${cfg.fur}|${cfg.pattern}|${cfg.eyes}|${cfg.acc}`;
  if (catCache.has(key)) return catCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d');
  const base = (FURS.find(f => f.id === cfg.fur) || FURS[0]).c;
  const eye = (EYES.find(e => e.id === cfg.eyes) || EYES[0]).c;
  const line = lum(base) < 0.35 ? '#120a16' : mix(base, '#2a1530', 0.72);
  const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };

  CAT.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      let col;
      if (ch === 'O' || ch === 'M') col = line;
      else if (ch === 'F') col = furColour(cfg, r, c);
      else if (ch === 'I') col = '#ffb3c7';
      else if (ch === 'E') col = eye;
      else if (ch === 'H') col = '#ffffff';
      else if (ch === 'B') col = mix(furColour(cfg, r, c), '#ff6f9c', 0.55);
      else if (ch === 'N') col = '#ff6f91';
      put(OX + c, OY + r, col);
    }
  });

  const acc = ACC_ART[cfg.acc];
  if (acc) {
    acc.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const k = row[x];
        if (k !== '.') put(acc.x + x, acc.y + y, acc.col[k]);
      }
    });
  }
  const url = cv.toDataURL('image/png');
  catCache.set(key, url);
  return url;
}

// Shrinks a photo into chunky pixel art so it matches the rest of the app.
export async function photoToPixels(file, size = 40) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const m = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      for (let k = 0; k < 3; k++) data.data[i + k] = Math.min(255, Math.round(data.data[i + k] / 36) * 36);
    }
    ctx.putImageData(data, 0, 0);
    return cv.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
