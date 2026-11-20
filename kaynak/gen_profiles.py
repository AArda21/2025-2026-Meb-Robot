import json
d = open('/home/claude/defaults.js').read()
code = d[d.index('const DEFAULT_CODE = `') + len('const DEFAULT_CODE = `'):d.rindex('`;')]
F = False; T = True; N = None
yum = {
 "id": "yumyum", "ad": "Yum Yum", "renk": "#f08c00", "aciklama": "Takımın bu yılki robotu (örnek değerlerle başlar — kendi ölçülerinizi girin).",
 "kartlar": [{"id": "ana", "tip": "Uno", "kod": code}],
 "kart_baglantilari": [],
 "mekanik": {
  "kutle_kg": 1.1, "agirlik_merkezi": {"x_cm": N, "z_cm": 5},
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
   {"ad": "Kepçe arka", "x": 10, "y": 0, "uzunluk": 1, "genislik": 12, "z0": 0.3, "z1": 4.3, "renk": "#374151"},
   {"ad": "Sol kol", "x": 14.25, "y": 6, "uzunluk": 7.5, "genislik": 1, "z0": 0.3, "z1": 4.3, "renk": "#374151"},
   {"ad": "Sağ kol", "x": 14.25, "y": -6, "uzunluk": 7.5, "genislik": 1, "z0": 0.3, "z1": 4.3, "renk": "#374151"},
   {"ad": "SG90 servo", "x": 16.5, "y": 6.3, "uzunluk": 2.3, "genislik": 1.2, "z0": 4.3, "z1": 6.6, "renk": "#2563eb", "kati": F},
   {"ad": "Kapak", "servo_pin": 3, "pivot": [18, 5.5], "uzunluk": 11, "genislik": 0.8, "aci_ofset": -90, "yon": 1, "z0": 0.3, "z1": 4, "renk": "#f59e0b"}
  ], "model3d": N},
 "devre": {
  "surucu": {"tip": "L298N", "sol": {"en": 5, "in1": 7, "in2": 8}, "sag": {"en": 6, "in1": 9, "in2": 10}, "sol_ters": F, "sag_ters": F},
  "sensorler": [
   {"tip": "HC-SR04", "ad": "Ön ultrasonik", "trig": 11, "echo": 12, "x": 9.3, "y": 0, "z": 6.5, "aci": 0},
   {"tip": "IR_ENGEL", "ad": "Sol IR", "pin": 2, "x": 8, "y": 7.5, "z": 1.5, "aci": 40, "menzil_cm": 14},
   {"tip": "IR_ENGEL", "ad": "Sağ IR", "pin": 4, "x": 8, "y": -7.5, "z": 1.5, "aci": -40, "menzil_cm": 14},
   {"tip": "TCRT5000", "ad": "Zemin", "pin": "A0", "x": 2, "y": 0, "z": 1, "esik": 500},
   {"tip": "TCS3200", "ad": "Renk (kepçe)", "s2": "A1", "s3": "A2", "out": 13, "olcek": 20, "x": 10.6, "y": 0, "z": 1, "aci": 0, "bakis": "ileri", "menzil_cm": 2.5}],
  "servolar": [{"ad": "Kapak servosu", "pin": 3, "hiz_derece_s": 450, "baslangic_aci": 0}],
  "led": {"tip": "iki_pin", "kirmizi_pin": "A3", "mavi_pin": "A4", "x": -7, "y": 0, "z": 8.9},
  "yerlesim": [
   {"ad": "Arduino Uno", "x": 1, "y": 1.5, "z": 8.9, "uzunluk": 6.9, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490"},
   {"ad": "L298N", "x": 4, "y": 0, "z": 4.6, "uzunluk": 4.3, "genislik": 4.3, "kalinlik": 2.5, "renk": "#b91c1c"},
   {"ad": "Pil 2S 18650", "x": -4.5, "y": 0, "z": 4.6, "uzunluk": 4.2, "genislik": 7.6, "kalinlik": 2, "renk": "#1d4ed8"},
   {"ad": "Mini breadboard", "x": -5, "y": 3.5, "z": 8.9, "uzunluk": 4.5, "genislik": 3.4, "kalinlik": 0.9, "renk": "#d1d5db"}]}}
