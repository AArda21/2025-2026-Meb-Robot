
// =====================================================================================
//                                  SENSÖRLER
// =====================================================================================
function rayOBB(ox, oy, dx, dy, wp) { // ışın - döndürülmüş dikdörtgen
  const p = wp.p; const rx = ox - wp.wx, ry = oy - wp.wy;
  const lx = wp.c * rx + wp.s * ry, ly = -wp.s * rx + wp.c * ry, ldx = wp.c * dx + wp.s * dy, ldy = -wp.s * dx + wp.c * dy;
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, d, h] of [[lx, ldx, p.hx], [ly, ldy, p.hy]]) {
    if (Math.abs(d) < 1e-12) { if (o < -h || o > h) return null; continue; }
    let a = (-h - o) / d, b = (h - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
  }
  return t1 < 0 ? null : Math.max(0, t0);
}
const CALKEY = { 'kırmızı': 'kirmizi', 'mavi': 'mavi', 'yeşil': 'yesil', 'beyaz': 'beyaz', 'boş': 'bos', 'robot': 'bos' };
const CAL_COLORS = [['kirmizi', 'Kırmızı yumurta'], ['mavi', 'Mavi yumurta'], ['yesil', 'Yeşil yumurta'], ['beyaz', 'Beyaz zemin / duvar'], ['bos', 'Önü boş']];
const Sensors = {
  calTCS(s, name) {
    const K = s.kalibrasyon; if (!K) return null; const get = (k) => { const a = K[k]; return Array.isArray(a) && a.slice(0, 3).every(v => v !== '' && v != null && isFinite(+v) && +v > 0) ? a.map(Number) : null; };
    let a = name === 'ceza' ? (get('kirmizi') && get('mavi') ? get('kirmizi').map((v, i) => (v + get('mavi')[i]) / 2) : null) : get(CALKEY[name]); if (!a) return null;
    return [a[0], a[1], a[2], a[3] > 0 ? a[3] : Math.min(a[0], a[1], a[2]) * 0.6];
  },
  // modelin bir yüzey için verdiği TCS3200 periyotları [R, G, B, C] (µs)
  tcsModel(s, surf) { const sc = (s.s0 == null && s.s1 == null) ? (s.olcek ?? 20) / 100 : 0.2; const per = (r) => 1e6 / (2 * 60000 * sc * (0.25 + 0.75 * r)); const [R, G, B] = surf.rgb; return [per(R), per(G), per(B), per((R + G + B) / 3 * 1.6)].map(v => Math.round(v)); },
  ray(m, rb, x, y, a, z, maxD, opts = {}) {
    if (m.rayCast3D) { const r = m.rayCast3D(rb, x, y, z, a, maxD); if (r) return r; }
    const F = RULES.FIELD, dx = Math.cos(a), dy = Math.sin(a); let best = maxD, hit = null;
    if (z <= RULES.WALL_H + (opts.wallTol ?? 0.01)) {
      const ts = []; if (dx > 1e-9) ts.push((F - x) / dx); if (dx < -1e-9) ts.push((0 - x) / dx); if (dy > 1e-9) ts.push((F - y) / dy); if (dy < -1e-9) ts.push((0 - y) / dy);
      for (const t of ts) if (t >= 0 && t < best) { best = t; hit = 'duvar'; }
    }
    if (z <= RULES.EGG_H + (opts.eggTol ?? 0.012)) {
      const r = RULES.EGG_R;
      for (const e of m.eggs) { if (e.gone) continue; const ox = e.x - x, oy = e.y - y; const tc = ox * dx + oy * dy; if (tc < -r) continue; const d2 = ox * ox + oy * oy - tc * tc; if (d2 > r * r) continue; const t = tc - Math.sqrt(r * r - d2); if (t >= 0 && t < best) { best = t; hit = e; } }
    }
    for (const o of m.robots) { if (o === rb) continue; if (Math.hypot(o.state.x - x, o.state.y - y) > maxD + (o.radius || 0.3)) continue; for (const wp of o.cachedParts(m.time)) { if (z < wp.p.z0 - 0.01 || z > wp.p.z1 + 0.01) continue; const t = rayOBB(x, y, dx, dy, wp); if (t != null && t < best) { best = t; hit = { robot: o }; } } }
    if (opts.self) for (const wp of rb.worldParts()) { if (wp.p.auto || !wp.p.solid || z < wp.p.z0 || z > wp.p.z1) continue; const t = rayOBB(x, y, dx, dy, wp); if (t != null && t > 0.002 && t < best) { best = t; hit = { self: wp.p }; } }
    return { d: best, hit };
  },
  ultrasonic(m, rb, s) {
    const w = rb.sensorWorld(s); let best = null;
    for (const da of [-0.26, -0.13, 0, 0.13, 0.26]) { const r = Sensors.ray(m, rb, w.x, w.y, w.a + da, w.z, 4.0); if (r.hit && (best == null || r.d < best)) best = r.d; }
    if (best == null) return null; if (best < 0.02) best = 0.02 + RNG() * 0.01;
    return best + (RNG() - 0.5) * 0.004;
  },
  irObstacle(m, rb, s) { if (s._mT === m.time && s._mR === rb) return s._mV; const v = Sensors._ir(m, rb, s); s._mT = m.time; s._mR = rb; s._mV = v; return v; },
  _ir(m, rb, s) { const w = rb.sensorWorld(s); for (const da of [-0.08, 0, 0.08]) { const r = Sensors.ray(m, rb, w.x, w.y, w.a + da, w.z, s.range); if (r.hit) return true; } return false; },
  surfaceAt(m, x, y) {
    const r = RULES.EGG_R;
    for (const e of m.eggs) { if (e.gone) continue; const dx = x - e.x, dy = y - e.y; if (dx * dx + dy * dy <= r * r) return Sensors.eggSurface(e, x, y); }
    const z = m.zoneOf(x, y); return z ? SURF[z] : SURF.white;
  },
  eggSurface(e, x, y) {
    if (e.kind !== 'penalty') return SURF[e.kind];
    const ang = Math.atan2(y - e.y, x - e.x) - e.phi; if (Math.hypot(x - e.x, y - e.y) < 0.004) return { ir: (SURF.red.ir + SURF.blue.ir) / 2, rgb: SURF.red.rgb.map((v, i) => (v + SURF.blue.rgb[i]) / 2), name: 'ceza' };
    return Math.sin(ang) >= 0 ? SURF.red : SURF.blue;
  },
  tcrt(m, rb, s) { const w = rb.sensorWorld(s); const sf = Sensors.surfaceAt(m, w.x, w.y); let v = sf.ir; const ck = s.kalibrasyon && s.kalibrasyon[CALKEY[sf.name]]; if (ck != null && ck !== '') return clamp(Math.round(+ck + (RNG() - 0.5) * 16), 0, 1023); if (w.z > 0.03) v = v + (1010 - v) * Math.min(1, (w.z - 0.03) / 0.03); return clamp(Math.round(v + (RNG() - 0.5) * 16), 0, 1023); },
  colorTarget(m, rb, s) {
    const w = rb.sensorWorld(s); if ((s.bakis || 'asagi') === 'asagi') return Sensors.surfaceAt(m, w.x, w.y);
    const r = Sensors.ray(m, rb, w.x, w.y, w.a, w.z, s.range, { wallTol: 0 }); if (!r.hit) return SURF.none; if (r.hit === 'duvar') return SURF.white; if (r.hit.robot) return SURF.robot;
    return Sensors.eggSurface(r.hit, w.x + Math.cos(w.a) * r.d, w.y + Math.sin(w.a) * r.d);
  },
  tcsPeriod(m, rb, s) {
    const g = (k, def) => k == null ? def : (rb.duty(k) > 0.5 ? 1 : 0);
    let sc; if (s.s0 == null && s.s1 == null) sc = (s.olcek ?? 20) / 100; else { const S0 = g(s.s0, 1), S1 = g(s.s1, 0); sc = (!S0 && !S1) ? 0 : (!S0 && S1) ? 0.02 : (S0 && !S1) ? 0.2 : 1; }
    if (sc === 0) return null;
    const S2 = g(s.s2, 0), S3 = g(s.s3, 0); const tgt = Sensors.colorTarget(m, rb, s);
    const fi = (!S2 && !S3) ? 0 : (!S2 && S3) ? 2 : (S2 && !S3) ? 3 : 1;
    const cal = Sensors.calTCS(s, tgt.name); if (cal) return cal[fi] * (1 + (RNG() - 0.5) * 0.04);
    const [R, G, B] = tgt.rgb;
    let refl = (!S2 && !S3) ? R : (!S2 && S3) ? B : (S2 && !S3) ? (R + G + B) / 3 * 1.6 : G; refl = 0.25 + 0.75 * refl;
    return 1e6 / (2 * 60000 * sc * refl * (1 + (RNG() - 0.5) * 0.04));
  },
  sharp(m, rb, s) { const w = rb.sensorWorld(s); const r = Sensors.ray(m, rb, w.x, w.y, w.a, w.z, 1.5); const d = (r.hit ? r.d : 1.5) * 100; let V = d < 7 ? 2.9 * d / 7 : 27.728 * Math.pow(d, -1.2045); V = clamp(V, 0.3, 3.1); return clamp(Math.round(V / 5 * 1023 + (RNG() - 0.5) * 8), 0, 1023); },
  digital(m, rb, k, rt) {
    for (const s of rb.sensors) {
      if ((s.type === 'IR_ENGEL' || s.type === 'IR' || s.type === 'MZ80') && s.pin === k) { const ob = Sensors.irObstacle(m, rb, s); return (s.ters ? ob : !ob) ? 1 : 0; }
      if (s.type === 'TCRT5000' && (s.dpin === k || (s.pin === k && s.dpin == null))) return Sensors.tcrt(m, rb, s) > (s.esik ?? 500) ? 1 : 0;
      if (s.type === 'BUTON' && s.pin === k) { const d = String(s.deger || 'HIGH').toUpperCase(); return d === 'KIRMIZIDA_HIGH' ? (rb.team === 'red' ? 1 : 0) : d === 'MAVIDE_HIGH' ? (rb.team === 'blue' ? 1 : 0) : (d === 'HIGH' || d === '1') ? 1 : 0; }
      if (s.type === 'TCS3200' && s.out === k) { const per = Sensors.tcsPeriod(m, rb, s); if (per == null) return 0; return Math.floor(rt.t * 1e6 / per) % 2; }
    }
    return null;
  },
  analog(m, rb, k) {
    if (rb.cut && rb.cut.has(k)) return Math.round(300 + (RNG() - 0.5) * 400);
    for (const s of rb.sensors) {
      if (s.type === 'TCRT5000' && s.pin === k) return Sensors.tcrt(m, rb, s);
      if ((s.type === 'SHARP_IR' || s.type === 'GP2Y0A21') && s.pin === k) return Sensors.sharp(m, rb, s);
      if ((s.type === 'IR_ENGEL' || s.type === 'MZ80') && s.pin === k) return Sensors.irObstacle(m, rb, s) ? 40 : 980;
    }
    return null;
  },
  *pulseIn(m, rb, rt, k, state, timeout) {
    const us = rb.sensors.find(s => s.type === 'HC-SR04' && s.echo === k);
    if (us) {
      const u = rt.ultraState[us.trig] || {};
      if (state && u.armed && rt.t - u.at < 0.06) { u.armed = false; const d = Sensors.ultrasonic(m, rb, us); const dur = d == null ? 38000 : d * 2 / 343 * 1e6; yield 0.00045; if (dur > timeout) { yield timeout / 1e6; return 0; } yield dur / 1e6; return Math.round(dur); }
      yield timeout / 1e6; return 0;
    }
    const tcs = rb.sensors.find(s => s.type === 'TCS3200' && s.out === k);
    if (tcs) { const per = Sensors.tcsPeriod(m, rb, tcs); if (per == null) { yield timeout / 1e6; return 0; } yield (per * 2) / 1e6; return Math.round(per); }
    yield timeout / 1e6; return 0;
  },
  readouts(m, rb) {
    return rb.sensors.map(s => {
      let val = '';
      try {
        if (s.type === 'HC-SR04') { const d = Sensors.ultrasonic(m, rb, s); val = d == null ? 'menzil dışı' : (d * 100).toFixed(1) + ' cm'; }
        else if (s.type === 'IR_ENGEL' || s.type === 'MZ80') val = Sensors.irObstacle(m, rb, s) ? 'ENGEL' : 'boş';
        else if (s.type === 'TCRT5000') val = String(Sensors.tcrt(m, rb, s));
        else if (s.type === 'TCS3200') val = Sensors.colorTarget(m, rb, s).name;
        else if (s.type === 'SHARP_IR') val = String(Sensors.sharp(m, rb, s));
        else if (s.type === 'BUTON') val = Sensors.digital(m, rb, s.pin, { t: 0 }) ? 'HIGH' : 'LOW';
      } catch (e) { val = '?'; }
      return { name: s.name, val };
    });
  },
};

