// Paylaşılan gürültü üreteci: her maç adımında o maçın tohumlu üretecine bağlanır (tekrarlanabilir maçlar)
let RNG = Math.random;

function trError(msg) {
  let m;
  if ((m = msg.match(/Identifier '(\w+)' has already been declared/))) return `'${m[1]}' adı iki kez tanımlanmış. Arduino derleyicisi de bu yüzden hata verir (ör. aynı isimde hem Servo hem değişken).`;
  if ((m = msg.match(/(\w+) is not defined/))) return `'${m[1]}' tanımlı değil — yazım hatası, eksik #define ya da simülatörün desteklemediği bir kütüphane olabilir.`;
  if ((m = msg.match(/(\S+) is not a function/))) return `'${m[1]}' fonksiyon olarak çağrılamıyor (desteklenmeyen kütüphane fonksiyonu olabilir).`;
  if (/Unexpected token|Unexpected identifier|missing \)|Unexpected end/.test(msg)) return `Söz dizimi hatası: eksik/fazla parantez, süslü parantez veya noktalı virgül olabilir. (${msg})`;
  if (/Cannot read propert/.test(msg)) return `Tanımsız bir değere erişildi — dizi sınırının dışına çıkılmış olabilir. (${msg})`;
  if (/Maximum call stack/.test(msg)) return 'Sonsuz özyineleme: bir fonksiyon kendini durmadan çağırıyor.';
  return msg;
}
function errLine(e) { const m = String(e && e.stack || '').match(/<anonymous>:(\d+):(\d+)/); return m ? (+m[1] - 2) : null; }

// =====================================================================================
//                                  YÜZEY / RENK MODELİ
// =====================================================================================
const SURF = {
  white: { ir: 90, rgb: [0.92, 0.92, 0.90], name: 'beyaz' },
  red: { ir: 320, rgb: [0.62, 0.07, 0.08], name: 'kırmızı' },
  blue: { ir: 650, rgb: [0.07, 0.13, 0.38], name: 'mavi' },
  green: { ir: 420, rgb: [0.10, 0.42, 0.17], name: 'yeşil' },
  robot: { ir: 760, rgb: [0.25, 0.25, 0.27], name: 'robot' },
  none: { ir: 1010, rgb: [0, 0, 0], name: 'boş' },
};

