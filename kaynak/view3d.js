// ===================== 3B GÖRÜNÜM (three.js) =====================
function makeView3D(THREE, host) {
  const { RULES, Sensors } = SIM;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
  host.appendChild(renderer.domElement);
  // Spor salonu ortamı: koyu tribün arka planı, tavandan gelen salon ışıkları, yansımalar için ortam haritası
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b3038); scene.fog = new THREE.Fog(0x2b3038, 7, 22);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 60); camera.up.set(0, 0, 1);
  { // ortam haritası (PBR yansıma): kapalı salon + tavanda aydınlatma panelleri
    const env = new THREE.Scene(); const room = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 12), new THREE.MeshBasicMaterial({ color: 0x3c4149, side: THREE.BackSide })); room.position.z = 5; env.add(room);
    const floorE = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x55595f })); floorE.position.z = -0.9; env.add(floorE);
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff })); p.position.set(i * 4, j * 4, 10.5); p.rotation.x = Math.PI; env.add(p); }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ color: 0x8c96a6 })); side.position.set(0, 14.5, 4); side.rotation.x = Math.PI / 2; env.add(side);
    try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.03).texture; scene.environmentIntensity = 0.9; pm.dispose(); } catch (e) { }
  }
  scene.add(new THREE.HemisphereLight(0xdfe7f2, 0x3a3f47, 0.45));
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.3); sun.position.set(1.0, 0.2, 4.2); sun.target.position.set(1.25, 1.25, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: 1, far: 7 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.002; sun.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xdbe6ff, 0.55); fill.position.set(3.5, 4.5, 2.5);
  scene.add(sun, sun.target, fill);
  const F = RULES.FIELD;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o));

  // ---- Saha ----
  // Yarışma masası: saha yerden ~75 cm yüksekte, yanları lacivert pano; salon zemini
  const TABLE_H = 0.75, WT = 0.018;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x3d434c, { roughness: 0.9 })); ground.position.set(F / 2, F / 2, -TABLE_H); ground.receiveShadow = true; scene.add(ground);
  { const standMat = std(0x262b33, { roughness: 0.95 }); for (let i = 0; i < 6; i++) for (const [cx, cy, sx, sy] of [[F / 2, F + 5 + i * 0.7, 16, 0.7], [F / 2, -5 - i * 0.7, 16, 0.7], [-5 - i * 0.7, F / 2, 0.7, 16], [F + 5 + i * 0.7, F / 2, 0.7, 16]]) { const st = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.45 * (i + 1)), standMat); st.position.set(cx, cy, -TABLE_H + 0.225 * (i + 1)); scene.add(st); } }
  { const skirt = new THREE.Mesh(new THREE.BoxGeometry(F + 2 * WT + 0.01, F + 2 * WT + 0.01, TABLE_H - 0.004), std(0x1d2f8a, { roughness: 0.55 })); skirt.position.set(F / 2, F / 2, -TABLE_H / 2 - 0.002); skirt.receiveShadow = true; scene.add(skirt);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(F + 2 * WT + 0.014, F + 2 * WT + 0.014, 0.012), std(0x2bb3c0, { roughness: 0.5 })); stripe.position.set(F / 2, F / 2, -TABLE_H + 0.05); scene.add(stripe); }
  const fieldCanvas = document.createElement('canvas'); fieldCanvas.width = fieldCanvas.height = 1024;
  const fieldTex = new THREE.CanvasTexture(fieldCanvas); if ('colorSpace' in fieldTex) fieldTex.colorSpace = THREE.SRGBColorSpace; fieldTex.anisotropy = 4;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(F, F), std(0xffffff, { map: fieldTex, roughness: 0.42, metalness: 0 })); /* beyaz sunta (melamin kaplı, yarı parlak) */ field.position.set(F / 2, F / 2, 0); field.receiveShadow = true; scene.add(field);
  const wallMat = std(0xf6f6f3, { roughness: 0.4 });
  for (const [cx, cy, sx, sy] of [[-WT / 2, F / 2, WT, F + 2 * WT], [F + WT / 2, F / 2, WT, F + 2 * WT], [F / 2, -WT / 2, F, WT], [F / 2, F + WT / 2, F, WT]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, RULES.WALL_H), wallMat); m.position.set(cx, cy, RULES.WALL_H / 2); m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  let fieldColorsKey = '';
  function paintField(col, zones) {
    const key = JSON.stringify([col, zones]); if (key === fieldColorsKey) return; fieldColorsKey = key;
    const g = fieldCanvas.getContext('2d'), S = 1024, Z = S * RULES.ZONE / F;
    g.fillStyle = col.zemin; g.fillRect(0, 0, S, S);
    // sunta dokusu: çok hafif lekeler ve iki levhanın birleşim çizgisi (gerçek sahada ortada ek yeri var)
    const id = g.getImageData(0, 0, S, S), d = id.data; let sd = 12345; const rnd = () => ((sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 5; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.stroke();
    if (view && view.grid) { g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 2; for (let i = 1; i < 10; i++) { const v = i * S / 10; g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.moveTo(0, v); g.lineTo(S, v); g.stroke(); } }
    const k = S / F; for (const z of zones || []) { g.fillStyle = z.kind === 'red' ? col.kirmizi : z.kind === 'blue' ? col.mavi : col.yesil; g.fillRect(z.x0 * k, S - z.y1 * k, (z.x1 - z.x0) * k, (z.y1 - z.y0) * k); }
    fieldTex.needsUpdate = true;
  }

  // ---- Yumurtalar ----
  // yumurta: kenarları hafif yuvarlatılmış boyalı ahşap/plastik silindir (çap 4 cm, yükseklik 2 cm)
  const eggGeo = (() => { const r = RULES.EGG_R, hh = RULES.EGG_H / 2, b = 0.0022, pts = [new THREE.Vector2(0, -hh)];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, -hh + b + Math.sin(a) * b)); }
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, hh - b + Math.sin(a) * b)); }
    pts.push(new THREE.Vector2(0, hh)); const g = new THREE.LatheGeometry(pts, 40); g.computeVertexNormals(); return g; })();
  const penCanvas = document.createElement('canvas'); penCanvas.width = penCanvas.height = 128;
  const penTex = new THREE.CanvasTexture(penCanvas); if ('colorSpace' in penTex) penTex.colorSpace = THREE.SRGBColorSpace;
  let eggMeshes = [], eggMats = null;
  function buildEggs(sim) {
    for (const m of eggMeshes) scene.remove(m); eggMeshes = [];
    const col = sim.field.colors; const g = penCanvas.getContext('2d');
    g.fillStyle = col.kirmizi; g.fillRect(0, 0, 128, 64); g.fillStyle = col.mavi; g.fillRect(0, 64, 128, 64); penTex.needsUpdate = true;
    eggMats = { red: std(col.kirmizi, { roughness: 0.5 }), blue: std(col.mavi, { roughness: 0.5 }), green: std(col.yesil || '#2f8f46', { roughness: 0.5 }), pen: [std(0x7a3a6a, { roughness: 0.45 }), std(0xffffff, { map: penTex, roughness: 0.45 }), std(0xffffff, { map: penTex, roughness: 0.45 })] };
    for (const e of sim.eggs) {
      const m = new THREE.Mesh(eggGeo, e.kind === 'penalty' ? eggMats.pen : eggMats[e.kind]); m.castShadow = m.receiveShadow = true; scene.add(m); eggMeshes.push(m);
    }
  }
  const qx90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const tmpQ = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);

  // ---- Robotlar ----
  const robotViews = new Map();
  const labelTex = (txt, bg) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 128); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 122);
    g.fillStyle = '#fff'; g.font = '600 34px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = txt.split(' '); if (words.length > 1 && txt.length > 10) { g.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), 128, 44); g.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), 128, 86); } else g.fillText(txt, 128, 64);
    const t = new THREE.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  function buildRobot(rb) {
    const v = { group: new THREE.Group(), parts: [], wheels: {}, wires: [], led: null, ledLight: null, stl: null };
    const robot = v.group; scene.add(robot); const wr = rb.wheelR;
    const hideBoxes = rb.model3d && rb.model3d.kutulari_gizle;
    for (const p of rb.parts.concat(rb.visualParts || [])) {
      if (p.auto) continue;
      const h = Math.max(0.002, p.z1 - p.z0); let geo;
      if (p.shape === 'silindir') {
        /* eksen x/y: yatay silindir (pil, motor, MZ80 göz); yarıçap yüksekliğin yarısı, boyu uzunluk/genişlik */
        if (p.axis === 'x') { geo = new THREE.CylinderGeometry(h / 2, h / 2, p.hx * 2, 24); geo.rotateZ(Math.PI / 2); }
        else if (p.axis === 'y') geo = new THREE.CylinderGeometry(h / 2, h / 2, p.hy * 2, 24);
        else { geo = new THREE.CylinderGeometry(p.hx, p.hx, h, 28); geo.rotateX(Math.PI / 2); }
      } else geo = new THREE.BoxGeometry(p.hx * 2, p.hy * 2, h);
      const transparent = /şeffaf|seffaf|pleksi|akrilik/i.test(p.name);
      const matOpt = p.mat === 'metal' ? { metalness: 0.85, roughness: 0.3 } : p.mat === 'kaucuk' ? { roughness: 0.95 } : p.mat === 'led' ? { emissive: p.color, emissiveIntensity: 0.9 } : p.mat === 'pcb' ? { roughness: 0.45 } : p.mat === 'parlak' ? { roughness: 0.25 } : {};
      const m = new THREE.Mesh(geo, std(p.color, transparent ? { transparent: true, opacity: 0.55, roughness: 0.2 } : (p.solid || p.gorsel ? matOpt : { transparent: true, opacity: 0.85 })));
      m.castShadow = m.receiveShadow = true; m.userData = { p, zc: (p.z0 + p.z1) / 2 - wr }; m.visible = !hideBoxes || p.servoPin != null; robot.add(m); v.parts.push(m);
    }
    if (rb.model3d && rb.model3d.pos) {
      const md = rb.model3d, roles = md.roller || {}; const list = md.objects && md.objects.length ? md.objects : [{ name: 'model', pos: md.pos, color: null }];
      v.stl = [];
      for (const o of list) { const role = roles[o.name]; if (role === 'yoksay' || role === 'teker' || role === 'sarhos') continue;
        const g = new THREE.BufferGeometry(); const pos = new Float32Array(o.pos); for (let i = 2; i < pos.length; i += 3) pos[i] -= wr;
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
        const col = o.color || (role === 'kart' ? (/arduino|uno|nano|mega/i.test(o.name) ? '#0e7490' : '#b91c1c') : role === 'teker' ? '#1f2937' : role && role.startsWith('sensor') ? '#1d4ed8' : role === 'stop' ? '#dc2626' : md.renk || '#9aa5b1');
        const m = new THREE.Mesh(g, std(col, { roughness: 0.55, metalness: 0.05, transparent: !!md.seffaf, opacity: md.seffaf ? 0.45 : 1, side: THREE.DoubleSide }));
        m.castShadow = m.receiveShadow = true; robot.add(m); v.stl.push(m); }
    }
    for (const k of (rb.cables || [])) { /* jumper kablolar: noktalardan geçen yumuşak boru */
      const curve = new THREE.CatmullRomCurve3(k.pts.map(q => new THREE.Vector3(q[0], q[1], q[2] - wr)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, k.pts.length * 8), Math.max(0.0005, k.r), 6, false), std(k.color, { roughness: 0.45 })); m.castShadow = true; robot.add(m); }
    v.wheelG = [];
    for (const ax of (rb.axles || [rb.wheelX])) for (const side of ['L', 'R']) {
      const g = new THREE.Group();
      const WL = rb.wheelLook || {}; const tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, rb.wheelW, 48, 1), std(WL.lastik ? new THREE.Color(WL.lastik) : 0x1b1c1f, { roughness: 0.92 })); tire.castShadow = true;
      for (let k = 0; k < 18; k++) { const tr = new THREE.Mesh(new THREE.BoxGeometry(wr * 0.16, rb.wheelW * 0.92, 0.0016), std(WL.lastik ? new THREE.Color(WL.lastik).multiplyScalar(0.8) : 0x111214, { roughness: 1 })); const a = k / 18 * Math.PI * 2; tr.position.set(Math.cos(a) * (wr + 0.0006), 0, Math.sin(a) * (wr + 0.0006)); tr.rotation.y = -a + Math.PI / 2; tire.add(tr); } // diş deseni
      const hub = WL.jant ? new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.8, wr * 0.8, rb.wheelW * 1.03, 36), std(new THREE.Color(WL.jant), { roughness: 0.55 })) : new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.62, wr * 0.62, rb.wheelW * 1.04, 6), std(0xf5c518, { roughness: 0.5 }));
      g.add(tire, hub);
      if (WL.jant) { /* 6 kollu 3B baskı jant: kolların arası koyu boşluk, ortada metal göbek */
        for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * Math.PI * 2; const win = new THREE.Mesh(new THREE.BoxGeometry(wr * 0.34, rb.wheelW * 1.06, wr * 0.2), std(0x2a2d33, { roughness: 0.9 })); win.position.set(Math.cos(a) * wr * 0.5, 0, Math.sin(a) * wr * 0.5); win.rotation.y = -a; g.add(win); }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.16, wr * 0.16, rb.wheelW * 1.1, 20), std(0xc8ccd2, { metalness: 0.85, roughness: 0.3 })); g.add(cap); } robot.add(g); if (!v.wheels[side]) v.wheels[side] = g; v.wheelG.push({ g, side, ax });
    }
    if (rb.caster) { const c = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.004, rb.caster.r), 20, 14), std(0xc0c4cc, { metalness: 0.8, roughness: 0.25 })); c.position.set(rb.caster.x, rb.caster.y, Math.max(0.004, rb.caster.r) - wr); c.castShadow = true; robot.add(c); }
    for (const c of (rb.detail ? [] : rb.circuit)) {
      const mats = Array.from({ length: 6 }, () => std(c.color, { roughness: 0.6 })); mats[4] = std(0xffffff, { map: labelTex(c.name, c.color), roughness: 0.6 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, c.hy * 2, c.h), mats); m.position.set(c.x, c.y, c.z + c.h / 2 - wr); m.castShadow = true; robot.add(m);
      c._top = [c.x, c.y, c.z + c.h - wr];
    }
    if (rb.detail) for (const c of rb.circuit) c._top = [c.x, c.y, c.z + c.h - wr];
    for (const s of rb.sensors) {
      if (s.type === 'BUTON' || rb.detail) continue;
      const g = new THREE.Group(); g.position.set(s.x, s.y, s.z - wr); g.rotation.z = s.ang;
      if (s.type === 'HC-SR04') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.02), std(0x1d4ed8)); b.position.x = -0.006; g.add(b);
        for (const yy of [-0.013, 0.013]) { const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 20), std(0xd1d5db, { metalness: 0.7, roughness: 0.3 })); eye.rotation.z = Math.PI / 2; eye.position.set(0.005, yy, 0); g.add(eye); } }
      else if (s.type === 'TCS3200') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.028, 0.028), std(0x1e3a8a))); const led = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.01, 0.01), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 })); led.position.x = 0.003; g.add(led); }
      else { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.006), std(s.type === 'TCRT5000' ? 0x6d28d9 : 0x0f766e))); const ir = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.006, 12), std(0x111111)); ir.rotation.z = Math.PI / 2; ir.position.x = 0.006; g.add(ir); }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; }); robot.add(g);
    }
    if (rb.stop && !rb.detail) { const st = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 24), std(0xf5c518)); base.rotation.x = Math.PI / 2; base.position.z = 0.01; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xdc2626, { roughness: 0.4 })); cap.rotation.x = Math.PI / 2; cap.position.z = 0.02; st.add(base, cap); st.position.set(rb.stop.x, rb.stop.y, rb.stop.z - wr); st.traverse(o => { if (o.isMesh) o.castShadow = true; }); robot.add(st); }
    if (rb.led) {
      if (rb.led.n > 0) { /* NeoPixel şerit: koyu taşıyıcı + tek tek LED'ler (hepsi aynı malzemeyi paylaşır, renk birlikte değişir) */
        const L = rb.led, horiz = L.lx >= L.ly; const strip = new THREE.Mesh(new THREE.BoxGeometry(L.lx, L.ly, 0.0015), std(0x15171a, { roughness: 0.6 })); strip.position.set(L.x, L.y, L.z - wr); robot.add(strip);
        const lm = std(0x333333, { emissive: 0x000000 }); for (let i = 0; i < L.n; i++) { const t = (i + 0.5) / L.n - 0.5; const px = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.0016), lm); px.position.set(L.x + (horiz ? t * L.lx : 0), L.y + (horiz ? 0 : t * L.ly), L.z - wr + 0.0015); robot.add(px); if (!v.led) v.led = px; }
        v.led = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), lm); v.led.visible = false; v.led.position.set(L.x, L.y, L.z - wr); robot.add(v.led);
      } else { v.led = new THREE.Mesh(new THREE.BoxGeometry(rb.led.lx || 0.05, rb.led.ly || 0.012, 0.008), std(0x333333, { emissive: 0x000000 })); v.led.position.set(rb.led.x, rb.led.y, rb.led.z - wr); robot.add(v.led); } v.ledLight = new THREE.PointLight(0xff0000, 0, 0.18, 2); v.ledLight.position.copy(v.led.position); v.ledLight.position.z += 0.02; robot.add(v.ledLight); }
    const ard = rb.circuit.find(c => /arduino|uno|nano|mega/i.test(c.name)) || rb.circuit[0];
    const drv = rb.circuit.find(c => /l298|l293|tb6612|l9110|drv|bts|sürücü|surucu|driver/i.test(c.name));
    if (ard) {
      const add = (to, pin) => { const from = ard._top; const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, Math.max(from[2], to[2]) + 0.025];
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), new THREE.Vector3(...mid), new THREE.Vector3(...to));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(14)), new THREE.LineBasicMaterial({ color: 0x94a3b8 })); line.userData.pin = pin; robot.add(line); v.wires.push(line); };
      for (const s of rb.sensors) for (const k of ['pin', 'dpin', 'trig', 'echo', 's0', 's1', 's2', 's3', 'out']) if (s[k] != null) add([s.x, s.y, s.z - wr + 0.01], s[k]);
      for (const p of rb.parts) if (p.servoPin != null && p.pivot) add([p.pivot[0], p.pivot[1], p.z1 - wr], p.servoPin);
      if (rb.led) for (const k of ['r', 'b', 'pin']) if (rb.led[k] != null) add([rb.led.x, rb.led.y, rb.led.z - wr], rb.led[k]);
      if (drv) for (const k of ['L', 'R']) for (const val of Object.values(rb.driver[k])) if (val != null) add(drv._top, val);
    }
    robotViews.set(rb, v);
  }
  function clearRobots() { for (const v of robotViews.values()) { scene.remove(v.group); v.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } robotViews.clear(); }

  // ---- Işınlar ve iz ----
  const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600), 3)); rayGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(600), 3));
  const rays = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })); rays.frustumCulled = false; scene.add(rays);
  const trails = [0xf08c00, 0x2563eb].map(c => { const g = new THREE.BufferGeometry(); const buf = new Float32Array(4100 * 3); g.setAttribute('position', new THREE.BufferAttribute(buf, 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 })); l.frustumCulled = false; scene.add(l); return { g, buf, l }; });

  // ---- Kamera kontrolü (dokunmatik + fare) ----
  const cam = { target: new THREE.Vector3(F / 2, F / 2, 0), dist: 3.3, az: -Math.PI / 2, pol: 0.75, mode: 'serbest' };
  const ptrs = new Map(); let last = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { if (view.onPick && view.onPick(e)) return; el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button }); last = null; });
  el.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); last = null; });
  el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); last = null; });
  el.addEventListener('pointermove', e => {
    if (view.onDrag && view.onDrag(e)) return;
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) {
      if (p.b === 2 || e.shiftKey) pan(dx, dy); else { if (cam.mode === 'takip') cam.followOff = (cam.followOff || 0) - dx * 0.008; else cam.az -= dx * 0.008; cam.pol = Math.min(1.45, Math.max(0.02, cam.pol - dy * 0.006)); }
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (last) { cam.dist = Math.min(8, Math.max(0.12, cam.dist * last.d / d)); pan(cx - last.cx, cy - last.cy); } last = { d, cx, cy };
    }
  });
  el.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.min(8, Math.max(0.12, cam.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
  function pan(dx, dy) {
    if (cam.mode === 'takip') return; const k = cam.dist * 0.0012;
    const rx = Math.cos(cam.az + Math.PI / 2), ry = Math.sin(cam.az + Math.PI / 2); const fx = Math.cos(cam.az), fy = Math.sin(cam.az);
    cam.target.x += (-dx * rx + dy * -fx) * k * -1; cam.target.y += (-dx * ry + dy * -fy) * k * -1;
  }

  let curSim = null; const colTmp = new THREE.Color();
  const view = {
    renderer, camera, cam, onPick: null, onDrag: null, _dbg: () => ({ px: Array.from(fieldCanvas.getContext('2d').getImageData(512, 512, 1, 1).data), field: field.visible, fz: field.position.z, mat: field.material.color.getHexString() }),
    setSim(sim) { curSim = sim; paintField(sim.field.colors, sim.zones); buildEggs(sim); clearRobots(); for (const rb of sim.robots) buildRobot(rb); },
    focus: null,
    setMode(m) {
      cam.mode = m;
      if (m === 'ustten') { cam.target.set(F / 2, F / 2, 0); cam.dist = 3.4; cam.pol = 0.02; cam.az = -Math.PI / 2; }
      if (m === 'serbest') { cam.target.set(F / 2, F / 2, 0); cam.dist = 3.3; cam.pol = 0.75; cam.az = -Math.PI / 2; }
      if (m === 'seyirci') { cam.target.set(F / 2, F / 2 + 0.1, -0.05); cam.dist = 3.6; cam.pol = 1.02; cam.az = -Math.PI / 2 - 0.3; } // masanın yanında ayakta duran seyircinin gözü (≈1,6 m)
      if (m === 'takip') { cam.dist = 0.7; cam.pol = 1.0; cam.followOff = 0; cam._init = false; }
    },
    setQuality(q) { const lo = q === 'dusuk'; renderer.setPixelRatio(lo ? 1 : Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = !lo; sun.castShadow = !lo; scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(mm => { mm.needsUpdate = true; }); } }); this.resize(); },
    resize() { const r = host.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); },
    // ekran → saha düzlemi (z=0)
    pick(e) {
      const r = el.getBoundingClientRect(); const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera); const t = -rc.ray.origin.z / rc.ray.direction.z; if (!(t > 0)) return null;
      return [rc.ray.origin.x + rc.ray.direction.x * t, rc.ray.origin.y + rc.ray.direction.y * t];
    },
    render(opts) {
      const sim = curSim; if (!sim) return; const pos = rayGeo.attributes.position.array, col = rayGeo.attributes.color.array; let n = 0;
      const seg = (x1, y1, z1, x2, y2, z2, c) => { if (n >= 198) return; colTmp.setHex(c); pos.set([x1, y1, z1, x2, y2, z2], n * 6); col.set([colTmp.r, colTmp.g, colTmp.b, colTmp.r, colTmp.g, colTmp.b], n * 6); n++; };
      sim.robots.forEach((rb, ri) => {
        const v = robotViews.get(rb); if (!v) return; const robot = v.group; const s = rb.state;
        robot.position.set(s.x, s.y, s.z ?? rb.wheelR);
        if (s.q) robot.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w); else robot.quaternion.setFromAxisAngle(zAxis, s.th);
        for (const m of v.parts) { const pp = rb.partPose(m.userData.p); m.position.set(pp.cx, pp.cy, m.userData.zc); m.rotation.set(0, 0, pp.a); }
        for (const { g, side, ax } of v.wheelG) { const sy = side === 'L' ? 1 : -1, wi = rb.wheelInfo[side]; g.position.set(ax, sy * rb.track / 2, 0); g.rotation.set(0, wi.spin || 0, 0); g.children[0].material.color.set(opts.rays && wi.slip ? 0x7f1d1d : (rb.wheelLook && rb.wheelLook.lastik) || 0x1b1c1f); }
        if (v.led) { const c = rb.ledColor(); const hex = c === 'red' ? 0xff2a2a : c === 'blue' ? 0x2f6bff : c === 'mor' ? 0xb84bff : 0x000000; v.led.material.emissive.setHex(hex); v.led.material.emissiveIntensity = c ? 2.2 : 0; v.ledLight.color.setHex(hex || 0xffffff); v.ledLight.intensity = c ? 0.012 : 0; }
        for (const l of v.wires) { const k = l.userData.pin; const on = rb.duty(k) > 0; const pw = rb.duty(k); const sv = rb.servoTarget(k) != null; l.visible = opts.circuit; l.material.color.setHex(sv || (pw > 0 && pw < 1) ? 0xf59e0b : on ? 0xef4444 : 0x94a3b8); }
        if (opts.rays) for (const s2 of rb.sensors) {
          const w = rb.sensorWorld(s2);
          if (s2.type === 'HC-SR04') { const d = Sensors.ultrasonic(sim, rb, s2); const L = d == null ? 1.2 : d; for (const da of [-0.26, 0, 0.26]) seg(w.x, w.y, w.z, w.x + Math.cos(w.a + da) * L, w.y + Math.sin(w.a + da) * L, w.z, d == null ? 0x4c7dff : 0x16a34a); }
          else if (s2.type === 'IR_ENGEL' || s2.type === 'MZ80' || s2.type === 'SHARP_IR') { const hit = s2.type !== 'SHARP_IR' && Sensors.irObstacle(sim, rb, s2); const L = s2.type !== 'SHARP_IR' ? s2.range : 0.8; seg(w.x, w.y, w.z, w.x + Math.cos(w.a) * L, w.y + Math.sin(w.a) * L, w.z, hit ? 0xff3b3b : 0xf3a3a3); }
        }
        const T = trails[ri] || trails[0]; const tr = rb.trail; const mm = Math.min(tr.length, 4000); T.l.visible = opts.trail && mm > 1; T.l.material.color.set(rb.team === 'red' ? 0xf08c00 : 0x2563eb);
        for (let i = 0; i < mm; i++) { const p = tr[tr.length - mm + i]; T.buf[i * 3] = p[0]; T.buf[i * 3 + 1] = p[1]; T.buf[i * 3 + 2] = 0.002; }
        T.g.setDrawRange(0, mm); T.g.attributes.position.needsUpdate = true;
      });
      for (let i = sim.robots.length; i < trails.length; i++) trails[i].l.visible = false;
      rayGeo.setDrawRange(0, n * 2); rayGeo.attributes.position.needsUpdate = true; rayGeo.attributes.color.needsUpdate = true;
      sim.eggs.forEach((e, i) => { const m = eggMeshes[i]; if (!m) return; const hid = e._hidden !== undefined ? e._hidden : e.gone; m.visible = !hid; if (hid) return; m.position.set(e.x, e.y, e.z !== undefined ? e.z : RULES.EGG_H / 2);
        if (e.q) m.quaternion.set(e.q.x, e.q.y, e.q.z, e.q.w); else { tmpQ.setFromAxisAngle(zAxis, e.phi); m.quaternion.copy(tmpQ).multiply(qx90); } });
      const fr = (view.focus && sim.robots.includes(view.focus)) ? view.focus : sim.robots[0]; const pose = fr ? { p: [fr.state.x, fr.state.y], yaw: fr.state.th } : { p: [F / 2, F / 2], yaw: 0 };
      // kamera
      if (cam.mode === 'takip') {
        const tx = pose.p[0], ty = pose.p[1]; if (!cam._init) { cam.target.set(tx, ty, 0.05); cam._init = true; } else { cam.target.x += (tx - cam.target.x) * 0.25; cam.target.y += (ty - cam.target.y) * 0.25; cam.target.z = 0.05; }
        const want = pose.yaw + Math.PI + (cam.followOff || 0); let d = want - cam.az; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.az += d * 0.12;
      } else cam._init = false;
      const sp = Math.sin(cam.pol), cp = Math.cos(cam.pol);
      camera.position.set(cam.target.x + cam.dist * sp * Math.cos(cam.az), cam.target.y + cam.dist * sp * Math.sin(cam.az), cam.target.z + cam.dist * cp);
      camera.lookAt(cam.target);
      renderer.render(scene, camera);
    },
  };
  return view;
}
