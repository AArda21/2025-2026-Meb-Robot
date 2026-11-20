const BASE_T = 'void|auto|int|long\\s+long|long|float|double|bool|boolean|byte|char|short|word|String|size_t|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|unsigned';
const TYPES = `(?:(?:static|inline|volatile|const|unsigned|signed|register)\\s+)*(?:${BASE_T})(?:\\s*[*&])?`;
const intKind = (m) => /long\s+long|u?int64_t/.test(m) ? 't' : /unsigned\s+long|uint32_t|size_t/.test(m) ? 'U' : /\blong\b|int32_t/.test(m) ? 'L' : /unsigned\s+char|\bbyte\b|uint8_t/.test(m) ? 'B' : /\bint8_t/.test(m) ? 't' : /unsigned|\bword\b|uint16_t/.test(m) ? 'W' : 'I';
const WRAPF = { t: '__i', U: '__wul', L: '__wl', B: '__wb', W: '__wu', I: '__wi' };
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
  // 1b) enum → sabitler; enum adları int gibi davranır
  const enumNames = [];
  t = t.replace(/(?<![\w.])enum\s+(?:class\s+)?(\w+)?\s*(?::\s*\w+\s*)?\{([^}]*)\}\s*(\w+)?\s*;/g, (all, name, body, varName) => {
    if (name) enumNames.push(name); let n = -1; const parts = body.split(',').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\w+)\s*(?:=\s*(.+))?$/); if (!m) return null; if (m[2] !== undefined) { const v = Number(m[2]); n = isNaN(v) ? n + 1 : v; return `${m[1]} = ${m[2]}`; } n++; return `${m[1]} = ${n}`; }).filter(Boolean);
    return `const ${parts.join(', ')};` + (varName ? ` let ${varName} = 0;` : '');
  });
  for (const en of enumNames) t = t.replace(new RegExp(`(?<![\\w.])${en}(?=\\s+[A-Za-z_*&])`, 'g'), 'int').replace(new RegExp(`(?<![\\w.])${en}::`, 'g'), '');
  t = t.replace(/\.length\s*\(\s*\)/g, '.length');
  t = t.replace(/(?<![\w.])bitSet\s*\(\s*([\w.\[\]]+)\s*,/g, '__BS($1,').replace(/(?<![\w.])bitClear\s*\(\s*([\w.\[\]]+)\s*,/g, '__BC($1,');
  { let k; while ((k = t.search(/__B[SC]\(/)) >= 0) { const o = k + 4, c = matchBracket(t, o); if (c < 0) break; const [v, n] = splitTop(t.slice(o + 1, c)); t = t.slice(0, k) + (t[k + 3] === 'S' ? `(${v} |= (1 << (${n})))` : `(${v} &= ~(1 << (${n})))`) + t.slice(c + 1); } }
  t = t.replace(/(?<![\w.])EEPROM\.get\s*\(\s*([^,]+),\s*(\w+)\s*\)/g, '($2 = EEPROM.get($1, $2))');
  // 1c) Sayı sonekleri: 100000L, 10UL, 3.14f
  t = t.replace(/(?<![\w.])((?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)[fF](?!\w)/g, '$1').replace(/(?<![\w.])(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+)(?:[uU][lL]{0,2}|[lL]{1,2}[uU]?)(?!\w)/g, '$1');
  t = t.replace(/(?<![\w.])B([01]{1,8})(?!\w)/g, '0b$1');
  // 1d) struct → sınıf
  const structs = [];
  t = t.replace(/(?<![\w.])(?:typedef\s+)?struct\s+(\w+)?\s*\{([^{}]*)\}\s*(\w+)?\s*;/g, (all, name, body, alias) => {
    name = name || alias; if (!name) return all; structs.push(name); if (alias && alias !== name) structs.push(alias);
    const fields = []; for (const stmt of body.split(';')) { const st = stmt.trim(); if (!st) continue; const m = st.match(new RegExp(`^(?:${TYPES}|\\w+)\\s+(.+)$`)); if (!m) continue;
      for (const d of splitTop(m[1])) { const mm = d.trim().match(/^(\w+)\s*((?:\[[^\]]*\])*)\s*(?:=\s*([\s\S]+))?$/); if (mm) fields.push({ n: mm[1], dims: mm[2], init: mm[3] }); } }
    const ctor = fields.map((f, i) => `this.${f.n} = __a.length > ${i} ? __a[${i}] : ${f.dims ? `__arr(${f.dims.match(/\[([^\]]*)\]/g).map(x => x.slice(1, -1) || '0').join(',')})` : (f.init ? f.init.replace(/\{/g, '[').replace(/\}/g, ']') : '0')};`).join(' ');
    return `class ${name} { constructor(...__a) { ${ctor} } }` + (alias && alias !== name ? ` const ${alias} = ${name};` : '');
  });
  for (const sn of structs) {
    t = t.replace(new RegExp(`(?<![\\w.])(?:struct\\s+)?${sn}\\s+(\\w+)\\s*\\[([^\\]]*)\\]\\s*;`, 'g'), (a, v, n) => `let ${v} = Array.from({ length: ${n || 0} }, () => new ${sn}());`);
    t = t.replace(new RegExp(`(?<![\\w.])(?:struct\\s+)?${sn}\\s+(\\w+)\\s*\\[([^\\]]*)\\]\\s*=\\s*\\{`, 'g'), (a, v) => `let ${v} = __SARR_${sn}{`);
    t = t.replace(new RegExp(`(?<![\\w.])(?:struct\\s+)?${sn}\\s+(\\w+)\\s*=\\s*\\{([^{}]*)\\}\\s*;`, 'g'), (a, v, args) => `let ${v} = new ${sn}(${args});`);
    t = t.replace(new RegExp(`(?<![\\w.])(?:struct\\s+)?${sn}\\s+(\\w+)\\s*;`, 'g'), (a, v) => `let ${v} = new ${sn}();`);
    t = t.replace(new RegExp(`(?<![\\w.])(?:struct\\s+)?${sn}(?=\\s*[&*]?\\s*\\w+\\s*[,)=(])`, 'g'), 'auto');
    // dizi başlatıcı: { {1,2}, {3,4} } → [new S(1,2), new S(3,4)]
    let k; while ((k = t.indexOf(`__SARR_${sn}{`)) >= 0) { const o = k + `__SARR_${sn}`.length; const c = matchBracket(t, o); if (c < 0) break; const inner = t.slice(o + 1, c); const items = splitTop(inner).map(x => x.trim()).filter(Boolean).map(x => x.startsWith('{') ? `new ${sn}(${x.slice(1, -1)})` : x); t = t.slice(0, k) + '[' + items.join(', ') + ']' + t.slice(c + 1); }
  }
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
    if (defCount[name] > 1) { const n = cp ? cp.split(',').length : 0; const L = (overloads[name] = overloads[name] || []); const same = L.filter(o => o.n === n).length; fname = `${name}__a${n}` + (same ? '_' + same : ''); L.push({ n, f: fname, fl: /\b(float|double)\b/.test(params), st: /\bString\b|char\s*\*/.test(params) }); }
    funcs.push(name);
    return `function* ${fname}(${cp}) {${isIntType(ty) ? '\u0002' + intKind(ty) : ''}`;
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
  t = t.replace(reDecl, (m, ty) => (/\bconst\b/.test(ty) ? 'const' : 'let') + (isIntType(ty) ? '\u0001' + intKind(ty) : '') + ' ');
  // 9) Diziler
  t = t.replace(/\b(let|const)(\u0001[tULBWI])?\s+(\w+)\s*((?:\[[^\]]*\])+)\s*(=|;)/g, (all, kw, mk, name, dims, end) => {
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
  // 10) let varsayılanları ve tamsayı kırpma (Arduino Uno/Nano/Mega: int 16 bit, long 32 bit)
  const typed = {};
  {
    let out = '', i = 0; const re = /\b(let|const)(\u0001[tULBWI])?\s+/g; let m;
    while ((m = re.exec(t))) {
      const start = m.index + m[0].length; const end = findStmtEnd(t, start);
      const body = t.slice(start, end + (t[end] === ';' ? 0 : 1));
      const decls = splitTop(body).map(d => {
        const eq = (() => { let dd = 0; for (let k = 0; k < d.length; k++) { const c = d[k]; if ('([{'.includes(c)) dd++; else if (')]}'.includes(c)) dd--; else if (c === '=' && dd === 0 && d[k + 1] !== '=' && !'!<>='.includes(d[k - 1])) return k; } return -1; })();
        if (eq < 0) return d.trim() ? d.replace(/\s*$/, '') + ' = 0' : d;
        if (m[2]) { const nm = (d.slice(0, eq).trim().match(/^(\w+)$/) || [])[1]; if (nm) typed[nm] = nm in typed && typed[nm] !== m[2][1] ? null : m[2][1]; return d.slice(0, eq + 1) + ' ' + WRAPF[m[2][1]] + '(' + d.slice(eq + 1).trim() + ')'; }
        return d;
      });
      out += t.slice(i, m.index) + m[1] + ' ' + decls.join(', ');
      i = start + body.length; re.lastIndex = i;
    }
    t = out + t.slice(i);
  }
  // 10b) Tamsayı değişkenlere sonradan yapılan atamalar da taşar (ör. int t = millis() 32 sn sonra eksiye döner)
  {
    const names = Object.keys(typed).filter(n => typed[n] && typed[n] !== 't');
    if (names.length) {
      const re = new RegExp(`(^|[;{}])(\\s*)(${names.join('|')})\\s*(\\+\\+|--|(?:[-+*/%&|^]|<<|>>)?=(?!=))`, 'g'); let m; const edits = [];
      while ((m = re.exec(t))) {
        const nm = m[3], op = m[4], st = m.index + m[1].length + m[2].length; const after = st + m[0].length - m[1].length - m[2].length;
        const end = findStmtEnd(t, after); if (t[end] !== ';') continue; const rhs = t.slice(after, end).trim(); const W = WRAPF[typed[nm]];
        let rep;
        if (op === '++' || op === '--') { if (rhs) continue; rep = `${nm} = ${W}(${nm} ${op[0]} 1);`; }
        else if (op === '=') rep = `${nm} = ${W}(${rhs});`;
        else rep = `${nm} = ${W}(${nm} ${op.slice(0, -1)} (${rhs}));`;
        edits.push([st, end + 1, rep]);
      }
      for (const [a, b, r] of edits.reverse()) t = t.slice(0, a) + r + t.slice(b);
    }
  }
  // 10c) Tamsayı bölmesi: iki taraf da tamsayıysa sonuç kesirsiz (7 / 2 = 3)
  {
    const isI = (x) => /^\d+$/.test(x) || (typed[x] && true);
    t = t.replace(/(?<![\w.\])\]])(\w+)\s*\/\s*(\w+)(?![\w.(\[])/g, (all, a, b) => (isI(a) && isI(b)) ? `__idiv(${a}, ${b})` : all);
  }
  // 11) int fonksiyonlarda return kırpma
  {
    let k;
    while ((k = t.indexOf('\u0002')) >= 0) {
      const o = k - 1; const c = matchBracket(t, o); const W = WRAPF[t[k + 1]] || '__i';
      let body = t.slice(k + 2, c).replace(/\breturn\s+([^;]+);/g, `return ${W}($1);`);
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
  t = t.replace(/\u0001[tULBWI]?/g, '');
  // 14) Değişmezleri geri koy
  t = t.replace(/__S(\d+)__/g, (a, n) => lits[+n]);
  for (const [name, L] of Object.entries(overloads)) { const ns = [...new Set(L.map(o => o.n))];
    t += `\nfunction* ${name}(...__a){ const __fl = __a.some(x => typeof x === 'number' && !Number.isInteger(x)), __st = __a.some(x => typeof x === 'string'); switch(__a.length){ ${ns.map(n => { const c = L.filter(o => o.n === n); if (c.length === 1) return `case ${n}: return yield* ${c[0].f}(...__a);`; return `case ${n}: ${c.map(o => `if (${o.st ? '__st' : '!__st'} && ${o.fl ? '__fl' : '!__fl'}) return yield* ${o.f}(...__a);`).join(' ')} return yield* ${c[0].f}(...__a);`; }).join(' ')} default: throw new Error('${name}() için ' + __a.length + ' parametreli sürüm yok'); } }`; }
  const prefix = statics.join(' ');
  // izlenecek global değişkenler (izleme paneli için)
  const globals = statics.map(s => (s.match(/^let\s+(\w+)/) || [])[1]).filter(Boolean);
  { let d = 0; const re = /[{}]|\blet\s+([^;]+);/g; let m; while ((m = re.exec(t))) { if (m[0] === '{') d++; else if (m[0] === '}') d--; else if (d === 0) for (const part of splitTop(m[1])) { const nm = (part.trim().match(/^(\w+)/) || [])[1]; if (nm && !/^__/.test(nm)) globals.push(nm); } } }
  return { js: t, prefix, funcs, warnings, globals: [...new Set(globals)] };
}

// Arduino derleyicisinin yakalayacağı ama JS'in affettiği hatalar için basit denetim
function lint(src) {
  const { code } = mask(src.replace(/\r/g, '')); const L = code.split('\n'); const out = [];
  let par = 0, br = 0, brStack = [];
  L.forEach((raw, i) => { for (const ch of raw) { if (ch === '(') par++; else if (ch === ')') par--; else if (ch === '{') { br++; brStack.push(i + 1); } else if (ch === '}') { br--; brStack.pop(); if (br < 0) { out.push({ line: i + 1, msg: 'Fazladan kapanan süslü parantez }' }); br = 0; } } } });
  if (br > 0) out.push({ line: brStack[brStack.length - 1] || L.length, msg: `${br} süslü parantez { kapatılmamış` });
  for (let i = 0; i < L.length; i++) {
    const s = L[i].trim(); if (!s || s.startsWith('#')) continue;
    if (/[;{},:(\[]$|&&$|\|\|$|[+\-*\/=<>!?]$/.test(s)) continue;
    if (/^(if|for|while|else|switch|do|case|default|template|public|private|class|struct|enum)\b/.test(s) || /^}?\s*else\b/.test(s)) continue;
    let j = i + 1; while (j < L.length && !L[j].trim()) j++; const nx = j < L.length ? L[j].trim() : '';
    if (nx.startsWith('{') || /^[)\]&|?:.+\-*\/=<>]/.test(nx)) continue;
    if (/^\w[\w\s\*&<>,]*\([^;]*\)\s*(const)?$/.test(s) && nx.startsWith('{')) continue;
    if (/\)$/.test(s) && /^(\w[\w\s\*&]*)\s+\w+\s*\(/.test(s) && nx.startsWith('{')) continue;
    out.push({ line: i + 1, msg: 'Satır sonunda noktalı virgül ; eksik olabilir' });
  }
  return out;
}
function compile(src, api) {
  const tr = transpile(src);
  const vars = tr.globals.map(n => `${JSON.stringify(n)}: (()=>{try{return ${n}}catch(e){return undefined}})()`).join(',');
  const body = `with(__api){ ${tr.prefix} ${tr.js}\n;return {setup: typeof setup==='function'?setup:null, loop: typeof loop==='function'?loop:null, vars: () => ({${vars}})};}`;
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

