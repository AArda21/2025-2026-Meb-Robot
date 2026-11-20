(() => {
const $ = (id) => document.getElementById(id);
const { RULES, Match, Sensors, TIRES, MOTORS, DRIVERS, SENSOR_TYPES, BOARDS, keyLabel, deepCopy } = SIM;
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function copyText(s) { const fb = () => { const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); toast(ok ? 'Kopyalandı' : 'Kopyalanamadı'); };
  try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(() => toast('Kopyalandı'), fb); else fb(); } catch (e) { fb(); } }
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2800); }
function h(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; }

// ---------------- IndexedDB (STL dosyaları) ----------------
const idb = (() => { let dbp = null; const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('mebsim', 1); r.onupgradeneeded = () => r.result.createObjectStore('stl'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  const mem = new Map();
  return { async put(k, v) { mem.set(k, v); try { const db = await open(); await new Promise((res, rej) => { const t = db.transaction('stl', 'readwrite'); t.objectStore('stl').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { } },
    async get(k) { if (mem.has(k)) return mem.get(k); try { const db = await open(); return await new Promise((res) => { const r = db.transaction('stl').objectStore('stl').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } },
    async del(k) { mem.delete(k); try { const db = await open(); db.transaction('stl', 'readwrite').objectStore('stl').delete(k); } catch (e) { } } }; })();

// ---------------- Profiller ----------------
let profiles; try { profiles = JSON.parse(LS.get('mebsim3_profiller') || 'null'); } catch (e) { profiles = null; }
if (!Array.isArray(profiles) || !profiles.length) profiles = deepCopy(DEFAULT_PROFILES);
else { for (const d of DEFAULT_PROFILES) if (!profiles.some(p => p.id === d.id)) profiles.push(deepCopy(d)); }
const undoStack = []; let lastUndoT = 0, lastSaved = JSON.stringify(profiles);
function pushUndo() { const now = Date.now(); if (now - lastUndoT > 1500) { undoStack.push(lastSaved); if (undoStack.length > 40) undoStack.shift(); } lastUndoT = now; }
let saveT = null; function saveProfiles() { pushUndo(); clearTimeout(saveT); saveT = setTimeout(() => { lastSaved = JSON.stringify(profiles); LS.set('mebsim3_profiller', lastSaved); }, 300); dirty = true; }
function _unusedSave() { clearTimeout(saveT); saveT = setTimeout(() => LS.set('mebsim3_profiller', JSON.stringify(profiles)), 300); dirty = true; }
const byId = (id) => profiles.find(p => p.id === id);
const newId = () => 'p' + Math.random().toString(36).slice(2, 8);
async function attachSTL(p) {
  const setS = (v) => Object.defineProperty(p, '_stl', { value: v, writable: true, configurable: true, enumerable: false });
  const cfg = (p.mekanik || {}).model3d; if (!cfg || !cfg.var) { setS(null); return; }
  let raw = await idb.get(p.id); if (!raw) { setS(null); return; }
  const buf = raw.buf || raw, name = raw.name || cfg.dosya || 'model.stl';
  try { const objs = SIM.parseModel(buf, name); setS(SIM.transformModel(objs, cfg)); } catch (e) { setS(null); toast('3D model okunamadı: ' + e.message); }
}

// ---------------- Rehber ----------------
$('bGuide').onclick = () => { $('guide').classList.add('on'); $('bGuideClose').focus(); };
$('bGuideClose').onclick = () => $('guide').classList.remove('on');
$('guide').onclick = (e) => { if (e.target.id === 'guide') $('guide').classList.remove('on'); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('guide').classList.remove('on'); });
if (!LS.get('mebsim3_rehber')) { LS.set('mebsim3_rehber', '1'); setTimeout(() => $('guide').classList.add('on'), 600); }
// ---------------- Sekmeler ----------------
let tab = 'saha';
function setTab(t) { tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === t)); if (t === 'robotlar') renderEditor(); if (t === 'monitor') serialDirty = true; if (t === 'saha' && view3d) setTimeout(() => view3d.resize(), 30); }
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.t));

// =====================================================================================
//                                  SAHA
// =====================================================================================
let MatchClass = Match, Match3D = null, view3d = null, use3d = false, libs = null;
let match = null, running = false, ended = false, dirty = false, seed = +(LS.get('mebsim3_tohum') || 2026);
const startPoses = {};
function fillProfileSelects() {
  const opts = (sel, withNone) => { const cur = sel.value; sel.innerHTML = (withNone ? '<option value="">— Robot yok —</option>' : '') + profiles.map(p => `<option value="${p.id}">${esc(p.ad)}</option>`).join(''); if ([...sel.options].some(o => o.value === cur)) sel.value = cur; };
  opts($('selRed'), true); opts($('selBlue'), true); opts($('selProfile')); opts($('selCheck')); opts($('selBatchA')); opts($('selBatchB')); if (!$('selBatchA').dataset.init) { $('selBatchA').dataset.init = 1; if (byId('yumyum')) $('selBatchA').value = 'yumyum'; if (byId('rakip')) $('selBatchB').value = 'rakip'; }
  if (!$('selRed').dataset.init) { $('selRed').value = LS.get('mebsim3_red') ?? 'yumyum'; $('selBlue').value = LS.get('mebsim3_blue') ?? 'rakip'; $('selRed').dataset.init = 1; if (![...$('selRed').options].some(o => o.value === $('selRed').value)) $('selRed').value = profiles[0].id; }
}
const gercek = () => ({ motor_farki: +$('nFark').value || 0, pil: $('nPil').value === '' ? 100 : +$('nPil').value });
async function buildMatch() {
  const red = byId($('selRed').value), blue = byId($('selBlue').value);
  for (const p of [red, blue]) if (p && p._stl === undefined) await attachSTL(p);
  match = new MatchClass({ profiles: { red, blue }, saha: { tohum: seed }, startPoses, kural: $('sKural').value, yesil_kose: $('sYesil').value, gercek: gercek() });
  match.onSerial = () => { serialDirty = true; };
  if (use3d && view3d) view3d.setSim(match);
  dirty = false; ended = false; rec = []; exitReplay(true); $('result').classList.remove('on'); fillFocus(); serialDirty = true; if (view3d) view3d.focus = focusRobot();
}
function fillFocus() {
  const cur = $('selFocus').value; const opts = match ? match.robots.map((r, i) => `<option value="${i}">${esc(r.name)} (${r.team === 'red' ? 'kırmızı' : 'mavi'})</option>`).join('') : '';
  $('selFocus').innerHTML = opts; $('selMon').innerHTML = opts; if (cur && $('selFocus').querySelector(`option[value="${cur}"]`)) $('selFocus').value = cur;
}
const focusRobot = () => match && match.robots[+$('selFocus').value || 0];
function showStartMsg(txt, ok) { const el = $('startMsg'); el.className = 'msg ' + (txt ? (ok ? 'ok' : 'err') : ''); el.textContent = txt || ''; }
async function startRun() {
  exitReplay(true); await buildMatch();
  if (!match.robots.length) { showStartMsg('Önce en az bir köşeye robot seç.', false); return; }
  const errs = match.compileAll();
  if (errs.length) { showStartMsg(errs.map(e => `${e.robot} [${e.board}]: ${e.msg}`).join('\n'), false); toast('Kodda hata var — ayrıntı aşağıda'); }
  else showStartMsg('');
  running = true; ended = false; $('bPause').textContent = '⏸ Duraklat';
}
$('bStart').onclick = startRun;
$('bPause').onclick = () => { if (replay) exitReplay(); if (!match || !match.robots.some(r => r.rts.length)) { startRun(); return; } if (ended) return; running = !running; $('bPause').textContent = running ? '⏸ Duraklat' : '▶ Devam'; };
$('bReset').onclick = async () => { running = false; $('bPause').textContent = '▶ Devam'; showStartMsg(''); await buildMatch(); };
$('selRed').onchange = $('selBlue').onchange = async () => { LS.set('mebsim3_red', $('selRed').value); LS.set('mebsim3_blue', $('selBlue').value); running = false; await buildMatch(); };
$('bShuffle').onclick = async () => { seed = Math.floor(Math.random() * 1e6); LS.set('mebsim3_tohum', seed); running = false; await buildMatch(); toast('Yeni yumurta dizilimi'); };
$('bRotL').onclick = () => rot(15); $('bRotR').onclick = () => rot(-15);
async function rot(d) { if (running || !match) return; const rb = focusRobot(); if (!rb) return; const s = rb.state; startPoses[rb.team] = { x: s.x, y: s.y, th: s.th + d * Math.PI / 180 }; await buildMatch(); }
$('sCam').onchange = () => view3d && view3d.setMode($('sCam').value);
$('nFark').value = LS.get('mebsim3_fark') ?? 3; $('nPil').value = LS.get('mebsim3_pil') ?? 100;
$('nFark').onchange = $('nPil').onchange = async () => { LS.set('mebsim3_fark', $('nFark').value); LS.set('mebsim3_pil', $('nPil').value); running = false; await buildMatch(); };
$('sKural').value = LS.get('mebsim3_kural') || '2026'; $('sYesil').value = LS.get('mebsim3_yesil') || 'sag_alt';
const syncKural = () => { $('yesilWrap').style.display = $('sKural').value === '2026' ? '' : 'none'; };
syncKural();
$('sKural').onchange = $('sYesil').onchange = async () => { LS.set('mebsim3_kural', $('sKural').value); LS.set('mebsim3_yesil', $('sYesil').value); syncKural(); running = false; await buildMatch(); toast($('sKural').value === '2026' ? '2026 kuralları: yeşil köşe, 2 dakika' : '2025 kuralları: ceza yumurtası, 3 dakika'); };
$('selFocus').onchange = () => { if (view3d) view3d.focus = focusRobot(); };

// ---------- 2B çizim ----------
const cv = $('cv'), ctx = cv.getContext('2d'); let W = 0, H = 0, SC = 1, OX = 0, OY = 0; const MRG = 0.05;
function resize2d() { const r = $('view').getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); W = cv.width; H = cv.height; SC = Math.min(W, H) / (RULES.FIELD + 2 * MRG); OX = (W - RULES.FIELD * SC) / 2; OY = (H - RULES.FIELD * SC) / 2; }
new ResizeObserver(() => { resize2d(); if (view3d) view3d.resize(); }).observe($('view'));
const X = (x) => OX + x * SC, Y = (y) => OY + (RULES.FIELD - y) * SC;
function poly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.closePath(); }
function draw2d() {
  const F = RULES.FIELD, Z = RULES.ZONE, col = match.field.colors;
  ctx.fillStyle = '#e3e8ee'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#d4d9df'; ctx.fillRect(X(-0.03), Y(F + 0.03), (F + 0.06) * SC, (F + 0.06) * SC);
  ctx.fillStyle = col.zemin; ctx.fillRect(X(0), Y(F), F * SC, F * SC);
  ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 1; for (let v = 0.25; v < F; v += 0.25) { ctx.beginPath(); ctx.moveTo(X(v), Y(0)); ctx.lineTo(X(v), Y(F)); ctx.moveTo(X(0), Y(v)); ctx.lineTo(X(F), Y(v)); ctx.stroke(); }
  ctx.font = `600 ${Math.max(10, SC * 0.035)}px system-ui`; ctx.textAlign = 'center';
  for (const z of match.zones) { ctx.fillStyle = z.kind === 'red' ? col.kirmizi : z.kind === 'blue' ? col.mavi : col.yesil; ctx.fillRect(X(z.x0), Y(z.y1), (z.x1 - z.x0) * SC, (z.y1 - z.y0) * SC); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(`${(match.banked[z.kind] || []).length} toplandı`, X((z.x0 + z.x1) / 2), Y((z.y0 + z.y1) / 2)); }
  for (const rb of match.robots) if ($('cTrail').checked && rb.trail.length > 1) { ctx.strokeStyle = rb.team === 'red' ? 'rgba(230,126,0,.6)' : 'rgba(37,99,235,.55)'; ctx.lineWidth = Math.max(1, SC * 0.004); ctx.beginPath(); rb.trail.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke(); }
  const r = RULES.EGG_R * SC;
  for (const e of match.eggs) { if (e._hidden !== undefined ? e._hidden : e.gone) continue; ctx.save(); ctx.translate(X(e.x), Y(e.y));
    if (e.kind === 'penalty') { ctx.rotate(-e.phi); ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 2 * Math.PI); ctx.fillStyle = col.kirmizi; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fillStyle = col.mavi; ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = e.kind === 'red' ? col.kirmizi : e.kind === 'green' ? col.yesil : col.mavi; ctx.fill(); }
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.restore(); }
  for (const rb of match.robots) {
    for (const wp of rb.worldParts()) { poly(wp.corners); let fill = wp.p.color; if (wp.p.auto === 'wheel') fill = rb.wheelInfo[wp.p.name.startsWith('Sol') ? 'L' : 'R'].slip ? '#b91c1c' : '#1f2937'; ctx.globalAlpha = wp.p.solid ? 0.95 : 0.6; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke(); }
    if ($('cCirc').checked) for (const c of rb.circuit) { const th = rb.state.th, cc = Math.cos(th), ss = Math.sin(th); const [wx, wy] = rb.toWorld(c.x, c.y); poly([[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [wx + cc * u * c.hx - ss * v * c.hy, wy + ss * u * c.hx + cc * v * c.hy])); ctx.globalAlpha = 0.85; ctx.fillStyle = c.color; ctx.fill(); ctx.globalAlpha = 1; }
    if ($('cRays').checked) for (const s of rb.sensors) { const w = rb.sensorWorld(s);
      if (s.type === 'HC-SR04') { const d = Sensors.ultrasonic(match, rb, s); const L = d == null ? 1.5 : d; ctx.fillStyle = d == null ? 'rgba(76,125,255,.08)' : 'rgba(22,163,74,.16)'; ctx.beginPath(); ctx.moveTo(X(w.x), Y(w.y)); ctx.lineTo(X(w.x + Math.cos(w.a - 0.26) * L), Y(w.y + Math.sin(w.a - 0.26) * L)); ctx.lineTo(X(w.x + Math.cos(w.a + 0.26) * L), Y(w.y + Math.sin(w.a + 0.26) * L)); ctx.closePath(); ctx.fill(); }
      else if (s.type === 'IR_ENGEL' || s.type === 'MZ80') { const hit = Sensors.irObstacle(match, rb, s); ctx.strokeStyle = hit ? '#dc2626' : 'rgba(220,38,38,.3)'; ctx.lineWidth = hit ? 2.5 : 1.2; ctx.beginPath(); ctx.moveTo(X(w.x), Y(w.y)); ctx.lineTo(X(w.x + Math.cos(w.a) * s.range), Y(w.y + Math.sin(w.a) * s.range)); ctx.stroke(); } }
    if (rb.led) { const [lx, ly] = rb.toWorld(rb.led.x, rb.led.y); const c = rb.ledColor(); ctx.beginPath(); ctx.arc(X(lx), Y(ly), Math.max(4, SC * 0.012), 0, 7); ctx.fillStyle = c === 'red' ? '#ff3b3b' : c === 'blue' ? '#3b7bff' : c === 'mor' ? '#b84bff' : '#444'; ctx.fill(); }
  }
}

