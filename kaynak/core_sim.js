
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
const Sensors = {
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
    for (const o of m.robots) { if (o === rb) continue; for (const wp of o.worldParts()) { if (z < wp.p.z0 - 0.01 || z > wp.p.z1 + 0.01) continue; const t = rayOBB(x, y, dx, dy, wp); if (t != null && t < best) { best = t; hit = { robot: o }; } } }
    if (opts.self) for (const wp of rb.worldParts()) { if (wp.p.auto || !wp.p.solid || z < wp.p.z0 || z > wp.p.z1) continue; const t = rayOBB(x, y, dx, dy, wp); if (t != null && t > 0.002 && t < best) { best = t; hit = { self: wp.p }; } }
    return { d: best, hit };
  },
  ultrasonic(m, rb, s) {
    const w = rb.sensorWorld(s); let best = null;
    for (const da of [-0.26, -0.13, 0, 0.13, 0.26]) { const r = Sensors.ray(m, rb, w.x, w.y, w.a + da, w.z, 4.0); if (r.hit && (best == null || r.d < best)) best = r.d; }
    if (best == null) return null; if (best < 0.02) best = 0.02 + Math.random() * 0.01;
    return best + (Math.random() - 0.5) * 0.004;
  },
  irObstacle(m, rb, s) { const w = rb.sensorWorld(s); for (const da of [-0.08, 0, 0.08]) { const r = Sensors.ray(m, rb, w.x, w.y, w.a + da, w.z, s.range); if (r.hit) return true; } return false; },
  surfaceAt(m, x, y) {
    const r = RULES.EGG_R;
    for (const e of m.eggs) { if (e.gone) continue; const dx = x - e.x, dy = y - e.y; if (dx * dx + dy * dy <= r * r) return Sensors.eggSurface(e, x, y); }
    const z = m.zoneOf(x, y); return z === 'red' ? SURF.red : z === 'blue' ? SURF.blue : SURF.white;
  },
  eggSurface(e, x, y) {
    if (e.kind !== 'penalty') return SURF[e.kind];
    const ang = Math.atan2(y - e.y, x - e.x) - e.phi; if (Math.hypot(x - e.x, y - e.y) < 0.004) return { ir: (SURF.red.ir + SURF.blue.ir) / 2, rgb: SURF.red.rgb.map((v, i) => (v + SURF.blue.rgb[i]) / 2), name: 'ceza' };
    return Math.sin(ang) >= 0 ? SURF.red : SURF.blue;
  },
  tcrt(m, rb, s) { const w = rb.sensorWorld(s); const sf = Sensors.surfaceAt(m, w.x, w.y); let v = sf.ir; if (w.z > 0.03) v = v + (1010 - v) * Math.min(1, (w.z - 0.03) / 0.03); return clamp(Math.round(v + (Math.random() - 0.5) * 16), 0, 1023); },
  colorTarget(m, rb, s) {
    const w = rb.sensorWorld(s); if ((s.bakis || 'asagi') === 'asagi') return Sensors.surfaceAt(m, w.x, w.y);
    const r = Sensors.ray(m, rb, w.x, w.y, w.a, w.z, s.range, { wallTol: 0 }); if (!r.hit) return SURF.none; if (r.hit === 'duvar') return SURF.white; if (r.hit.robot) return SURF.robot;
    return Sensors.eggSurface(r.hit, w.x + Math.cos(w.a) * r.d, w.y + Math.sin(w.a) * r.d);
  },
  tcsPeriod(m, rb, s) {
    const g = (k, def) => k == null ? def : (rb.duty(k) > 0.5 ? 1 : 0);
    let sc; if (s.s0 == null && s.s1 == null) sc = (s.olcek ?? 20) / 100; else { const S0 = g(s.s0, 1), S1 = g(s.s1, 0); sc = (!S0 && !S1) ? 0 : (!S0 && S1) ? 0.02 : (S0 && !S1) ? 0.2 : 1; }
    if (sc === 0) return null;
    const S2 = g(s.s2, 0), S3 = g(s.s3, 0); const [R, G, B] = Sensors.colorTarget(m, rb, s).rgb;
    let refl = (!S2 && !S3) ? R : (!S2 && S3) ? B : (S2 && !S3) ? (R + G + B) / 3 * 1.6 : G; refl = 0.25 + 0.75 * refl;
    return 1e6 / (2 * 60000 * sc * refl * (1 + (Math.random() - 0.5) * 0.04));
  },
  sharp(m, rb, s) { const w = rb.sensorWorld(s); const r = Sensors.ray(m, rb, w.x, w.y, w.a, w.z, 1.5); const d = (r.hit ? r.d : 1.5) * 100; let V = d < 7 ? 2.9 * d / 7 : 27.728 * Math.pow(d, -1.2045); V = clamp(V, 0.3, 3.1); return clamp(Math.round(V / 5 * 1023 + (Math.random() - 0.5) * 8), 0, 1023); },
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
class Match {
  constructor(opts) {
    this.opts = opts || {}; const S = this.opts.saha || {};
    this.field = {
      eggMass: (S.yumurta_kutle_g || 25) / 1000, muEggFloor: S.mu_yumurta_zemin ?? 0.35, muRobotEgg: S.mu_robot_yumurta ?? 0.3, muWall: S.mu_duvar ?? 0.4,
      eRobotEgg: 0.2, eWall: 0.15, seed: S.tohum ?? 2026, refereeCollect: S.hakem_toplar ?? true,
      colors: Object.assign({ zemin: '#f6f5f1', kirmizi: '#c1121c', mavi: '#25356b', duvar: '#e2e2dc' }, S.renkler || {}),
    };
    this.startPoses = this.opts.startPoses || {};
    this.reset();
  }
  get dt() { return 0.001; }
  get engineName() { return '2B'; }
  defaultPose(team) { const F = RULES.FIELD; return team === 'red' ? { x: 0.25, y: 0.25, th: Math.PI / 4 } : { x: F - 0.25, y: F - 0.25, th: Math.PI * 5 / 4 }; }
  reset() {
    this.time = 0; this.ended = false; this.banked = { red: [], blue: [] }; this.firstDrop = null; this.events = [];
    this.placeEggs();
    this.robots = [];
    for (const team of ['red', 'blue']) { const p = (this.opts.profiles || {})[team]; if (!p) continue; const rb = new Robot(p, team, this); rb.reset(this.startPoses[team] || this.defaultPose(team)); this.robots.push(rb); }
    if (this.afterReset) this.afterReset();
  }
  placeEggs() {
    const rnd = mulberry32(this.field.seed | 0), F = RULES.FIELD, Z = RULES.ZONE; const eggs = [], kinds = [];
    for (let i = 0; i < 10; i++) kinds.push('red'); for (let i = 0; i < 10; i++) kinds.push('blue'); kinds.push('penalty');
    for (const k of kinds) for (let tries = 0; tries < 2000; tries++) {
      const x = 0.06 + rnd() * (F - 0.12), y = 0.06 + rnd() * (F - 0.12);
      if ((x < Z + 0.1 && y < Z + 0.1) || (x > F - Z - 0.1 && y > F - Z - 0.1)) continue; if (eggs.some(e => Math.hypot(e.x - x, e.y - y) < 0.09)) continue;
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
  }
  step(dt) {
    for (const rb of this.robots) rb.runPrograms(this.time);
    for (const rb of this.robots) { this.updateServos(rb, dt, rb.servoAng); this.drive2D(rb, dt); }
    const E = this.field, g = RULES.G;
    for (const rb of this.robots) { const s = rb.state; s.x += s.vx * dt; s.y += s.vy * dt; s.th += s.w * dt; }
    for (const e of this.eggs) { if (e.gone) continue; const sp = Math.hypot(e.vx, e.vy); if (sp > 0) { const dv = Math.min(sp, E.muEggFloor * g * dt); e.vx -= e.vx / sp * dv; e.vy -= e.vy / sp * dv; } e.x += e.vx * dt; e.y += e.vy * dt; }
    for (let it = 0; it < 3; it++) { for (const rb of this.robots) { this.collideRobotWalls(rb); this.collideRobotEggs(rb); } this.collideRobots(); this.collideEggsWalls(); this.collideEggs(); }
    this.time += dt; this.afterStep(dt);
  }
  afterStep(dt) {
    for (const rb of this.robots) { const s = rb.state; this.stepStats(rb, dt); if (rb.trail.length === 0 || this.time - rb.trail[rb.trail.length - 1][2] > 0.05) { rb.trail.push([s.x, s.y, this.time, s.th]); if (rb.trail.length > 4000) rb.trail.shift(); } }
    this.referee(dt);
  }
  drive2D(rb, dt) {
    const s = rb.state, g = RULES.G, M = rb.motor; const c = Math.cos(s.th), n = Math.sin(s.th), fx = c, fy = n, lx = -n, ly = c;
    const Nw = rb.mass * g * rb.loadFrac / 2, Nc = rb.mass * g * (1 - rb.loadFrac); const k = M.tStall / M.w0;
    for (const [side, sy] of [['L', 1], ['R', -1]]) {
      const wxL = rb.wheelX, wyL = sy * rb.track / 2, rx = c * wxL - n * wyL, ry = n * wxL + c * wyL;
      const [pvx, pvy] = rb.pointVel(rx, ry); const vf = pvx * fx + pvy * fy; const { V, mode, duty } = rb.sideVoltage(side); const wr = vf / rb.wheelR;
      let tau = mode === 'drive' ? M.tStall * (V / M.vNom) - k * wr * duty : mode === 'brake' ? -k * wr * duty : 0;
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
    for (let it = 0; it < 4; it++) for (const sy of [1, -1]) {
      const rx = c * rb.wheelX - n * sy * rb.track / 2, ry = n * rb.wheelX + c * sy * rb.track / 2; const [pvx, pvy] = rb.pointVel(rx, ry); const vl = pvx * lx + pvy * ly;
      const j = clamp(-vl / rb.invMass(rx, ry, lx, ly), -rb.muLat * Nw * dt, rb.muLat * Nw * dt); rb.applyImp(rx, ry, j * lx, j * ly);
    }
  }
  collideRobotWalls(rb) {
    const F = RULES.FIELD, s = rb.state, E = this.field; const push = [0, 0, 0, 0]; let hit = false;
    for (const wp of rb.worldParts()) {
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
    const s = rb.state, E = this.field, r = RULES.EGG_R, me = E.eggMass, F = RULES.FIELD; const parts = rb.worldParts();
    for (const e of this.eggs) {
      if (e.gone) continue;
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
    if (this.robots.length < 2) return; const [A, B] = this.robots; const pa = A.worldParts(), pb = B.worldParts();
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
  zoneOf(x, y, rad = 0) { const F = RULES.FIELD, Z = RULES.ZONE; if (x - rad <= Z && y - rad <= Z) return 'red'; if (x + rad >= F - Z && y + rad >= F - Z) return 'blue'; return null; }
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
      if (z && Math.hypot(e.vx, e.vy) < 0.005 && !this.eggUnderRobot(e)) { e.still += dt; if (e.still >= 1) { e.gone = true; e.zone = z; this.banked[z].push(e); if (!this.firstDrop) this.firstDrop = { t: this.time, zone: z }; this.events.push({ t: this.time, txt: `${e.kind === 'penalty' ? 'Ceza' : e.kind === 'red' ? 'Kırmızı' : 'Mavi'} yumurta ${z === 'red' ? 'kırmızı' : 'mavi'} alanda — hakem aldı` }); } }
      else e.still = 0;
    }
  }
  score() {
    const sc = { red: 0, blue: 0, detail: { red: { own: 0, wrong: 0, pen: 0 }, blue: { own: 0, wrong: 0, pen: 0 } } };
    const add = (zone, kind) => { const d = sc.detail[zone]; if (kind === 'penalty') { sc[zone] -= 3; d.pen++; } else if (kind === zone) { sc[zone] += 1; d.own++; } else { sc[zone] -= 2; d.wrong++; } };
    for (const z of ['red', 'blue']) for (const e of this.banked[z]) add(z, e.kind);
    for (const e of this.eggs) { if (e.gone) continue; const z = this.zoneOf(e.x, e.y, RULES.EGG_R); if (z && !this.eggUnderRobot(e)) add(z, e.kind); }
    return sc;
  }
}
