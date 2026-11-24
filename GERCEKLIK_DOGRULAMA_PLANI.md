# Gerçek robotla doğrulama planı — V4.7

## Hedef ve sınır

Başarı ölçüsü, ekrandaki animasyonun inandırıcılığı değil, **aynı robot, aynı kod, aynı zemin ve aynı pil koşullarında ölçülen hareketin karşılaştırılabilir olmasıdır**. Ölçümsüz tam eşleşme iddia edilmez. Düz gidiş ve dönüş ayrı ayrı doğrulanmalı; bir testin iyi çıkması genel yarış başarısını kanıtlamaz.

## Öncelikli gerçekçilik boşlukları

| Öncelik | Alan | Doğrulama yöntemi |
|---|---|---|
| 1 | Geometri, kütle, ağırlık merkezi, 4 teker iz/dingil | Terazi ve kumpas; robotun 3B ölçülerini karşılaştır |
| 1 | Motor torku, redüktör sürtünmesi, fren/boşa alma | PWM 100/150/200/255; her iki yönde hızlanma ve durma video izi |
| 1 | Dönüşte teker kayması ve zemin sürtünmesi | Sunta yarışma zemininde 90° ve 360° dönüş; 2B/3B sonuçlarını karşılaştır |
| 1 | Pil iç direnci, sürücü gerilim düşmesi, düşük gerilim | Boştayken ve motor yükündeyken multimetre ile gerilim/akım ölç |
| 1 | Sensörler TCS3200, MZ80, TCRT5000 | Gerçek sensör yüksekliği, farklı ışıklar, renkler ve mesafelerde seri ölçümler |
| 2 | Servoların yük altındaki gecikmesi, hazne ve kelepçe | Servo komutundan fiziksel harekete gecikme videosu; yumurta bırakma |
| 2 | Yumurtaların kayması, yuvarlanması ve çarpışması | Standart zeminde yumurta itme/bırakma videoları, çarpışma sonrası yön |
| 2 | Arduino kodunun zamanlaması, pulseIn, Serial, kartlar arası haberleşme | Seri log ile fiziksel hareket zamanlarını senkron karşılaştır |
| 3 | Ortam ışığı, pilin ısınması, gevşek bağlantı | Çoklu denemelerin dağılımı; nominal ve zor koşullar ayrı raporla |

## Tekrarlanabilir ölçüm protokolü

1. Robotun gerçek en/boy/yüksekliği, kütlesi, teker çapı, iz genişliği, dingil aralığı, pil ve sürücü modelini kaydet.
2. Zemini, ışığı, pilin yük altında gerilimini ve sensör yüksekliğini sabit tut. Düz gidişte önünde duvar ve yumurta bulunmasın.
3. Üstten sabit kamerayla 50 cm işaretli zeminde her PWM için en az beş düz sürüş videosu çek. Zaman-konum örnekleri çıkar.
4. Aynı şekilde sağa ve sola dönüşleri ölç. Her denemede gerçek son açı ve hareket süresini kaydet.
5. Uygulamadaki **Video ile hareket karşılaştırması** bölümüne `0;0` satırıyla başlayan zaman-konum/konum-açı çiftlerini gir. RMSE, en büyük sapma ve son farkı takip et.
6. Kalibrasyonu aynı veriye göre yaptıktan sonra **başka** videolarla tekrar sınama yap; sadece kalibrasyonda kullanılan testin uyuşması yeterli değil.
7. 2B ve 3B'yi aynı koşulda karşılaştır. Dönüş, sürtünme ve yumurta etkisinde farklılık varsa ölçüyle doğrulamadan bir motoru doğru kabul etme.
8. Her test için gerçek video, tarih, robot profili, kullanılan Arduino kodu, pil gerilimi, zemin ve test sonucu saklanmalı.

## Kabul koşulları

- Hazır profiller derlenmeli, `bash kaynak/build.sh` ve `node kaynak/test/hizli_test.js` hatasız geçmeli.
- 3B fizik ve ekran testleri ayrıca koşmalı; iki modelin hareket sapmaları ölçülerek raporlanmalı.
- Gerçek robota ait en az beş bağımsız tekrar olmadan yüzde hata hedefinin gerçekleştiği iddia edilmemeli.
- Kalibrasyonun iyileşmesi hem eğitim hem ayrı tutulan doğrulama videolarında görülmeli.
- Üretilen `www/index.html`, `kaynak/core3.js` ve `kaynak/profiles.js` doğrudan düzenlenmemeli.

## V4.7 izlenebilir iyileştirmeleri

- TCS3200 darbe ölçümü zaman aşımında artık geçerliymiş gibi sanal darbe üretmiyor.
- Video karşılaştırma raporu RMSE'ye ek olarak ortalama işaretli farkı, en büyük sapmayı ve son nokta farkını hesaplıyor; son gerçek ölçüm sıfırsa yüzde hata uydurmuyor.
- Bu senaryolar için hızlı testlere regresyon kontrolleri eklendi.
- **Bu değişiklikler gerçek robot ölçümü yerine geçmez; yeni gerçekçilik doğrulaması gerektirir.**