// ---------- Sürükle (başlangıç konumu) ----------
function pickRobot(p) { if (running || !match || !p) return null; let best = null, bd = 0.17; for (const rb of match.robots) { const d = Math.hypot(p[0] - rb.state.x, p[1] - rb.state.y); if (d < bd) { bd = d; best = rb; } } return best; }
let drag = null;
const screenToField = (e) => { const r = cv.getBoundingClientRect(), dpr = cv.width / r.width; return [((e.clientX - r.left) * dpr - OX) / SC, RULES.FIELD - ((e.clientY - r.top) * dpr - OY) / SC]; };
function dragMove(p) { if (!drag || !p) return; const s = drag.rb.state; s.x = Math.min(RULES.FIELD - 0.1, Math.max(0.1, p[0] + drag.dx)); s.y = Math.min(RULES.FIELD - 0.1, Math.max(0.1, p[1] + drag.dy)); startPoses[drag.rb.team] = { x: s.x, y: s.y, th: s.th }; }
cv.addEventListener('pointerdown', e => { const p = screenToField(e); const rb = pickRobot(p); if (rb) { drag = { rb, dx: rb.state.x - p[0], dy: rb.state.y - p[1] }; cv.setPointerCapture(e.pointerId); } });
cv.addEventListener('pointermove', e => dragMove(screenToField(e)));
cv.addEventListener('pointerup', () => { drag = null; });

// ---------- Göstergeler ----------
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; };
let serialDirty = true, lastUi = 0;
function updateUi() {
  if (!match) return; const sc = match.score();
  $('hTime').textContent = fmtT(Math.max(0, match.matchTime - match.time)); $('hRed').textContent = 'K ' + sc.red; $('hBlue').textContent = 'M ' + sc.blue;
  const rb = focusRobot();
  $('ovl').textContent = `${match.engineName} · ${running ? '● ' + realF.toFixed(1) + '×' : ended ? 'bitti' : 'durdu'}` + (rb ? ` · ${(Math.hypot(rb.state.vx, rb.state.vy) * 100).toFixed(0)} cm/s` : '');
  if (rb) {
    const wi = rb.wheelInfo, cards = [];
    for (const [k, lab] of [['L', 'Sol motor'], ['R', 'Sağ motor']]) cards.push([lab, `<span class="${wi[k].slip ? 'bad' : ''}">${wi[k].V.toFixed(1)} V · ${wi[k].rpm.toFixed(0)} rpm${wi[k].slip ? ' · PATİNAJ' : ''}</span>`]);
    const led = rb.ledColor(); cards.push(['Üst LED', led ? ({ red: 'kırmızı', blue: 'mavi', mor: 'mor' }[led] + (led === rb.team ? ' ✓' : ' <span class="bad">⚠ yanlış renk</span>')) : '<span class="bad">sönük</span>']);
    { const d = sc.detail[rb.team]; const parts = [`kendi ${d.own}`, `yanlış ${d.wrong}`]; if (match.rules.yesil) parts.push(`yeşil ${d.green}`); if (match.rules.ceza) parts.push(`ceza ${d.pen}`); if (d.led) parts.push(`LED −${10 * d.led}`); cards.push(['Puan ' + sc[rb.team], parts.join(' · ')]); }
    if (rb.state.tilt > 3) cards.push(['Eğim', rb.state.tilt.toFixed(0) + '°']);
    for (const r of Sensors.readouts(match, rb)) cards.push([r.name, esc(r.val)]);
    for (const rt of rb.rts) if (rt.error || rt.compileError) cards.push([`Kod (${rt.board.id})`, '<span class="bad">hata — Monitör</span>']);
    $('stats').innerHTML = cards.map(([k, v]) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join('');
  } else $('stats').innerHTML = '<p class="hint">Sahada robot yok.</p>';
  if (tab === 'monitor') updateMonitor();
}
function parseNums(txt) { const out = []; const re = /(?:([A-Za-zÇĞİÖŞÜçğıöşü_][\wÇĞİÖŞÜçğıöşü]*)\s*[=:]\s*)?(-?\d+(?:\.\d+)?)/g; let m, i = 0; while ((m = re.exec(txt))) { out.push([m[1] || ('değer' + (++i)), +m[2]]); } return out; }
const PCOL = ['#e67e00', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0891b2'];
function drawPlot(rb) {
  const cv2 = $('plot'), r = cv2.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv2.width = r.width * dpr; cv2.height = r.height * dpr; const g = cv2.getContext('2d'); g.scale(dpr, dpr); const Wp = r.width, Hp = r.height;
  g.clearRect(0, 0, Wp, Hp); if (!rb) return; const series = new Map(); const lines = rb.serial.slice(-400);
  lines.forEach((l, i) => { for (const [k, v] of parseNums(l.txt)) { if (!series.has(k)) series.set(k, []); series.get(k).push([l.t, v]); } });
  const keys = [...series.keys()].slice(0, 6); if (!keys.length) { g.fillStyle = '#9aa3b2'; g.font = '13px system-ui'; g.fillText('Henüz sayısal seri çıktı yok', 12, 24); $('plotLegend').innerHTML = ''; return; }
  let t0 = Infinity, t1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const k of keys) for (const [t, v] of series.get(k)) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  if (v1 === v0) { v1 += 1; v0 -= 1; } if (t1 === t0) t1 += 1; const P = 30;
  g.strokeStyle = '#e5e7eb'; g.fillStyle = '#9aa3b2'; g.font = '11px system-ui'; for (let i = 0; i <= 4; i++) { const y = P / 2 + (Hp - P) * i / 4; g.beginPath(); g.moveTo(P, y); g.lineTo(Wp - 6, y); g.stroke(); g.fillText(String(+(v1 - (v1 - v0) * i / 4).toFixed(1)), 2, y + 4); }
  keys.forEach((k, ki) => { g.strokeStyle = PCOL[ki]; g.lineWidth = 1.6; g.beginPath(); series.get(k).forEach(([t, v], i) => { const x = P + (Wp - P - 6) * (t - t0) / (t1 - t0), y = P / 2 + (Hp - P) * (v1 - v) / (v1 - v0); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); });
  $('plotLegend').innerHTML = keys.map((k, i) => { const s = series.get(k); return `<span style="color:${PCOL[i]};font-weight:700">● ${esc(k)}: ${s[s.length - 1][1]}</span>`; }).join(' ');
}
function updateMonitor() {
  drawPlot(match && match.robots[+$('selMon').value || 0]);
  const rb = match && match.robots[+$('selMon').value || 0];
  if (serialDirty) { serialDirty = false; const el = $('serial'); if (!rb) { el.textContent = ''; } else { const multi = rb.boards.length > 1; el.innerHTML = rb.serial.slice(-500).map(l => `<span class="t">${l.t.toFixed(3).padStart(8)} ${multi ? '[' + esc(l.b) + '] ' : ''}</span>${esc(l.txt)}`).join('\n') || '<span class="t">Henüz çıktı yok. Sahada ▶ Başlat\'a bas.</span>'; if ($('cAuto').checked) el.scrollTop = el.scrollHeight; } }
  if (rb) { const vrows = []; const li = []; for (const rt of rb.rts) { if (rt.prog && rt.prog.vars) { let v = {}; try { v = rt.prog.vars(); } catch (e) { } for (const [k, val] of Object.entries(v)) if (['number', 'boolean', 'string'].includes(typeof val)) vrows.push(`<tr><td>${esc(rt.board.id)}</td><td>${esc(k)}</td><td><b>${esc(typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(3) : String(val))}</b></td></tr>`); }
      const L = rt.loopStats; if (L && L.n) li.push(`${rb.boards.length > 1 ? rt.board.id + ': ' : ''}loop ort. ${(L.sum / L.n * 1000).toFixed(1)} ms, en uzun ${(L.max * 1000).toFixed(0)} ms`); }
    $('varTbl').querySelector('tbody').innerHTML = vrows.join('') || '<tr><td colspan="3" class="hint">Maç başlayınca kodundaki değişkenler burada canlı görünür.</td></tr>'; $('loopInfo').textContent = li.join(' · '); }
  if (!rb) return; const rows = new Map(); for (const hp of rb.hardwarePins()) rows.set(hp.key, (rows.get(hp.key) ? rows.get(hp.key) + ', ' : '') + hp.role);
  for (const rt of rb.rts) for (const k of Object.keys(rt.pins)) if (!rows.has(+k)) rows.set(+k, '');
  $('pinTbl').querySelector('tbody').innerHTML = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([k, role]) => {
    const rt = rb.rtOf(k), st = rt && rt.pins[k]; let mode = st ? (st.mode === 1 ? 'OUTPUT' : st.pull ? 'INPUT_PULLUP' : 'INPUT') : '—', val = '—', cls = 'lo';
    if (st && st.pwm != null) { val = 'PWM ' + st.raw; cls = 'pwm'; } else if (st && st.mode === 1) { val = st.v ? 'HIGH' : 'LOW'; cls = st.v ? 'hi' : 'lo'; }
    const sv = rb.servoTarget(k); if (sv != null) { mode = 'SERVO'; val = `${sv.toFixed(0)}° (şu an ${(rb.servoAng[k] ?? 0).toFixed(0)}°)`; cls = 'pwm'; }
    return `<tr><td>${esc(keyLabel(k, rb.boards))}</td><td>${esc(role)}</td><td>${mode}</td><td class="${cls}">${val}</td></tr>`;
  }).join('');
}
$('selMon').onchange = () => { serialDirty = true; }; $('bClr').onclick = () => { const rb = match && match.robots[+$('selMon').value || 0]; if (rb) rb.serial.length = 0; serialDirty = true; };
function endMatch() {
  ended = true; running = false; $('bPause').textContent = '▶ Devam'; const sc = match.score();
  const line = (t) => { const d = sc.detail[t], rb = match.robotByTeam(t); if (!rb) return ''; const parts = [`kendi rengi ${d.own}`, `yanlış renk ${d.wrong}`]; if (match.rules.ceza) parts.push(`ceza yumurtası ${d.pen}`); if (match.rules.yesil) parts.push(`yeşil ${d.green}`); if (d.led) parts.push(`LED cezası ${d.led}×−10`);
    return `<div><b style="color:${t === 'red' ? 'var(--red)' : 'var(--blue)'}">${esc(rb.name)}: ${sc[t]} puan</b> — ${parts.join(', ')}${d.own ? '' : ' · <span class="bad">kendi köşesine kendi renginde yumurta yok → kaybeder</span>'}</div>`; };
  const res = match.result(); const win = match.robots.length === 2 ? (res.winner ? `<div>Kazanan: <b>${esc(match.robotByTeam(res.winner).name)}</b> (${res.reason})</div>` : `<div>${res.reason}</div>`) : '';
  saveHistory(sc, res);
  $('result').innerHTML = `<b>Maç bitti (${fmtT(match.matchTime)})</b>${line('red')}${line('blue')}${win}`; $('result').innerHTML += '<div class="row"><button class="btn sm" onclick="document.getElementById(\'bReplay\').click()">⏪ Tekrar izle</button></div>'; $('result').classList.add('on');
}

// ---------- Maç geçmişi ----------
function loadHistory() { try { return JSON.parse(LS.get('mebsim3_gecmis') || '[]'); } catch (e) { return []; } }
function saveHistory(sc, res) { const H = loadHistory(); const R = match.robotByTeam('red'), B = match.robotByTeam('blue');
  H.unshift({ t: Date.now(), r: R ? R.name : '—', b: B ? B.name : '—', sr: sc.red, sb: sc.blue, w: res.winner || '', k: $('sKural').value, sd: seed, mf: gercek().motor_farki, f3: !!use3d });
  LS.set('mebsim3_gecmis', JSON.stringify(H.slice(0, 30))); renderHistory(); }
function renderHistory() { const H = loadHistory(), el = $('gecmis'); if (!el) return; if (!H.length) { el.textContent = 'Henüz maç yok.'; return; }
  const ad = H.reduce((a, x) => { if (x.w) a[x.w === 'red' ? x.r : x.b] = (a[x.w === 'red' ? x.r : x.b] || 0) + 1; return a; }, {});
  el.innerHTML = '<div class="scroll"><table style="min-width:0"><tr><th>Zaman</th><th>Kırmızı</th><th>Mavi</th><th>Sonuç</th><th></th></tr>' + H.map((x, i) => { const d = new Date(x.t); const tt = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `<tr><td>${tt}</td><td${x.w === 'red' ? ' style="font-weight:700"' : ''}>${esc(x.r)} <b>${x.sr}</b></td><td${x.w === 'blue' ? ' style="font-weight:700"' : ''}>${esc(x.b)} <b>${x.sb}</b></td><td>${x.w ? (x.w === 'red' ? 'Kırmızı' : 'Mavi') + ' kazandı' : 'Berabere'}${x.f3 ? '' : ' · 2B'}</td><td><button class="btn sm" data-h="${i}" title="Aynı yumurta dizilimiyle yeniden oyna">↻</button></td></tr>`; }).join('') + '</table></div>'
    + `<p class="hint">Galibiyetler: ${Object.entries(ad).map(([n, c]) => `${esc(n)} ${c}`).join(' · ') || '—'}</p>`;
  el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const x = H[+b.dataset.h]; seed = x.sd; LS.set('mebsim3_tohum', seed); const fr = profiles.find(p => p.ad === x.r), fb = profiles.find(p => p.ad === x.b); if (fr) $('selRed').value = fr.id; if (fb) $('selBlue').value = fb.id; startRun(); toast('Aynı yumurta dizilimiyle yeniden başlatıldı'); }); }
