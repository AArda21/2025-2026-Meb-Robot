
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
  const Nw = rb.mass * g * rb.loadFrac / 2; const Fmotor = M.tStall * (Vs / M.vNom) / rb.wheelR; const Ftr = rb.muS * Nw;
  const vmax = (Vs / M.vNom) * M.w0 * rb.wheelR;
  add('Mekanik', 'info', `Teorik en yüksek hız ≈ ${(vmax * 100).toFixed(0)} cm/s (pil ${D.vBat} V − sürücü kaybı ${D.drop} V = motora ${Vs.toFixed(1)} V)`);
  if (Vs > M.vNom * 1.5) add('Mekanik', 'warn', `Motorlara ${Vs.toFixed(1)} V gidiyor, motor ${M.vNom} V'luk: çok aşırı gerilim, motor ısınır/ömrü kısalır.`);
  else if (Vs < M.vNom * 0.6) add('Mekanik', 'warn', `Motorlara sadece ${Vs.toFixed(1)} V gidiyor (motor ${M.vNom} V): robot yavaş ve güçsüz olur.`);
  if (Fmotor > Ftr) add('Mekanik', 'info', `Tam güçte kalkışta tekerler patinaj yapabilir (motor itişi ${Fmotor.toFixed(1)} N > tutunma ${Ftr.toFixed(1)} N). Lastik: ${rb.tire.ad || 'özel'}.`);
  const pwmMin = Math.ceil(((rb.crr * Nw * rb.wheelR + M.tFric) / (M.tStall * Vs / M.vNom)) * 255);
  add('Mekanik', pwmMin > 120 ? 'warn' : 'info', `Robot yaklaşık PWM ${Math.min(255, pwmMin)} altındaki değerlerde yerinden kıpırdamaz (sürtünme + motor iç direnci).`);
  const accel = Math.min(Fmotor, Ftr) * 2 / rb.mass; add('Mekanik', 'info', `En fazla ivme ≈ ${accel.toFixed(1)} m/s² → 0'dan tam hıza ≈ ${(vmax / Math.max(accel, 1e-3)).toFixed(2)} sn`);
  if (!rb.caster) add('Mekanik', 'err', 'Sarhoş teker yok: iki tekerli robot öne/arkaya devrilir.');
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
  const fixedParts = rb.parts.filter(p => p.servoPin == null || !p.pivot);
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
      if (r.hit && r.hit.self) add('Mekanik', 'warn', `'${s.name}' sensörünün önünü kendi parçası '${r.hit.self.name}' ${cmS(r.d)} mesafede kapatıyor.`);
    }
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
function runTrial(profile, MatchClass, opts = {}) {
  const T = opts.sure || 15;
  return new Promise((resolve) => {
    const team = opts.team || 'red';
    const m = new MatchClass({ profiles: { red: team === 'red' ? profile : null, blue: team === 'blue' ? profile : null }, saha: opts.saha, startPoses: {} });
    const rb = m.robots[0]; const errs = m.compileAll(); const items = []; const add = (cat, level, txt) => items.push({ cat, level, txt });
    for (const e of errs) add('Kod', 'err', `[${e.board}] ${e.msg}`);
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
      const moved = m.eggs.filter((e, i) => e.gone || Math.hypot(e.x - eggs0[i][0], e.y - eggs0[i][1]) > 0.03).length; add('Hareket', 'info', `${moved} yumurtaya dokunup yerinden oynattı. Puan: ${m.score()[team]}.`);
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

return { RULES, SURF, BOARDS, TIRES, MOTORS, DRIVERS, SENSOR_TYPES, Match, Robot, Runtime, Sensors, transpile, compile, trError, stripJsonComments, resolvePin, keyLabel, pinLabel, boardOf, staticChecks, runTrial, parseNetlist, parseSTL, transformSTL, deepCopy, clamp };
})();
if (typeof module !== 'undefined') module.exports = SIM;
