
function taslakAlan(obj, key, label, opt = {}) {
  let input;
  if (opt.options) {
    input = h('select', {}, ...opt.options.map(([value, title]) => h('option', { value }, title)));
  } else {
    input = h('input', { type: opt.text ? 'text' : 'number', step: 'any', required: opt.required });
  }
  input.value = obj[key] ?? opt.def ?? '';
  input.oninput = () => {
    obj[key] = opt.text || opt.options ? input.value : num(input.value);
    if (opt.change) opt.change();
  };
  return h('label', { class: 'f' }, label, input);
}

function robotCizimi(parent, M, body, hazne, teker) {
  const canvas = h('canvas', { width: 620, height: 320, class: 'robot-cizim', role: 'img',
    'aria-label': 'Robotun üstten görünümü. Ön sağda, robotun solu yukarıda.' });
  parent.append(canvas);
  const draw = () => {
    const { width, height } = canvas;
    const g = canvas.getContext('2d');
    if (!g) return;
    const T = M.tekerlek || {};
    const x0 = +body.x || 0, y0 = +body.y || 0;
    const L = +body.uzunluk || 19, W = +(body.genislik ?? body.uzunluk) || 14;
    const d = +T.cap_cm || 6.5, w = +T.genislik_cm || 2.5, track = +T.iz_cm || 15;
    const ax = +T.x_cm || 0, base = +T.adet === 4 ? (+T.dingil_cm || 12) / 2 : 0;
    const H = hazne?.var ? hazne : null;
    const A = H?.agiz;
    const pts = H ? [H.disari, ...H.bolmeler.map(b => b.cikis)] : [];
    const scale = Math.min(520 / (2 * Math.max(10, Math.abs(x0) + L / 2, Math.abs(ax) + base + d / 2,
      Math.abs(A?.x0 || 0), Math.abs(A?.x1 || 0), ...pts.map(p => Math.abs(p.x || 0)))),
    230 / (2 * Math.max(8, Math.abs(y0) + W / 2, (track + w) / 2, Math.abs(A?.y0 || 0),
      Math.abs(A?.y1 || 0), ...pts.map(p => Math.abs(p.y || 0)))));
    const px = x => width / 2 + x * scale;
    const py = y => height / 2 - y * scale;
    const rect = (x, y, l, b, color) => {
      g.fillStyle = color;
      g.fillRect(px(x - l / 2), py(y + b / 2), l * scale, b * scale);
    };
    const text = (s, x, y, color = '#15334d') => {
      g.fillStyle = color;
      g.font = 'bold 17px system-ui';
      g.textAlign = 'center';
      g.fillText(s, x, y, 155);
    };
    g.fillStyle = '#f2f7fb';
    g.fillRect(0, 0, width, height);
    rect(x0, y0, L, W, '#9bc2df');
    if (teker) {
      for (const x of base ? [ax - base, ax + base] : [ax])
        for (const y of [-track / 2, track / 2]) rect(x, y, d, w, '#243952');
      if (!base && M.sarhos_teker !== null) {
        const C = M.sarhos_teker || {};
        g.fillStyle = '#536e84';
        g.beginPath();
        g.arc(px(C.x_cm ?? -8), py(C.y_cm || 0), Math.max(1, (C.cap_cm || 1.5) * scale / 2), 0, 2 * Math.PI);
        g.fill();
      }
      text('↔ Teker çapı', px(ax + base), py(-track / 2 - w / 2) + 22);
      text('↕ İz genişliği', px(ax), py(0) - 12);
    } else if (!H) {
      text('↔ Gövde boyu', px(x0), py(y0) - 12);
      text('↕ Gövde eni', px(x0), py(y0) + 14);
    }
    if (H) {
      rect((A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2, Math.abs(A.x1 - A.x0), Math.abs(A.y1 - A.y0), '#a5e6cc');
      text('Ağız', px((A.x0 + A.x1) / 2), py((A.y0 + A.y1) / 2) - 5);
      pts.forEach((p, i) => {
        g.fillStyle = i ? '#195f78' : '#aa3950';
        g.beginPath();
        g.arc(px(p.x), py(p.y), 5, 0, 2 * Math.PI);
        g.fill();
        text(i ? H.bolmeler[i - 1].ad || 'Bölme' : 'Dışarı', px(p.x), py(p.y) + 20);
      });
    }
    text('+', px(0), py(0) + 6);
    text('Sol (+y)', width / 2, 23);
    text('Ön (+x) →', width - 58, height - 14);
  };
  draw();
  return draw;
}

function govdeParcasi(M) {
  const parts = (M.parcalar || []).filter(p => p.servo_pin == null && !p.pivot && p.kati !== false && (!p.sekil || p.sekil === 'kutu'));
  return parts.reduce((largest, p) => p.uzunluk * (p.genislik ?? p.uzunluk) >
    (largest?.uzunluk || 0) * (largest?.genislik ?? largest?.uzunluk ?? 0) ? p : largest, null);
}

function hazneFormu(profile, H) {
  const root = h('div');
  const M = profile.mekanik || {};
  const body = govdeParcasi(M) || {};
  const options = [['', 'Servo seç'], ...(profile.devre?.servolar || []).filter(s => s.pin != null)
    .map(s => [String(s.pin), (s.ad || 'Servo') + ' · ' + s.pin])];
  const render = () => {
    root.replaceChildren();
    const enabled = h('input', { type: 'checkbox' });
    enabled.checked = H.var;
    enabled.onchange = () => { H.var = enabled.checked; render(); };
    root.append(h('label', { class: 'chk' }, enabled, 'İç hazne var'));
    if (!H.var) return;
    const draw = robotCizimi(root, M, body, H, false);
    const n = (obj, key, label) => taslakAlan(obj, key, label, { change: draw });
    const row = (...fields) => h('div', { class: 'fields' }, fields);
    const btn = (s, fn) => h('button', { type: 'button', class: 'btn sm', on: { click: fn } }, s);
    const servo = (obj, key, label) => {
      const chosen = obj[key] == null ? '' : String(obj[key]);
      const resolve = pin => SIM.resolvePin(pin, profile.kartlar || []);
      const equivalent = options.find(([pin]) => pin && resolve(pin) != null && resolve(pin) === resolve(chosen));
      const value = equivalent?.[0] ?? chosen;
      const available = options.some(([pin]) => pin === value) ? options : [...options, [value, value + ' · Devre bölümünü kontrol et']];
      const input = h('select', {}, ...available.map(([value, title]) =>
        h('option', { value }, value || key !== 'kapak' ? title : 'Kapak servosu yok')));
      input.value = value;
      input.onchange = () => { obj[key] = input.value === '' ? null : input.value; };
      return h('label', { class: 'f' }, label, input);
    };
    const A = H.agiz;
    root.append(h('h3', {}, 'Yumurta giriş ağzı'), row(n(A, 'x0', 'Arka sınır x (cm)'), n(A, 'x1', 'Ön sınır x (cm)'),
      n(A, 'y0', 'Sağ sınır y (cm)'), n(A, 'y1', 'Sol sınır y (cm)')));
    root.append(h('h3', {}, 'Bölmeler'));
    for (const b of H.bolmeler) {
      const name = taslakAlan(b, 'ad', 'Bölme adı', { text: true, change: draw });
      name.querySelector('input').onblur = () => {
        for (const select of root.querySelectorAll('.hazne-hedef')) {
          const opt = [...select.options].find(o => o._bolme === b);
          if (!opt) continue;
          if (select.value === opt.value) select._kural.hedef = b.ad;
          opt.value = opt.textContent = b.ad;
        }
      };
      root.append(h('div', { class: 'item' }, row(name, n(b, 'kapasite', 'Kapasite (yumurta)'),
        servo(b, 'kapak', 'Kapak servosu'), n(b, 'acik_min', 'Açık en küçük açı (°)'), n(b, 'acik_max', 'Açık en büyük açı (°)'),
        n(b.cikis, 'x', 'Çıkış x (cm)'), n(b.cikis, 'y', 'Çıkış y (cm)'), n(b, 'aralik_ms', 'Çıkış aralığı (ms)')),
      btn('Bölmeyi kaldır', () => {
        H.bolmeler.splice(H.bolmeler.indexOf(b), 1);
        render();
      })));
    }
    root.append(btn('+ Bölme ekle', () => {
      let i = H.bolmeler.length + 1;
      while (H.bolmeler.some(b => b.ad === 'Bölme ' + i)) i++;
      H.bolmeler.push(SIM.hazneTaslagi({ bolmeler: [{ ad: 'Bölme ' + i }] }).bolmeler[0]);
      render();
    }));
    root.append(h('h3', {}, 'Ayırma kuralları'), h('p', { class: 'hint' }, 'Kurallar yukarıdan aşağıya denenir. Birden çok şart varsa aynı anda sağlanmaları gerekir.'));
    const kosul = (k, label) => [servo(k, 'servo', label), n(k, 'min', 'En küçük açı (°)'), n(k, 'max', 'En büyük açı (°)')];
    H.kurallar.forEach((k, i) => {
      const target = h('select', { class: 'hazne-hedef' }, h('option', { value: '' }, 'Hedef seç'), h('option', { value: 'disari' }, 'Dışarı at'),
        ...H.bolmeler.map(b => Object.assign(h('option', { value: b.ad }, b.ad), { _bolme: b })));
      target._kural = k;
      target.value = k.hedef;
      target.onchange = () => { k.hedef = target.value; };
      if (target.selectedIndex < 0) target.selectedIndex = 0;
      root.append(h('div', { class: 'item' }, h('strong', {}, (i + 1) + '. kural'),
        row(...kosul(k, 'Ayırma servosu'), h('label', { class: 'f' }, 'Hedef', target)),
        k.ve ? row(...kosul(k.ve, 'İkinci servo')) : null,
        h('div', { class: 'row' }, btn(k.ve ? 'İkinci şartı kaldır' : '+ İkinci şart ekle', () => {
          k.ve = k.ve ? null : { servo: null, min: 0, max: 180 }; render();
        }), i ? btn('Yukarı taşı', () => {
          [H.kurallar[i - 1], H.kurallar[i]] = [H.kurallar[i], H.kurallar[i - 1]]; render();
        }) : null, btn('Kuralı kaldır', () => { H.kurallar.splice(i, 1); render(); }))));
    });
    root.append(btn('+ Kural ekle', () => {
      H.kurallar.push({ servo: null, min: 0, max: 180, hedef: 'disari' }); render();
    }), h('h3', {}, 'Dışarı atma noktası'),
    row(n(H.disari, 'x', 'x (cm)'), n(H.disari, 'y', 'y (cm)'), n(H.disari, 'hiz_cms', 'Hız (cm/sn)')));
  };
  render();
  return root;
}

function hazneCard(p, M) {
  const draft = SIM.hazneTaslagi(M.hazne);
  const msg = h('div', { class: 'msg', role: 'status' });
  return card('İç hazne / ayıklayıcı', hazneFormu(p, draft),
    h('button', { type: 'button', class: 'btn sm', on: { click: () => {
      try {
        SIM.hazneDogrula(draft, p);
        M.hazne = deepCopy(draft);
        saveProfiles();
        msg.className = 'msg ok';
        msg.textContent = 'İç hazne ayarları kaydedildi.';
      } catch (e) {
        msg.className = 'msg err';
        msg.textContent = e.message;
      }
    } } }, 'Hazneyi kaydet'), msg);
}

function sensorOlcumKutusu(p, i, kaydet) {
  const code = h('textarea', { readonly: true, class: 'short', 'aria-label': 'Arduino ölçüm kodu' });
  const serial = h('textarea', { class: 'short', placeholder: 'Seri Monitör çıktısını buraya yapıştır', 'aria-label': 'Seri Monitör çıktısı' });
  const msg = h('div', { class: 'msg', role: 'status' });
  const box = h('details', {}, h('summary', {}, 'Seri Monitör ile otomatik kalibrasyon'));
  const controls = h('div', { hidden: true });
  const steps = h('ol');
  const help = h('p', { class: 'hint' });
  let plan;
  const button = (s, fn) => h('button', { type: 'button', class: 'btn sm', on: { click: fn } }, s);
  const report = (s, ok) => { msg.className = 'msg ' + (ok ? 'ok' : 'err'); msg.textContent = s; };
  box.append(button('Ölçüm kodu oluştur', () => {
    try {
      plan = SIM.sensorOlcumPlani(p, i);
      help.textContent = 'Motor beslemesini kapat. Ölçüm kodunu ' + plan.kart.id + ' (' + BOARDS[plan.kart.tip]?.ad +
        ') kartına yükle. Seri Monitör’ü 9600 baud ile aç. Yüzeyi sensörün önüne yerleştir ve listedeki numarayı gönder. Ölçüm bitince kendi yarışma kodunu yeniden yükle.';
      steps.replaceChildren(...plan.yuzeyler.map(([, label]) => h('li', {}, label)));
      code.value = plan.kod;
      controls.hidden = false;
      report('', true);
    } catch (e) {
      controls.hidden = true;
      report(e.message, false);
    }
  }), controls, msg);
  controls.append(help, code, button('Kodu kopyala', () => copyText(code.value)), steps, serial,
    button('Ölçümleri aktar', () => {
      try {
        const current = SIM.sensorOlcumPlani(p, i);
        if (current.etiket !== plan.etiket) throw new Error('Pinler değişti. Ölçüm kodunu yeniden oluştur.');
        const data = SIM.sensorOlcumleriniOku(serial.value, current);
        const sensor = p.devre.sensorler[i];
        sensor.kalibrasyon = { ...sensor.kalibrasyon, ...data };
        report(Object.keys(data).length + ' yüzey kalibre edildi.', true);
        kaydet();
      } catch (e) { report(e.message, false); }
    }));
  return box;
}

function robotunuTanit(source, yeni = false) {
  const p = deepCopy(source);
  const M = p.mekanik = p.mekanik || {};
  M.parcalar = M.parcalar || [];
  const currentBody = govdeParcasi(M);
  const body = currentBody || { ad: 'Gövde', x: 0, y: 0, z0: 2, uzunluk: 19, genislik: 14, z1: 9 };
  const bodyDraft = { genislik: body.genislik ?? body.uzunluk, uzunluk: body.uzunluk, yukseklik: (body.z1 ?? 5) - (body.z0 ?? 0) };
  const T = M.tekerlek = M.tekerlek || {};
  const draft = SIM.hazneTaslagi(M.hazne);
  if (yeni) {
    p.ad = 'Yeni robot';
    M.model3d = null;
    delete M.kalibrasyon;
    for (const s of p.devre?.sensorler || []) delete s.kalibrasyon;
  }
  const title = h('h2', { id: 'robotTanitBaslik' }, 'Robotunu tanıt');
  const dialog = h('dialog', { class: 'robot-sihirbaz', 'aria-labelledby': title.id });
  document.body.append(dialog);
  dialog.onclose = () => dialog.remove();
  let step = 0;
  const titles = ['Gövde ölçüleri', 'Tekerlek ölçüleri', 'İç hazne', 'Sensör kalibrasyonu'];
  const render = () => {
    dialog.replaceChildren(title);
    const label = h('h3', { tabindex: '-1' }, (step + 1) + ' / ' + titles.length + ' · ' + titles[step]);
    const msg = h('div', { class: 'msg err', role: 'alert' });
    const view = h('div');
    dialog.append(label, view, msg);
    const row = (...items) => h('div', { class: 'fields' }, items);
    let validate = () => {};
    const positive = (obj, keys) => {
      if (keys.some(k => !Number.isFinite(obj[k]) || obj[k] <= 0)) throw new Error('Ölçüleri sıfırdan büyük sayılarla doldur.');
    };
    if (step === 0) {
      const preview = { ...body, ...bodyDraft };
      const draw = robotCizimi(view, M, preview, null, false);
      const side = h('canvas', { width: 620, height: 99, class: 'robot-cizim', role: 'img', 'aria-label': 'Gövdenin yandan görünümü ve yüksekliği' });
      view.append(side);
      const redraw = () => {
        Object.assign(preview, bodyDraft);
        draw();
        const g = side.getContext('2d');
        if (!g) return;
        g.fillStyle = '#f2f7fb'; g.fillRect(0, 0, 620, 99);
        const l = Math.min(330, (bodyDraft.uzunluk || 19) * 11);
        const z = Math.min(65, (bodyDraft.yukseklik || 7) * 7);
        g.fillStyle = '#9bc2df'; g.fillRect(310 - l / 2, 80 - z, l, z);
        g.font = 'bold 17px system-ui'; g.textAlign = 'center'; g.fillStyle = '#15334d';
        g.fillText('↕ Gövde yüksekliği', 310, 70);
      };
      redraw();
      view.append(row(taslakAlan(p, 'ad', 'Robot adı', { text: true }),
        taslakAlan(bodyDraft, 'uzunluk', 'Gövde boyu (cm)', { change: redraw }),
        taslakAlan(bodyDraft, 'genislik', 'Gövde eni (cm)', { change: redraw }),
        taslakAlan(bodyDraft, 'yukseklik', 'Gövde yüksekliği (cm)', { change: redraw }),
        taslakAlan(M, 'kutle_kg', 'Robotun toplam kütlesi (kg)', { def: 1 })));
      validate = () => {
        if (!p.ad?.trim()) throw new Error('Robot adını gir.');
        positive(bodyDraft, ['uzunluk', 'genislik', 'yukseklik']);
        if (M.kutle_kg !== undefined) positive(M, ['kutle_kg']);
        body.uzunluk = bodyDraft.uzunluk;
        body.genislik = bodyDraft.genislik;
        body.z1 = (body.z0 ?? 0) + bodyDraft.yukseklik;
        if (!M.parcalar.includes(body)) M.parcalar.push(body);
      };
    } else if (step === 1) {
      const draw = robotCizimi(view, M, body, null, true);
      const f = (key, label, def) => taslakAlan(T, key, label, { def, change: draw });
      view.append(row(taslakAlan(T, 'adet', 'Motorlu teker sayısı', { def: 2, options: [[2, '2 teker'], [4, '4 teker']], change: render }),
        f('cap_cm', 'Teker çapı (cm)', 6.5), f('genislik_cm', 'Teker genişliği (cm)', 2.5),
        f('iz_cm', 'Sol ve sağ teker merkezleri arası (cm)', 15), f('x_cm', 'Tekerlerin ortası x (cm)', 0),
        +T.adet === 4 ? f('dingil_cm', 'Ön ve arka teker merkezleri arası (cm)', 12) : null));
      if (+T.adet !== 4) {
        const caster = h('input', { type: 'checkbox' });
        caster.checked = M.sarhos_teker !== null;
        caster.onchange = () => { M.sarhos_teker = caster.checked ? { x_cm: -8, y_cm: 0, cap_cm: 1.5 } : null; render(); };
        view.append(h('label', { class: 'chk' }, caster, 'Sarhoş teker var'));
        if (caster.checked) {
          const C = M.sarhos_teker = M.sarhos_teker || {};
          view.append(row(taslakAlan(C, 'x_cm', 'Sarhoş teker x (cm)', { def: -8, change: draw }),
            taslakAlan(C, 'y_cm', 'Sarhoş teker y (cm)', { def: 0, change: draw }),
            taslakAlan(C, 'cap_cm', 'Sarhoş teker çapı (cm)', { def: 1.5, change: draw })));
        }
      }
      validate = () => {
        positive(T, ['cap_cm', 'genislik_cm', 'iz_cm', ...(+T.adet === 4 ? ['dingil_cm'] : [])].filter(k => T[k] !== undefined));
        if (T.x_cm !== undefined && !Number.isFinite(T.x_cm)) throw new Error('Tekerlerin x konumunu gir.');
        if (+T.adet !== 4 && M.sarhos_teker) {
          const C = M.sarhos_teker;
          if (C.cap_cm !== undefined) positive(C, ['cap_cm']);
          if ([C.x_cm, C.y_cm].some(v => v !== undefined && !Number.isFinite(v))) throw new Error('Sarhoş tekerin konumunu gir.');
        }
      };
    } else if (step === 2) {
      view.append(hazneFormu(p, draft));
      validate = () => { SIM.hazneDogrula(draft, p); if (draft.var || M.hazne) M.hazne = draft; };
    } else {
      const sensors = p.devre?.sensorler || [];
      sensors.forEach((s, i) => {
        if (!['TCS3200', 'TCRT5000'].includes(String(s.tip).toUpperCase())) return;
        view.append(card(s.ad || s.tip, sensorOlcumKutusu(p, i, () => {})));
      });
      if (!view.children.length) view.append(h('p', { class: 'hint' }, 'Devre bölümünden TCS3200 veya TCRT5000 eklediğinde burada ölçüm alabilirsin.'));
      else view.append(h('p', { class: 'hint' }, 'Ölçüm yapmadan da robotu kaydedebilirsin.'));
    }
    const button = (s, fn, cls = '') => h('button', { type: 'button', class: 'btn sm ' + cls, on: { click: fn } }, s);
    dialog.append(h('div', { class: 'row' }, button('Vazgeç', () => dialog.close()),
      step > 0 ? button('Geri', () => { step--; render(); }) : null,
      button(step === titles.length - 1 ? 'Robotu kaydet' : 'İleri', () => {
        try { validate(); } catch (e) { msg.textContent = e.message; return; }
        if (step < titles.length - 1) { step++; render(); return; }
        if (yeni) {
          p.id = newId();
          profiles.push(p);
        } else {
          source.ad = p.ad;
          source.mekanik = M;
          (source.devre?.sensorler || []).forEach((s, i) => {
            const K = p.devre.sensorler[i].kalibrasyon;
            if (K) s.kalibrasyon = K;
          });
        }
        saveProfiles();
        fillProfileSelects();
        $('selProfile').value = p.id;
        dialog.close();
        document.querySelector('#seg button[data-s="mekanik"]').click();
        toast('Robot profili kaydedildi.');
      }, 'pri')));
    if (dialog.open) label.focus();
  };
  render();
  dialog.showModal();
  title.nextElementSibling.focus();
}
