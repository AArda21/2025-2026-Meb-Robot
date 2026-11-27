# MEB Robot Yumurta Toplama Simülatörü — geliştirici rehberi (Codex / yapay zekâ ajanları için)

Bu dosya, projeyi devralan bir yazılımcının ya da yapay zekâ ajanının (Codex vb.) işe hemen başlayabilmesi içindir.
Proje sahibi: Eyüp Ensar. Arayüz, yorumlar ve commit mesajları **Türkçe**.

## 1. Proje ne?

MEB Robot Yarışması **Yumurta Toplama (Caretta Caretta)** kategorisi için, Arduino kodunu gerçek robota yüklemeden önce
deneyebileceğin bir **fizik simülatörü**. Telefon (APK), bilgisayar (EXE) ve web sürümü var; üçü de aynı tek HTML dosyasıdır.

Takımın amacı: sahaya çıkmadan robotun ne yapacağını görmek; mekanik sorunları, yanlış kabloları ve
kod ↔ mekanik uyumsuzluklarını önceden yakalamak. Simülasyonun **olabildiğince gerçekçi** olması en önemli öncelik
(hareket, yumurtaların davranışı, çarpışmalar, dönüşler ve görüntü). Rakip yapay zekâsı önemli değil;
iki köşeye de takımın kendi robot sürümleri konup karşılaştırılıyor.

