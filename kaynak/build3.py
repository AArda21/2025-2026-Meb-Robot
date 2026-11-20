t=open('template3.html').read()
strip=lambda s: s.replace("if (typeof module !== 'undefined') module.exports = SIM;","").replace('if (typeof module !== "undefined") module.exports = { DEFAULT_PROFILES };',"")
for k,f in [('/*CORE*/','core3.js'),('/*PROFILES*/','profiles.js'),('/*P3D*/','physics3d.js'),('/*V3D*/','view3d.js'),('/*UI*/','ui3.js')]:
    t=t.replace(k, strip(open(f).read()).replace('</script>','<\\/script>'))
open('index.html','w').write(t)
print(len(t))