$('sQual').onchange = () => { LS.set('mebsim3_grafik', $('sQual').value); if (view3d) view3d.setQuality($('sQual').value); };
$('bGecmisSil').onclick = () => { LS.set('mebsim3_gecmis', '[]'); renderHistory(); };
renderHistory();

// ---------- Geri oynatma ----------
function enterReplay() { if (!match || rec.length < 2) { toast('Önce bir maç oynat'); return; } running = false; $('bPause').textContent = '▶ Devam'; replay = { t: 0, idx: -1, play: true }; $('result').classList.remove('on'); $('rpSlider').max = String(rec.length - 1); $('replayBar').style.display = ''; $('bRpPlay').textContent = '⏸'; }
function exitReplay(silent) { if (!replay) return; replay = null; $('replayBar').style.display = 'none'; if (match && !silent && rec.length) match.applySnapshot(rec[rec.length - 1]); if (match) { for (const e of match.eggs) delete e._hidden; for (const rb of match.robots) rb._ledOverride = undefined; } }
$('bReplay').onclick = () => replay ? exitReplay() : enterReplay();
$('bRpPlay').onclick = () => { if (!replay) return; if (replay.t >= rec[rec.length - 1].t - 0.01) replay.t = 0; replay.play = !replay.play; $('bRpPlay').textContent = replay.play ? '⏸' : '▶'; };
$('rpSlider').oninput = () => { if (!replay) return; replay.play = false; $('bRpPlay').textContent = '▶'; replay.t = rec[+$('rpSlider').value].t; };
$('bRpExit').onclick = () => exitReplay();
// ---------- Ana döngü ----------
let acc = 0, realF = 1, lastF = 0, rec = [], replay = null;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastF) / 1000 || 0); lastF = ts;
  if (running && match) {
    const sp = +$('sSpeed').value, sdt = match.dt; acc += dt * sp; let n = Math.floor(acc / sdt); acc -= n * sdt; const t0 = performance.now(), simT0 = match.time;
    for (let i = 0; i < n; i++) { match.step(sdt); if (!$('cNoLimit').checked && match.time >= match.matchTime) { endMatch(); break; } if (performance.now() - t0 > 28) { acc = 0; break; } }
    realF = realF * 0.9 + 0.1 * ((match.time - simT0) / Math.max(1e-3, dt));
    if (use3d && !frame._warned && match.time > 6 && realF < 0.55 * sp) { frame._slow = (frame._slow || 0) + dt; if (frame._slow > 4) { frame._warned = true; toast(`3B bu cihazda yavaş (gerçek hızın %${Math.round(realF / sp * 100)}'i). Ayarlardan önce "Grafik: Düşük", yetmezse "Fizik: 2B hızlı" seç.`); } } else frame._slow = 0;
    if (!rec.length || match.time - rec[rec.length - 1].t >= 0.05) { rec.push(match.snapshot()); if (rec.length > 6000) rec.splice(0, 1000); }
  }
  if (replay && match && rec.length) {
    if (replay.play) { replay.t += dt * +$('sSpeed').value; if (replay.t >= rec[rec.length - 1].t) { replay.t = rec[rec.length - 1].t; replay.play = false; $('bRpPlay').textContent = '▶'; } }
    let lo = 0, hi = rec.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rec[mid].t <= replay.t) lo = mid; else hi = mid - 1; }
    if (replay.idx !== lo) { replay.idx = lo; match.applySnapshot(rec[lo]); $('rpSlider').value = String(lo); $('rpTime').textContent = fmtT(rec[lo].t) + ` · K ${rec[lo].sc.red} · M ${rec[lo].sc.blue}`; }
  }
  if (match) { if (use3d && view3d) view3d.render({ rays: $('cRays').checked, circuit: $('cCirc').checked, trail: $('cTrail').checked }); else draw2d(); if (ts - lastUi > 150) { lastUi = ts; updateUi(); } }
  requestAnimationFrame(frame);
}

// =====================================================================================
//                                  ROBOT DÜZENLEYİCİ
// =====================================================================================
let seg = 'kod';
const curProfile = () => byId($('selProfile').value) || profiles[0];
document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { seg = b.dataset.s; document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('on', x === b)); renderEditor(); });
$('selProfile').onchange = renderEditor;
$('pName').oninput = () => { curProfile().ad = $('pName').value; saveProfiles(); fillProfileSelects(); };
$('pDesc').oninput = () => { curProfile().aciklama = $('pDesc').value; saveProfiles(); };
$('bNew').onclick = () => { const p = deepCopy(DEFAULT_PROFILES[0]); p.id = newId(); p.ad = 'Yeni robot'; p.mekanik.model3d = null; profiles.push(p); saveProfiles(); fillProfileSelects(); $('selProfile').value = p.id; renderEditor(); toast('Yeni profil (Yum Yum örneğinden)'); };
$('bDup').onclick = async () => { const s = curProfile(); const p = deepCopy(s); p.id = newId(); p.ad = s.ad + ' (kopya)'; const raw = await idb.get(s.id); if (raw) await idb.put(p.id, raw); profiles.push(p); saveProfiles(); fillProfileSelects(); $('selProfile').value = p.id; renderEditor(); };
$('bDel').onclick = () => { if (profiles.length < 2) { toast('Son profil silinemez'); return; } const p = curProfile(); if ($('bDel').dataset.arm !== p.id) { $('bDel').dataset.arm = p.id; $('bDel').textContent = 'Emin misin? Tekrar bas'; setTimeout(() => { $('bDel').dataset.arm = ''; $('bDel').textContent = 'Sil'; }, 3000); return; } profiles = profiles.filter(x => x !== p); idb.del(p.id); saveProfiles(); fillProfileSelects(); $('bDel').textContent = 'Sil'; renderEditor(); toast(p.ad + ' silindi'); };
$('bUndo').onclick = () => { if (!undoStack.length) { toast('Geri alınacak değişiklik yok'); return; } const cur = $('selProfile').value; const prev = undoStack.pop(); try { const restored = JSON.parse(prev); for (const p of restored) { const old = byId(p.id); if (old && old._stl !== undefined) Object.defineProperty(p, '_stl', { value: old._stl, writable: true, configurable: true, enumerable: false }); } profiles = restored; lastSaved = prev; LS.set('mebsim3_profiller', prev); fillProfileSelects(); if (byId(cur)) $('selProfile').value = cur; renderEditor(); dirty = true; toast('Son değişiklik geri alındı'); } catch (e) { toast('Geri alınamadı'); } };
$('bDefaults').onclick = () => { let n = 0; for (const d of DEFAULT_PROFILES) { const c = deepCopy(d); if (profiles.some(p => p.id === c.id)) { c.id = newId(); c.ad = d.ad + ' (güncel örnek)'; } profiles.push(c); n++; } saveProfiles(); fillProfileSelects(); renderEditor(); toast(n + ' hazır örnek profil eklendi (seninkiler silinmedi)'); };
$('bExport').onclick = () => { const txt = JSON.stringify(curProfile(), null, 1); try { navigator.clipboard.writeText(txt).then(() => toast('Profil JSON panoya kopyalandı'), () => toast('Kopyalanamadı')); } catch (e) { toast('Kopyalanamadı'); } };
$('fImport').onchange = () => { const f = $('fImport').files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const p = JSON.parse(SIM.stripJsonComments(String(r.result))); p.id = newId(); profiles.push(p); saveProfiles(); fillProfileSelects(); $('selProfile').value = p.id; renderEditor(); toast((p.ad || 'Profil') + ' içe aktarıldı'); } catch (e) { toast('JSON okunamadı: ' + e.message); } }; r.readAsText(f); $('fImport').value = ''; };

