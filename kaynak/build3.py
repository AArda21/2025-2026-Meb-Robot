t=open('template3.html').read()
strip=lambda s: s.replace("if (typeof module !== 'undefined') module.exports = SIM;","").replace('if (typeof module !== "undefined") module.exports = { DEFAULT_PROFILES };',"")
for k,f in [('/*CORE*/','core3.js'),('/*PROFILES*/','profiles.js'),('/*P3D*/','physics3d.js'),('/*V3D*/','view3d.js'),('/*UI*/','ui3.js')]:
    s=open(f).read()
    if k == '/*UI*/':
        s=s.replace('/*ROBOT_TANIT*/', open('robot_tanit_ui.js').read())
    t=t.replace(k, strip(s).replace('</script>','<\\/script>'))
open('index.html','w').write(t)
print(len(t))
