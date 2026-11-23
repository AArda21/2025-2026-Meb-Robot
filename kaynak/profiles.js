const DEFAULT_PROFILES = [
 {
  "id": "yumyum",
  "ad": "Yum Yum",
  "renk": "#f08c00",
  "aciklama": "Takımın bu yılki robotu (örnek değerlerle başlar — kendi ölçülerinizi girin).",
  "kartlar": [
   {
    "id": "ana",
    "tip": "Uno",
    "kod": "// Yum Yum — örnek strateji (2026 kuralları)\n// 1) ARA: sahada dolaş, kepçeye giren yumurtanın rengine bak\n// 2) Kendi rengimiz ya da yeşilse kapağı kapat, yumurtayı tut\n// 3) EVE: duvarı sola alıp duvar takibi yap; zemin sensörü hedef köşenin rengini görünce bırak\n#include <Servo.h>\n\n#define ENA 5\n#define IN1 7\n#define IN2 8\n#define ENB 6\n#define IN3 9\n#define IN4 10\n#define TRIG 11\n#define ECHO 12\n#define IR_SOL 2\n#define IR_SAG 4\n#define ZEMIN A0\n#define S2 A1\n#define S3 A2\n#define RENK_OUT 13\n#define LED_K A3\n#define LED_M A4\n#define KOSE A5\n\n#define KAPAK_ACIK 90\n#define KAPAK_KAPALI 0\n\n// zemin (TCRT5000 analog) eşikleri — kendi ölçümlerinle güncelle\n#define ZEMIN_BEYAZ_UST 200\n#define ZEMIN_KIRMIZI_ALT 250\n#define ZEMIN_KIRMIZI_UST 370\n#define ZEMIN_YESIL_ALT 380\n#define ZEMIN_YESIL_UST 520\n#define ZEMIN_MAVI_ALT 560\n\nServo kapak;\nbool TAKIM_KIRMIZI = true;\nint durum = 0;          // 0 = ARA, 1 = EVE (duvar takibi)\nint hedef = 0;          // EVE durumunda hedef zemin: 1 kırmızı, 2 mavi, 3 yeşil\nunsigned long durumZamani = 0;\nunsigned long sonYazdirma = 0;\nbool duvarBulundu = false;\nlong sonMesafe = 0;\nunsigned long sonKontrol = 0;\nint ayniSayac = 0;\n\nvoid motorlar(int sol, int sag) {\n  digitalWrite(IN1, sol >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, sol >= 0 ? LOW : HIGH);\n  digitalWrite(IN3, sag >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, sag >= 0 ? LOW : HIGH);\n  analogWrite(ENA, abs(sol));\n  analogWrite(ENB, abs(sag));\n}\n\nlong mesafeCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  if (sure == 0) return 999;\n  return sure / 58;\n}\n\nint renkOku(int s2, int s3) {\n  digitalWrite(S2, s2);\n  digitalWrite(S3, s3);\n  delay(2);\n  return pulseIn(RENK_OUT, LOW);\n}\n\n// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint yumurtaRengi() {\n  int r = renkOku(LOW, LOW);\n  int b = renkOku(LOW, HIGH);\n  int g = renkOku(HIGH, HIGH);\n  if (r > 120 && b > 120 && g > 120) return 0;\n  if (r <= b && r <= g) return 1;\n  if (g < r && g < b) return 3;\n  return 2;\n}\n\n// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil\nint zeminRengi() {\n  int z = analogRead(ZEMIN);\n  if (z < ZEMIN_BEYAZ_UST) return 0;\n  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;\n  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;\n  if (z >= ZEMIN_MAVI_ALT) return 2;\n  return 0;\n}\n\nvoid donSaga(int ms) { motorlar(170, -170); delay(ms); }\nvoid donSola(int ms) { motorlar(-170, 170); delay(ms); }\n\nvoid durumDegistir(int yeni) {\n  durum = yeni;\n  durumZamani = millis();\n  duvarBulundu = false;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);\n  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);\n  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);\n  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);\n  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);\n  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;\n  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);\n  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);\n  kapak.attach(3);\n  kapak.write(KAPAK_KAPALI);\n  delay(200);\n  kapak.write(KAPAK_ACIK);\n  // köşeden sahanın ortasına doğru çık\n  motorlar(200, 200);\n  delay(700);\n  durumDegistir(0);\n  Serial.println(TAKIM_KIRMIZI ? \"Takim: KIRMIZI\" : \"Takim: MAVI\");\n}\n\nvoid ara() {\n  int benim = TAKIM_KIRMIZI ? 1 : 2;\n  int renk = yumurtaRengi();\n  if (renk == benim || renk == 3) {\n    motorlar(0, 0);\n    kapak.write(KAPAK_KAPALI);       // yumurtayı kepçeye hapset\n    delay(250);\n    hedef = renk;\n    Serial.print(\"Yumurta alindi, hedef=\");\n    Serial.println(hedef);\n    durumDegistir(1);\n    return;\n  }\n  if (renk != 0) {                   // rakip rengi: geri çekilip bırak\n    motorlar(-180, -180);\n    delay(350);\n    donSaga(250);\n    return;\n  }\n  if (zeminRengi() != 0 && millis() > 3000) {   // ararken köşelere girme (yanlış yumurta itmeyelim)\n    motorlar(-180, -180);\n    delay(300);\n    donSaga(random(300, 600));\n    return;\n  }\n  long d = mesafeCm();\n  bool solVar = digitalRead(IR_SOL) == LOW;\n  bool sagVar = digitalRead(IR_SAG) == LOW;\n  if (d < 25) {\n    motorlar(-170, -170);\n    delay(200);\n    donSaga(random(250, 600));\n  } else if (solVar && !sagVar) {\n    motorlar(120, 200);\n  } else if (sagVar && !solVar) {\n    motorlar(200, 120);\n  } else {\n    motorlar(190, 190);\n  }\n}\n\nvoid eve() {\n  // hedef köşeye geldik mi?\n  if (zeminRengi() == hedef) {\n    // Duvar boyunca önümüze yığılan başka yumurtaları köşeye itmemek için:\n    // biraz geri çekil, hafif sağa dön ve kepçeyle köşeye öyle gir.\n    motorlar(-160, -160);\n    delay(200);\n    donSaga(140);\n    motorlar(130, 130);\n    delay(300);\n    motorlar(0, 0);\n    kapak.write(KAPAK_ACIK);\n    delay(250);\n    motorlar(-180, -180);             // yumurtayı köşede bırakıp geri çekil\n    delay(500);\n    donSaga(450);\n    Serial.println(\"Yumurta birakildi\");\n    durumDegistir(0);\n    return;\n  }\n  long d = mesafeCm();\n  bool solDuvar = digitalRead(IR_SOL) == LOW;\n  if (!duvarBulundu) {               // önce bir duvar bul\n    if (d < 18) { donSaga(320); duvarBulundu = true; }\n    else motorlar(190, 190);\n    return;\n  }\n  if (d < 16) {                      // köşe: sağa dön, duvar solda kalsın\n    motorlar(-150, -150);\n    delay(120);\n    donSaga(330);\n  } else if (solDuvar) {\n    motorlar(200, 130);              // duvara çok yakın: hafif sağa\n  } else {\n    motorlar(120, 200);              // duvarı kaybettik: sola yanaş\n  }\n  if (millis() - durumZamani > 40000) {   // çok uzun sürdü: bırak, yeniden ara\n    kapak.write(KAPAK_ACIK);\n    durumDegistir(0);\n  }\n}\n\n// Sıkışma kontrolü: ileri giderken mesafe 1.5 sn boyunca değişmiyorsa geri çık\nvoid sikismaKontrol() {\n  if (millis() - sonKontrol < 500) return;\n  sonKontrol = millis();\n  long d = mesafeCm();\n  if (d < 900 && abs(d - sonMesafe) < 2) ayniSayac++; else ayniSayac = 0;\n  sonMesafe = d;\n  if (ayniSayac >= 3) {\n    Serial.println(\"Sikisma! geri cikiliyor\");\n    motorlar(-200, -200);\n    delay(450);\n    donSaga(random(250, 550));\n    ayniSayac = 0;\n    if (durum == 1) duvarBulundu = false;\n  }\n}\n\nvoid loop() {\n  sikismaKontrol();\n  if (durum == 0) ara(); else eve();\n  if (millis() - sonYazdirma > 500) {\n    sonYazdirma = millis();\n    Serial.print(\"durum=\");\n    Serial.print(durum);\n    Serial.print(\" zemin=\");\n    Serial.print(analogRead(ZEMIN));\n    Serial.print(\" mesafe=\");\n    Serial.println(mesafeCm());\n  }\n}\n"
   }
  ],
  "kart_baglantilari": [],
  "mekanik": {
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
     "ad": "Kepçe arka",
     "x": 10,
     "y": 0,
     "uzunluk": 1,
     "genislik": 12,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#374151"
    },
    {
     "ad": "Sol kol",
     "x": 14.25,
     "y": 6,
     "uzunluk": 7.5,
     "genislik": 1,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#374151"
    },
    {
     "ad": "Sağ kol",
     "x": 14.25,
     "y": -6,
     "uzunluk": 7.5,
     "genislik": 1,
     "z0": 0.3,
     "z1": 4.3,
     "renk": "#374151"
    },
    {
     "ad": "SG90 servo",
     "x": 16.5,
     "y": 6.3,
     "uzunluk": 2.3,
     "genislik": 1.2,
     "z0": 4.3,
     "z1": 6.6,
     "renk": "#2563eb",
     "kati": false
    },
    {
     "ad": "Kapak",
     "servo_pin": 3,
     "pivot": [
      18,
      5.5
     ],
     "uzunluk": 11,
     "genislik": 0.8,
     "aci_ofset": -90,
     "yon": 1,
     "z0": 0.3,
     "z1": 4,
     "renk": "#f59e0b"
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
  "aciklama": "Repodaki 21 Ocak Mega + Nano kodları (Antalya 2026). Fotoğrafa göre: 4 teker (hepsi motorlu), 2×18650 pil (7,4 V), sarı gövde, önde içeri giren yumurtanın çıkmasını önleyen kelepçeler, köşelerde MZ80 gözler (kodda 2 tanesi kullanılıyor). Ölçüler, sensör yerleri ve iç hazne TAHMİNİ.",
  "kartlar": [
   {
    "id": "mega",
    "tip": "Mega",
    "kod": "#include<Servo.h>\n#include <Adafruit_NeoPixel.h>\n\nServo bizim;\nServo rakip;\nServo yesil;\n\n// HABERLEŞME\n#define sayac_bildirim A0\n#define yesil_bildirim A1\n#define kilit_sinyal A2\n#define yesil_tokatla_sinyal A3\n#define otur_bildirim A4\n\n// Sağ motor pinleri\n#define EN_R 2\n#define RPWM_R 3\n#define LPWM_R 4\n\n// Sol motor pinleri\n#define RPWM_L 5\n#define LPWM_L 6\n#define EN_L 7\n\n#define sol_goz 22\n#define sag_goz 24\n\n#define s0 52\n#define s1 50\n#define s2 46\n#define s3 48\n#define out 44\n\n#define LED_PIN 42\n#define LED_COUNT  8 // LED sayısı\n#define KIRMIZI 1\n#define MAVI 0\n#define BIZIM_TOPU_BIRAK 1\n#define YESIL_BIRAK 0\n\nAdafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);\n\nfloat kirmizi = 0, mavi = 0, yesil = 0;\nint kirmizi_veriler[4] = { 0, 0, 0, 0 };\nint mavi_veriler[4] = { 0, 0, 0, 0 };\nint yesil_veriler[4] = { 0, 0, 0, 0 };\nint mavi_ust_limit = 60, kirmizi_alt_limit = 300, yesil_alt_limit=70, yesil_ust_limit=80;\nbyte bolge = 0, duvarla_isim_var = 0;\n\nbyte bizim_kapak_default = 0, yesil_kapak_default = 0;\n\nvoid setup() {\n  // SERVO TANIMLARI\n  rakip.attach(A7);\n  bizim.attach(A8);\n  yesil.attach(A9);\n  bizim.write(bizim_kapak_default);\n  rakip.write(180);\n  yesil.write(yesil_kapak_default);\n\n  // MZ80 TANIMLARI\n  pinMode(sol_goz, INPUT);\n  pinMode(sag_goz, INPUT);\n\n  //RENK SENSÖRÜ TANIMLARI\n  pinMode(s0, OUTPUT);\n  pinMode(s1, OUTPUT);\n  pinMode(s2, OUTPUT);\n  pinMode(s3, OUTPUT);\n  pinMode(out, INPUT);\n\n  // Sağ motor pin tanımları\n  pinMode(EN_R, OUTPUT);\n  pinMode(RPWM_R, OUTPUT);\n  pinMode(LPWM_R, OUTPUT);\n\n  // Sol motor pin tanımları\n  pinMode(EN_L, OUTPUT);\n  pinMode(RPWM_L, OUTPUT);\n  pinMode(LPWM_L, OUTPUT);\n\n  //HABERLEŞME PİNLERİ\n  pinMode(sayac_bildirim, INPUT);\n  pinMode(yesil_bildirim, INPUT);\n  pinMode(otur_bildirim, INPUT);\n  pinMode(kilit_sinyal, OUTPUT);\n  pinMode(yesil_tokatla_sinyal, OUTPUT);\n\n  // Motor sürücülerini aktif et\n  digitalWrite(EN_R, HIGH);\n  digitalWrite(EN_L, HIGH);\n\n  digitalWrite(s0, HIGH);\n  digitalWrite(s1, LOW);\n\n  //NEOPİXEL\n  pinMode(A14, INPUT);\n  bolge = digitalRead(A14);\n  strip.begin();\n  strip.show();\n\n  for (int i = 0; i < LED_COUNT; i++) {\n    if (bolge == KIRMIZI)\n    {\n      strip.setPixelColor(i, strip.Color(255, 0, 0)); // kırmızı\n    }\n    else\n    {\n      strip.setPixelColor(i, strip.Color(0, 0, 255)); // mavi\n    }\n  }\n  strip.show();\n\n  Serial.begin(9600);\n /* while(digitalRead(sag_goz) == 0);\n  basla();*/\n}\n\nvoid loop() {\nolcum();\n  /*\n  if (digitalRead(sayac_bildirim) == 1)\n  {\n    digitalWrite(kilit_sinyal, HIGH);\n    duvarla_isim_var = 1;\n    while(duvarla_isim_var == 1)\n    {\n      duvar_takip(BIZIM_TOPU_BIRAK);\n    }\n    digitalWrite(kilit_sinyal, LOW);\n    delay(2000);\n  }\n  else if (digitalRead(yesil_bildirim) == 1)\n  {\n    digitalWrite(kilit_sinyal, HIGH);\n    duvarla_isim_var = 1;\n    while(duvarla_isim_var == 1)\n    {\n      duvar_takip(yesil_BIRAK);\n    }\n    digitalWrite(kilit_sinyal, LOW);\n    delay(2000);\n  }\n  else if(digitalRead(otur_bildirim) == 1)\n  {\n    duvar_takip_otur();\n  }\n  else\n  {\n    rastgele();\n  }*/\n}\n\nvoid goz_okuma()\n{\n  Serial.print(\"Sol göz: \");\n  Serial.println(digitalRead(sol_goz));\n  Serial.print(\"Saü göz: \");\n  Serial.println(digitalRead(sag_goz));\n  Serial.print(\"\\n\\n\\n\");\n  delay(300);\n}\n\nvoid rastgele()\n{\n  if (digitalRead(sol_goz) == 0)\n  {\n    sag(80);\n    delay(600);\n  }\n  else if (digitalRead(sag_goz) == 0)\n  {\n    sag(80);\n    delay(800);\n  }\n  else\n  {\n    ileri(100);\n  }\n}\n\nvoid duvar_takip(byte nereye)\n{\n  if (digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 0)\n  {\n    dur(200);\n    int sonuc = olcum();\n\n    /* AŞAĞIDAKİ IF KOŞULUNUN TÜRKÇE MEALİ :)\n     * MAVİ BÖLGE OKUDUK: KIRMIZI KÖŞEYİZ(bolge = KIRMIZI = 1) ve CEZA BIRAKACAĞIZ(nereye = CEZA_BIRAK = 0) --> bolge(1) != nereye(0)\n     * MAVİ BÖLGE OKUDUK: MAVİ KÖŞEYİZ(bolge = MAVI = 0) ve BİZİM TOPU BIRAKACAĞIZ(nereye = BIZIM_TOPU_BIRAK = 1) --> bolge(0) != nereye(1)\n     * KIRMIZI BÖLGE OKUDUK: KIRMIZI KÖŞEYİZ(bolge = KIRMIZI = 1) ve BİZİM TOPU BIRAKACAĞIZ(nereye = BIZIM_TOPU_BIRAK = 1) --> bolge(1) == nereye(1)\n     * KIRMIZI BÖLGE OKUDUK: MAVİ KÖŞEYİZ(bolge = MAVI = 0) ve CEZA BIRAKACAĞIZ(nereye = CEZA_BIRAK = 0) --> bolge(0) == nereye(0)\n     * GERİ KALAN HİÇBİR KOŞULDA IF'İN İÇİNE GİRİLİP PARK YAPILMAZ DUVAR TAKİBE DEVAM EDİLİR <3\n     */\n     if(nereye == 1){\n    if ( (sonuc < mavi_ust_limit == bolge ) || (sonuc > kirmizi_alt_limit == bolge) )\n    {\n      dur(200);\n      park(1);\n    }\n    }\n    else{\n      if(sonuc<yesil_ust_limit && sonuc>yesil_alt_limit){\n        dur(200);\n        park(0);\n      }\n    }\n    while (digitalRead(sag_goz) == 0)\n    {\n      sol(100);\n    }\n    \n    dur(200);\n  }\n  else if(digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 1)\n  {\n    unsigned long firstMillis = millis();\n    while (digitalRead(sag_goz) == 1)\n    {\n      if( (millis() - firstMillis) > 3000)\n      {\n        ileri(100);\n        delay(300);\n        break;\n      }\n      sol(100);\n    }\n  }\n  else\n  {\n    if (digitalRead(sag_goz) == 1) //SAĞA YANAŞ\n    {\n      ileri(150, 100);\n    }\n    else\n    {\n      ileri(100, 150);\n    }\n  }\n}\n\nvoid duvar_takip_otur()\n{\n  if (digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 0)\n  {\n    dur(200);\n    int sonuc = olcum();\n    if ( (sonuc < mavi_ust_limit && bolge == KIRMIZI) || (sonuc > kirmizi_alt_limit && bolge == MAVI) )\n    {\n      ileri(80);\n      delay(250);\n      dur(0);\n      delay(100);\n      geri(80);\n      delay(200);\n      dur(0);\n      while(1); // OTURDUK BEKLİYORUZ\n    }\n    \n    while (digitalRead(sag_goz) == 0)\n    {\n      sol(100);\n    }\n    \n    dur(200);\n  }\n  else if(digitalRead(sol_goz) == 0 && digitalRead(sag_goz) == 1)\n  {\n    unsigned long firstMillis = millis();\n    while (digitalRead(sag_goz) == 1)\n    {\n      if( (millis() - firstMillis) > 3000)\n      {\n        ileri(100);\n        delay(300);\n        break;\n      }\n      sol(100);\n    }\n  }\n  else\n  {\n    if (digitalRead(sag_goz) == 1) //SAĞA YANAŞ\n    {\n      ileri(150, 100);\n    }\n    else\n    {\n      ileri(100, 150);\n    }\n  }\n}\n\nvoid park (byte nereye)\n{\n  while (digitalRead(sag_goz) == 0)\n  {\n    sol(100);\n  }\n  dur(200);\n  sol(100);\n  delay(100);\n  dur(200);\n  if (nereye == 1)\n  {\n    bizim.write(bizim_kapak_default + 90);\n    delay(150);\n  }\n  else\n  {\n    sol(100);\n    delay(300);\n    dur(200);\n    yesil.write(yesil_kapak_default + 120);\n    delay(100);\n    digitalWrite(yesil_tokatla_sinyal, HIGH);\n    delay(500);\n    digitalWrite(yesil_tokatla_sinyal, LOW);\n  }\n  ileri(100);\n  delay(1600);\n  dur(200);\n  if(nereye == 1)\n  {\n    bizim.write(bizim_kapak_default);\n  }\n  else\n  {\n    yesil.write(yesil_kapak_default);\n  }\n  duvarla_isim_var = 0;\n}\n\nvoid ileri(byte hiz)\n{\n  analogWrite(RPWM_R, hiz);\n  analogWrite(LPWM_R, 0);\n  analogWrite(RPWM_L, 0);\n  analogWrite(LPWM_L, hiz);\n}\n\nvoid ileri(byte sol_hiz, byte sag_hiz)\n{\n  analogWrite(RPWM_R, sag_hiz);\n  analogWrite(LPWM_R, 0);\n  analogWrite(RPWM_L, 0);\n  analogWrite(LPWM_L, sol_hiz);\n}\n\nvoid geri(byte hiz)\n{\n  analogWrite(RPWM_R, 0);\n  analogWrite(LPWM_R, hiz);\n  analogWrite(RPWM_L, hiz);\n  analogWrite(LPWM_L, 0);\n}\n\nvoid sol(byte hiz)\n{\n  analogWrite(RPWM_R, hiz);\n  analogWrite(LPWM_R, 0);\n  analogWrite(RPWM_L, hiz);\n  analogWrite(LPWM_L, 0);\n}\n\nvoid sag(byte hiz)\n{\n  analogWrite(RPWM_R, 0);\n  analogWrite(LPWM_R, hiz);\n  analogWrite(RPWM_L, 0);\n  analogWrite(LPWM_L, hiz);\n}\n\nvoid dur(byte guc)\n{\n  analogWrite(RPWM_R, guc);\n  analogWrite(LPWM_R, guc);\n  analogWrite(RPWM_L, guc);\n  analogWrite(LPWM_L, guc);\n}\n\nvoid basla()\n{\n  // İLERİ GİT (her iki motor ileri yönde döner)\n  ileri(255); // ileri(byte hız)\n\n  delay(800);  // 1 saniye ileri git\n\n  // DUR\n  dur(100); //dur(byte guc) -> guc ne kadar yüksekse o kadar sert fren yapar.\n\n  //durduğunu anla\n  delay(1000);\n}\n\n\nfloat olcum() {\n  //verileri güncelliyoruz\n  for (int i = 0; i < 4; i++) {\n    olc();\n    kirmizi_veriler[i] = kirmizi;\n    mavi_veriler[i] = mavi;\n    yesil_veriler[i] = yesil;\n  }\n\n  // 6 TANE VERİ ALIP İÇELERİNDEN TUTARLI HALE GETİRİYORUZ\n  // ÖRNEK : 64,65,68,97 ÖLÇMÜŞ OLALIM -> 67 GİBİ BİR SONUÇ DÖNDÜRÜYOR ANLIK DALGALANMALARDAN ETKİLENMEMİŞ OLUYORUZ\n  kirmizi = stabilSonucuBul(kirmizi_veriler, 4);\n  mavi = stabilSonucuBul(mavi_veriler, 4);\n   yesil = stabilSonucuBul(yesil_veriler, 4);\n\n \n\n  float sonuc = ((float)mavi / (float)kirmizi /(float)yesil) * 10000;\n  Serial.println(sonuc);\n  /*\nSerial.println(\"MAVİ\");  \nSerial.println(mavi);\n\nSerial.println(\"KIRMIZI\");  \nSerial.println(kirmizi);\n\nSerial.println(\"yeşil\");  \nSerial.println(yesil);*/\n\n  \n  return sonuc;\n}\n\nvoid olc() {\n  //RENK SENSÖRÜ KIRMIZI FİLTRE AYARI\n  digitalWrite(s2, LOW);\n  digitalWrite(s3, LOW);\n  delay(10);\n  kirmizi = pulseIn(out, LOW);\n\n  //RENK SENSÖRÜ MAVİ FİLTRE AYARI\n  digitalWrite(s2, LOW);\n  digitalWrite(s3, HIGH);\n  delay(10);\n  mavi = pulseIn(out, LOW);\n\n   //RENK SENSÖRÜ YESİL FİLTRE AYARI\n  digitalWrite(s2, HIGH);\n  digitalWrite(s3, HIGH);\n  delay(10);\n  yesil = pulseIn(out, LOW);\n}\n\n\n\n// ******************************Ortalama hesaplayan fonksiyon*****************************\ndouble ortalamaHesapla(const int arr[], int size) {\n  double sum = 0;\n  for (int i = 0; i < size; i++) {\n    sum += arr[i];\n  }\n  return sum / size;\n}\n\n// Standart sapmayı hesaplayan fonksiyon\ndouble standartSapmaHesapla(const int arr[], int size, double mean) {\n  double sum = 0;\n  for (int i = 0; i < size; i++) {\n    sum += pow(arr[i] - mean, 2);\n  }\n  return sqrt(sum / size);\n}\n\n// Uç değerleri filtreleyerek en istikrarlı değeri bul\nint stabilSonucuBul(const int arr[], int size) {\n  // Dizinin ortalamasını hesapla\n  double mean = ortalamaHesapla(arr, size);\n\n  // Dizinin standart sapmasını hesapla\n  double stdDev = standartSapmaHesapla(arr, size, mean);\n\n  // Standart sapmanın 1.5 katından daha uzak olan değerleri göz ardı et\n  const double threshold = 1.5 * stdDev;\n\n  // Filtrelenmiş dizinin ortalamasını ve en yakın değeri bul\n  double filteredSum = 0;\n  int filteredCount = 0;\n  int closestValue = arr[0];\n  double minDifference = 1e6;  // çok büyük bir sayı kullanıyoruz\n\n  for (int i = 0; i < size; i++) {\n    if (fabs(arr[i] - mean) <= threshold) {\n      filteredSum += arr[i];\n      filteredCount++;\n\n      // Ortalamaya en yakın değeri bl\n      double diff = fabs(arr[i] - mean);\n      if (diff < minDifference) {\n        minDifference = diff;\n        closestValue = arr[i];\n      }\n    }\n  }\n\n  return closestValue;\n}\n"
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
   "kutle_kg": 2.2,
   "agirlik_merkezi": {
    "x_cm": null,
    "z_cm": 6
   },
   "tekerlek": {
    "lastik": "kaucuk",
    "cap_cm": 6.5,
    "genislik_cm": 2.7,
    "iz_cm": 23,
    "x_cm": -2,
    "adet": 4,
    "dingil_cm": 14
   },
   "sarhos_teker": null,
   "motor": {
    "model": "JGA25-370 12V 280"
   },
   "pil": {
    "volt": 7.4
   },
   "acil_stop": {
    "x": 6,
    "y": 8,
    "z": 14
   },
   "parcalar": [
    {
     "ad": "Gövde",
     "x": -1,
     "y": 0,
     "uzunluk": 24,
     "genislik": 19,
     "z0": 2.5,
     "z1": 12,
     "renk": "#facc15"
    },
    {
     "ad": "Ağız sol",
     "x": 12.5,
     "y": 6,
     "uzunluk": 3,
     "genislik": 1.5,
     "z0": 0.4,
     "z1": 6,
     "renk": "#334155"
    },
    {
     "ad": "Ağız sağ",
     "x": 12.5,
     "y": -6,
     "uzunluk": 3,
     "genislik": 1.5,
     "z0": 0.4,
     "z1": 6,
     "renk": "#334155"
    },
    {
     "ad": "Ağız arka (stoper)",
     "x": 9.5,
     "y": 0,
     "uzunluk": 1,
     "genislik": 10.5,
     "z0": 0.3,
     "z1": 2.4,
     "renk": "#1f2937"
    }
   ],
   "model3d": null,
   "hazne": {
    "var": true,
    "agiz": {
     "x0": 9,
     "x1": 16,
     "y0": -4.5,
     "y1": 4.5
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
       "x": -15,
       "y": 3
      }
     },
     {
      "ad": "yesil",
      "kapasite": 2,
      "kapak": "mega:A9",
      "acik_min": 80,
      "acik_max": 180,
      "cikis": {
       "x": -15,
       "y": -4
      }
     }
    ],
    "disari": {
     "x": 4,
     "y": -14,
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
     "ad": "Sol göz (MZ80)",
     "pin": "mega:22",
     "x": 12,
     "y": 8,
     "z": 4,
     "aci": 10,
     "menzil_cm": 20
    },
    {
     "tip": "IR_ENGEL",
     "ad": "Sağ göz (MZ80)",
     "pin": "mega:24",
     "x": 12,
     "y": -8,
     "z": 4,
     "aci": -10,
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
     "x": 10,
     "y": 0,
     "z": 1,
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
     "x": 11.5,
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
     "x": 11.5,
     "y": -4,
     "z": 1,
     "aci": 90,
     "menzil_cm": 8
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
     "ad": "Rakip kapağı",
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
    "x": -6,
    "y": 0,
    "z": 12
   },
   "yerlesim": [
    {
     "ad": "Arduino Mega",
     "x": -3,
     "y": 0,
     "z": 12,
     "uzunluk": 10.2,
     "genislik": 5.3,
     "kalinlik": 1.3,
     "renk": "#0e7490"
    },
    {
     "ad": "Arduino Nano",
     "x": 5,
     "y": 4,
     "z": 12,
     "uzunluk": 4.5,
     "genislik": 1.8,
     "kalinlik": 1,
     "renk": "#0369a1"
    },
    {
     "ad": "BTS7960 sol",
     "x": 4,
     "y": -5,
     "z": 12,
     "uzunluk": 5,
     "genislik": 5,
     "kalinlik": 2.5,
     "renk": "#b91c1c"
    },
    {
     "ad": "BTS7960 sağ",
     "x": -9,
     "y": -5,
     "z": 12,
     "uzunluk": 5,
     "genislik": 5,
     "kalinlik": 2.5,
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
 }
];
if (typeof module !== "undefined") module.exports = { DEFAULT_PROFILES };