// küçük form yardımcıları
const num = (v) => v === '' || v == null ? null : +String(v).replace(',', '.');
function fld(obj, key, label, opt = {}) {
  const type = opt.type || 'number'; let inp;
  if (type === 'select') { inp = h('select', {}, ...Object.entries(opt.options).map(([v, t]) => h('option', { value: v }, t))); inp.value = obj[key] ?? opt.def ?? ''; }
  else if (type === 'check') { inp = h('input', { type: 'checkbox' }); inp.checked = !!obj[key]; const l = h('label', { class: 'chk' }, inp, label); inp.onchange = () => { obj[key] = inp.checked; saveProfiles(); opt.after && opt.after(); }; return l; }
  else { inp = h('input', { type: type === 'number' ? 'number' : 'text', step: opt.step || 'any', placeholder: opt.ph || '' }); inp.value = obj[key] ?? ''; if (opt.w) inp.style.width = opt.w; }
  inp.onchange = () => { obj[key] = type === 'number' ? num(inp.value) : (opt.pin ? (inp.value.trim() === '' ? null : (/^\d+$/.test(inp.value.trim()) ? +inp.value.trim() : inp.value.trim())) : inp.value); saveProfiles(); opt.after && opt.after(); };
  return h('label', { class: 'f' }, label, inp);
}
const pinFld = (obj, key, label) => fld(obj, key, label, { type: 'text', pin: true, w: '86px', ph: 'ör. 7, A0' });
const card = (title, ...kids) => h('div', { class: 'card' }, title ? h('h2', {}, title) : null, ...kids);

