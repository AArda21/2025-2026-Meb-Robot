
// =====================================================================================
//                                  KONTROL RAPORU
// =====================================================================================
// Seviye: ok | info | warn | err
function obbOverlap(a, b, tol = 0.001) { // 2B dikdörtgen kesişimi (SAT), a/b: {x,y,hx,hy,a}
  const axes = [a.a, a.a + Math.PI / 2, b.a, b.a + Math.PI / 2];
  const corners = (o) => { const c = Math.cos(o.a), s = Math.sin(o.a); return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [o.x + c * u * o.hx - s * v * o.hy, o.y + s * u * o.hx + c * v * o.hy]); };
  const ca = corners(a), cb = corners(b);
  for (const t of axes) { const ux = Math.cos(t), uy = Math.sin(t); const pa = ca.map(([x, y]) => x * ux + y * uy), pb = cb.map(([x, y]) => x * ux + y * uy);
    if (Math.max(...pa) - tol <= Math.min(...pb) || Math.max(...pb) - tol <= Math.min(...pa)) return false; }
  return true;
}
function staticChecks(profile) {
  const out = []; const add = (cat, level, txt) => out.push({ cat, level, txt });
  let rb; try { rb = new Robot(profile, 'red', { robots: [], eggs: [], zoneOf: () => null }); rb.reset({ x: 1, y: 1, th: 0 }); } catch (e) { add('Genel', 'err', 'Profil okunamadı: ' + e.message); return { items: out }; }
  const cmS = (v) => (v * 100).toFixed(1) + ' cm';
  // --- Kod: Arduino'ya özgü sinsi hatalar ---
  for (const b of (profile.kartlar || [])) { const src = String(b.kod || '').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const ints = new Set(); for (const m of src.matchAll(/(?<![\w.])(?:(?:unsigned|signed|const|static|volatile)\s+)*(int|short|byte|word|int16_t|uint8_t|uint16_t|unsigned)\s+([\w\s,=\[\]]+?);/g)) { if (/unsigned\s+long/.test(m[0])) continue; for (const d of m[2].split(',')) { const n = (d.trim().match(/^(\w+)/) || [])[1]; if (n) ints.add(n); } }
    for (const m of src.matchAll(/(?<![\w.])(\w+)\s*=\s*(millis|micros)\s*\(\s*\)/g)) if (ints.has(m[1])) { add('Kod', 'warn', `[${b.id}] '${m[1]}' int/byte türünde ama ${m[2]}() değerini tutuyor: Arduino'da int en fazla 32767'dir, ${m[2] === 'millis' ? '32,7 saniye' : '33 milisaniye'} sonra taşar ve süre hesapları bozulur. 'unsigned long' kullan.`); break; }
    for (const m of src.matchAll(/(?<![\w.])(?:int|byte)\s+(\w+)\s*=\s*pulseIn\s*\(/g)) { add('Kod', 'info', `[${b.id}] '${m[1]}' = pulseIn(...): pulseIn uzun (unsigned long) döndürür; 32767 µs'yi aşan ölçümlerde int taşar. Mesafe sensöründe 'long' kullanmak daha güvenli.`); break; }
    if (/(?<![\w.])delay\s*\(\s*([3-9]\d{3}|\d{5,})\s*\)/.test(src.replace(/void\s+setup\s*\([^)]*\)\s*\{[\s\S]*?\n\}/, ''))) add('Kod', 'info', `[${b.id}] loop içinde 3 saniyeden uzun delay() var: bu sürede robot hiçbir sensöre bakmaz (yarışma 2 dakika).`);
  }
  // --- Kurallar ---
  const env = rb.envelope(true); const L = env.maxX - env.minX, W = env.maxY - env.minY, H = rb.height();
  add('Kurallar', L <= 0.3001 ? 'ok' : 'err', `Uzunluk ${cmS(L)} (en fazla 30 cm)`);
  add('Kurallar', W <= 0.3001 ? 'ok' : 'err', `Genişlik ${cmS(W)} (en fazla 30 cm)`);
  add('Kurallar', H <= 0.3001 ? 'ok' : 'err', `Yükseklik ${cmS(H)} (en fazla 30 cm)`);
  add('Kurallar', rb.mass <= 5 ? 'ok' : 'err', `Kütle ${rb.mass.toFixed(2)} kg (en fazla 5 kg)`);
  add('Kurallar', rb.led ? 'ok' : 'err', rb.led ? 'Köşe rengi LED\'i tanımlı' : 'Köşe renginde yanan üst LED tanımlı değil (zorunlu)');
  add('Kurallar', rb.stop ? 'ok' : 'warn', rb.stop ? 'Acil stop butonu var' : 'Acil stop butonu tanımlı değil (zorunlu, Mekanik → acil stop)');
  // --- Mekanik ---
  const M = rb.motor, D = rb.driver, g = RULES.G; const Vs = Math.max(0, D.vBat - D.drop);
  const Nw = rb.mass * g * rb.loadFrac / (2 * rb.axles.length); const Fmotor = M.tStall * (Vs / M.vNom) / rb.wheelR; const Ftr = rb.muS * Nw;
  const vmax = Math.max(0, (Vs / M.vNom) * M.w0 - M.w0 * M.tFric / M.tStall) * rb.wheelR; // sürtünme dahil boşta hız
  add('Mekanik', 'info', `Teorik en yüksek hız ≈ ${(vmax * 100).toFixed(0)} cm/s (pil ${D.vBat} V − sürücü kaybı ${D.drop} V = motora ${Vs.toFixed(1)} V)`);
  if (rb.hazne) { const H = rb.hazne, sv = new Set(rb.servos.map(s => s.pin)); const keys = [...H.kurallar.map(k => k.servo), ...H.kurallar.filter(k => k.ve).map(k => k.ve.servo), ...H.bolmeler.map(b => b.kapak)].filter(k => k != null);
    const miss = [...new Set(keys.filter(k => !sv.has(k)))]; if (miss.length) add('Mekanik', 'err', `İç hazne ${miss.map(k => keyLabel(k, rb.boards)).join(', ')} pinindeki servoyu kullanıyor ama Devre → Servolar'da o pinde servo yok.`);
    else add('Mekanik', 'ok', `İç hazne: ${H.bolmeler.map(b => `${b.ad} (${b.kap} yumurta)`).join(', ') || 'bölme yok'}; ${H.kurallar.length} ayırma kuralı.`);
    if (!H.bolmeler.some(b => b.kapak != null)) add('Mekanik', 'warn', 'İç haznede kapaklı bölme yok: alınan yumurtalar hiç bırakılamaz.');
    for (const b of H.bolmeler) if (!H.kurallar.some(k => k.hedef === b.ad)) add('Mekanik', 'warn', `'${b.ad}' bölmesine yumurta gönderen kural yok.`); }
  { const K = (profile.mekanik || {}).kalibrasyon || {}; if (!K['2B'] && !K['3B'] && !K.hiz_carpani) add('Mekanik', 'info', 'Gerçek robotla eşleştirilmemiş: Robotlar → Mekanik → "Gerçek robotla eşleştir" ile 1 dakikalık ölçüm yaparsan simülasyon gerçeğe çok daha yakın olur.'); else add('Mekanik', 'ok', 'Gerçek robot ölçümüyle eşleştirilmiş (kalibre).'); }
  if (Vs > M.vNom * 1.5) add('Mekanik', 'warn', `Motorlara ${Vs.toFixed(1)} V gidiyor, motor ${M.vNom} V'luk: çok aşırı gerilim, motor ısınır/ömrü kısalır.`);
  else if (Vs < M.vNom * 0.6) add('Mekanik', 'warn', `Motorlara sadece ${Vs.toFixed(1)} V gidiyor (motor ${M.vNom} V): robot yavaş ve güçsüz olur.`);
  const iSt = M.iStall * (Vs / M.vNom);
  if (iSt > D.maxA) add('Mekanik', 'warn', `Motor kilitlenince (duvara dayanınca) her motor ≈ ${iSt.toFixed(1)} A çeker; ${D.type} kanal başına ≈ ${D.maxA} A taşır. Sürücü ısınıp kapanabilir — uzun süre sıkışmaktan kaçın ya da daha güçlü sürücü kullan.`);
  else add('Mekanik', 'ok', `Motor kilitlenme akımı (≈ ${iSt.toFixed(1)} A) ${D.type} sınırının (${D.maxA} A) altında.`);
  if (Fmotor > Ftr) add('Mekanik', 'info', `Tam güçte kalkışta tekerler patinaj yapabilir (motor itişi ${Fmotor.toFixed(1)} N > tutunma ${Ftr.toFixed(1)} N). Lastik: ${rb.tire.ad || 'özel'}.`);
  const pwmMin = Math.ceil(((rb.crr * Nw * rb.wheelR + M.tFric) / (M.tStall * Vs / M.vNom)) * 255);
  add('Mekanik', pwmMin > 120 ? 'warn' : 'info', `Robot yaklaşık PWM ${Math.min(255, pwmMin)} altındaki değerlerde yerinden kıpırdamaz (sürtünme + motor iç direnci).`);
  const accel = Math.min(Fmotor, Ftr) * 2 * rb.axles.length / rb.mass; add('Mekanik', 'info', `En fazla ivme ≈ ${accel.toFixed(1)} m/s² → 0'dan tam hıza ≈ ${(vmax / Math.max(accel, 1e-3)).toFixed(2)} sn`);
  if (rb.wheelCount === 4) { const r = rb.wheelBase / rb.track; add('Mekanik', r > 1 ? 'warn' : 'info', `4 teker: ön-arka teker arası / iki yan teker arası = ${r.toFixed(2)}. ` + (r > 1 ? 'Bu oran 1\'den büyük: robot yerinde zor döner, tekerler çok kayar.' : r > 0.8 ? 'Dönerken tekerler belirgin kayar; dönüş süreleri iki tekerliye göre uzun olur.' : 'Dönüş için uygun oran.')); }
  else if (!rb.caster) add('Mekanik', 'err', 'Sarhoş teker yok: iki tekerli robot öne/arkaya devrilir.');
  else {
    const lo = Math.min(rb.caster.x, rb.wheelX), hi = Math.max(rb.caster.x, rb.wheelX);
    if (rb.comX <= lo || rb.comX >= hi) add('Mekanik', 'err', `Ağırlık merkezi (x=${cmS(rb.comX)}) teker ile sarhoş teker arasında değil: robot devrilir.`);
    else { const d = Math.min(rb.comX - lo, hi - rb.comX); const ratio = (Math.min(Fmotor, Ftr) * 2 / rb.mass) * rb.comZ / (g * d);
      if (ratio > 2) add('Mekanik', 'warn', `Sert kalkış/frende robot öne-arkaya kalkabilir: ağırlık merkezi ${cmS(rb.comZ)} yüksekte ve teker eksenine sadece ${cmS(d)} uzakta. Ağırlığı sarhoş tekere doğru kaydırmayı düşün.`);
      else if (ratio > 1) add('Mekanik', 'info', `Ani kalkış/frende robot hafifçe yalpalayabilir (ağırlık merkezi teker eksenine ${cmS(d)} yakın).`);
      else add('Mekanik', 'ok', 'Ağırlık merkezi tekerler ile sarhoş teker arasında, devrilme riski düşük.'); }
    if (rb.loadFrac < 0.5) add('Mekanik', 'warn', `Ağırlığın sadece %${(rb.loadFrac * 100).toFixed(0)}'i tekerlerde: tutunma zayıf, patinaj yapar.`);
  }
  const solid = rb.parts.filter(p => p.solid);
  for (const p of rb.parts) if (!p.auto && p.z0 < -0.0005) add('Mekanik', 'err', `'${p.name}' yerin altına iniyor (z0 = ${cmS(p.z0)}): zemine sürter.`);
  const fixedParts = rb.parts.filter(p => (p.servoPin == null || !p.pivot) && !p.gorsel);
  const box = (p) => ({ x: p.x, y: p.y, hx: p.hx, hy: p.hy, a: p.ang });
  let overlaps = 0;
  for (let i = 0; i < fixedParts.length; i++) for (let j = i + 1; j < fixedParts.length; j++) {
    const a = fixedParts[i], b = fixedParts[j]; if (a.auto && b.auto) continue; if (Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) <= 0.001) continue;
    if (obbOverlap(box(a), box(b))) { overlaps++; if (overlaps <= 8) add('Mekanik', a.auto || b.auto ? 'err' : 'warn', a.auto || b.auto ? `'${a.auto ? b.name : a.name}' ${a.auto ? a.name : b.name}e sürtüyor / içine giriyor.` : `'${a.name}' ile '${b.name}' iç içe geçiyor (aynı yeri kaplıyor).`); }
  }
  for (const c of rb.circuit) for (const p of fixedParts) { if (Math.min(c.z + c.h, p.z1) - Math.max(c.z, p.z0) <= 0.001) continue; if (obbOverlap({ x: c.x, y: c.y, hx: c.hx, hy: c.hy, a: 0 }, box(p))) { overlaps++; if (overlaps <= 12) add('Mekanik', 'warn', `Kart '${c.name}' ile '${p.name}' çakışıyor.`); } }
  if (!overlaps) add('Mekanik', 'ok', 'Parçalar ve kartlar birbirinin içine girmiyor.');
  for (const p of rb.parts.filter(p => p.servoPin != null && p.pivot)) {
    const bad = new Set();
    for (let a = 0; a <= 180; a += 15) { const ang = ((p.angOff + p.dir * a) * Math.PI) / 180; const b = { x: p.pivot[0] + Math.cos(ang) * p.len / 2, y: p.pivot[1] + Math.sin(ang) * p.len / 2, hx: p.len / 2, hy: p.hy, a: ang };
      for (const q of fixedParts) { if (Math.min(q.z1, p.z1) - Math.max(q.z0, p.z0) <= 0.001) continue; const qb = box(q); const near = Math.hypot(qb.x - p.pivot[0], qb.y - p.pivot[1]) < 0.012; if (!near && obbOverlap(b, qb, 0.003)) bad.add(`${q.name} (${a}°)`); } }
    add('Mekanik', bad.size ? 'warn' : 'ok', bad.size ? `'${p.name}' dönerken şunlara çarpıyor: ${[...bad].slice(0, 6).join(', ')}` : `'${p.name}' 0–180° arası serbestçe dönebiliyor.`);
  }
  for (const s of rb.sensors) {
    if (s.type === 'HC-SR04') { if (s.z > RULES.WALL_H + 0.01) add('Mekanik', 'warn', `'${s.name}' ${cmS(s.z)} yükseklikte: 8 cm'lik saha duvarını göremez.`); else if (s.z > RULES.EGG_H + 0.012) add('Mekanik', 'info', `'${s.name}' ${cmS(s.z)} yükseklikte: duvarı görür, yumurtaları (2 cm) görmez.`); }
    if ((s.type === 'IR_ENGEL' || s.type === 'MZ80') && s.z > RULES.EGG_H + 0.012) add('Mekanik', 'info', `'${s.name}' ${cmS(s.z)} yükseklikte: yumurtaları göremez.`);
    if (['HC-SR04', 'IR_ENGEL', 'MZ80', 'SHARP_IR'].includes(s.type)) {
      const fake = { robots: [rb], eggs: [], zoneOf: () => null }; const w = rb.sensorWorld(s); const r = Sensors.ray(fake, rb, w.x, w.y, w.a, w.z, 0.3, { self: true, wallTol: -1, eggTol: -1 });
      const lim = ['IR_ENGEL', 'MZ80'].includes(s.type) && s.range ? s.range : 0.3; if (r.hit && r.hit.self && r.d <= lim) add('Mekanik', 'warn', `'${s.name}' sensörünün önünü kendi parçası '${r.hit.self.name}' ${cmS(r.d)} mesafede kapatıyor.`);
    }
  }
  for (const s of rb.sensors.filter(x => x.type === 'TCS3200')) {
    const keys = ['kirmizi', 'mavi', 'yesil', 'beyaz', 'bos'], names = { kirmizi: 'kırmızı', mavi: 'mavi', yesil: 'yeşil', beyaz: 'beyaz', bos: 'boş' }; const surfOf = { kirmizi: SURF.red, mavi: SURF.blue, yesil: SURF.green, beyaz: SURF.white, bos: SURF.none };
    const vec = {}; for (const k of keys) { const cal = Sensors.calTCS(s, names[k] === 'yeşil' ? 'yeşil' : names[k]); vec[k] = cal || Sensors.tcsModel(s, surfOf[k]); }
    const usedCal = ['kirmizi', 'mavi', 'yesil'].some(k => Sensors.calTCS(s, { kirmizi: 'kırmızı', mavi: 'mavi', yesil: 'yeşil' }[k])); const close = [];
    if (s.formul) { try { const fn = new Function('r', 'g', 'b', 'c', 'return (' + s.formul + ');'); add('Devre', 'info', `'${s.name}' formülü (${s.formul}) → ` + ['kirmizi', 'mavi', 'yesil', 'beyaz', 'bos'].map(k => `${names[k]} ${(+fn(...vec[k])).toFixed(1)}`).join(', ') + (usedCal ? '' : ' (model değerleriyle; gerçek ölçümlerini girersen daha doğru olur)')); } catch (e) { add('Devre', 'warn', `'${s.name}' formülü hatalı: ${e.message}`); } }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < keys.length; j++) { const a = vec[keys[i]], b = vec[keys[j]]; const d = Math.max(...[0, 1, 2].map(k => Math.abs(a[k] - b[k]) / Math.max(a[k], b[k]))); if (d < 0.12) close.push(`${names[keys[i]]}–${names[keys[j]]}`); }
    add('Devre', close.length ? 'warn' : 'ok', close.length ? `'${s.name}' ${usedCal ? 'senin ölçümlerinde' : 'modelde'} şu renkleri zor ayırt eder: ${close.join(', ')} (fark %12'den az).` : `'${s.name}' kırmızı, mavi ve yeşil yumurtayı ${usedCal ? 'senin ölçümlerine göre' : 'modele göre'} net ayırt edebiliyor.`);
  }
  // --- Devre ---
  const hw = rb.hardwarePins(); const byKey = new Map();
  for (const h of hw) { if (h.kind === 'link') continue; const l = byKey.get(h.key) || []; l.push(h); byKey.set(h.key, l); }
  for (const [k, l] of byKey) if (l.length > 1) { const uniq = new Set(l.map(x => x.role)); if (uniq.size > 1) add('Devre', 'err', `${keyLabel(k, rb.boards)} pinine birden fazla şey bağlı: ${[...uniq].join(', ')}`); }
  for (const h of hw) { const bi = Math.floor(h.key / 100), n = h.key % 100, B = boardOf((rb.boards[bi] || {}).tip); if (!B.digital.includes(n) && !B.analog.includes(n)) add('Devre', 'err', `${h.role}: ${B.ad} kartında ${n} numaralı pin yok.`); else if (!B.digital.includes(n) && h.kind !== 'in') add('Devre', 'err', `${h.role}: ${keyLabel(h.key, rb.boards)} sadece analog giriş, çıkış olarak kullanılamaz.`); else if (B.pwm.length && (h.role.endsWith(' EN') || h.role.endsWith(' PWM') || h.role.endsWith(' RPWM') || h.role.endsWith(' LPWM') || h.role.endsWith(' IA') || h.role.endsWith(' IB')) && !B.pwm.includes(n) && !(h.role.endsWith(' EN') && D.type === 'BTS7960')) add('Devre', 'warn', `${h.role} ${keyLabel(h.key, rb.boards)} pinine bağlı ama bu pin PWM desteklemiyor: hız ayarı yapılamaz.`); }
  const need = DRIVERS[D.type].pins; for (const [s, lab] of [['L', 'Sol'], ['R', 'Sağ']]) for (const pk of need) if (D[s][pk] == null && !(pk === 'en' && D.type !== 'BTS7960')) add('Devre', 'err', `${lab} motor ${pk.toUpperCase()} pini tanımlı değil (${D.type}).`);
  if (rb.servos.length >= 3 && rb.boards.length === 1) add('Devre', 'info', `${rb.servos.length} servo var: servoları Arduino'nun 5V'undan beslemek yetmez, ayrı 5V regülatör kullanın.`);
  if (rb.boards.length > 1 && rb.links.size === 0) add('Devre', 'warn', 'Birden fazla kart var ama kartlar arası tel tanımlı değil (Kod → kart bağlantıları).');
  // Fritzing netlist karşılaştırması
  const nl = (profile.devre || {}).netlist;
  if (nl && nl.baglantilar) {
    const conn = nl.baglantilar; let nOk = 0;
    for (const h of hw) { if (h.kind === 'link') continue; const lab = pinLabel(h.key % 100, (rb.boards[Math.floor(h.key / 100)] || {}).tip); const c = conn.find(x => x.pin === lab);
      if (!c || !c.parcalar.length) add('Devre', 'err', `Fritzing şemasında ${lab} pinine hiçbir şey bağlı değil, ama profilde '${h.role}' bu pinde.`); else nOk++; }
    const used = new Set(hw.map(h => pinLabel(h.key % 100, (rb.boards[Math.floor(h.key / 100)] || {}).tip)));
    for (const c of conn) if (!used.has(c.pin) && c.parcalar.length) add('Devre', 'warn', `Fritzing şemasında ${c.pin} → ${c.parcalar.join(', ')} bağlı ama profilde bu pin tanımlı değil.`);
    if (nOk) add('Devre', 'ok', `${nOk} pin Fritzing şemasıyla eşleşiyor.`);
  }
  if (!out.some(x => x.cat === 'Devre' && x.level !== 'ok' && x.level !== 'info')) add('Devre', 'ok', 'Pin çakışması yok, tüm pinler kartta mevcut.');
  return { items: out, robot: rb };
}

