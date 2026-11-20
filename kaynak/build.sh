set -e
cd /home/claude/v36
python3 gen_profiles.py >/dev/null
cat core_head.js _transpiler.js core_body.js core_sim.js core_check.js > core3.js
node --check core3.js
python3 build3.py >/dev/null
node -e "const s=require('fs').readFileSync('index.html','utf8'); const js=s.split('<script>')[1].split('</script>')[0]; new Function(js);"
echo build ok