function renderEditor() {
  if (tab !== 'robotlar') return; const p = curProfile(); if (!p) return;
  $('pName').value = p.ad || ''; $('pDesc').value = p.aciklama || '';
  for (const s of ['kod', 'mekanik', 'devre']) $('sec' + s[0].toUpperCase() + s.slice(1)).style.display = s === seg ? '' : 'none';
  if (seg === 'kod') renderKod(p); if (seg === 'mekanik') renderMekanik(p); if (seg === 'devre') renderDevre(p);
}
// ---------- Kod düzenleyici (satır numaralı) ----------
function makeEditor(ta) {
  const gut = h('pre', { class: 'gutter', 'aria-hidden': 'true' }); const el = h('div', { class: 'editor' }, gut, ta); let marked = null;
  const upd = () => { const n = ta.value.split('\n').length; let s = ''; for (let k = 1; k <= n; k++) s += (k === marked ? '▶' : '') + k + '\n'; gut.textContent = s; gut.scrollTop = ta.scrollTop; };
  ta.addEventListener('input', upd); ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; }); setTimeout(upd, 0);
  return { el, mark(ln) { marked = ln; upd(); if (ln) { const pos = ta.value.split('\n').slice(0, ln - 1).join('\n').length + 1; ta.focus(); ta.setSelectionRange(pos, pos + (ta.value.split('\n')[ln - 1] || '').length); const lh = 19.5; ta.scrollTop = Math.max(0, (ln - 5) * lh); } } };
}
// Söz dizimi hatasının satırını bul (kodu çalıştırmadan, tarayıcının ayrıştırıcısıyla)
function syntaxLine(js) {
  let line = null; const onErr = (ev) => { line = ev.lineno; ev.preventDefault(); };
  try { window.addEventListener('error', onErr); const sc = document.createElement('script'); sc.textContent = 'function __mebKontrol(){with({}){\n' + js + '\n}}'; document.head.appendChild(sc); sc.remove(); } catch (e) { } finally { window.removeEventListener('error', onErr); }
  return line ? Math.max(1, line - 1) : null;
}
// ---------- KOD ----------
function renderKod(p) {
  const root = $('secKod'); root.innerHTML = ''; p.kartlar = p.kartlar && p.kartlar.length ? p.kartlar : [{ id: 'ana', tip: 'Uno', kod: '' }];
  p.kartlar.forEach((b, i) => {
    const msg = h('div', { class: 'msg' }); const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off' }); ta.value = b.kod || '';
    ta.oninput = () => { b.kod = ta.value; saveProfiles(); }; ta.onkeydown = (e) => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); b.kod = ta.value; } };
    const file = h('input', { type: 'file', accept: '.ino,.cpp,.c,.h,.txt', hidden: true }); file.onchange = () => { const f = file.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { ta.value = b.kod = String(r.result); saveProfiles(); toast(f.name + ' yüklendi'); }; r.readAsText(f); };
    const ed = makeEditor(ta);
    const check = () => { try { const fakeM = { robots: [], eggs: [], time: 0, zoneOf: () => null }; const rb = new SIM.Robot(p, 'red', fakeM); rb.reset({ x: 1, y: 1, th: 0 }); const rt = new SIM.Runtime(fakeM, rb, i); SIM.compile(b.kod, rt.api()); const lw = SIM.lint(b.kod); if (lw.length) { msg.className = 'msg err'; msg.textContent = lw.slice(0, 6).map(l => `Satır ${l.line}: ${l.msg}`).join('\n') + '\n(Arduino IDE bu hatalarla derlemez; simülatör yine de çalıştırabilir.)'; ed.mark(lw[0].line); } else { msg.className = 'msg ok'; msg.textContent = 'Derlendi ✓ (söz dizimi doğru)'; ed.mark(null); } }
      catch (e) { const ln = e.js ? syntaxLine(e.js) : null; msg.className = 'msg err'; msg.textContent = e.message + (ln ? `\n→ yaklaşık satır ${ln}` : ''); ed.mark(ln); } };
    root.append(card(null,
      h('div', { class: 'row', style: 'margin-top:0' }, h('strong', {}, p.kartlar.length > 1 ? `Kart ${i + 1}` : 'Arduino kodu'),
        fld(b, 'id', 'Kart adı', { type: 'text', w: '110px' }), fld(b, 'tip', 'Kart', { type: 'select', options: Object.fromEntries(Object.entries(BOARDS).map(([k, v]) => [k, v.ad])) }),
        h('label', { class: 'btn sm' }, '.ino aç', file), h('button', { class: 'btn sm', on: { click: check } }, 'Derle'),
        p.kartlar.length > 1 ? h('button', { class: 'btn sm danger', on: { click: () => { p.kartlar.splice(i, 1); saveProfiles(); renderKod(p); } } }, 'Kartı kaldır') : null),
      msg, ed.el));
  });
  const links = h('textarea', { class: 'short', placeholder: 'mega:A0 - nano:A0' }); links.value = (p.kart_baglantilari || []).map(x => Array.isArray(x) ? x.join(' - ') : x).join('\n');
  links.onchange = () => { p.kart_baglantilari = links.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(/\s*(?:<->|↔|-|,)\s*/)); saveProfiles(); };
  root.append(card('Kartlar', h('div', { class: 'row' }, h('button', { class: 'btn sm', on: { click: () => { p.kartlar.push({ id: 'kart' + (p.kartlar.length + 1), tip: 'Nano', kod: 'void setup() {\n}\n\nvoid loop() {\n}\n' }); saveProfiles(); renderKod(p); } } }, '+ Kart ekle (iki Arduino)')),
    p.kartlar.length > 1 ? h('div', {}, h('p', { class: 'hint' }, 'Kartlar arası teller (her satıra bir tel): kartAdı:pin - kartAdı:pin'), links) : h('p', { class: 'hint' }, 'Robotta iki Arduino varsa (ör. Mega + Nano) ikinci kartı ekle; aralarındaki telleri burada tanımlarsın, kartlar birbirinin pinini okuyabilir.')));
}
// ---------- MEKANİK ----------
function renderMekanik(p) {
  const root = $('secMekanik'); root.innerHTML = ''; const M = p.mekanik = p.mekanik || {};
  M.tekerlek = M.tekerlek || {}; M.motor = M.motor || {}; M.pil = M.pil || {}; M.agirlik_merkezi = M.agirlik_merkezi || {}; M.acil_stop = M.acil_stop || null;
  const T = M.tekerlek, Mo = M.motor;
  const rerender = () => renderMekanik(p);
  root.append(card('Gövde', h('div', { class: 'fields' }, fld(M, 'kutle_kg', 'Toplam kütle (kg)'), fld(M.agirlik_merkezi, 'z_cm', 'Ağırlık merkezi yüksekliği (cm)'), fld(M.agirlik_merkezi, 'x_cm', 'Ağırlık merkezi x (cm, boş = otomatik)'))));
  const tc = card('Tekerlekler', h('div', { class: 'fields' }, fld(T, 'lastik', 'Lastik', { type: 'select', options: Object.fromEntries(Object.entries(TIRES).map(([k, v]) => [k, v.ad])), def: 'kaucuk', after: rerender }), fld(T, 'cap_cm', 'Çap (cm)'), fld(T, 'genislik_cm', 'Genişlik (cm)'), fld(T, 'iz_cm', 'İki teker arası (cm)'), fld(T, 'x_cm', 'Teker ekseni x (cm)')));
  if (T.lastik === 'ozel') tc.append(h('div', { class: 'fields', style: 'margin-top:10px' }, fld(T, 'mu_statik', 'Statik sürtünme μs'), fld(T, 'mu_kinetik', 'Kayma sürtünmesi μk'), fld(T, 'yuvarlanma', 'Yuvarlanma direnci')));
  else { const t = TIRES[T.lastik || 'kaucuk']; if (t) tc.append(h('p', { class: 'hint' }, `Sunta zeminde: μs ≈ ${t.muS}, μk ≈ ${t.muK}, yuvarlanma ≈ ${t.crr}`)); }
  root.append(tc);
  const hasCaster = M.sarhos_teker !== null; M.sarhos_teker = M.sarhos_teker === null ? null : (M.sarhos_teker || {});
  const cc = card('Sarhoş teker', h('label', { class: 'chk' }, Object.assign(h('input', { type: 'checkbox' }), { checked: hasCaster, onchange: (e) => { M.sarhos_teker = e.target.checked ? { x_cm: -8, y_cm: 0, cap_cm: 1.6 } : null; saveProfiles(); rerender(); } }), 'Sarhoş teker var'));
  if (hasCaster) cc.append(h('div', { class: 'fields', style: 'margin-top:8px' }, fld(M.sarhos_teker, 'x_cm', 'x (cm)'), fld(M.sarhos_teker, 'y_cm', 'y (cm)'), fld(M.sarhos_teker, 'cap_cm', 'Bilye çapı (cm)')));
  root.append(cc);
  const mc = card('Motorlar ve pil', h('div', { class: 'fields' }, fld(Mo, 'model', 'Motor', { type: 'select', options: Object.fromEntries(Object.entries(MOTORS).map(([k, v]) => [k, v.ad])), def: 'TT 1:48 6V', after: rerender }), fld(M.pil, 'volt', 'Pil gerilimi (V)')));
  if (Mo.model === 'ozel') mc.append(h('div', { class: 'fields', style: 'margin-top:10px' }, fld(Mo, 'volt', 'Nominal gerilim (V)'), fld(Mo, 'rpm', 'Boşta devir (rpm)'), fld(Mo, 'tork_kgcm', 'Kilitlenme torku (kg·cm)'), fld(Mo, 'surtunme_kgcm', 'İç sürtünme (kg·cm)')));
  else { const mm = MOTORS[Mo.model]; if (mm) mc.append(h('p', { class: 'hint' }, `${mm.volt} V'ta ≈ ${mm.rpm} rpm, kilitlenme torku ≈ ${mm.tork} kg·cm (redüktör çıkışı, yaklaşık değer).`)); }
  root.append(mc);
  root.append(calibCard(p, M, rerender));
  const st = card('Acil stop butonu', h('label', { class: 'chk' }, Object.assign(h('input', { type: 'checkbox' }), { checked: !!M.acil_stop, onchange: (e) => { M.acil_stop = e.target.checked ? { x: 0, y: 0, z: 9 } : null; saveProfiles(); rerender(); } }), 'Var (kurallar gereği zorunlu)'));
  if (M.acil_stop) st.append(h('div', { class: 'fields', style: 'margin-top:8px' }, fld(M.acil_stop, 'x', 'x (cm)'), fld(M.acil_stop, 'y', 'y (cm)'), fld(M.acil_stop, 'z', 'Montaj yüksekliği (cm)')));
  root.append(st);
  // 3D model
  M.model3d = M.model3d || null; const md = M.model3d;
  const stlFile = h('input', { type: 'file', accept: '.stl,.obj,.glb,.gltf', hidden: true });
  stlFile.onchange = async () => { const f = stlFile.files[0]; if (!f) return; const buf = await f.arrayBuffer();
    try { const objs = SIM.parseModel(buf, f.name); if (!objs.length) throw new Error('modelde üçgen yok'); await idb.put(p.id, { buf, name: f.name });
      let bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const o of objs) for (let i = 0; i < o.pos.length; i += 3) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], o.pos[i + k]); bb[k + 3] = Math.max(bb[k + 3], o.pos[i + k]); } const ext = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]]; const isY = ext[1] < ext[2] * 0.85 && ext[1] <= ext[0]; const big = Math.max(...ext); const unit = big > 80 ? 1 : big > 8 ? 10 : 1000; const roller = {}; for (const o of objs) roller[o.name] = SIM.guessRole(o.name);
      M.model3d = Object.assign({ var: true, olcek_mm: unit, dx: isY ? 90 : 0, dy: 0, dz: 0, x_cm: 0, y_cm: 0, z_cm: 0, carpisma: false, kutulari_gizle: false, renk: '#9aa5b1' }, M.model3d || {}, { var: true, dosya: f.name, roller, dx: isY ? 90 : 0, olcek_mm: unit });
      saveProfiles(); await attachSTL(p); toast(`${f.name}: ${objs.length} parça okundu`); rerender(); } catch (e) { toast('Model okunamadı: ' + e.message); } };
  const mc3 = card('3D iskelet ve devre modeli', h('p', { class: 'hint' }, 'STL (tek parça), OBJ veya GLB (parça adlarıyla) yükleyebilirsin. Parça adları korunursa (ör. "Arduino Uno", "HC-SR04", "Sol teker") uygulama her parçanın ne olduğunu tahmin eder ve sensör, kart ve tekerlerin yerini modelden alır. Robotun önü +x, solu +y, yukarısı +z olmalı.'),
    h('div', { class: 'row' }, h('label', { class: 'btn sm' }, md && md.var ? 'Modeli değiştir' : 'Model yükle (STL/OBJ/GLB)', stlFile), md && md.var ? h('span', { class: 'hint' }, md.dosya) : null, md && md.var ? h('button', { class: 'btn sm danger', on: { click: async () => { M.model3d = null; await idb.del(p.id); p._stl = null; saveProfiles(); rerender(); } } }, 'Kaldır') : null));
  if (md && md.var) {
    const after = async () => { await attachSTL(p); rerender(); };
    mc3.append(h('div', { class: 'fields' }, fld(md, 'olcek_mm', 'Birim (1 = mm, 10 = cm, 1000 = m)', { after }), fld(md, 'dx', 'Döndür X°', { after }), fld(md, 'dy', 'Döndür Y°', { after }), fld(md, 'dz', 'Döndür Z°', { after }), fld(md, 'x_cm', 'Kaydır x (cm)', { after }), fld(md, 'y_cm', 'Kaydır y (cm)', { after }), fld(md, 'z_cm', 'Taban yüksekliği (cm)', { after }), fld(md, 'renk', 'Renk', { type: 'text', w: '90px' })),
      h('div', { class: 'row' }, fld(md, 'carpisma', 'Çarpışmada dış kabuğu kullan (3B)', { type: 'check' }), fld(md, 'kutulari_gizle', 'Kutuları gizle', { type: 'check' }), fld(md, 'seffaf', 'Yarı saydam', { type: 'check' })));
    if (p._stl) {
      const b = p._stl.bbox; mc3.append(h('p', { class: 'hint' }, `Model boyutu: ${((b[3] - b[0]) * 100).toFixed(1)} × ${((b[4] - b[1]) * 100).toFixed(1)} × ${((b[5] - b[2]) * 100).toFixed(1)} cm (uzunluk × genişlik × yükseklik). Değerler mantıksızsa birimi veya döndürmeyi değiştir.`));
      const objs = p._stl.objects || []; md.roller = md.roller || {};
      if (objs.length > 1) {
        const sens = ((p.devre || {}).sensorler || []);
        const roleOpts = { govde: 'Gövde (çarpışma kutusu)', gorsel: 'Sadece görsel', kart: 'Elektronik kart', teker: 'Teker', sarhos: 'Sarhoş teker', led: 'Köşe LED\'i', stop: 'Acil stop', yoksay: 'Yok say' };
        sens.forEach((s, i) => { roleOpts['sensor#' + i] = 'Sensör: ' + (s.ad || s.tip); });
        const resolve = (r) => { if (r && r.startsWith('sensor:')) { const t = r.slice(7); const used = new Set(Object.values(md.roller)); const i = sens.findIndex((s, k) => String(s.tip).toUpperCase() === t && !used.has('sensor#' + k)); return i >= 0 ? 'sensor#' + i : 'gorsel'; } return r || 'govde'; };
        for (const o of objs) md.roller[o.name] = resolve(md.roller[o.name]);
        const tb = h('tbody'); objs.forEach(o => { const sel = h('select', {}, ...Object.entries(roleOpts).map(([k, v]) => h('option', { value: k }, v))); sel.value = md.roller[o.name] in roleOpts ? md.roller[o.name] : 'govde'; sel.onchange = () => { md.roller[o.name] = sel.value; saveProfiles(); };
          const bb = o.bbox; tb.append(h('tr', {}, h('td', {}, o.name), h('td', {}, `${((bb[3] - bb[0]) * 100).toFixed(1)}×${((bb[4] - bb[1]) * 100).toFixed(1)}×${((bb[5] - bb[2]) * 100).toFixed(1)}`), h('td', {}, sel))); });
        const boxes = h('input', { type: 'checkbox' }); boxes.checked = true;
        mc3.append(h('h3', {}, `Modeldeki parçalar (${objs.length})`), h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Parça'), h('th', {}, 'Boyut (cm)'), h('th', {}, 'Bu nedir?'))), tb)),
          h('div', { class: 'row' }, h('label', { class: 'chk' }, boxes, 'Gövde çarpışma kutularını modelden oluştur'), h('button', { class: 'btn pri sm', on: { click: () => { const n = applyModel(p, boxes.checked); saveProfiles(); rerender(); toast(n + ' değer modelden alındı'); } } }, 'Yerleşimi modelden uygula')));
      }
    }
  }
  root.append(mc3);
  // Parçalar
  M.parcalar = M.parcalar || [];
  const cols = [['ad', 'Ad', 'text'], ['x', 'x'], ['y', 'y'], ['uzunluk', 'Uzunluk'], ['genislik', 'Genişlik'], ['z0', 'Alt z'], ['z1', 'Üst z'], ['renk', 'Renk', 'text']];
  const tb = h('tbody'); M.parcalar.forEach((pt, i) => tb.append(h('tr', {}, ...cols.map(([k, , t]) => { const inp = h('input', { type: t === 'text' ? 'text' : 'number', step: 'any' }); inp.value = pt[k] ?? ''; inp.onchange = () => { pt[k] = t === 'text' ? inp.value : num(inp.value); saveProfiles(); }; return h('td', {}, inp); }),
    h('td', {}, pt.servo_pin != null ? h('span', { class: 'hint', title: 'Servo ile döner' }, '⟳') : null, h('button', { class: 'btn sm danger', on: { click: () => { M.parcalar.splice(i, 1); saveProfiles(); rerender(); } } }, '×')))));
  const json = h('textarea', { class: 'short' }); json.value = JSON.stringify(M.parcalar, null, 1);
  root.append(card('Gövde parçaları (çarpışma kutuları, cm)', h('p', { class: 'hint' }, 'x = ileri, y = sola, merkez = robot ortası. Alt z ≥ 2 cm olan parçanın altından yumurta geçer, ≥ 8 cm olan duvarın üstünden geçer.'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...cols.map(c => h('th', {}, c[1])), h('th'))), tb)),
    h('div', { class: 'row' }, h('button', { class: 'btn sm', on: { click: () => { M.parcalar.push({ ad: 'Yeni parça', x: 0, y: 0, uzunluk: 5, genislik: 5, z0: 3, z1: 6, renk: '#94a3b8' }); saveProfiles(); rerender(); } } }, '+ Parça ekle')),
    h('details', {}, h('summary', {}, 'Gelişmiş: parçaları JSON olarak düzenle (servo ile dönen kapak vb.)'), h('p', { class: 'hint' }, 'Servo ile dönen parça: "servo_pin": 3, "pivot": [x, y], "aci_ofset": derece, "yon": 1 veya -1. "kati": false → sadece görsel. "sekil": "silindir".'), json,
      h('button', { class: 'btn sm', on: { click: () => { try { M.parcalar = JSON.parse(json.value); saveProfiles(); rerender(); toast('Parçalar güncellendi'); } catch (e) { toast('JSON hatası: ' + e.message); } } } }, 'Uygula'))));
}
function calibCard(p, M, rerender) {
  const K = M.kalibrasyon = M.kalibrasyon || {}; const O = K.olcum = K.olcum || { duz_pwm: 200, duz_sure: 1, duz_cm: null, don_pwm: 170, don_sure: 1, don_der: null };
  const fmtK = (k) => k ? `hız ×${(+k.hiz_carpani || 1).toFixed(2)}, dönüş direnci ${(+k.donus_direnci || 0).toFixed(2)}` : 'ayarsız';
  const cur = h('p', { class: 'hint' }); const showCur = () => { cur.textContent = `Şu anki ayar — 2B: ${fmtK(K['2B'])} · 3B: ${fmtK(K['3B'])}`; }; showCur();
  const out = h('div', { class: 'msg' }); const sk = h('textarea', { class: 'short', readonly: true, style: 'display:none;height:220px' });
  const real = () => ({ duz: { pwm: +O.duz_pwm || 200, sure: +O.duz_sure || 1, olcum: +O.duz_cm || 0 }, don: { pwm: +O.don_pwm || 170, sure: +O.don_sure || 1, olcum: Math.abs(+O.don_der || 0) } });
  const engines = () => [['2B', Match]].concat(Match3D ? [['3B', Match3D]] : []);
  const simRow = (name, MC, kal) => { const r = real(); const a = SIM.measureMotion(p, MC, { tip: 'duz', pwm: r.duz.pwm, sure: r.duz.sure }, kal || { hiz_carpani: 1, donus_direnci: 0 }); const b = SIM.measureMotion(p, MC, { tip: 'don', pwm: r.don.pwm, sure: r.don.sure }, kal || { hiz_carpani: 1, donus_direnci: 0 });
    const pct = (s, g) => g ? ` (gerçeğin %${Math.round(s / g * 100)}'i)` : ''; return `${name}: düz ${a.ileri_cm.toFixed(1)} cm${pct(a.ileri_cm, r.duz.olcum)}, dönüş ${Math.abs(b.aci_der).toFixed(0)}°${pct(Math.abs(b.aci_der), r.don.olcum)}`; };
  const busy = (fn) => { out.className = 'msg'; out.textContent = 'Hesaplanıyor…'; setTimeout(() => { try { fn(); } catch (e) { out.className = 'msg err'; out.textContent = 'Hata: ' + e.message; } }, 30); };
  return card('Gerçek robotla eşleştir (kalibrasyon)',
    h('p', { class: 'hint' }, 'Simülasyondaki robotun gerçeği kadar hızlı gidip dönmesi için: 1) "Ölçüm kodu"nu robota yükle. 2) Robot 1 sn düz gidip durur, sonra yerinde 1 sn sola döner. Gittiği mesafeyi (cm) ve döndüğü açıyı (derece, tam tur = 360) ölç. 3) Buraya yaz ve "Otomatik eşleştir"e bas. En iyi sonuç için yarışma zemininde (sunta) ve dolu pille ölç.'),
    h('div', { class: 'fields' }, fld(O, 'duz_pwm', 'Düz: PWM (0–255)'), fld(O, 'duz_sure', 'Süre (sn)'), fld(O, 'duz_cm', 'Gerçekte gittiği (cm)')),
    h('div', { class: 'fields', style: 'margin-top:8px' }, fld(O, 'don_pwm', 'Dönüş: PWM'), fld(O, 'don_sure', 'Süre (sn)'), fld(O, 'don_der', 'Gerçekte döndüğü (°)')),
    h('div', { class: 'row' },
      h('button', { class: 'btn sm', on: { click: () => { sk.value = SIM.calibSketch(p, real()); sk.style.display = sk.style.display === 'none' ? '' : 'none'; } } }, 'Ölçüm kodu'),
      h('button', { class: 'btn sm', on: { click: () => copyText(SIM.calibSketch(p, real())) } }, 'Ölçüm kodunu kopyala'),
      h('button', { class: 'btn sm', on: { click: () => busy(() => { out.className = 'msg'; out.textContent = engines().map(([n, MC]) => simRow(n, MC, K[n])).join('\n'); }) } }, 'Simülasyonda ölç'),
      h('button', { class: 'btn pri sm', on: { click: () => busy(() => { const r = real(); if (!r.duz.olcum && !r.don.olcum) { out.className = 'msg err'; out.textContent = 'Önce gerçek ölçümleri (cm ve derece) yaz.'; return; }
        const notes = new Set(); for (const [n, MC] of engines()) { const c = SIM.autoCalibrate(p, MC, r); K[n] = { hiz_carpani: c.hiz_carpani, donus_direnci: c.donus_direnci }; c.notlar.forEach(x => notes.add(x)); }
        saveProfiles(); showCur(); out.className = 'msg ok'; out.textContent = 'Eşleştirildi.\n' + engines().map(([n, MC]) => simRow(n, MC, K[n])).join('\n') + (notes.size ? '\n' + [...notes].join('\n') : '') + (Match3D ? '' : '\n(3B fizik yüklenince bir kez daha bas, 3B de eşleşsin.)'); }) } }, 'Otomatik eşleştir'),
      h('button', { class: 'btn sm', on: { click: () => { delete K['2B']; delete K['3B']; delete K.hiz_carpani; delete K.donus_direnci; saveProfiles(); rerender(); toast('Kalibrasyon sıfırlandı'); } } }, 'Sıfırla')),
    cur, out, sk);
}
function applyModel(p, makeBoxes) {
  const M = p.mekanik, D = p.devre = p.devre || {}, md = M.model3d, objs = (p._stl || {}).objects || []; let n = 0;
  const r1 = (v) => Math.round(v * 1000) / 10; const C = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]; const S = (b) => [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
  const by = (role) => objs.filter(o => (md.roller || {})[o.name] === role);
  const wheels = by('teker').sort((a, b) => C(b.bbox)[1] - C(a.bbox)[1]);
  if (wheels.length >= 2) { const L = wheels[0].bbox, R = wheels[wheels.length - 1].bbox, sL = S(L); M.tekerlek = Object.assign(M.tekerlek || {}, { cap_cm: r1(Math.max(sL[0], sL[2])), genislik_cm: r1(sL[1]), iz_cm: r1(C(L)[1] - C(R)[1]), x_cm: r1((C(L)[0] + C(R)[0]) / 2) }); n += 4; }
  const cs = by('sarhos')[0]; if (cs) { const s = S(cs.bbox), c = C(cs.bbox); M.sarhos_teker = { x_cm: r1(c[0]), y_cm: r1(c[1]), cap_cm: r1(Math.min(s[0], s[1], s[2])) }; n += 3; }
  (D.sensorler || []).forEach((s, i) => { const o = by('sensor#' + i)[0]; if (!o) return; const c = C(o.bbox); s.x = r1(c[0]); s.y = r1(c[1]); s.z = r1(c[2]); n += 3; });
  const karts = by('kart'); if (karts.length) { const old = D.yerlesim || []; D.yerlesim = karts.map(o => { const s = S(o.bbox), c = C(o.bbox); const prev = old.find(x => x.ad === o.name); return { ad: o.name, x: r1(c[0]), y: r1(c[1]), z: r1(o.bbox[2]), uzunluk: r1(s[0]), genislik: r1(s[1]), kalinlik: r1(s[2]), renk: (prev && prev.renk) || o.color || (/arduino|uno|nano|mega/i.test(o.name) ? '#0e7490' : /pil|batt|18650/i.test(o.name) ? '#1d4ed8' : '#b91c1c') }; }); n += karts.length; }
  const led = by('led')[0]; if (led && D.led) { const c = C(led.bbox); D.led.x = r1(c[0]); D.led.y = r1(c[1]); D.led.z = r1(led.bbox[5]); n += 3; }
  const st = by('stop')[0]; if (st) { const c = C(st.bbox); M.acil_stop = { x: r1(c[0]), y: r1(c[1]), z: r1(st.bbox[2]) }; n += 3; }
  if (makeBoxes) { const govde = by('govde'); if (govde.length) { const keep = (M.parcalar || []).filter(x => x.servo_pin != null);
    M.parcalar = govde.map(o => { const s = S(o.bbox), c = C(o.bbox); return { ad: o.name, x: r1(c[0]), y: r1(c[1]), uzunluk: r1(s[0]), genislik: r1(s[1]), z0: r1(o.bbox[2]), z1: r1(o.bbox[5]), renk: o.color || '#94a3b8' }; }).concat(keep); md.kutulari_gizle = true; n += govde.length; } }
  return n;
}
function calEditor(s, t) {
  const surf = { kirmizi: SIM.SURF.red, mavi: SIM.SURF.blue, yesil: SIM.SURF.green, beyaz: SIM.SURF.white, bos: SIM.SURF.none };
  s.kalibrasyon = s.kalibrasyon || {}; const K = s.kalibrasyon; const box = h('details', {}, h('summary', {}, 'Kalibrasyon — gerçek ölçümlerini gir'));
  if (t === 'TCS3200') {
    box.append(h('p', { class: 'hint' }, 'Gerçek robotta her rengi sensörün önüne koyup pulseIn(OUT, LOW) değerlerini yaz (kırmızı filtre S2=LOW S3=LOW, yeşil HIGH HIGH, mavi LOW HIGH). Girdiğin değerler simülasyonda modelin yerine kullanılır. Boş kutuda gri değer modelin tahmini.'));
    const formula = h('input', { type: 'text', placeholder: 'ör. b / r / g * 10000', style: 'width:200px' }); formula.value = s.formul || '';
    const out = h('div', { class: 'hint' });
    const calc = () => { s.formul = formula.value; saveProfiles(); if (!formula.value.trim()) { out.textContent = ''; return; } try { const fn = new Function('r', 'g', 'b', 'c', 'return (' + formula.value + ');');
      out.innerHTML = SIM.CAL_COLORS.map(([k, lab]) => { const a = (K[k] && K[k].slice(0, 3).every(v => v !== '' && v != null) ? K[k].map(Number) : SIM.Sensors.tcsModel(s, surf[k])); const v = fn(a[0], a[1], a[2], a[3] || 0); return `${lab}: <b>${isFinite(v) ? (+v).toFixed(1) : '—'}</b>`; }).join(' · '); } catch (e) { out.textContent = 'Formül hatası: ' + e.message; } };
    formula.oninput = calc;
    const tb = h('tbody'); for (const [k, lab] of SIM.CAL_COLORS) { const model = SIM.Sensors.tcsModel(s, surf[k]); K[k] = K[k] || ['', '', '', ''];
      tb.append(h('tr', {}, h('td', {}, lab), ...[0, 1, 2, 3].map(i => { const inp = h('input', { type: 'number', step: 'any', placeholder: String(model[i]) }); inp.value = K[k][i] ?? ''; inp.onchange = () => { K[k][i] = inp.value === '' ? '' : +inp.value; saveProfiles(); calc(); }; return h('td', {}, inp); }))); }
    box.append(h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Renk'), h('th', {}, 'Kırmızı (R)'), h('th', {}, 'Yeşil (G)'), h('th', {}, 'Mavi (B)'), h('th', {}, 'Filtresiz (C)'))), tb)),
      h('div', { class: 'row' }, h('label', { class: 'f' }, 'Kodundaki renk formülünü dene (r, g, b, c)', formula)), out,
      h('button', { class: 'btn sm danger', on: { click: () => { delete s.kalibrasyon; saveProfiles(); renderDevre(curProfile()); } } }, 'Ölçümleri temizle'));
    setTimeout(calc, 0);
  } else {
    box.append(h('p', { class: 'hint' }, 'analogRead değerlerini her yüzey için yaz; simülasyon bunları kullanır.'));
    const row = h('div', { class: 'fields' }); for (const [k, lab] of [['beyaz', 'Beyaz zemin'], ['kirmizi', 'Kırmızı'], ['mavi', 'Mavi'], ['yesil', 'Yeşil']]) row.append(fld(K, k, lab, { ph: String(surf[k].ir) }));
    box.append(row);
  }
  return box;
}
// ---------- DEVRE ----------
function renderDevre(p) {
  const root = $('secDevre'); root.innerHTML = ''; const D = p.devre = p.devre || {}; const rerender = () => renderDevre(p);
  D.surucu = D.surucu || { tip: 'L298N', sol: {}, sag: {} }; const S = D.surucu; S.sol = S.sol || {}; S.sag = S.sag || {};
  const tipKey = Object.keys(DRIVERS).find(k => k.toUpperCase() === String(S.tip || '').toUpperCase()) || 'L298N'; S.tip = tipKey; const dp = DRIVERS[tipKey].pins;
  const boardsHint = (p.kartlar || []).length > 1 ? `İki kart varsa pini "kartAdı:pin" yaz (ör. ${p.kartlar[0].id}:7).` : 'Pin: 7, A0 gibi.';
  root.append(card('Motor sürücüsü', h('div', { class: 'fields' }, fld(S, 'tip', 'Sürücü', { type: 'select', options: Object.fromEntries(Object.entries(DRIVERS).map(([k, v]) => [k, v.ad])), after: rerender }), DRIVERS[tipKey].stby ? pinFld(S, 'stby', 'STBY') : null),
    h('h3', {}, 'Sol motor'), h('div', { class: 'fields' }, ...dp.map(k => pinFld(S.sol, k, k.toUpperCase())), fld(S, 'sol_ters', 'Yönü ters', { type: 'check' })),
    h('h3', {}, 'Sağ motor'), h('div', { class: 'fields' }, ...dp.map(k => pinFld(S.sag, k, k.toUpperCase())), fld(S, 'sag_ters', 'Yönü ters', { type: 'check' })),
    h('p', { class: 'hint' }, boardsHint + (tipKey === 'L298N' || tipKey === 'L293D' ? ' EN boş bırakılırsa jumper takılı (tam hız) sayılır.' : ''))));
  D.led = D.led || { tip: 'iki_pin' }; const L = D.led;
  root.append(card('Köşe rengi LED\'i', h('div', { class: 'fields' }, fld(L, 'tip', 'Tip', { type: 'select', options: { iki_pin: 'Kırmızı + mavi LED (2 pin)', NeoPixel: 'NeoPixel şerit (1 pin)' }, after: rerender }),
    ...(L.tip === 'NeoPixel' ? [pinFld(L, 'pin', 'Veri pini')] : [pinFld(L, 'kirmizi_pin', 'Kırmızı pin'), pinFld(L, 'mavi_pin', 'Mavi pin')]), fld(L, 'x', 'x (cm)'), fld(L, 'y', 'y (cm)'), fld(L, 'z', 'z (cm)'))));
  // sensörler
  D.sensorler = D.sensorler || []; const list = h('div', { class: 'list' });
  D.sensorler.forEach((s, i) => {
    const t = String(s.tip || '').toUpperCase(); const def = SENSOR_TYPES[t] || SENSOR_TYPES.IR_ENGEL;
    const extra = [];
    if (t === 'IR_ENGEL') { extra.push(fld(s, 'menzil_cm', 'Menzil (cm)'), fld(s, 'ters', 'Algılayınca HIGH', { type: 'check' })); }
    if (t === 'TCRT5000') extra.push(fld(s, 'esik', 'Dijital eşik'));
    if (t === 'TCS3200') extra.push(fld(s, 'bakis', 'Bakış', { type: 'select', options: { asagi: 'Aşağı (zemin)', ileri: 'İleri (yumurta)' } }), fld(s, 'menzil_cm', 'Menzil (cm)'), fld(s, 'olcek', 'Ölçek % (S0/S1 yoksa)'));
    if (t === 'BUTON') extra.push(fld(s, 'deger', 'Değer', { type: 'select', options: { HIGH: 'Hep HIGH', LOW: 'Hep LOW', KIRMIZIDA_HIGH: 'Kırmızı köşede HIGH', MAVIDE_HIGH: 'Mavi köşede HIGH' } }));
    const calBox = (t === 'TCS3200' || t === 'TCRT5000') ? calEditor(s, t) : null;
    list.append(h('div', { class: 'item' }, h('div', { class: 'top' }, fld(s, 'tip', 'Tip', { type: 'select', options: Object.fromEntries(Object.entries(SENSOR_TYPES).map(([k, v]) => [k, v.ad])), after: rerender }), fld(s, 'ad', 'Ad', { type: 'text', w: '150px' }),
      h('button', { class: 'btn sm danger', style: 'margin-left:auto', on: { click: () => { D.sensorler.splice(i, 1); saveProfiles(); rerender(); } } }, 'Sil')),
      h('div', { class: 'fields' }, ...def.pins.map(k => pinFld(s, k, k === 'pin' ? 'Pin' : k === 'dijital_pin' ? 'Dijital pin' : k.toUpperCase())), ...(t === 'BUTON' ? [] : [fld(s, 'x', 'x'), fld(s, 'y', 'y'), fld(s, 'z', 'Yükseklik'), fld(s, 'aci', 'Açı°')]), ...extra), calBox));
  });
  const addSel = h('select', {}, ...Object.entries(SENSOR_TYPES).map(([k, v]) => h('option', { value: k }, v.ad)));
  root.append(card('Sensörler', h('p', { class: 'hint' }, 'Konum robot merkezine göre cm (x ileri, y sola). Açı: 0 = ileri, + = sola.'), list, h('div', { class: 'row' }, addSel, h('button', { class: 'btn sm', on: { click: () => { D.sensorler.push({ tip: addSel.value, ad: SENSOR_TYPES[addSel.value].ad, x: 8, y: 0, z: 2, aci: 0 }); saveProfiles(); rerender(); } } }, '+ Sensör ekle'))));
  // servolar
  D.servolar = D.servolar || []; const sl = h('div', { class: 'list' });
  D.servolar.forEach((s, i) => sl.append(h('div', { class: 'item' }, h('div', { class: 'fields' }, fld(s, 'ad', 'Ad', { type: 'text', w: '150px' }), pinFld(s, 'pin', 'Pin'), fld(s, 'baslangic_aci', 'Başlangıç açısı°'), fld(s, 'hiz_derece_s', 'Hız (°/sn)', { ph: '450' }), h('button', { class: 'btn sm danger', on: { click: () => { D.servolar.splice(i, 1); saveProfiles(); rerender(); } } }, 'Sil')))));
  root.append(card('Servolar', sl, h('p', { class: 'hint' }, 'Servonun döndürdüğü parçayı Mekanik → Gelişmiş JSON\'da "servo_pin" ile bağla.'), h('button', { class: 'btn sm', on: { click: () => { D.servolar.push({ ad: 'Servo', pin: null, baslangic_aci: 90, hiz_derece_s: 450 }); saveProfiles(); rerender(); } } }, '+ Servo ekle')));
  // kart yerleşimi
  D.yerlesim = D.yerlesim || []; const ycols = [['ad', 'Kart', 'text'], ['x', 'x'], ['y', 'y'], ['z', 'z'], ['uzunluk', 'Uzunluk'], ['genislik', 'Genişlik'], ['kalinlik', 'Kalınlık'], ['renk', 'Renk', 'text']];
  const ytb = h('tbody'); D.yerlesim.forEach((c, i) => ytb.append(h('tr', {}, ...ycols.map(([k, , t]) => { const inp = h('input', { type: t === 'text' ? 'text' : 'number', step: 'any' }); inp.value = c[k] ?? ''; inp.onchange = () => { c[k] = t === 'text' ? inp.value : num(inp.value); saveProfiles(); }; return h('td', {}, inp); }), h('td', {}, h('button', { class: 'btn sm danger', on: { click: () => { D.yerlesim.splice(i, 1); saveProfiles(); rerender(); } } }, '×')))));
  root.append(card('Kartların iskelet üzerindeki yeri', h('p', { class: 'hint' }, 'Arduino, sürücü, pil gibi kartlar 3B iskelette bu konumlarda durur; kablolar bunlardan çizilir ve çakışma kontrolü yapılır.'), h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...ycols.map(c => h('th', {}, c[1])), h('th'))), ytb)),
    h('button', { class: 'btn sm', on: { click: () => { D.yerlesim.push({ ad: 'Yeni kart', x: 0, y: 0, z: 8, uzunluk: 5, genislik: 4, kalinlik: 1.2, renk: '#0e7490' }); saveProfiles(); rerender(); } } }, '+ Kart ekle')));
  // Fritzing
  const nf = h('input', { type: 'file', accept: '.xml,.txt', hidden: true });
  nf.onchange = () => { const f = nf.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { D.netlist = SIM.parseNetlist(String(r.result)); D.netlist.dosya = f.name; saveProfiles(); rerender(); toast(`${D.netlist.baglantilar.length} Arduino pini okundu`); } catch (e) { toast('Netlist okunamadı: ' + e.message); } }; r.readAsText(f); };
  const nc = card('Fritzing şeması', h('p', { class: 'hint' }, 'Fritzing\'de: Dosya → Dışa Aktar → XML Netlist. O dosyayı buraya yükle; Kontrol sekmesi şemayı bu sayfadaki pinlerle karşılaştırır (yanlış/eksik kablo).'), h('div', { class: 'row' }, h('label', { class: 'btn sm' }, D.netlist ? 'Yeniden yükle' : 'XML Netlist yükle', nf), D.netlist ? h('span', { class: 'hint' }, D.netlist.dosya || '') : null, D.netlist ? h('button', { class: 'btn sm danger', on: { click: () => { delete D.netlist; saveProfiles(); rerender(); } } }, 'Kaldır') : null));
  if (D.netlist) nc.append(h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Arduino pini'), h('th', {}, 'Şemada bağlı olan'))), h('tbody', {}, ...D.netlist.baglantilar.map(c => h('tr', {}, h('td', {}, c.pin), h('td', {}, c.parcalar.join(', ') || '—')))))));
  root.append(nc);
}

