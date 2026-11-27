const DEFAULT_PROFILES = [
 {
  "id": "yumyum",
  "ad": "Yum Yum",
  "renk": "#f08c00",
  "aciklama": "Yarışma videosuna uygun sade ön şasili örnek robot. Gerçek robotun iç mekanizması, sensör ve motor ölçüleri videodan doğrulanamaz; ölçüleri düzenleyin.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Yum Yum — örnek strateji (2026 kuralları)\n// 1) ARA: sahada dolaş, kepçeye giren yumurtanın rengine bak\n// 2) Kendi rengimiz ya da yeşilse kapağı kapat, yumurtayı tut\n// 3) EVE: duvarı sola alıp duvar takibi yap; zemin sensörü hedef köşenin rengini görünce bırak\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define IR_SOL 2\n#define IR_SAG 4\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define KAPAK_ACIK 90\n#define KAPAK_KAPALI 0\n\n// zemin (TCRT5000 analog) eşikleri — kendi ölçümlerinle güncelle\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo kapak;\nbool TAKIM_KIRMIZI = true;\nint durum = 0;          // 0 = ARA, 1 = EVE (duvar takibi)\nint hedef = 0;          // EVE durumunda hedef zemin: 1 kırmızı, 2 mavi, 3 yeşil\nunsigned long durumZamani = 0;\nunsigned long sonYazdirma = 0;\nbool duvarBulundu = false;\nlong sonMesafe = 0;\nunsigned long sonKontrol = 0;\nint ayniSayac = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol));\n  analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  if (sure == 0) return 999;\n  return sure / 58;\n}\n\nint renkOku(int s2, int s3) {\n  digitalWrite(S2, s2);\n  digitalWrite(S3, s3);\n  delay(2);\n  return pulseIn(RENK_OUT, LOW);\n}\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW);\n  int b = renkOku(LOW, HIGH);\n  int g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid donSaga(int ms) { motorlar(170, -170); delay(ms); }\nvoid donSola(int ms) { motorlar(-170, 170); delay(ms); }\n\nvoid durumDegistir(int yeni) {\n  durum = yeni;\n  durumZamani = millis();\n  duvarBulundu = false;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);\n  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);\n  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  kapak.attach(3);\n  kapak.write(KAPAK_KAPALI);\n  delay(200);\n  kapak.write(KAPAK_ACIK);\n  // köşeden sahanın ortasına doğru çık\n  motorlar(200, 200);\n  delay(700);\n  durumDegistir(0);\n  Serial.println(TAKIM_KIRMIZI ? \"Takim: KIRMIZI\" : \"Takim: MAVI\");\n}\n\nvoid ara() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int renk = yumurtaRengi();\n  if (renk == benim || renk == 3) {\n    motorlar(0, 0);\n    kapak.write(KAPAK_KAPALI);       // yumurtayı kepçeye hapset\n    delay(250);\n    hedef = renk;\n    Serial.print(\"Yumurta alindi, hedef=\");\n    Serial.println(hedef);\n    durumDegistir(1);\n    return;\n  }\n  if (renk != 0) {                   // rakip rengi: geri çekilip bırak\n    motorlar(-180, -180);\n    delay(350);\n    donSaga(250);\n    return;\n  }\n  if (zeminRengi() != 0 && millis() > 3000) {   // ararken köşelere girme (yanlış yumurta itmeyelim)\n    motorlar(-180, -180);\n    delay(300);\n    donSaga(random(300, 600));\n    return;\n  }\n  long d = mesafeCm();\n  bool solVar = digitalRead(IR_SOL) == LOW;\n  bool sagVar = digitalRead(IR_SAG) == LOW;\n  if (d < 25) {\n    motorlar(-170, -170);\n    delay(200);\n    donSaga(random(250, 600));\n  } else if (solVar && !sagVar) {\n    motorlar(120, 200);\n  } else if (sagVar && !solVar) {\n    motorlar(200, 120);\n  } else {\n    motorlar(190, 190);\n  }\n}\n\nvoid eve() {\n  // hedef köşeye geldik mi?\n  if (zeminRengi() == hedef) {\n    // Duvar boyunca önümüze yığılan başka yumurtaları köşeye itmemek için:\n    // biraz geri çekil, hafif sağa dön ve kepçeyle köşeye öyle gir.\n    motorlar(-160, -160);\n    delay(200);\n    donSaga(140);\n    motorlar(130, 130);\n    delay(300);\n    motorlar(0, 0);\n    kapak.write(KAPAK_ACIK);\n    delay(250);\n    motorlar(-180, -180);             // yumurtayı köşede bırakıp geri çekil\n    delay(500);\n    donSaga(450);\n    Serial.println(\"Yumurta birakildi\");\n    durumDegistir(0);\n    return;\n  }\n  long d = mesafeCm();\n  bool solDuvar = digitalRead(IR_SOL) == LOW;\n  if (!duvarBulundu) {               // önce bir duvar bul\n    if (d < 18) { donSaga(320); duvarBulundu = true; }\n    else motorlar(190, 190);\n    return;\n  }\n  if (d < 16) {                      // köşe: sağa dön, duvar solda kalsın\n    motorlar(-150, -150);\n    delay(120);\n    donSaga(330);\n  } else if (solDuvar) {\n    motorlar(200, 130);              // duvara çok yakın: hafif sağa\n  } else {\n    motorlar(120, 200);              // duvarı kaybettik: sola yanaş\n  }\n  if (millis() - durumZamani > 40000) {   // çok uzun sürdü: bırak, yeniden ara\n    kapak.write(KAPAK_ACIK);\n    durumDegistir(0);\n  }\n}\n\n// Sıkışma kontrolü: ileri giderken mesafe 1.5 sn boyunca değişmiyorsa geri çık\nvoid sikismaKontrol() {\n  if (millis() - sonKontrol < 500) return;\n  sonKontrol = millis();\n  long d = mesafeCm();\n  if (d < 900 && abs(d - sonMesafe) < 2) ayniSayac++; else ayniSayac = 0;\n  sonMesafe = d;\n  if (ayniSayac >= 3) {\n    Serial.println(\"Sikisma! geri cikiliyor\");\n    motorlar(-200, -200);\n    delay(450);\n    donSaga(random(250, 550));\n    ayniSayac = 0;\n    if (durum == 1) duvarBulundu = false;\n  }\n}\n\nvoid loop() {\n  sikismaKontrol();\n  if (durum == 0) ara(); else eve();\n  if (millis() - sonYazdirma > 500) {\n    sonYazdirma = millis();\n    Serial.print(\"durum=\");\n    Serial.print(durum);\n    Serial.print(\" zemin=\");\n    Serial.print(analogRead(ZEMIN));\n    Serial.print(\" mesafe=\");\n    Serial.println(mesafeCm());\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "video_on_rev": 1,
   "kutle_kg": 1.1,
   "agirlik_merkezi": {
    "x_cm": null,
    "z_cm": 5
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.6,
    "iz_cm": 17,
    "x_cm": -2
   },
   "sarhos_teker": {
    "x_cm": -8,
    "y_cm": 0,
    "cap_cm": 1.6
   },
   "motor": {
    "model": "TT 1:48 6V"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": 2,
    "y": -4,
    "z": 8.9
   },
   "parcalar": [
    {
     "ad": "Sol TT motor",
     "x": -2,
     "y": 4.9,
     "uzunluk": 7,
     "genislik": 2.2,
     "z0": 2.2,
     "z1": 4.3,
     "renk": "#f2c230"
    },
    {
     "ad": "Sağ TT motor",
     "x": -2,
     "y": -4.9,
     "uzunluk": 7,
     "genislik": 2.2,
     "z0": 2.2,
     "z1": 4.3,
     "renk": "#f2c230"
    },
    {
     "ad": "Alt pleksi plaka",
     "x": 0,
     "y": 0,
     "uzunluk": 19,
     "genislik": 14,
     "z0": 4.3,
     "z1": 4.6,
     "renk": "#cfe3f0"
    },
    {
     "ad": "Direk 1",
     "sekil": "silindir",
     "x": 7,
     "y": 6,
     "uzunluk": 0.6,
     "genislik": 0.6,
     "z0": 4.6,
     "z1": 8.6,
     "renk": "#c9a227"
    },
    {
     "ad": "Direk 2",
     "sekil": "silindir",
     "x": 7,
     "y": -6,
     "uzunluk": 0.6,
     "genislik": 0.6,
     "z0": 4.6,
     "z1": 8.6,
     "renk": "#c9a227"
    },
    {
     "ad": "Direk 3",
     "sekil": "silindir",
     "x": -7.5,
     "y": 6,
     "uzunluk": 0.6,
     "genislik": 0.6,
     "z0": 4.6,
     "z1": 8.6,
     "renk": "#c9a227"
    },
    {
     "ad": "Direk 4",
     "sekil": "silindir",
     "x": -7.5,
     "y": -6,
     "uzunluk": 0.6,
     "genislik": 0.6,
     "z0": 4.6,
     "z1": 8.6,
     "renk": "#c9a227"
    },
    {
     "ad": "Üst pleksi plaka",
     "x": -0.5,
     "y": 0,
     "uzunluk": 18,
     "genislik": 15,
     "z0": 8.6,
     "z1": 8.9,
     "renk": "#cfe3f0"
    },
    {
     "ad": "Ön şasi kenarı",
     "x": 9,
     "y": 0,
     "uzunluk": 0.7,
     "genislik": 12,
     "z0": 2.4,
     "z1": 4.3,
     "renk": "#64748b"
    }
   ],
   "model3d": null
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 9.3,
     "y": 0,
     "z": 6.5,
     "aci": 0
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sol IR",
     "pin": 2,
     "x": 8,
     "y": 7.5,
     "z": 1.5,
     "aci": 40,
     "menzil_cm": 14
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ IR",
     "pin": 4,
     "x": 8,
     "y": -7.5,
     "z": 1.5,
     "aci": -40,
     "menzil_cm": 14
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "TCS3200",
     "ad": "Ön renk sensörü (temsili)",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 8.8,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Kapak servosu",
     "pin": 3,
     "hiz_derece_s": 450,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -7,
    "y": 0,
    "z": 8.9
   },
   "yerlesim": [
    {
     "ad": "Arduino Uno",
     "x": 1,
     "y": 1.5,
     "z": 8.9,
     "uzunluk": 6.9,
     "genislik": 5.3,
     "kalinlik": 1.3,
     "renk": "#0e7490"
    },
    {
     "ad": "L298N",
     "x": 4,
     "y": 0,
     "z": 4.6,
     "uzunluk": 4.3,
     "genislik": 4.3,
     "kalinlik": 2.5,
     "renk": "#b91c1c"
    },
    {
     "ad": "Pil 2S 18650",
     "x": -4.5,
     "y": 0,
     "z": 4.6,
     "uzunluk": 4.2,
     "genislik": 7.6,
     "kalinlik": 2,
     "renk": "#1d4ed8"
    },
    {
     "ad": "Mini breadboard",
     "x": -5,
     "y": 3.5,
     "z": 8.9,
     "uzunluk": 4.5,
     "genislik": 3.4,
     "kalinlik": 0.9,
     "renk": "#d1d5db"
    }
   ]
  }
 },
 {
  "id": "eski2025",
  "ad": "Antalya 2026 robotumuz",
  "renk": "#6d28d9",
  "aciklama": "Repodaki 21 Ocak Mega + Nano kodları (Antalya 2026). Mega kodu: derleme hatası düzeltilmiş ve depoda yorum satırında kalan oyun mantığı açılmış hâli (ornek_kodlar/antalya_mega_oyun.ino); orijinali antalya_mega.ino. Görünüş ve ölçüler 27 Kasım fotoğraflarından: sarı 3B baskı şasi, 4 motorlu teker (Ø7,5 cm), önde tek yönlü kapakçık sırası ve iç huni, ortada tokatlı ayıklayıcı, yan ve arka çıkış kapıları, 2 BTS7960, 8 adet 18650 (4S2P, 14,8 V varsayıldı), köşelerde 2şer MZ80 (üstteki kodda kullanılıyor), NeoPixel şerit. Motor modeli, kütle ve iç kanal derinliği hâlâ tahmini.",
  "kartlar": [
   {
    "id": "mega",
    "tip": "Mega",
    "kod": "// Antalya 2026 Mega kodu — OYUN MODU (simülatör için hazırlandı)\n// antalya_mega_duzeltilmis.ino ile aynı; sadece setup() sonundaki başlangıç ve loop() içindeki oyun mantığı yorumdan çıkarıldı.\n#include<Servo.h>\n#include <Adafruit_NeoPixel.h>\n\nServo bizim;\nServo rakip;\nServo yesilServo;   // DÜZELTME: 'yesil' adı aşağıdaki float yesil ile çakışıyordu (derleme hatası)\n\n// HABERLEŞME\n#define sayac_bildirim A0\n#define yesil_bildirim A1\n#define kilit_sinyal A2\n#define yesil_tokatla_sinyal A3\n#define otur_bildirim A4\n\n// Sağ motor pinleri\n#define EN_R 2\n#define RPWM_R 3\n#define LPWM_R 4\n\n// Sol motor pinleri\n#define RPWM_L 5\n#define LPWM_L 6\n#define EN_L 7\n\n#define sol_goz 22\n#define sag_goz 24\n\n#define s0 52\n#define s1 50\n#define s2 46\n#define s3 48\n#define out 44\n\n#define LED_PIN 42\n#define LED_COUNT  8 // LED sayısı\n#define KIRMIZI 1\n#define MAVI 0\n#define BIZIM_TOPU_BIRAK 1\n#define YESIL_BIRAK 0\n\nAdafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);\n\nfloat kirmizi = 0, mavi = 0, yesil = 0;\nint kirmizi_veriler[4] = { 0, 0, 0, 0 };\nint mavi_veriler[4] = { 0, 0, 0, 0 };\nint yesil_veriler[4] = { 0, 0, 0, 0 };\nint mavi_ust_limit = 60, kirmizi_alt_limit = 300, yesil_alt_limit=70, yesil_ust_limit=80;\nbyte bolge = 0, duvarla_isim_var = 0;\n\nbyte bizim_kapak_default = 0, yesil_kapak_default = 0;\n\nvoid setup() {\n  // SERVO TANIMLARI\n  rakip.attach(A7);\n  bizim.attach(A8);\n  yesilServo.attach(A9);\n  bizim.write(bizim_kapak_default);\n  rakip.write(180);\n  yesilServo.write(yesil_kapak_default);\n\n  // MZ80 TANIMLARI\n  pinMode(sol_goz, INPUT);\n  pinMode(sag_goz, INPUT);\n\n  //RENK SENSÖRÜ TANIMLARI\n  pinMode(s0, OUTPUT);\n  pinMode(s1, OUTPUT);\n  pinMode(s2, OUTPUT);\n  pinMode(s3, OUTPUT);\n  pinMode(out, INPUT);\n\n  // Sağ motor pin tanımları\n  pinMode(EN_R, OUTPUT);\n  pinMode(RPWM_R, OUTPUT);\n  pinMode(LPWM_R, OUTPUT);\n\n  // Sol motor pin tanımları\n  pinMode(EN_L, OUTPUT);\n  pinMode(RPWM_L, OUTPUT);\n  pinMode(LPWM_L, OUTPUT);\n\n  //HABERLEŞME PİNLERİ\n  pinMode(sayac_bildirim, INPUT);\n  pinMode(yesil_bildirim, INPUT);\n  pinMode(otur_bildirim, INPUT);\n  pinMode(kilit_sinyal, OUTPUT);\n  pinMode(yesil_tokatla_sinyal, OUTPUT);\n\n  // Motor sürücülerini aktif et\n  digitalWrite(EN_R, HIGH);\n  digitalWrite(EN_L, HIGH);\n\n  digitalWrite(s0, HIGH);\n  digitalWrite(s1, LOW);\n\n  //NEOPİXEL\n  pinMode(A14, INPUT);\n  bolge = digitalRead(A14);\n  strip.begin();\n  strip.show();\n\n  for (int i = 0; i < LED_COUNT; i++) {\n    if (bolge == KIRMIZI)\n    {\n      strip.setPixelColor(i, strip.Color(255, 0, 0)); // kırmızı\n    }\n    else\n    {\n      strip.setPixelColor(i, strip.Color(0, 0, 255)); // mavi\n    }\n  }\n  strip.show();\n\n  Serial.begin(9600);\n  // OYUN MODU: elini sağ gözün önünden çekince başlar\n  while(digitalRead(sag_goz) == 0);\n  basla();\n}\n\nvoid loop() {\n  // OYUN MODU: depodaki 21 Ocak kodunda bu bölüm yorum satırındaydı ve loop() sadece olcum() çağırıyordu (test modu).\n  if (digitalRead(sayac_bildirim) == 1)\n  {\n    digitalWrite(kilit_sinyal, HIGH);\n    duvarla_isim_var = 1;\n    while(duvarla_isim_var == 1)\n    {\n      duvar_takip(BIZIM_TOPU_BIRAK);\n    }\n    digitalWrite(kilit_sinyal, LOW);\n    delay(2000);\n  }\n  else if (digitalRead(yesil_bildirim) == 1)\n  {\n    digitalWrite(kilit_sinyal, HIGH);\n    duvarla_isim_var = 1;\n    while(duvarla_isim_var == 1)\n    {\n      duvar_takip(YESIL_BIRAK);   // DÜZELTME: yesil_BIRAK diye bir şey yok, YESIL_BIRAK olmalı\n    }\n    digitalWrite(kilit_sinyal, LOW);\n    delay(2000);\n  }\n  else if(digitalRead(otur_bildirim) == 1)\n  {\n    duvar_takip_otur();\n  }\n  else\n  {\n    rastgele();\n  }\n}\n\nvoid goz_okuma()\n{\n  Serial.print(\"Sol göz: \");\n  Serial.println(digitalRead(sol_goz));\n  Serial.print(\"Saü göz: \");\n  Serial.println(digitalRead(sag_goz));\n  Serial.print(\"\\n\\n\\n\");\n  delay(300);\n}\n\nvoid rastgele()\n{\n  if (digitalRead(sol_goz) == 0)\n  {\n    sag(80);\n    delay(600);\n  }\n  else if (digitalRead(sag_goz) == 0)\n  {\n    sag(80);\n    delay(800);\n  }\n  else\n  {\n    ileri(100);\n  }\n}\n\nvoid duvar_takip(byte nereye)\n{\n  if (digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 0)\n  {\n    dur(200);\n    int sonuc = olcum();\n\n    /* AŞAĞIDAKİ IF KOŞULUNUN TÜRKÇE MEALİ :)\n     * MAVİ BÖLGE OKUDUK: KIRMIZI KÖŞEYİZ(bolge = KIRMIZI = 1) ve CEZA BIRAKACAĞIZ(nereye = CEZA_BIRAK = 0) --> bolge(1) != nereye(0)\n     * MAVİ BÖLGE OKUDUK: MAVİ KÖŞEYİZ(bolge = MAVI = 0) ve BİZİM TOPU BIRAKACAĞIZ(nereye = BIZIM_TOPU_BIRAK = 1) --> bolge(0) != nereye(1)\n     * KIRMIZI BÖLGE OKUDUK: KIRMIZI KÖŞEYİZ(bolge = KIRMIZI = 1) ve BİZİM TOPU BIRAKACAĞIZ(nereye = BIZIM_TOPU_BIRAK = 1) --> bolge(1) == nereye(1)\n     * KIRMIZI BÖLGE OKUDUK: MAVİ KÖŞEYİZ(bolge = MAVI = 0) ve CEZA BIRAKACAĞIZ(nereye = CEZA_BIRAK = 0) --> bolge(0) == nereye(0)\n     * GERİ KALAN HİÇBİR KOŞULDA IF'İN İÇİNE GİRİLİP PARK YAPILMAZ DUVAR TAKİBE DEVAM EDİLİR <3\n     */\n     if(nereye == 1){\n    if ( (sonuc < mavi_ust_limit == bolge ) || (sonuc > kirmizi_alt_limit == bolge) )\n    {\n      dur(200);\n      park(1);\n    }\n    }\n    else{\n      if(sonuc<yesil_ust_limit && sonuc>yesil_alt_limit){\n        dur(200);\n        park(0);\n      }\n    }\n    while (digitalRead(sag_goz) == 0)\n    {\n      sol(100);\n    }\n    \n    dur(200);\n  }\n  else if(digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 1)\n  {\n    unsigned long firstMillis = millis();\n    while (digitalRead(sag_goz) == 1)\n    {\n      if( (millis() - firstMillis) > 3000)\n      {\n        ileri(100);\n        delay(300);\n        break;\n      }\n      sol(100);\n    }\n  }\n  else\n  {\n    if (digitalRead(sag_goz) == 1) //SAĞA YANAŞ\n    {\n      ileri(150, 100);\n    }\n    else\n    {\n      ileri(100, 150);\n    }\n  }\n}\n\nvoid duvar_takip_otur()\n{\n  if (digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 0)\n  {\n    dur(200);\n    int sonuc = olcum();\n    if ( (sonuc < mavi_ust_limit && bolge == KIRMIZI) || (sonuc > kirmizi_alt_limit && bolge == MAVI) )\n    {\n      ileri(80);\n      delay(250);\n      dur(0);\n      delay(100);\n      geri(80);\n      delay(200);\n      dur(0);\n      while(1); // OTURDUK BEKLİYORUZ\n    }\n    \n    while (digitalRead(sag_goz) == 0)\n    {\n      sol(100);\n    }\n    \n    dur(200);\n  }\n  else if(digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 1)\n  {\n    unsigned long firstMillis = millis();\n    while (digitalRead(sag_goz) == 1)\n    {\n      if( (millis() - firstMillis) > 3000)\n      {\n        ileri(100);\n        delay(300);\n        break;\n      }\n      sol(100);\n    }\n  }\n  else\n  {\n    if (digitalRead(sag_goz) == 1) //SAĞA YANAŞ\n    {\n      ileri(150, 100);\n    }\n    else\n    {\n      ileri(100, 150);\n    }\n  }\n}\n\nvoid park (byte nereye)\n{\n  while (digitalRead(sag_goz) == 0)\n  {\n    sol(100);\n  }\n  dur(200);\n  sol(100);\n  delay(100);\n  dur(200);\n  if (nereye == 1)\n  {\n    bizim.write(bizim_kapak_default + 90);\n    delay(150);\n  }\n  else\n  {\n    sol(100);\n    delay(300);\n    dur(200);\n    yesilServo.write(yesil_kapak_default + 120);\n    delay(100);\n    digitalWrite(yesil_tokatla_sinyal, HIGH);\n    delay(500);\n    digitalWrite(yesil_tokatla_sinyal, LOW);\n  }\n  ileri(100);\n  delay(1600);\n  dur(200);\n  if(nereye == 1)\n  {\n    bizim.write(bizim_kapak_default);\n  }\n  else\n  {\n    yesilServo.write(yesil_kapak_default);\n  }\n  duvarla_isim_var = 0;\n}\n\nvoid ileri(byte hiz)\n{\n  analogWrite(RPWM_R, hiz);\n  analogWrite(LPWM_R, 0);\n  analogWrite(RPWM_L, 0);\n  analogWrite(LPWM_L, hiz);\n}\n\nvoid ileri(byte sol_hiz, byte sag_hiz)\n{\n  analogWrite(RPWM_R, sag_hiz);\n  analogWrite(LPWM_R, 0);\n  analogWrite(RPWM_L, 0);\n  analogWrite(LPWM_L, sol_hiz);\n}\n\nvoid geri(byte hiz)\n{\n  analogWrite(RPWM_R, 0);\n  analogWrite(LPWM_R, hiz);\n  analogWrite(RPWM_L, hiz);\n  analogWrite(LPWM_L, 0);\n}\n\nvoid sol(byte hiz)\n{\n  analogWrite(RPWM_R, hiz);\n  analogWrite(LPWM_R, 0);\n  analogWrite(RPWM_L, hiz);\n  analogWrite(LPWM_L, 0);\n}\n\nvoid sag(byte hiz)\n{\n  analogWrite(RPWM_R, 0);\n  analogWrite(LPWM_R, hiz);\n  analogWrite(RPWM_L, 0);\n  analogWrite(LPWM_L, hiz);\n}\n\nvoid dur(byte guc)\n{\n  analogWrite(RPWM_R, guc);\n  analogWrite(LPWM_R, guc);\n  analogWrite(RPWM_L, guc);\n  analogWrite(LPWM_L, guc);\n}\n\nvoid basla()\n{\n  // İLERİ GİT (her iki motor ileri yönde döner)\n  ileri(255); // ileri(byte hız)\n\n  delay(800);  // 1 saniye ileri git\n\n  // DUR\n  dur(100); //dur(byte guc) -> guc ne kadar yüksekse o kadar sert fren yapar.\n\n  //durduğunu anla\n  delay(1000);\n}\n\n\nfloat olcum() {\n  //verileri güncelliyoruz\n  for (int i = 0; i < 4; i++) {\n    olc();\n    kirmizi_veriler[i] = kirmizi;\n    mavi_veriler[i] = mavi;\n    yesil_veriler[i] = yesil;\n  }\n\n  // 6 TANE VERİ ALIP İÇELERİNDEN TUTARLI HALE GETİRİYORUZ\n  // ÖRNEK : 64,65,68,97 ÖLÇMÜŞ OLALIM -> 67 GİBİ BİR SONUÇ DÖNDÜRÜYOR ANLIK DALGALANMALARDAN ETKİLENMEMİŞ OLUYORUZ\n  kirmizi = stabilSonucuBul(kirmizi_veriler, 4);\n  mavi = stabilSonucuBul(mavi_veriler, 4);\n   yesil = stabilSonucuBul(yesil_veriler, 4);\n\n \n\n  // DÜZELTME: pulseIn zaman aşımında 0 döndürür; 0'a bölmek sonsuz/anlamsız sonuç verir\n  if (kirmizi <= 0 || yesil <= 0) {\n    Serial.println(\"renk sensoru okumadi\");\n    return 0;\n  }\n  float sonuc = ((float)mavi / (float)kirmizi /(float)yesil) * 10000;\n  Serial.println(sonuc);\n  /*\nSerial.println(\"MAVİ\");  \nSerial.println(mavi);\n\nSerial.println(\"KIRMIZI\");  \nSerial.println(kirmizi);\n\nSerial.println(\"yeşil\");  \nSerial.println(yesil);*/\n\n  \n  return sonuc;\n}\n\nvoid olc() {\n  //RENK SENSÖRÜ KIRMIZI FİLTRE AYARI\n  digitalWrite(s2, LOW);\n  digitalWrite(s3, LOW);\n  delay(10);\n  kirmizi = pulseIn(out, LOW);\n\n  //RENK SENSÖRÜ MAVİ FİLTRE AYARI\n  digitalWrite(s2, LOW);\n  digitalWrite(s3, HIGH);\n  delay(10);\n  mavi = pulseIn(out, LOW);\n\n   //RENK SENSÖRÜ YESİL FİLTRE AYARI\n  digitalWrite(s2, HIGH);\n  digitalWrite(s3, HIGH);\n  delay(10);\n  yesil = pulseIn(out, LOW);\n}\n\n\n\n// ******************************Ortalama hesaplayan fonksiyon*****************************\ndouble ortalamaHesapla(const int arr[], int size) {\n  double sum = 0;\n  for (int i = 0; i < size; i++) {\n    sum += arr[i];\n  }\n  return sum / size;\n}\n\n// Standart sapmayı hesaplayan fonksiyon\ndouble standartSapmaHesapla(const int arr[], int size, double mean) {\n  double sum = 0;\n  for (int i = 0; i < size; i++) {\n    sum += pow(arr[i] - mean, 2);\n  }\n  return sqrt(sum / size);\n}\n\n// Uç değerleri filtreleyerek en istikrarlı değeri bul\nint stabilSonucuBul(const int arr[], int size) {\n  // Dizinin ortalamasını hesapla\n  double mean = ortalamaHesapla(arr, size);\n\n  // Dizinin standart sapmasını hesapla\n  double stdDev = standartSapmaHesapla(arr, size, mean);\n\n  // Standart sapmanın 1.5 katından daha uzak olan değerleri göz ardı et\n  const double threshold = 1.5 * stdDev;\n\n  // Filtrelenmiş dizinin ortalamasını ve en yakın değeri bul\n  double filteredSum = 0;\n  int filteredCount = 0;\n  int closestValue = arr[0];\n  double minDifference = 1e6;  // çok büyük bir sayı kullanıyoruz\n\n  for (int i = 0; i < size; i++) {\n    if (fabs(arr[i] - mean) <= threshold) {\n      filteredSum += arr[i];\n      filteredCount++;\n\n      // Ortalamaya en yakın değeri bl\n      double diff = fabs(arr[i] - mean);\n      if (diff < minDifference) {\n        minDifference = diff;\n        closestValue = arr[i];\n      }\n    }\n  }\n\n  return closestValue;\n}\n"
   },
   {
    "id": "nano",
    "tip": "Nano",
    "kod": "#include <Servo.h>\n\nServo tokat;  // Servo nesnesi oluştur\nServo yesil_tokat;\n\n// HABERLEŞME\n#define sayac_sinyal A0\n#define yesil_sinyal A1\n#define kilit_bildirim A2\n#define yesil_tokatla_bildirim A3\n#define otur_sinyal A4\n\n#define KIRMIZI 1\n#define MAVI 0\n\nboolean baslangic_yesil_aldik_mi = false;\n\nbyte out = 2, s0 = 3, s1 = 4, s2 = 5, s3 = 6, top_sensor = 12, bolge_switch = 8, bolge = 0;\n\nfloat kirmizi = 0, mavi = 0, yesil = 0;\nint kirmizi_veriler[4] = { 0, 0, 0, 0 };\nint mavi_veriler[4] = { 0, 0, 0, 0 };\nint yesil_veriler[4] = { 0, 0, 0, 0 };\n\nint kirmizi_alt_limit = 260,kirmizi_ust_limit = 300, mavi_alt_limit = 35, mavi_ust_limit = 45, yesil_alt_limit = 70, yesil_ust_limit = 80;\n\n// TOPLARI TOKATLAYAN VE YESİLI TOKATLAYAN SERVOLARIN NORMAL DURUMLARI\n// ÖZELLİKLE tokat_default TOKATLAMA KODLARINDA DA KULLANILIYOR, BURADAN DEĞİŞTİRİLMESİ ÖNEMLİ\nbyte tokat_default = 90, yesil_tokat_default = 70;\nbyte sayac = 0;\nbyte sayac_ust_limit = 3;\n\nvoid setup() {  \n\n  tokat.attach(10);\n  yesil_tokat.attach(11);\n  tokat.write(tokat_default);\n  yesil_tokat.write(yesil_tokat_default);\n\n  pinMode(out, INPUT);\n  pinMode(top_sensor, INPUT);\n  pinMode(s0, OUTPUT);\n  pinMode(s1, OUTPUT);\n  pinMode(s2, OUTPUT);\n  pinMode(s3, OUTPUT);\n\n  //HABERLEŞME PİNLERİ\n  pinMode(sayac_sinyal, OUTPUT);\n  pinMode(yesil_sinyal, OUTPUT);\n  pinMode(otur_sinyal, OUTPUT);\n  pinMode(kilit_bildirim, INPUT);\n  pinMode(yesil_tokatla_bildirim, INPUT);\n  pinMode(bolge_switch, INPUT);\n\n  digitalWrite(s0, HIGH);\n  digitalWrite(s1, LOW);\n\n  bolge = digitalRead(bolge_switch);\n\n  Serial.begin(9600);\n}\n\nvoid loop() {\n\n\n  baslangic_kod();\n  //otur();\n  if (baslangic_yesil_aldik_mi == true)\n  {\n    yesil_birak();\n  }\n  unsigned long firstMillis = millis();\n  while( (millis() - firstMillis) < 90000)\n  {\n    normal_kod();\n  }\n  bizim_topu_birak();\n  while(1)\n  {\n    tek_tek_topla();\n  }\n\n}\n\nvoid normal_kod()\n{\n  //NORMAL KOD\n  if (digitalRead(top_sensor) == 1)\n  {\n    int sonuc = olcum(); //OLCUM YAKLAŞIK 240 MİLİSANİYEDE TAMAMLANIYOR\n    if (sonuc > kirmizi_alt_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n    {\n      //Serial.print(\"KIRMIZI: \");\n      Serial.println(sonuc);\n\n      if (bolge == KIRMIZI)\n      {\n        dogru_al();\n        Serial.println(\"kırmızı aldı\");\n        delay(2000);\n        sayac++;\n      }\n      else\n      {\n        Serial.println(\"mavi iken kırmızı rakip attı \");\n            delay(2000);\n        rakip_al();\n      }\n\n      if (sayac == sayac_ust_limit)\n      {\n        bizim_topu_birak();\n        sayac = 0;\n      }\n\n    }\n    else if (sonuc > mavi_alt_limit && sonuc < mavi_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n    {\n      //Serial.print(\"MAVİ: \");\n      Serial.println(sonuc);\n\n      if (bolge == MAVI)\n      {\n        dogru_al();\n        Serial.println(\"mavi aldı\");\n            delay(2000);\n        sayac++;\n      }\n      else\n      {\n        Serial.println(\"kırmızı iken mavi rakip attı\");\n            delay(2000);\n        rakip_al();\n      }\n\n      if (sayac == sayac_ust_limit)\n      {\n        bizim_topu_birak();\n        sayac = 0;\n      }\n\n    }\n    else if (sonuc > yesil_alt_limit && sonuc < yesil_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n    {\n      //Serial.print(\"YESİL: \");\n      Serial.println(sonuc);\n      Serial.println(\"yeşil aldı\");\n          delay(2000);\n      yesil_al();\n      yesil_birak();\n    }\n    else\n    {\n      Serial.println(\"aralıkda kaldı\");\n      //Serial.print(\"KARARSIZ: \");\n      Serial.println(sonuc);\n      delay(2000);\n    }\n  }\n  else\n  {\n    //Serial.println(\"BOŞŞ\");\n  }\n}\n\nvoid baslangic_kod()\n{\n  while (1)\n  {\n    //NORMAL KOD\n    if (digitalRead(top_sensor) == 1)\n    {\n      int sonuc = olcum(); //OLCUM YAKLAŞIK 240 MİLİSANİYEDE TAMAMLANIYOR\n      if (sonuc > kirmizi_alt_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        //Serial.print(\"KIRMIZI: \");\n        //Serial.println(sonuc);\n\n        if (bolge == KIRMIZI)\n        {\n          dogru_al();\n          baslangic_birak();\n          break;\n        }\n        else\n        {\n          rakip_al();\n        }\n\n      }\n      else if (sonuc > mavi_alt_limit && sonuc < mavi_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        //Serial.print(\"MAVİ: \");\n        //Serial.println(sonuc);\n\n        if (bolge == MAVI)\n        {\n          dogru_al();\n          baslangic_birak();\n          break;\n        }\n        else\n        {\n          rakip_al();\n        }\n\n      }\n      else if (sonuc > yesil_alt_limit && sonuc < yesil_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        //Serial.print(\"Yesil: \");\n        //Serial.println(sonuc);\n\n        yesil_al();\n        baslangic_yesil_aldik_mi = true;\n      }\n      else\n      {\n        //Serial.print(\"KARARSIZ: \");\n        //Serial.println(sonuc);\n      }\n    }\n    else\n    {\n      //Serial.println(\"BOŞŞ\");\n    }\n  }\n}\n\nvoid tek_tek_topla()\n{\n  //TEK TEK BIRAKAN KOD\n  if (digitalRead(top_sensor) == 1)\n  {\n    int sonuc = olcum(); //OLCUM YAKLAŞIK 240 MİLİSANİYEDE TAMAMLANIYOR\n    if (sonuc > kirmizi_alt_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n    {\n      //Serial.print(\"KIRMIZI: \");\n      //Serial.println(sonuc);\n\n      if (bolge == KIRMIZI)\n      {\n        dogru_al();\n        bizim_topu_birak();\n      }\n      else\n      {\n        rakip_al();\n      }\n\n    }\n    else if (sonuc > mavi_alt_limit && sonuc < mavi_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n    {\n      //Serial.print(\"MAVİ: \");\n      //Serial.println(sonuc);\n\n      if (bolge == MAVI)\n      {\n        dogru_al();\n        bizim_topu_birak();\n      }\n      else\n      {\n        rakip_al();\n      }\n\n    }\n    else if (sonuc > yesil_alt_limit && sonuc < yesil_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n    {\n      //Serial.print(\"YESİL: \");\n      //Serial.println(sonuc);\n\n      yesil_al();\n      yesil_birak();\n    }\n    else\n    {\n      //Serial.print(\"KARARSIZ: \");\n      //Serial.println(sonuc);\n    }\n  }\n  else\n  {\n    //Serial.println(\"BOŞŞ\");\n  }\n}\n\nvoid sadece_ayikla()\n{\n    //NORMAL KOD\n    if (digitalRead(top_sensor) == 1)\n    {\n      int sonuc = olcum(); //OLCUM YAKLAŞIK 240 MİLİSANİYEDE TAMAMLANIYOR\n      if (sonuc > kirmizi_alt_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        Serial.print(\"KIRMIZI: \");\n        Serial.println(sonuc);\n\n        if (bolge == KIRMIZI)\n        {\n          dogru_al();\n        }\n        else\n        {\n          rakip_al();\n        }\n\n      }\n      else if (sonuc > mavi_alt_limit && sonuc < mavi_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        Serial.print(\"MAVİ: \");\n        Serial.println(sonuc);\n\n        if (bolge == MAVI)\n        {\n          dogru_al();\n        }\n        else\n        {\n          rakip_al();\n        }\n\n      }\n      else if (sonuc > yesil_alt_limit && sonuc < yesil_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        Serial.print(\"YESİL: \");\n        Serial.println(sonuc);\n\n        yesil_al();\n        baslangic_yesil_aldik_mi = true;\n      }\n      else\n      {\n        Serial.print(\"KARARSIZ: \");\n        Serial.println(sonuc);\n      }\n    }\n    else\n    {\n      //Serial.println(\"BOŞŞ\");\n    }\n}\n\nvoid kalibre_top_okuma()\n{\n    //NORMAL KOD\n    if (digitalRead(top_sensor) == 1)\n    {\n      int sonuc = olcum(); //OLCUM YAKLAŞIK 240 MİLİSANİYEDE TAMAMLANIYOR\n      if (sonuc > kirmizi_alt_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        Serial.print(\"KIRMIZI: \");\n        Serial.println(sonuc);\n\n      }\n      else if (sonuc > mavi_alt_limit && sonuc < mavi_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        Serial.print(\"MAVİ: \");\n        Serial.println(sonuc);\n      }\n      else if (sonuc > yesil_alt_limit && sonuc < yesil_ust_limit && digitalRead(top_sensor) == 1) //TOKATLAYACAKSAK, OLCUM SIRASINDA TOPUN AĞIZDAN ÇIKMADIĞINI TEYİT ETMELİYİZ\n      {\n        Serial.print(\"yesil: \");\n        Serial.println(sonuc);\n      }\n      else\n      {\n        Serial.print(\"KARARSIZ: \");\n        Serial.println(sonuc);\n      }\n    }\n    else\n    {\n      //Serial.println(\"BOŞŞ\");\n    }\n}\n\nvoid dogru_al() {\n  tokat.write(180);\n  delay(120);\n  tokat.write(tokat_default);\n}\n\nvoid rakip_al() {\n  tokat.write(0);\n  delay(120);\n  tokat.write(tokat_default);\n}\n\nvoid yesil_al() {\n  yesil_tokat.write(yesil_tokat_default + 80); // YESİL KAPISINI AÇ\n  delay(120);\n  tokat.write(180);\n  delay(150);\n  tokat.write(tokat_default);\n  delay(100);\n  yesil_tokat.write(yesil_tokat_default + 30); // YESİL KAPISINI SIKIŞTIR\n}\n\nvoid bizim_topu_birak()\n{\n  digitalWrite(sayac_sinyal, HIGH);\n  delay(2000);\n  while (digitalRead(kilit_bildirim) == 1) {}\n  digitalWrite(sayac_sinyal, LOW);\n}\n\nvoid baslangic_birak()\n{\n  digitalWrite(sayac_sinyal, HIGH);\n  delay(2000);\n  while (digitalRead(kilit_bildirim) == 1) \n  {\n    sadece_ayikla();\n  }\n  digitalWrite(sayac_sinyal, LOW);\n}\n\nvoid yesil_birak()\n{\n  digitalWrite(yesil_sinyal, HIGH);\n  delay(4000);\n  while (digitalRead(kilit_bildirim) == 1)\n  {\n    if (digitalRead(yesil_tokatla_bildirim) == 1)\n    {\n      yesil_tokat.write(yesil_tokat_default + 40); // 10 DERECE GERİ SALINIM\n      delay(50);\n      yesil_tokat.write(yesil_tokat_default - 50); // YESİLİ DIŞARI AT\n      delay(200);\n      yesil_tokat.write(yesil_tokat_default);\n      delay(400);\n    }\n  }\n  digitalWrite(yesil_sinyal, LOW);\n}\n\nvoid otur()\n{\n  digitalWrite(otur_sinyal, HIGH);\n  while (1);\n}\n\nfloat olcum() {\n\n  //verileri güncelliyoruz\n  for (int i = 0; i < 4; i++) {\n    olc();\n    kirmizi_veriler[i] = kirmizi;\n    mavi_veriler[i] = mavi;\n    yesil_veriler[i] = yesil;\n  }\n\n  // 4 TANE VERİ ALIP İÇELERİNDEN TUTARLI HALE GETİRİYORUZ\n  // ÖRNEK : 64,65,68,97 ÖLÇMÜŞ OLALIM -> 67 GİBİ BİR SONUÇ DÖNDÜRÜYOR ANLIK DALGALANMALARDAN ETKİLENMEMİŞ OLUYORUZ\n  kirmizi = stabilSonucuBul(kirmizi_veriler, 4);\n  mavi = stabilSonucuBul(mavi_veriler, 4);\n  yesil = stabilSonucuBul(yesil_veriler, 4);\n\n  float sonuc = ((float)mavi / (float)kirmizi /(float)yesil ) * 10000;\n  Serial.println(sonuc);\n  return sonuc;\n}\n\nvoid olc() {\n  //RENK SENSÖRÜ KIRMIZI FİLTRE AYARI\n  digitalWrite(s2, LOW);\n  digitalWrite(s3, LOW);\n  delay(10);\n  kirmizi = pulseIn(out, LOW);\n\n  //RENK SENSÖRÜ MAVİ FİLTRE AYARI\n  digitalWrite(s2, LOW);\n  digitalWrite(s3, HIGH);\n  delay(10);\n  mavi = pulseIn(out, LOW);\n  \n  //RENK SENSÖRÜ YESİL FİLTRE AYARI\n  digitalWrite(s2, HIGH);\n  digitalWrite(s3, HIGH);\n  delay(10);\n  yesil = pulseIn(out, LOW);\n  \n}\n\nvoid renk_sensor_test(int delayValue) {\n  olc();\n  Serial.print(\"KIRMIZI: \");\n  Serial.print(kirmizi);\n  Serial.print(\" MAVİ: \");\n  Serial.println(mavi);\n  Serial.print(\" YESİL: \");\n  Serial.println(yesil);\n \n  delay(delayValue);\n}\n\n// ******************************Ortalama hesaplayan fonksiyon*****************************\ndouble ortalamaHesapla(const int arr[], int size) {\n  double sum = 0;\n  for (int i = 0; i < size; i++) {\n    sum += arr[i];\n  }\n  return sum / size;\n}\n\n// Standart sapmayı hesaplayan fonksiyon\ndouble standartSapmaHesapla(const int arr[], int size, double mean) {\n  double sum = 0;\n  for (int i = 0; i < size; i++) {\n    sum += pow(arr[i] - mean, 2);\n  }\n  return sqrt(sum / size);\n}\n\n// Uç değerleri filtreleyerek en istikrarlı değeri bul\nint stabilSonucuBul(const int arr[], int size) {\n  // Dizinin ortalamasını hesapla\n  double mean = ortalamaHesapla(arr, size);\n\n  // Dizinin standart sapmasını hesapla\n  double stdDev = standartSapmaHesapla(arr, size, mean);\n\n  // Standart sapmanın 1.5 katından daha uzak olan değerleri göz ardı et\n  const double threshold = 1.5 * stdDev;\n\n  // Filtrelenmiş dizinin ortalamasını ve en yakın değeri bul\n  double filteredSum = 0;\n  int filteredCount = 0;\n  int closestValue = arr[0];\n  double minDifference = 1e6;  // çok büyük bir sayı kullanıyoruz\n\n  for (int i = 0; i < size; i++) {\n    if (fabs(arr[i] - mean) <= threshold) {\n      filteredSum += arr[i];\n      filteredCount++;\n\n      // Ortalamaya en yakın değeri bl\n      double diff = fabs(arr[i] - mean);\n      if (diff < minDifference) {\n        minDifference = diff;\n        closestValue = arr[i];\n      }\n    }\n  }\n\n  return closestValue;\n}\n"
   }
  ],
  "kart_baglantilari": [
   [
    "mega:A0",
    "nano:A0"
   ],
   [
    "mega:A1",
    "nano:A1"
   ],
   [
    "mega:A2",
    "nano:A2"
   ],
   [
    "mega:A3",
    "nano:A3"
   ],
   [
    "mega:A4",
    "nano:A4"
   ]
  ],
  "mekanik": {
   "foto_rev": 1,
   "kutle_kg": 2.2,
   "agirlik_merkezi": {
    "x_cm": -1.5,
    "z_cm": 4.5
   },
   "detayli_gorunum": true,
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 7.5,
    "genislik_cm": 2.8,
    "iz_cm": 25.4,
    "x_cm": -1.85,
    "adet": 4,
    "dingil_cm": 13.9,
    "jant_renk": "#efeee9",
    "lastik_renk": "#8f9296"
   },
   "sarhos_teker": null,
   "motor": {
    "model": "JGA25-370 12V 130"
   },
   "pil": {
    "volt": 14.8,
    "mah": 4900
   },
   "acil_stop": {
    "x": 2.2,
    "y": -9.0,
    "z": 12.1
   },
   "parcalar": [
    {
     "ad": "Gövde (sarı şasi plakası)",
     "x": 0.0,
     "y": 0.0,
     "uzunluk": 24.8,
     "genislik": 21.8,
     "z0": 2.6,
     "z1": 3.2,
     "renk": "#f2c200"
    },
    {
     "ad": "Sol ön köşe kanadı",
     "x": 10.7,
     "y": 12.6,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "z0": 0.5,
     "z1": 3.2,
     "renk": "#f2c200"
    },
    {
     "ad": "Sol yan etek",
     "x": -1.85,
     "y": 10.65,
     "uzunluk": 6.3,
     "genislik": 0.5,
     "z0": 0.5,
     "z1": 2.6,
     "renk": "#f2c200"
    },
    {
     "ad": "Sağ ön köşe kanadı",
     "x": 10.7,
     "y": -12.6,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "z0": 0.5,
     "z1": 3.2,
     "renk": "#f2c200"
    },
    {
     "ad": "Sağ yan etek",
     "x": -1.85,
     "y": -10.65,
     "uzunluk": 6.3,
     "genislik": 0.5,
     "z0": 0.5,
     "z1": 2.6,
     "renk": "#f2c200"
    },
    {
     "ad": "Arka etek",
     "x": -12.15,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 19.2,
     "z0": 0.5,
     "z1": 2.6,
     "renk": "#f2c200"
    },
    {
     "ad": "Ön travers",
     "x": 12.05,
     "y": 0.0,
     "uzunluk": 0.7,
     "genislik": 28.6,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200"
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": -12.5,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": -10.0,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": -7.5,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": -5.0,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": -2.5,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": 2.5,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": 5.0,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": 7.5,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": 10.0,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön diş",
     "x": 12.65,
     "y": 12.5,
     "uzunluk": 0.5,
     "genislik": 1.0,
     "z0": 3.2,
     "z1": 3.9,
     "renk": "#f2c200",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": -10.35,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": -8.05,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": -5.75,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": -3.45,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": -1.15,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": 1.15,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": 3.45,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": 5.75,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": 8.05,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Tek yönlü kapakçık",
     "x": 12.1,
     "y": 10.35,
     "uzunluk": 0.3,
     "genislik": 1.0,
     "z0": 0.35,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true,
     "malzeme": "kaucuk"
    },
    {
     "ad": "Sol iç huni",
     "x": 9.75,
     "y": 7.45,
     "uzunluk": 6.8,
     "genislik": 0.4,
     "z0": 0.3,
     "z1": 2.5,
     "aci": 57.0,
     "renk": "#2b2d31"
    },
    {
     "ad": "Sol kanal duvarı",
     "x": -0.75,
     "y": 4.8,
     "uzunluk": 5.3,
     "genislik": 0.4,
     "z0": 0.3,
     "z1": 2.5,
     "renk": "#2b2d31"
    },
    {
     "ad": "Sağ iç huni",
     "x": 9.75,
     "y": -7.45,
     "uzunluk": 6.8,
     "genislik": 0.4,
     "z0": 0.3,
     "z1": 2.5,
     "aci": -57.0,
     "renk": "#2b2d31"
    },
    {
     "ad": "Sağ kanal duvarı",
     "x": -0.75,
     "y": -4.8,
     "uzunluk": 5.3,
     "genislik": 0.4,
     "z0": 0.3,
     "z1": 2.5,
     "renk": "#2b2d31"
    },
    {
     "ad": "Ayıklayıcı stoperi",
     "x": -3.6,
     "y": 0.0,
     "uzunluk": 0.4,
     "genislik": 10.0,
     "z0": 0.3,
     "z1": 2.5,
     "renk": "#2b2d31"
    },
    {
     "ad": "Sol ön motor kutusu (alt)",
     "x": 4.85,
     "y": 7.5,
     "uzunluk": 5.9,
     "genislik": 5.8,
     "z0": 0.8,
     "z1": 2.6,
     "renk": "#2a2a2c"
    },
    {
     "ad": "Sol ön motor kutusu",
     "x": 4.85,
     "y": 7.5,
     "uzunluk": 5.9,
     "genislik": 5.8,
     "z0": 3.2,
     "z1": 6.3,
     "renk": "#2a2a2c"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": 2.7,
     "y": 5.3,
     "z0": 6.3,
     "z1": 6.42,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": 4.85,
     "y": 5.3,
     "z0": 6.3,
     "z1": 6.42,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": 7.0,
     "y": 5.3,
     "z0": 6.3,
     "z1": 6.42,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Sağ ön motor kutusu (alt)",
     "x": 4.85,
     "y": -7.5,
     "uzunluk": 5.9,
     "genislik": 5.8,
     "z0": 0.8,
     "z1": 2.6,
     "renk": "#1b1c1f"
    },
    {
     "ad": "Sağ ön motor kutusu",
     "x": 4.85,
     "y": -7.5,
     "uzunluk": 5.9,
     "genislik": 5.8,
     "z0": 3.2,
     "z1": 6.3,
     "renk": "#1b1c1f"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": 2.7,
     "y": -5.3,
     "z0": 6.3,
     "z1": 6.42,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": 4.85,
     "y": -5.3,
     "z0": 6.3,
     "z1": 6.42,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": 7.0,
     "y": -5.3,
     "z0": 6.3,
     "z1": 6.42,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Sol arka motor kutusu (alt)",
     "x": -9.9,
     "y": 7.5,
     "uzunluk": 3.0,
     "genislik": 5.8,
     "z0": 0.8,
     "z1": 2.6,
     "renk": "#1b1c1f"
    },
    {
     "ad": "Sol arka motor kutusu",
     "x": -9.9,
     "y": 7.5,
     "uzunluk": 3.0,
     "genislik": 5.8,
     "z0": 3.2,
     "z1": 5.9,
     "renk": "#1b1c1f"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": -10.6,
     "y": 5.3,
     "z0": 5.9,
     "z1": 6.02,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": -9.9,
     "y": 5.3,
     "z0": 5.9,
     "z1": 6.02,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": -9.2,
     "y": 5.3,
     "z0": 5.9,
     "z1": 6.02,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Sağ arka motor kutusu (alt)",
     "x": -9.9,
     "y": -7.5,
     "uzunluk": 3.0,
     "genislik": 5.8,
     "z0": 0.8,
     "z1": 2.6,
     "renk": "#1b1c1f"
    },
    {
     "ad": "Sağ arka motor kutusu",
     "x": -9.9,
     "y": -7.5,
     "uzunluk": 3.0,
     "genislik": 5.8,
     "z0": 3.2,
     "z1": 5.9,
     "renk": "#1b1c1f"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": -10.6,
     "y": -5.3,
     "z0": 5.9,
     "z1": 6.02,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": -9.9,
     "y": -5.3,
     "z0": 5.9,
     "z1": 6.02,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Vida",
     "sekil": "silindir",
     "eksen": "z",
     "x": -9.2,
     "y": -5.3,
     "z0": 5.9,
     "z1": 6.02,
     "uzunluk": 0.45,
     "genislik": 0.45,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pirinç kaplin",
     "sekil": "silindir",
     "eksen": "y",
     "x": 5.1,
     "y": 10.9,
     "z0": 3.3,
     "z1": 4.2,
     "uzunluk": 0.9,
     "genislik": 1.0,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pirinç kaplin",
     "sekil": "silindir",
     "eksen": "y",
     "x": 5.1,
     "y": -10.9,
     "z0": 3.3,
     "z1": 4.2,
     "uzunluk": 0.9,
     "genislik": 1.0,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pirinç kaplin",
     "sekil": "silindir",
     "eksen": "y",
     "x": -8.8,
     "y": 10.9,
     "z0": 3.3,
     "z1": 4.2,
     "uzunluk": 0.9,
     "genislik": 1.0,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pirinç kaplin",
     "sekil": "silindir",
     "eksen": "y",
     "x": -8.8,
     "y": -10.9,
     "z0": 3.3,
     "z1": 4.2,
     "uzunluk": 0.9,
     "genislik": 1.0,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Karbon kapak",
     "x": 4.85,
     "y": 7.5,
     "uzunluk": 5.3,
     "genislik": 5.2,
     "z0": 6.3,
     "z1": 6.45,
     "renk": "#3a3b3f",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "QR etiket",
     "x": 4.6,
     "y": 7.5,
     "uzunluk": 2.0,
     "genislik": 2.2,
     "z0": 6.45,
     "z1": 6.5,
     "renk": "#f5f5f5",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop gövdesi",
     "x": 2.2,
     "y": -9.0,
     "uzunluk": 2.4,
     "genislik": 2.6,
     "z0": 6.3,
     "z1": 12.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop kontak blokları",
     "x": 2.2,
     "y": -9.0,
     "uzunluk": 2.0,
     "genislik": 2.2,
     "z0": 7.2,
     "z1": 9.2,
     "renk": "#26272b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop boğazı",
     "sekil": "silindir",
     "eksen": "z",
     "x": 2.2,
     "y": -9.0,
     "z0": 11.6,
     "z1": 12.1,
     "uzunluk": 2.8,
     "genislik": 2.8,
     "renk": "#3a3b3f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop mantarı",
     "sekil": "silindir",
     "eksen": "z",
     "x": 2.2,
     "y": -9.0,
     "z0": 12.1,
     "z1": 13.8,
     "uzunluk": 4.0,
     "genislik": 4.0,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "DUR/STOP etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": 2.2,
     "y": -9.0,
     "z0": 13.8,
     "z1": 13.88,
     "uzunluk": 2.6,
     "genislik": 2.6,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil yuvası",
     "x": 8.85,
     "y": -3.5,
     "uzunluk": 2.2,
     "genislik": 7.0,
     "z0": 3.2,
     "z1": 4.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": 8.85,
     "y": -3.95,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": 8.85,
     "y": -0.9,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": 8.85,
     "y": -0.25,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pil yuvası",
     "x": 8.85,
     "y": 3.4,
     "uzunluk": 2.2,
     "genislik": 7.0,
     "z0": 3.2,
     "z1": 4.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": 8.85,
     "y": 2.95,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": 8.85,
     "y": 6.0,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": 8.85,
     "y": 6.65,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pil yuvası",
     "x": -1.55,
     "y": -8.7,
     "uzunluk": 4.1,
     "genislik": 7.0,
     "z0": 3.2,
     "z1": 4.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -2.5,
     "y": -9.15,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": -2.5,
     "y": -6.1,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": -2.5,
     "y": -5.45,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -0.6,
     "y": -9.15,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": -0.6,
     "y": -6.1,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": -0.6,
     "y": -5.45,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pil yuvası",
     "x": -6.05,
     "y": -7.25,
     "uzunluk": 3.9,
     "genislik": 7.0,
     "z0": 3.2,
     "z1": 4.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -6.9,
     "y": -7.7,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": -6.9,
     "y": -4.65,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": -6.9,
     "y": -4.0,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -5.2,
     "y": -7.7,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": -5.2,
     "y": -4.65,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": -5.2,
     "y": -4.0,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pil yuvası",
     "x": -6.35,
     "y": 6.85,
     "uzunluk": 3.7,
     "genislik": 7.0,
     "z0": 3.2,
     "z1": 4.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -7.1,
     "y": 6.4,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": -7.1,
     "y": 9.45,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": -7.1,
     "y": 10.1,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "18650 pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -5.6,
     "y": 6.4,
     "z0": 3.23,
     "z1": 5.08,
     "uzunluk": 1.85,
     "genislik": 5.4,
     "renk": "#f1f1ee",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil bandı",
     "sekil": "silindir",
     "eksen": "y",
     "x": -5.6,
     "y": 9.45,
     "z0": 3.22,
     "z1": 5.09,
     "uzunluk": 1.87,
     "genislik": 1.2,
     "renk": "#d72027",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil ucu",
     "sekil": "silindir",
     "eksen": "y",
     "x": -5.6,
     "y": 10.1,
     "z0": 3.6,
     "z1": 4.7,
     "uzunluk": 1.1,
     "genislik": 0.15,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "BTS7960 soğutucu tabanı",
     "x": -12.65,
     "y": -6.55,
     "uzunluk": 4.6,
     "genislik": 4.6,
     "z0": 6.0,
     "z1": 6.3,
     "renk": "#b8bcc4",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -14.75,
     "y": -6.55,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -13.9,
     "y": -6.55,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -13.05,
     "y": -6.55,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -12.2,
     "y": -6.55,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -11.35,
     "y": -6.55,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -10.5,
     "y": -6.55,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "BTS7960 kartı",
     "x": -12.65,
     "y": -6.55,
     "uzunluk": 5.0,
     "genislik": 5.0,
     "z0": 7.0,
     "z1": 7.16,
     "renk": "#1f5fbf",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Klemens",
     "x": -11.05,
     "y": -6.55,
     "uzunluk": 1.2,
     "genislik": 2.8,
     "z0": 7.16,
     "z1": 8.0,
     "renk": "#22a84a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kontrol entegresi",
     "x": -13.65,
     "y": -6.75,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "z0": 7.16,
     "z1": 7.4,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pin başlığı",
     "x": -14.7,
     "y": -6.55,
     "uzunluk": 0.5,
     "genislik": 3.6,
     "z0": 7.16,
     "z1": 8.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "BTS7960 soğutucu tabanı",
     "x": -11.85,
     "y": 6.3,
     "uzunluk": 4.6,
     "genislik": 4.6,
     "z0": 6.0,
     "z1": 6.3,
     "renk": "#b8bcc4",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -13.95,
     "y": 6.3,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -13.1,
     "y": 6.3,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -12.25,
     "y": 6.3,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -11.4,
     "y": 6.3,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -10.55,
     "y": 6.3,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Soğutucu kanadı",
     "x": -9.7,
     "y": 6.3,
     "uzunluk": 0.2,
     "genislik": 4.6,
     "z0": 5.9,
     "z1": 7.0,
     "renk": "#c3c7ce",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "BTS7960 kartı",
     "x": -11.85,
     "y": 6.3,
     "uzunluk": 5.0,
     "genislik": 5.0,
     "z0": 7.0,
     "z1": 7.16,
     "renk": "#1f5fbf",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Klemens",
     "x": -10.25,
     "y": 6.3,
     "uzunluk": 1.2,
     "genislik": 2.8,
     "z0": 7.16,
     "z1": 8.0,
     "renk": "#22a84a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kontrol entegresi",
     "x": -12.85,
     "y": 6.1,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "z0": 7.16,
     "z1": 7.4,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pin başlığı",
     "x": -13.9,
     "y": 6.3,
     "uzunluk": 0.5,
     "genislik": 3.6,
     "z0": 7.16,
     "z1": 8.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Arduino Mega",
     "x": -8.2,
     "y": -0.5,
     "uzunluk": 10.2,
     "genislik": 5.3,
     "z0": 5.6,
     "z1": 5.75,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Mega USB-B",
     "x": -13.15,
     "y": -0.8,
     "uzunluk": 1.5,
     "genislik": 1.2,
     "z0": 5.75,
     "z1": 6.85,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Mega dişi başlıklar",
     "x": -7.8,
     "y": 1.8,
     "uzunluk": 8.4,
     "genislik": 0.4,
     "z0": 5.75,
     "z1": 6.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ara direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -12.2,
     "y": -2.6,
     "z0": 5.75,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#d4b24a",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ara direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -4.6,
     "y": -2.6,
     "z0": 5.75,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#d4b24a",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ara direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -12.2,
     "y": 1.8,
     "z0": 5.75,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#d4b24a",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ara direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -4.6,
     "y": 1.8,
     "z0": 5.75,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#d4b24a",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Delikli pertinaks",
     "x": -8.4,
     "y": -0.55,
     "uzunluk": 8.0,
     "genislik": 6.9,
     "z0": 7.4,
     "z1": 7.55,
     "renk": "#9a6233",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Nano dişi başlık",
     "x": -9.1,
     "y": -1.1,
     "uzunluk": 4.6,
     "genislik": 0.3,
     "z0": 7.55,
     "z1": 7.95,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Nano dişi başlık",
     "x": -9.1,
     "y": 0.5,
     "uzunluk": 4.6,
     "genislik": 0.3,
     "z0": 7.55,
     "z1": 7.95,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Arduino Nano",
     "x": -9.1,
     "y": -0.3,
     "uzunluk": 4.7,
     "genislik": 1.8,
     "z0": 7.95,
     "z1": 8.05,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Nano USB",
     "x": -11.5,
     "y": -0.3,
     "uzunluk": 0.8,
     "genislik": 0.6,
     "z0": 8.05,
     "z1": 8.45,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Nano işlemcisi",
     "x": -9.1,
     "y": -0.3,
     "uzunluk": 1.0,
     "genislik": 1.0,
     "z0": 8.05,
     "z1": 8.2,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Anahtar",
     "sekil": "silindir",
     "eksen": "z",
     "x": -6.0,
     "y": 1.9,
     "z0": 7.55,
     "z1": 8.65,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#b9bcc2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Pertinaks kablo",
     "x": -10.35,
     "y": -0.55,
     "uzunluk": 0.3,
     "genislik": 6.5,
     "z0": 7.55,
     "z1": 7.7,
     "renk": "#e63946",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pertinaks kablo",
     "x": -9.65,
     "y": -0.55,
     "uzunluk": 0.3,
     "genislik": 6.5,
     "z0": 7.55,
     "z1": 7.7,
     "renk": "#f4a261",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pertinaks kablo",
     "x": -8.95,
     "y": -0.55,
     "uzunluk": 0.3,
     "genislik": 6.5,
     "z0": 7.55,
     "z1": 7.7,
     "renk": "#2a9d8f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pertinaks kablo",
     "x": -8.25,
     "y": -0.55,
     "uzunluk": 0.3,
     "genislik": 6.5,
     "z0": 7.55,
     "z1": 7.7,
     "renk": "#264653",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pertinaks kablo",
     "x": -7.55,
     "y": -0.55,
     "uzunluk": 0.3,
     "genislik": 6.5,
     "z0": 7.55,
     "z1": 7.7,
     "renk": "#e9c46a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pertinaks kablo",
     "x": -6.85,
     "y": -0.55,
     "uzunluk": 0.3,
     "genislik": 6.5,
     "z0": 7.55,
     "z1": 7.7,
     "renk": "#8338ec",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ayıklayıcı penceresi",
     "x": 0.1,
     "y": -0.1,
     "uzunluk": 6.4,
     "genislik": 9.0,
     "z0": 3.2,
     "z1": 3.22,
     "renk": "#0b0b0c",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ayıklayıcı motoru",
     "sekil": "silindir",
     "eksen": "x",
     "x": 4.6,
     "y": -0.4,
     "z0": 3.3,
     "z1": 5.9,
     "uzunluk": 3.6,
     "genislik": 2.6,
     "renk": "#a7abb2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ayıklayıcı redüktörü",
     "x": 2.0,
     "y": -0.4,
     "uzunluk": 1.6,
     "genislik": 2.6,
     "z0": 3.3,
     "z1": 5.9,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Tokat göbeği",
     "sekil": "silindir",
     "eksen": "z",
     "x": 0.3,
     "y": -0.4,
     "z0": 3.22,
     "z1": 3.82,
     "uzunluk": 1.4,
     "genislik": 1.4,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Tokat kanadı",
     "x": 1.5,
     "y": -0.4,
     "uzunluk": 2.4,
     "genislik": 0.9,
     "z0": 3.25,
     "z1": 3.7,
     "aci": 0.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Tokat kanadı",
     "x": -0.3,
     "y": 0.64,
     "uzunluk": 2.4,
     "genislik": 0.9,
     "z0": 3.25,
     "z1": 3.7,
     "aci": 120.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Tokat kanadı",
     "x": -0.3,
     "y": -1.44,
     "uzunluk": 2.4,
     "genislik": 0.9,
     "z0": 3.25,
     "z1": 3.7,
     "aci": -120.0,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Yan kapı servosu",
     "x": -2.05,
     "y": 11.6,
     "uzunluk": 2.3,
     "genislik": 1.2,
     "z0": 3.2,
     "z1": 6.0,
     "renk": "#1f3b8f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Yan çıkış kapağı",
     "x": -2.05,
     "y": 12.35,
     "uzunluk": 5.5,
     "genislik": 0.3,
     "z0": 0.4,
     "z1": 3.2,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Arka bölme kapağı",
     "x": -12.65,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 7.2,
     "z0": 0.4,
     "z1": 2.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kapak servosu",
     "x": -11.1,
     "y": -1.8,
     "uzunluk": 2.2,
     "genislik": 1.2,
     "z0": 3.2,
     "z1": 5.9,
     "renk": "#1f3b8f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kapak servosu",
     "x": -11.1,
     "y": 1.8,
     "uzunluk": 2.2,
     "genislik": 1.2,
     "z0": 3.2,
     "z1": 5.9,
     "renk": "#1f3b8f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Küçük sürücü kartı",
     "x": -1.2,
     "y": 7.6,
     "uzunluk": 3.2,
     "genislik": 4.2,
     "z0": 3.6,
     "z1": 3.75,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Küçük sürücü soğutucusu",
     "x": -1.2,
     "y": 7.6,
     "uzunluk": 1.4,
     "genislik": 2.0,
     "z0": 3.75,
     "z1": 4.6,
     "renk": "#1b1c1f",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Mavi klemens",
     "x": 0.2,
     "y": 6.0,
     "uzunluk": 0.4,
     "genislik": 1.0,
     "z0": 3.75,
     "z1": 4.5,
     "renk": "#1d6fd8",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Mavi klemens",
     "x": 0.2,
     "y": 9.2,
     "uzunluk": 0.4,
     "genislik": 1.0,
     "z0": 3.75,
     "z1": 4.5,
     "renk": "#1d6fd8",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "MZ80 (üst, bağlı, çapraz)",
     "sekil": "silindir",
     "eksen": "x",
     "x": 9.75,
     "y": 10.1,
     "z0": 2.7,
     "z1": 4.5,
     "uzunluk": 4.5,
     "genislik": 1.8,
     "renk": "#e0a21b",
     "kati": false,
     "gorsel": true,
     "aci": 25
    },
    {
     "ad": "MZ80 (alt)",
     "sekil": "silindir",
     "eksen": "x",
     "x": 9.75,
     "y": 12.5,
     "z0": 0.7,
     "z1": 2.5,
     "uzunluk": 4.5,
     "genislik": 1.8,
     "renk": "#e0a21b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "MZ80 merceği",
     "sekil": "silindir",
     "eksen": "x",
     "x": 11.8,
     "y": 11.05,
     "z0": 3.0,
     "z1": 4.2,
     "uzunluk": 0.25,
     "genislik": 1.2,
     "renk": "#3a0d3f",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak",
     "aci": 25
    },
    {
     "ad": "MZ80 somunu",
     "sekil": "silindir",
     "eksen": "x",
     "x": 10.55,
     "y": 10.5,
     "z0": 2.5,
     "z1": 4.7,
     "uzunluk": 0.35,
     "genislik": 2.2,
     "renk": "#c8901a",
     "kati": false,
     "gorsel": true,
     "aci": 25
    },
    {
     "ad": "MZ80 merceği",
     "sekil": "silindir",
     "eksen": "x",
     "x": 11.9,
     "y": 12.5,
     "z0": 1.0,
     "z1": 2.2,
     "uzunluk": 0.25,
     "genislik": 1.2,
     "renk": "#3a0d3f",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak",
     "aci": 0
    },
    {
     "ad": "MZ80 somunu",
     "sekil": "silindir",
     "eksen": "x",
     "x": 10.65,
     "y": 12.5,
     "z0": 0.5,
     "z1": 2.7,
     "uzunluk": 0.35,
     "genislik": 2.2,
     "renk": "#c8901a",
     "kati": false,
     "gorsel": true,
     "aci": 0
    },
    {
     "ad": "Kablo bağı",
     "x": 9.2,
     "y": 11.8,
     "uzunluk": 0.4,
     "genislik": 3.2,
     "z0": 0.6,
     "z1": 4.6,
     "renk": "#22c55e",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "MZ80 (üst, bağlı, çapraz)",
     "sekil": "silindir",
     "eksen": "x",
     "x": 9.75,
     "y": -10.1,
     "z0": 2.7,
     "z1": 4.5,
     "uzunluk": 4.5,
     "genislik": 1.8,
     "renk": "#e0a21b",
     "kati": false,
     "gorsel": true,
     "aci": -25
    },
    {
     "ad": "MZ80 (alt)",
     "sekil": "silindir",
     "eksen": "x",
     "x": 9.75,
     "y": -12.5,
     "z0": 0.7,
     "z1": 2.5,
     "uzunluk": 4.5,
     "genislik": 1.8,
     "renk": "#e0a21b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "MZ80 merceği",
     "sekil": "silindir",
     "eksen": "x",
     "x": 11.8,
     "y": -11.05,
     "z0": 3.0,
     "z1": 4.2,
     "uzunluk": 0.25,
     "genislik": 1.2,
     "renk": "#3a0d3f",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak",
     "aci": -25
    },
    {
     "ad": "MZ80 somunu",
     "sekil": "silindir",
     "eksen": "x",
     "x": 10.55,
     "y": -10.5,
     "z0": 2.5,
     "z1": 4.7,
     "uzunluk": 0.35,
     "genislik": 2.2,
     "renk": "#c8901a",
     "kati": false,
     "gorsel": true,
     "aci": -25
    },
    {
     "ad": "MZ80 merceği",
     "sekil": "silindir",
     "eksen": "x",
     "x": 11.9,
     "y": -12.5,
     "z0": 1.0,
     "z1": 2.2,
     "uzunluk": 0.25,
     "genislik": 1.2,
     "renk": "#3a0d3f",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak",
     "aci": 0
    },
    {
     "ad": "MZ80 somunu",
     "sekil": "silindir",
     "eksen": "x",
     "x": 10.65,
     "y": -12.5,
     "z0": 0.5,
     "z1": 2.7,
     "uzunluk": 0.35,
     "genislik": 2.2,
     "renk": "#c8901a",
     "kati": false,
     "gorsel": true,
     "aci": 0
    },
    {
     "ad": "Kablo bağı",
     "x": 9.2,
     "y": -11.8,
     "uzunluk": 0.4,
     "genislik": 3.2,
     "z0": 0.6,
     "z1": 4.6,
     "renk": "#22c55e",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kablo bağı",
     "x": -6.5,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 2.4,
     "z0": 9.6,
     "z1": 10.4,
     "renk": "#f8fafc",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kablo bağı",
     "x": -1.0,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 2.4,
     "z0": 9.6,
     "z1": 10.4,
     "renk": "#f8fafc",
     "kati": false,
     "gorsel": true
    }
   ],
   "kablolar": [
    {
     "renk": "#06b6d4",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.31,
       -0.48,
       7.7
      ],
      [
       -10.31,
       -0.48,
       8.6
      ],
      [
       -11.4,
       -1.85,
       9.45
      ],
      [
       -11.44,
       -3.58,
       8.79
      ],
      [
       -12.09,
       -5.71,
       8.9
      ],
      [
       -12.09,
       -5.71,
       8.0
      ]
     ]
    },
    {
     "renk": "#9ca3af",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.5,
       -0.55,
       7.7
      ],
      [
       -6.5,
       -0.55,
       8.6
      ],
      [
       -8.95,
       -2.63,
       9.21
      ],
      [
       -11.07,
       -5.38,
       8.14
      ],
      [
       -11.88,
       -6.05,
       8.9
      ],
      [
       -11.88,
       -6.05,
       8.0
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.06,
       -2.24,
       7.7
      ],
      [
       -7.06,
       -2.24,
       8.6
      ],
      [
       -8.02,
       -2.25,
       11.43
      ],
      [
       -10.7,
       -5.45,
       11.02
      ],
      [
       -12.3,
       -5.62,
       8.9
      ],
      [
       -12.3,
       -5.62,
       8.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.88,
       -1.77,
       7.7
      ],
      [
       -7.88,
       -1.77,
       8.6
      ],
      [
       -9.61,
       -2.31,
       10.92
      ],
      [
       -11.3,
       -4.73,
       10.81
      ],
      [
       -12.39,
       -5.88,
       8.9
      ],
      [
       -12.39,
       -5.88,
       8.0
      ]
     ]
    },
    {
     "renk": "#9ca3af",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.78,
       1.7,
       7.7
      ],
      [
       -7.78,
       1.7,
       8.6
      ],
      [
       -8.11,
       3.1,
       11.28
      ],
      [
       -10.24,
       6.13,
       10.6
      ],
      [
       -11.36,
       7.04,
       8.9
      ],
      [
       -11.36,
       7.04,
       8.0
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.02,
       1.33,
       7.7
      ],
      [
       -8.02,
       1.33,
       8.6
      ],
      [
       -8.06,
       3.08,
       11.16
      ],
      [
       -9.93,
       5.74,
       10.65
      ],
      [
       -11.24,
       7.01,
       8.9
      ],
      [
       -11.24,
       7.01,
       8.0
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.2,
       -2.13,
       7.7
      ],
      [
       -8.2,
       -2.13,
       8.6
      ],
      [
       -9.1,
       1.44,
       10.3
      ],
      [
       -9.18,
       4.28,
       9.62
      ],
      [
       -10.99,
       6.9,
       8.9
      ],
      [
       -10.99,
       6.9,
       8.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.21,
       -0.21,
       7.7
      ],
      [
       -5.21,
       -0.21,
       8.6
      ],
      [
       -7.2,
       1.34,
       11.13
      ],
      [
       -8.73,
       3.83,
       10.95
      ],
      [
       -11.18,
       6.96,
       8.9
      ],
      [
       -11.18,
       6.96,
       8.0
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.43,
       1.32,
       7.7
      ],
      [
       -5.43,
       1.32,
       8.6
      ],
      [
       -2.65,
       -1.7,
       10.68
      ],
      [
       0.68,
       -5.57,
       10.16
      ],
      [
       2.54,
       -8.51,
       9.9
      ],
      [
       2.54,
       -8.51,
       9.0
      ]
     ]
    },
    {
     "renk": "#92400e",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.74,
       1.49,
       7.7
      ],
      [
       -5.74,
       1.49,
       8.6
      ],
      [
       -3.02,
       -0.81,
       10.44
      ],
      [
       -0.25,
       -5.29,
       9.28
      ],
      [
       2.05,
       -8.07,
       9.9
      ],
      [
       2.05,
       -8.07,
       9.0
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.11,
       -0.63,
       7.7
      ],
      [
       -6.11,
       -0.63,
       8.6
      ],
      [
       -4.53,
       -2.52,
       11.4
      ],
      [
       -0.72,
       -6.3,
       11.38
      ],
      [
       1.85,
       -8.59,
       9.9
      ],
      [
       1.85,
       -8.59,
       9.0
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.38,
       -0.22,
       7.7
      ],
      [
       -8.38,
       -0.22,
       8.6
      ],
      [
       -4.36,
       2.26,
       9.38
      ],
      [
       2.88,
       7.23,
       8.47
      ],
      [
       7.57,
       11.09,
       4.7
      ],
      [
       7.57,
       11.09,
       3.8
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.1,
       -1.62,
       7.7
      ],
      [
       -10.1,
       -1.62,
       8.6
      ],
      [
       -4.88,
       2.67,
       11.18
      ],
      [
       1.4,
       6.81,
       10.47
      ],
      [
       7.37,
       11.22,
       4.7
      ],
      [
       7.37,
       11.22,
       3.8
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.92,
       -0.47,
       7.7
      ],
      [
       -5.92,
       -0.47,
       8.6
      ],
      [
       -1.49,
       3.84,
       11.14
      ],
      [
       2.71,
       7.48,
       10.17
      ],
      [
       6.97,
       11.13,
       4.7
      ],
      [
       6.97,
       11.13,
       3.8
      ]
     ]
    },
    {
     "renk": "#9ca3af",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.32,
       -1.24,
       7.7
      ],
      [
       -6.32,
       -1.24,
       8.6
      ],
      [
       -1.46,
       -3.9,
       9.08
      ],
      [
       4.34,
       -7.25,
       9.05
      ],
      [
       7.67,
       -11.09,
       4.7
      ],
      [
       7.67,
       -11.09,
       3.8
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.1,
       -1.68,
       7.7
      ],
      [
       -9.1,
       -1.68,
       8.6
      ],
      [
       -4.08,
       -3.96,
       11.18
      ],
      [
       1.59,
       -8.38,
       10.66
      ],
      [
       7.16,
       -11.3,
       4.7
      ],
      [
       7.16,
       -11.3,
       3.8
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.34,
       -2.1,
       7.7
      ],
      [
       -8.34,
       -2.1,
       8.6
      ],
      [
       -3.3,
       -5.41,
       8.98
      ],
      [
       3.02,
       -7.44,
       8.92
      ],
      [
       7.47,
       -10.96,
       4.7
      ],
      [
       7.47,
       -10.96,
       3.8
      ]
     ]
    },
    {
     "renk": "#92400e",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.91,
       0.77,
       7.7
      ],
      [
       -9.91,
       0.77,
       8.6
      ],
      [
       -4.02,
       4.23,
       10.17
      ],
      [
       3.4,
       8.09,
       9.16
      ],
      [
       7.8,
       12.2,
       2.8
      ],
      [
       7.8,
       12.2,
       1.9
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.42,
       -0.3,
       7.7
      ],
      [
       -9.42,
       -0.3,
       8.6
      ],
      [
       -4.9,
       3.44,
       9.35
      ],
      [
       3.63,
       9.22,
       9.0
      ],
      [
       7.79,
       12.41,
       2.8
      ],
      [
       7.79,
       12.41,
       1.9
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.11,
       -0.61,
       7.7
      ],
      [
       -9.11,
       -0.61,
       8.6
      ],
      [
       -3.59,
       -3.41,
       10.81
      ],
      [
       1.77,
       -7.86,
       9.76
      ],
      [
       7.2,
       -12.26,
       2.8
      ],
      [
       7.2,
       -12.26,
       1.9
      ]
     ]
    },
    {
     "renk": "#16a34a",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.08,
       -0.23,
       7.7
      ],
      [
       -9.08,
       -0.23,
       8.6
      ],
      [
       -4.97,
       -3.13,
       9.34
      ],
      [
       2.42,
       -8.25,
       8.39
      ],
      [
       7.77,
       -12.22,
       2.8
      ],
      [
       7.77,
       -12.22,
       1.9
      ]
     ]
    },
    {
     "renk": "#92400e",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.36,
       0.8,
       7.7
      ],
      [
       -10.36,
       0.8,
       8.6
      ],
      [
       -4.47,
       2.06,
       9.41
      ],
      [
       4.45,
       4.03,
       9.1
      ],
      [
       10.64,
       6.55,
       4.3
      ],
      [
       10.64,
       6.55,
       3.4
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.01,
       0.61,
       7.7
      ],
      [
       -10.01,
       0.61,
       8.6
      ],
      [
       -3.5,
       2.44,
       9.35
      ],
      [
       4.12,
       5.53,
       9.0
      ],
      [
       10.81,
       6.68,
       4.3
      ],
      [
       10.81,
       6.68,
       3.4
      ]
     ]
    },
    {
     "renk": "#f97316",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.06,
       -1.96,
       7.7
      ],
      [
       -10.06,
       -1.96,
       8.6
      ],
      [
       -4.47,
       1.59,
       11.07
      ],
      [
       3.24,
       3.64,
       10.7
      ],
      [
       10.21,
       6.79,
       4.3
      ],
      [
       10.21,
       6.79,
       3.4
      ]
     ]
    },
    {
     "renk": "#16a34a",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.02,
       -0.04,
       7.7
      ],
      [
       -7.02,
       -0.04,
       8.6
      ],
      [
       -3.22,
       0.12,
       10.77
      ],
      [
       1.59,
       0.47,
       10.39
      ],
      [
       4.95,
       -0.52,
       6.9
      ],
      [
       4.95,
       -0.52,
       6.0
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.55,
       -0.94,
       7.7
      ],
      [
       -7.55,
       -0.94,
       8.6
      ],
      [
       -3.86,
       0.08,
       9.8
      ],
      [
       0.56,
       -1.19,
       8.82
      ],
      [
       4.74,
       -0.7,
       6.9
      ],
      [
       4.74,
       -0.7,
       6.0
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.73,
       -0.88,
       7.7
      ],
      [
       -6.73,
       -0.88,
       8.6
      ],
      [
       -4.27,
       2.31,
       9.59
      ],
      [
       -3.88,
       5.7,
       9.21
      ],
      [
       -1.58,
       7.76,
       5.5
      ],
      [
       -1.58,
       7.76,
       4.6
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.86,
       -1.45,
       7.7
      ],
      [
       -7.86,
       -1.45,
       8.6
      ],
      [
       -5.61,
       0.56,
       9.17
      ],
      [
       -3.91,
       4.72,
       8.39
      ],
      [
       -1.15,
       7.78,
       5.5
      ],
      [
       -1.15,
       7.78,
       4.6
      ]
     ]
    },
    {
     "renk": "#06b6d4",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.25,
       -0.95,
       7.7
      ],
      [
       -9.25,
       -0.95,
       8.6
      ],
      [
       -6.37,
       1.92,
       9.81
      ],
      [
       -3.27,
       4.35,
       9.77
      ],
      [
       -1.5,
       7.53,
       5.5
      ],
      [
       -1.5,
       7.53,
       4.6
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.58,
       0.6,
       7.7
      ],
      [
       -5.58,
       0.6,
       8.6
      ],
      [
       -5.24,
       2.2,
       9.25
      ],
      [
       -2.61,
       4.89,
       8.88
      ],
      [
       -1.28,
       7.4,
       5.5
      ],
      [
       -1.28,
       7.4,
       4.6
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.56,
       1.54,
       7.7
      ],
      [
       -7.56,
       1.54,
       8.6
      ],
      [
       -5.85,
       4.12,
       11.21
      ],
      [
       -3.37,
       9.17,
       10.83
      ],
      [
       -1.96,
       11.72,
       6.9
      ],
      [
       -1.96,
       11.72,
       6.0
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.12,
       0.27,
       7.7
      ],
      [
       -6.12,
       0.27,
       8.6
      ],
      [
       -4.93,
       2.86,
       9.43
      ],
      [
       -2.89,
       8.7,
       8.58
      ],
      [
       -2.21,
       11.25,
       6.9
      ],
      [
       -2.21,
       11.25,
       6.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.48,
       -2.1,
       7.7
      ],
      [
       -5.48,
       -2.1,
       8.6
      ],
      [
       -4.64,
       2.24,
       9.38
      ],
      [
       -2.76,
       7.35,
       8.44
      ],
      [
       -1.74,
       11.47,
       6.9
      ],
      [
       -1.74,
       11.47,
       6.0
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.19,
       -2.55,
       7.7
      ],
      [
       -9.19,
       -2.55,
       8.6
      ],
      [
       -10.08,
       -0.34,
       8.91
      ],
      [
       -10.53,
       0.3,
       8.87
      ],
      [
       -11.17,
       1.79,
       6.9
      ],
      [
       -11.17,
       1.79,
       6.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.51,
       -1.26,
       7.7
      ],
      [
       -10.51,
       -1.26,
       8.6
      ],
      [
       -9.64,
       -1.39,
       10.67
      ],
      [
       -11.36,
       1.38,
       9.98
      ],
      [
       -10.92,
       1.51,
       6.9
      ],
      [
       -10.92,
       1.51,
       6.0
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.74,
       -1.14,
       7.7
      ],
      [
       -10.74,
       -1.14,
       8.6
      ],
      [
       -10.52,
       0.79,
       10.85
      ],
      [
       -11.76,
       0.47,
       10.38
      ],
      [
       -11.07,
       2.18,
       6.9
      ],
      [
       -11.07,
       2.18,
       6.0
      ]
     ]
    },
    {
     "renk": "#06b6d4",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.48,
       -3.25,
       7.7
      ],
      [
       -9.48,
       -3.25,
       8.6
      ],
      [
       -10.36,
       -2.66,
       9.29
      ],
      [
       -10.85,
       -1.13,
       9.06
      ],
      [
       -11.03,
       -1.57,
       6.9
      ],
      [
       -11.03,
       -1.57,
       6.0
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.35,
       1.58,
       7.7
      ],
      [
       -7.35,
       1.58,
       8.6
      ],
      [
       -7.89,
       1.23,
       9.75
      ],
      [
       -9.14,
       -0.46,
       8.89
      ],
      [
       -10.98,
       -1.45,
       6.9
      ],
      [
       -10.98,
       -1.45,
       6.0
      ]
     ]
    },
    {
     "renk": "#16a34a",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.96,
       -0.27,
       7.7
      ],
      [
       -9.96,
       -0.27,
       8.6
      ],
      [
       -9.62,
       -0.35,
       10.14
      ],
      [
       -11.94,
       -1.37,
       9.69
      ],
      [
       -11.37,
       -1.49,
       6.9
      ],
      [
       -11.37,
       -1.49,
       6.0
      ]
     ]
    },
    {
     "renk": "#f97316",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.91,
       0.1,
       7.7
      ],
      [
       -7.91,
       0.1,
       8.6
      ],
      [
       -7.17,
       1.25,
       9.68
      ],
      [
       -5.19,
       0.73,
       9.32
      ],
      [
       -2.8,
       1.69,
       4.1
      ],
      [
       -2.8,
       1.69,
       3.2
      ]
     ]
    },
    {
     "renk": "#f97316",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.98,
       1.96,
       7.7
      ],
      [
       -8.98,
       1.96,
       8.6
      ],
      [
       -6.79,
       1.89,
       10.89
      ],
      [
       -4.56,
       1.16,
       9.95
      ],
      [
       -2.9,
       2.02,
       4.1
      ],
      [
       -2.9,
       2.02,
       3.2
      ]
     ]
    },
    {
     "renk": "#9ca3af",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.31,
       1.17,
       7.7
      ],
      [
       -6.31,
       1.17,
       8.6
      ],
      [
       -5.39,
       1.58,
       9.3
      ],
      [
       -4.2,
       2.64,
       8.52
      ],
      [
       -2.79,
       2.13,
       4.1
      ],
      [
       -2.79,
       2.13,
       3.2
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.66,
       -2.44,
       7.7
      ],
      [
       -8.66,
       -2.44,
       8.6
      ],
      [
       -7.07,
       -0.6,
       10.55
      ],
      [
       -4.43,
       1.12,
       10.1
      ],
      [
       -2.35,
       1.78,
       4.1
      ],
      [
       -2.35,
       1.78,
       3.2
      ]
     ]
    },
    {
     "renk": "#2563eb",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.44,
       -0.1,
       7.7
      ],
      [
       -8.44,
       -0.1,
       8.6
      ],
      [
       -3.91,
       -0.4,
       9.69
      ],
      [
       4.63,
       -0.19,
       9.04
      ],
      [
       9.19,
       0.45,
       4.1
      ],
      [
       9.19,
       0.45,
       3.2
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.64,
       2.33,
       7.7
      ],
      [
       -9.64,
       2.33,
       8.6
      ],
      [
       -4.12,
       1.5,
       9.6
      ],
      [
       2.49,
       1.27,
       8.8
      ],
      [
       9.05,
       0.2,
       4.1
      ],
      [
       9.05,
       0.2,
       3.2
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.45,
       1.1,
       7.7
      ],
      [
       -10.45,
       1.1,
       8.6
      ],
      [
       -3.93,
       1.49,
       10.42
      ],
      [
       3.2,
       0.63,
       9.64
      ],
      [
       9.0,
       0.64,
       4.1
      ],
      [
       9.0,
       0.64,
       3.2
      ]
     ]
    },
    {
     "renk": "#9ca3af",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.65,
       0.85,
       7.7
      ],
      [
       -5.65,
       0.85,
       8.6
      ],
      [
       -1.7,
       1.05,
       9.51
      ],
      [
       4.16,
       1.19,
       8.93
      ],
      [
       8.61,
       0.55,
       4.1
      ],
      [
       8.61,
       0.55,
       3.2
      ]
     ]
    },
    {
     "renk": "#ec4899",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.04,
       -3.28,
       7.7
      ],
      [
       -9.04,
       -3.28,
       8.6
      ],
      [
       -5.41,
       -1.1,
       10.94
      ],
      [
       -0.09,
       3.97,
       10.61
      ],
      [
       4.58,
       7.2,
       7.3
      ],
      [
       4.58,
       7.2,
       6.4
      ]
     ]
    },
    {
     "renk": "#06b6d4",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -8.86,
       -0.17,
       7.7
      ],
      [
       -8.86,
       -0.17,
       8.6
      ],
      [
       -5.52,
       3.14,
       11.26
      ],
      [
       1.41,
       4.76,
       10.45
      ],
      [
       4.55,
       7.72,
       7.3
      ],
      [
       4.55,
       7.72,
       6.4
      ]
     ]
    },
    {
     "renk": "#16a34a",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.21,
       -0.09,
       7.7
      ],
      [
       -9.21,
       -0.09,
       8.6
      ],
      [
       -5.74,
       -2.16,
       10.24
      ],
      [
       0.56,
       -4.48,
       9.36
      ],
      [
       4.97,
       -5.46,
       7.3
      ],
      [
       4.97,
       -5.46,
       6.4
      ]
     ]
    },
    {
     "renk": "#9ca3af",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.27,
       1.96,
       7.7
      ],
      [
       -5.27,
       1.96,
       8.6
      ],
      [
       -2.0,
       -0.83,
       9.73
      ],
      [
       2.63,
       -2.74,
       9.69
      ],
      [
       4.93,
       -5.73,
       7.3
      ],
      [
       4.93,
       -5.73,
       6.4
      ]
     ]
    },
    {
     "renk": "#92400e",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.23,
       -0.62,
       7.7
      ],
      [
       -10.23,
       -0.62,
       8.6
      ],
      [
       -10.43,
       1.92,
       10.02
      ],
      [
       -9.61,
       4.86,
       9.32
      ],
      [
       -10.01,
       7.77,
       6.9
      ],
      [
       -10.01,
       7.77,
       6.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.99,
       0.86,
       7.7
      ],
      [
       -5.99,
       0.86,
       8.6
      ],
      [
       -6.42,
       3.81,
       10.18
      ],
      [
       -8.41,
       6.22,
       9.01
      ],
      [
       -9.78,
       7.51,
       6.9
      ],
      [
       -9.78,
       7.51,
       6.0
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -9.11,
       -1.59,
       7.7
      ],
      [
       -9.11,
       -1.59,
       8.6
      ],
      [
       -8.66,
       -4.09,
       11.27
      ],
      [
       -10.24,
       -5.01,
       10.23
      ],
      [
       -10.03,
       -7.76,
       6.9
      ],
      [
       -10.03,
       -7.76,
       6.0
      ]
     ]
    },
    {
     "renk": "#2563eb",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -5.96,
       0.28,
       7.7
      ],
      [
       -5.96,
       0.28,
       8.6
      ],
      [
       -7.56,
       -2.08,
       8.97
      ],
      [
       -7.77,
       -5.64,
       8.72
      ],
      [
       -9.56,
       -7.12,
       6.9
      ],
      [
       -9.56,
       -7.12,
       6.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -6.5,
       0.8,
       7.7
      ],
      [
       -6.5,
       0.8,
       8.6
      ],
      [
       -6.71,
       1.47,
       10.96
      ],
      [
       -6.29,
       2.12,
       10.73
      ],
      [
       -6.29,
       2.04,
       7.5
      ],
      [
       -6.29,
       2.04,
       6.6
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -7.8,
       2.38,
       7.7
      ],
      [
       -7.8,
       2.38,
       8.6
      ],
      [
       -6.89,
       1.27,
       10.86
      ],
      [
       -6.08,
       0.91,
       9.91
      ],
      [
       -5.82,
       1.61,
       7.5
      ],
      [
       -5.82,
       1.61,
       6.6
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.17,
     "noktalar": [
      [
       -10.19,
       2.28,
       7.7
      ],
      [
       -10.19,
       2.28,
       8.6
      ],
      [
       -8.5,
       2.58,
       9.3
      ],
      [
       -6.79,
       1.63,
       8.56
      ],
      [
       -5.85,
       1.6,
       7.5
      ],
      [
       -5.85,
       1.6,
       6.6
      ]
     ]
    }
   ],
   "model3d": null,
   "hazne": {
    "var": true,
    "agiz": {
     "x0": -3.2,
     "x1": 1.6,
     "y0": -4.2,
     "y1": 4.2
    },
    "kurallar": [
     {
      "servo": "nano:10",
      "min": 150,
      "max": 180,
      "ve": {
       "servo": "nano:11",
       "min": 130,
       "max": 180
      },
      "hedef": "yesil"
     },
     {
      "servo": "nano:10",
      "min": 150,
      "max": 180,
      "hedef": "bizim"
     },
     {
      "servo": "nano:10",
      "min": 0,
      "max": 30,
      "hedef": "disari"
     }
    ],
    "bolmeler": [
     {
      "ad": "bizim",
      "kapasite": 5,
      "kapak": "mega:A8",
      "acik_min": 60,
      "acik_max": 180,
      "cikis": {
       "x": -14.5,
       "y": 1.8
      }
     },
     {
      "ad": "yesil",
      "kapasite": 2,
      "kapak": "mega:A9",
      "acik_min": 80,
      "acik_max": 180,
      "cikis": {
       "x": -14.5,
       "y": -1.8
      }
     }
    ],
    "disari": {
     "x": -2.0,
     "y": 14.5,
     "hiz_cms": 40
    }
   }
  },
  "devre": {
   "surucu": {
    "tip": "BTS7960",
    "sol": {
     "en": "mega:7",
     "rpwm": "mega:5",
     "lpwm": "mega:6"
    },
    "sag": {
     "en": "mega:2",
     "rpwm": "mega:3",
     "lpwm": "mega:4"
    },
    "sol_ters": true,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "IR_ENGEL",
     "ad": "Sol göz (MZ80, üst, çapraz)",
     "pin": "mega:22",
     "x": 11.9,
     "y": 11.0,
     "z": 3.6,
     "aci": 25,
     "menzil_cm": 20
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ göz (MZ80, üst, çapraz)",
     "pin": "mega:24",
     "x": 11.9,
     "y": -11.0,
     "z": 3.6,
     "aci": -25,
     "menzil_cm": 20
    },
    {
     "tip": "TCS3200",
     "ad": "Zemin renk (Mega)",
     "s0": "mega:52",
     "s1": "mega:50",
     "s2": "mega:46",
     "s3": "mega:48",
     "out": "mega:44",
     "x": 10.6,
     "y": 0,
     "z": 1.2,
     "bakis": "asagi"
    },
    {
     "tip": "TCS3200",
     "ad": "Ağız renk (Nano)",
     "s0": "nano:3",
     "s1": "nano:4",
     "s2": "nano:5",
     "s3": "nano:6",
     "out": "nano:2",
     "x": -3.3,
     "y": 0,
     "z": 1,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Ağız sensörü",
     "pin": "nano:12",
     "ters": true,
     "x": -1.2,
     "y": -4.5,
     "z": 1,
     "aci": 90,
     "menzil_cm": 6
    },
    {
     "tip": "BUTON",
     "ad": "Bölge anahtarı (Mega)",
     "pin": "mega:A14",
     "deger": "KIRMIZIDA_HIGH"
    },
    {
     "tip": "BUTON",
     "ad": "Bölge anahtarı (Nano)",
     "pin": "nano:8",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Rakip kapağı (yan çıkış)",
     "pin": "mega:A7",
     "baslangic_aci": 180
    },
    {
     "ad": "Bizim kapak",
     "pin": "mega:A8",
     "baslangic_aci": 0
    },
    {
     "ad": "Yeşil kapak",
     "pin": "mega:A9",
     "baslangic_aci": 0
    },
    {
     "ad": "Tokat",
     "pin": "nano:10",
     "baslangic_aci": 90
    },
    {
     "ad": "Yeşil tokat",
     "pin": "nano:11",
     "baslangic_aci": 70
    }
   ],
   "led": {
    "tip": "NeoPixel",
    "pin": "mega:42",
    "x": 10.6,
    "y": 0,
    "z": 3.35,
    "uzunluk": 13.5,
    "genislik": 0.9,
    "adet": 8
   },
   "yerlesim": [
    {
     "ad": "Arduino Mega",
     "x": -8.2,
     "y": -0.5,
     "z": 5.6,
     "uzunluk": 10.2,
     "genislik": 5.3,
     "kalinlik": 0.15,
     "renk": "#0e7490"
    },
    {
     "ad": "Arduino Nano",
     "x": -9.1,
     "y": -0.3,
     "z": 7.95,
     "uzunluk": 4.5,
     "genislik": 1.8,
     "kalinlik": 0.1,
     "renk": "#0369a1"
    },
    {
     "ad": "BTS7960 sağ",
     "x": -12.65,
     "y": -6.55,
     "z": 7.0,
     "uzunluk": 5,
     "genislik": 5,
     "kalinlik": 0.16,
     "renk": "#b91c1c"
    },
    {
     "ad": "BTS7960 sol",
     "x": -11.85,
     "y": 6.3,
     "z": 7.0,
     "uzunluk": 5,
     "genislik": 5,
     "kalinlik": 0.16,
     "renk": "#b91c1c"
    }
   ]
  }
 },
 {
  "id": "rakip",
  "ad": "Basit rakip",
  "renk": "#2563eb",
  "aciklama": "Rastgele dolaşan basit rakip robot.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Basit rakip: dolaşır, duvar görünce döner\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5   // köşe anahtarı: kırmızıda HIGH\n\nvoid motor(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0); digitalWrite(IN2, sol < 0);\n  digitalWrite(IN3, sag >= 0); digitalWrite(IN4, sag < 0);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafe() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long t = pulseIn(ECHO, HIGH, 30000);\n  return t == 0 ? 999 : t / 58;\n}\n\nvoid setup() {\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  bool kirmizi = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, kirmizi); digitalWrite(LED_M, !kirmizi);\n}\n\nvoid loop() {\n  if (mesafe() < 25) { motor(-160, -160); delay(300); motor(170, -170); delay(random(300, 700)); }\n  else motor(170, 180);\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "kutle_kg": 0.9,
   "agirlik_merkezi": {
    "x_cm": null,
    "z_cm": 4
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.6,
    "iz_cm": 15,
    "x_cm": 0
   },
   "sarhos_teker": {
    "x_cm": -8,
    "y_cm": 0,
    "cap_cm": 1.6
   },
   "motor": {
    "model": "TT 1:48 6V"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": -3,
    "y": 3,
    "z": 7
   },
   "parcalar": [
    {
     "ad": "Şasi",
     "x": 0,
     "y": 0,
     "uzunluk": 20,
     "genislik": 12,
     "z0": 2.5,
     "z1": 7,
     "renk": "#3b82f6"
    },
    {
     "ad": "Tampon",
     "x": 10.5,
     "y": 0,
     "uzunluk": 1,
     "genislik": 16,
     "z0": 0.5,
     "z1": 5,
     "renk": "#1e3a8a"
    }
   ],
   "model3d": null
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    }
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 9,
     "y": 0,
     "z": 6,
     "aci": 0
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -4,
    "y": 0,
    "z": 7
   },
   "yerlesim": [
    {
     "ad": "Arduino Uno",
     "x": -2,
     "y": 0,
     "z": 7,
     "uzunluk": 6.9,
     "genislik": 5.3,
     "kalinlik": 1.3,
     "renk": "#0e7490"
    }
   ]
  }
 },
 {
  "id": "video2026",
  "ad": "Video yarış robotu (temsili)",
  "renk": "#eab308",
  "aciklama": "25 Kasım 2026 yarış videosundaki açık şasili, dört tekerli robotun yaklaşık dış görünümü. Motor, sensör ve ölçüler temsili; robotunuzun gerçek verilerini girin.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Basit rakip: dolaşır, duvar görünce döner\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5   // köşe anahtarı: kırmızıda HIGH\n\nvoid motor(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0); digitalWrite(IN2, sol < 0);\n  digitalWrite(IN3, sag >= 0); digitalWrite(IN4, sag < 0);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafe() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long t = pulseIn(ECHO, HIGH, 30000);\n  return t == 0 ? 999 : t / 58;\n}\n\nvoid setup() {\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  bool kirmizi = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, kirmizi); digitalWrite(LED_M, !kirmizi);\n}\n\nvoid loop() {\n  if (mesafe() < 25) { motor(-160, -160); delay(300); motor(170, -170); delay(random(300, 700)); }\n  else motor(170, 180);\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "video_on_rev": 2,
   "kutle_kg": 1.6,
   "agirlik_merkezi": {
    "x_cm": 0,
    "z_cm": 4.5
   },
   "tekerlek": {
    "lastik": "ozel",
    "cap_cm": 6.5,
    "genislik_cm": 2.2,
    "iz_cm": 17,
    "x_cm": 0,
    "adet": 4,
    "dingil_cm": 12,
    "mu_statik": 0.42,
    "mu_kinetik": 0.32,
    "yuvarlanma": 0.016
   },
   "sarhos_teker": null,
   "motor": {
    "model": "JGB37-520 12V 107"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": -6,
    "y": 0,
    "z": 8
   },
   "parcalar": [
    {
     "ad": "Alçak açık şasi",
     "x": 0,
     "y": 0,
     "uzunluk": 19,
     "genislik": 13,
     "z0": 3.2,
     "z1": 3.8,
     "renk": "#30343b"
    },
    {
     "ad": "Sol yan koruma",
     "x": 0,
     "y": 6.6,
     "uzunluk": 18,
     "genislik": 0.6,
     "z0": 2.6,
     "z1": 4.7,
     "renk": "#eab308"
    },
    {
     "ad": "Sağ yan koruma",
     "x": 0,
     "y": -6.6,
     "uzunluk": 18,
     "genislik": 0.6,
     "z0": 2.6,
     "z1": 4.7,
     "renk": "#eab308"
    },
    {
     "ad": "Ön üst travers",
     "x": 9.5,
     "y": 0,
     "uzunluk": 0.8,
     "genislik": 12.8,
     "z0": 3.15,
     "z1": 4.0,
     "renk": "#facc15"
    },
    {
     "ad": "Ön LED şeridi (sabit)",
     "x": 9.65,
     "y": 0,
     "uzunluk": 0.25,
     "genislik": 10,
     "z0": 4.0,
     "z1": 4.3,
     "renk": "#ef4444",
     "kati": false
    },
    {
     "ad": "Arka elektronik kafesi (görsel)",
     "x": -5.8,
     "y": 0,
     "uzunluk": 5.5,
     "genislik": 9,
     "z0": 3.8,
     "z1": 7,
     "renk": "#374151",
     "kati": false
    }
   ],
   "model3d": null
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 8,
     "y": 0,
     "z": 4.4,
     "aci": 0
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sol IR",
     "pin": 2,
     "x": 8,
     "y": 7.5,
     "z": 1.5,
     "aci": 40,
     "menzil_cm": 14
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ IR",
     "pin": 4,
     "x": 8,
     "y": -7.5,
     "z": 1.5,
     "aci": -40,
     "menzil_cm": 14
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "TCS3200",
     "ad": "Ön renk sensörü (temsili)",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 8.9,
     "y": 0,
     "z": 1.2,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -7,
    "y": 0,
    "z": 8.9
   },
   "yerlesim": [
    {
     "ad": "Arduino Uno",
     "x": -2,
     "y": 1.5,
     "z": 3.8,
     "uzunluk": 6.9,
     "genislik": 5.3,
     "kalinlik": 1.3,
     "renk": "#0e7490"
    },
    {
     "ad": "Motor sürücüsü",
     "x": 4.5,
     "y": -1.2,
     "z": 3.8,
     "uzunluk": 4,
     "genislik": 4,
     "kalinlik": 2,
     "renk": "#b91c1c"
    },
    {
     "ad": "Pil grubu",
     "x": -5.5,
     "y": -3,
     "z": 3.8,
     "uzunluk": 5,
     "genislik": 3,
     "kalinlik": 2.3,
     "renk": "#1d4ed8"
    }
   ]
  }
 },
 {
  "id": "kirmizi4",
  "ad": "Kırmızı LED bantlı 4 teker (video)",
  "renk": "#c81e2a",
  "aciklama": "Antalya maç videolarında en çok görülen tip (6 maçta): kırmızı pleksi/MDF gövde, 4 büyük beyaz teker, önde LED bant, kapaklı kepçe. Görünüş videodan yaklaşık; motor, pil ve kod temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Yum Yum — örnek strateji (2026 kuralları)\n// 1) ARA: sahada dolaş, kepçeye giren yumurtanın rengine bak\n// 2) Kendi rengimiz ya da yeşilse kapağı kapat, yumurtayı tut\n// 3) EVE: duvarı sola alıp duvar takibi yap; zemin sensörü hedef köşenin rengini görünce bırak\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define IR_SOL 2\n#define IR_SAG 4\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define KAPAK_ACIK 90\n#define KAPAK_KAPALI 0\n\n// zemin (TCRT5000 analog) eşikleri — kendi ölçümlerinle güncelle\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo kapak;\nbool TAKIM_KIRMIZI = true;\nint durum = 0;          // 0 = ARA, 1 = EVE (duvar takibi)\nint hedef = 0;          // EVE durumunda hedef zemin: 1 kırmızı, 2 mavi, 3 yeşil\nunsigned long durumZamani = 0;\nunsigned long sonYazdirma = 0;\nbool duvarBulundu = false;\nlong sonMesafe = 0;\nunsigned long sonKontrol = 0;\nint ayniSayac = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol));\n  analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  if (sure == 0) return 999;\n  return sure / 58;\n}\n\nint renkOku(int s2, int s3) {\n  digitalWrite(S2, s2);\n  digitalWrite(S3, s3);\n  delay(2);\n  return pulseIn(RENK_OUT, LOW);\n}\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW);\n  int b = renkOku(LOW, HIGH);\n  int g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid donSaga(int ms) { motorlar(170, -170); delay(ms); }\nvoid donSola(int ms) { motorlar(-170, 170); delay(ms); }\n\nvoid durumDegistir(int yeni) {\n  durum = yeni;\n  durumZamani = millis();\n  duvarBulundu = false;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);\n  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);\n  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  kapak.attach(3);\n  kapak.write(KAPAK_KAPALI);\n  delay(200);\n  kapak.write(KAPAK_ACIK);\n  // köşeden sahanın ortasına doğru çık\n  motorlar(200, 200);\n  delay(700);\n  durumDegistir(0);\n  Serial.println(TAKIM_KIRMIZI ? \"Takim: KIRMIZI\" : \"Takim: MAVI\");\n}\n\nvoid ara() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int renk = yumurtaRengi();\n  if (renk == benim || renk == 3) {\n    motorlar(0, 0);\n    kapak.write(KAPAK_KAPALI);       // yumurtayı kepçeye hapset\n    delay(250);\n    hedef = renk;\n    Serial.print(\"Yumurta alindi, hedef=\");\n    Serial.println(hedef);\n    durumDegistir(1);\n    return;\n  }\n  if (renk != 0) {                   // rakip rengi: geri çekilip bırak\n    motorlar(-180, -180);\n    delay(350);\n    donSaga(250);\n    return;\n  }\n  if (zeminRengi() != 0 && millis() > 3000) {   // ararken köşelere girme (yanlış yumurta itmeyelim)\n    motorlar(-180, -180);\n    delay(300);\n    donSaga(random(300, 600));\n    return;\n  }\n  long d = mesafeCm();\n  bool solVar = digitalRead(IR_SOL) == LOW;\n  bool sagVar = digitalRead(IR_SAG) == LOW;\n  if (d < 25) {\n    motorlar(-170, -170);\n    delay(200);\n    donSaga(random(250, 600));\n  } else if (solVar && !sagVar) {\n    motorlar(120, 200);\n  } else if (sagVar && !solVar) {\n    motorlar(200, 120);\n  } else {\n    motorlar(190, 190);\n  }\n}\n\nvoid eve() {\n  // hedef köşeye geldik mi?\n  if (zeminRengi() == hedef) {\n    // Duvar boyunca önümüze yığılan başka yumurtaları köşeye itmemek için:\n    // biraz geri çekil, hafif sağa dön ve kepçeyle köşeye öyle gir.\n    motorlar(-160, -160);\n    delay(200);\n    donSaga(140);\n    motorlar(130, 130);\n    delay(300);\n    motorlar(0, 0);\n    kapak.write(KAPAK_ACIK);\n    delay(250);\n    motorlar(-180, -180);             // yumurtayı köşede bırakıp geri çekil\n    delay(500);\n    donSaga(450);\n    Serial.println(\"Yumurta birakildi\");\n    durumDegistir(0);\n    return;\n  }\n  long d = mesafeCm();\n  bool solDuvar = digitalRead(IR_SOL) == LOW;\n  if (!duvarBulundu) {               // önce bir duvar bul\n    if (d < 18) { donSaga(320); duvarBulundu = true; }\n    else motorlar(190, 190);\n    return;\n  }\n  if (d < 16) {                      // köşe: sağa dön, duvar solda kalsın\n    motorlar(-150, -150);\n    delay(120);\n    donSaga(330);\n  } else if (solDuvar) {\n    motorlar(200, 130);              // duvara çok yakın: hafif sağa\n  } else {\n    motorlar(120, 200);              // duvarı kaybettik: sola yanaş\n  }\n  if (millis() - durumZamani > 40000) {   // çok uzun sürdü: bırak, yeniden ara\n    kapak.write(KAPAK_ACIK);\n    durumDegistir(0);\n  }\n}\n\n// Sıkışma kontrolü: ileri giderken mesafe 1.5 sn boyunca değişmiyorsa geri çık\nvoid sikismaKontrol() {\n  if (millis() - sonKontrol < 500) return;\n  sonKontrol = millis();\n  long d = mesafeCm();\n  if (d < 900 && abs(d - sonMesafe) < 2) ayniSayac++; else ayniSayac = 0;\n  sonMesafe = d;\n  if (ayniSayac >= 3) {\n    Serial.println(\"Sikisma! geri cikiliyor\");\n    motorlar(-200, -200);\n    delay(450);\n    donSaga(random(250, 550));\n    ayniSayac = 0;\n    if (durum == 1) duvarBulundu = false;\n  }\n}\n\nvoid loop() {\n  sikismaKontrol();\n  if (durum == 0) ara(); else eve();\n  if (millis() - sonYazdirma > 500) {\n    sonYazdirma = millis();\n    Serial.print(\"durum=\");\n    Serial.print(durum);\n    Serial.print(\" zemin=\");\n    Serial.print(analogRead(ZEMIN));\n    Serial.print(\" mesafe=\");\n    Serial.println(mesafeCm());\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.7,
   "agirlik_merkezi": {
    "x_cm": -1,
    "z_cm": 4.5
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 8,
    "genislik_cm": 3.2,
    "iz_cm": 20.5,
    "x_cm": -1.5,
    "adet": 4,
    "dingil_cm": 12,
    "jant_renk": "#f3f4f6",
    "lastik_renk": "#e5e7eb"
   },
   "sarhos_teker": null,
   "motor": {
    "model": "JGA25-370 12V 280"
   },
   "pil": {
    "volt": 11.1,
    "mah": 2500
   },
   "acil_stop": {
    "x": -6.5,
    "y": 4.5,
    "z": 7
   },
   "parcalar": [
    {
     "ad": "Kırmızı alt şasi",
     "x": -0.5,
     "y": 0.0,
     "uzunluk": 19,
     "genislik": 16.4,
     "z0": 2.4,
     "z1": 3.0,
     "renk": "#c81e2a"
    },
    {
     "ad": "Sol yan plaka",
     "x": -0.5,
     "y": 8.45,
     "uzunluk": 19,
     "genislik": 0.5,
     "z0": 0.8,
     "z1": 6.5,
     "renk": "#c81e2a"
    },
    {
     "ad": "Sağ yan plaka",
     "x": -0.5,
     "y": -8.45,
     "uzunluk": 19,
     "genislik": 0.5,
     "z0": 0.8,
     "z1": 6.5,
     "renk": "#c81e2a"
    },
    {
     "ad": "Kırmızı üst kat",
     "x": -1.0,
     "y": 0.0,
     "uzunluk": 16,
     "genislik": 15.0,
     "z0": 6.5,
     "z1": 7.0,
     "renk": "#c81e2a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ön LED bandı",
     "x": 9.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 13.0,
     "z0": 3.2,
     "z1": 4.0,
     "renk": "#ef4444",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": -5.3,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": -3.7,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": -2.1,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": -0.5,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": 1.1,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": 2.7,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": 4.3,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "LED",
     "x": 9.27,
     "y": 5.9,
     "uzunluk": 0.15,
     "genislik": 0.6,
     "z0": 3.35,
     "z1": 3.85,
     "renk": "#ffd2d2",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -8.5,
     "y": -6,
     "z0": 3.0,
     "z1": 6.5,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -8.5,
     "y": 6,
     "z0": 3.0,
     "z1": 6.5,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": 5.5,
     "y": -6,
     "z0": 3.0,
     "z1": 6.5,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": 5.5,
     "y": 6,
     "z0": 3.0,
     "z1": 6.5,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Kepçe arka",
     "x": 9.5,
     "y": 0.0,
     "uzunluk": 1,
     "genislik": 13.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#7f1d1d"
    },
    {
     "ad": "Sol kol",
     "x": 13.75,
     "y": 6.0,
     "uzunluk": 7.5,
     "genislik": 1.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#7f1d1d"
    },
    {
     "ad": "Sağ kol",
     "x": 13.75,
     "y": -6.0,
     "uzunluk": 7.5,
     "genislik": 1.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#7f1d1d"
    },
    {
     "ad": "SG90 servo",
     "x": 16.45,
     "y": 6.3,
     "uzunluk": 2.3,
     "genislik": 1.2,
     "z0": 4.3,
     "z1": 6.6,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kapak",
     "servo_pin": 3,
     "pivot": [
      18.0,
      6.0
     ],
     "uzunluk": 11,
     "genislik": 0.8,
     "aci_ofset": -90,
     "yon": 1,
     "z0": 0.3,
     "z1": 4,
     "renk": "#f59e0b"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 9.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 4.5,
     "z1": 6.5,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 9.7,
     "y": 1.3,
     "z0": 4.7,
     "z1": 6.3,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 9.7,
     "y": -1.3,
     "z0": 4.7,
     "z1": 6.3,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Arduino Uno",
     "x": -1.0,
     "y": 0.0,
     "uzunluk": 6.8,
     "genislik": 5.4,
     "z0": 7.0,
     "z1": 7.15,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Uno başlıkları",
     "x": -1.0,
     "y": 2.4,
     "uzunluk": 6.0,
     "genislik": 0.4,
     "z0": 7.15,
     "z1": 8.0,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "L298N",
     "x": -1.0,
     "y": -5.4,
     "uzunluk": 4.2,
     "genislik": 4.2,
     "z0": 7.0,
     "z1": 7.15,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "L298N soğutucu",
     "x": -1.0,
     "y": -5.4,
     "uzunluk": 2.4,
     "genislik": 2.4,
     "z0": 7.15,
     "z1": 9.4,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -6.5,
     "y": 4.5,
     "z0": 7.0,
     "z1": 9.0,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -6.5,
     "y": 4.5,
     "z0": 9.0,
     "z1": 9.08,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -6.5,
     "y": -3.2,
     "z0": 3.08,
     "z1": 4.92,
     "uzunluk": 1.85,
     "genislik": 6.5,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -4.4,
     "y": -3.2,
     "z0": 3.08,
     "z1": 4.92,
     "uzunluk": 1.85,
     "genislik": 6.5,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    }
   ],
   "kablolar": [
    {
     "renk": "#2563eb",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -2.83,
       1.39,
       7.4
      ],
      [
       0.78,
       0.97,
       9.57
      ],
      [
       5.59,
       0.42,
       8.97
      ],
      [
       9.2,
       0,
       5.5
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -2.91,
       1.04,
       7.4
      ],
      [
       0.72,
       0.73,
       9.05
      ],
      [
       5.57,
       0.31,
       8.45
      ],
      [
       9.2,
       0,
       5.5
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       0.44,
       -1.62,
       7.4
      ],
      [
       3.91,
       0.51,
       8.25
      ],
      [
       8.53,
       3.36,
       7.65
      ],
      [
       12,
       5.5,
       4.5
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -1.34,
       1.05,
       7.4
      ],
      [
       2.66,
       2.38,
       8.2
      ],
      [
       8.0,
       4.16,
       7.6
      ],
      [
       12,
       5.5,
       4.5
      ]
     ]
    },
    {
     "renk": "#f97316",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -2.17,
       1.21,
       7.4
      ],
      [
       1.33,
       3.1,
       9.26
      ],
      [
       6.0,
       5.61,
       8.66
      ],
      [
       9.5,
       7.5,
       1.5
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.16,
     "noktalar": [
      [
       1.01,
       -1.88,
       7.4
      ],
      [
       3.55,
       0.94,
       8.25
      ],
      [
       6.95,
       4.69,
       7.65
      ],
      [
       9.5,
       7.5,
       1.5
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       1.2,
       -0.48,
       7.4
      ],
      [
       3.69,
       -2.58,
       8.59
      ],
      [
       7.01,
       -5.39,
       7.99
      ],
      [
       9.5,
       -7.5,
       1.5
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       0.13,
       0.11,
       7.4
      ],
      [
       2.94,
       -2.17,
       9.57
      ],
      [
       6.69,
       -5.22,
       8.97
      ],
      [
       9.5,
       -7.5,
       1.5
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -0.74,
       -0.62,
       7.4
      ],
      [
       -2.01,
       -1.33,
       9.42
      ],
      [
       -3.72,
       -2.29,
       8.82
      ],
      [
       -5,
       -3,
       5
      ]
     ]
    },
    {
     "renk": "#f97316",
     "kalinlik": 0.16,
     "noktalar": [
      [
       1.26,
       1.71,
       7.4
      ],
      [
       -0.62,
       0.29,
       8.95
      ],
      [
       -3.12,
       -1.59,
       8.35
      ],
      [
       -5,
       -3,
       5
      ]
     ]
    }
   ]
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 9.2,
     "y": 0,
     "z": 5.5,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sol IR",
     "pin": 2,
     "x": 9.4,
     "y": 7.5,
     "z": 1.5,
     "aci": 40,
     "menzil_cm": 14
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ IR",
     "pin": 4,
     "x": 9.4,
     "y": -7.5,
     "z": 1.5,
     "aci": -40,
     "menzil_cm": 14
    },
    {
     "tip": "TCS3200",
     "ad": "Renk (kepçe)",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 10.6,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Kapak servosu",
     "pin": 3,
     "hiz_derece_s": 450,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": 9.1,
    "y": 0,
    "z": 3.6,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "yesil_buldozer",
  "ad": "Yeşil buldozer (video)",
  "renk": "#15803d",
  "aciklama": "Videodaki geniş, alçak yeşil plaka gövdeli robot: üstte tel kulp, önde içbükey bıçak. Renk sensörü yok; yumurtaları sürükleyerek sahayı tarar, kendi köşesine girince bırakır. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Buldozer tipi rakip (örnek kod)\n// Renk sensörü yok: önündeki bıçakla yumurtaları sürükleyerek sahayı tarar, duvarda döner.\n// Kendi köşesine girerse sürüklediğini bırakıp geri çıkar; rakip köşesinden kaçar (rakibe puan yazdırmamak için).\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define ZEMIN A0\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define HIZ 200\n#define KAVIS 18      // sağ motor biraz yavaş: geniş yay çizerek tarar\n\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_MAVI_ALT 560\n\nbool TAKIM_KIRMIZI = true;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW); digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW); digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  return sure == 0 ? 999 : sure / 58;\n}\n\n// 0 = beyaz, 1 = kırmızı köşe, 2 = mavi köşe, 3 = diğer (yeşil)\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 3;\n}\n\nvoid setup() {\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n}\n\nvoid loop() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int z = zeminRengi();\n  if (millis() > 2500 && z == benim) {          // kendi köşemiz: sürüklediklerini bırak\n    motorlar(150, 150); delay(350);\n    motorlar(-HIZ, -HIZ); delay(600);\n    motorlar(HIZ, -HIZ); delay(random(500, 900));\n    return;\n  }\n  if (millis() > 2500 && z != 0) {              // başka köşe: kaç\n    motorlar(-HIZ, -HIZ); delay(450);\n    motorlar(-HIZ, HIZ); delay(random(400, 800));\n    return;\n  }\n  if (mesafeCm() < 20) {\n    motorlar(-HIZ, -HIZ); delay(300);\n    motorlar(HIZ, -HIZ); delay(random(400, 900));\n    return;\n  }\n  motorlar(HIZ, HIZ - KAVIS);\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.5,
   "agirlik_merkezi": {
    "x_cm": -2,
    "z_cm": 3.5
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.6,
    "iz_cm": 19,
    "x_cm": -4
   },
   "sarhos_teker": {
    "x_cm": 7,
    "y_cm": 0,
    "cap_cm": 1.6
   },
   "motor": {
    "model": "TT 1:48 6V"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": -8.5,
    "y": 4.5,
    "z": 7.4
   },
   "parcalar": [
    {
     "ad": "Yeşil gövde plakası",
     "x": -1.0,
     "y": 0.0,
     "uzunluk": 22,
     "genislik": 23.0,
     "z0": 6.6,
     "z1": 7.4,
     "renk": "#15803d"
    },
    {
     "ad": "Yeşil gövde yanı",
     "x": -1.0,
     "y": 11.25,
     "uzunluk": 22,
     "genislik": 0.5,
     "z0": 0.6,
     "z1": 6.6,
     "renk": "#15803d"
    },
    {
     "ad": "Yeşil gövde yanı",
     "x": -1.0,
     "y": -11.25,
     "uzunluk": 22,
     "genislik": 0.5,
     "z0": 0.6,
     "z1": 6.6,
     "renk": "#15803d"
    },
    {
     "ad": "Motor kutusu",
     "x": -4.0,
     "y": 0.0,
     "uzunluk": 10,
     "genislik": 15.6,
     "z0": 2.2,
     "z1": 6.6,
     "renk": "#166534"
    },
    {
     "ad": "Ön bıçak",
     "x": 10.3,
     "y": 0.0,
     "uzunluk": 0.6,
     "genislik": 18,
     "z0": 0.2,
     "z1": 3.5,
     "renk": "#14532d"
    },
    {
     "ad": "Sol bıçak kanadı",
     "x": 12.05,
     "y": 10.9,
     "uzunluk": 4.32,
     "genislik": 0.6,
     "z0": 0.2,
     "z1": 3.5,
     "aci": 47.8,
     "renk": "#14532d"
    },
    {
     "ad": "Sağ bıçak kanadı",
     "x": 12.05,
     "y": -10.9,
     "uzunluk": 4.32,
     "genislik": 0.6,
     "z0": 0.2,
     "z1": 3.5,
     "aci": -47.8,
     "renk": "#14532d"
    },
    {
     "ad": "Arka kapak",
     "x": -11.75,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 21.0,
     "z0": 0.6,
     "z1": 5.5,
     "renk": "#15803d"
    },
    {
     "ad": "Kulp ayağı",
     "sekil": "silindir",
     "eksen": "z",
     "x": -2,
     "y": 9,
     "z0": 7.4,
     "z1": 12.9,
     "uzunluk": 0.35,
     "genislik": 0.35,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Kulp ayağı",
     "sekil": "silindir",
     "eksen": "z",
     "x": -2,
     "y": -9,
     "z0": 7.4,
     "z1": 12.9,
     "uzunluk": 0.35,
     "genislik": 0.35,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Tel kulp",
     "sekil": "silindir",
     "eksen": "y",
     "x": -2,
     "y": 0,
     "z0": 12.72,
     "z1": 13.08,
     "uzunluk": 0.35,
     "genislik": 18.4,
     "renk": "#9ca3af",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 10.45,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 4.0,
     "z1": 6.0,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 11.1,
     "y": 1.3,
     "z0": 4.2,
     "z1": 5.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 11.1,
     "y": -1.3,
     "z0": 4.2,
     "z1": 5.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Arduino Uno",
     "x": -3.0,
     "y": 0.0,
     "uzunluk": 6.8,
     "genislik": 5.4,
     "z0": 7.4,
     "z1": 7.550000000000001,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Uno başlıkları",
     "x": -3.0,
     "y": 2.4,
     "uzunluk": 6.0,
     "genislik": 0.4,
     "z0": 7.550000000000001,
     "z1": 8.4,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "L298N",
     "x": -3.0,
     "y": -5.4,
     "uzunluk": 4.2,
     "genislik": 4.2,
     "z0": 7.4,
     "z1": 7.550000000000001,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "L298N soğutucu",
     "x": -3.0,
     "y": -5.4,
     "uzunluk": 2.4,
     "genislik": 2.4,
     "z0": 7.550000000000001,
     "z1": 9.8,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -8.5,
     "y": 4.5,
     "z0": 7.4,
     "z1": 9.4,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -8.5,
     "y": 4.5,
     "z0": 9.4,
     "z1": 9.48,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -9,
     "y": -2,
     "z0": 7.38,
     "z1": 9.23,
     "uzunluk": 1.85,
     "genislik": 6.5,
     "renk": "#16a34a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -9,
     "y": 4.6,
     "z0": 7.38,
     "z1": 9.23,
     "uzunluk": 1.85,
     "genislik": 6.5,
     "renk": "#16a34a",
     "kati": false,
     "gorsel": true
    }
   ],
   "kablolar": [
    {
     "renk": "#f97316",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -0.72,
       1.79,
       7.8
      ],
      [
       2.68,
       1.25,
       8.7
      ],
      [
       7.2,
       0.54,
       8.1
      ],
      [
       10.6,
       0,
       5
      ]
     ]
    },
    {
     "renk": "#2563eb",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -3.69,
       -1.32,
       7.8
      ],
      [
       0.59,
       -0.93,
       10.06
      ],
      [
       6.31,
       -0.4,
       9.46
      ],
      [
       10.6,
       0,
       5
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -4.24,
       -1.15,
       7.8
      ],
      [
       -2.37,
       -0.81,
       8.66
      ],
      [
       0.13,
       -0.35,
       8.06
      ],
      [
       2,
       0,
       1
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -0.5,
       0.55,
       7.8
      ],
      [
       0.25,
       0.39,
       10.05
      ],
      [
       1.25,
       0.17,
       9.45
      ],
      [
       2,
       0,
       1
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -2.78,
       -0.22,
       7.8
      ],
      [
       -4.65,
       0.15,
       9.08
      ],
      [
       -7.13,
       0.63,
       8.48
      ],
      [
       -9,
       1,
       7
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -1.14,
       -0.54,
       7.8
      ],
      [
       -3.5,
       -0.08,
       10.28
      ],
      [
       -6.64,
       0.54,
       9.68
      ],
      [
       -9,
       1,
       7
      ]
     ]
    }
   ]
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 10.6,
     "y": 0,
     "z": 5.0,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -6,
    "y": 0,
    "z": 7.5,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "mavi_huni",
  "ad": "Mavi V kanatlı huni (video)",
  "renk": "#1d4ed8",
  "aciklama": "Videodaki önü geniş mavi V kanatlı robot: kanatlar yumurtayı ortadaki boğaza toplar, renk sensörü bakar, tokat servosu kendi renginiyse hazneye iter, değilse yana atar. Hazne dolunca köşede arka kapağı açar. 4 büyük beyaz teker. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// İç hazneli rakip robot (örnek kod)\n// Ön huniden giren yumurta boğazdaki stopere dayanır. Ağız sensörü yumurtayı görünce renk okunur:\n//   kendi rengimiz ya da yeşilse tokat servosu yumurtayı hazneye iter, değilse yandan dışarı atar.\n// Hazne dolunca (ya da süre azalınca) robot kendi köşesini arar, köşeye girince arka kapağı açıp boşaltır.\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define AGIZ 2        // boğazdaki kızılötesi: yumurta varken LOW\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define SIRALA 1      // 0: rengine bakmadan her yumurtayı al (ayıklayıcısız robot)\n#define DOLU 4        // haznede bu kadar yumurta olunca köşeye git\n#define HIZ 185\n#define DONUS 175\n\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo tokat;   // pin 3: 170 = hazneye, 10 = dışarı, 90 = bekle\nServo kapi;    // pin 4: arka boşaltma kapağı, 0 = kapalı\nbool TAKIM_KIRMIZI = true;\nint sayi = 0;\nint durum = 0;           // 0 = topla, 1 = köşeye götür\nunsigned long sonDonus = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW); digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW); digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  return sure == 0 ? 999 : sure / 58;\n}\n\nint renkOku(int s2, int s3) { digitalWrite(S2, s2); digitalWrite(S3, s3); delay(2); return pulseIn(RENK_OUT, LOW); }\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW), b = renkOku(LOW, HIGH), g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid don(int ms) { motorlar(DONUS, -DONUS); delay(ms); }\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(AGIZ, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  tokat.attach(3); tokat.write(90);\n  kapi.attach(4); kapi.write(0);\n  motorlar(HIZ, HIZ); delay(800);   // köşeden çık\n}\n\n// Dolaş: duvar/robot görünce geri çekil ve rastgele dön\nvoid gez() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int z = zeminRengi();\n  if (millis() > 3000 && z != 0 && (durum == 0 || z != benim)) {   // toplarken köşelere girme, götürürken başka köşeden çık\n    motorlar(-HIZ, -HIZ); delay(300); don(random(300, 700)); return;\n  }\n  if (mesafeCm() < 22) { motorlar(-HIZ, -HIZ); delay(250); don(random(250, 650)); return; }\n  if (millis() - sonDonus > 7000) { sonDonus = millis(); don(random(150, 450)); }   // aynı çizgide dönüp durmasın\n  motorlar(HIZ, HIZ);\n}\n\nvoid loop() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  if (durum == 0) {\n    if (digitalRead(AGIZ) == LOW) {\n      motorlar(0, 0); delay(80);\n      int r = SIRALA ? yumurtaRengi() : benim;\n      bool al = (r == benim || r == 3 || r == 0);\n      tokat.write(al ? 170 : 10); delay(350); tokat.write(90); delay(150);\n      if (al) sayi++;\n      Serial.print(al ? \"Yumurta alindi: \" : \"Yumurta atildi, renk=\"); Serial.println(al ? sayi : r);\n    }\n    if (sayi >= DOLU || (millis() > 80000 && sayi > 0)) { durum = 1; Serial.println(\"Hazne dolu, kose araniyor\"); }\n    gez();\n  } else {\n    if (zeminRengi() == benim) {\n      motorlar(HIZ, HIZ); delay(450);           // robotun tamamı köşeye girsin\n      motorlar(0, 0); kapi.write(150); delay(300 * sayi + 700);\n      motorlar(-HIZ, -HIZ); delay(450); kapi.write(0);\n      Serial.print(\"Bosaltildi: \"); Serial.println(sayi);\n      sayi = 0; durum = 0; don(550);\n      return;\n    }\n    gez();\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.6,
   "agirlik_merkezi": {
    "x_cm": -3,
    "z_cm": 4.5
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 8.5,
    "genislik_cm": 3,
    "iz_cm": 19.5,
    "x_cm": -4,
    "adet": 4,
    "dingil_cm": 11,
    "jant_renk": "#f3f4f6",
    "lastik_renk": "#e5e7eb"
   },
   "sarhos_teker": null,
   "motor": {
    "model": "JGA25-370 12V 280"
   },
   "pil": {
    "volt": 11.1,
    "mah": 2500
   },
   "acil_stop": {
    "x": -10.5,
    "y": 4.5,
    "z": 7.5
   },
   "parcalar": [
    {
     "ad": "Mavi şasi",
     "x": -2.5,
     "y": 0.0,
     "uzunluk": 17,
     "genislik": 15.0,
     "z0": 2.8,
     "z1": 3.4,
     "renk": "#1d4ed8"
    },
    {
     "ad": "Mavi yan",
     "x": -2.5,
     "y": 7.75,
     "uzunluk": 17,
     "genislik": 0.5,
     "z0": 0.8,
     "z1": 5.5,
     "renk": "#1d4ed8"
    },
    {
     "ad": "Mavi yan",
     "x": -2.5,
     "y": -7.75,
     "uzunluk": 17,
     "genislik": 0.5,
     "z0": 0.8,
     "z1": 5.5,
     "renk": "#1d4ed8"
    },
    {
     "ad": "Arka kapı",
     "x": -11.25,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 8,
     "z0": 0.4,
     "z1": 2.6,
     "renk": "#0f172a"
    },
    {
     "ad": "Sol huni kanadı",
     "x": 10.25,
     "y": 7.95,
     "uzunluk": 11.04,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 7.0,
     "aci": 47.2,
     "renk": "#1d4ed8"
    },
    {
     "ad": "Sağ huni kanadı",
     "x": 10.25,
     "y": -7.95,
     "uzunluk": 11.04,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 7.0,
     "aci": -47.2,
     "renk": "#1d4ed8"
    },
    {
     "ad": "Hazne kutusu",
     "x": -4.5,
     "y": 0.0,
     "uzunluk": 12.0,
     "genislik": 10,
     "z0": 3.4,
     "z1": 7.5,
     "renk": "#1e3a8a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Sol boğaz duvarı",
     "x": 3.75,
     "y": 3.65,
     "uzunluk": 5.5,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#0f172a"
    },
    {
     "ad": "Sağ boğaz duvarı",
     "x": 3.75,
     "y": -3.65,
     "uzunluk": 5.5,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#0f172a"
    },
    {
     "ad": "Boğaz stoperi",
     "x": 0.8,
     "y": 0.0,
     "uzunluk": 0.4,
     "genislik": 7.8,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#0f172a"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 6.15,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 5.0,
     "z1": 7.0,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 6.8,
     "y": 1.3,
     "z0": 5.2,
     "z1": 6.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 6.8,
     "y": -1.3,
     "z0": 5.2,
     "z1": 6.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Arduino Uno",
     "x": -5.0,
     "y": 0.0,
     "uzunluk": 6.8,
     "genislik": 5.4,
     "z0": 7.5,
     "z1": 7.65,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Uno başlıkları",
     "x": -5.0,
     "y": 2.4,
     "uzunluk": 6.0,
     "genislik": 0.4,
     "z0": 7.65,
     "z1": 8.5,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "L298N",
     "x": -5.0,
     "y": -5.4,
     "uzunluk": 4.2,
     "genislik": 4.2,
     "z0": 7.5,
     "z1": 7.65,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "L298N soğutucu",
     "x": -5.0,
     "y": -5.4,
     "uzunluk": 2.4,
     "genislik": 2.4,
     "z0": 7.65,
     "z1": 9.9,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -10.5,
     "y": 4.5,
     "z0": 7.5,
     "z1": 9.5,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -10.5,
     "y": 4.5,
     "z0": 9.5,
     "z1": 9.58,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Ultrason direği",
     "x": 5.8,
     "y": 0.0,
     "uzunluk": 0.4,
     "genislik": 1.0,
     "z0": 3.4,
     "z1": 5.0,
     "renk": "#0f172a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Tokat servosu",
     "x": 0.8,
     "y": 5.35,
     "uzunluk": 1.2,
     "genislik": 2.3,
     "z0": 3.4,
     "z1": 6.2,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kapı servosu",
     "x": -9.65,
     "y": 4.8,
     "uzunluk": 2.3,
     "genislik": 1.2,
     "z0": 3.4,
     "z1": 6.2,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    }
   ],
   "hazne": {
    "var": true,
    "agiz": {
     "x0": 1.5,
     "x1": 6.0,
     "y0": -3.2,
     "y1": 3.2
    },
    "kurallar": [
     {
      "servo": 3,
      "min": 150,
      "max": 180,
      "hedef": "bizim"
     },
     {
      "servo": 3,
      "min": 0,
      "max": 30,
      "hedef": "disari"
     }
    ],
    "bolmeler": [
     {
      "ad": "bizim",
      "kapasite": 6,
      "kapak": 4,
      "acik_min": 100,
      "acik_max": 180,
      "cikis": {
       "x": -13.5,
       "y": 0
      }
     }
    ],
    "disari": {
     "x": 3.5,
     "y": -13,
     "hiz_cms": 45
    }
   },
   "kablolar": [
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -6.31,
       0.18,
       7.9
      ],
      [
       -2.53,
       0.12,
       9.37
      ],
      [
       2.52,
       0.05,
       8.77
      ],
      [
       6.3,
       0,
       6.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -4.37,
       -1.74,
       7.9
      ],
      [
       -1.17,
       -1.22,
       8.72
      ],
      [
       3.1,
       -0.52,
       8.12
      ],
      [
       6.3,
       0,
       6.0
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -6.2,
       -1.06,
       7.9
      ],
      [
       -3.89,
       -0.74,
       10.49
      ],
      [
       -0.81,
       -0.32,
       9.89
      ],
      [
       1.5,
       0,
       1
      ]
     ]
    },
    {
     "renk": "#facc15",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -4.8,
       0.2,
       7.9
      ],
      [
       -2.91,
       0.14,
       9.41
      ],
      [
       -0.39,
       0.06,
       8.81
      ],
      [
       1.5,
       0,
       1
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -6.34,
       -1.39,
       7.9
      ],
      [
       -4.2,
       0.52,
       10.37
      ],
      [
       -1.34,
       3.08,
       9.77
      ],
      [
       0.8,
       5,
       6
      ]
     ]
    },
    {
     "renk": "#e11d48",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -3.79,
       0.69,
       7.9
      ],
      [
       -2.42,
       1.98,
       8.82
      ],
      [
       -0.58,
       3.71,
       8.22
      ],
      [
       0.8,
       5,
       6
      ]
     ]
    },
    {
     "renk": "#111827",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -5.99,
       -1.88,
       7.9
      ],
      [
       -7.05,
       0.19,
       10.26
      ],
      [
       -8.45,
       2.94,
       9.66
      ],
      [
       -9.5,
       5,
       6
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -4.53,
       1.68,
       7.9
      ],
      [
       -6.02,
       2.68,
       9.4
      ],
      [
       -8.01,
       4.0,
       8.8
      ],
      [
       -9.5,
       5,
       6
      ]
     ]
    }
   ]
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 6.6,
     "y": 0,
     "z": 6.0,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": -2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Boğaz sensörü",
     "pin": 2,
     "x": 3.5,
     "y": -3.0,
     "z": 1,
     "aci": 90,
     "menzil_cm": 5
    },
    {
     "tip": "TCS3200",
     "ad": "Boğaz renk",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 1.5,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Tokat (ayıklayıcı)",
     "pin": 3,
     "hiz_derece_s": 500,
     "baslangic_aci": 90
    },
    {
     "ad": "Boşaltma kapağı",
     "pin": 4,
     "hiz_derece_s": 300,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -8,
    "y": 0,
    "z": 7.6,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "siyah_kutu",
  "ad": "Siyah alçak kutu (video)",
  "renk": "#111827",
  "aciklama": "Videodaki kapalı, alçak siyah gövdeli robot: önde dar ağız, içinde ayıklayıcılı hazne, arka boşaltma kapağı. Gövde içine gizli iki küçük teker + sarhoş teker. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// İç hazneli rakip robot (örnek kod)\n// Ön huniden giren yumurta boğazdaki stopere dayanır. Ağız sensörü yumurtayı görünce renk okunur:\n//   kendi rengimiz ya da yeşilse tokat servosu yumurtayı hazneye iter, değilse yandan dışarı atar.\n// Hazne dolunca (ya da süre azalınca) robot kendi köşesini arar, köşeye girince arka kapağı açıp boşaltır.\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define AGIZ 2        // boğazdaki kızılötesi: yumurta varken LOW\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define SIRALA 1      // 0: rengine bakmadan her yumurtayı al (ayıklayıcısız robot)\n#define DOLU 5        // haznede bu kadar yumurta olunca köşeye git\n#define HIZ 200\n#define DONUS 175\n\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo tokat;   // pin 3: 170 = hazneye, 10 = dışarı, 90 = bekle\nServo kapi;    // pin 4: arka boşaltma kapağı, 0 = kapalı\nbool TAKIM_KIRMIZI = true;\nint sayi = 0;\nint durum = 0;           // 0 = topla, 1 = köşeye götür\nunsigned long sonDonus = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW); digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW); digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  return sure == 0 ? 999 : sure / 58;\n}\n\nint renkOku(int s2, int s3) { digitalWrite(S2, s2); digitalWrite(S3, s3); delay(2); return pulseIn(RENK_OUT, LOW); }\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW), b = renkOku(LOW, HIGH), g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid don(int ms) { motorlar(DONUS, -DONUS); delay(ms); }\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(AGIZ, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  tokat.attach(3); tokat.write(90);\n  kapi.attach(4); kapi.write(0);\n  motorlar(HIZ, HIZ); delay(800);   // köşeden çık\n}\n\n// Dolaş: duvar/robot görünce geri çekil ve rastgele dön\nvoid gez() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int z = zeminRengi();\n  if (millis() > 3000 && z != 0 && (durum == 0 || z != benim)) {   // toplarken köşelere girme, götürürken başka köşeden çık\n    motorlar(-HIZ, -HIZ); delay(300); don(random(300, 700)); return;\n  }\n  if (mesafeCm() < 22) { motorlar(-HIZ, -HIZ); delay(250); don(random(250, 650)); return; }\n  if (millis() - sonDonus > 7000) { sonDonus = millis(); don(random(150, 450)); }   // aynı çizgide dönüp durmasın\n  motorlar(HIZ, HIZ);\n}\n\nvoid loop() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  if (durum == 0) {\n    if (digitalRead(AGIZ) == LOW) {\n      motorlar(0, 0); delay(80);\n      int r = SIRALA ? yumurtaRengi() : benim;\n      bool al = (r == benim || r == 3 || r == 0);\n      tokat.write(al ? 170 : 10); delay(350); tokat.write(90); delay(150);\n      if (al) sayi++;\n      Serial.print(al ? \"Yumurta alindi: \" : \"Yumurta atildi, renk=\"); Serial.println(al ? sayi : r);\n    }\n    if (sayi >= DOLU || (millis() > 80000 && sayi > 0)) { durum = 1; Serial.println(\"Hazne dolu, kose araniyor\"); }\n    gez();\n  } else {\n    if (zeminRengi() == benim) {\n      motorlar(HIZ, HIZ); delay(450);           // robotun tamamı köşeye girsin\n      motorlar(0, 0); kapi.write(150); delay(300 * sayi + 700);\n      motorlar(-HIZ, -HIZ); delay(450); kapi.write(0);\n      Serial.print(\"Bosaltildi: \"); Serial.println(sayi);\n      sayi = 0; durum = 0; don(550);\n      return;\n    }\n    gez();\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.4,
   "agirlik_merkezi": {
    "x_cm": -4.5,
    "z_cm": 4
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6,
    "genislik_cm": 2.2,
    "iz_cm": 15.5,
    "x_cm": -2
   },
   "sarhos_teker": {
    "x_cm": -9.5,
    "y_cm": 0,
    "cap_cm": 1.6
   },
   "motor": {
    "model": "N20 6V 300"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": -7,
    "y": 5,
    "z": 8.8
   },
   "parcalar": [
    {
     "ad": "Siyah kutu gövde",
     "x": -1.5,
     "y": 0.0,
     "uzunluk": 19,
     "genislik": 19.0,
     "z0": 6.2,
     "z1": 8.5,
     "renk": "#111827"
    },
    {
     "ad": "Sol etek",
     "x": -1.5,
     "y": 9.25,
     "uzunluk": 19,
     "genislik": 0.5,
     "z0": 0.6,
     "z1": 6.2,
     "renk": "#111827"
    },
    {
     "ad": "Sağ etek",
     "x": -1.5,
     "y": -9.25,
     "uzunluk": 19,
     "genislik": 0.5,
     "z0": 0.6,
     "z1": 6.2,
     "renk": "#111827"
    },
    {
     "ad": "İç sol duvar",
     "x": -1.5,
     "y": 5.05,
     "uzunluk": 19,
     "genislik": 1.7,
     "z0": 0.6,
     "z1": 6.2,
     "renk": "#111827"
    },
    {
     "ad": "İç sağ duvar",
     "x": -1.5,
     "y": -5.05,
     "uzunluk": 19,
     "genislik": 1.7,
     "z0": 0.6,
     "z1": 6.2,
     "renk": "#111827"
    },
    {
     "ad": "Sol ağız yanağı",
     "x": 10.2,
     "y": 6.25,
     "uzunluk": 5.76,
     "genislik": 0.6,
     "z0": 0.3,
     "z1": 4.5,
     "aci": 51.3,
     "renk": "#111827"
    },
    {
     "ad": "Sağ ağız yanağı",
     "x": 10.2,
     "y": -6.25,
     "uzunluk": 5.76,
     "genislik": 0.6,
     "z0": 0.3,
     "z1": 4.5,
     "aci": -51.3,
     "renk": "#111827"
    },
    {
     "ad": "Arka kapı",
     "x": -11.25,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 7.0,
     "z0": 0.4,
     "z1": 2.6,
     "renk": "#374151"
    },
    {
     "ad": "Üst kapak",
     "x": -1.5,
     "y": 0.0,
     "uzunluk": 18.0,
     "genislik": 17.0,
     "z0": 8.5,
     "z1": 8.8,
     "renk": "#1f2937",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Sol boğaz duvarı",
     "x": -1.25,
     "y": 3.65,
     "uzunluk": 5.5,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#374151"
    },
    {
     "ad": "Sağ boğaz duvarı",
     "x": -1.25,
     "y": -3.65,
     "uzunluk": 5.5,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#374151"
    },
    {
     "ad": "Boğaz stoperi",
     "x": -4.2,
     "y": 0.0,
     "uzunluk": 0.4,
     "genislik": 7.8,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#374151"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 8.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 5.0,
     "z1": 7.0,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 8.7,
     "y": 1.3,
     "z0": 5.2,
     "z1": 6.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 8.7,
     "y": -1.3,
     "z0": 5.2,
     "z1": 6.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -7,
     "y": 5,
     "z0": 8.8,
     "z1": 10.8,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -7,
     "y": 5,
     "z0": 10.8,
     "z1": 10.88,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Mavi LED şeridi",
     "x": 8.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 14,
     "z0": 7.2,
     "z1": 7.8,
     "renk": "#3b82f6",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    }
   ],
   "hazne": {
    "var": true,
    "agiz": {
     "x0": -3.5,
     "x1": 1.0,
     "y0": -3.2,
     "y1": 3.2
    },
    "kurallar": [
     {
      "servo": 3,
      "min": 150,
      "max": 180,
      "hedef": "bizim"
     },
     {
      "servo": 3,
      "min": 0,
      "max": 30,
      "hedef": "disari"
     }
    ],
    "bolmeler": [
     {
      "ad": "bizim",
      "kapasite": 7,
      "kapak": 4,
      "acik_min": 100,
      "acik_max": 180,
      "cikis": {
       "x": -13.5,
       "y": 0
      }
     }
    ],
    "disari": {
     "x": -1.5,
     "y": -13,
     "hiz_cms": 45
    }
   }
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 8.4,
     "y": 0,
     "z": 6.0,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": -6,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Boğaz sensörü",
     "pin": 2,
     "x": -1.5,
     "y": -3.0,
     "z": 1,
     "aci": 90,
     "menzil_cm": 5
    },
    {
     "tip": "TCS3200",
     "ad": "Boğaz renk",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": -3.5,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Tokat (ayıklayıcı)",
     "pin": 3,
     "hiz_derece_s": 500,
     "baslangic_aci": 90
    },
    {
     "ad": "Boşaltma kapağı",
     "pin": 4,
     "hiz_derece_s": 300,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": 7.9,
    "y": 0,
    "z": 7.5,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "ahsap_kutu",
  "ad": "Ahşap kutu (video)",
  "renk": "#a16207",
  "aciklama": "Videodaki ahşap kutu gövdeli, üstünde beyaz kutu olan ağır robot: önden giren her yumurtayı ayırmadan hazneye alır (yanlış renk = ceza riski), köşede boşaltır. Yavaş TT 1:120 motorlar. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// İç hazneli rakip robot (örnek kod)\n// Ön huniden giren yumurta boğazdaki stopere dayanır. Ağız sensörü yumurtayı görünce renk okunur:\n//   kendi rengimiz ya da yeşilse tokat servosu yumurtayı hazneye iter, değilse yandan dışarı atar.\n// Hazne dolunca (ya da süre azalınca) robot kendi köşesini arar, köşeye girince arka kapağı açıp boşaltır.\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define AGIZ 2        // boğazdaki kızılötesi: yumurta varken LOW\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define SIRALA 0      // 0: rengine bakmadan her yumurtayı al (ayıklayıcısız robot)\n#define DOLU 6        // haznede bu kadar yumurta olunca köşeye git\n#define HIZ 210\n#define DONUS 175\n\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo tokat;   // pin 3: 170 = hazneye, 10 = dışarı, 90 = bekle\nServo kapi;    // pin 4: arka boşaltma kapağı, 0 = kapalı\nbool TAKIM_KIRMIZI = true;\nint sayi = 0;\nint durum = 0;           // 0 = topla, 1 = köşeye götür\nunsigned long sonDonus = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW); digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW); digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  return sure == 0 ? 999 : sure / 58;\n}\n\nint renkOku(int s2, int s3) { digitalWrite(S2, s2); digitalWrite(S3, s3); delay(2); return pulseIn(RENK_OUT, LOW); }\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW), b = renkOku(LOW, HIGH), g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid don(int ms) { motorlar(DONUS, -DONUS); delay(ms); }\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(AGIZ, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  tokat.attach(3); tokat.write(90);\n  kapi.attach(4); kapi.write(0);\n  motorlar(HIZ, HIZ); delay(800);   // köşeden çık\n}\n\n// Dolaş: duvar/robot görünce geri çekil ve rastgele dön\nvoid gez() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int z = zeminRengi();\n  if (millis() > 3000 && z != 0 && (durum == 0 || z != benim)) {   // toplarken köşelere girme, götürürken başka köşeden çık\n    motorlar(-HIZ, -HIZ); delay(300); don(random(300, 700)); return;\n  }\n  if (mesafeCm() < 22) { motorlar(-HIZ, -HIZ); delay(250); don(random(250, 650)); return; }\n  if (millis() - sonDonus > 7000) { sonDonus = millis(); don(random(150, 450)); }   // aynı çizgide dönüp durmasın\n  motorlar(HIZ, HIZ);\n}\n\nvoid loop() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  if (durum == 0) {\n    if (digitalRead(AGIZ) == LOW) {\n      motorlar(0, 0); delay(80);\n      int r = SIRALA ? yumurtaRengi() : benim;\n      bool al = (r == benim || r == 3 || r == 0);\n      tokat.write(al ? 170 : 10); delay(350); tokat.write(90); delay(150);\n      if (al) sayi++;\n      Serial.print(al ? \"Yumurta alindi: \" : \"Yumurta atildi, renk=\"); Serial.println(al ? sayi : r);\n    }\n    if (sayi >= DOLU || (millis() > 80000 && sayi > 0)) { durum = 1; Serial.println(\"Hazne dolu, kose araniyor\"); }\n    gez();\n  } else {\n    if (zeminRengi() == benim) {\n      motorlar(HIZ, HIZ); delay(450);           // robotun tamamı köşeye girsin\n      motorlar(0, 0); kapi.write(150); delay(300 * sayi + 700);\n      motorlar(-HIZ, -HIZ); delay(450); kapi.write(0);\n      Serial.print(\"Bosaltildi: \"); Serial.println(sayi);\n      sayi = 0; durum = 0; don(550);\n      return;\n    }\n    gez();\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 2.4,
   "agirlik_merkezi": {
    "x_cm": -5,
    "z_cm": 5.5
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.6,
    "iz_cm": 23.5,
    "x_cm": -2
   },
   "sarhos_teker": {
    "x_cm": -11,
    "y_cm": 0,
    "cap_cm": 2.0
   },
   "motor": {
    "model": "TT 1:120 6V"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": -11,
    "y": 7,
    "z": 8
   },
   "parcalar": [
    {
     "ad": "Ahşap taban",
     "x": -1.5,
     "y": 0.0,
     "uzunluk": 23,
     "genislik": 19.2,
     "z0": 2.6,
     "z1": 3.2,
     "renk": "#a16207"
    },
    {
     "ad": "Ahşap yan",
     "x": -1.5,
     "y": 9.9,
     "uzunluk": 23,
     "genislik": 0.6,
     "z0": 0.5,
     "z1": 8,
     "renk": "#a16207"
    },
    {
     "ad": "Ahşap yan",
     "x": -1.5,
     "y": -9.9,
     "uzunluk": 23,
     "genislik": 0.6,
     "z0": 0.5,
     "z1": 8,
     "renk": "#a16207"
    },
    {
     "ad": "Ahşap arka",
     "x": -12.7,
     "y": 0.0,
     "uzunluk": 0.6,
     "genislik": 19.2,
     "z0": 3.2,
     "z1": 8,
     "renk": "#a16207"
    },
    {
     "ad": "Arka kapı",
     "x": -13.25,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 8,
     "z0": 0.4,
     "z1": 2.6,
     "renk": "#713f12"
    },
    {
     "ad": "Sol iç huni",
     "x": 8.4,
     "y": 6.6,
     "uzunluk": 6.28,
     "genislik": 0.6,
     "z0": 0.3,
     "z1": 2.6,
     "aci": 59.3,
     "renk": "#713f12"
    },
    {
     "ad": "Sağ iç huni",
     "x": 8.4,
     "y": -6.6,
     "uzunluk": 6.28,
     "genislik": 0.6,
     "z0": 0.3,
     "z1": 2.6,
     "aci": -59.3,
     "renk": "#713f12"
    },
    {
     "ad": "Beyaz üst kutu",
     "x": -2.5,
     "y": 0.0,
     "uzunluk": 13,
     "genislik": 14,
     "z0": 8,
     "z1": 12.5,
     "renk": "#f5f5f4",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kırmızı LED sırası",
     "x": 10.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 12,
     "z0": 6,
     "z1": 6.8,
     "renk": "#ef4444",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "Sol boğaz duvarı",
     "x": 3.75,
     "y": 3.65,
     "uzunluk": 5.5,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#713f12"
    },
    {
     "ad": "Sağ boğaz duvarı",
     "x": 3.75,
     "y": -3.65,
     "uzunluk": 5.5,
     "genislik": 0.5,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#713f12"
    },
    {
     "ad": "Boğaz stoperi",
     "x": 0.8,
     "y": 0.0,
     "uzunluk": 0.4,
     "genislik": 7.8,
     "z0": 0.3,
     "z1": 2.6,
     "renk": "#713f12"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 10.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 4.0,
     "z1": 6.0,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 10.7,
     "y": 1.3,
     "z0": 4.2,
     "z1": 5.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 10.7,
     "y": -1.3,
     "z0": 4.2,
     "z1": 5.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -11,
     "y": 7,
     "z0": 8,
     "z1": 10.0,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -11,
     "y": 7,
     "z0": 10,
     "z1": 10.08,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    }
   ],
   "hazne": {
    "var": true,
    "agiz": {
     "x0": 1.5,
     "x1": 6.0,
     "y0": -3.2,
     "y1": 3.2
    },
    "kurallar": [
     {
      "servo": 3,
      "min": 150,
      "max": 180,
      "hedef": "bizim"
     },
     {
      "servo": 3,
      "min": 0,
      "max": 30,
      "hedef": "disari"
     }
    ],
    "bolmeler": [
     {
      "ad": "bizim",
      "kapasite": 8,
      "kapak": 4,
      "acik_min": 100,
      "acik_max": 180,
      "cikis": {
       "x": -15.5,
       "y": 0
      }
     }
    ],
    "disari": {
     "x": 3.5,
     "y": -13,
     "hiz_cms": 45
    }
   }
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 10.4,
     "y": 0,
     "z": 5,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": -2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Boğaz sensörü",
     "pin": 2,
     "x": 3.5,
     "y": -3.0,
     "z": 1,
     "aci": 90,
     "menzil_cm": 5
    },
    {
     "tip": "TCS3200",
     "ad": "Boğaz renk",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 1.5,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Tokat (ayıklayıcı)",
     "pin": 3,
     "hiz_derece_s": 500,
     "baslangic_aci": 90
    },
    {
     "ad": "Boşaltma kapağı",
     "pin": 4,
     "hiz_derece_s": 300,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": 10,
    "y": 0,
    "z": 7,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "sari_tt_kit",
  "ad": "Sarı 4WD TT kiti (video)",
  "renk": "#f59e0b",
  "aciklama": "Videoda görülen klasik 4 motorlu akıllı araba kiti: iki kat pleksi, 4 sarı TT motor ve sarı teker, önde kapaklı kepçe. 3×18650 (11,1 V) varsayıldı: simülasyonda 2×18650 ve L298N kaybıyla 4 TT motor yerinde hiç dönemiyor. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Yum Yum — örnek strateji (2026 kuralları)\n// 1) ARA: sahada dolaş, kepçeye giren yumurtanın rengine bak\n// 2) Kendi rengimiz ya da yeşilse kapağı kapat, yumurtayı tut\n// 3) EVE: duvarı sola alıp duvar takibi yap; zemin sensörü hedef köşenin rengini görünce bırak\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define IR_SOL 2\n#define IR_SAG 4\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define KAPAK_ACIK 90\n#define KAPAK_KAPALI 0\n\n// zemin (TCRT5000 analog) eşikleri — kendi ölçümlerinle güncelle\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo kapak;\nbool TAKIM_KIRMIZI = true;\nint durum = 0;          // 0 = ARA, 1 = EVE (duvar takibi)\nint hedef = 0;          // EVE durumunda hedef zemin: 1 kırmızı, 2 mavi, 3 yeşil\nunsigned long durumZamani = 0;\nunsigned long sonYazdirma = 0;\nbool duvarBulundu = false;\nlong sonMesafe = 0;\nunsigned long sonKontrol = 0;\nint ayniSayac = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol));\n  analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  if (sure == 0) return 999;\n  return sure / 58;\n}\n\nint renkOku(int s2, int s3) {\n  digitalWrite(S2, s2);\n  digitalWrite(S3, s3);\n  delay(2);\n  return pulseIn(RENK_OUT, LOW);\n}\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW);\n  int b = renkOku(LOW, HIGH);\n  int g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid donSaga(int ms) { motorlar(170, -170); delay(ms); }\nvoid donSola(int ms) { motorlar(-170, 170); delay(ms); }\n\nvoid durumDegistir(int yeni) {\n  durum = yeni;\n  durumZamani = millis();\n  duvarBulundu = false;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);\n  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);\n  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  kapak.attach(3);\n  kapak.write(KAPAK_KAPALI);\n  delay(200);\n  kapak.write(KAPAK_ACIK);\n  // köşeden sahanın ortasına doğru çık\n  motorlar(200, 200);\n  delay(700);\n  durumDegistir(0);\n  Serial.println(TAKIM_KIRMIZI ? \"Takim: KIRMIZI\" : \"Takim: MAVI\");\n}\n\nvoid ara() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int renk = yumurtaRengi();\n  if (renk == benim || renk == 3) {\n    motorlar(0, 0);\n    kapak.write(KAPAK_KAPALI);       // yumurtayı kepçeye hapset\n    delay(250);\n    hedef = renk;\n    Serial.print(\"Yumurta alindi, hedef=\");\n    Serial.println(hedef);\n    durumDegistir(1);\n    return;\n  }\n  if (renk != 0) {                   // rakip rengi: geri çekilip bırak\n    motorlar(-180, -180);\n    delay(350);\n    donSaga(250);\n    return;\n  }\n  if (zeminRengi() != 0 && millis() > 3000) {   // ararken köşelere girme (yanlış yumurta itmeyelim)\n    motorlar(-180, -180);\n    delay(300);\n    donSaga(random(300, 600));\n    return;\n  }\n  long d = mesafeCm();\n  bool solVar = digitalRead(IR_SOL) == LOW;\n  bool sagVar = digitalRead(IR_SAG) == LOW;\n  if (d < 25) {\n    motorlar(-170, -170);\n    delay(200);\n    donSaga(random(250, 600));\n  } else if (solVar && !sagVar) {\n    motorlar(120, 200);\n  } else if (sagVar && !solVar) {\n    motorlar(200, 120);\n  } else {\n    motorlar(190, 190);\n  }\n}\n\nvoid eve() {\n  // hedef köşeye geldik mi?\n  if (zeminRengi() == hedef) {\n    // Duvar boyunca önümüze yığılan başka yumurtaları köşeye itmemek için:\n    // biraz geri çekil, hafif sağa dön ve kepçeyle köşeye öyle gir.\n    motorlar(-160, -160);\n    delay(200);\n    donSaga(140);\n    motorlar(130, 130);\n    delay(300);\n    motorlar(0, 0);\n    kapak.write(KAPAK_ACIK);\n    delay(250);\n    motorlar(-180, -180);             // yumurtayı köşede bırakıp geri çekil\n    delay(500);\n    donSaga(450);\n    Serial.println(\"Yumurta birakildi\");\n    durumDegistir(0);\n    return;\n  }\n  long d = mesafeCm();\n  bool solDuvar = digitalRead(IR_SOL) == LOW;\n  if (!duvarBulundu) {               // önce bir duvar bul\n    if (d < 18) { donSaga(320); duvarBulundu = true; }\n    else motorlar(190, 190);\n    return;\n  }\n  if (d < 16) {                      // köşe: sağa dön, duvar solda kalsın\n    motorlar(-150, -150);\n    delay(120);\n    donSaga(330);\n  } else if (solDuvar) {\n    motorlar(200, 130);              // duvara çok yakın: hafif sağa\n  } else {\n    motorlar(120, 200);              // duvarı kaybettik: sola yanaş\n  }\n  if (millis() - durumZamani > 40000) {   // çok uzun sürdü: bırak, yeniden ara\n    kapak.write(KAPAK_ACIK);\n    durumDegistir(0);\n  }\n}\n\n// Sıkışma kontrolü: ileri giderken mesafe 1.5 sn boyunca değişmiyorsa geri çık\nvoid sikismaKontrol() {\n  if (millis() - sonKontrol < 500) return;\n  sonKontrol = millis();\n  long d = mesafeCm();\n  if (d < 900 && abs(d - sonMesafe) < 2) ayniSayac++; else ayniSayac = 0;\n  sonMesafe = d;\n  if (ayniSayac >= 3) {\n    Serial.println(\"Sikisma! geri cikiliyor\");\n    motorlar(-200, -200);\n    delay(450);\n    donSaga(random(250, 550));\n    ayniSayac = 0;\n    if (durum == 1) duvarBulundu = false;\n  }\n}\n\nvoid loop() {\n  sikismaKontrol();\n  if (durum == 0) ara(); else eve();\n  if (millis() - sonYazdirma > 500) {\n    sonYazdirma = millis();\n    Serial.print(\"durum=\");\n    Serial.print(durum);\n    Serial.print(\" zemin=\");\n    Serial.print(analogRead(ZEMIN));\n    Serial.print(\" mesafe=\");\n    Serial.println(mesafeCm());\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.1,
   "agirlik_merkezi": {
    "x_cm": -2,
    "z_cm": 4.5
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.7,
    "iz_cm": 15.5,
    "x_cm": -2.5,
    "adet": 4,
    "dingil_cm": 11,
    "jant_renk": "#fbbf24",
    "lastik_renk": "#111827"
   },
   "sarhos_teker": null,
   "motor": {
    "model": "TT 1:48 6V"
   },
   "pil": {
    "volt": 11.1
   },
   "acil_stop": {
    "x": -7.5,
    "y": 4.5,
    "z": 7.7
   },
   "parcalar": [
    {
     "ad": "Şeffaf pleksi alt kat",
     "x": -2.0,
     "y": 0.0,
     "uzunluk": 20,
     "genislik": 12.2,
     "z0": 3.6,
     "z1": 3.9,
     "renk": "#fde68a",
     "malzeme": "parlak"
    },
    {
     "ad": "Şeffaf pleksi üst kat",
     "x": -2.0,
     "y": 0.0,
     "uzunluk": 18,
     "genislik": 13.0,
     "z0": 7.4,
     "z1": 7.7,
     "renk": "#fde68a",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Ön tampon",
     "x": 8.3,
     "y": 0.0,
     "uzunluk": 0.6,
     "genislik": 12.2,
     "z0": 1.0,
     "z1": 3.6,
     "renk": "#374151"
    },
    {
     "ad": "TT motor",
     "sekil": "silindir",
     "eksen": "x",
     "x": -8,
     "y": 4.8,
     "z0": 1.6,
     "z1": 3.6,
     "uzunluk": 6.5,
     "genislik": 2.0,
     "renk": "#f59e0b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "TT motor",
     "sekil": "silindir",
     "eksen": "x",
     "x": -8,
     "y": -4.8,
     "z0": 1.6,
     "z1": 3.6,
     "uzunluk": 6.5,
     "genislik": 2.0,
     "renk": "#f59e0b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "TT motor",
     "sekil": "silindir",
     "eksen": "x",
     "x": 3,
     "y": 4.8,
     "z0": 1.6,
     "z1": 3.6,
     "uzunluk": 6.5,
     "genislik": 2.0,
     "renk": "#f59e0b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "TT motor",
     "sekil": "silindir",
     "eksen": "x",
     "x": 3,
     "y": -4.8,
     "z0": 1.6,
     "z1": 3.6,
     "uzunluk": 6.5,
     "genislik": 2.0,
     "renk": "#f59e0b",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -10.5,
     "y": -5.5,
     "z0": 3.9,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": -10.5,
     "y": 5.5,
     "z0": 3.9,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": 6,
     "y": -5.5,
     "z0": 3.9,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Direk",
     "sekil": "silindir",
     "eksen": "z",
     "x": 6,
     "y": 5.5,
     "z0": 3.9,
     "z1": 7.4,
     "uzunluk": 0.5,
     "genislik": 0.5,
     "renk": "#c9a23f",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Kepçe arka",
     "x": 9.1,
     "y": 0.0,
     "uzunluk": 1.0,
     "genislik": 13.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#374151"
    },
    {
     "ad": "Sol kol",
     "x": 13.35,
     "y": 6.0,
     "uzunluk": 7.5,
     "genislik": 1.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#374151"
    },
    {
     "ad": "Sağ kol",
     "x": 13.35,
     "y": -6.0,
     "uzunluk": 7.5,
     "genislik": 1.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#374151"
    },
    {
     "ad": "SG90 servo",
     "x": 16.05,
     "y": 6.3,
     "uzunluk": 2.3,
     "genislik": 1.2,
     "z0": 4.3,
     "z1": 6.6,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kapak",
     "servo_pin": 3,
     "pivot": [
      17.6,
      6.0
     ],
     "uzunluk": 11,
     "genislik": 0.8,
     "aci_ofset": -90,
     "yon": 1,
     "z0": 0.3,
     "z1": 4,
     "renk": "#f59e0b"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 7.85,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 4.5,
     "z1": 6.5,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 8.5,
     "y": 1.3,
     "z0": 4.7,
     "z1": 6.3,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 8.5,
     "y": -1.3,
     "z0": 4.7,
     "z1": 6.3,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Arduino Uno",
     "x": -2.0,
     "y": 0.0,
     "uzunluk": 6.8,
     "genislik": 5.4,
     "z0": 7.7,
     "z1": 7.8500000000000005,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Uno başlıkları",
     "x": -2.0,
     "y": 2.4,
     "uzunluk": 6.0,
     "genislik": 0.4,
     "z0": 7.8500000000000005,
     "z1": 8.7,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "L298N",
     "x": -2.0,
     "y": -5.4,
     "uzunluk": 4.2,
     "genislik": 4.2,
     "z0": 7.7,
     "z1": 7.8500000000000005,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "L298N soğutucu",
     "x": -2.0,
     "y": -5.4,
     "uzunluk": 2.4,
     "genislik": 2.4,
     "z0": 7.8500000000000005,
     "z1": 10.1,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -7.5,
     "y": 4.5,
     "z0": 7.7,
     "z1": 9.7,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -7.5,
     "y": 4.5,
     "z0": 9.7,
     "z1": 9.78,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -9,
     "y": -3.3,
     "z0": 3.92,
     "z1": 5.77,
     "uzunluk": 1.85,
     "genislik": 6.5,
     "renk": "#16a34a",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Pil",
     "sekil": "silindir",
     "eksen": "y",
     "x": -9,
     "y": 3.3,
     "z0": 3.92,
     "z1": 5.77,
     "uzunluk": 1.85,
     "genislik": 6.5,
     "renk": "#16a34a",
     "kati": false,
     "gorsel": true
    }
   ],
   "kablolar": [
    {
     "renk": "#2563eb",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -0.53,
       1.29,
       8.1
      ],
      [
       2.03,
       0.9,
       9.77
      ],
      [
       5.44,
       0.39,
       9.17
      ],
      [
       8,
       0,
       5.5
      ]
     ]
    },
    {
     "renk": "#7c3aed",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -4.32,
       -1.42,
       8.1
      ],
      [
       -0.62,
       -0.99,
       9.96
      ],
      [
       4.31,
       -0.43,
       9.36
      ],
      [
       8,
       0,
       5.5
      ]
     ]
    },
    {
     "renk": "#16a34a",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -2.9,
       -1.91,
       8.1
      ],
      [
       1.72,
       0.31,
       9.78
      ],
      [
       7.88,
       3.28,
       9.18
      ],
      [
       12.5,
       5.5,
       4.5
      ]
     ]
    },
    {
     "renk": "#f97316",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -0.85,
       -0.34,
       8.1
      ],
      [
       3.15,
       1.41,
       9.87
      ],
      [
       8.49,
       3.75,
       9.27
      ],
      [
       12.5,
       5.5,
       4.5
      ]
     ]
    },
    {
     "renk": "#2563eb",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -3.54,
       0.21,
       8.1
      ],
      [
       -1.57,
       1.59,
       10.35
      ],
      [
       1.04,
       3.42,
       9.75
      ],
      [
       3,
       4.8,
       3
      ]
     ]
    },
    {
     "renk": "#f8fafc",
     "kalinlik": 0.16,
     "noktalar": [
      [
       -1.19,
       0.44,
       8.1
      ],
      [
       0.07,
       1.75,
       9.06
      ],
      [
       1.74,
       3.49,
       8.46
      ],
      [
       3,
       4.8,
       3
      ]
     ]
    }
   ]
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 8.4,
     "y": 0,
     "z": 5.5,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sol IR",
     "pin": 2,
     "x": 8,
     "y": 7.5,
     "z": 1.5,
     "aci": 40,
     "menzil_cm": 14
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ IR",
     "pin": 4,
     "x": 8,
     "y": -7.5,
     "z": 1.5,
     "aci": -40,
     "menzil_cm": 14
    },
    {
     "tip": "TCS3200",
     "ad": "Renk (kepçe)",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 10.2,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Kapak servosu",
     "pin": 3,
     "hiz_derece_s": 450,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": 7.5,
    "y": 0,
    "z": 7.8,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "turkuaz_alcak",
  "ad": "Turkuaz alçak şasi (video)",
  "renk": "#14b8a6",
  "aciklama": "Videodaki çok alçak turkuaz gövdeli hızlı robot: 4 koyu teker, çamurluklar, önde kapaklı kepçe. JGA25 motorlar, 3S pil. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Yum Yum — örnek strateji (2026 kuralları)\n// 1) ARA: sahada dolaş, kepçeye giren yumurtanın rengine bak\n// 2) Kendi rengimiz ya da yeşilse kapağı kapat, yumurtayı tut\n// 3) EVE: duvarı sola alıp duvar takibi yap; zemin sensörü hedef köşenin rengini görünce bırak\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define IR_SOL 2\n#define IR_SAG 4\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define KAPAK_ACIK 90\n#define KAPAK_KAPALI 0\n\n// zemin (TCRT5000 analog) eşikleri — kendi ölçümlerinle güncelle\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo kapak;\nbool TAKIM_KIRMIZI = true;\nint durum = 0;          // 0 = ARA, 1 = EVE (duvar takibi)\nint hedef = 0;          // EVE durumunda hedef zemin: 1 kırmızı, 2 mavi, 3 yeşil\nunsigned long durumZamani = 0;\nunsigned long sonYazdirma = 0;\nbool duvarBulundu = false;\nlong sonMesafe = 0;\nunsigned long sonKontrol = 0;\nint ayniSayac = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol));\n  analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  if (sure == 0) return 999;\n  return sure / 58;\n}\n\nint renkOku(int s2, int s3) {\n  digitalWrite(S2, s2);\n  digitalWrite(S3, s3);\n  delay(2);\n  return pulseIn(RENK_OUT, LOW);\n}\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW);\n  int b = renkOku(LOW, HIGH);\n  int g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid donSaga(int ms) { motorlar(170, -170); delay(ms); }\nvoid donSola(int ms) { motorlar(-170, 170); delay(ms); }\n\nvoid durumDegistir(int yeni) {\n  durum = yeni;\n  durumZamani = millis();\n  duvarBulundu = false;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);\n  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);\n  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  kapak.attach(3);\n  kapak.write(KAPAK_KAPALI);\n  delay(200);\n  kapak.write(KAPAK_ACIK);\n  // köşeden sahanın ortasına doğru çık\n  motorlar(200, 200);\n  delay(700);\n  durumDegistir(0);\n  Serial.println(TAKIM_KIRMIZI ? \"Takim: KIRMIZI\" : \"Takim: MAVI\");\n}\n\nvoid ara() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int renk = yumurtaRengi();\n  if (renk == benim || renk == 3) {\n    motorlar(0, 0);\n    kapak.write(KAPAK_KAPALI);       // yumurtayı kepçeye hapset\n    delay(250);\n    hedef = renk;\n    Serial.print(\"Yumurta alindi, hedef=\");\n    Serial.println(hedef);\n    durumDegistir(1);\n    return;\n  }\n  if (renk != 0) {                   // rakip rengi: geri çekilip bırak\n    motorlar(-180, -180);\n    delay(350);\n    donSaga(250);\n    return;\n  }\n  if (zeminRengi() != 0 && millis() > 3000) {   // ararken köşelere girme (yanlış yumurta itmeyelim)\n    motorlar(-180, -180);\n    delay(300);\n    donSaga(random(300, 600));\n    return;\n  }\n  long d = mesafeCm();\n  bool solVar = digitalRead(IR_SOL) == LOW;\n  bool sagVar = digitalRead(IR_SAG) == LOW;\n  if (d < 25) {\n    motorlar(-170, -170);\n    delay(200);\n    donSaga(random(250, 600));\n  } else if (solVar && !sagVar) {\n    motorlar(120, 200);\n  } else if (sagVar && !solVar) {\n    motorlar(200, 120);\n  } else {\n    motorlar(190, 190);\n  }\n}\n\nvoid eve() {\n  // hedef köşeye geldik mi?\n  if (zeminRengi() == hedef) {\n    // Duvar boyunca önümüze yığılan başka yumurtaları köşeye itmemek için:\n    // biraz geri çekil, hafif sağa dön ve kepçeyle köşeye öyle gir.\n    motorlar(-160, -160);\n    delay(200);\n    donSaga(140);\n    motorlar(130, 130);\n    delay(300);\n    motorlar(0, 0);\n    kapak.write(KAPAK_ACIK);\n    delay(250);\n    motorlar(-180, -180);             // yumurtayı köşede bırakıp geri çekil\n    delay(500);\n    donSaga(450);\n    Serial.println(\"Yumurta birakildi\");\n    durumDegistir(0);\n    return;\n  }\n  long d = mesafeCm();\n  bool solDuvar = digitalRead(IR_SOL) == LOW;\n  if (!duvarBulundu) {               // önce bir duvar bul\n    if (d < 18) { donSaga(320); duvarBulundu = true; }\n    else motorlar(190, 190);\n    return;\n  }\n  if (d < 16) {                      // köşe: sağa dön, duvar solda kalsın\n    motorlar(-150, -150);\n    delay(120);\n    donSaga(330);\n  } else if (solDuvar) {\n    motorlar(200, 130);              // duvara çok yakın: hafif sağa\n  } else {\n    motorlar(120, 200);              // duvarı kaybettik: sola yanaş\n  }\n  if (millis() - durumZamani > 40000) {   // çok uzun sürdü: bırak, yeniden ara\n    kapak.write(KAPAK_ACIK);\n    durumDegistir(0);\n  }\n}\n\n// Sıkışma kontrolü: ileri giderken mesafe 1.5 sn boyunca değişmiyorsa geri çık\nvoid sikismaKontrol() {\n  if (millis() - sonKontrol < 500) return;\n  sonKontrol = millis();\n  long d = mesafeCm();\n  if (d < 900 && abs(d - sonMesafe) < 2) ayniSayac++; else ayniSayac = 0;\n  sonMesafe = d;\n  if (ayniSayac >= 3) {\n    Serial.println(\"Sikisma! geri cikiliyor\");\n    motorlar(-200, -200);\n    delay(450);\n    donSaga(random(250, 550));\n    ayniSayac = 0;\n    if (durum == 1) duvarBulundu = false;\n  }\n}\n\nvoid loop() {\n  sikismaKontrol();\n  if (durum == 0) ara(); else eve();\n  if (millis() - sonYazdirma > 500) {\n    sonYazdirma = millis();\n    Serial.print(\"durum=\");\n    Serial.print(durum);\n    Serial.print(\" zemin=\");\n    Serial.print(analogRead(ZEMIN));\n    Serial.print(\" mesafe=\");\n    Serial.println(mesafeCm());\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.0,
   "agirlik_merkezi": {
    "x_cm": -1,
    "z_cm": 3
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6,
    "genislik_cm": 2.4,
    "iz_cm": 18.5,
    "x_cm": -1.5,
    "adet": 4,
    "dingil_cm": 12,
    "lastik_renk": "#1f2937"
   },
   "sarhos_teker": null,
   "motor": {
    "model": "JGA25-370 12V 280"
   },
   "pil": {
    "volt": 11.1
   },
   "acil_stop": {
    "x": -7,
    "y": 4.5,
    "z": 5
   },
   "parcalar": [
    {
     "ad": "Turkuaz alçak gövde",
     "x": -1.0,
     "y": 0.0,
     "uzunluk": 18,
     "genislik": 16,
     "z0": 1.6,
     "z1": 4.6,
     "renk": "#14b8a6"
    },
    {
     "ad": "Turkuaz üst kapak",
     "x": -1.0,
     "y": 0.0,
     "uzunluk": 16,
     "genislik": 14,
     "z0": 4.6,
     "z1": 5.0,
     "renk": "#0d9488",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Yan çamurluk",
     "x": -1.0,
     "y": 9.25,
     "uzunluk": 18,
     "genislik": 2.5,
     "z0": 4.6,
     "z1": 5.0,
     "renk": "#14b8a6",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Yan çamurluk",
     "x": -1.0,
     "y": -9.25,
     "uzunluk": 18,
     "genislik": 2.5,
     "z0": 4.6,
     "z1": 5.0,
     "renk": "#14b8a6",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kepçe arka",
     "x": 8.5,
     "y": 0.0,
     "uzunluk": 1,
     "genislik": 13.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#115e59"
    },
    {
     "ad": "Sol kol",
     "x": 12.75,
     "y": 6.0,
     "uzunluk": 7.5,
     "genislik": 1.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#115e59"
    },
    {
     "ad": "Sağ kol",
     "x": 12.75,
     "y": -6.0,
     "uzunluk": 7.5,
     "genislik": 1.0,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#115e59"
    },
    {
     "ad": "SG90 servo",
     "x": 15.45,
     "y": 6.3,
     "uzunluk": 2.3,
     "genislik": 1.2,
     "z0": 4.3,
     "z1": 6.6,
     "renk": "#2563eb",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Kapak",
     "servo_pin": 3,
     "pivot": [
      17.0,
      6.0
     ],
     "uzunluk": 11,
     "genislik": 0.8,
     "aci_ofset": -90,
     "yon": 1,
     "z0": 0.3,
     "z1": 4,
     "renk": "#f59e0b"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 7.95,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 5.0,
     "z1": 7.0,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 8.6,
     "y": 1.3,
     "z0": 5.2,
     "z1": 6.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 8.6,
     "y": -1.3,
     "z0": 5.2,
     "z1": 6.8,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrason ayağı",
     "x": 7.6,
     "y": 0.0,
     "uzunluk": 0.4,
     "genislik": 1.0,
     "z0": 5.0,
     "z1": 5.2,
     "renk": "#115e59",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Arduino Uno",
     "x": -1.5,
     "y": 0.0,
     "uzunluk": 6.8,
     "genislik": 5.4,
     "z0": 5.0,
     "z1": 5.15,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Uno başlıkları",
     "x": -1.5,
     "y": 2.4,
     "uzunluk": 6.0,
     "genislik": 0.4,
     "z0": 5.15,
     "z1": 6.0,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "L298N",
     "x": -1.5,
     "y": -5.4,
     "uzunluk": 4.2,
     "genislik": 4.2,
     "z0": 5.0,
     "z1": 5.15,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "L298N soğutucu",
     "x": -1.5,
     "y": -5.4,
     "uzunluk": 2.4,
     "genislik": 2.4,
     "z0": 5.15,
     "z1": 7.4,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -7.0,
     "y": 4.5,
     "z0": 5.0,
     "z1": 7.0,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -7.0,
     "y": 4.5,
     "z0": 7.0,
     "z1": 7.08,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    }
   ]
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 8.5,
     "y": 0,
     "z": 6.0,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 2,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sol IR",
     "pin": 2,
     "x": 8.4,
     "y": 7.5,
     "z": 1.5,
     "aci": 40,
     "menzil_cm": 14
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ IR",
     "pin": 4,
     "x": 8.4,
     "y": -7.5,
     "z": 1.5,
     "aci": -40,
     "menzil_cm": 14
    },
    {
     "tip": "TCS3200",
     "ad": "Renk (kepçe)",
     "s2": "A1",
     "s3": "A2",
     "out": 13,
     "olcek": 20,
     "x": 9.6,
     "y": 0,
     "z": 1,
     "aci": 0,
     "bakis": "ileri",
     "menzil_cm": 2.5
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [
    {
     "ad": "Kapak servosu",
     "pin": 3,
     "hiz_derece_s": 450,
     "baslangic_aci": 0
    }
   ],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -8,
    "y": 0,
    "z": 5.1,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 },
 {
  "id": "kirmizi_kizak",
  "ad": "Kırmızı uzun kızak (video)",
  "renk": "#dc2626",
  "aciklama": "Videodaki önü uzun, alçak süpürge plakalı kırmızı robot: iki teker + sarhoş teker, yumurtaları plakanın önünde sürükler, renk ayırmaz. Temsili.",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Buldozer tipi rakip (örnek kod)\n// Renk sensörü yok: önündeki bıçakla yumurtaları sürükleyerek sahayı tarar, duvarda döner.\n// Kendi köşesine girerse sürüklediğini bırakıp geri çıkar; rakip köşesinden kaçar (rakibe puan yazdırmamak için).\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define ZEMIN A0\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define HIZ 200\n#define KAVIS 10      // sağ motor biraz yavaş: geniş yay çizerek tarar\n\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_MAVI_ALT 560\n\nbool TAKIM_KIRMIZI = true;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW); digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW); digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  return sure == 0 ? 999 : sure / 58;\n}\n\n// 0 = beyaz, 1 = kırmızı köşe, 2 = mavi köşe, 3 = diğer (yeşil)\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 3;\n}\n\nvoid setup() {\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n}\n\nvoid loop() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int z = zeminRengi();\n  if (millis() > 2500 && z == benim) {          // kendi köşemiz: sürüklediklerini bırak\n    motorlar(150, 150); delay(350);\n    motorlar(-HIZ, -HIZ); delay(600);\n    motorlar(HIZ, -HIZ); delay(random(500, 900));\n    return;\n  }\n  if (millis() > 2500 && z != 0) {              // başka köşe: kaç\n    motorlar(-HIZ, -HIZ); delay(450);\n    motorlar(-HIZ, HIZ); delay(random(400, 800));\n    return;\n  }\n  if (mesafeCm() < 20) {\n    motorlar(-HIZ, -HIZ); delay(300);\n    motorlar(HIZ, -HIZ); delay(random(400, 900));\n    return;\n  }\n  motorlar(HIZ, HIZ - KAVIS);\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
   "detayli_gorunum": true,
   "model3d": null,
   "kutle_kg": 1.2,
   "agirlik_merkezi": {
    "x_cm": -6,
    "z_cm": 4
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.6,
    "iz_cm": 18,
    "x_cm": -4,
    "jant_renk": "#f3f4f6"
   },
   "sarhos_teker": {
    "x_cm": -11,
    "y_cm": 0,
    "cap_cm": 1.6
   },
   "motor": {
    "model": "TT 1:48 6V"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": -9.5,
    "y": 4.5,
    "z": 6
   },
   "parcalar": [
    {
     "ad": "Kırmızı gövde",
     "x": -3.0,
     "y": 0.0,
     "uzunluk": 14,
     "genislik": 15.0,
     "z0": 2.4,
     "z1": 6,
     "renk": "#dc2626"
    },
    {
     "ad": "Uzun süpürge plakası",
     "x": 9.5,
     "y": 0.0,
     "uzunluk": 11,
     "genislik": 20,
     "z0": 0.25,
     "z1": 0.6,
     "renk": "#991b1b"
    },
    {
     "ad": "Sol süpürge kenarı",
     "x": 9.8,
     "y": 8.8,
     "uzunluk": 10.67,
     "genislik": 0.5,
     "z0": 0.6,
     "z1": 2.8,
     "aci": 13.0,
     "renk": "#991b1b"
    },
    {
     "ad": "Sağ süpürge kenarı",
     "x": 9.8,
     "y": -8.8,
     "uzunluk": 10.67,
     "genislik": 0.5,
     "z0": 0.6,
     "z1": 2.8,
     "aci": -13.0,
     "renk": "#991b1b"
    },
    {
     "ad": "Süpürge arka",
     "x": 4.25,
     "y": 0.0,
     "uzunluk": 0.5,
     "genislik": 15.0,
     "z0": 0.6,
     "z1": 2.8,
     "renk": "#991b1b"
    },
    {
     "ad": "Mavi LED şeridi",
     "x": 4.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 12,
     "z0": 5,
     "z1": 5.6,
     "renk": "#3b82f6",
     "kati": false,
     "gorsel": true,
     "malzeme": "led"
    },
    {
     "ad": "HC-SR04 kartı",
     "x": 4.05,
     "y": 0.0,
     "uzunluk": 0.3,
     "genislik": 4.5,
     "z0": 3.5,
     "z1": 5.5,
     "renk": "#1d4ed8",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 4.7,
     "y": 1.3,
     "z0": 3.7,
     "z1": 5.3,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Ultrasonik göz",
     "sekil": "silindir",
     "eksen": "x",
     "x": 4.7,
     "y": -1.3,
     "z0": 3.7,
     "z1": 5.3,
     "uzunluk": 1.2,
     "genislik": 1.6,
     "renk": "#c8ccd2",
     "kati": false,
     "gorsel": true,
     "malzeme": "metal"
    },
    {
     "ad": "Arduino Uno",
     "x": -4.0,
     "y": 0.0,
     "uzunluk": 6.8,
     "genislik": 5.4,
     "z0": 6,
     "z1": 6.15,
     "renk": "#0e7490",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "Uno başlıkları",
     "x": -4.0,
     "y": 2.4,
     "uzunluk": 6.0,
     "genislik": 0.4,
     "z0": 6.15,
     "z1": 7.0,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "L298N",
     "x": -4.0,
     "y": -5.4,
     "uzunluk": 4.2,
     "genislik": 4.2,
     "z0": 6,
     "z1": 6.15,
     "renk": "#c1272d",
     "kati": false,
     "gorsel": true,
     "malzeme": "pcb"
    },
    {
     "ad": "L298N soğutucu",
     "x": -4.0,
     "y": -5.4,
     "uzunluk": 2.4,
     "genislik": 2.4,
     "z0": 6.15,
     "z1": 8.4,
     "renk": "#111827",
     "kati": false,
     "gorsel": true
    },
    {
     "ad": "Acil stop",
     "sekil": "silindir",
     "eksen": "z",
     "x": -9.5,
     "y": 4.5,
     "z0": 6,
     "z1": 8.0,
     "uzunluk": 3.4,
     "genislik": 3.4,
     "renk": "#d81f26",
     "kati": false,
     "gorsel": true,
     "malzeme": "parlak"
    },
    {
     "ad": "Acil stop etiketi",
     "sekil": "silindir",
     "eksen": "z",
     "x": -9.5,
     "y": 4.5,
     "z0": 8.0,
     "z1": 8.08,
     "uzunluk": 2.2,
     "genislik": 2.2,
     "renk": "#f4c430",
     "kati": false,
     "gorsel": true
    }
   ]
  },
  "devre": {
   "surucu": {
    "tip": "L298N",
    "sol": {
     "en": 5,
     "in1": 7,
     "in2": 8
    },
    "sag": {
     "en": 6,
     "in1": 9,
     "in2": 10
    },
    "sol_ters": false,
    "sag_ters": false
   },
   "sensorler": [
    {
     "tip": "HC-SR04",
     "ad": "Ön ultrasonik",
     "trig": 11,
     "echo": 12,
     "x": 4.5,
     "y": 0,
     "z": 4.5,
     "aci": 0
    },
    {
     "tip": "TCRT5000",
     "ad": "Zemin",
     "pin": "A0",
     "x": 0,
     "y": 0,
     "z": 1,
     "esik": 500
    },
    {
     "tip": "BUTON",
     "ad": "Köşe anahtarı",
     "pin": "A5",
     "deger": "KIRMIZIDA_HIGH"
    }
   ],
   "servolar": [],
   "led": {
    "tip": "iki_pin",
    "kirmizi_pin": "A3",
    "mavi_pin": "A4",
    "x": -6,
    "y": 0,
    "z": 6.1,
    "uzunluk": 6,
    "genislik": 1.2
   },
   "yerlesim": []
  }
 }
];
if (typeof module !== "undefined") module.exports = { DEFAULT_PROFILES };
