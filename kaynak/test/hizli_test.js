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
// 6) Görsel hazne ayarları eski profili korur ve geçersiz hedefi reddeder.
const antalya = SIM.deepCopy(P[1]);
const H = SIM.hazneTaslagi(antalya.mekanik.hazne);
SIM.hazneDogrula(H, antalya);
const robot = p => new SIM.Robot(p, 'red', null);
const eskiHazne = robot(antalya).hazne;
antalya.mekanik.hazne = H;
ok(JSON.stringify(robot(antalya).hazne) === JSON.stringify(eskiHazne), 'görsel hazne eski profili değiştirdi');
const reddet = (fn, mesaj) => { try { fn(); ok(false, mesaj); } catch (e) { ok(e instanceof Error, mesaj); } };
H.kurallar[0].hedef = 'olmayan bölme';
reddet(() => SIM.hazneDogrula(H, antalya), 'geçersiz bölme hedefi kabul edildi');
H.var = false;
SIM.hazneDogrula(H, antalya);
ok(robot(antalya).hazne === null, 'kapalı hazne devre dışı kalmadı');

// 7) Ölçüm kodu doğru karta gider, zaman damgalı çıktıları okur ve hatalı kayıtları atlar.
const renk = SIM.sensorOlcumPlani(P[1], 3);
ok(renk.kart.id === 'nano' && renk.kod.includes('pulseIn(2, LOW, 30000)') &&
  renk.kod.includes('digitalWrite(3, HIGH)') && renk.kod.includes('digitalWrite(4, LOW)'), 'Nano renk ölçüm kodu yanlış');
const mega = SIM.sensorOlcumPlani(P[1], 2);
ok(mega.kart.id === 'mega' && mega.kod.includes('pulseIn(44, LOW, 30000)'), 'Mega renk ölçüm kodu yanlış');
const renkSatiri = (yuzey, v) => 'MEBOLCUM ' + renk.etiket + ' ' + yuzey + ' ' + v;
const log = [
  '17:04:02.150 -> ' + renkSatiri(1, '10 30 50 20'),
  renkSatiri(1, '12 32 52 22'),
  renkSatiri(1, '100 90 80 70'),
  renkSatiri(1, '0 31 51 21'),
  renkSatiri(2, '51 31 11 21'),
  renkSatiri(3, '51 11 31'),
  renkSatiri(9, '10 20 30 40'),
  'MEBOLCUM ' + mega.etiket + ' 3 10 20 30 40',
].join('\r\n');
const data = SIM.sensorOlcumleriniOku(log, renk);
ok(JSON.stringify(data) === JSON.stringify({ kirmizi: [12, 32, 52, 22], mavi: [51, 31, 11, 21] }),
  'renk ölçümünde yüzey, sıra veya medyan hatası');
ok(SIM.Sensors.calTCS({ kalibrasyon: data }, 'kırmızı')[0] === 12, 'ölçüm mevcut renk modeline aktarılmadı');
reddet(() => SIM.sensorOlcumleriniOku(log, { ...renk, etiket: 'baska' }), 'başka sensörün çıktısı kabul edildi');
const profil = SIM.deepCopy(P[1]);
profil.devre.sensorler[3].out = 'mega:44';
reddet(() => SIM.sensorOlcumPlani(profil, 3), 'farklı kartlardaki TCS3200 pinleri kabul edildi');
const zemin = SIM.sensorOlcumPlani(P[0], 3);
ok(zemin.kod.includes('analogRead(A0)'), 'zemin ölçüm kodu yanlış');
const zeminSatiri = (yuzey, v) => 'MEBOLCUM ' + zemin.etiket + ' ' + yuzey + ' ' + v;
const zdata = SIM.sensorOlcumleriniOku([zeminSatiri(1, 0), zeminSatiri(1, 10), zeminSatiri(1, 1024),
  zeminSatiri(4, 1023), zeminSatiri(5, 12)].join('\n'), zemin);
ok(zdata.kirmizi === 5 && zdata.beyaz === 1023 && !('bos' in zdata), 'zemin ölçümü aralık veya medyan hatası');
// 8) Yarış süresi, doğru bırakıcı ve video örneklerinin zaman karşılaştırması.
const rules26 = new SIM.Match({ kural: '2026', profiles: { red: P[0], blue: P[2] }, saha: { ozel: [] } });
rules26.banked.red = Array.from({ length: 10 }, () => ({ kind: 'red', by: 'red' }));
ok(!rules26.isOver(), '2026 maçı on yumurtada erken bitti');
rules26.time = 120;
ok(rules26.isOver(), '2026 maçı 120 saniyede bitmedi');
rules26.banked.red = [{ kind: 'red', by: 'blue' }];
rules26.banked.blue = [{ kind: 'blue', by: 'blue' }];
ok(rules26.result().winner === 'blue', 'rakibin bıraktığı yumurta yeterlilik koşulunu sağladı');
rules26.banked.red.push({ kind: 'red', by: 'red' });
rules26.banked.blue.push({ kind: 'blue', by: 'red' });
rules26.firstDrop = { by: 'blue', zone: 'red' };
ok(rules26.result().winner === 'blue', 'eşitlikte bırakıcı yerine köşe sahibi kazandı');
rules26.eggs = [{ x: 0.1, y: 0.1, vx: 0.1, vy: 0, kind: 'red', toucher: 'red' }];
ok(rules26.score().red === 2, 'hareketli yumurta puanlandı');