eski = {
 "id": "eski2025", "ad": "Eski robot (2025)", "renk": "#6d28d9", "aciklama": "Repodaki 21 Ocak Mega + Nano kodları. Mekanik ölçüler ve sensör yerleri TAHMİNİ.",
 "kartlar": [{"id": "mega", "tip": "Mega", "kod": open('/tmp/eski/mega.ino').read()}, {"id": "nano", "tip": "Nano", "kod": open('/tmp/eski/nano.ino').read()}],
 "kart_baglantilari": [["mega:A0", "nano:A0"], ["mega:A1", "nano:A1"], ["mega:A2", "nano:A2"], ["mega:A3", "nano:A3"], ["mega:A4", "nano:A4"]],
 "mekanik": {"kutle_kg": 2.2, "agirlik_merkezi": {"x_cm": N, "z_cm": 6},
  "tekerlek": {"lastik": "kaucuk", "cap_cm": 7, "genislik_cm": 3, "iz_cm": 22, "x_cm": 0},
  "sarhos_teker": {"x_cm": -10, "y_cm": 0, "cap_cm": 2},
  "motor": {"model": "JGA25-370 12V 280"}, "pil": {"volt": 11.1}, "acil_stop": {"x": -6, "y": -6, "z": 12},
  "parcalar": [
   {"ad": "Gövde", "x": -1, "y": 0, "uzunluk": 24, "genislik": 19, "z0": 2.5, "z1": 12, "renk": "#64748b"},
   {"ad": "Ağız sol", "x": 12.5, "y": 6, "uzunluk": 3, "genislik": 1.5, "z0": 0.4, "z1": 6, "renk": "#334155"},
   {"ad": "Ağız sağ", "x": 12.5, "y": -6, "uzunluk": 3, "genislik": 1.5, "z0": 0.4, "z1": 6, "renk": "#334155"}], "model3d": N},
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
rakip_code = open('/home/claude/v3/rakip.ino').read()
rakip = {"id": "rakip", "ad": "Basit rakip", "renk": "#2563eb", "aciklama": "Rastgele dolaşan basit rakip robot.",
 "kartlar": [{"id": "ana", "tip": "Uno", "kod": rakip_code}], "kart_baglantilari": [],
 "mekanik": {"kutle_kg": 0.9, "agirlik_merkezi": {"x_cm": N, "z_cm": 4}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.6, "iz_cm": 15, "x_cm": 0}, "sarhos_teker": {"x_cm": -8, "y_cm": 0, "cap_cm": 1.6}, "motor": {"model": "TT 1:48 6V"}, "pil": {"volt": 7.4}, "acil_stop": {"x": -3, "y": 3, "z": 7},
  "parcalar": [{"ad": "Şasi", "x": 0, "y": 0, "uzunluk": 20, "genislik": 12, "z0": 2.5, "z1": 7, "renk": "#3b82f6"}, {"ad": "Tampon", "x": 10.5, "y": 0, "uzunluk": 1, "genislik": 16, "z0": 0.5, "z1": 5, "renk": "#1e3a8a"}], "model3d": N},
 "devre": {"surucu": {"tip": "L298N", "sol": {"en": 5, "in1": 7, "in2": 8}, "sag": {"en": 6, "in1": 9, "in2": 10}},
  "sensorler": [{"tip": "HC-SR04", "ad": "Ultrasonik", "trig": 11, "echo": 12, "x": 9, "y": 0, "z": 6, "aci": 0}], "servolar": [],
  "led": {"tip": "iki_pin", "mavi_pin": "A4", "x": -4, "y": 0, "z": 7},
  "yerlesim": [{"ad": "Arduino Uno", "x": -2, "y": 0, "z": 7, "uzunluk": 6.9, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490"}]}}
open('/home/claude/v3/profiles.js', 'w').write('const DEFAULT_PROFILES = ' + json.dumps([yum, eski, rakip], ensure_ascii=False, indent=1) + ';\nif (typeof module !== "undefined") module.exports = { DEFAULT_PROFILES };\n')
print('ok')
