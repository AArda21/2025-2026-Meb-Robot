// Profil düzenleyicisi ve hızlı testler aynı doğrulamayı kullanır.
function hazneTaslagi(hazne) {
  const H = deepCopy(hazne || {});
  H.var = !!hazne && H.var !== false;
  H.agiz = { x0: 9, x1: 15, y0: -4, y1: 4, ...H.agiz };
  H.bolmeler = (H.bolmeler || []).map(b => ({
    kapasite: 5, acik_min: 60, acik_max: 180, aralik_ms: 250, ...b,
    cikis: { x: -12, y: 0, ...b.cikis },
  }));
  const acilar = k => ({ ...k, min: k.min ?? 0, max: k.max ?? 180 });
  H.kurallar = (H.kurallar || []).map(k => ({
    ...acilar(k), hedef: k.hedef || 'disari', ve: k.ve ? acilar(k.ve) : null,
  }));
  H.disari = { x: 0, y: -14, hiz_cms: 40, ...H.disari };
  return H;
}

function hazneDogrula(H, profile) {
  if (!H.var) return;
  const A = H.agiz;
  if (![A.x0, A.x1, A.y0, A.y1].every(Number.isFinite) || A.x0 === A.x1 || A.y0 === A.y1)
    throw new Error('Ağız için sıfırdan büyük en ve boy gir.');
  const boards = profile.kartlar || [];
  const pins = new Set((profile.devre?.servolar || []).map(s => resolvePin(s.pin, boards)));
  pins.delete(null);
  const servo = pin => pins.has(resolvePin(pin, boards));
  const aci = (min, max) => Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= 180 && min <= max;
  const adlar = new Set(['disari']);
  for (const b of H.bolmeler) {
    if (!b.ad?.trim() || adlar.has(b.ad)) throw new Error('Her bölmeye farklı bir ad ver.');
    adlar.add(b.ad);
    if (!Number.isInteger(b.kapasite) || b.kapasite < 1 || !Number.isFinite(b.aralik_ms) || b.aralik_ms < 0)
      throw new Error(b.ad + ' bölmesinin kapasitesini ve çıkış aralığını kontrol et.');
    if ((b.kapak != null && !servo(b.kapak)) || !aci(b.acik_min, b.acik_max))
      throw new Error(b.ad + ' bölmesinin kapak servosunu ve açılarını kontrol et.');
    if (![b.cikis.x, b.cikis.y].every(Number.isFinite)) throw new Error(b.ad + ' bölmesinin çıkış konumunu gir.');
  }
  for (const [i, k] of H.kurallar.entries()) {
    if (!adlar.has(k.hedef) || [k, k.ve].filter(Boolean).some(s => !servo(s.servo) || !aci(s.min, s.max)))
      throw new Error((i + 1) + '. kuralın servosunu, açılarını ve hedefini kontrol et.');
  }
  if (![H.disari.x, H.disari.y, H.disari.hiz_cms].every(Number.isFinite) || H.disari.hiz_cms < 0)
    throw new Error('Dışarı atma konumunu ve hızını kontrol et.');
}

