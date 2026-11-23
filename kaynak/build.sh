#!/bin/bash
# Tek dosyalık uygulamayı (www/index.html) kaynaklardan üretir.
set -e
cd "$(dirname "$0")"
python3 gen_profiles.py >/dev/null                      # hazır robot profilleri → profiles.js
cat core_head.js _transpiler.js core_body.js core_sim.js robot_tanit.js core_check.js > core3.js
node --check core3.js
python3 build3.py >/dev/null                            # template3.html + js → index.html
node -e "const s=require('fs').readFileSync('index.html','utf8'); const js=s.split('<script>')[1].split('</script>')[0]; new Function(js);"
cp index.html ../www/index.html
echo "build ok → www/index.html"
