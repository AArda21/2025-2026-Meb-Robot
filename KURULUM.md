# MEB Robot Yumurta Toplama Simülatörü — PC (.exe) ve Android (.apk)

Uygulamanın tamamı `www/index.html` içinde. PC sürümü Electron ile, Android sürümü Capacitor ile bu sayfayı paketler.
3B görünüm için **three.js**, fizik için **Rapier** (katı cisim fizik motoru) kullanılır. `npm run libs` bunları `www/lib/` içine kopyalar; böylece uygulama internetsiz çalışır.

---

## Yol 1 — En kolayı: GitHub Actions (bilgisayara hiçbir şey kurmadan)

1. GitHub'da yeni bir depo aç (ör. `meb-robot-sim`).
2. Bu klasördeki **tüm dosyaları** (gizli `.github` klasörü dahil) depoya yükle.
   Telefondan yüklüyorsan, `.github/workflows/build.yml` dosyasını GitHub'da "Add file → Create new file" ile aynı yolda oluştur ve içeriğini yapıştır.
3. Deponun **Actions** sekmesine gir. "Derle (APK + Windows EXE)" kendiliğinden başlar (başlamazsa **Run workflow** düğmesine bas).
4. Yaklaşık 10 dakika sonra işin sayfasının altındaki **Artifacts** bölümünden indir:
   - `MEB-Robot-Sim-APK` → içindeki `app-debug.apk` dosyasını telefona kur (bilinmeyen kaynaklara izin ver)
   - `MEB-Robot-Sim-Windows` → `MEB Robot Simulator x.x.x.exe` (kurulum istemez, çift tıkla)

## Yol 2 — Kendi bilgisayarında PC sürümü

1. https://nodejs.org adresinden Node.js 20 LTS'yi kur.
2. Bu klasörde bir terminal aç:
   ```
   npm install
   npm run pc        # uygulamayı hemen açar
   npm run exe       # dist/ klasörüne taşınabilir .exe üretir
   ```

## Yol 3 — Kendi bilgisayarında APK

1. Node.js 20 ve **Android Studio**'yu kur (içinden Android SDK 34 ve JDK 17 gelir).
2. Terminalde:
   ```
   npm install
   npm run apk:hazirla
   npm run apk:ac          # Android Studio açılır
   ```
3. Android Studio'da **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
   APK dosyası `android/app/build/outputs/apk/debug/` klasörüne çıkar.
4. `www/index.html` dosyasını değiştirirsen `npm run apk:guncelle` komutunu çalıştırıp yeniden derle.

---

## Notlar
- Fizik motoru sahanın üstündeki seçiciden değiştirilir: **3B · Rapier** (gerçek fizik) veya **2B · basit** (hızlı, yedek).
  3B kütüphaneler yüklenemezse uygulama kendiliğinden 2B motorla açılır.
- Kod ve robot ayarları cihazda saklanır. **.ino aç** / **JSON aç** ile dosyadan da yükleyebilirsin.
