// ===================== 3B FİZİK MOTORU (Rapier) — çok robotlu =====================
function makeMatch3D(R) {
  const { RULES, Match } = SIM;
  const G_WORLD = 0x0001, G_FLOOR = 0x0008;
  const grp = (m, f) => ((m & 0xffff) << 16) | (f & 0xffff);
  const qYaw = (a) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
  const qMul = (a, b) => ({ w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w });
  const qRot = (q, v) => { const { x, y, z, w } = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  const yawOf = (q) => Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
  const toi = (h) => (h.toi !== undefined ? h.toi : h.timeOfImpact);
  const MULT = R.CoefficientCombineRule ? R.CoefficientCombineRule.Multiply : undefined;
  const fr = (cd, mu, rest = 0) => { cd.setFriction(mu); if (MULT !== undefined) cd.setFrictionCombineRule(MULT); cd.setRestitution(rest); return cd; };

  return class Match3D extends Match {
    get dt() { return 1 / 500; }
    get engineName() { return '3B'; }
    afterReset() { this.build(); }
    build() {
      if (this.world) { try { this.world.free(); } catch (e) { } }
      const F = RULES.FIELD, E = this.field; const W = new R.World({ x: 0, y: 0, z: -RULES.G }); W.timestep = this.dt;
      try { if (W.integrationParameters && 'numSolverIterations' in W.integrationParameters) W.integrationParameters.numSolverIterations = (globalThis.ITERS || 2); /* Rapier 0.12'de çok yineleme + küçük adım kayma sürtünmesini zayıflatıyor (yumurtalar buz gibi kayıyordu) */ } catch (e) { }
      this.world = W; this.eggByCollider = new Map(); this.robotByCollider = new Map(); this.wallColliders = new Set();
      const fb = W.createRigidBody(R.RigidBodyDesc.fixed());
      W.createCollider(fr(R.ColliderDesc.cuboid(F / 2 + 0.1, F / 2 + 0.1, 0.02).setTranslation(F / 2, F / 2, -0.02), 1.0).setCollisionGroups(grp(G_FLOOR, 0xffff)), fb);
      const t = 0.02, H = RULES.WALL_H;
      for (const [cx, cy, hx, hy] of [[-t / 2, F / 2, t / 2, F / 2 + t], [F + t / 2, F / 2, t / 2, F / 2 + t], [F / 2, -t / 2, F / 2 + t, t / 2], [F / 2, F + t / 2, F / 2 + t, t / 2]])
        this.wallColliders.add(W.createCollider(fr(R.ColliderDesc.cuboid(hx, hy, H / 2).setTranslation(cx, cy, H / 2), E.muWall, 0.15).setCollisionGroups(grp(G_WORLD, 0xffff)), fb).handle);
      const r = RULES.EGG_R, hh = RULES.EGG_H / 2, vol = Math.PI * r * r * RULES.EGG_H, qx90 = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
      for (const e of this.eggs) this.addEggBody(e);
      this.robots.forEach((rb, i) => this.buildRobot(rb, i));
    }
    buildRobot(rb, idx) {
      const W = this.world, E = this.field, s = rb.state, wr = rb.wheelR, yaw = qYaw(s.th);
      const bit = 0x0010 << idx, RG = grp(bit, 0xffff & ~bit); rb.colliders = new Set(); rb.servoCmd = Object.assign({}, rb.servoAng);
      const mw = 0.045, gates = rb.parts.filter(p => p.servoPin != null && p.pivot), mg = 0.02;
      const mBody = Math.max(0.2, rb.mass - 2 * mw - gates.length * mg);
      const L = 0.2, Wd = 0.17, Hh = 0.08;
      const bd = R.RigidBodyDesc.dynamic().setTranslation(s.x, s.y, wr + 0.001).setRotation(yaw).setCanSleep(false)
        .setAdditionalMassProperties(mBody, { x: rb.comX, y: 0, z: rb.comZ - wr }, { x: mBody * (Wd * Wd + Hh * Hh) / 12, y: mBody * (L * L + Hh * Hh) / 12, z: mBody * (L * L + Wd * Wd) / 12 }, { x: 0, y: 0, z: 0, w: 1 });
      const ch = W.createRigidBody(bd); rb.body = ch;
      const addCol = (cd, body) => { const c = W.createCollider(cd.setCollisionGroups(RG), body); rb.colliders.add(c.handle); this.robotByCollider.set(c.handle, rb); return c; };
      for (const p of rb.parts) {
        if (p.auto || (p.servoPin != null && p.pivot) || !p.solid) continue;
        const hz = Math.max(0.002, (p.z1 - p.z0) / 2);
        addCol(fr(R.ColliderDesc.cuboid(p.hx, p.hy, hz).setTranslation(p.x, p.y, (p.z0 + p.z1) / 2 - wr).setRotation(qYaw(p.ang)).setDensity(0), E.muRobotEgg, 0.2), ch);
      }
      if (rb.model3d && rb.model3d.carpisma && rb.model3d.pos && R.ColliderDesc.convexHull) {
        const src = rb.model3d.pos, step = Math.max(3, Math.floor(src.length / 3 / 3000) * 3), pts = [];
        for (let i = 0; i < src.length; i += step) pts.push(src[i], src[i + 1], Math.max(src[i + 2], 0.004) - wr);
        const cd = R.ColliderDesc.convexHull(new Float32Array(pts)); if (cd) addCol(fr(cd.setDensity(0), E.muRobotEgg, 0.2), ch);
      }
      if (rb.caster) { const cr = Math.max(0.004, rb.caster.r); addCol(fr(R.ColliderDesc.ball(cr).setTranslation(rb.caster.x, rb.caster.y, cr - wr).setDensity(0), 0.02), ch); }
      rb.wheels = {}; rb.wheelList = [];
      for (const ax of (rb.axles || [rb.wheelX])) for (const [side, sy] of [['L', 1], ['R', -1]]) {
        const lp = [ax, sy * rb.track / 2, 0], wp = qRot(yaw, lp);
        const bdesc = R.RigidBodyDesc.dynamic().setTranslation(s.x + wp[0], s.y + wp[1], wr + 0.001).setRotation(yaw).setCanSleep(false);
        const Jr = rb.motor.jRefl || 0; if (Jr > 0 && bdesc.setAdditionalMassProperties) bdesc.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 1e-7, y: Jr, z: 1e-7 }, { x: 0, y: 0, z: 0, w: 1 }); // redüktörden yansıyan rotor ataleti
        const body = W.createRigidBody(bdesc);
        // Lastik: zeminle tek noktadan (gerçek lastik izi gibi) değen küre + yumurta/duvar/robotla çarpışan ince silindir.
        // (Düz silindirin iki kenarı zemine ayrı ayrı sürtüp dönüşü olduğundan çok zorlaştırıyordu.)
        const wcol = W.createCollider(fr(R.ColliderDesc.ball(wr).setDensity(mw / (4 / 3 * Math.PI * wr * wr * wr)), (rb.muS + rb.muK) / 2, 0).setCollisionGroups(grp(bit, G_FLOOR)), body); rb.colliders.add(wcol.handle); this.robotByCollider.set(wcol.handle, rb);
        { const side = W.createCollider(fr(R.ColliderDesc.cylinder(rb.wheelW / 2, wr * 0.985).setDensity(0), E.muRobotEgg, 0.1).setCollisionGroups(grp(bit, 0xffff & ~bit & ~G_FLOOR)), body); rb.colliders.add(side.handle); this.robotByCollider.set(side.handle, rb); }
        const j = W.createImpulseJoint(R.JointData.revolute({ x: lp[0], y: lp[1], z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), ch, body, true);
        if (j.configureMotorModel && R.MotorModel) j.configureMotorModel(R.MotorModel.ForceBased);
        const wobj = { body, j, spin: 0, side, col: wcol, mu0: (rb.muS + rb.muK) / 2 }; rb.wheelList.push(wobj); if (!rb.wheels[side]) rb.wheels[side] = wobj;
      }
      rb.gates = [];
      for (const p of gates) {
        const pp = rb.partPose(p), zc = (p.z0 + p.z1) / 2 - wr, wpv = qRot(yaw, [p.pivot[0], p.pivot[1], zc]);
        const body = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(s.x + wpv[0], s.y + wpv[1], wr + 0.001 + zc).setRotation(qYaw(s.th + pp.a)).setCanSleep(false));
        const hz = Math.max(0.002, (p.z1 - p.z0) / 2);
        addCol(fr(R.ColliderDesc.cuboid(p.len / 2, p.hy, hz).setTranslation(p.len / 2, 0, 0).setDensity(mg / (p.len * 2 * p.hy * 2 * hz)), E.muRobotEgg, 0.2), body);
        const j = W.createImpulseJoint(R.JointData.revolute({ x: p.pivot[0], y: p.pivot[1], z: zc }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), ch, body, true);
        if (j.configureMotorModel && R.MotorModel) j.configureMotorModel(R.MotorModel.ForceBased);
        rb.gates.push({ p, body, j });
      }
      this.syncRobot(rb);
    }
    step(dt) {
      this.useRng();
      for (const rb of this.robots) rb.runPrograms(this.time);
      for (const rb of this.robots) {
        this.updateServos(rb, dt, rb.servoCmd);
        for (const g of rb.gates) g.j.configureMotorPosition(((g.p.angOff + g.p.dir * (rb.servoCmd[g.p.servoPin] ?? 0)) * Math.PI) / 180, 1.5, 0.05);
        const M = rb.motor, k = M.tStall / M.w0;
        for (const wh of rb.wheelList) { const side = wh.side;
          const { V, mode, duty } = rb.sideVoltage(side);
          let target = 0, damp = 1e-6; // boşta: motor serbest, sadece dişli sürtünmesi (aşağıda) frenler
          if (mode === 'drive') { target = (V / M.vNom) * M.w0; damp = k; } else if (mode === 'brake') { damp = k * Math.max(duty || 1, 0.05); }
          if (rb.kusur && mode === 'drive') damp *= rb.kusur.tork[side];
          if (wh.col && ((this._fmT = (this._fmT || 0) + 1) % 25 === 0)) { const t = wh.body.translation(); try { wh.col.setFriction(wh.mu0 * SIM.floorMu(this, t.x, t.y)); } catch (e) { } }
          wh.j.configureMotorVelocity(target, damp); wh.mode = mode; wh.V = V; wh.target = target; wh.damp = damp; wh.duty = duty ?? 1;
          const wi = rb.wheelInfo[side]; const wr = (wi.rpm || 0) * 2 * Math.PI / 60; if (Math.abs(wr) > 0.3 && M.tFric > 0) { const q = rb.body.rotation(); const ax = qRot(q, [0, 1, 0]); const j = -Math.sign(wr) * M.tFric * dt; wh.body.applyTorqueImpulse({ x: ax[0] * j, y: ax[1] * j, z: ax[2] * j }, true); rb.body.applyTorqueImpulse({ x: -ax[0] * j, y: -ax[1] * j, z: -ax[2] * j }, true); }
        }
        if (rb.caster && rb.caster.tip === 'sarhos') { // döner (sarhoş) teker: 2B ile aynı model, şasiye yana itki olarak
          const C = rb.caster, q = rb.body.rotation(), cp = qRot(q, [C.x, C.y, 0]), t = rb.body.translation(), lv = rb.body.linvel(), av = rb.body.angvel();
          const vx = lv.x - av.z * cp[1], vy = lv.y + av.z * cp[0], sp = Math.hypot(vx, vy); if (C.phi == null) C.phi = rb.state.th;
          const hx = Math.cos(C.phi), hy = Math.sin(C.phi), vLat = -vx * hy + vy * hx; if (sp > 0.005) C.phi += Math.max(-40, Math.min(40, vLat / Math.max(0.004, C.trail))) * dt;
          const lx = -Math.sin(C.phi), ly = Math.cos(C.phi), cr = cp[0] * ly - cp[1] * lx, im = 1 / rb.mass + cr * cr / rb.inertia; const Nc = rb.mass * 9.81 * (1 - rb.loadFrac);
          const jl = Math.max(-0.6 * Nc * dt, Math.min(0.6 * Nc * dt, -vLat / im)); rb.body.applyImpulseAtPoint({ x: jl * lx, y: jl * ly, z: 0 }, { x: t.x + cp[0], y: t.y + cp[1], z: t.z + cp[2] }, true);
        }
        if (rb.calib && rb.calib.donus) { const q = rb.body.rotation(), up = qRot(q, [0, 0, 1]), av = rb.body.angvel(); const wu = av.x * up[0] + av.y * up[1] + av.z * up[2]; const dw = SIM.calibYaw(rb, wu, dt); if (dw) { const j = dw * rb.inertia; rb.body.applyTorqueImpulse({ x: up[0] * j, y: up[1] * j, z: up[2] * j }, true); } }
      }
      this.world.step();
      for (const rb of this.robots) this.syncRobot(rb);
      this.syncEggs();
      this.time += dt; this.afterStep(dt);
      for (const e of this.eggs) if (e.gone && e.body) { try { this.world.removeRigidBody(e.body); } catch (er) { } e.body = null; }
    }
    syncRobot(rb) {
      const c = rb.body, s = rb.state; const t = c.translation(), q = c.rotation(), lv = c.linvel(), av = c.angvel();
      s.x = t.x; s.y = t.y; s.z = t.z; { const yw = yawOf(q); s.th = s.th == null ? yw : s.th + Math.atan2(Math.sin(yw - s.th), Math.cos(yw - s.th)); } s.vx = lv.x; s.vy = lv.y; s.w = av.z; s.q = q;
      s.tilt = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.y * q.y)))) * 180 / Math.PI;
      const axle = qRot(q, [0, 1, 0]), fwd = qRot(q, [1, 0, 0]);
      for (const side of ['L', 'R']) { const ws = rb.wheelList.filter(w => w.side === side); let F = 0, rpm = 0, slip = false;
        for (const wh of ws) { const wa = wh.body.angvel(); const wrel = (wa.x - av.x) * axle[0] + (wa.y - av.y) * axle[1] + (wa.z - av.z) * axle[2];
          const wl = wh.body.linvel(); const vf = wl.x * fwd[0] + wl.y * fwd[1] + wl.z * fwd[2]; wh.spin += wrel * this.dt;
          F += (wh.damp || 0) * ((wh.target || 0) - wrel) / rb.wheelR; if (wh.mode === 'drive') rb._Iacc = (rb._Iacc || 0) + rb.motor.iStall * Math.min(1.2, Math.abs((wh.damp || 0) * ((wh.target || 0) - wrel)) / rb.motor.tStall) * (wh.duty ?? 1); rpm += wrel * 60 / (2 * Math.PI) / ws.length; slip = slip || Math.abs(wrel * rb.wheelR - vf) > 0.04; }
        const wi = rb.wheelInfo[side], w0 = ws[0]; wi.V = w0.V || 0; wi.F = F; wi.slip = slip; wi.rpm = rpm; wi.mode = w0.mode; wi.spin = w0.spin;
      }
      for (const g of rb.gates) { let d = (yawOf(g.body.rotation()) - s.th) * 180 / Math.PI; d = ((d % 360) + 540) % 360 - 180; rb.servoAng[g.p.servoPin] = (d - g.p.angOff) / (g.p.dir || 1); rb.servoVel[g.p.servoPin] = 0; }
      if (s.z < -0.2) { rb.body.setTranslation({ x: s.x, y: s.y, z: 0.05 }, true); }
    }
    addEggBody(e) {
      const W = this.world, E = this.field, r = RULES.EGG_R, hh = RULES.EGG_H / 2, vol = Math.PI * r * r * RULES.EGG_H, qx90 = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
      const q = qMul(qYaw(e.phi || 0), qx90);
      const body = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(e.x, e.y, hh + 0.0005).setRotation(q).setCcdEnabled(true).setLinearDamping(0.05).setAngularDamping(0.2));
      if (e.vx || e.vy) body.setLinvel({ x: e.vx || 0, y: e.vy || 0, z: 0 }, true);
      const col = W.createCollider(fr(R.ColliderDesc.cylinder(hh, r).setDensity(E.eggMass / vol), E.muEggFloor, 0.2).setCollisionGroups(grp(G_WORLD, 0xffff)), body);
      e.body = body; e.q = q; this.eggByCollider.set(col.handle, e);
    }
    placeEgg(e, x, y, vx, vy) { super.placeEgg(e, x, y, vx, vy); if (e.body) { try { this.world.removeRigidBody(e.body); } catch (er) { } e.body = null; } this.addEggBody(e); }
    syncEggs() {
      for (const e of this.eggs) {
        if (!e.body) continue; const p = e.body.translation(), v = e.body.linvel(), q = e.body.rotation();
        e.x = p.x; e.y = p.y; e.z = p.z; e.vx = v.x; e.vy = v.y; e.q = q; const ax = qRot(q, [1, 0, 0]); e.phi = Math.atan2(ax[1], ax[0]);
        if (p.z < -0.05 || p.x < -0.05 || p.y < -0.05 || p.x > RULES.FIELD + 0.05 || p.y > RULES.FIELD + 0.05) { e.body.setTranslation({ x: Math.min(RULES.FIELD - 0.03, Math.max(0.03, p.x)), y: Math.min(RULES.FIELD - 0.03, Math.max(0.03, p.y)), z: 0.02 }, true); e.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      }
    }
    rayCast3D(rb, x, y, z, a, maxD) {
      try {
        const ray = new R.Ray({ x, y, z }, { x: Math.cos(a), y: Math.sin(a), z: 0 }); let best = maxD, hit = null;
        this.world.intersectionsWithRay(ray, maxD, true, (h) => {
          const hd = h.collider.handle, d = toi(h); if (rb.colliders && rb.colliders.has(hd)) return true;
          if (d < best) { const e = this.eggByCollider.get(hd); const o = this.robotByCollider.get(hd); if (e) { best = d; hit = e; } else if (o) { best = d; hit = { robot: o }; } else if (this.wallColliders.has(hd)) { best = d; hit = 'duvar'; } }
          return true;
        });
        return { d: best, hit };
      } catch (er) { this.rayCast3D = null; return null; }
    }
  };
}