// =====================================================================================
//                                  KONTROL
// =====================================================================================
$('bCheck').onclick = async () => {
  const p = byId($('selCheck').value); if (!p) return; const team = $('selCheckTeam').value; if (p._stl === undefined) await attachSTL(p);
  $('bCheck').disabled = true; $('prog').style.display = ''; const bar = $('prog').firstElementChild; bar.style.width = '0';
  const st = SIM.staticChecks(p); const tr = await SIM.runTrial(p, MatchClass, { sure: 15, team, saha: { tohum: seed }, kural: $('sKural').value, yesil_kose: $('sYesil').value, gercek: gercek(), onProgress: f => { bar.style.width = (f * 100).toFixed(0) + '%'; } });
  $('bCheck').disabled = false; $('prog').style.display = 'none';
  const all = st.items.concat(tr.items); const order = ['Kod', 'Kod-Devre', 'Hareket', 'Kurallar', 'Mekanik', 'Devre'];
  const titles = { Kod: 'Kod', 'Kod-Devre': 'Kod ↔ devre uyumu', Hareket: '15 saniyelik deneme', Kurallar: 'Yarışma kuralları', Mekanik: 'Mekanik', Devre: 'Devre' };
  const sym = { ok: '✓', warn: '!', err: '✕', info: 'i' }; const rank = { err: 0, warn: 1, info: 2, ok: 3 };
  const nErr = all.filter(x => x.level === 'err').length, nWarn = all.filter(x => x.level === 'warn').length;
  let html = `<div class="card"><h2>${esc(p.ad)} — ${nErr ? `<span class="bad">${nErr} hata</span>` : 'hata yok'}, ${nWarn} uyarı</h2><p class="hint">Hatalar gerçek robotta büyük ihtimalle sorun çıkarır; uyarılar kontrol edilmeli; i = bilgi.</p></div>`;
  for (const cat of order) { const items = all.filter(x => x.cat === cat).sort((a, b) => rank[a.level] - rank[b.level]); if (!items.length) continue;
    html += `<div class="card report"><h2>${titles[cat]}</h2>`; if (cat === 'Hareket' && tr.path.length > 1) html += pathSvg(tr);
    html += `<ul>${items.map(i => `<li><span class="ic ${i.level}">${sym[i.level]}</span><span>${esc(i.txt)}</span></li>`).join('')}</ul></div>`; }
  html += `<div class="card"><button class="btn pri" id="bWatch">Sahada izle</button> <button class="btn" id="bCopyRep">Raporu kopyala</button> <span class="hint">Bu robotu ${team === 'red' ? 'kırmızı' : 'mavi'} köşeye koyup maçı başlatır.</span></div>`;
  $('report').innerHTML = html;
  const repTxt = `${p.ad} — kontrol raporu (${nErr} hata, ${nWarn} uyarı)\n` + order.map(cat => { const it = all.filter(x => x.cat === cat).sort((a, b) => rank[a.level] - rank[b.level]); return it.length ? `\n## ${titles[cat]}\n` + it.map(i => `[${sym[i.level]}] ${i.txt}`).join('\n') : ''; }).join('') + '\n';
  $('bCopyRep').onclick = () => copyText(repTxt);
  $('bWatch').onclick = () => { $(team === 'red' ? 'selRed' : 'selBlue').value = p.id; setTab('saha'); startRun(); };
};
function pathSvg(tr) {
  const F = RULES.FIELD, Z = RULES.ZONE, col = tr.match.field.colors; const pts = tr.path.map(([x, y]) => `${(x * 100).toFixed(1)},${((F - y) * 100).toFixed(1)}`).join(' ');
  const eggs = tr.match.eggs.map(e => e.gone ? '' : `<circle cx="${(e.x * 100).toFixed(1)}" cy="${((F - e.y) * 100).toFixed(1)}" r="2.4" fill="${e.kind === 'red' ? col.kirmizi : e.kind === 'blue' ? col.mavi : e.kind === 'green' ? col.yesil : '#7a3a6a'}"/>`).join('');
  const s = tr.path[0], e = tr.path[tr.path.length - 1];
  return `<svg class="pathsvg" viewBox="-3 -3 256 256" role="img" aria-label="Robotun 15 saniyelik yolu"><rect x="0" y="0" width="250" height="250" fill="${col.zemin}" stroke="#cfd5dd"/>${tr.match.zones.map(z => `<rect x="${z.x0 * 100}" y="${(F - z.y1) * 100}" width="${(z.x1 - z.x0) * 100}" height="${(z.y1 - z.y0) * 100}" fill="${z.kind === 'red' ? col.kirmizi : z.kind === 'blue' ? col.mavi : col.yesil}"/>`).join('')}${eggs}<polyline points="${pts}" fill="none" stroke="#e67e00" stroke-width="2"/><circle cx="${s[0] * 100}" cy="${(F - s[1]) * 100}" r="4" fill="#16a34a"/><circle cx="${e[0] * 100}" cy="${(F - e[1]) * 100}" r="4" fill="#1d2430"/></svg><p class="hint">Yeşil: başlangıç, siyah: 15. saniye. Turuncu çizgi robotun izlediği yol.</p>`;
}

