# Yarışma videosu gözlemleri — 25 Kasım 2026

Kaynak: kullanıcı tarafından paylaşılan 130 saniyelik yarışma kaydı. **Bu bir görsel referanstır, resmi kural metni değildir.**

- Beyaz, yüksek bordürlü kare yarışma masası ve kırmızı, mavi, yeşil köşe bölümleri vardır.
- İki robot aynı anda hareket eder. Sahada kırmızı, mavi ve yeşil küçük yumurtalar farklı konumlara dağılmıştır.
- Görüntülenen robotlar, eski Yum Yum örnek modelindeki uzun ön kepçe/yan kolların aynısını taşımamaktadır.
- Videodan robottaki motor, teker ölçüsü, iç hazne, yumurtaların temas ve puanlama koşulları güvenilir biçimde ölçülemez.

## Yapılanlar

1. Yum Yum örnek profilinde video ile çelişen ön kepçe/uzun kol/kapan parça geometrisi sade ön şasiye dönüştürüldü. İlk açılışta eski, değişmemiş hazır profiller otomatik uyarlanır; özelleştirilmiş mekanizmalara dokunulmaz.
2. Beyaz 2B sahadaki yapay kare çizgiler kaldırıldı; levha birleşim çizgisi korundu.
3. Saha görüntüsünün sağ üstüne canlı kırmızı-mavi puan ve kalan süre eklendi. Skor mevcut puanlama motorundan gelir; tekrar izleme kayıtlı anın puanını gösterir.
4. Mevcut saha ve puanlama fiziği değiştirilmedi; videodan yeni puan kuralları türetilmedi.

## Test

`bash kaynak/build.sh`, `node kaynak/test/hizli_test.js`, 3B fizik ve Playwright ekran testleri. Mekanik profildeki değişiklikler nedeniyle 2B/3B fizik karşılaştırmaları ayrıca kontrol edilmelidir.
