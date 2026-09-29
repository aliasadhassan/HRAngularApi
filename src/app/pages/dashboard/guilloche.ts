/**
 * Banknote jaisa guilloché pattern — SVG paths code se banti hain (koi image file nahi).
 * Hypotrochoid rosettes + security-print waves. Ek dafa compute, phir sirf render.
 */

function round(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function toPath(points: [number, number][]): string {
  return 'M' + points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') + 'Z';
}

/** R, r ka ratio pattern ke petals decide karta hai; turns = pattern band hone tak ghoomna. */
function rosette(cx: number, cy: number, R: number, r: number, d: number, turns: number, rotate: number, steps = 900): string {
  const pts: [number, number][] = [];
  const k = (R - r) / r;
  const end = Math.PI * 2 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * end;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    const cos = Math.cos(rotate);
    const sin = Math.sin(rotate);
    pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }
  return toPath(pts);
}

function wave(width: number, y: number, amp: number, freq: number, phase: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= width; x += 4) {
    const yy = y + amp * Math.sin((x / width) * Math.PI * 2 * freq + phase) * Math.sin((x / width) * Math.PI);
    pts.push(`${round(x)} ${round(yy)}`);
  }
  return 'M' + pts.join('L');
}

export interface Guilloche {
  rosettes: string[];
  waves: string[];
}

export function buildGuilloche(): Guilloche {
  const rosettes: string[] = [];
  // 5/3 ratio: 3 chakkar mein band, 8 petals jaisa bunna
  // Card ke inline-end kinare pe, aadha bahar — banknote ke watermark jaisa
  for (let i = 0; i < 16; i++) {
    rosettes.push(rosette(600, 190, 150, 56.25, 30 + i * 3.4, 3, (i * Math.PI) / 90));
  }
  const waves: string[] = [];
  for (let i = 0; i < 10; i++) {
    waves.push(wave(640, 356 + i * 3, 6, 4, i * 0.5));
  }
  return { rosettes, waves };
}