// =====================================================================================
//                                  ARDUINO ÇALIŞMA ZAMANI (kart başına)
// =====================================================================================
class Runtime {
  constructor(match, robot, bi) {
    this.match = match; this.robot = robot; this.bi = bi; this.base = bi * 100;
    this.board = robot.boards[bi]; this.B = boardOf(this.board.tip);
    this.t = 0; this.pins = {}; this.servoT = {}; this.gen = null; this.phase = 'setup'; this.error = null;
    this.ultraState = {}; this.serialBuf = ''; this.serialOn = false; this.rand = mulberry32(1234 + bi + (((match && match.field && match.field.seed) | 0) * 31));
    this.ops = new Map(); this.warned = new Set(); this.servoAttached = false; this.neo = {}; this.loopStats = { n: 0, sum: 0, max: 0, last: 0, setup: 0 };
  }
  track(key, op) { let s = this.ops.get(key); if (!s) this.ops.set(key, s = new Set()); s.add(op); }
  warnOnce(code, msg) { if (this.warned.has(code)) return; this.warned.add(code); this.robot.warnings.push({ board: this.board.id, msg }); this.out('⚠ ' + msg); }
  out(txt) { const o = this.robot.serial; o.push({ t: this.t, b: this.board.id, txt }); if (o.length > 3000) o.splice(0, 500); if (this.match.onSerial) this.match.onSerial(this.robot); }
  print(s) { this.serialBuf += s; let k; while ((k = this.serialBuf.indexOf('\n')) >= 0) { this.out(this.serialBuf.slice(0, k)); this.serialBuf = this.serialBuf.slice(k + 1); } }
  runUntil(simTime) {
    if (!this.prog || this.error) return; let guard = 0;
    try {
      while (this.t <= simTime && guard++ < 200000) {
        if (!this.gen) { this.inSetup = this.phase === 'setup'; this.gen = this.inSetup ? this.prog.setup() : this.prog.loop(); this.phase = 'loop'; this.loopStart = this.t; this.t += 3e-6; }
        const r = this.gen.next();
        if (r.done) { this.gen = null; const dur = this.t - this.loopStart; const L = this.loopStats; if (this.inSetup) L.setup = dur; else { L.n++; L.sum += dur; L.max = Math.max(L.max, dur); L.last = dur; } continue; }
        if (typeof r.value === 'number' && r.value > 0) this.t += r.value;
      }
    } catch (e) { this.error = e; const ln = errLine(e); this.out(`✖ Çalışma hatası${ln ? ' (satır ~' + ln + ')' : ''}: ${trError(e.message)}`); }
  }
  api() {
    const rt = this, rb = this.robot, m = this.match, B = this.B, board = this.board;
    const SP = String.prototype; const def = (k, f) => { if (!SP[k]) Object.defineProperty(SP, k, { value: f, configurable: true, writable: true }); };
    def('toInt', function () { return parseInt(this, 10) || 0; }); def('toFloat', function () { return parseFloat(this) || 0; }); def('equals', function (o) { return String(this) === String(o); }); def('equalsIgnoreCase', function (o) { return String(this).toLowerCase() === String(o).toLowerCase(); }); def('remove', function (i, n) { return this.slice(0, i) + (n === undefined ? '' : this.slice(i + n)); });
    const P = (p) => {
      let n = typeof p === 'number' ? p : boardPinNum(p, board.tip);
      if (n == null || !isFinite(n)) throw new Error('Geçersiz pin: ' + p);
      n = Math.trunc(n);
      if (!B.digital.includes(n) && !B.analog.includes(n)) rt.warnOnce('nopin' + n, `${B.ad} kartında ${n} numaralı pin yok (kod bu pini kullanıyor).`);
      if ((n === 0 || n === 1) && rt.serialOn) rt.warnOnce('serialpin', `D0/D1 pinleri Serial (USB) ile ortak; Serial açıkken bu pinleri kullanmak hatalı çalışmaya yol açar.`);
      return rt.base + n;
    };
    const cost = (s) => { rt.t += s; };
    const st = (k) => rt.pins[k] || (rt.pins[k] = { v: 0, pwm: null, mode: 0 });
    const fmt = (v, a) => {
      if (typeof v === 'boolean') return v ? '1' : '0';
      if (typeof v === 'number') { if (a === undefined) return Number.isInteger(v) ? String(v) : v.toFixed(2); if (Number.isInteger(v) && [2, 8, 10, 16].includes(a)) return (v >>> 0).toString(a).toUpperCase(); return v.toFixed(a); }
      return String(v);
    };
    class Servo {
      constructor() { this.key = null; this.a = 90; }
      attach(p) { this.key = P(p); rt.servoAttached = true; rt.track(this.key, 'servo'); if (!rb.servos.some(s => s.pin === this.key)) rt.warnOnce('srv' + this.key, `Servo ${keyLabel(this.key, rb.boards)} pinine bağlandı ama devrede bu pinde servo yok.`); }
      write(a) { a = clamp(+a, 0, 180); this.a = a; if (this.key != null) rt.servoT[this.key] = a; cost(5e-6); }
      writeMicroseconds(us) { this.write((clamp(us, 544, 2400) - 544) / (2400 - 544) * 180); }
      read() { return Math.round(this.a); } attached() { return this.key != null; } detach() { if (this.key != null) delete rt.servoT[this.key]; this.key = null; }
    }
    class NewPing {
      constructor(trig, echo, max = 500) { this.trig = P(trig); this.echo = P(echo); this.max = max; rt.track(this.trig, 'ping'); rt.track(this.echo, 'ping'); }
      *ping(max) { const s = rb.sensors.find(x => x.type === 'HC-SR04' && x.trig === this.trig); const mm = max || this.max;
        if (!s) { yield 0.03; return 0; } const d = Sensors.ultrasonic(m, rb, s); const cm = d == null ? null : d * 100;
        if (cm == null || cm > mm) { yield 0.03; return 0; } const us = cm * 57; yield (us / 1e6 + 0.0005); return Math.round(us); }
      *ping_cm(max) { const us = yield* this.ping(max); return Math.round(us / 57); }
      *ping_in(max) { const us = yield* this.ping(max); return Math.round(us / 146); }
      *ping_median(it = 5, max) { const a = []; for (let i = 0; i < it; i++) { a.push(yield* this.ping(max)); yield 0.029; } a.sort((x, y) => x - y); return a[a.length >> 1]; }
      convert_cm(us) { return Math.round(us / 57); }
    }
    class Adafruit_NeoPixel {
      constructor(n, pin) { this.n = n | 0; this.key = P(pin); this.px = new Array(this.n).fill(0); this.br = 255; rt.track(this.key, 'neopixel'); }
      begin() { } show() { rt.neo[this.key] = this.px.map(c => c); cost(30e-6 * this.n); }
      setPixelColor(i, r, g, b) { if (i < 0 || i >= this.n) return; this.px[i] = g === undefined ? r >>> 0 : ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
      Color(r, g, b) { return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
      getPixelColor(i) { return this.px[i] || 0; } setBrightness(b) { this.br = b; } clear() { this.px.fill(0); } numPixels() { return this.n; } fill(c) { this.px.fill(c >>> 0); }
    }
    const api = {
      HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13, true: true, false: false,
      PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI,
      DEC: 10, HEX: 16, OCT: 8, BIN: 2, NULL: 0, nullptr: 0, MSBFIRST: 1, LSBFIRST: 0, CHANGE: 1, RISING: 3, FALLING: 2,
      NEO_GRB: 0x52, NEO_RGB: 0x06, NEO_RGBW: 0x1B, NEO_KHZ800: 0, NEO_KHZ400: 0x100,
      __CLS_Servo: Servo, __CLS_NewPing: NewPing, __CLS_Adafruit_NeoPixel: Adafruit_NeoPixel,
      __b() { rt.t += 5e-6; return rt.t > m.time; },
      __i(v) { return (typeof v === 'number' && isFinite(v)) ? Math.trunc(v) : v; },
      __idiv(a, b) { if (typeof a !== 'number' || typeof b !== 'number') return a / b; if (b === 0) { rt.warnOnce('div0', 'Sıfıra bölme: Arduino çökmez ama sonuç anlamsız olur (−1 ya da rastgele).'); return -1; } return Math.trunc(a / b); },
      __wi(v) { if (typeof v !== 'number' || !isFinite(v)) return v; const x = Math.trunc(v); if (x >= -32768 && x <= 32767) return x; const w = ((x + 32768) % 65536 + 65536) % 65536 - 32768; rt.warnOnce('ovf_int', `int taşması: ${x} değeri int'e (−32768…32767) sığmıyor, Arduino'da ${w} olur. Büyük sayılar ve millis() için long ya da unsigned long kullan.`); return w; },
      __wu(v) { if (typeof v !== 'number' || !isFinite(v)) return v; const x = Math.trunc(v); if (x >= 0 && x <= 65535) return x; const w = ((x % 65536) + 65536) % 65536; rt.warnOnce('ovf_uint', `unsigned int taşması: ${x} → Arduino'da ${w} olur (0…65535).`); return w; },
      __wl(v) { if (typeof v !== 'number' || !isFinite(v)) return v; const x = Math.trunc(v); return x >= -2147483648 && x <= 2147483647 ? x : (x | 0); },
      __wul(v) { if (typeof v !== 'number' || !isFinite(v)) return v; const x = Math.trunc(v); return x >= 0 && x <= 4294967295 ? x : (x >>> 0); },
      __wb(v) { if (typeof v !== 'number' || !isFinite(v)) return v; const x = Math.trunc(v); if (x >= 0 && x <= 255) return x; const w = ((x % 256) + 256) % 256; rt.warnOnce('ovf_byte', `byte taşması: ${x} → Arduino'da ${w} olur (0…255).`); return w; },
      __arr(...d) { const mk = (k) => k >= d.length - 1 ? new Array(+d[k]).fill(0) : Array.from({ length: +d[k] }, () => mk(k + 1)); return mk(0); },
      strlen: (s) => String(s ?? '').length, strcmp: (a, b) => { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }, strncmp: (a, b, n) => { a = String(a).slice(0, n); b = String(b).slice(0, n); return a < b ? -1 : a > b ? 1 : 0; },
      atoi: (s) => parseInt(s, 10) || 0, atol: (s) => parseInt(s, 10) || 0, atof: (s) => parseFloat(s) || 0,
      isDigit: (c) => /^[0-9]$/.test(String.fromCharCode(typeof c === 'number' ? c : 0) || '') || /^[0-9]$/.test(c), isAlpha: (c) => /^[A-Za-z]$/.test(typeof c === 'number' ? String.fromCharCode(c) : c), isSpace: (c) => /^\s$/.test(typeof c === 'number' ? String.fromCharCode(c) : c),
      toupper: (c) => typeof c === 'number' ? String.fromCharCode(c).toUpperCase().charCodeAt(0) : String(c).toUpperCase(), tolower: (c) => typeof c === 'number' ? String.fromCharCode(c).toLowerCase().charCodeAt(0) : String(c).toLowerCase(),
      radians: (d) => d * Math.PI / 180, degrees: (r) => r * 180 / Math.PI, analogReference() { }, DEFAULT: 1, INTERNAL: 3, EXTERNAL: 0,
      memset(a, v) { if (Array.isArray(a)) a.fill(v); return a; },
      EEPROM: (() => { const mem = new Array(1024).fill(255); return { read: (i) => mem[i] ?? 255, write: (i, v) => { mem[i] = v & 255; }, update: (i, v) => { mem[i] = v & 255; }, length: () => mem.length, get(i, v) { return mem['o' + i] !== undefined ? mem['o' + i] : v; }, put(i, v) { mem['o' + i] = v; return v; } }; })(),
      sizeof(x) { return Array.isArray(x) ? x.length : (typeof x === 'string' ? x.length : 1); },
      F(s) { return s; },
      pinMode(p, md) { const k = P(p); const s = st(k); s.mode = md === 2 ? 0 : md; s.pull = md === 2; rt.track(k, md === 1 ? 'pinMode:OUTPUT' : 'pinMode:INPUT'); cost(3e-6); },
      digitalWrite(p, v) {
        const k = P(p); const s = st(k); const nv = v ? 1 : 0; rt.track(k, 'digitalWrite');
        const us = rb.sensors.find(x => x.type === 'HC-SR04' && x.trig === k);
        if (us) { const u = rt.ultraState[k] || (rt.ultraState[k] = {}); if (!nv && s.v) { u.armed = true; u.at = rt.t; } }
        if (s.mode !== 1 && s.pwm == null) { s.pull = !!nv; rt.warnOnce('nomode' + k, `${keyLabel(k, rb.boards)} pinine pinMode(OUTPUT) yapılmadan digitalWrite yapılıyor; gerçek kartta pin sürülmez (sadece iç direnç açılır).`); }
        s.v = nv; s.pwm = null; cost(4e-6);
      },
      analogWrite(p, v) {
        const k = P(p), n = k - rt.base; const s = st(k); v = clamp(Math.round(+v || 0), 0, 255); rt.track(k, 'analogWrite'); s.mode = 1; cost(5e-6);
        if (!B.pwm.includes(n)) { rt.warnOnce('nopwm' + k, `${keyLabel(k, rb.boards)} PWM destekli değil: analogWrite(${v}) gerçekte ${v < 128 ? 'LOW' : 'HIGH'} gibi davranır (hız ayarı çalışmaz).`); s.v = v < 128 ? 0 : 1; s.pwm = null; s.raw = v; return; }
        if (rt.servoAttached && B.servoTimer.includes(n)) { rt.warnOnce('srvpwm' + k, `Servo kütüphanesi ${B.ad} kartında ${B.servoTimer.map(x => 'D' + x).join(', ')} pinlerinde PWM'i bozar; ${keyLabel(k, rb.boards)} üzerindeki analogWrite düzgün çalışmaz.`); s.v = v < 128 ? 0 : 1; s.pwm = null; s.raw = v; return; }
        s.pwm = v / 255; s.v = v > 127 ? 1 : 0; s.raw = v;
      },
      digitalRead(p) { const k = P(p); cost(4e-6); rt.track(k, 'digitalRead'); return rb.readDigital(k, rt); },
      analogRead(p) {
        let k = P(p); let n = k - rt.base; if (n < B.nA) { n += B.A0; k = rt.base + n; } cost(112e-6); rt.track(k, 'analogRead');
        if (!B.analog.includes(n)) rt.warnOnce('noan' + k, `${keyLabel(k, rb.boards)} analog giriş değil; analogRead çalışmaz.`);
        const r = Sensors.analog(m, rb, k, rt); return r != null ? r : Math.round(rt.rand() * 40 + 300);
      },
      millis() { return Math.floor(rt.t * 1000); }, micros() { return Math.floor(rt.t * 1e6); },
      *delay(ms) { yield Math.max(0, +ms || 0) / 1000; }, *delayMicroseconds(us) { yield Math.max(0, +us || 0) / 1e6; },
      *pulseIn(p, state, timeout = 1000000) { const k = P(p); rt.track(k, 'pulseIn'); if (timeout >= 1000000 && rb.sensors.some(s => s.type === 'HC-SR04' && s.echo === k)) rt.warnOnce('pto' + k, `pulseIn(${keyLabel(k, rb.boards)}) için zaman aşımı verilmemiş: yankı gelmezse kod 1 saniye bekler. pulseIn(ECHO, HIGH, 30000) yaz.`); return yield* Sensors.pulseIn(m, rb, rt, k, state, timeout); },
      *pulseInLong(p, state, timeout = 1000000) { const k = P(p); rt.track(k, 'pulseIn'); return yield* Sensors.pulseIn(m, rb, rt, k, state, timeout); },
      map(x, a, b, c, d) { return Math.trunc((x - a) * (d - c) / (b - a) + c); },
      constrain: clamp, abs: Math.abs, min: Math.min, max: Math.max, sq: x => x * x, sqrt: Math.sqrt, pow: Math.pow,
      sin: Math.sin, cos: Math.cos, tan: Math.tan, atan2: Math.atan2, atan: Math.atan, asin: Math.asin, acos: Math.acos, exp: Math.exp, log: Math.log,
      floor: Math.floor, ceil: Math.ceil, round: Math.round, fabs: Math.abs, isnan: isNaN, isinf: x => !isFinite(x),
      random(a, b) { if (b === undefined) { b = a; a = 0; } return Math.floor(a + rt.rand() * (b - a)); },
      randomSeed(s) { rt.rand = mulberry32(s | 0); },
      bitRead: (v, b) => (v >> b) & 1, bitWrite: (v, b, x) => x ? v | (1 << b) : v & ~(1 << b), bit: b => 1 << b,
      lowByte: v => v & 0xff, highByte: v => (v >> 8) & 0xff,
      tone() { }, noTone() { }, interrupts() { }, noInterrupts() { },
      attachInterrupt() { rt.warnOnce('intr', 'attachInterrupt simülatörde desteklenmiyor (yok sayıldı).'); }, detachInterrupt() { }, digitalPinToInterrupt: p => p,
    };
    for (let i = 0; i < B.nA; i++) api['A' + i] = B.A0 + i;
    const mkSerial = (name) => ({
      begin() { if (name === 'Serial') rt.serialOn = true; }, end() { }, available() { return 0; }, read() { return -1; }, peek() { return -1; }, flush() { }, setTimeout() { },
      print(v, a) { rt.print(fmt(v, a)); cost(1e-4); }, println(v, a) { rt.print((v === undefined ? '' : fmt(v, a)) + '\n'); cost(1e-4); },
      write(v) { rt.print(typeof v === 'number' ? String.fromCharCode(v) : String(v)); }, [Symbol.toPrimitive]: () => 1,
    });
    api.Serial = mkSerial('Serial'); if (board.tip === 'Mega') { api.Serial1 = mkSerial('Serial1'); api.Serial2 = mkSerial('Serial2'); api.Serial3 = mkSerial('Serial3'); }
    return api;
  }
}

// =====================================================================================
//                                  ROBOT (profil → model)
// =====================================================================================
class Robot {
  constructor(profile, team, match) {
    this.profile = profile; this.team = team; this.match = match; this.name = profile.ad || 'Robot';
    this.parse(profile);
    this.serial = []; this.warnings = []; this.rts = [];
  }
  parse(Pf) {
    const cm = v => (+v || 0) / 100;
    const boards = (Pf.kartlar && Pf.kartlar.length ? Pf.kartlar : [{ id: 'ana', tip: 'Uno', kod: '' }]).map((b, i) => ({ id: (b.id || (i ? 'kart' + (i + 1) : 'ana')).trim(), tip: BOARDS[b.tip] ? b.tip : 'Uno', kod: b.kod || '' }));
    this.boards = boards; const pin = (r) => resolvePin(r, boards);
    const M = Pf.mekanik || {}, D = Pf.devre || {}, T = M.tekerlek || {}, C = M.sarhos_teker || {}, Mo = M.motor || {};
    const tire = TIRES[T.lastik] && T.lastik !== 'ozel' ? TIRES[T.lastik] : { muS: T.mu_statik ?? 0.9, muK: T.mu_kinetik ?? 0.75, crr: T.yuvarlanma ?? 0.015 };
    const mot = MOTORS[Mo.model] && Mo.model !== 'ozel' ? MOTORS[Mo.model] : { volt: Mo.volt || 6, rpm: Mo.rpm || 200, tork: Mo.tork_kgcm || 0.8, surt: Mo.surtunme_kgcm ?? 0.04, akim: Mo.akim_a || 1.5 };
    const dkey = Object.keys(DRIVERS).find(k => k.toUpperCase() === String((D.surucu || {}).tip || 'L298N').toUpperCase()) || 'L298N';
    const Dr = D.surucu || {};
    this.mass = +M.kutle_kg || 1.0;
    this.wheelR = cm(T.cap_cm || 6.5) / 2; this.track = cm(T.iz_cm || 15); this.wheelX = cm(T.x_cm || 0); this.wheelW = cm(T.genislik_cm || 2.5);
    this.tire = tire; this.muS = tire.muS; this.muK = tire.muK; this.crr = tire.crr; this.muLat = tire.muS;
    // 4 tekerli (kızaklı / skid-steer) robot: her yanda iki teker, aynı sürücü kanalından
    this.wheelCount = +T.adet === 4 ? 4 : 2; this.wheelBase = this.wheelCount === 4 ? cm(T.dingil_cm || 12) : 0;
    this.axles = this.wheelCount === 4 ? [this.wheelX + this.wheelBase / 2, this.wheelX - this.wheelBase / 2] : [this.wheelX];
    this.caster = (M.sarhos_teker === null || this.wheelCount === 4) ? null : { x: cm(C.x_cm ?? -8), y: cm(C.y_cm || 0), r: cm(C.cap_cm || 1.5) / 2, crr: 0.03 };
    const com = M.agirlik_merkezi || {};
    const cx = this.caster ? this.caster.x : this.wheelX - 0.05;
    this.comX = com.x_cm != null && com.x_cm !== '' ? cm(com.x_cm) : cx + 0.8 * (this.wheelX - cx);
    this.comZ = cm(com.z_cm ?? 5);
    this.loadFrac = this.caster ? clamp((this.comX - this.caster.x) / ((this.wheelX - this.caster.x) || 1e-6), 0.05, 1) : 1;
    { const [xf, xr] = this.wheelCount === 4 ? this.axles : [this.wheelX, this.wheelX]; const ff = this.wheelCount === 4 ? clamp((this.comX - xr) / ((xf - xr) || 1e-6), 0.1, 0.9) : 1;
      this.axleLoad = this.wheelCount === 4 ? [ff, 1 - ff] : [1]; } // her dingile düşen ağırlık oranı (tekerlerdeki toplam yükün)
    this.motor = { name: Mo.model, vNom: mot.volt, w0: mot.rpm * 2 * Math.PI / 60, tStall: mot.tork * 0.0980665, tFric: mot.surt * 0.0980665, rpm: mot.rpm, iStall: mot.akim || 1.5 };
    { const K0 = M.kalibrasyon || {}; const en = this.match && this.match.engineName; const K = (en && K0[en]) || K0; const hz = +K.hiz_carpani; const dn = +K.donus_direnci; this.calib = { hiz: isFinite(hz) && hz > 0 ? hz : 1, donus: isFinite(dn) ? Math.max(-4, Math.min(4, dn)) : 0 }; }
    this.battery = { volt: +((M.pil || {}).volt) || 7.4, mAh: +((M.pil || {}).mah) || 2000 };
    const side = (o) => { const r = {}; for (const [k, v] of Object.entries(o || {})) r[k] = pin(v); return r; };
    this.driver = { type: dkey, vBat: +((M.pil || {}).volt) || 7.4, drop: DRIVERS[dkey].dusum, maxA: DRIVERS[dkey].maxA, L: side(Dr.sol), R: side(Dr.sag), invL: !!Dr.sol_ters, invR: !!Dr.sag_ters, stby: pin(Dr.stby), raw: Dr };
    this.parts = (M.parcalar || []).map(p => ({
      name: p.ad || 'parça', x: cm(p.x), y: cm(p.y), hx: cm(p.uzunluk) / 2, hy: cm(p.genislik ?? p.uzunluk) / 2,
      z0: cm(p.z0 ?? 0), z1: cm(p.z1 ?? 5), ang: (p.aci || 0) * Math.PI / 180, color: p.renk || '#6b7280', shape: p.sekil || 'kutu',
      servoPin: pin(p.servo_pin), pivot: p.pivot ? [cm(p.pivot[0]), cm(p.pivot[1])] : null, angOff: p.aci_ofset || 0, dir: p.yon ?? 1, len: cm(p.uzunluk), solid: p.kati ?? true,
    }));
    const auto = [];
    for (const ax of this.axles) for (const sy of [1, -1]) auto.push({ name: (sy > 0 ? 'Sol' : 'Sağ') + (this.axles.length > 1 ? (ax > this.wheelX ? ' ön' : ' arka') : '') + ' teker', x: ax, y: sy * this.track / 2, hx: this.wheelR, hy: this.wheelW / 2, z0: 0, z1: this.wheelR * 2, ang: 0, color: '#1f2937', auto: 'wheel', solid: true });
    if (this.caster) auto.push({ name: 'Sarhoş teker', x: this.caster.x, y: this.caster.y, hx: this.caster.r, hy: this.caster.r, z0: 0, z1: this.caster.r * 2, ang: 0, color: '#9ca3af', auto: 'caster', solid: true });
    this.parts = auto.concat(this.parts);
    this.sensors = (D.sensorler || []).map(s => Object.assign({}, s, {
      type: String(s.tip || '').toUpperCase(), name: s.ad || s.tip, x: cm(s.x), y: cm(s.y), z: cm(s.z ?? 2), ang: (s.aci || 0) * Math.PI / 180,
      range: cm(s.menzil_cm || (String(s.tip).toUpperCase() === 'TCS3200' ? 1.5 : 15)),
      pin: pin(s.pin), trig: pin(s.trig), echo: pin(s.echo), dpin: pin(s.dijital_pin), s0: pin(s.s0), s1: pin(s.s1), s2: pin(s.s2), s3: pin(s.s3), out: pin(s.out),
    }));
    this.servos = (D.servolar || []).map(s => ({ name: s.ad || 'servo', pin: pin(s.pin), speed: s.hiz_derece_s || 450, angle: s.baslangic_aci ?? 90 }));
    { // İç hazne / ayıklayıcı (ör. ağza giren yumurtayı tokat servosuyla bölmelere ayıran robotlar)
      const Hz = M.hazne; this.hazne = null;
      if (Hz && Hz.var !== false && Hz.agiz) { const A = Hz.agiz, rng = (r) => r ? { min: r.min ?? 0, max: r.max ?? 180 } : null;
        this.hazne = { agiz: { x0: cm(Math.min(A.x0, A.x1)), x1: cm(Math.max(A.x0, A.x1)), y0: cm(Math.min(A.y0, A.y1)), y1: cm(Math.max(A.y0, A.y1)) },
          kurallar: (Hz.kurallar || []).map(k => ({ servo: pin(k.servo), r: rng(k), ve: k.ve ? { servo: pin(k.ve.servo), r: rng(k.ve) } : null, hedef: k.hedef || 'disari' })).filter(k => k.servo != null),
          bolmeler: (Hz.bolmeler || []).map(bm => ({ ad: bm.ad || 'bölme', kap: bm.kapasite ?? 5, kapak: pin(bm.kapak), r: rng({ min: bm.acik_min ?? 60, max: bm.acik_max ?? 180 }), cx: cm(bm.cikis ? bm.cikis.x : -12), cy: cm(bm.cikis ? bm.cikis.y : 0), aralik: bm.aralik_ms ?? 250, icerik: [], sonCikis: -9 })),
          disari: { x: cm(Hz.disari ? Hz.disari.x : 0), y: cm(Hz.disari ? Hz.disari.y : -14), v: (Hz.disari && Hz.disari.hiz_cms != null ? Hz.disari.hiz_cms : 40) / 100 } };
      }
    }
    const L = D.led; this.led = L ? { type: L.tip === 'NeoPixel' ? 'neo' : 'two', r: pin(L.kirmizi_pin), b: pin(L.mavi_pin), pin: pin(L.pin), x: cm(L.x || 0), y: cm(L.y || 0), z: cm(L.z ?? 9) } : null;
    this.circuit = (D.yerlesim || []).map(c => ({ name: c.ad, x: cm(c.x), y: cm(c.y), z: cm(c.z ?? 8), hx: cm(c.uzunluk) / 2, hy: cm(c.genislik) / 2, h: cm(c.kalinlik ?? 1.2), color: c.renk || '#0f766e' }));
    this.stop = M.acil_stop ? { x: cm(M.acil_stop.x), y: cm(M.acil_stop.y), z: cm(M.acil_stop.z ?? 8) } : null;
    this.model3d = Pf._stl ? Object.assign({}, M.model3d || {}, { bbox: Pf._stl.bbox, pos: Pf._stl.pos, objects: Pf._stl.objects }) : null;
    // kartlar arası teller
    this.links = new Map();
    for (const pair of (Pf.kart_baglantilari || [])) {
      const ks = (Array.isArray(pair) ? pair : String(pair).split(/<->|↔|-|,/)).map(x => pin(String(x).trim())).filter(k => k != null);
      if (ks.length < 2) continue; const g = new Set(ks); for (const k of ks) { const old = this.links.get(k); if (old) for (const o of old) g.add(o); }
      for (const k of g) this.links.set(k, g);
    }
    let minX = 1, maxX = -1, minY = 1, maxY = -1;
    for (const p of this.parts) if (p.servoPin == null) { minX = Math.min(minX, p.x - p.hx); maxX = Math.max(maxX, p.x + p.hx); minY = Math.min(minY, p.y - p.hy); maxY = Math.max(maxY, p.y + p.hy); }
    this.inertia = this.mass * ((maxX - minX) ** 2 + (maxY - minY) ** 2) / 12 || 0.005;
    this.radius = 0.02 + Math.max(0.1, ...this.parts.map(p => p.servoPin != null && p.pivot ? Math.hypot(p.pivot[0], p.pivot[1]) + p.len : Math.hypot(Math.abs(p.x) + p.hx, Math.abs(p.y) + p.hy)));
  }
  reset(pose) {
    this.state = { x: pose.x, y: pose.y, th: pose.th, vx: 0, vy: 0, w: 0, z: this.wheelR, tilt: 0 };
    this.trail = []; this.servoAng = {}; this.servoVel = {}; for (const s of this.servos) this.servoAng[s.pin] = s.angle;
    this.wheelInfo = { L: { V: 0, F: 0, slip: false, rpm: 0, spin: 0 }, R: { V: 0, F: 0, slip: false, rpm: 0, spin: 0 } };
    this.serial = []; this.warnings = []; this.rts = []; this.stats = { slipT: 0, driveT: 0, stuckT: 0, wallHits: 0, maxTilt: 0, amp: 0, ampT: 0, ampPeak: 0, mAh: 0 };
  }
  compile() {
    const errs = [];
    this.rts = this.boards.map((b, bi) => {
      const rt = new Runtime(this.match, this, bi);
      try { const { prog, tr } = compile(b.kod || '', rt.api()); rt.prog = prog; rt.tr = tr; }
      catch (e) { rt.compileError = e; errs.push({ board: b.id, msg: e.message, js: e.js }); rt.out('✖ ' + e.message); }
      return rt;
    });
    return errs;
  }
  rtOf(key) { return this.rts[Math.floor(key / 100)] || null; }
  duty(key) { if (key == null) return 0; if (this.cut && this.cut.has(key)) return 0; const rt = this.rtOf(key); if (!rt) return 0; const s = rt.pins[key]; if (!s) return 0; if (s.pwm != null) return s.pwm; return s.mode === 1 ? s.v : 0; }
  servoTarget(key) { const rt = this.rtOf(key); return rt && key in rt.servoT ? rt.servoT[key] : null; }
  readDigital(k, rt) {
    if (this.cut && this.cut.has(k)) return RNG() < 0.5 ? 1 : 0;
    const r = Sensors.digital(this.match, this, k, rt); if (r != null) return r;
    const g = this.links.get(k); if (g) for (const o of g) { if (o === k) continue; const ort = this.rtOf(o); const os = ort && ort.pins[o]; if (os && (os.mode === 1 || os.pwm != null)) return os.pwm != null ? (os.pwm > 0.5 ? 1 : 0) : os.v; }
    const s = rt.pins[k]; if (s && s.mode === 1) return s.v; if (s && s.pull) return 1; return 0;
  }
  runPrograms(t) { for (const rt of this.rts) rt.runUntil(t); }
  // ---- geometri ----
  partPose(p) {
    if (p.servoPin != null && p.pivot) { const a = ((p.angOff + p.dir * (this.servoAng[p.servoPin] ?? 0)) * Math.PI) / 180; return { cx: p.pivot[0] + Math.cos(a) * p.len / 2, cy: p.pivot[1] + Math.sin(a) * p.len / 2, a, pivot: p.pivot, wS: p.dir * (this.servoVel[p.servoPin] || 0) * Math.PI / 180 }; }
    return { cx: p.x, cy: p.y, a: p.ang, pivot: null, wS: 0 };
  }
  toWorld(lx, ly) { const s = this.state, c = Math.cos(s.th), n = Math.sin(s.th); return [s.x + c * lx - n * ly, s.y + n * lx + c * ly]; }
  cachedParts(t) { if (this._cpT !== t || !this._cp) { this._cp = this.worldParts(); this._cpT = t; } return this._cp; }
  worldParts() {
    const out = [], th = this.state.th;
    for (const p of this.parts) {
      const pp = this.partPose(p); const [wx, wy] = this.toWorld(pp.cx, pp.cy); const a = th + pp.a, c = Math.cos(a), s = Math.sin(a);
      const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [wx + c * u * p.hx - s * v * p.hy, wy + s * u * p.hx + c * v * p.hy]);
      out.push({ p, wx, wy, a, c, s, corners, piv: pp.pivot ? this.toWorld(pp.pivot[0], pp.pivot[1]) : null, wS: pp.wS });
    }
    return out;
  }
  envelope(servoAt) {
    const saved = this.servoAng; if (servoAt) { this.servoAng = Object.assign({}, saved); for (const s of this.servos) this.servoAng[s.pin] = s.angle; }
    let minX = 1, maxX = -1, minY = 1, maxY = -1;
    for (const p of this.parts) { const pp = this.partPose(p), cc = Math.cos(pp.a), ss = Math.sin(pp.a);
      for (const [u, v] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) { const x = pp.cx + cc * u * p.hx - ss * v * p.hy, y = pp.cy + ss * u * p.hx + cc * v * p.hy; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
    for (const c of this.circuit) { minX = Math.min(minX, c.x - c.hx); maxX = Math.max(maxX, c.x + c.hx); minY = Math.min(minY, c.y - c.hy); maxY = Math.max(maxY, c.y + c.hy); }
    if (this.model3d && this.model3d.bbox) { const b = this.model3d.bbox; minX = Math.min(minX, b[0]); maxX = Math.max(maxX, b[3]); minY = Math.min(minY, b[1]); maxY = Math.max(maxY, b[4]); }
    this.servoAng = saved; return { minX, maxX, minY, maxY };
  }
  height() { let h = Math.max(...this.parts.map(p => p.z1), ...this.circuit.map(c => c.z + c.h), this.stop ? this.stop.z + 0.038 : 0, this.led ? this.led.z + 0.008 : 0); if (this.model3d && this.model3d.bbox) h = Math.max(h, this.model3d.bbox[5]); return h; }
  sensorWorld(sn) { const [x, y] = this.toWorld(sn.x, sn.y); return { x, y, a: this.state.th + sn.ang, z: sn.z }; }
  pointVel(rx, ry) { const s = this.state; return [s.vx - s.w * ry, s.vy + s.w * rx]; }
  applyImp(rx, ry, jx, jy) { const s = this.state; s.vx += jx / this.mass; s.vy += jy / this.mass; s.w += (rx * jy - ry * jx) / this.inertia; }
  invMass(rx, ry, nx, ny) { const cr = rx * ny - ry * nx; return 1 / this.mass + cr * cr / this.inertia; }
  sideVoltage(side) {
    const D = this.driver, pins = side === 'L' ? D.L : D.R;
    const dig = (k) => k == null ? 0 : (this.duty(k) > 0.5 ? 1 : 0);
    const Vs = Math.max(0, D.vBat * (this.batFactor || 1) - D.drop); let V = 0, mode = 'coast', d = 0;
    if (D.stby != null && !dig(D.stby)) return { V: 0, mode: 'coast', duty: 0 };
    const t = D.type;
    if (t === 'L9110' || t === 'DRV8833' || t === 'MX1508') {
      const a = this.duty(pins.ia), b = this.duty(pins.ib); d = Math.max(a, b);
      if (a === 0 && b === 0) mode = 'coast'; else if (Math.abs(a - b) < 1e-6) { mode = 'brake'; } else { mode = 'drive'; V = (a - b) * Vs; d = Math.abs(a - b); }
    } else if (t === 'BTS7960') {
      const en = pins.en == null ? 1 : this.duty(pins.en); const a = this.duty(pins.rpwm), b = this.duty(pins.lpwm);
      if (en <= 0.5) mode = 'coast'; else if (a === 0 && b === 0) { mode = 'brake'; d = 1; } else if (Math.abs(a - b) < 1e-6) { mode = 'brake'; d = a; } else { mode = 'drive'; V = (a - b) * Vs; d = Math.abs(a - b); }
    } else {
      const ek = pins.en ?? pins.pwm; const en = ek == null ? 1 : this.duty(ek); const i1 = dig(pins.in1), i2 = dig(pins.in2); d = en;
      if (en <= 0) mode = 'coast'; else if (i1 === i2) mode = 'brake'; else { mode = 'drive'; V = (i1 ? 1 : -1) * Vs * en; }
    }
    if (side === 'L' ? D.invL : D.invR) V = -V;
    if (this.gain) V *= this.gain[side];
    if (this.calib && this.calib.hiz !== 1) V *= this.calib.hiz;
    return { V, mode, duty: d };
  }
  ledColor() {
    if (this._ledOverride !== undefined) return this._ledOverride;
    const L = this.led; if (!L) return null;
    if (L.type === 'neo') { const rt = L.pin != null && this.rtOf(L.pin); const px = rt && rt.neo[L.pin]; if (!px || !px.length) return null; let r = 0, b = 0; for (const c of px) { r += (c >> 16) & 255; b += c & 255; } r /= px.length; b /= px.length; if (r < 20 && b < 20) return null; return r > 2 * b ? 'red' : b > 2 * r ? 'blue' : 'mor'; }
    const r = L.r != null && this.duty(L.r) > 0.1, b = L.b != null && this.duty(L.b) > 0.1; return r && b ? 'mor' : r ? 'red' : b ? 'blue' : null;
  }
  // donanım pin listesi (kontrol ve monitör için)
  hardwarePins() {
    const out = []; const add = (k, role, kind) => { if (k != null) out.push({ key: k, role, kind }); };
    const D = this.driver; for (const [s, lab] of [['L', 'Sol motor'], ['R', 'Sağ motor']]) for (const [pk, k] of Object.entries(D[s])) add(k, `${lab} ${pk.toUpperCase()}`, 'out');
    add(D.stby, 'Sürücü STBY', 'out');
    for (const s of this.sensors) for (const pk of ['pin', 'dpin', 'trig', 'echo', 's0', 's1', 's2', 's3', 'out']) if (s[pk] != null) add(s[pk], `${s.name} ${pk === 'pin' ? '' : pk.toUpperCase()}`.trim(), ['trig', 's0', 's1', 's2', 's3'].includes(pk) ? 'out' : 'in');
    for (const s of this.servos) add(s.pin, s.name, 'servo');
    if (this.led) { if (this.led.type === 'neo') add(this.led.pin, 'NeoPixel LED', 'neo'); else { add(this.led.r, 'LED kırmızı', 'out'); add(this.led.b, 'LED mavi', 'out'); } }
    for (const [k] of this.links) add(k, 'Kartlar arası tel', 'link');
    return out;
  }
}
