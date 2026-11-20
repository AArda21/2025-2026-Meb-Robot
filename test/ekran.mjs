// Gerçek tarayıcıda (WebGL) uygulamayı açıp 3B görünümün ekran görüntülerini alır
import { chromium } from 'playwright'; import fs from 'fs';
fs.mkdirSync('sonuc', { recursive: true }); const logs = [];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, vp] of [['mobil', { width: 390, height: 844, deviceScaleFactor: 2 }], ['masaustu', { width: 1366, height: 860 }]]) {
  const pg = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1 });
  pg.on('console', m => logs.push(`[${name}] ${m.type()}: ${m.text()}`)); pg.on('pageerror', e => logs.push(`[${name}] PAGEERROR: ${e.message}`));
  await pg.goto('http://localhost:8080/index.html'); await pg.waitForTimeout(6000); await pg.screenshot({ path: `sonuc/${name}_rehber.png` }); if (await pg.isVisible('#guide.on')) await pg.click('#bGuideClose');
  logs.push(`[${name}] motor=` + await pg.inputValue('#sEngine') + ' ovl=' + await pg.textContent('#ovl'));
  await pg.screenshot({ path: `sonuc/${name}_0_acilis.png` });
  await pg.click('#bStart'); await pg.waitForTimeout(4000); await pg.screenshot({ path: `sonuc/${name}_1_serbest.png` });
  await pg.evaluate(() => { const d = document.querySelector('details'); if (d) d.open = true; });
  await pg.selectOption('#sCam', 'takip'); await pg.waitForTimeout(3000); await pg.screenshot({ path: `sonuc/${name}_2_takip.png` });
  await pg.waitForTimeout(3000); await pg.screenshot({ path: `sonuc/${name}_3_takip2.png` });
  await pg.selectOption('#sCam', 'ustten'); await pg.waitForTimeout(1500); await pg.screenshot({ path: `sonuc/${name}_4_ustten.png` });
  logs.push(`[${name}] ovl=` + await pg.textContent('#ovl') + ' sure=' + await pg.textContent('#hTime') + ' K=' + await pg.textContent('#hRed') + ' M=' + await pg.textContent('#hBlue'));
  await pg.click('#tabs button[data-t="kontrol"]'); await pg.click('#bCheck'); await pg.waitForTimeout(20000); await pg.screenshot({ path: `sonuc/${name}_5_kontrol.png`, fullPage: true });
  // Düşük grafik
  await pg.click('#tabs button[data-t="saha"]'); await pg.evaluate(() => { document.querySelector('#saha details').open = true; }); await pg.selectOption('#sQual', 'dusuk'); await pg.selectOption('#sCam', 'serbest'); await pg.waitForTimeout(2500); await pg.screenshot({ path: `sonuc/${name}_6_dusuk_grafik.png` });
  logs.push(`[${name}] dusuk grafik ovl=` + await pg.textContent('#ovl'));
  // Kalibrasyon (2B + 3B)
  await pg.click('#tabs button[data-t="robotlar"]'); await pg.click('#seg button[data-s="mekanik"]'); await pg.waitForTimeout(300);
  const c = pg.locator('.card', { hasText: 'Gerçek robotla eşleştir' });
  for (const [lab, val] of [['Gerçekte gittiği', '38'], ['Gerçekte döndüğü', '180']]) { const i = c.locator('label', { hasText: lab }).locator('input'); await i.fill(val); await i.dispatchEvent('change'); }
  await c.getByRole('button', { name: 'Otomatik eşleştir' }).click(); await pg.waitForTimeout(45000);
  logs.push(`[${name}] kalibrasyon: ` + (await c.locator('.msg').innerText()).replace(/\n/g, ' | ') + ' || ' + await c.locator('p.hint').last().innerText());
  await pg.close();
}
fs.writeFileSync('sonuc/tarayici_log.txt', logs.join('\n')); await b.close();
