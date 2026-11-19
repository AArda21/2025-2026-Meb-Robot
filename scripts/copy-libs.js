// three.js ve Rapier'i node_modules'tan www/lib içine kopyalar → uygulama internetsiz çalışır.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www', 'lib');
fs.mkdirSync(out, { recursive: true });
const pkg = (n) => path.join(root, 'node_modules', n);

const three = path.join(pkg('three'), 'build', 'three.module.js');
fs.copyFileSync(three, path.join(out, 'three.module.js'));
console.log('✓ three.module.js');

const rdir = pkg('@dimforge/rapier3d-compat');
const rpkg = JSON.parse(fs.readFileSync(path.join(rdir, 'package.json'), 'utf8'));
for (const f of fs.readdirSync(rdir)) if (f.endsWith('.js')) fs.copyFileSync(path.join(rdir, f), path.join(out, f));
const entry = rpkg.module || 'rapier.es.js';
if (path.basename(entry) !== 'rapier.es.js') fs.writeFileSync(path.join(out, 'rapier.es.js'), `export * from './${path.basename(entry)}';\nexport { default } from './${path.basename(entry)}';\n`);
console.log('✓ rapier (' + entry + ')');