// Kısa deneme: robotu tek başına çalıştırıp davranışını özetler (asenkron, arayüzü kilitlemez)
// ---------- Gerçek robotla eşleştirme (kalibrasyon) ----------
// Kodu çalıştırmadan motorlara doğrudan sabit PWM verip robotu boş sahanın ortasında sürer.
function measureMotion(profile, MatchClass, test, calib) {
  const P = deepCopy(profile); P.mekanik = P.mekanik || {}; if (calib) P.mekanik.kalibrasyon = { hiz_carpani: calib.hiz_carpani, donus_direnci: calib.donus_direnci };
  const F = RULES.FIELD;
  const m = new MatchClass({ profiles: { red: P }, saha: { tohum: 1, ozel: [] }, startPoses: { red: { x: test.baslangicX ?? F / 2, y: F / 2, th: 0 } }, kural: '2025', gercek: { motor_farki: 0, pil: test.pil ?? 100, kusur: false } });
  const rb = m.robots[0]; rb.runPrograms = () => { }; rb.gain = { L: 1, R: 1 };
  const cmd = { L: 0, R: 0 }; const D = rb.driver;
  rb.sideVoltage = (side) => { const Vs = Math.max(0, D.vBat * (rb.batFactor || 1) - D.drop); const u = cmd[side]; if (!u) return { V: 0, mode: 'brake', duty: 1 }; return { V: Math.sign(u) * Math.min(1, Math.abs(u) / 255) * Vs * rb.calib.hiz, mode: 'drive', duty: Math.min(1, Math.abs(u) / 255) }; };
  const s0 = { x: rb.state.x, y: rb.state.y, th: rb.state.th }; const T = +test.sure || 1;
  cmd.L = test.tip === 'don' ? -test.pwm : test.pwm; cmd.R = test.pwm;
  const point = () => {
    const s = rb.state;
    return { sure: m.time, mesafe_cm: Math.hypot(s.x - s0.x, s.y - s0.y) * 100,
      ileri_cm: ((s.x - s0.x) * Math.cos(s0.th) + (s.y - s0.y) * Math.sin(s0.th)) * 100,
      aci_der: (s.th - s0.th) * 180 / Math.PI };
  };
  try {
    if (test.ornekler) {
      let previous = point();
      return test.ornekler.map(time => {
        while (m.time + 1e-10 < time) { previous = point(); m.step(m.dt); }
        const next = point();
        const k = next.sure > previous.sure ? clamp((time - previous.sure) / (next.sure - previous.sure), 0, 1) : 0;
        return test.tip === 'don'
          ? previous.aci_der + (next.aci_der - previous.aci_der) * k
          : previous.ileri_cm + (next.ileri_cm - previous.ileri_cm) * k;
      });
    }
    while (m.time < T) m.step(m.dt);
    cmd.L = cmd.R = 0;
    const tEnd = m.time;
    while (m.time < tEnd + 1) m.step(m.dt);
    return point();
  } finally {
    if (m.world) m.world.free();
  }
}