// ---------- Arıza testi ----------
function fillCut() { const p = byId($('selCheck').value); if (!p) return; let rb; try { rb = new SIM.Robot(p, 'red', { robots: [], eggs: [], zoneOf: () => null }); } catch (e) { return; } const seen = new Set();
  $('selCut').innerHTML = rb.hardwarePins().filter(h => h.kind !== 'link' && !seen.has(h.key) && seen.add(h.key)).map(h => `<option value="${h.key}">${esc(h.role)} — ${esc(keyLabel(h.key, rb.boards))}</option>`).join(''); }
$('selCheck').addEventListener('change', fillCut);
$('bCut').onclick = async () => {
  const p = byId($('selCheck').value); const key = +$('selCut').value; if (!p || isNaN(key)) return; const team = $('selCheckTeam').value; if (p._stl === undefined) await attachSTL(p);
  $('bCut').disabled = true; $('cutOut').innerHTML = '<p class="hint">Çalışıyor…</p>';
  const base = { sure: 15, team, saha: { tohum: seed }, kural: $('sKural').value, yesil_kose: $('sYesil').value };
  const a = await SIM.runTrial(p, MatchClass, Object.assign({ gercek: gercek() }, base));
  const g = gercek(); g.kesik = { [team]: [key] }; const b = await SIM.runTrial(p, MatchClass, Object.assign({ gercek: g }, base));
  $('bCut').disabled = false; const pick = (r) => r.items.filter(i => i.cat === 'Hareket').map(i => i.txt);
  const dist = (r) => { let d = 0; for (let i = 1; i < r.path.length; i++) d += Math.hypot(r.path[i][0] - r.path[i - 1][0], r.path[i][1] - r.path[i - 1][1]); return d; };
  const da = dist(a), db = dist(b); const verdict = db < da * 0.3 ? 'Robot bu kablo kopunca neredeyse duruyor.' : Math.abs(db - da) / Math.max(da, 0.01) < 0.15 ? 'Hareket mesafesi pek değişmiyor; ama davranış farklı olabilir, aşağıya bak.' : 'Robotun hareketi belirgin şekilde değişiyor.';
  $('cutOut').innerHTML = `<p><b>${esc($('selCut').selectedOptions[0].textContent)}</b> kopukken: ${verdict}</p><div class="fields" style="align-items:flex-start"><div style="flex:1 1 260px"><h3>Normal</h3>${pathSvg(a)}<ul>${pick(a).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div style="flex:1 1 260px"><h3>Kablo kopuk</h3>${pathSvg(b)}<ul>${pick(b).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
};
// ---------- Toplu maç ----------
let batchStop = false;
$('bBatch').onclick = async () => {
  if ($('bBatch').dataset.run) { batchStop = true; return; }
  const A = byId($('selBatchA').value), B = byId($('selBatchB').value), N = +$('selBatchN').value; if (!A || !B) return;
  for (const p of [A, B]) if (p._stl === undefined) await attachSTL(p);
  $('bBatch').dataset.run = 1; $('bBatch').textContent = 'Durdur'; batchStop = false; const bar = $('progB').firstElementChild; $('progB').style.display = '';
  const rows = []; const kural = $('sKural').value, yk = $('sYesil').value;
  for (let i = 0; i < N && !batchStop; i++) {
    const aRed = i % 2 === 0, sd = 1000 + Math.floor(Math.random() * 1e6);
    const m = new Match({ profiles: aRed ? { red: A, blue: B } : { red: B, blue: A }, saha: { tohum: sd }, kural, yesil_kose: yk, gercek: gercek() }); const errs = m.compileAll();
    await new Promise(res => { const run = () => { const t0 = performance.now(); while (m.time < m.matchTime && performance.now() - t0 < 30) m.step(m.dt); bar.style.width = (((i + m.time / m.matchTime) / N) * 100).toFixed(1) + '%'; if (m.time < m.matchTime && !batchStop) setTimeout(run, 0); else res(); }; run(); });
    const r = m.result(), tA = aRed ? 'red' : 'blue', tB = aRed ? 'blue' : 'red';
    rows.push({ i: i + 1, sd, aRed, sA: r.sc[tA], sB: r.sc[tB], ownA: r.sc.detail[tA].own, ownB: r.sc.detail[tB].own, gA: r.sc.detail[tA].green, w: r.winner === tA ? 'A' : r.winner === tB ? 'B' : '-', reason: r.reason, errs: errs.length });
    renderBatch(A, B, rows, N);
  }
  delete $('bBatch').dataset.run; $('bBatch').textContent = 'Simülasyonu başlat'; $('progB').style.display = 'none';
};
function renderBatch(A, B, rows, N) {
  const n = rows.length, wa = rows.filter(r => r.w === 'A').length, wb = rows.filter(r => r.w === 'B').length, avg = (k) => (rows.reduce((s, r) => s + r[k], 0) / n).toFixed(1);
  const errNote = rows.some(r => r.errs) ? '<p class="msg err" style="display:block">Robotlardan birinin kodu derlenemedi; o robot hareket etmeden oynadı.</p>' : '';
  $('batchOut').innerHTML = `${errNote}<div class="stats"><div class="stat"><div class="k">${esc(A.ad)} kazandı</div><div class="v">${wa} / ${n} (%${(wa / n * 100).toFixed(0)})</div></div><div class="stat"><div class="k">${esc(B.ad)} kazandı</div><div class="v">${wb} / ${n}</div></div><div class="stat"><div class="k">Kazanan yok</div><div class="v">${n - wa - wb}</div></div>
    <div class="stat"><div class="k">Ort. puan ${esc(A.ad)}</div><div class="v">${avg('sA')}</div></div><div class="stat"><div class="k">Ort. puan ${esc(B.ad)}</div><div class="v">${avg('sB')}</div></div><div class="stat"><div class="k">Ort. kendi rengi (${esc(A.ad)})</div><div class="v">${avg('ownA')}</div></div></div>
    <div class="scroll" style="margin-top:10px"><table><thead><tr><th>#</th><th>${esc(A.ad)} köşe</th><th>Puan A</th><th>Puan B</th><th>Kazanan</th><th>Neden</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.i}</td><td>${r.aRed ? 'Kırmızı' : 'Mavi'}</td><td>${r.sA}</td><td>${r.sB}</td><td>${r.w === 'A' ? esc(A.ad) : r.w === 'B' ? esc(B.ad) : '—'}</td><td>${esc(r.reason)}</td><td><button class="btn sm" data-watch="${r.i}">İzle</button></td></tr>`).join('')}</tbody></table></div>`;
  $('batchOut').querySelectorAll('[data-watch]').forEach(b => b.onclick = () => { const r = rows[+b.dataset.watch - 1]; seed = r.sd; $('selRed').value = r.aRed ? A.id : B.id; $('selBlue').value = r.aRed ? B.id : A.id; setTab('saha'); startRun(); toast('Bu maç aynı yumurta dizilimi ve aynı sensör gürültüsüyle yeniden oynatılıyor (2B fizikte birebir aynı olur)'); });
}