const aero = SIM.airImpulse({ mass: 1, dragArea: 0.03 }, 0.5, 0, 1);
ok(Math.abs(aero.x + 0.0045) < 1e-10 && aero.y === 0, 'karesel hava sürüklemesi yanlış');
const iz = SIM.hareketIziniOku('0;0\r\n1,25;20\r\n2;100');
const fark = SIM.hareketIziniKarsilastir(P[0], SIM.Match, 'duz', 200, iz);
ok(fark.sonuclar[0].sim === 0 && fark.sonuclar[1].sim > 20 && fark.rmse > 0, 'ara zaman örnekleri karşılaştırılmadı');
ok(Math.abs(fark.gercekYari - 1.53125) < 1e-9, 'yarı mesafe zamanı doğrusal süre varsayımıyla hesaplandı');
reddet(() => SIM.hareketIziniOku('0;0\n1;20\n1;30'), 'tekrarlanan video zamanları kabul edildi');

// 9) Gerçek video izinde hatanın yönü, son fark ve en yüksek sapma ayrı raporlanır.
const sapma = SIM.hareketIziniKarsilastir(P[0], SIM.Match, 'duz', 200, iz);
const hatalar = sapma.sonuclar.map(s => s.sim - s.gercek);
ok(Math.abs(sapma.ortalamaFark - hatalar.reduce((a,b)=>a+b,0)/hatalar.length) < 1e-10,
  'ortalama farkın işareti ya da değeri yanlış');
ok(Math.abs(sapma.enBuyukFark - Math.max(...hatalar.map(Math.abs))) < 1e-10, 'en büyük sapma yanlış');
ok(sapma.sonFark === hatalar.at(-1) && Math.abs(sapma.sonYuzdeFark - sapma.sonFark) < 1e-9,
  'son ölçüm farkı veya yüzdesi yanlış');
const sifirIz = [{ sure: 0, deger: 0 }, { sure: 0.25, deger: 0 }, { sure: 0.5, deger: 0 }];
ok(SIM.hareketIziniKarsilastir(P[0], SIM.Match, 'duz', 200, sifirIz).sonYuzdeFark === null,
  'gerçek son ölçüm sıfırken sıfıra bölündü');
// TCS3200 pulseIn: zaman aşımından uzun sinyali 0 say ve sanal zamanı yalnız timeout kadar ilerlet.
const tcsOrjinal = SIM.Sensors.tcsPeriod;
try {
  const sen = { type: 'TCS3200', out: 42 };
  const rt = { t: 0 };
  SIM.Sensors.tcsPeriod = () => 40000;
  const gec = SIM.Sensors.pulseIn({}, { sensors: [sen] }, rt, 42, 0, 30000);
  ok(Math.abs(gec.next().value - 0.03) < 1e-12 && gec.next().value === 0, 'TCS zaman aşımı yanlış');
  SIM.Sensors.tcsPeriod = () => 120;
  const normal = SIM.Sensors.pulseIn({}, { sensors: [sen] }, rt, 42, 0, 30000);
  ok(Math.abs(normal.next().value - 0.00024) < 1e-12 && normal.next().value === 120, 'TCS geçerli darbe yanlış');
} finally { SIM.Sensors.tcsPeriod = tcsOrjinal; }
// 10) Kalibre edilmiş TCRT5000'de sensör yükselince optik sinyal düşmeli.
const zeminModel = { eggs: [], zoneOf: () => null };
const yakinRobot = { sensorWorld: () => ({ x: 0, y: 0, z: 0.02 }) };
const uzakRobot = { sensorWorld: () => ({ x: 0, y: 0, z: 0.08 }) };
const kalibreTcrt = { kalibrasyon: { beyaz: 200 } };
const yakinDeger = SIM.Sensors.tcrt(zeminModel, yakinRobot, kalibreTcrt);
const uzakDeger = SIM.Sensors.tcrt(zeminModel, uzakRobot, kalibreTcrt);
ok(yakinDeger >= 190 && yakinDeger <= 210 && uzakDeger >= 990,
  'kalibre edilmiş TCRT5000 sensör yüksekliğinden etkilenmedi');
console.log(hata ? `\n${hata} TEST BAŞARISIZ` : '\nTÜM TESTLER GEÇTİ'); process.exit(hata ? 1 : 0);