// Sabit komutla çekilmiş videodan zaman-konum veya zaman-açı örnekleri.
function hareketIziniOku(metin) {
  const iz = [];
  for (const [i, line] of metin.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/[;\t]/).map(p => p.trim().replace(',', '.'));
    if (parts.length !== 2 || !parts.every(p => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(p)))
      throw new Error((i + 1) + '. satırda süre ve ölçüm yaz. Örnek: 0,5;18');
    const [sure, deger] = parts.map(Number);
    if (!Number.isFinite(deger) || !Number.isFinite(sure) || sure < 0 || sure > 15 || (iz.length && sure <= iz.at(-1).sure))
      throw new Error('Süreler 0–15 saniye arasında ve artan sırada olmalı.');
    iz.push({ sure, deger });
  }
  if (iz.length < 3 || iz.length > 300 || iz[0].sure !== 0 || iz[0].deger !== 0)
    throw new Error('0;0 ile başla ve toplam 3–300 ölçüm satırı gir.');
  return iz;
}

function hareketIziniKarsilastir(p, Engine, tip, pwm, iz, pil = 100) {
  if (!Number.isInteger(pwm) || pwm < 1 || pwm > 255 || !Number.isFinite(pil) || pil < 0 || pil > 100)
    throw new Error('PWM 1–255, pil %0–100 arasında olmalı.');
  const degerler = measureMotion(p, Engine, { tip, pwm, pil, baslangicX: tip === 'don' ? RULES.FIELD / 2 : 0.35,
    ornekler: iz.map(s => s.sure) });
  const sonuclar = iz.map(({ sure, deger }, i) => ({ sure, gercek: deger, sim: degerler[i] }));
  const rmse = Math.sqrt(sonuclar.reduce((toplam, s) => toplam + (s.sim - s.gercek) ** 2, 0) / sonuclar.length);
  const yari = sonuclar.at(-1).gercek / 2;
  const gecis = alan => {
    const yon = Math.sign(yari);
    if (!yon) return null;
    const i = sonuclar.findIndex(s => s[alan] * yon >= yari * yon);
    if (i < 1) return null;
    const a = sonuclar[i - 1], b = sonuclar[i];
    return a.sure + (b.sure - a.sure) * (yari - a[alan]) / (b[alan] - a[alan]);
  };
  const hatalar = sonuclar.map(s => s.sim - s.gercek);
  const ortalamaFark = hatalar.reduce((toplam, e) => toplam + e, 0) / hatalar.length;
  const enBuyukFark = Math.max(...hatalar.map(Math.abs));
  const sonFark = hatalar.at(-1);
  const gercekSon = sonuclar.at(-1).gercek;
  const sonYuzdeFark = Math.abs(gercekSon) > 1e-9 ? 100 * sonFark / Math.abs(gercekSon) : null;
  return { sonuclar, rmse, ortalamaFark, enBuyukFark, sonFark, sonYuzdeFark, yari, gercekYari: gecis('gercek'), simYari: gecis('sim') };
}
function autoCalibrate(profile, MatchClass, real) {
  const out = { hiz_carpani: 1, donus_direnci: 0, notlar: [] }; const bis = (lo, hi, f, target, inc) => { for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; const v = f(mid); if ((v < target) === inc) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  if (real.duz && real.duz.olcum > 0) {
    const f = (h) => measureMotion(profile, MatchClass, { tip: 'duz', pwm: real.duz.pwm, sure: real.duz.sure }, { hiz_carpani: h, donus_direnci: 0 }).ileri_cm;
    const lo = f(0.2), hi = f(3); if (real.duz.olcum < lo) { out.hiz_carpani = 0.2; out.notlar.push('Gerçek robot çok yavaş: motor modelini, pil gerilimini ve tekerlek çapını kontrol et.'); }
    else if (real.duz.olcum > hi) { out.hiz_carpani = 3; out.notlar.push('Gerçek robot simülasyondan çok hızlı: motor devrini (rpm) ve tekerlek çapını kontrol et.'); }
    else out.hiz_carpani = +bis(0.2, 3, f, real.duz.olcum, true).toFixed(3);
  }
  if (real.don && real.don.olcum > 0) {
    const f = (d) => Math.abs(measureMotion(profile, MatchClass, { tip: 'don', pwm: real.don.pwm, sure: real.don.sure }, { hiz_carpani: out.hiz_carpani, donus_direnci: d }).aci_der);
    const a0 = f(-4), a1 = f(4); if (real.don.olcum >= a0) { out.donus_direnci = -4; if (real.don.olcum > a0 * 1.08) out.notlar.push(`Gerçek robot, tekerleklerin hızının izin verdiğinden bile hızlı dönüyor (en fazla ${Math.round(a0)}°, ölçülen ${real.don.olcum}°). İz genişliğini (iki teker arası), teker çapını ve motor devrini kontrol et.`); }
    else if (real.don.olcum <= a1) { out.donus_direnci = 4; out.notlar.push('Gerçek robot çok zor dönüyor: tekerlek kayıyor ya da sarhoş teker sıkışıyor olabilir.'); }
    else out.donus_direnci = +bis(-4, 4, f, real.don.olcum, false).toFixed(3);
  }
  return out;
}
// Gerçek robota yüklenecek ölçüm kodu (devredeki sürücü pinleriyle)
function calibSketch(profile, real) {
  const Dr = ((profile.devre || {}).surucu) || {}; const tip = String(Dr.tip || 'L298N').toUpperCase(); const boards = new Set(); const pn = (v) => { if (v == null || v === '') return null; const s = String(v); const i = s.indexOf(':'); if (i >= 0) boards.add(s.slice(0, i)); return i >= 0 ? s.slice(i + 1) : s; };
  const S = (o) => { const r = {}; for (const [k, v] of Object.entries(o || {})) r[k] = pn(v); return r; }; const L = S(Dr.sol), R = S(Dr.sag), stby = pn(Dr.stby);
  const d = real.duz || { pwm: 200, sure: 1 }, t = real.don || { pwm: 170, sure: 1 };
  const pins = [...Object.values(L), ...Object.values(R), stby].filter(x => x != null);
  const brake = (P) => tip === 'BTS7960' ? `  ${P.en != null ? `digitalWrite(${P.en}, HIGH); ` : ''}analogWrite(${P.rpwm}, 0); analogWrite(${P.lpwm}, 0);` : ['L9110', 'DRV8833', 'MX1508'].includes(tip) ? `  analogWrite(${P.ia}, 255); analogWrite(${P.ib}, 255);` : `  digitalWrite(${P.in1}, LOW); digitalWrite(${P.in2}, LOW);${(P.en ?? P.pwm) != null ? ` analogWrite(${P.en ?? P.pwm}, 255);` : ''}`;
  let side;
  if (tip === 'BTS7960') side = (P, inv) => `  { int p = abs(hiz); bool ileri = (hiz >= 0) ${inv ? '== false' : ''};\n    ${P.en != null ? `digitalWrite(${P.en}, HIGH);\n    ` : ''}analogWrite(${P.rpwm}, ileri ? p : 0); analogWrite(${P.lpwm}, ileri ? 0 : p); }`;
  else if (['L9110', 'DRV8833', 'MX1508'].includes(tip)) side = (P, inv) => `  { int p = abs(hiz); bool ileri = (hiz >= 0) ${inv ? '== false' : ''};\n    analogWrite(${P.ia}, ileri ? p : 0); analogWrite(${P.ib}, ileri ? 0 : p); }`;
  else side = (P, inv) => `  { bool ileri = (hiz >= 0) ${inv ? '== false' : ''};\n    digitalWrite(${P.in1}, ileri ? HIGH : LOW); digitalWrite(${P.in2}, ileri ? LOW : HIGH);\n    ${(P.en ?? P.pwm) != null ? `analogWrite(${P.en ?? P.pwm}, abs(hiz));` : '// EN pini jumper ile bağlı'} }`;
  return `// MEB Robot simülatörü — ölçüm kodu (${profile.ad || 'robot'}, sürücü ${tip})
// 1) Bu kodu robota yükle. 2) Robotu düz zemine koy, önüne bir işaret koy.
// 3) Açınca 3 sn bekler, ${d.sure} sn düz gider (PWM ${d.pwm}), durur.
//    Başlangıçtan durduğu yere kadar olan mesafeyi cm olarak ölç.
// 4) 5 sn sonra ${t.sure} sn yerinde SOLA döner (PWM ${t.pwm}), durur. Kaç derece döndüğünü ölç
//    (tam tur = 360). İki sayıyı uygulamadaki "Gerçek robotla eşleştir" kutusuna yaz.
${boards.size > 1 ? '// DİKKAT: motor pinleri birden çok kartta görünüyor; bu kodu motor sürücüsünün bağlı olduğu karta yükle.\n' : ''}
void sol(int hiz) {
${side(L, !!Dr.sol_ters)}
}
void sag(int hiz) {
${side(R, !!Dr.sag_ters)}
}
void dur() {   // fren: tekerlekleri kilitler (boşa bırakmaz)
${brake(L)}
${brake(R)}
}

void setup() {
${pins.map(p => `  pinMode(${p}, OUTPUT);`).join('\n')}
${stby != null ? `  digitalWrite(${stby}, HIGH);\n` : ''}  dur();
  delay(3000);
  sol(${d.pwm}); sag(${d.pwm});
  delay(${Math.round(d.sure * 1000)});
  dur();
  delay(5000);
  sol(-${t.pwm}); sag(${t.pwm});
  delay(${Math.round(t.sure * 1000)});
  dur();
}

void loop() { }
`;
}
function runTrial(profile, MatchClass, opts = {}) {
  const T = opts.sure || 15;
  return new Promise((resolve) => {
    const team = opts.team || 'red';
    const m = new MatchClass({ profiles: { red: team === 'red' ? profile : null, blue: team === 'blue' ? profile : null }, saha: opts.saha, startPoses: {}, kural: opts.kural, yesil_kose: opts.yesil_kose, gercek: opts.gercek });
    const rb = m.robots[0]; const errs = m.compileAll(); const items = []; const add = (cat, level, txt) => items.push({ cat, level, txt });
    for (const e of errs) add('Kod', 'err', `[${e.board}] ${e.msg}`);
    for (const b of rb.boards) for (const l of lint(b.kod).slice(0, 5)) add('Kod', 'err', `[${b.id}] Satır ${l.line}: ${l.msg} — Arduino IDE bu kodu derlemez.`);
    if (errs.length === rb.boards.length) { resolve({ items, path: [], robot: rb, match: m }); return; }
    const s0 = Object.assign({}, rb.state); const path = []; let firstMove = null; const eggs0 = m.eggs.map(e => [e.x, e.y]);
    const step = () => {
      const t0 = Date.now();
      while (m.time < T && Date.now() - t0 < 25) {
        m.step(m.dt);
        const s = rb.state; if (!path.length || m.time - path[path.length - 1][2] > 0.05) path.push([s.x, s.y, m.time, s.th]);
        if (!firstMove && Math.hypot(s.x - s0.x, s.y - s0.y) > 0.03) { const dx = s.x - s0.x, dy = s.y - s0.y; firstMove = { t: m.time, fwd: dx * Math.cos(s0.th) + dy * Math.sin(s0.th), side: -dx * Math.sin(s0.th) + dy * Math.cos(s0.th), dth: (s.th - s0.th) * 180 / Math.PI }; }
      }
      if (opts.onProgress) opts.onProgress(m.time / T);
      if (m.time < T) { setTimeout(step, 0); return; }
      // ---- değerlendirme ----
      let dist = 0; for (let i = 1; i < path.length; i++) dist += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      const turn = Math.abs(rb.state.th - s0.th) * 180 / Math.PI;
      for (const rt of rb.rts) if (rt.error) add('Kod', 'err', `[${rt.board.id}] Çalışırken hata: ${trError(rt.error.message)}`);
      if (dist < 0.05) add('Hareket', 'err', `${T} saniyede robot neredeyse hiç hareket etmedi (${(dist * 100).toFixed(1)} cm). Motor pinleri, sürücü tipi veya kodun loop() içeriğini kontrol et.`);
      else {
        add('Hareket', 'info', `${T} sn'de ${(dist * 100).toFixed(0)} cm yol aldı, toplam ${turn.toFixed(0)}° döndü; ortalama hız ${(dist / T * 100).toFixed(0)} cm/s.`);
        if (firstMove) { const dir = Math.abs(firstMove.fwd) > Math.abs(firstMove.side) ? (firstMove.fwd > 0 ? 'İLERİ' : 'GERİ') : (firstMove.side > 0 ? 'SOLA kayarak' : 'SAĞA kayarak');
          add('Hareket', dir === 'GERİ' ? 'warn' : 'info', `İlk hareket ${firstMove.t.toFixed(2)}. saniyede: robot ${dir} gitti${Math.abs(firstMove.dth) > 20 ? ` ve ${Math.abs(firstMove.dth).toFixed(0)}° ${firstMove.dth > 0 ? 'sola' : 'sağa'} döndü` : ''}.${dir === 'GERİ' ? ' Beklenen ileriyse motor yönü ters bağlanmış olabilir (Devre → sol/sağ ters).' : ''}`); }
      }
      const st = rb.stats;
      if (st.stuckT > 1.5) add('Hareket', 'warn', `Motorlar dönerken robot ${st.stuckT.toFixed(1)} sn boyunca yerinde saydı (duvara/yumurtaya sıkıştı ya da güç yetmedi).`);
      if (st.driveT > 0.5 && st.slipT / st.driveT > 0.2) add('Hareket', 'warn', `Sürüş süresinin %${(st.slipT / st.driveT * 100).toFixed(0)}'inde tekerler patinaj yaptı.`);
      if (st.wallHits) add('Hareket', st.wallHits > 4 ? 'warn' : 'info', `Duvara ${st.wallHits} kez çarptı.`);
      if (st.maxTilt > 25) add('Hareket', 'err', `Robot ${st.maxTilt.toFixed(0)}° eğildi — devrilme!`); else if (st.maxTilt > 8) add('Hareket', 'warn', `Robot hareket ederken ${st.maxTilt.toFixed(0)}° eğiliyor.`);
      const moved = m.eggs.filter((e, i) => e.gone || Math.hypot(e.x - eggs0[i][0], e.y - eggs0[i][1]) > 0.03).length; add('Hareket', 'info', `${moved} yumurtaya dokunup yerinden oynattı. Puan: ${m.score()[team]}.`); { const B = rb.battery; if (B) add('Devre', B.Vmin < B.nom * 0.7 ? 'warn' : 'info', `Pil: en yüksek akım ${B.Imax.toFixed(1)} A, en düşük gerilim ${B.Vmin.toFixed(2)} V (nominal ${B.nom.toFixed(1)} V), ${Math.round(B.usedAh * 1000)} mAh harcandı.` + (B.Vmin < B.nom * 0.7 ? ' Gerilim çok düşüyor: Arduino resetlenebilir, motorlar güçsüz kalır. Daha güçlü (düşük iç dirençli) pil kullan.' : '')); }
        for (const r2 of rb.rts) if ((r2.txBlock || 0) > 0.2) add('Kod', 'warn', `[${r2.board.id}] Serial yazdırma 15 sn'de ${r2.txBlock.toFixed(1)} sn bekletti (${r2.baud || 9600} baud). Bu sürede robot sensörlere bakamaz.`); if (rb.hazne) { const ev = m.events.map(e => e.txt); const al = ev.filter(t => /bölmesine alındı/.test(t)).length, at = ev.filter(t => /dışarı attı/.test(t)).length, bir = ev.filter(t => /bölmesinden yumurta bıraktı/.test(t)).length, dolu = ev.filter(t => /dolu/.test(t)).length;
        add('Hareket', 'info', `İç hazne: ${al} yumurta bölmeye alındı, ${at} dışarı atıldı, ${bir} bırakıldı${dolu ? `, ${dolu} kez bölme doluydu` : ''}. Şu an: ${rb.hazne.bolmeler.map(b => `${b.ad} ${b.icerik.length}/${b.kap}`).join(', ')}.`); }
      { const st2 = rb.stats; const avgI = st2.ampT ? st2.amp / st2.ampT : 0; const per2 = avgI * 120 / 3.6; const cap = rb.battery.mAh;
        add('Mekanik', per2 * 3 > cap ? 'warn' : 'info', `Akım: ortalama ≈ ${avgI.toFixed(2)} A, en yüksek ≈ ${st2.ampPeak.toFixed(1)} A. 2 dakikalık maç ≈ ${per2.toFixed(0)} mAh harcar; ${cap} mAh pil ≈ ${Math.floor(cap / Math.max(per2, 1))} maç dayanır (yaklaşık).`); }
      const led = rb.ledColor(), tn = team === 'red' ? 'Kırmızı' : 'Mavi'; const cn = { red: 'KIRMIZI', blue: 'MAVİ', mor: 'MOR' };
      add('Kurallar', led === team ? 'ok' : 'err', led === team ? `${tn} köşede LED doğru renkte yandı.` : `${tn} köşede LED ${led ? cn[led] + ' yandı' : 'hiç yanmadı'} — kural ihlali (köşe renginde yanmalı).`);
      // kod ↔ devre uyumu (çalışırken gerçekten kullanılan pinler)
      const hw = rb.hardwarePins(); const opsAll = new Map(); for (const rt of rb.rts) for (const [k, s] of rt.ops) opsAll.set(k, s);
      const deadBoards = new Set(rb.rts.filter(rt => rt.compileError).map(rt => rt.bi));
      if (deadBoards.size) add('Kod-Devre', 'info', 'Derlenemeyen kartın pinleri kontrol edilemedi; önce derleme hatasını düzelt.');
      for (const h of hw) { if (h.kind === 'link' || deadBoards.has(Math.floor(h.key / 100))) continue; const ops = opsAll.get(h.key); const lab = keyLabel(h.key, rb.boards);
        if (!ops) { add('Kod-Devre', 'warn', `${h.role} (${lab}) devrede var ama kod bu pine hiç dokunmadı.`); continue; }
        if (h.kind === 'in' && ops.has('pinMode:OUTPUT')) add('Kod-Devre', 'err', `${h.role} (${lab}) bir sensör çıkışı ama kod onu OUTPUT yapmış — sensör ve kart zarar görebilir.`);
        if (h.kind === 'out' && !ops.has('digitalWrite') && !ops.has('analogWrite') && (ops.has('digitalRead') || ops.has('analogRead'))) add('Kod-Devre', 'warn', `${h.role} (${lab}) bir çıkış ama kod sadece okuyor.`);
        if (h.kind === 'servo' && !ops.has('servo')) add('Kod-Devre', 'warn', `${h.role} (${lab}) için kodda servo.attach() yok.`); }
      const hwKeys = new Set(hw.map(h => h.key));
      for (const [k, ops] of opsAll) if (!hwKeys.has(k) && [...ops].some(o => o !== 'pinMode:INPUT')) add('Kod-Devre', 'warn', `Kod ${keyLabel(k, rb.boards)} pinini kullanıyor (${[...ops].join(', ')}) ama devrede bu pine bağlı bir şey yok.`);
      for (const w of rb.warnings) add('Kod-Devre', 'warn', `[${w.board}] ${w.msg}`);
      for (const rt of rb.rts) { const L = rt.loopStats; if (!L || !L.n) continue; const avg = L.sum / L.n * 1000, mx = L.max * 1000;
        add('Kod', mx > 150 ? 'warn' : 'info', `[${rt.board.id}] loop() ortalama ${avg.toFixed(1)} ms, en uzun ${mx.toFixed(0)} ms sürdü (${L.n} tur).` + (mx > 150 ? ' Bu sürede robot sensörlere bakmıyor; uzun delay() ve zaman aşımı olmayan pulseIn() en sık nedenler.' : '')); if (L.setup > 2) add('Kod', 'info', `[${rt.board.id}] setup() ${L.setup.toFixed(1)} sn sürdü; robot bu süre boyunca maça başlamaz.`); }
      if (!items.some(x => x.cat === 'Kod-Devre')) add('Kod-Devre', 'ok', 'Koddaki pinler devreyle uyumlu.');
      if (!items.some(x => x.cat === 'Kod')) add('Kod', 'ok', `Kod derlendi ve ${T} sn hatasız çalıştı (${rb.serial.length} seri satır).`);
      resolve({ items, path, robot: rb, match: m, eggs0 });
    };
    setTimeout(step, 0);
  });
}

// Fritzing "Dışa aktar → XML Netlist" dosyasını okur
function parseNetlist(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml'); const nets = [...doc.getElementsByTagName('net')]; const res = new Map();
  for (const net of nets) {
    const conns = [...net.getElementsByTagName('connector')].map(c => { const p = c.getElementsByTagName('part')[0]; return { name: c.getAttribute('name') || c.getAttribute('id'), part: p ? (p.getAttribute('label') || p.getAttribute('title')) : '?', title: p ? p.getAttribute('title') || '' : '' }; });
    const ard = conns.filter(c => /arduino/i.test(c.title)); if (!ard.length) continue;
    for (const a of ard) { let pinN = String(a.name).toUpperCase().replace(/^PIN\s*/, '').replace(/^DIGITAL\s*/, 'D').replace(/^ANALOG\s*/, 'A'); const mm = pinN.match(/^(A\d+|D\d+|\d+)/); if (!mm) continue; pinN = mm[1]; if (/^\d+$/.test(pinN)) pinN = 'D' + pinN;
      const others = conns.filter(c => c !== a && !/arduino/i.test(c.title) && !/breadboard|wire/i.test(c.title)).map(c => `${c.part} ${c.name}`);
      const prev = res.get(pinN) || []; res.set(pinN, [...new Set(prev.concat(others))]); }
  }
  return { baglantilar: [...res.entries()].map(([pin, parcalar]) => ({ pin, parcalar })) };
}

// STL okuyucu (ikili ve ASCII) → Float32Array üçgen köşeleri
function parseSTL(buf) {
  const dv = new DataView(buf); const n = dv.getUint32(80, true);
  if (84 + n * 50 === buf.byteLength) { const out = new Float32Array(n * 9); for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let j = 0; j < 9; j++) out[i * 9 + j] = dv.getFloat32(o + j * 4, true); } return out; }
  const txt = new TextDecoder().decode(new Uint8Array(buf)); const v = []; const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g; let m; while ((m = re.exec(txt))) v.push(+m[1], +m[2], +m[3]);
  return new Float32Array(v);
}
// STL'yi robot çerçevesine taşır (mm→m, döndür, kaydır) ve sınır kutusunu verir
function transformSTL(raw, cfg) {
  const s = (cfg.olcek_mm ?? 1) * 0.001; const rx = (cfg.dx || 0) * Math.PI / 180, ry = (cfg.dy || 0) * Math.PI / 180, rz = (cfg.dz || 0) * Math.PI / 180;
  const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry), cZ = Math.cos(rz), sZ = Math.sin(rz);
  const out = new Float32Array(raw.length); let bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < raw.length; i += 3) { let x = raw[i] * s, y = raw[i + 1] * s, z = raw[i + 2] * s; let t = y * cX - z * sX; z = y * sX + z * cX; y = t; t = x * cY + z * sY; z = -x * sY + z * cY; x = t; t = x * cZ - y * sZ; y = x * sZ + y * cZ; x = t; out[i] = x; out[i + 1] = y; out[i + 2] = z;
    bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.min(bb[2], z), Math.max(bb[3], x), Math.max(bb[4], y), Math.max(bb[5], z)]; }
  // otomatik: merkezi x/y'de ortala, tabanı z0'a koy
  const ox = cfg.ortala === false ? 0 : -(bb[0] + bb[3]) / 2, oy = cfg.ortala === false ? 0 : -(bb[1] + bb[4]) / 2, oz = cfg.ortala === false ? 0 : -bb[2];
  const tx = ox + (cfg.x_cm || 0) / 100, ty = oy + (cfg.y_cm || 0) / 100, tz = oz + (cfg.z_cm || 0) / 100;
  for (let i = 0; i < out.length; i += 3) { out[i] += tx; out[i + 1] += ty; out[i + 2] += tz; }
  bb = [bb[0] + tx, bb[1] + ty, bb[2] + tz, bb[3] + tx, bb[4] + ty, bb[5] + tz];
  return { pos: out, bbox: bb };
}