Takımın robotu (2026, Antalya): sarı gövdeli, **4 tekerli (hepsi motorlu)**, **Arduino Mega + Nano**,
BTS7960 sürücü, 2×18650 pil (7,4 V), 4 adet MZ80 göz (kodda 2'si kullanılıyor), TCS3200 renk sensörü,
NeoPixel LED, önde içeri giren yumurtayı tutan kelepçeler, iç hazne (tokat servosu yumurtayı bizim/yeşil bölmeye ayırır).
Kodu: `kaynak/ornek_kodlar/antalya_mega.ino` ve `antalya_nano.ino`. Mega kodunda bilinen bir derleme hatası var
(`Servo yesil` ile `float yesil` aynı ad); düzeltilmiş hâli `antalya_mega_duzeltilmis.ino`.
Ölçüler ve sensör yerleri **tahmini**; gerçek ölçüm geldikçe `gen_profiles.py` içindeki "Antalya 2026" profili güncellenmeli.

## 2. Depo ve dallar (ÖNEMLİ)

- Depo: `AArda21/2025-2026-Meb-Robot`
- **`main` dalına DOKUNMA** (takımın robot kodları orada).
- Simülatör: **`simulator`** dalı. Derlenmiş APK/EXE: `apk-dosyalari` dalı (GitHub Actions yazar). Test çıktıları: `test-sonuclari` dalı.
- Sürüm adı: **"MEB Robot V4.x"** (şu an V4.9.0). Sürüm numarası `package.json`, `capacitor.config.json` (appName) ve `kaynak/template3.html` içindeki başlıkta.

```
www/index.html          ← UYGULAMANIN KENDİSİ (üretilen dosya, elle düzenleme; kaynak/'tan üretilir)
www/lib/                ← three.js + Rapier (npm run libs kopyalar, depoda yok)
kaynak/                 ← tüm kaynak kod (aşağıda)
kaynak/build.sh         ← kaynakları birleştirip www/index.html üretir
kaynak/test/            ← hızlı testler ve Arduino dil örnekleri
test/                   ← bulut testleri (3B fizik + Playwright ekran görüntüleri)
electron/main.js        ← PC sürümü (app:// protokolüyle www/ açar)
capacitor.config.json   ← Android sürümü
.github/workflows/      ← build.yml (APK+EXE), test3d.yml (bulut testleri), video.yml (maç videosu hazırlama)
```

## 3. Derleme ve test

Gerekenler: Node.js 20+, Python 3.

```bash
bash kaynak/build.sh                 # profiles.js + core3.js + www/index.html üretir
node kaynak/test/hizli_test.js       # derleme, Arduino dil örnekleri, fizik ölçümü, tekrarlanabilirlik
npm install && npm run pc            # PC sürümünü aç (Electron)
npm run exe                          # dist/ içine taşınabilir .exe
```

- 3B fizik testleri (`test/fizik3d.mjs`) ve ekran görüntüleri (`test/ekran.mjs`) GitHub Actions'ta `test3d.yml` ile çalışır;
  sonuçlar `test-sonuclari` dalına yazılır. Yerelde `npm install` sonrası depo kökünden `mkdir -p sonuc && node test/fizik3d.mjs` çalışır (önce `bash kaynak/build.sh`).
- APK ve EXE: `simulator` dalına push → `build.yml` → dosyalar `apk-dosyalari` dalına `MEB-Robot-V{sürüm}.apk/.exe` olarak gelir.
- **Her değişiklikten sonra**: `build.sh` → `hizli_test.js` → mümkünse tarayıcıda `www/index.html` aç (2B her yerde çalışır;
  3B için `www/lib` gerekir ve dosya bir http sunucusundan açılmalı: `python3 -m http.server` → `http://127.0.0.1:8000/www/`).

## 4. Mimari

Tek sayfalık uygulama; derlenince her şey `www/index.html` içine gömülür (`build3.py`, `template3.html` içindeki
`/*CORE*/ /*PROFILES*/ /*P3D*/ /*V3D*/ /*UI*/` yer tutucularını doldurur). İnternetsiz çalışır.

| Dosya | Görev |
|---|---|
| `core_head.js` | Sabitler: `RULESETS` (2026/2025 kuralları), `RULES` (saha 2,5 m, duvar 8 cm, köşe 50 cm, yumurta Ø4×2 cm), `BOARDS` (Uno/Nano/Mega pinleri), `TIRES`, `MOTORS` (devir, tork, sürtünme, akım, dişli oranı, rotor ataleti), `DRIVERS`, `BATTERIES`, `SENSOR_TYPES` |
| `_transpiler.js` | **Arduino C++ → JavaScript** çevirici. Fonksiyonlar generator'a çevrilir (`delay`, `pulseIn` vb. `yield` ile sanal zamanı ilerletir). int/byte/long taşması (Uno'da int 16 bit), tamsayı bölmesi, struct, enum, aşırı yükleme, `100L/3.14f/B101`, `bitSet`, `EEPROM`. `lint()` eksik `;` ve parantezleri yakalar |
| `core_body.js` | `Runtime` (bir Arduino kartı: pinler, sanal zaman, Serial — 9600 baud gerçek süreyle —, Servo, NeoPixel, kütüphaneler) ve `Robot` (profilden robot modeli: parçalar, tekerler, motor, sürücü, pil, sensörler, iç hazne, kalibrasyon) |
| `core_sim.js` | `Sensors` (ultrasonik, IR/MZ80 yüzey rengine göre menzil, TCS3200, zemin, buton), **2B fizik motoru** `Match` (tekerlek–zemin sürtünme dairesi, 4 teker kızaklı dönüş, döner sarhoş teker, rotor ataleti, pil gerilim düşmesi, yumurta–robot–duvar çarpışmaları), hakem/puanlama, iç hazne, tohumlu gürültü (`RNG`) |
| `core_check.js` | Kontrol raporu: `staticChecks` (pin çakışması, ölçü/ağırlık, akım, kod tuzakları), `runTrial` (15 sn deneme), `measureMotion`/`autoCalibrate`/`calibSketch` (gerçek robotla eşleştirme), model dosyası okuyucular (STL/OBJ/GLB) |
| `physics3d.js` | **3B fizik** (Rapier 0.12): `makeMatch3D(R)` → 2B `Match`'i genişletir; robot gövdesi, eklemli tekerler (hız motoru), servo kapaklar, yumurtalar, ışın izleme |
| `view3d.js` | three.js 0.160 görüntü: salon, masa, saha, robotlar, kameralar (Seyirci, Serbest, Üstten, Takip), düşük grafik |
| `ui3.js` | Arayüz: Saha / Robotlar (Mekanik, Devre, Kod) / Kontrol sekmeleri, editör, seri monitör, toplu maç, geçmiş, yumurta düzenleyici, kalibrasyon kartı |
| `template3.html` | HTML + CSS iskeleti ve uygulama içi rehber |
| `gen_profiles.py` | Hazır profilleri (`Yum Yum`, `Antalya 2026 robotumuz`, `Basit rakip`) üretir → `profiles.js`. Profilleri buradan değiştir, `profiles.js`'i elle değil |
| `defaults.js`, `strateji.ino`, `rakip.ino`, `ornek_kodlar/` | Profillerin içine giren kodlar |