// =====================================================================================
//                                  BAŞLANGIÇ
// =====================================================================================
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), ms))]); }
async function tryImport(urls) { let err; for (const u of urls) { try { return await withTimeout(import(u), 15000); } catch (e) { err = e; } } throw err; }
async function loadLibs() {
  const THREE = await tryImport(['./lib/three.module.js', 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', 'https://unpkg.com/three@0.160.0/build/three.module.js']);
  const Rm = await tryImport(['./lib/rapier.es.js', 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier.es.js', 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm']);
  const RAPIER = Rm.default && Rm.default.init ? Rm.default : Rm; await RAPIER.init(); return { THREE, RAPIER };
}
async function setEngine(mode) {
  running = false; $('bPause').textContent = '▶ Başlat'; use3d = mode === '3d' && !!libs; $('sEngine').value = use3d ? '3d' : '2d'; LS.set('mebsim3_motor', $('sEngine').value);
  MatchClass = use3d ? Match3D : Match; $('v3').style.display = use3d ? 'block' : 'none'; cv.style.display = use3d ? 'none' : 'block'; $('camWrap').style.display = use3d ? '' : 'none'; $('qWrap').style.display = use3d ? '' : 'none';
  await buildMatch(); if (use3d) { view3d.resize(); view3d.setMode($('sCam').value); view3d.focus = focusRobot(); }
}
$('sEngine').onchange = () => { if ($('sEngine').value === '3d' && !libs) { toast('3B motor yüklenemedi'); $('sEngine').value = '2d'; return; } setEngine($('sEngine').value); };
setInterval(() => { if (dirty && !running && match && tab !== 'robotlar') buildMatch(); }, 800);
(async () => {
  fillProfileSelects(); fillCut(); resize2d(); $('camWrap').style.display = 'none'; await buildMatch(); requestAnimationFrame(frame);
  $('ovl').textContent = '3B fizik motoru yükleniyor…';
  try {
    libs = await loadLibs(); Match3D = makeMatch3D(libs.RAPIER); view3d = makeView3D(libs.THREE, $('v3')); $('sQual').value = LS.get('mebsim3_grafik') || 'yuksek'; if ($('sQual').value !== 'yuksek') view3d.setQuality($('sQual').value);
    view3d.onPick = (e) => { const p = view3d.pick(e); const rb = pickRobot(p); if (!rb) return false; drag = { rb, dx: rb.state.x - p[0], dy: rb.state.y - p[1] }; e.target.setPointerCapture(e.pointerId); return true; };
    view3d.onDrag = (e) => { if (!drag) return false; dragMove(view3d.pick(e)); return true; };
    view3d.renderer.domElement.addEventListener('pointerup', () => { if (drag) { drag = null; buildMatch(); } });
    await setEngine(LS.get('mebsim3_motor') || '3d');
  } catch (err) { console.warn(err); $('sEngine').querySelector('option[value="3d"]').textContent = '3B (yüklenemedi)'; $('sEngine').value = '2d'; toast('3B motor yüklenemedi, 2B ile devam'); }
})();
})();