// ---------- 3B model okuyucular (parça adlarıyla) ----------
function parseOBJ(text) {
  const V = [], objs = []; let cur = null; const ensure = (n) => { cur = { name: n || 'model', tri: [] }; objs.push(cur); };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line[0] === '#') continue; const p = line.split(/\s+/);
    if (p[0] === 'v') V.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'o' || (p[0] === 'g' && !objs.some(o => o.fromO))) { ensure(p.slice(1).join(' ')); if (p[0] === 'o') cur.fromO = true; }
    else if (p[0] === 'f') { if (!cur) ensure('model'); const idx = p.slice(1).map(t => { let i = parseInt(t.split('/')[0], 10); return i < 0 ? V.length + i : i - 1; }); for (let k = 1; k + 1 < idx.length; k++) for (const i of [idx[0], idx[k], idx[k + 1]]) { const v = V[i] || [0, 0, 0]; cur.tri.push(v[0], v[1], v[2]); } }
  }
  return objs.filter(o => o.tri.length).map(o => ({ name: o.name, pos: new Float32Array(o.tri), color: null }));
}
function parseGLTF(buf) {
  const u8 = new Uint8Array(buf); let json, bin = null;
  if (u8[0] === 0x67 && u8[1] === 0x6c && u8[2] === 0x54 && u8[3] === 0x46) {
    const dv = new DataView(buf); let off = 12;
    while (off < buf.byteLength) { const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); const chunk = buf.slice(off + 8, off + 8 + len); if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk)); else if (type === 0x004E4942) bin = chunk; off += 8 + len; }
  } else json = JSON.parse(new TextDecoder().decode(u8));
  const buffers = (json.buffers || []).map((b, i) => { if (i === 0 && bin) return bin; if (b.uri && b.uri.startsWith('data:')) { const s = atob(b.uri.split(',')[1]); const a = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) a[k] = s.charCodeAt(k); return a.buffer; } return null; });
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const readAcc = (ai) => { const a = json.accessors[ai], bv = json.bufferViews[a.bufferView], b = buffers[bv.buffer]; if (!b) throw new Error('harici .bin dosyası desteklenmiyor — .glb olarak dışa aktar');
    const nc = comps[a.type], T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array, 5122: Int16Array, 5120: Int8Array }[a.componentType];
    const stride = bv.byteStride || nc * T.BYTES_PER_ELEMENT, base = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Array(a.count * nc); const dv = new DataView(b);
    const get = { 5126: (o) => dv.getFloat32(o, true), 5125: (o) => dv.getUint32(o, true), 5123: (o) => dv.getUint16(o, true), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true), 5120: (o) => dv.getInt8(o) }[a.componentType];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < nc; k++) out[i * nc + k] = get(base + i * stride + k * T.BYTES_PER_ELEMENT); return out; };
  const mul = (a, b) => { const r = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
  const trs = (n) => { if (n.matrix) return n.matrix.slice(); const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; };
  const objs = []; const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const visit = (ni, parentM, parentName) => { const n = json.nodes[ni]; const M = mul(parentM, trs(n)); const name = n.name || parentName;
    if (n.mesh != null) { const mesh = json.meshes[n.mesh]; const tri = []; let color = null;
      for (const pr of mesh.primitives) { if (pr.mode != null && pr.mode !== 4) continue; const P = readAcc(pr.attributes.POSITION); const idx = pr.indices != null ? readAcc(pr.indices) : P.map((_, i) => i).filter(i => i < P.length / 3);
        const mat = pr.material != null && json.materials ? json.materials[pr.material] : null; if (mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor && !color) { const c = mat.pbrMetallicRoughness.baseColorFactor; color = '#' + c.slice(0, 3).map(v => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255).toString(16).padStart(2, '0')).join(''); }
        for (const i of idx) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; tri.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]); } }
      if (tri.length) objs.push({ name: name || mesh.name || 'parça', pos: new Float32Array(tri), color }); }
    for (const c of n.children || []) visit(c, M, name); };
  const sc = json.scenes ? json.scenes[json.scene || 0] : { nodes: json.nodes.map((_, i) => i) }; for (const ni of sc.nodes) visit(ni, I, null);
  return objs;
}
function parseModel(buf, fileName) {
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  if (ext === 'stl') return [{ name: (fileName || 'model').replace(/\.stl$/i, ''), pos: parseSTL(buf), color: null }];
  if (ext === 'obj') return parseOBJ(new TextDecoder().decode(new Uint8Array(buf)));
  if (ext === 'glb' || ext === 'gltf') return parseGLTF(buf);
  throw new Error('Desteklenen biçimler: STL, OBJ, GLB/GLTF');
}
// Tüm parçaları birlikte robot çerçevesine taşır; Y-yukarı modelleri (glTF/OBJ) Z-yukarıya çevirmek için dx=90 kullanılabilir.
function transformModel(objs, cfg) {
  const all = []; for (const o of objs) all.push(o.pos); const joined = new Float32Array(all.reduce((s, a) => s + a.length, 0)); let off = 0; for (const a of all) { joined.set(a, off); off += a.length; }
  const tr = transformSTL(joined, cfg); off = 0; const out = [];
  for (const o of objs) { const p = tr.pos.subarray(off, off + o.pos.length); off += o.pos.length; let bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i += 3) { bb = [Math.min(bb[0], p[i]), Math.min(bb[1], p[i + 1]), Math.min(bb[2], p[i + 2]), Math.max(bb[3], p[i]), Math.max(bb[4], p[i + 1]), Math.max(bb[5], p[i + 2])]; } out.push({ name: o.name, color: o.color, pos: p, bbox: bb }); }
  return { pos: tr.pos, bbox: tr.bbox, objects: out };
}
// Parça adından ne olduğunu tahmin et
function guessRole(name) {
  const n = String(name).toLowerCase();
  if (/arduino|uno|nano|mega|esp32/.test(n)) return 'kart'; if (/l298|l293|tb6612|bts|ibt|driver|sürücü|surucu|motor ?drive/.test(n)) return 'kart'; if (/pil|batar|battery|18650|lipo|li-ion/.test(n)) return 'kart'; if (/breadboard|regülat|regulat|buck|lm2596/.test(n)) return 'kart';
  if (/hc-?sr04|ultra|sonar/.test(n)) return 'sensor:HC-SR04'; if (/tcs|renk|colou?r/.test(n)) return 'sensor:TCS3200'; if (/tcrt|zemin|line/.test(n)) return 'sensor:TCRT5000'; if (/mz80|fc-?51|\bir\b|kizil|kızıl|goz|göz/.test(n)) return 'sensor:IR_ENGEL';
  if (/caster|sarhos|sarhoş|bilye|ball/.test(n)) return 'sarhos'; if (/wheel|teker|tire|lastik|jant/.test(n)) return 'teker';
  if (/neopixel|led/.test(n)) return 'led'; if (/stop|acil|mantar|emergency/.test(n)) return 'stop'; if (/servo/.test(n)) return 'gorsel'; if (/vida|screw|nut|somun|bolt|civata|cıvata/.test(n)) return 'yoksay';
  return 'govde';
}