### Önemli kavramlar
- **Profil** (JSON): `mekanik` (tekerlek, motor, pil, parçalar, sarhoş teker, hazne, kalibrasyon), `devre` (sürücü pinleri, sensörler, servolar, LED), `kartlar` (her Arduino'nun tipi ve kodu), kartlar arası bağlantılar.
- **Pin anahtarı**: `kartIndex*100 + pin`; profilde pinler `"mega:22"` gibi yazılır.
- **Sanal zaman**: her kart kendi zamanında koşar; fizik adımı 2B'de 1 ms, 3B'de 2 ms.
- **2B ve 3B aynı sonucu vermeli.** Bir fizik değişikliği yaparsan ikisinde de yap ve `measureMotion` ile karşılaştır
  (şu an düz gitme ±%5; 2 tekerlide dönüş ±%15; 4 tekerlide 3B belirgin daha zor dönüyor, örn. 45° ↔ 30° — iyileştirilmeli).
- **Tekrarlanabilirlik**: tüm gürültü `RNG` (maç tohumundan) gelir; `Math.random` kullanma.

## 5. Bilinen tuzaklar (zor yoldan öğrenildi)

- Rapier 0.12: `configureMotorVelocity(hedef, 0)` tekeri **kilitler** → boşta için `1e-6` kullan.
- Rapier 0.12: küçük adımda çok çözücü yinelemesi kayma sürtünmesini 4 kat zayıflatıyor (yumurtalar buz gibi kayıyordu) → `numSolverIterations = 2`.
- Düz silindir lastik zemine iki kenarından sürtünüp dönüşü zorlaştırıyordu → lastik zemine **küre** collider ile değer, yandaki çarpışmalar ince silindirle. `roundCylinder` denendi: robot duvar dibinde takla atıyordu, kullanma.
- Kaynak satırlarının çoğu uzun ve tek satır; `//` yorumu eklerken satırın geri kalanını yorum yapmamaya dikkat et (`/* */` kullan).
- `profiles.js`, `core3.js`, `www/index.html` üretilen dosyalar; kaynağı değiştirip `build.sh` çalıştır.

## 6. Bekleyen veriler (takımdan gelecek)

Gerçek robot ölçümleri gelince simülasyon kendi robotuna oturacak:
1. Ölçüm kodu (uygulamadan "Ölçüm kodu" ya da `calibSketch`): 1 sn PWM 200 düz gidiş (cm) ve 1 sn PWM 170 dönüş (derece) → uygulamada "Gerçek robotla eşleştir".
2. Ölçüler: en/boy/yükseklik/ağırlık, teker çapı, iz genişliği, ön-arka teker arası, motor modeli, sensör yerleri.
3. Üstten, sabit telefonla test videoları (düz gitme, dönme, yumurta itme, duvara çarpma), yere 50 cm aralıklı bant.
4. TCS3200 `olcum()` değerleri: kırmızı/mavi/yeşil yumurta ve boş.

## 7. Yapılacaklar listesi (sahibin onayladığı, sırasıyla)

1. **"Robotunu tanıt" sihirbazı (YAPILDI)**: Gövde ve teker ölçüleri canlı çizimle giriliyor. Hazne ağzı, bölme çıkışları ve servo kuralları görsel formdan ayarlanıyor. TCS3200 ve TCRT5000 için karta uygun kod üretiliyor ve Seri Monitör örneklerinden yüzey başına medyan ölçümler profile aktarılıyor.
2. **Gerçek / simülasyon karşılaştırması**: gerçek robotun Seri logu ile aynı durum simülasyonda oynatılır, ayrıştığı yer gösterilir. PC sürümünde USB (Web Serial) ile canlı sensör izleme.
3. **Adım adım kod çalıştırma** (çalışan satırı vurgulama, durdurma noktası) ve **otomatik ayar bulucu** (koddaki işaretli sayıları toplu maçla optimize etme).
4. **İki robotu karşılaştırma raporu**: aynı yumurta dizilimlerinde, rakipsiz 20–30 maç; puan, yanlış yumurta, sıkışma, süre.
5. **"Kötü gün" modu**: maç sırasında pil düşmesi, temassız kablo, servo takılması, ışık değişimi.
6. **Profil paylaşma**: profili dosya olarak dışa/içe aktarma; ekibin 3B modelini (OBJ/GLB) ve Fritzing devresini tek dokunuşla yükleme.

Ek gerçekçilik fikirleri: TCS3200'ün ortam ışığından etkilenmesi, servoların yük altında yavaşlaması,
gerçek robot ölçüleriyle 3B modelin görünümü, yarışma salonu ışığına göre renkler.

## 8. Çalışma kuralları

- Arayüz metinleri sade ve Türkçe; kullanıcı lise öğrencisi, çoğunlukla telefondan kullanıyor.
- Uygulama internetsiz çalışmalı (CDN'e bağımlı yeni kütüphane ekleme; gerekirse `scripts/copy-libs.js` ile `www/lib`'e kopyala).
- Yeni özellik → `hizli_test.js`'e test ekle. Fiziği değiştirdiysen 2B/3B karşılaştır ve bir tam maçta robotun devrilmediğini kontrol et (`stats.maxTilt`).
- Commit mesajı: `V4.x: <ne değişti>` (Türkçe).

## 9. Gerçek robotla doğrulama (V4.7.1)

`GERCEKLIK_DOGRULAMA_PLANI.md` gerçek robotun ölçü, video, motor, zemin ve sensör verilerinin nasıl toplanacağını ve simülasyonla nasıl karşılaştırılacağını açıklar. Bu sürümde TCS3200 zaman aşımı, TCRT5000 sensör yüksekliği ile kalibrasyon tutarlılığı ve gerçek hareket sapması raporu iyileştirildi. Deneysel gerçek robot verisi olmadan tam fiziksel eşleşme iddia edilmez.

## 10. Yarışma videosu ile saha görünümü (V4.7.2)

25 Kasım 2026 tarihli 2:10'luk yarışma videosunda beyaz kenarlı yükseltilmiş saha, kırmızı/mavi/yeşil köşe alanları, sahaya dağılmış yumurtalar ve iki robot görünmektedir. Videoda robotların iç haznesi ya da puanlama kararları doğrulanamamaktadır. Bu nedenle resmi 2026 puanlama modeline dokunulmadı. Yum Yum varsayılan profilindeki eski uzun kepçe/kollar yerine sade ön şasi yerleştirildi; kullanıcı tarafından değiştirilmiş profiller korunur. Saha sağ üstüne `match.score()` kullanan skor/süre paneli, maç tekrarında kayıtlı `snapshot.sc` ile uyumlu olarak eklendi. 2B sahadaki hayali ızgara kaldırıldı; 3B görünüm zaten beyaz zemin ve tek ek çizgisi kullanmaktadır. Gerçek robotun iç mekanizması ölçülmeden kesin fiziksel benzerlik iddia edilmez.

V4.7.2 video ek doğrulaması: `video2026` adında ayrı, dört tekerli ve üstü açık temsili yarış robotu eklendi. Yeni kurulumlarda kırmızı köşedeki başlangıç robotu bu profildir; var olan yerel kullanıcı seçimleri korunur. Profil yalnızca videonun görselini yaklaşık yansıtır, gerçek hareket parametreleri ve koduyla birebir eşleşme iddia edilmez.

## V4.7.3 video robotu ön açıklık düzeltmesi

`video2026` profilinde 2 cm yüksekliğindeki yumurtaları karşılayan ön katı tampon, 3,15 cm üzerindeki sabit traversle değiştirildi. Görünür ön servo kaldırıldı; servo kontrolü gerektiren Yum Yum kodunun yerine temsili dolaşma kodu kullanıldı. Eski varsayılan video profili, kullanıcı değişikliği yoksa yükseltilir. Yeni hızlı test ön geçiş açıklığını denetler. Gerçek fiziksel robot ölçümleri hâlâ gereklidir.

## V4.8.0 Antalya robotunun ayrıntılı 3B modeli (fotoğraflardan)

27 Kasım 2026'da ekibin gönderdiği 50 fotoğraftan (üstten 10 ve 49, yandan 24, önden 38) robot parça parça modellendi: `kaynak/robot_antalya_3b.py` → `parcalar()` ve `kablolar()`; `gen_profiles.py` Antalya profiline bağlar. Ölçek, üstten çekimde 18650 pil boyuyla (65 mm ≈ 27 px/cm) kuruldu.

- Ölçüler: 27,6 × 28,6 × 13,9 cm; teker Ø7,5 cm, iz 25,4 cm, dingil 13,9 cm; önde tek yönlü kapakçık sırası, iç huni → kanal → ortada tokatlı ayıklayıcı (hazne ağzı x −3,2…1,6 cm), yan (sol) ve arka çıkış kapıları, 2 BTS7960, Mega + Nano, 8 × 18650, köşelerde 2'şer MZ80 (üstteki çapraz ±25° olanlar kodda bağlı), NeoPixel şerit.
- **Çıkarım (ölçülmedi):** 8 hücre → 4S2P **14,8 V**; motor **JGA25-370 12V 130**. Sebep: ekibin kodu `sol(100)`, `sag(80)`, `ileri(100)` ile çalışıyor; 7,4 V/280 rpm varsayımında robot bu PWM'lerde hiç dönemiyordu. Gerçek pil bağlantısı ve motor etiketi gelince düzelt.
- Depodaki Mega kodu **test modunda** (loop sadece `olcum()`); simülatör `ornek_kodlar/antalya_mega_oyun.ino` kullanır (aynı kod, oyun mantığı ve başlangıç yorumdan çıkarılmış).

Yeni profil alanları (genel, her robot kullanabilir):
- `parcalar[].gorsel: true` → sadece görünüş; fizik/çarpışma/sensör ışınlarına girmez (Robot.visualParts), 3B'de opak çizilir. Çarpışacak gövde parçalarını `gorsel` yapma.
- `parcalar[].eksen: "x"|"y"|"z"` → silindirin yönü (yatay: yarıçap = (z1−z0)/2, boy = uzunluk/genişlik). `malzeme: metal|kaucuk|led|pcb|parlak`.
- `mekanik.kablolar: [{renk, kalinlik, noktalar:[[x,y,z],...]}]` → 3B'de eğri jumper kablo (TubeGeometry).
- `mekanik.detayli_gorunum: true` → hazır kart kutuları, sensör/acil stop simgeleri çizilmez (model kendi parçalarıyla çizer).
- `tekerlek.jant_renk`, `tekerlek.lastik_renk`; `led.uzunluk/genislik/adet` (NeoPixel şeridi tek tek LED).
- Performans: görsel parçalar fizik döngüsünden çıkarıldı (önce 167 parçayla 2B maç 2,5 kat yavaşlıyordu).

## V4.9.0 Yarışma videolarından 8 rakip robot

22 maç videosu (Antalya 2026; ekibin 21 videosu + 25 Kasım videosu) tarandı, robotlar otomatik kırpılıp (beyaz saha içindeki koyu/renkli büyük lekeler) incelendi. Videoda en sık görülen 8 tasarım `kaynak/rakipler.py` içinde profil oldu (id: `kirmizi4`, `yesil_buldozer`, `mavi_huni`, `siyah_kutu`, `ahsap_kutu`, `sari_tt_kit`, `turkuaz_alcak`, `kirmizi_kizak`). Görünüş/ölçü/mekanizma videodan YAKLAŞIK; motor, pil ve kod temsilî.
- Kodlar: kapaklı kepçe → `strateji.ino` (Yum Yum); iç hazne + ayıklayıcı → `ornek_kodlar/hazne.ino` (`SIRALA 0` ile ayırmadan alır); buldozer/kızak → `ornek_kodlar/buldozer.ino`. Hepsi Uno + aynı pin düzeni.
- Zayıf 4 tekerliler (TT/N20) kauçuk lastikle simülasyonda yerinde dönemedi; bu yüzden TT kiti 3S, turkuaz JGA25 + 3S, siyah kutu 2 teker + sarhoş teker yapıldı (açıklamalarında yazıyor).
- Sarhoş teker yumurta kanalının önüne konursa yumurtayı iter, hazneye almaz (siyah/ahşap kutuda yaşandı) — kanallı robotlarda sarhoş teker arkada olmalı.
- Yeni kurulumda varsayılan maç: kırmızı köşe Antalya robotumuz, mavi köşe `kirmizi4`.
- YouTube videoları buradan indirilemedi; yalnızca başlık/açıklama okundu. Kaynak ekibin kendi maç videoları.
