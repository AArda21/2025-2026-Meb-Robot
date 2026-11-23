// GitHub Actions üzerinde gerçek Rapier ile 3B fizik testleri
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const K = path.resolve('kaynak'); const read = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const RAPIER = (await import('@dimforge/rapier3d-compat')).default; await RAPIER.init();
const ctx = { console, Math, Date, setTimeout, performance, TextDecoder, atob: (s) => Buffer.from(s, 'base64').toString('binary') }; vm.createContext(ctx);
vm.runInContext(read('core3.js') + '\n;globalThis.SIM = SIM;', ctx);
vm.runInContext(read('profiles.js') + '\n;globalThis.DEFAULT_PROFILES = DEFAULT_PROFILES;', ctx);
vm.runInContext(read('physics3d.js') + '\n;globalThis.makeMatch3D = makeMatch3D;', ctx);
const SIM = ctx.SIM, P = ctx.DEFAULT_PROFILES, M3 = ctx.makeMatch3D(RAPIER);
const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
const clone = (o) => JSON.parse(JSON.stringify(o));
function drive(cls, code, secs, name) {
  const p = clone(P[0]); p.kartlar[0].kod = code; const m = new cls({ profiles: { red: p }, kural: '2026' }); const e = m.compileAll(); if (e.length) return log(name, 'DERLEME', e);
  const rb = m.robots[0]; const s0 = { x: rb.state.x, y: rb.state.y, th: rb.state.th }; const t0 = Date.now(); let maxTilt = 0, minZ = 9, maxZ = -9;
  while (m.time < secs) { m.step(m.dt); maxTilt = Math.max(maxTilt, rb.state.tilt || 0); minZ = Math.min(minZ, rb.state.z ?? 0); maxZ = Math.max(maxZ, rb.state.z ?? 0); }
  const dx = rb.state.x - s0.x, dy = rb.state.y - s0.y; const fwd = dx * Math.cos(s0.th) + dy * Math.sin(s0.th), side = -dx * Math.sin(s0.th) + dy * Math.cos(s0.th);
  const eggsZ = m.eggs.filter(e => !e.gone).map(e => e.z ?? 0.01); 
  log(name, m.engineName, { ileri_cm: +(fwd * 100).toFixed(1), yan_cm: +(side * 100).toFixed(1), donus_der: +((rb.state.th - s0.th) * 180 / Math.PI).toFixed(1), hiz_cms: +(Math.hypot(rb.state.vx, rb.state.vy) * 100).toFixed(1), egim_max: +maxTilt.toFixed(1), z_aralik: [+(minZ * 100).toFixed(2), +(maxZ * 100).toFixed(2)], rpmL: +rb.wheelInfo.L.rpm.toFixed(0), rpmR: +rb.wheelInfo.R.rpm.toFixed(0), yumurta_z_max_cm: +(Math.max(...eggsZ) * 100).toFixed(2), sure_ms: Date.now() - t0 });
}
const MOT = `#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\nvoid m(int a,int b){digitalWrite(IN1,a>=0);digitalWrite(IN2,a<0);digitalWrite(IN3,b>=0);digitalWrite(IN4,b<0);analogWrite(ENA,abs(a));analogWrite(ENB,abs(b));}\nvoid setup(){pinMode(ENA,OUTPUT);pinMode(ENB,OUTPUT);pinMode(IN1,OUTPUT);pinMode(IN2,OUTPUT);pinMode(IN3,OUTPUT);pinMode(IN4,OUTPUT);pinMode(A3,OUTPUT);digitalWrite(A3,HIGH);}\n`;
for (const cls of [SIM.Match, M3]) {
  drive(cls, MOT + 'void loop(){m(200,200);}', 1.0, 'ILERI_1sn');
  drive(cls, MOT + 'void loop(){m(-200,-200);}', 1.0, 'GERI_1sn');
  drive(cls, MOT + 'void loop(){m(-180,180);}', 1.0, 'SOLA_DON_1sn');
  drive(cls, MOT + 'void loop(){m(255,255);}', 0.25, 'KALKIS_0.25sn');
  for (const pw of [30, 60, 100, 150, 255]) drive(cls, MOT + `void loop(){m(${pw},${pw});}`, 1.5, 'PWM_' + pw);
  drive(cls, MOT + 'void loop(){m(255,255); delay(600); m(0,0); digitalWrite(IN1,HIGH);digitalWrite(IN2,HIGH);digitalWrite(IN3,HIGH);digitalWrite(IN4,HIGH);analogWrite(ENA,255);analogWrite(ENB,255); delay(5000);}', 1.2, 'FREN');
}
// Tam maçlar (3B)
const strat = fs.existsSync('test/strateji.ino') ? fs.readFileSync('test/strateji.ino', 'utf8') : null;
for (const [nm, a, b] of [['YumYum_vs_Rakip', P[0], P[2]], ['Antalya2026_vs_Rakip', P[1], P[2]]].concat(strat ? [['Strateji_vs_Rakip', Object.assign(clone(P[0]), { kartlar: [{ id: 'ana', tip: 'Uno', kod: strat }] }), P[2]]] : [])) {
  for (const cls of [SIM.Match, M3]) {
    const m = new cls({ profiles: { red: a, blue: b }, saha: { tohum: 7 }, kural: '2026' }); const e = m.compileAll(); const t0 = Date.now();
    let err = null; try { while (m.time < m.matchTime) m.step(m.dt); } catch (x) { err = x.message + ' ' + x.stack.split('\n')[1]; }
    const r = m.result(); log('MAC', nm, m.engineName, { sure_s: ((Date.now() - t0) / 1000).toFixed(1), puan: [r.sc.red, r.sc.blue], kazanan: r.winner, neden: r.reason, derleme_hata: e.length, hata: err, olay: m.events.length, egim: m.robots.map(x => +(x.stats.maxTilt).toFixed(1)), duvar: m.robots.map(x => x.stats.wallHits), sikisma: m.robots.map(x => +x.stats.stuckT.toFixed(1)) });
  }
}
// Kontrol (3B)
for (const p of P) { const r = await SIM.runTrial(p, M3, { sure: 10 }); log('KONTROL3B', p.ad, r.items.filter(i => i.cat === 'Hareket' || i.cat === 'Kod').map(i => i.level + ':' + i.txt)); }
fs.mkdirSync('sonuc', { recursive: true }); fs.writeFileSync('sonuc/fizik3d.txt', out.join('\n'));
// Kalibrasyon (gerçek robotla eşleştirme) 3B ve 2B
for (const p of P) { for (const [n, MC] of [['2B', SIM.Match], ['3B', M3]]) { const t0 = Date.now(); const a = SIM.measureMotion(p, MC, { tip: 'duz', pwm: 200, sure: 1 }); const b = SIM.measureMotion(p, MC, { tip: 'don', pwm: 170, sure: 1 });
  const c = SIM.autoCalibrate(p, MC, { duz: { pwm: 200, sure: 1, olcum: 38 }, don: { pwm: 170, sure: 1, olcum: 180 } }); const a2 = SIM.measureMotion(p, MC, { tip: 'duz', pwm: 200, sure: 1 }, c), b2 = SIM.measureMotion(p, MC, { tip: 'don', pwm: 170, sure: 1 }, c);
  log('KALIB', p.ad, n, JSON.stringify({ ham_duz: +a.ileri_cm.toFixed(1), ham_don: +b.aci_der.toFixed(0), kal: c, sonra_duz: +a2.ileri_cm.toFixed(1), sonra_don: +b2.aci_der.toFixed(0), ms: Date.now() - t0 })); } }
fs.writeFileSync('sonuc/fizik3d.txt', out.join('\n'));