/* Gerçekçi simülasyon için veri hazırlığını gösterir; bir doğruluk puanı üretmez.
   Kullanıcının girdiği değerlerin ölçüldüğünü doğrulayamaz. */
function gerceklikKontrolu(profile) {
  const M = profile.mekanik || {}, T = M.tekerlek || {}, D = profile.devre || {};
  const o = M.kalibrasyon?.olcum || {};
  const sayi = x => Number.isFinite(+x) && +x > 0 && x !== '' && x != null;
  const maddeler = [];
  const ekle = (ad, varMi, aciklama) => maddeler.push({ ad, varMi: !!varMi, aciklama });
  const govde = (M.parcalar || []).find(p => sayi(p.uzunluk) && sayi(p.genislik ?? p.uzunluk) && Number.isFinite(p.z0) && Number.isFinite(p.z1) && p.z1 > p.z0);
  ekle('Gövde ölçüleri ve kütle', !!govde && sayi(M.kutle_kg),
    'Gerçek gövdenin en/boy/yüksekliğini ve toplam kütlesini ölçüp Robotunu Tanıt bölümüne gir.');
  ekle('Teker ve motor geometrisi', sayi(T.cap_cm) && sayi(T.iz_cm) && (+T.adet !== 4 || sayi(T.dingil_cm)),
    'Teker çapını, merkezler arası iz genişliğini ve dört tekerliyse dingil aralığını ölç.');
  ekle('Gerçek düz sürüş testi', sayi(o.duz_cm) && sayi(o.duz_pwm) && sayi(o.duz_sure),
    'Yarışma zemininde gerçek robotla düz sürüş yapıp PWM, süre ve mesafeyi kaydet.');
  ekle('Gerçek dönüş testi', sayi(o.don_der) && sayi(o.don_pwm) && sayi(o.don_sure),
    'Yarışma zemininde yerinde dönüş açısını ve motor komutunu ölç.');
  ekle('2B hareket kalibrasyonu', !!M.kalibrasyon?.['2B'] && sayi(o.duz_cm) && sayi(o.don_der),
    'Gerçek ölçümleri kullanarak Otomatik eşleştir işlemini çalıştır.');
  const gereken = (D.sensorler || []).filter(s => ['TCS3200', 'TCRT5000'].includes(String(s.tip).toUpperCase()));
  if (gereken.length) {
    const tamam = gereken.filter(s => s.kalibrasyon && Object.keys(s.kalibrasyon).some(k => {
      const v = s.kalibrasyon[k]; return Array.isArray(v) ? v.length >= 3 && v.every(sayi) : sayi(v) || v === 0;
    })).length;
    ekle('Renk ve zemin sensör kalibrasyonu', tamam === gereken.length,
      gereken.length + ' sensörün ' + tamam + ' tanesinde kalibrasyon girdisi var. Gerçek yüzeyler için Seri Monitör ölçümlerini aktar.');
  }
  return { maddeler, eksik: maddeler.filter(x => !x.varMi).length, toplam: maddeler.length };
}
return { gerceklikKontrolu, airImpulse, hareketIziniOku, hareketIziniKarsilastir, hazneTaslagi, hazneDogrula, sensorOlcumPlani, sensorOlcumleriniOku, BATTERIES, floorMu, calibYaw, measureMotion, autoCalibrate, calibSketch, lint, CAL_COLORS, CALKEY, SURF_EXPORT: SURF, parseOBJ, parseGLTF, parseModel, transformModel, guessRole, RULES, RULESETS, SURF, BOARDS, TIRES, MOTORS, DRIVERS, SENSOR_TYPES, Match, Robot, Runtime, Sensors, transpile, compile, trError, stripJsonComments, resolvePin, keyLabel, pinLabel, boardOf, staticChecks, runTrial, parseNetlist, parseSTL, transformSTL, deepCopy, clamp };
})();
if (typeof module !== 'undefined') module.exports = SIM;
