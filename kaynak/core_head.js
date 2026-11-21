// ===================== MEB ROBOT YUMURTA TOPLAMA SİMÜLATÖRÜ — ÇEKİRDEK v3 =====================
// Profiller, çok robotlu maç, çok kartlı (Mega+Nano) robotlar, kart pin kuralları, kontrol raporu.
const SIM = (() => {
'use strict';

const RULESETS = {
  '2026': { ad: '2026 (Antalya) — yeşil köşe, 2 dk', sure: 120, yesil: 3, ceza: false, ledCeza: true, erkenBitis: 10 },
  '2025': { ad: '2025 (Kayseri) — ceza yumurtası, 3 dk', sure: 180, yesil: 0, ceza: true, ledCeza: false },
};
// Pil tipleri: hücre gerilimi (dolu/boş), iç direnç (Ω, hücre başına), varsayılan kapasite
const BATTERIES = {
  liion: { ad: 'Li-ion 18650 (3,7 V hücre)', hucre: 3.7, dolu: 4.15, bos: 3.3, rIc: 0.06, mah: 2400 },
  lipo: { ad: 'LiPo (3,7 V hücre)', hucre: 3.7, dolu: 4.2, bos: 3.5, rIc: 0.02, mah: 1500 },
  pil9v: { ad: '9 V kare pil (alkalin)', hucre: 9, dolu: 9.4, bos: 6.5, rIc: 1.7, mah: 500 },
  aa: { ad: 'AA kalem pil (alkalin, 1,5 V)', hucre: 1.5, dolu: 1.55, bos: 1.0, rIc: 0.15, mah: 2000 },
  nimh: { ad: 'AA şarjlı NiMH (1,2 V)', hucre: 1.2, dolu: 1.35, bos: 1.05, rIc: 0.03, mah: 2000 },
};
const RULES = { FIELD: 2.5, ZONE: 0.5, WALL_H: 0.08, EGG_R: 0.02, EGG_H: 0.02, MAX_DIM: 0.30, MAX_MASS: 5.0, MATCH_TIME: 180, G: 9.81 };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function stripJsonComments(s) {
  let out = '', i = 0, inStr = false;
  while (i < s.length) {
    const c = s[i];
    if (inStr) { out += c; if (c === '\\') { out += s[i + 1] || ''; i += 2; continue; } if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}
const deepCopy = (o) => JSON.parse(JSON.stringify(o));

// ---------- Kartlar ----------
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const BOARDS = {
  Uno: { ad: 'Arduino Uno', A0: 14, nA: 6, analog: range(14, 19), digital: range(0, 19), pwm: [3, 5, 6, 9, 10, 11], servoTimer: [9, 10], i2c: [18, 19] },
  Nano: { ad: 'Arduino Nano', A0: 14, nA: 8, analog: range(14, 21), digital: range(0, 19), pwm: [3, 5, 6, 9, 10, 11], servoTimer: [9, 10], i2c: [18, 19] },
  Mega: { ad: 'Arduino Mega 2560', A0: 54, nA: 16, analog: range(54, 69), digital: range(0, 69), pwm: [...range(2, 13), 44, 45, 46], servoTimer: [44, 45, 46], i2c: [20, 21] },
};
const boardOf = (tip) => BOARDS[tip] || BOARDS.Uno;
function boardPinNum(s, tip) {
  const B = boardOf(tip); s = String(s).trim().toUpperCase();
  let m = s.match(/^A(\d+)$/); if (m) return B.A0 + +m[1];
  m = s.match(/^D?(\d+)$/); if (m) return +m[1];
  return null;
}
function pinLabel(n, tip) { const B = boardOf(tip); return n >= B.A0 && n < B.A0 + B.nA ? 'A' + (n - B.A0) : 'D' + n; }
// pin anahtarı = kartSırası*100 + pin
function resolvePin(ref, boards) {
  if (ref === null || ref === undefined || ref === '') return null;
  if (typeof ref === 'number') return ref;
  let s = String(ref).trim(), bi = 0; const m = s.match(/^([^:]+):(.+)$/);
  if (m) { bi = boards.findIndex(b => b.id.toLowerCase() === m[1].trim().toLowerCase()); if (bi < 0) return null; s = m[2]; }
  const n = boardPinNum(s, boards[bi] ? boards[bi].tip : 'Uno'); return n == null ? null : bi * 100 + n;
}
function keyLabel(key, boards) { const bi = Math.floor(key / 100), n = key % 100; const b = boards[bi] || { id: '?', tip: 'Uno' }; return (boards.length > 1 ? b.id + ':' : '') + pinLabel(n, b.tip); }

// ---------- Hazır değerler (yaklaşık, sunta zemin üzerinde) ----------
const TIRES = {
  kaucuk: { ad: 'Kauçuk (standart sarı TT tekerlek)', muS: 0.95, muK: 0.8, crr: 0.015 },
  silikon: { ad: 'Silikon (yumuşak, çok tutar)', muS: 1.2, muK: 1.0, crr: 0.022 },
  oring: { ad: 'O-ring kauçuk bant', muS: 0.9, muK: 0.75, crr: 0.012 },
  kopuk: { ad: 'Köpük / EVA', muS: 0.8, muK: 0.65, crr: 0.03 },
  plastik: { ad: 'Sert plastik (lastiksiz)', muS: 0.45, muK: 0.35, crr: 0.008 },
  ozel: { ad: 'Özel (kendim gireceğim)' },
};
const MOTORS = {
  'TT 1:48 6V': { ad: 'TT sarı motor 1:48 (6V, ~200 rpm)', volt: 6, rpm: 200, tork: 0.8, surt: 0.25, akim: 1.5, oran: 48, rotorJ: 6e-8 },
  'TT 1:120 6V': { ad: 'TT sarı motor 1:120 (6V, ~100 rpm)', volt: 6, rpm: 100, tork: 1.5, surt: 0.45, akim: 1.5, oran: 120, rotorJ: 6e-8 },
  'N20 6V 300': { ad: 'N20 mikro redüktörlü (6V, 300 rpm)', volt: 6, rpm: 300, tork: 0.35, surt: 0.08, akim: 0.7, oran: 50, rotorJ: 1e-8 },
  'N20 6V 100': { ad: 'N20 mikro redüktörlü (6V, 100 rpm)', volt: 6, rpm: 100, tork: 1.0, surt: 0.2, akim: 0.7, oran: 150, rotorJ: 1e-8 },
  'JGA25-370 12V 280': { ad: 'JGA25-370 (12V, 280 rpm)', volt: 12, rpm: 280, tork: 3.5, surt: 0.5, akim: 2.2, oran: 21, rotorJ: 2.5e-7 },
  'JGA25-370 12V 130': { ad: 'JGA25-370 (12V, 130 rpm)', volt: 12, rpm: 130, tork: 7.0, surt: 0.9, akim: 2.2, oran: 47, rotorJ: 2.5e-7 },
  'JGB37-520 12V 107': { ad: 'JGB37-520 (12V, 107 rpm)', volt: 12, rpm: 107, tork: 10, surt: 1.3, akim: 3.2, oran: 56, rotorJ: 8e-7 },
  'ozel': { ad: 'Özel (kendim gireceğim)' },
};
const DRIVERS = {
  L298N: { ad: 'L298N', dusum: 1.9, maxA: 2, pins: ['en', 'in1', 'in2'] },
  L293D: { ad: 'L293D', dusum: 2.0, maxA: 0.6, pins: ['en', 'in1', 'in2'] },
  TB6612: { ad: 'TB6612FNG', dusum: 0.2, maxA: 1.2, pins: ['pwm', 'in1', 'in2'], stby: true },
  BTS7960: { ad: 'BTS7960 (IBT-2)', dusum: 0.1, maxA: 30, pins: ['en', 'rpwm', 'lpwm'] },
  L9110: { ad: 'L9110S', dusum: 0.4, maxA: 0.8, pins: ['ia', 'ib'] },
  DRV8833: { ad: 'DRV8833', dusum: 0.2, maxA: 1.2, pins: ['ia', 'ib'] },
  MX1508: { ad: 'MX1508', dusum: 0.3, maxA: 1.5, pins: ['ia', 'ib'] },
};
const SENSOR_TYPES = {
  'HC-SR04': { ad: 'HC-SR04 ultrasonik', pins: ['trig', 'echo'], ip: 'ultrasonik mesafe' },
  'IR_ENGEL': { ad: 'Kızılötesi engel (FC-51 / MZ80)', pins: ['pin'], ip: 'engel varken LOW (ters: true → HIGH)' },
  'TCRT5000': { ad: 'TCRT5000 zemin', pins: ['pin', 'dijital_pin'], ip: 'zemin rengi (analog)' },
  'TCS3200': { ad: 'TCS3200 renk', pins: ['s0', 's1', 's2', 's3', 'out'], ip: 'renk frekansı (pulseIn)' },
  'SHARP_IR': { ad: 'Sharp GP2Y0A21 mesafe', pins: ['pin'], ip: 'analog mesafe' },
  'BUTON': { ad: 'Buton / anahtar', pins: ['pin'], ip: 'deger: HIGH, LOW, KIRMIZIDA_HIGH, MAVIDE_HIGH' },
};
