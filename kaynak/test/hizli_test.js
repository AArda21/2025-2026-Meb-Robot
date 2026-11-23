// Hızlı test (sadece Node.js, 3B yok): önce `bash kaynak/build.sh`, sonra `node kaynak/test/hizli_test.js`
const path = require('path'), fs = require('fs');
const SIM = require(path.join(__dirname, '..', 'core3.js')); const { DEFAULT_PROFILES: P } = require(path.join(__dirname, '..', 'profiles.js'));
let hata = 0; const ok = (k, m) => { if (!k) { hata++; console.log('HATA:', m); } };
// 1) Hazır profiller derleniyor mu? (Antalya Mega kodundaki 'yesil' çakışması BİLEREK hata verir)
for (const p of P) { const m = new SIM.Match({ profiles: { red: p } }); const e = m.compileAll(); console.log(`${p.ad}: ${e.length} derleme hatası`); if (p.id !== 'eski2025') ok(e.length === 0, p.ad + ' derlenmedi'); }
// 2) Arduino dil örnekleri çalışıyor mu?
for (const f of fs.readdirSync(path.join(__dirname, 'kod_ornekleri')).filter(f => f.endsWith('.ino'))) {
  const A = JSON.parse(JSON.stringify(P[2])); A.kartlar[0].kod = fs.readFileSync(path.join(__dirname, 'kod_ornekleri', f), 'utf8');
  const m = new SIM.Match({ profiles: { red: A } }); const e = m.compileAll(); ok(!e.length, f + ' derlenmedi: ' + JSON.stringify(e)); try { while (m.time < 0.5) m.step(m.dt); } catch (x) { ok(false, f + ' çalışırken: ' + x.message); }
  console.log(f, '→', m.robots[0].serial.length, 'satır seri çıktı'); }
// 3) Fizik: düz gitme ve dönme makul aralıkta mı?
for (const p of P) { const a = SIM.measureMotion(p, SIM.Match, { tip: 'duz', pwm: 200, sure: 1 }), b = SIM.measureMotion(p, SIM.Match, { tip: 'don', pwm: 170, sure: 1 });
  console.log(`${p.ad}: 1 sn PWM200 → ${a.ileri_cm.toFixed(1)} cm, 1 sn dönüş PWM170 → ${b.aci_der.toFixed(0)}°`); ok(a.ileri_cm > 10 && a.ileri_cm < 150, 'düz gitme garip'); ok(b.aci_der > 5, 'dönmüyor'); }
// 4) Tam maç (2B) ve tekrarlanabilirlik
const run = () => { const m = new SIM.Match({ profiles: { red: P[0], blue: P[2] }, saha: { tohum: 42 } }); m.compileAll(); while (!m.isOver()) m.step(m.dt); return JSON.stringify(m.result().sc); };
const r1 = run(), r2 = run(); console.log('maç sonucu', r1); ok(r1 === r2, 'aynı tohumla iki maç farklı sonuç verdi');
// 5) Kontrol raporu
const k = SIM.staticChecks(P[1]); console.log('Kontrol (Antalya):', k.items.filter(i => i.level === 'err').length, 'hata,', k.items.filter(i => i.level === 'warn').length, 'uyarı');
console.log(hata ? `\n${hata} TEST BAŞARISIZ` : '\nTÜM TESTLER GEÇTİ'); process.exit(hata ? 1 : 0);
