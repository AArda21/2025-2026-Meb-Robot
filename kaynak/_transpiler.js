const BASE_T = 'void|int|long\\s+long|long|float|double|bool|boolean|byte|char|short|word|String|size_t|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|unsigned';
const TYPES = `(?:(?:static|inline|volatile|const|unsigned|signed|register)\\s+)*(?:${BASE_T})(?:\\s*[*&])?`;
const isIntType = (m) => /\b(int|long|short|byte|word|unsigned|size_t|u?int\d+_t)\b/.test(m) && !/\b(float|double)\b/.test(m);
const GEN_BUILTINS = ['delay', 'delayMicroseconds', 'pulseIn', 'pulseInLong'];
const GEN_METHODS = ['ping_cm', 'ping', 'ping_in', 'ping_median'];

function mask(src) {
  const lits = []; let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { out += '  '; i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') break; j++; }
      lits.push(src.slice(i, j + 1)); out += `__S${lits.length - 1}__`; i = j + 1; continue;
    }
    out += c; i++;
  }
  return { code: out, lits };
}
function matchBracket(t, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' }; const oc = t[open], cc = pairs[oc]; let d = 0;
  for (let i = open; i < t.length; i++) { if (t[i] === oc) d++; else if (t[i] === cc) { d--; if (d === 0) return i; } }
  return -1;
}
function splitTop(s, sep = ',') {
  const parts = []; let d = 0, cur = '';
  for (const ch of s) { if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; if (ch === sep && d === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur); return parts;
}
function convParams(p) {
  if (!p.trim() || p.trim() === 'void') return '';
  return splitTop(p).map(x => {
    const eq = x.indexOf('='); const left = eq >= 0 ? x.slice(0, eq) : x; const def = eq >= 0 ? x.slice(eq) : '';
    const name = left.replace(/\[[^\]]*\]/g, '').trim().split(/[\s*&]+/).pop();
    return name + def;
  }).join(', ');
}
function findStmtEnd(t, k) { // depth-0 ';'
  let d = 0;
  for (let i = k; i < t.length; i++) { const c = t[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) { d--; if (d < 0) return i - 1; } else if (c === ';' && d === 0) return i; }
  return t.length - 1;
}