function sensorOlcumPlani(profile, index) {
  const s = profile.devre?.sensorler?.[index];
  const t = String(s?.tip || '').toUpperCase();
  const renk = t === 'TCS3200';
  if (!renk && t !== 'TCRT5000') throw new Error('Bu sensörün ölçüm kalibrasyonu desteklenmiyor.');
  const boards = profile.kartlar?.length ? profile.kartlar : [{ id: 'ana', tip: 'Uno' }];
  const olcekli = renk && [s.s0, s.s1].some(v => v != null && v !== '');
  const alanlar = renk ? ['s2', 's3', 'out', ...(olcekli ? ['s0', 's1'] : [])] : ['pin'];
  const keys = alanlar.map(k => {
    const key = resolvePin(s[k], boards);
    if (key == null || !Number.isInteger(key) || key < 0) throw new Error(k.toUpperCase() + ' pinini Devre bölümünde kontrol et.');
    return key;
  });
  const bi = Math.floor(keys[0] / 100);
  const kart = boards[bi];
  const pinler = keys.map(k => k % 100);
  const B = boardOf(kart?.tip);
  if (!kart || keys.some(k => Math.floor(k / 100) !== bi)) throw new Error('Ölçüm için sensör pinleri aynı Arduino kartında olmalı.');
  if (pinler.some(n => !(renk ? B.digital : B.analog).includes(n) || (renk && n < 2)) || new Set(pinler).size !== pinler.length)
    throw new Error('Sensör pinlerini kontrol et. Seri bağlantı için D0 ve D1 boş kalmalı.');
  const yuzeyler = CAL_COLORS.filter(([k]) => renk || k !== 'bos');
  const etiket = [t, index + 1, bi + 1, ...pinler].join(':');
  const [a, b, c, d, e] = pinler;
  const hazirlik = renk
    ? ['pinMode(' + a + ', OUTPUT);', 'pinMode(' + b + ', OUTPUT);', 'pinMode(' + c + ', INPUT);',
      ...(olcekli ? ['pinMode(' + d + ', OUTPUT);', 'pinMode(' + e + ', OUTPUT);', 'digitalWrite(' + d + ', HIGH);', 'digitalWrite(' + e + ', LOW);'] : [])]
    : [];
  const okuma = renk
    ? [[0, 0], [1, 1], [0, 1], [1, 0]].flatMap(([s2, s3], i) => [
      'digitalWrite(' + a + ', ' + (s2 ? 'HIGH' : 'LOW') + ');',
      'digitalWrite(' + b + ', ' + (s3 ? 'HIGH' : 'LOW') + ');',
      'delay(20);',
      'unsigned long v' + i + ' = pulseIn(' + c + ', LOW, 30000);',
    ])
    : ['int v0 = analogRead(A' + (a - B.A0) + ');'];
  const degerler = renk ? [0, 1, 2, 3] : [0];
  const kod = [
    '// Sensör ölçümü. Seri Monitör: 9600 baud.',
    'void setup() {', '  Serial.begin(9600);', ...hazirlik.map(l => '  ' + l), '}',
    'void loop() {',
    '  if (!Serial.available()) return;',
    '  int i = Serial.read() - \'1\';',
    '  if (i < 0 || i >= ' + yuzeyler.length + ') return;',
    '  for (int ornek = 0; ornek < 5; ornek++) {',
    ...okuma.map(l => '    ' + l),
    ...(renk ? ['    if (!v0 || !v1 || !v2 || !v3) { Serial.println("Sinyal yok"); continue; }'] : []),
    '    Serial.print("MEBOLCUM ' + etiket + ' ");',
    '    Serial.print(i + 1);',
    ...degerler.flatMap(j => ['    Serial.print(\' \');', '    Serial.print(v' + j + ');']),
    '    Serial.println();',
    '    delay(50);',
    '  }',
    '}',
  ].join('\n');
  return { kart, renk, yuzeyler, etiket, kod };
}

function sensorOlcumleriniOku(metin, plan) {
  const gruplar = new Map();
  for (const satir of metin.split(/\r?\n/)) {
    const parca = satir.match(/\bMEBOLCUM\s+(\S+)\s+(\d+)\s+([\d ]+)\s*$/);
    if (!parca || parca[1] !== plan.etiket) continue;
    const yuzey = plan.yuzeyler[Number(parca[2]) - 1];
    const v = parca[3].trim().split(/\s+/).map(Number);
    const gecerli = v.length === (plan.renk ? 4 : 1) && v.every(n =>
      Number.isInteger(n) && (plan.renk ? n > 0 && n <= 30000 : n >= 0 && n <= 1023));
    if (!yuzey || !gecerli) continue;
    const [k] = yuzey;
    if (!gruplar.has(k)) gruplar.set(k, []);
    gruplar.get(k).push(v);
  }
  if (!gruplar.size) throw new Error('Bu sensör için geçerli ölçüm bulunamadı. Kodun Seri Monitör çıktısını yapıştır.');
  const medyan = arr => {
    arr.sort((a, b) => a - b);
    const i = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[i] : Math.round((arr[i - 1] + arr[i]) / 2);
  };
  return Object.fromEntries([...gruplar].map(([k, rows]) => [
    k, plan.renk ? [0, 1, 2, 3].map(i => medyan(rows.map(r => r[i]))) : medyan(rows.map(r => r[0])),
  ]));
}