// =====================================================================================
//                                  MAÇ (2B fizik motoru)
// =====================================================================================
// Kalibrasyon: dönüş direnci (>0 yavaşlatır) ya da dönüş kolaylığı (<0, tekerlerin izin verdiği hızı geçmez). Açısal hız değişimini döndürür.
function calibYaw(rb, w, dt) {
  const c = rb.calib.donus, a = c * rb.mass * RULES.G * rb.track / 2 * dt / rb.inertia;
  if (c > 0) return Math.abs(w) < 1e-6 ? 0 : -Math.sign(w) * Math.min(Math.abs(w), a);
  const v = (sd) => ((rb.wheelInfo[sd] || {}).rpm || 0) * 2 * Math.PI / 60 * rb.wheelR; const wk = (v('R') - v('L')) / rb.track;
  if (Math.abs(wk) < 0.05 || Math.sign(wk) * w >= Math.abs(wk)) return 0; return Math.sign(wk) * Math.min(-a, Math.abs(wk - w));
}
class Match {
  constructor(opts) {
    this.opts = opts || {}; const S = this.opts.saha || {};
    this.field = {
      eggMass: (S.yumurta_kutle_g || 25) / 1000, muEggFloor: S.mu_yumurta_zemin ?? 0.35, muRobotEgg: S.mu_robot_yumurta ?? 0.3, muWall: S.mu_duvar ?? 0.4,
      eRobotEgg: 0.2, eWall: 0.15, seed: S.tohum ?? 2026, refereeCollect: S.hakem_toplar ?? true,
      colors: Object.assign({ zemin: '#f6f5f1', kirmizi: '#c1121c', mavi: '#25356b', duvar: '#e2e2dc' }, S.renkler || {}),
    };
    this.rules = RULESETS[this.opts.kural] || RULESETS['2026']; this.ruleKey = RULESETS[this.opts.kural] ? this.opts.kural : '2026';
    this.field.colors.yesil = this.field.colors.yesil || '#2f8f46';
    const F = RULES.FIELD, Z = RULES.ZONE;
    this.zones = [{ kind: 'red', x0: 0, y0: 0, x1: Z, y1: Z }, { kind: 'blue', x0: F - Z, y0: F - Z, x1: F, y1: F }];
    if (this.rules.yesil) this.zones.push(this.opts.yesil_kose === 'sol_ust' ? { kind: 'green', x0: 0, y0: F - Z, x1: Z, y1: F } : { kind: 'green', x0: F - Z, y0: 0, x1: F, y1: Z });
    this.startPoses = this.opts.startPoses || {};
    this.reset();
  }
  get dt() { return 0.001; }
  get engineName() { return '2B'; }
  get matchTime() { return this.rules.sure; }
  defaultPose(team) { const F = RULES.FIELD; return team === 'red' ? { x: 0.25, y: 0.25, th: Math.PI / 4 } : { x: F - 0.25, y: F - 0.25, th: Math.PI * 5 / 4 }; }
  reset() {
    this._rng = mulberry32(((this.field.seed | 0) * 7919 + 17) | 0);
    this.time = 0; this.ended = false; this.banked = { red: [], blue: [], green: [] }; this.firstDrop = null; this.events = [];
    this.placeEggs();
    this.robots = [];
    for (const team of ['red', 'blue']) { const p = (this.opts.profiles || {})[team]; if (!p) continue; const rb = new Robot(p, team, this); rb.reset(this.startPoses[team] || this.defaultPose(team));
      const G = this.opts.gercek || {}; const fark = (G.motor_farki ?? 0) / 100; rb.gain = { L: 1, R: 1 - fark }; const lvl = clamp((G.pil ?? 100) / 100, 0, 1); rb.batFactor = 0.86 + 0.22 * lvl; rb.cut = new Set(G.kesik && G.kesik[team] || []);
      this.robots.push(rb); }
    if (this.afterReset) this.afterReset();
  }
  placeEggs() {
    const oz = (this.opts.saha || {}).ozel; if (Array.isArray(oz)) { const F = RULES.FIELD, r = RULES.EGG_R; this.eggs = oz.filter(o => ['red', 'blue', 'green', 'penalty'].includes(o.kind)).map((o, i) => ({ id: i, kind: o.kind, x: clamp(+o.x, r, F - r), y: clamp(+o.y, r, F - r), vx: 0, vy: 0, phi: i * 1.7, still: 0, gone: false, z: RULES.EGG_H / 2 })); return; }
    const rnd = mulberry32(this.field.seed | 0), F = RULES.FIELD, Z = RULES.ZONE; const eggs = [], kinds = [];
    for (let i = 0; i < 10; i++) kinds.push('red'); for (let i = 0; i < 10; i++) kinds.push('blue'); if (this.rules.ceza) kinds.push('penalty'); for (let i = 0; i < this.rules.yesil; i++) kinds.push('green');
    for (const k of kinds) for (let tries = 0; tries < 2000; tries++) {
      const x = 0.06 + rnd() * (F - 0.12), y = 0.06 + rnd() * (F - 0.12);
      if (this.zones.some(zn => x > zn.x0 - 0.1 && x < zn.x1 + 0.1 && y > zn.y0 - 0.1 && y < zn.y1 + 0.1)) continue; if (eggs.some(e => Math.hypot(e.x - x, e.y - y) < 0.09)) continue;
      eggs.push({ id: eggs.length, kind: k, x, y, vx: 0, vy: 0, phi: rnd() * Math.PI * 2, still: 0, gone: false, z: RULES.EGG_H / 2 }); break;
    }
    this.eggs = eggs;
  }
  compileAll() { const errs = []; for (const rb of this.robots) for (const e of rb.compile()) errs.push(Object.assign({ robot: rb.name, team: rb.team }, e)); return errs; }
  robotByTeam(t) { return this.robots.find(r => r.team === t); }
  updateServos(rb, dt, cmdStore) {
    for (const sv of rb.servos) {
      const tgt = rb.servoTarget(sv.pin); const cur = cmdStore[sv.pin] ?? sv.angle;
      if (tgt == null) { if (cmdStore === rb.servoAng) rb.servoVel[sv.pin] = 0; continue; }
      const md = sv.speed * dt, d = clamp(tgt - cur, -md, md); cmdStore[sv.pin] = cur + d; if (cmdStore === rb.servoAng) rb.servoVel[sv.pin] = d / dt;
    }
  }
  stepStats(rb, dt) {
    const st = rb.stats, wi = rb.wheelInfo; const driving = Math.abs(wi.L.V) > 1 || Math.abs(wi.R.V) > 1;
    if (driving) { st.driveT += dt; if (wi.L.slip || wi.R.slip) st.slipT += dt; const sp = Math.hypot(rb.state.vx, rb.state.vy), w = Math.abs(rb.state.w); if (sp < 0.01 && w < 0.1) st.stuckT += dt; }
    st.maxTilt = Math.max(st.maxTilt, rb.state.tilt || 0);
    const M = rb.motor; let I = 0.12; for (const k of ['L', 'R']) { const w = wi[k]; if (w.mode === 'drive' || w.mode === 'brake') { const tau = Math.abs(w.F || 0) * rb.wheelR; I += 0.08 + M.iStall * Math.min(1.5, tau / M.tStall); } }
    I += 0.15 * Object.values(rb.servoVel || {}).filter(v => Math.abs(v) > 1).length;
    st.amp += I * dt; st.ampT += dt; st.ampPeak = Math.max(st.ampPeak, I); st.mAh += I * dt / 3.6;
  }
  useRng() { RNG = this._rng || (this._rng = mulberry32(((this.field.seed | 0) * 7919 + 17) | 0)); }
  step(dt) {
    this.useRng();
    for (const rb of this.robots) rb.runPrograms(this.time);
    for (const rb of this.robots) { this.updateServos(rb, dt, rb.servoAng); this.drive2D(rb, dt); }
    const E = this.field, g = RULES.G;
    for (const rb of this.robots) { const s = rb.state; s.x += s.vx * dt; s.y += s.vy * dt; s.th += s.w * dt; }
    for (const e of this.eggs) { if (e.gone) continue; const sp = Math.hypot(e.vx, e.vy); if (sp > 0) { const dv = Math.min(sp, E.muEggFloor * g * dt); e.vx -= e.vx / sp * dv; e.vy -= e.vy / sp * dv; } e.x += e.vx * dt; e.y += e.vy * dt; }
    for (let it = 0; it < 3; it++) { for (const rb of this.robots) { rb._wp = rb.worldParts(); this.collideRobotWalls(rb); this.collideRobotEggs(rb); } this.collideRobots(); this.collideEggsWalls(); this.collideEggs(); }
    for (const rb of this.robots) rb._wp = null;
    this.time += dt; this.afterStep(dt);
  }
  // İç hazne: ağızdaki yumurtayı servo açısına göre bölmeye alır / dışarı atar; bölme kapağı açılınca bırakır
  servoNow(rb, k) { const st = rb.servoCmd || rb.servoAng; const v = st && st[k]; if (v != null) return v; const sv = rb.servos.find(s => s.pin === k); return sv ? sv.angle : null; }
  hopper(dt) {
    for (const rb of this.robots) { const Hz = rb.hazne; if (!Hz) continue; const s = rb.state, c = Math.cos(s.th), n = Math.sin(s.th);
      const inR = (k, r) => { const a = this.servoNow(rb, k); return a != null && a >= r.min && a <= r.max; };
      const toW = (lx, ly) => [s.x + c * lx - n * ly, s.y + n * lx + c * ly];
      for (const e of this.eggs) { if (e.gone) continue; const dx = e.x - s.x, dy = e.y - s.y; const lx = c * dx + n * dy, ly = -n * dx + c * dy;
        if (lx < Hz.agiz.x0 || lx > Hz.agiz.x1 || ly < Hz.agiz.y0 || ly > Hz.agiz.y1) continue;
        const k = Hz.kurallar.find(k => inR(k.servo, k.r) && (!k.ve || inR(k.ve.servo, k.ve.r))); if (!k) continue;
        if (k.hedef === 'disari') { const [wx, wy] = toW(Hz.disari.x, Hz.disari.y); const L = Math.hypot(Hz.disari.x, Hz.disari.y) || 1; this.placeEgg(e, wx, wy, (c * Hz.disari.x - n * Hz.disari.y) / L * Hz.disari.v, (n * Hz.disari.x + c * Hz.disari.y) / L * Hz.disari.v); e.toucher = rb.team; this.events.push({ t: this.time, txt: `${rb.name}: ağızdaki yumurtayı dışarı attı` }); continue; }
        const bm = Hz.bolmeler.find(b => b.ad === k.hedef); if (!bm) continue;
        if (bm.icerik.length >= bm.kap) { if (!bm._doluT || this.time - bm._doluT > 3) { bm._doluT = this.time; this.events.push({ t: this.time, txt: `${rb.name}: '${bm.ad}' bölmesi dolu (${bm.kap}), yumurta ağızda kaldı` }); } continue; }
        this.storeEgg(e, rb, bm); this.events.push({ t: this.time, txt: `${rb.name}: yumurta '${bm.ad}' bölmesine alındı (${bm.icerik.length}/${bm.kap})` });
      }
      for (const bm of Hz.bolmeler) { if (!bm.icerik.length || bm.kapak == null || !inR(bm.kapak, bm.r) || this.time - bm.sonCikis < bm.aralik / 1000) continue;
        const e = bm.icerik.shift(); bm.sonCikis = this.time; const [wx, wy] = toW(bm.cx, bm.cy); const L = Math.hypot(bm.cx, bm.cy) || 1;
        this.placeEgg(e, wx, wy, (c * bm.cx - n * bm.cy) / L * 0.15, (n * bm.cx + c * bm.cy) / L * 0.15); e.toucher = rb.team; e.stored = null; this.events.push({ t: this.time, txt: `${rb.name}: '${bm.ad}' bölmesinden yumurta bıraktı` }); }
    }
  }
  storeEgg(e, rb, bm) { e.gone = true; e.stored = { team: rb.team, bolme: bm.ad }; e.vx = e.vy = 0; bm.icerik.push(e); }
  placeEgg(e, x, y, vx, vy) { const F = RULES.FIELD, r = RULES.EGG_R; e.x = clamp(x, r, F - r); e.y = clamp(y, r, F - r); e.vx = vx; e.vy = vy; e.gone = false; e.still = 0; e.stored = null; }
  afterStep(dt) {
    for (const e of this.eggs) { if (e.gone || Math.hypot(e.vx, e.vy) < 0.01) continue; let best = null, bd = 0.25; for (const rb of this.robots) { const d = Math.hypot(e.x - rb.state.x, e.y - rb.state.y); if (d < bd) { bd = d; best = rb; } } if (best) e.toucher = best.team; }
    if (this.rules.ledCeza) for (const rb of this.robots) { if (rb.ledColor() === rb.team) { rb.ledOffT = 0; rb.ledPenActive = false; } else { rb.ledOffT = (rb.ledOffT || 0) + dt; if (rb.ledOffT > 5 && !rb.ledPenActive) { rb.ledPenActive = true; rb.ledPens = (rb.ledPens || 0) + 1; this.events.push({ t: this.time, txt: `${rb.name}: köşe LED'i 5 sn'den uzun yanmadı → −10 ceza` }); } } }
    for (const rb of this.robots) { const s = rb.state; this.stepStats(rb, dt); if (rb.trail.length === 0 || this.time - rb.trail[rb.trail.length - 1][2] > 0.05) { rb.trail.push([s.x, s.y, this.time, s.th]); if (rb.trail.length > 4000) rb.trail.shift(); } }
    this.hopper(dt);
    this.referee(dt);
  }
  drive2D(rb, dt) {
    const s = rb.state, g = RULES.G, M = rb.motor; const c = Math.cos(s.th), n = Math.sin(s.th), fx = c, fy = n, lx = -n, ly = c;
    const Nw = rb.mass * g * rb.loadFrac / 2, Nc = rb.mass * g * (1 - rb.loadFrac); const k = M.tStall / M.w0;
    for (const [side, sy] of [['L', 1], ['R', -1]]) {
      const wxL = rb.wheelX, wyL = sy * rb.track / 2, rx = c * wxL - n * wyL, ry = n * wxL + c * wyL;
      const [pvx, pvy] = rb.pointVel(rx, ry); const vf = pvx * fx + pvy * fy; const { V, mode, duty } = rb.sideVoltage(side); const wr = vf / rb.wheelR;
      let tau = mode === 'drive' ? k * ((V / M.vNom) * M.w0 - wr) : mode === 'brake' ? -k * wr * duty : 0;
      if (Math.abs(wr) > 0.05) tau -= M.tFric * Math.sign(wr); else if (Math.abs(tau) < M.tFric) tau = 0; else tau -= M.tFric * Math.sign(tau);
      let F = tau / rb.wheelR, slip = false; const meff = 1 / rb.invMass(rx, ry, fx, fy);
      if (Math.abs(F) > rb.muS * Nw) { F = Math.sign(F) * rb.muK * Nw; slip = true; }
      if (mode !== 'drive' && F * vf < 0 && Math.abs(F * dt) > Math.abs(vf) * meff) F = -vf * meff / dt;
      rb.applyImp(rx, ry, F * fx * dt, F * fy * dt);
      { const [qx, qy] = rb.pointVel(rx, ry); const v2 = qx * fx + qy * fy; const j = -Math.sign(v2) * Math.min(rb.crr * Nw * dt, Math.abs(v2) * meff); rb.applyImp(rx, ry, j * fx, j * fy); }
      const rpm = slip ? ((V / M.vNom) * M.w0 - Math.abs(F) * rb.wheelR / k * Math.sign(F)) * 60 / (2 * Math.PI) : wr * 60 / (2 * Math.PI);
      const wi = rb.wheelInfo[side]; wi.V = V; wi.F = F; wi.slip = slip; wi.rpm = rpm; wi.mode = mode; wi.spin = (wi.spin || 0) + rpm * 2 * Math.PI / 60 * dt;
    }
    if (rb.caster && Nc > 0) { const rx = c * rb.caster.x - n * rb.caster.y, ry = n * rb.caster.x + c * rb.caster.y; const [qx, qy] = rb.pointVel(rx, ry); const sp = Math.hypot(qx, qy); if (sp > 1e-6) { const ux = qx / sp, uy = qy / sp; const j = Math.min(rb.caster.crr * Nc * dt, sp / rb.invMass(rx, ry, ux, uy)); rb.applyImp(rx, ry, -j * ux, -j * uy); } }
    if (rb.calib && rb.calib.donus) s.w += calibYaw(rb, s.w, dt);
    for (let it = 0; it < 4; it++) for (const sy of [1, -1]) {
      const rx = c * rb.wheelX - n * sy * rb.track / 2, ry = n * rb.wheelX + c * sy * rb.track / 2; const [pvx, pvy] = rb.pointVel(rx, ry); const vl = pvx * lx + pvy * ly;
      const j = clamp(-vl / rb.invMass(rx, ry, lx, ly), -rb.muLat * Nw * dt, rb.muLat * Nw * dt); rb.applyImp(rx, ry, j * lx, j * ly);
    }
  }
  collideRobotWalls(rb) {
    const F = RULES.FIELD, s = rb.state, E = this.field; const push = [0, 0, 0, 0]; let hit = false;
    const R0 = rb.radius || 0.3; if (s.x > R0 && s.y > R0 && s.x < F - R0 && s.y < F - R0) return;
    for (const wp of rb._wp || rb.worldParts()) {
      if (!wp.p.solid || wp.p.z0 >= RULES.WALL_H) continue;
      for (const [cx, cy] of wp.corners) for (const [h, nx, ny, depth, idx] of [[cx < 0, 1, 0, -cx, 0], [cx > F, -1, 0, cx - F, 1], [cy < 0, 0, 1, -cy, 2], [cy > F, 0, -1, cy - F, 3]]) {
        if (!h) continue; hit = true; const rx = cx - s.x, ry = cy - s.y; let [vx, vy] = rb.pointVel(rx, ry);
        if (wp.piv && wp.wS) { vx += -wp.wS * (cy - wp.piv[1]); vy += wp.wS * (cx - wp.piv[0]); }
        const vn = vx * nx + vy * ny;
        if (vn < 0) { const j = -(1 + E.eWall) * vn / rb.invMass(rx, ry, nx, ny); rb.applyImp(rx, ry, j * nx, j * ny); const tx = -ny, ty = nx; const [a, b] = rb.pointVel(rx, ry); const vt = a * tx + b * ty; const jt = clamp(-vt / rb.invMass(rx, ry, tx, ty), -E.muWall * j, E.muWall * j); rb.applyImp(rx, ry, jt * tx, jt * ty); }
        push[idx] = Math.max(push[idx], depth);
      }
    }
    s.x += push[0] - push[1]; s.y += push[2] - push[3];
    if (hit) { if (!rb._wallHitT || this.time - rb._wallHitT > 0.4) rb.stats.wallHits++; rb._wallHitT = this.time; }
  }
  collideRobotEggs(rb) {
    const s = rb.state, E = this.field, r = RULES.EGG_R, me = E.eggMass, F = RULES.FIELD; const parts = rb._wp || rb.worldParts();
    for (const e of this.eggs) {
      if (e.gone) continue; if (Math.abs(e.x - s.x) > (rb.radius || 0.3) + 0.03 || Math.abs(e.y - s.y) > (rb.radius || 0.3) + 0.03) continue;
      for (const wp of parts) {
        const p = wp.p; if (!p.solid || p.z0 >= RULES.EGG_H) continue; const dx = e.x - wp.wx, dy = e.y - wp.wy; if (dx * dx + dy * dy > (p.hx + p.hy + r) ** 2) continue;
        const lxx = wp.c * dx + wp.s * dy, lyy = -wp.s * dx + wp.c * dy; const qx = clamp(lxx, -p.hx, p.hx), qy = clamp(lyy, -p.hy, p.hy);
        const ddx = lxx - qx, ddy = lyy - qy; const dist = Math.hypot(ddx, ddy); if (dist >= r) continue;
        let nlx, nly, pen, cqx = qx, cqy = qy;
        if (dist > 1e-9) { nlx = ddx / dist; nly = ddy / dist; pen = r - dist; } else { const px = p.hx - Math.abs(lxx), py = p.hy - Math.abs(lyy); if (px < py) { nlx = Math.sign(lxx) || 1; nly = 0; pen = px + r; cqx = nlx * p.hx; } else { nlx = 0; nly = Math.sign(lyy) || 1; pen = py + r; cqy = nly * p.hy; } }
        const nx = wp.c * nlx - wp.s * nly, ny = wp.s * nlx + wp.c * nly; const cpx = wp.wx + wp.c * cqx - wp.s * cqy, cpy = wp.wy + wp.s * cqx + wp.c * cqy;
        const rx = cpx - s.x, ry = cpy - s.y; let [vrx, vry] = rb.pointVel(rx, ry); if (wp.piv && wp.wS) { vrx += -wp.wS * (cpy - wp.piv[1]); vry += wp.wS * (cpx - wp.piv[0]); }
        const pinned = (e.x - r < 0.001 && nx < -0.3) || (e.x + r > F - 0.001 && nx > 0.3) || (e.y - r < 0.001 && ny < -0.3) || (e.y + r > F - 0.001 && ny > 0.3); const invE = pinned ? 0 : 1 / me;
        const rvx = e.vx - vrx, rvy = e.vy - vry, vn = rvx * nx + rvy * ny;
        if (vn < 0) { const j = -(1 + E.eRobotEgg) * vn / (invE + rb.invMass(rx, ry, nx, ny)); e.vx += j * nx * invE; e.vy += j * ny * invE; rb.applyImp(rx, ry, -j * nx, -j * ny);
          const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty; const jt = clamp(-vt / (invE + rb.invMass(rx, ry, tx, ty)), -E.muRobotEgg * j, E.muRobotEgg * j); e.vx += jt * tx * invE; e.vy += jt * ty * invE; rb.applyImp(rx, ry, -jt * tx, -jt * ty); }
        if (pinned) { s.x -= nx * pen; s.y -= ny * pen; } else { const w = me / (me + rb.mass); e.x += nx * pen * (1 - w); e.y += ny * pen * (1 - w); s.x -= nx * pen * w; s.y -= ny * pen * w; }
      }
    }
  }
  collideRobots() {
    if (this.robots.length < 2) return; const [A, B] = this.robots; if (Math.hypot(A.state.x - B.state.x, A.state.y - B.state.y) > (A.radius || 0.3) + (B.radius || 0.3)) return; const pa = A._wp || A.worldParts(), pb = B._wp || B.worldParts();
    const test = (X, Y, px, py, sign) => {
      for (const a of px) { if (!a.p.solid) continue; for (const b of py) { if (!b.p.solid || a.p.z1 <= b.p.z0 || b.p.z1 <= a.p.z0) continue;
        for (const [cx, cy] of a.corners) {
          const dx = cx - b.wx, dy = cy - b.wy, lx = b.c * dx + b.s * dy, ly = -b.s * dx + b.c * dy; if (Math.abs(lx) >= b.p.hx || Math.abs(ly) >= b.p.hy) continue;
          const ox = b.p.hx - Math.abs(lx), oy = b.p.hy - Math.abs(ly); let nlx = 0, nly = 0, pen; if (ox < oy) { nlx = Math.sign(lx) || 1; pen = ox; } else { nly = Math.sign(ly) || 1; pen = oy; }
          const nx = b.c * nlx - b.s * nly, ny = b.s * nlx + b.c * nly; // Y'den X'e doğru
          const rxX = cx - X.state.x, ryX = cy - X.state.y, rxY = cx - Y.state.x, ryY = cy - Y.state.y;
          const [vax, vay] = X.pointVel(rxX, ryX), [vbx, vby] = Y.pointVel(rxY, ryY); const vn = (vax - vbx) * nx + (vay - vby) * ny;
          if (vn < 0) { const j = -1.1 * vn / (X.invMass(rxX, ryX, nx, ny) + Y.invMass(rxY, ryY, nx, ny)); X.applyImp(rxX, ryX, j * nx, j * ny); Y.applyImp(rxY, ryY, -j * nx, -j * ny); }
          X.state.x += nx * pen / 2; X.state.y += ny * pen / 2; Y.state.x -= nx * pen / 2; Y.state.y -= ny * pen / 2;
        } } }
    };
    test(A, B, pa, pb); test(B, A, B.worldParts(), A.worldParts());
  }
  collideEggsWalls() { const F = RULES.FIELD, r = RULES.EGG_R; for (const e of this.eggs) { if (e.gone) continue; if (e.x < r) { e.x = r; if (e.vx < 0) e.vx = -e.vx * 0.3; } if (e.x > F - r) { e.x = F - r; if (e.vx > 0) e.vx = -e.vx * 0.3; } if (e.y < r) { e.y = r; if (e.vy < 0) e.vy = -e.vy * 0.3; } if (e.y > F - r) { e.y = F - r; if (e.vy > 0) e.vy = -e.vy * 0.3; } } }
  collideEggs() {
    const r2 = RULES.EGG_R * 2, L = this.eggs;
    for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.gone) continue; for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.gone) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 >= r2 * r2 || d2 < 1e-12) continue; const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = r2 - d;
      a.x -= nx * pen / 2; a.y -= ny * pen / 2; b.x += nx * pen / 2; b.y += ny * pen / 2; const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (vn < 0) { const jj = -1.4 * vn / 2; a.vx -= jj * nx; a.vy -= jj * ny; b.vx += jj * nx; b.vy += jj * ny; } } }
  }
  zoneOf(x, y, rad = 0) { for (const z of this.zones) if (x + rad >= z.x0 && x - rad <= z.x1 && y + rad >= z.y0 && y - rad <= z.y1) return z.kind; return null; }
  eggUnderRobot(e) {
    for (const rb of this.robots) {
      for (const wp of rb.worldParts()) { const dx = e.x - wp.wx, dy = e.y - wp.wy, lx = wp.c * dx + wp.s * dy, ly = -wp.s * dx + wp.c * dy; if (Math.abs(lx) < wp.p.hx + 0.004 && Math.abs(ly) < wp.p.hy + 0.004) return true; }
      const s = rb.state, dx = e.x - s.x, dy = e.y - s.y, c = Math.cos(s.th), n = Math.sin(s.th), lx = c * dx + n * dy, ly = -n * dx + c * dy; const env = rb.envelope();
      if (lx > env.minX && lx < env.maxX && ly > env.minY && ly < env.maxY) return true;
    }
    return false;
  }
  referee(dt) {
    if (!this.field.refereeCollect) return;
    for (const e of this.eggs) {
      if (e.gone) continue; const z = this.zoneOf(e.x, e.y, RULES.EGG_R);
      if (z && Math.hypot(e.vx, e.vy) < 0.005 && !this.eggUnderRobot(e)) { e.still += dt; if (e.still >= 1) { e.gone = true; e.zone = z; e.by = e.toucher || null; (this.banked[z] = this.banked[z] || []).push(e); if (!this.firstDrop) this.firstDrop = { t: this.time, zone: z }; this.events.push({ t: this.time, txt: `${{ penalty: 'Ceza', red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil' }[e.kind]} yumurta ${{ red: 'kırmızı', blue: 'mavi', green: 'yeşil' }[z]} köşede — hakem aldı` }); } }
      else e.still = 0;
    }
  }
  result() {
    const sc = this.score(), teams = this.robots.map(r => r.team); const ok = (t) => sc.detail[t].own > 0;
    if (teams.length < 2) { const t = teams[0]; return { sc, winner: t && ok(t) ? t : null, reason: t && ok(t) ? 'tek robot' : 'kendi rengi yok' }; }
    const [a, b] = teams; let w = null, reason = '';
    if (ok(a) && !ok(b)) { w = a; reason = 'rakip kendi rengini bırakamadı'; } else if (ok(b) && !ok(a)) { w = b; reason = 'rakip kendi rengini bırakamadı'; }
    else if (!ok(a) && !ok(b)) { reason = 'iki robot da kendi rengini bırakamadı'; }
    else if (sc[a] !== sc[b]) { w = sc[a] > sc[b] ? a : b; reason = 'daha çok puan'; } else { w = this.firstDrop ? this.firstDrop.zone : null; if (w !== a && w !== b) w = null; reason = 'eşitlik — ilk yumurtayı bırakan'; }
    return { sc, winner: w, reason };
  }
  snapshot() {
    return { t: this.time, sc: this.score(), r: this.robots.map(rb => ({ x: rb.state.x, y: rb.state.y, z: rb.state.z, th: rb.state.th, q: rb.state.q ? Object.assign({}, rb.state.q) : null, sa: Object.assign({}, rb.servoAng), sp: [rb.wheelInfo.L.spin, rb.wheelInfo.R.spin], led: rb.ledColor() })),
      e: this.eggs.map(e => e.gone ? null : [e.x, e.y, e.z, e.phi, e.q ? [e.q.x, e.q.y, e.q.z, e.q.w] : null]), b: Object.fromEntries(Object.entries(this.banked).map(([k, v]) => [k, v.length])) };
  }
  applySnapshot(s) {
    this.robots.forEach((rb, i) => { const r = s.r[i]; if (!r) return; Object.assign(rb.state, { x: r.x, y: r.y, z: r.z, th: r.th, q: r.q }); rb.servoAng = Object.assign({}, r.sa); rb.wheelInfo.L.spin = r.sp[0]; rb.wheelInfo.R.spin = r.sp[1]; rb._ledOverride = r.led; });
    this.eggs.forEach((e, i) => { const v = s.e[i]; e._hidden = !v; if (v) { e.x = v[0]; e.y = v[1]; e.z = v[2]; e.phi = v[3]; e.q = v[4] ? { x: v[4][0], y: v[4][1], z: v[4][2], w: v[4][3] } : e.q; } });
  }
  score() {
    const sc = { red: 0, blue: 0, detail: { red: { own: 0, wrong: 0, pen: 0, green: 0, led: 0 }, blue: { own: 0, wrong: 0, pen: 0, green: 0, led: 0 } } };
    const add = (zone, e) => {
      if (zone === 'green') { if (e.kind === 'green' && e.by && sc.detail[e.by]) { sc[e.by] += 2; sc.detail[e.by].green++; } return; }
      const d = sc.detail[zone]; if (!d) return; if (e.kind === 'penalty') { sc[zone] -= 3; d.pen++; } else if (e.kind === zone) { sc[zone] += 1; d.own++; } else if (!e.by || e.by === zone) { sc[zone] -= 2; d.wrong++; } else { d.planted = (d.planted || 0) + 1; }
    };
    for (const z of Object.keys(this.banked)) for (const e of this.banked[z]) add(z, e);
    for (const e of this.eggs) { if (e.gone) continue; const z = this.zoneOf(e.x, e.y, RULES.EGG_R); if (z && !this.eggUnderRobot(e)) add(z, Object.assign({ by: e.toucher }, e)); }
    for (const rb of this.robots) if (rb.ledPens) { sc[rb.team] -= 10 * rb.ledPens; sc.detail[rb.team].led = rb.ledPens; }
    return sc;
  }
}
