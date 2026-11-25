import os
import copy
HERE = os.path.dirname(os.path.abspath(__file__))
import json
d = open(os.path.join(HERE, 'defaults.js')).read()
code = d[d.index('const DEFAULT_CODE = `') + len('const DEFAULT_CODE = `'):d.rindex('`;')]
code = code.replace('''// 0 = yumurta yok, 1 = kırmızı, 2 = mavi
int yumurtaRengi() {
  int r = renkOku(LOW, LOW);
  int b = renkOku(LOW, HIGH);
  if (r > 120 && b > 120) return 0;
  if (r < b) return 1;
  return 2;
}''', '''// 0 = yumurta yok, 1 = kırmızı, 2 = mavi, 3 = yeşil (2026 ödül yumurtası)
// TCS3200: periyot ne kadar KÜÇÜKSE o renk o kadar GÜÇLÜ
int yumurtaRengi() {
  int r = renkOku(LOW, LOW);    // kırmızı filtre
  int b = renkOku(LOW, HIGH);   // mavi filtre
  int g = renkOku(HIGH, HIGH);  // yeşil filtre
  if (r > 120 && b > 120 && g > 120) return 0;
  if (r <= b && r <= g) return 1;
  if (g < r && g < b) return 3;
  return 2;
}''')
code = code.replace('const bool TAKIM_KIRMIZI = true;   // mavi köşedeysen false yap', 'bool TAKIM_KIRMIZI = true;   // köşe anahtarından okunur (A5: kırmızıda HIGH)')
code = code.replace('  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);', '  pinMode(A5, INPUT);\n  TAKIM_KIRMIZI = digitalRead(A5) == HIGH;   // köşe anahtarı\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);')
code = code.replace('if (renk != 0 && renk != benim) {', 'if (renk != 0 && renk != benim && renk != 3) {   // yeşil ödül yumurtasını tut')
F = False; T = True; N = None
yum = {
 "id": "yumyum", "ad": "Yum Yum", "renk": "#f08c00", "aciklama": "Yarışma videosuna uygun sade ön şasili örnek robot. Gerçek robotun iç mekanizması, sensör ve motor ölçüleri videodan doğrulanamaz; ölçüleri düzenleyin.",
 "kartlar": [{"id": "ana", "tip": "Uno", "kod": open(os.path.join(HERE, "strateji.ino")).read()}],
 "kart_baglantilari": [],
 "mekanik": {
  "video_on_rev": 1, "kutle_kg": 1.1, "agirlik_merkezi": {"x_cm": N, "z_cm": 5},
  "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.6, "iz_cm": 17, "x_cm": -2},
  "sarhos_teker": {"x_cm": -8, "y_cm": 0, "cap_cm": 1.6},
  "motor": {"model": "TT 1:48 6V"}, "pil": {"volt": 7.4}, "acil_stop": {"x": 2, "y": -4, "z": 8.9},
  "parcalar": [
   {"ad": "Sol TT motor", "x": -2, "y": 4.9, "uzunluk": 7, "genislik": 2.2, "z0": 2.2, "z1": 4.3, "renk": "#f2c230"},
   {"ad": "Sağ TT motor", "x": -2, "y": -4.9, "uzunluk": 7, "genislik": 2.2, "z0": 2.2, "z1": 4.3, "renk": "#f2c230"},
   {"ad": "Alt pleksi plaka", "x": 0, "y": 0, "uzunluk": 19, "genislik": 14, "z0": 4.3, "z1": 4.6, "renk": "#cfe3f0"},
   {"ad": "Direk 1", "sekil": "silindir", "x": 7, "y": 6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227"},
   {"ad": "Direk 2", "sekil": "silindir", "x": 7, "y": -6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227"},
   {"ad": "Direk 3", "sekil": "silindir", "x": -7.5, "y": 6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227"},
   {"ad": "Direk 4", "sekil": "silindir", "x": -7.5, "y": -6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227"},
   {"ad": "Üst pleksi plaka", "x": -0.5, "y": 0, "uzunluk": 18, "genislik": 15, "z0": 8.6, "z1": 8.9, "renk": "#cfe3f0"},
   {"ad": "Ön şasi kenarı", "x": 9, "y": 0, "uzunluk": 0.7, "genislik": 12, "z0": 2.4, "z1": 4.3, "renk": "#64748b"}
  ], "model3d": N},
 "devre": {
  "surucu": {"tip": "L298N", "sol": {"en": 5, "in1": 7, "in2": 8}, "sag": {"en": 6, "in1": 9, "in2": 10}, "sol_ters": F, "sag_ters": F},
  "sensorler": [
   {"tip": "HC-SR04", "ad": "Ön ultrasonik", "trig": 11, "echo": 12, "x": 9.3, "y": 0, "z": 6.5, "aci": 0},
   {"tip": "IR_ENGEL", "ad": "Sol IR", "pin": 2, "x": 8, "y": 7.5, "z": 1.5, "aci": 40, "menzil_cm": 14},
   {"tip": "IR_ENGEL", "ad": "Sağ IR", "pin": 4, "x": 8, "y": -7.5, "z": 1.5, "aci": -40, "menzil_cm": 14},
   {"tip": "TCRT5000", "ad": "Zemin", "pin": "A0", "x": 2, "y": 0, "z": 1, "esik": 500},
   {"tip": "TCS3200", "ad": "Ön renk sensörü (temsili)", "s2": "A1", "s3": "A2", "out": 13, "olcek": 20, "x": 8.8, "y": 0, "z": 1, "aci": 0, "bakis": "ileri", "menzil_cm": 2.5},
   {"tip": "BUTON", "ad": "Köşe anahtarı", "pin": "A5", "deger": "KIRMIZIDA_HIGH"}],
  "servolar": [{"ad": "Kapak servosu", "pin": 3, "hiz_derece_s": 450, "baslangic_aci": 0}],
  "led": {"tip": "iki_pin", "kirmizi_pin": "A3", "mavi_pin": "A4", "x": -7, "y": 0, "z": 8.9},
  "yerlesim": [
   {"ad": "Arduino Uno", "x": 1, "y": 1.5, "z": 8.9, "uzunluk": 6.9, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490"},
   {"ad": "L298N", "x": 4, "y": 0, "z": 4.6, "uzunluk": 4.3, "genislik": 4.3, "kalinlik": 2.5, "renk": "#b91c1c"},
   {"ad": "Pil 2S 18650", "x": -4.5, "y": 0, "z": 4.6, "uzunluk": 4.2, "genislik": 7.6, "kalinlik": 2, "renk": "#1d4ed8"},
   {"ad": "Mini breadboard", "x": -5, "y": 3.5, "z": 8.9, "uzunluk": 4.5, "genislik": 3.4, "kalinlik": 0.9, "renk": "#d1d5db"}]}}
eski = {
 "id": "eski2025", "ad": "Antalya 2026 robotumuz", "renk": "#6d28d9", "aciklama": "Repodaki 21 Ocak Mega + Nano kodları (Antalya 2026). Fotoğrafa göre: 4 teker (hepsi motorlu), 2×18650 pil (7,4 V), sarı gövde, önde içeri giren yumurtanın çıkmasını önleyen kelepçeler, köşelerde MZ80 gözler (kodda 2 tanesi kullanılıyor). Ölçüler, sensör yerleri ve iç hazne TAHMİNİ.",
 "kartlar": [{"id": "mega", "tip": "Mega", "kod": open(os.path.join(HERE, 'ornek_kodlar', 'antalya_mega.ino')).read()}, {"id": "nano", "tip": "Nano", "kod": open(os.path.join(HERE, 'ornek_kodlar', 'antalya_nano.ino')).read()}],
 "kart_baglantilari": [["mega:A0", "nano:A0"], ["mega:A1", "nano:A1"], ["mega:A2", "nano:A2"], ["mega:A3", "nano:A3"], ["mega:A4", "nano:A4"]],
 "mekanik": {"kutle_kg": 2.2, "agirlik_merkezi": {"x_cm": N, "z_cm": 6},
  "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.7, "iz_cm": 23, "x_cm": -2, "adet": 4, "dingil_cm": 14},
  "sarhos_teker": N,
  "motor": {"model": "JGA25-370 12V 280"}, "pil": {"volt": 7.4}, "acil_stop": {"x": 6, "y": 8, "z": 14},
  "parcalar": [
   {"ad": "Gövde", "x": -1, "y": 0, "uzunluk": 24, "genislik": 19, "z0": 2.5, "z1": 12, "renk": "#facc15"},
   {"ad": "Ağız sol", "x": 12.5, "y": 6, "uzunluk": 3, "genislik": 1.5, "z0": 0.4, "z1": 6, "renk": "#334155"},
   {"ad": "Ağız sağ", "x": 12.5, "y": -6, "uzunluk": 3, "genislik": 1.5, "z0": 0.4, "z1": 6, "renk": "#334155"},
   {"ad": "Ağız arka (stoper)", "x": 9.5, "y": 0, "uzunluk": 1, "genislik": 10.5, "z0": 0.3, "z1": 2.4, "renk": "#1f2937"}], "model3d": N,
  "hazne": {"var": T, "agiz": {"x0": 9, "x1": 16, "y0": -4.5, "y1": 4.5},
   "kurallar": [
    {"servo": "nano:10", "min": 150, "max": 180, "ve": {"servo": "nano:11", "min": 130, "max": 180}, "hedef": "yesil"},
    {"servo": "nano:10", "min": 150, "max": 180, "hedef": "bizim"},
    {"servo": "nano:10", "min": 0, "max": 30, "hedef": "disari"}],
   "bolmeler": [
    {"ad": "bizim", "kapasite": 5, "kapak": "mega:A8", "acik_min": 60, "acik_max": 180, "cikis": {"x": -15, "y": 3}},
    {"ad": "yesil", "kapasite": 2, "kapak": "mega:A9", "acik_min": 80, "acik_max": 180, "cikis": {"x": -15, "y": -4}}],
   "disari": {"x": 4, "y": -14, "hiz_cms": 40}}},
 "devre": {
  "surucu": {"tip": "BTS7960", "sol": {"en": "mega:7", "rpwm": "mega:5", "lpwm": "mega:6"}, "sag": {"en": "mega:2", "rpwm": "mega:3", "lpwm": "mega:4"}, "sol_ters": T, "sag_ters": F},
  "sensorler": [
   {"tip": "IR_ENGEL", "ad": "Sol göz (MZ80)", "pin": "mega:22", "x": 12, "y": 8, "z": 4, "aci": 10, "menzil_cm": 20},
   {"tip": "IR_ENGEL", "ad": "Sağ göz (MZ80)", "pin": "mega:24", "x": 12, "y": -8, "z": 4, "aci": -10, "menzil_cm": 20},
   {"tip": "TCS3200", "ad": "Zemin renk (Mega)", "s0": "mega:52", "s1": "mega:50", "s2": "mega:46", "s3": "mega:48", "out": "mega:44", "x": 10, "y": 0, "z": 1, "bakis": "asagi"},
   {"tip": "TCS3200", "ad": "Ağız renk (Nano)", "s0": "nano:3", "s1": "nano:4", "s2": "nano:5", "s3": "nano:6", "out": "nano:2", "x": 11.5, "y": 0, "z": 1, "bakis": "ileri", "menzil_cm": 2.5},
   {"tip": "IR_ENGEL", "ad": "Ağız sensörü", "pin": "nano:12", "ters": T, "x": 11.5, "y": -4, "z": 1, "aci": 90, "menzil_cm": 8},
   {"tip": "BUTON", "ad": "Bölge anahtarı (Mega)", "pin": "mega:A14", "deger": "KIRMIZIDA_HIGH"},
   {"tip": "BUTON", "ad": "Bölge anahtarı (Nano)", "pin": "nano:8", "deger": "KIRMIZIDA_HIGH"}],
  "servolar": [{"ad": "Rakip kapağı", "pin": "mega:A7", "baslangic_aci": 180}, {"ad": "Bizim kapak", "pin": "mega:A8", "baslangic_aci": 0}, {"ad": "Yeşil kapak", "pin": "mega:A9", "baslangic_aci": 0}, {"ad": "Tokat", "pin": "nano:10", "baslangic_aci": 90}, {"ad": "Yeşil tokat", "pin": "nano:11", "baslangic_aci": 70}],
  "led": {"tip": "NeoPixel", "pin": "mega:42", "x": -6, "y": 0, "z": 12},
  "yerlesim": [
   {"ad": "Arduino Mega", "x": -3, "y": 0, "z": 12, "uzunluk": 10.2, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490"},
   {"ad": "Arduino Nano", "x": 5, "y": 4, "z": 12, "uzunluk": 4.5, "genislik": 1.8, "kalinlik": 1, "renk": "#0369a1"},
   {"ad": "BTS7960 sol", "x": 4, "y": -5, "z": 12, "uzunluk": 5, "genislik": 5, "kalinlik": 2.5, "renk": "#b91c1c"},
   {"ad": "BTS7960 sağ", "x": -9, "y": -5, "z": 12, "uzunluk": 5, "genislik": 5, "kalinlik": 2.5, "renk": "#b91c1c"}]}}
# Videoda görülen dört tekerli, üstü açık yarış robotunun TEMSİLİ profili.
# Motor/sensör ölçüleri ve yarış kodu gerçek robotun doğrulanmış değerleri değildir.
video = copy.deepcopy(yum)
video["id"] = "video2026"
video["ad"] = "Video yarış robotu (temsili)"
video["renk"] = "#eab308"
video["aciklama"] = "25 Kasım 2026 yarış videosundaki açık şasili, dört tekerli robotun yaklaşık dış görünümü. Motor, sensör ve ölçüler temsili; robotunuzun gerçek verilerini girin."
vm = video["mekanik"]
vm["video_on_rev"] = 2
vm["kutle_kg"] = 1.6
vm["agirlik_merkezi"] = {"x_cm": 0, "z_cm": 4.5}
vm["tekerlek"] = {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.2, "iz_cm": 17, "x_cm": 0, "adet": 4, "dingil_cm": 12}
# Temsili dört tekerli şasi için örnek yüksek torklu motor; gerçek robotun motoru bilinmiyor.
vm["motor"] = {"model": "JGB37-520 12V 107"}
vm["sarhos_teker"] = N
vm["acil_stop"] = {"x": -6, "y": 0, "z": 8}
vm["parcalar"] = [
    {"ad": "Alçak açık şasi", "x": 0, "y": 0, "uzunluk": 19, "genislik": 13, "z0": 3.2, "z1": 3.8, "renk": "#30343b"},
    {"ad": "Sol yan koruma", "x": 0, "y": 6.6, "uzunluk": 18, "genislik": 0.6, "z0": 2.6, "z1": 4.7, "renk": "#eab308"},
    {"ad": "Sağ yan koruma", "x": 0, "y": -6.6, "uzunluk": 18, "genislik": 0.6, "z0": 2.6, "z1": 4.7, "renk": "#eab308"},
    {"ad": "Ön üst travers", "x": 9.5, "y": 0, "uzunluk": 0.8, "genislik": 12.8, "z0": 3.15, "z1": 4.0, "renk": "#facc15"},
    {"ad": "Ön LED şeridi (sabit)", "x": 9.65, "y": 0, "uzunluk": 0.25, "genislik": 10, "z0": 4.0, "z1": 4.3, "renk": "#ef4444", "kati": F},
    {"ad": "Arka elektronik kafesi (görsel)", "x": -5.8, "y": 0, "uzunluk": 5.5, "genislik": 9, "z0": 3.8, "z1": 7, "renk": "#374151", "kati": F}
]
video["devre"]["servolar"] = []  # Videoda olmayan açılır ön kapak modelinden çıkarıldı.
video["devre"]["sensorler"] = copy.deepcopy(yum["devre"]["sensorler"])
for sensor in video["devre"]["sensorler"]:
    if sensor["tip"] == "HC-SR04": sensor["x"], sensor["z"] = 8, 4.4
    if sensor["tip"] == "TCS3200": sensor["x"], sensor["z"] = 8.9, 1.2
video["devre"]["yerlesim"] = [
    {"ad": "Arduino Uno", "x": -2, "y": 1.5, "z": 3.8, "uzunluk": 6.9, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490"},
    {"ad": "Motor sürücüsü", "x": 4.5, "y": -1.2, "z": 3.8, "uzunluk": 4, "genislik": 4, "kalinlik": 2, "renk": "#b91c1c"},
    {"ad": "Pil grubu", "x": -5.5, "y": -3, "z": 3.8, "uzunluk": 5, "genislik": 3, "kalinlik": 2.3, "renk": "#1d4ed8"}
]
rakip_code = open(os.path.join(HERE, 'rakip.ino')).read()
# Ön kapak servo algoritması bu video profiline uygun değildir; temsili dolaşma örneği kullanılır.
video["kartlar"][0]["kod"] = rakip_code
rakip = {"id": "rakip", "ad": "Basit rakip", "renk": "#2563eb", "aciklama": "Rastgele dolaşan basit rakip robot.",
 "kartlar": [{"id": "ana", "tip": "Uno", "kod": rakip_code}], "kart_baglantilari": [],
 "mekanik": {"kutle_kg": 0.9, "agirlik_merkezi": {"x_cm": N, "z_cm": 4}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.6, "iz_cm": 15, "x_cm": 0}, "sarhos_teker": {"x_cm": -8, "y_cm": 0, "cap_cm": 1.6}, "motor": {"model": "TT 1:48 6V"}, "pil": {"volt": 7.4}, "acil_stop": {"x": -3, "y": 3, "z": 7},
  "parcalar": [{"ad": "Şasi", "x": 0, "y": 0, "uzunluk": 20, "genislik": 12, "z0": 2.5, "z1": 7, "renk": "#3b82f6"}, {"ad": "Tampon", "x": 10.5, "y": 0, "uzunluk": 1, "genislik": 16, "z0": 0.5, "z1": 5, "renk": "#1e3a8a"}], "model3d": N},
 "devre": {"surucu": {"tip": "L298N", "sol": {"en": 5, "in1": 7, "in2": 8}, "sag": {"en": 6, "in1": 9, "in2": 10}},
  "sensorler": [{"tip": "HC-SR04", "ad": "Ultrasonik", "trig": 11, "echo": 12, "x": 9, "y": 0, "z": 6, "aci": 0}, {"tip": "BUTON", "ad": "Köşe anahtarı", "pin": "A5", "deger": "KIRMIZIDA_HIGH"}], "servolar": [],
  "led": {"tip": "iki_pin", "kirmizi_pin": "A3", "mavi_pin": "A4", "x": -4, "y": 0, "z": 7},
  "yerlesim": [{"ad": "Arduino Uno", "x": -2, "y": 0, "z": 7, "uzunluk": 6.9, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490"}]}}
open(os.path.join(HERE, 'profiles.js'), 'w').write('const DEFAULT_PROFILES = ' + json.dumps([yum, eski, rakip, video], ensure_ascii=False, indent=1) + ';\nif (typeof module !== "undefined") module.exports = { DEFAULT_PROFILES };\n')
print('ok')