function transpile(src) {
  let { code: t, lits } = mask(src.replace(/\r/g, ''));
  const warnings = [];
  // 1) Ön işlemci
  t = t.split('\n').map(line => {
    let m;
    if (/^\s*#\s*include/.test(line)) return '';
    if ((m = line.match(/^\s*#\s*define\s+(\w+)\(([^)]*)\)\s*(.*)$/))) return `const ${m[1]} = (${m[2]}) => (${m[3].replace(/;\s*$/, '')});`;
    if ((m = line.match(/^\s*#\s*define\s+(\w+)\s*(.*)$/))) { const v = m[2].replace(/;\s*$/, '').trim(); return `const ${m[1]} = ${v === '' ? '1' : '(' + v + ')'};`; }
    if (/^\s*#/.test(line)) { warnings.push('Yok sayılan satır: ' + line.trim()); return ''; }
    return line;
  }).join('\n');
  // 2) Nesneler (Servo, NewPing)
  t = t.replace(/(?<![\w.])(Servo|NewPing|Adafruit_NeoPixel)\s+(?=[A-Za-z_])([^;]+);/g, (all, cls, decl) => {
    const ds = splitTop(decl).map(d => { const m = d.trim().match(/^(\w+)\s*(?:\(([\s\S]*)\))?$/); return m ? `${m[1]} = new __CLS_${cls}(${m[2] || ''})` : d; });
    return `let ${ds.join(', ')};`;
  });
  // 3) Başlatılmamış String
  t = t.replace(/(?<![\w.])String\s+(\w+)\s*;/g, 'let $1 = "";');
  // 4) Tür dönüşümleri
  t = t.replace(/\(\s*(?:unsigned\s+)?(?:int|long|byte|short|word|u?int(?:8|16|32)_t)\s*\)/g, '~~');
  t = t.replace(/\(\s*(?:float|double|char|unsigned)\s*\)/g, '');
  t = t.replace(/\(\s*(?:bool|boolean)\s*\)/g, '!!');
  t = t.replace(/(?<![\w.])(?:int|long|byte|word)\s*\(/g, 'Math.trunc(');
  t = t.replace(/(?<![\w.])(?:float|double)\s*\(/g, 'Number(');
  t = t.replace(/(?<![\w.])(?:volatile|PROGMEM|register)\s+/g, '');
  // 5) Fonksiyon tanımları → generator
  const funcs = [];
  const reDef = new RegExp(`(?<![\\w.])(${TYPES})\\s+(\\w+)\\s*\\(([^()]*)\\)\\s*(?:const\\s*)?\\{`, 'g');
  const defCount = {}; for (const m of t.matchAll(reDef)) defCount[m[2]] = (defCount[m[2]] || 0) + 1;
  const overloads = {};
  t = t.replace(reDef, (all, ty, name, params) => {
    if (['if', 'while', 'for', 'switch', 'return'].includes(name)) return all;
    const cp = convParams(params); let fname = name;
    if (defCount[name] > 1) { const n = cp ? cp.split(',').length : 0; fname = `${name}__a${n}`; (overloads[name] = overloads[name] || []).push(n); }
    funcs.push(name);
    return `function* ${fname}(${cp}) {${isIntType(ty) ? '\u0002' : ''}`;
  });
  // 6) Prototipler
  const reProto = new RegExp(`(?<![\\w.])(${TYPES})\\s+(\\w+)\\s*\\(([^()]*)\\)\\s*;`, 'g');
  t = t.replace(reProto, (all, ty, name, params) => {
    const p = params.trim();
    if (p === '' || p === 'void' || new RegExp(`^(?:${TYPES})`).test(p)) return '';
    return `let ${name} = (${p});`;
  });
  // 7) static değişkenler → global
  const statics = [];
  const reStatic = new RegExp(`(?<![\\w.])static\\s+(${TYPES})\\s+(\\w+)\\s*(=\\s*[^;]+)?;`, 'g');
  t = t.replace(reStatic, (all, ty, name, init) => { statics.push(`let ${name} ${init || (/String/.test(ty) ? '= ""' : '= 0')};`); return ''; });
  // 8) Değişken bildirimleri
  const reDecl = new RegExp(`(?<![\\w.])(${TYPES})\\s+(?=[A-Za-z_])`, 'g');
  t = t.replace(reDecl, (m, ty) => (/\bconst\b/.test(ty) ? 'const' : 'let') + (isIntType(ty) ? '\u0001' : '') + ' ');
  // 9) Diziler
  t = t.replace(/\b(let|const)(\u0001?)\s+(\w+)\s*((?:\[[^\]]*\])+)\s*(=|;)/g, (all, kw, mk, name, dims, end) => {
    if (end === '=') return `${kw} ${name} =`;
    const ds = dims.match(/\[([^\]]*)\]/g).map(d => d.slice(1, -1).trim() || '0');
    return `${kw} ${name} = __arr(${ds.join(',')});`;
  });
  { // { } başlatıcıları → [ ]
    let re = /=\s*\{/g, m;
    while ((m = re.exec(t))) {
      const o = t.indexOf('{', m.index); const c = matchBracket(t, o); if (c < 0) break;
      const inner = t.slice(o, c + 1).replace(/\{/g, '[').replace(/\}/g, ']');
      t = t.slice(0, o) + inner + t.slice(c + 1); re.lastIndex = o + 1;
    }
  }
  // 10) let varsayılanları ve tamsayı kırpma
  {
    let out = '', i = 0; const re = /\b(let|const)(\u0001?)\s+/g; let m;
    while ((m = re.exec(t))) {
      const start = m.index + m[0].length; const end = findStmtEnd(t, start);
      const body = t.slice(start, end + (t[end] === ';' ? 0 : 1));
      const decls = splitTop(body).map(d => {
        const eq = (() => { let dd = 0; for (let k = 0; k < d.length; k++) { const c = d[k]; if ('([{'.includes(c)) dd++; else if (')]}'.includes(c)) dd--; else if (c === '=' && dd === 0 && d[k + 1] !== '=' && !'!<>='.includes(d[k - 1])) return k; } return -1; })();
        if (eq < 0) return d.trim() ? d.replace(/\s*$/, '') + ' = 0' : d;
        if (m[2]) return d.slice(0, eq + 1) + ' __i(' + d.slice(eq + 1).trim() + ')';
        return d;
      });
      out += t.slice(i, m.index) + m[1] + ' ' + decls.join(', ');
      i = start + body.length; re.lastIndex = i;
    }
    t = out + t.slice(i);
  }
  // 11) int fonksiyonlarda return kırpma
  {
    let k;
    while ((k = t.indexOf('\u0002')) >= 0) {
      const o = k - 1; const c = matchBracket(t, o);
      let body = t.slice(k + 1, c).replace(/\breturn\s+([^;]+);/g, 'return __i($1);');
      t = t.slice(0, k) + body + t.slice(c);
    }
  }
  // 12) Zaman tüketen çağrıları yield* ile sar
  const genNames = new Set([...funcs, ...GEN_BUILTINS]);
  {
    const starts = []; let m;
    const reCall = /(?<![\w.$])(\w+)\s*\(/g;
    while ((m = reCall.exec(t))) { if (genNames.has(m[1]) && !/function\*\s*$/.test(t.slice(Math.max(0, m.index - 12), m.index))) starts.push(m.index); }
    const reM = new RegExp(`(?<![\\w.$])(\\w+)\\.(${GEN_METHODS.join('|')})\\s*\\(`, 'g');
    while ((m = reM.exec(t))) starts.push(m.index);
    starts.sort((a, b) => b - a);
    for (const s of starts) {
      const o = t.indexOf('(', s); const c = matchBracket(t, o); if (c < 0) continue;
      t = t.slice(0, s) + '(yield* ' + t.slice(s, c + 1) + ')' + t.slice(c + 1);
    }
  }
  // 13) Döngülere zaman bütçesi
  {
    const BUD = 'if(__b())yield 0;';
    const pos = []; let m; const re = /(?<![\w.])(while|for|do)\b/g;
    while ((m = re.exec(t))) pos.push([m.index, m[1]]);
    pos.sort((a, b) => b[0] - a[0]);
    for (const [s, kw] of pos) {
      if (kw === 'do') { const k = t.slice(s + 2).search(/\S/) + s + 2; if (t[k] === '{') t = t.slice(0, k + 1) + BUD + t.slice(k + 1); continue; }
      const o = t.indexOf('(', s); if (o < 0 || t.slice(s + kw.length, o).trim() !== '') continue;
      const c = matchBracket(t, o); if (c < 0) continue;
      const k = t.slice(c + 1).search(/\S/) + c + 1;
      if (t[k] === '{') t = t.slice(0, k + 1) + BUD + t.slice(k + 1);
      else if (t[k] === ';') {
        const before = t.slice(0, s).replace(/\s+$/, '');
        if (kw === 'while' && before.endsWith('}')) continue; // do-while
        t = t.slice(0, k) + '{' + BUD + '}' + t.slice(k + 1);
      } else { const e = findStmtEnd(t, k); t = t.slice(0, k) + '{' + BUD + ' ' + t.slice(k, e + 1) + '}' + t.slice(e + 1); }
    }
  }
  t = t.replace(/\u0001/g, '');
  // 14) Değişmezleri geri koy
  t = t.replace(/__S(\d+)__/g, (a, n) => lits[+n]);
  for (const [name, ns] of Object.entries(overloads)) t += `\nfunction* ${name}(...__a){ switch(__a.length){ ${ns.map(n => `case ${n}: return yield* ${name}__a${n}(...__a);`).join(' ')} default: throw new Error('${name}() için ' + __a.length + ' parametreli sürüm yok'); } }`;
  const prefix = statics.join(' ');
  return { js: t, prefix, funcs, warnings };
}

function compile(src, api) {
  const tr = transpile(src);
  const body = `with(__api){ ${tr.prefix} ${tr.js}\n;return {setup: typeof setup==='function'?setup:null, loop: typeof loop==='function'?loop:null};}`;
  let fn;
  try { fn = new Function('__api', body); }
  catch (e) { const err = new Error('Derleme hatası: ' + trError(e.message)); err.js = tr.js; err.raw = e.message; throw err; }
  const prog = fn(api);
  if (!prog.setup || !prog.loop) { const err = new Error('setup() ve loop() fonksiyonları bulunamadı.'); err.js = tr.js; throw err; }
  return { prog, tr };
}
function errLine(e) {
  const m = String(e && e.stack || '').match(/<anonymous>:(\d+):(\d+)/);
  return m ? (+m[1] - 2) : null;
}

