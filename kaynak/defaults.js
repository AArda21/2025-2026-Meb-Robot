const DEFAULT_CONFIG = `{
  // ====== SAHA (MEB Robot 2025 kurallarına göre 250x250 cm) ======
  "saha": {
    "yumurta_kutle_g": 25,        // kural: en fazla 40 g
    "mu_yumurta_zemin": 0.35,     // yumurta - sunta kayma sürtünmesi
    "mu_robot_yumurta": 0.30,
    "mu_duvar": 0.40,
    "esneklik_robot_yumurta": 0.2,
    "tohum": 2026,                // yumurta dizilimi (değiştir → yeni dizilim)
    "hakem_toplar": true,         // alanda 1 sn duran yumurtayı hakem alır
    "renkler": { "zemin": "#f3f2ee", "kirmizi": "#c1121c", "mavi": "#25356b" }
  },

  // ====== ROBOT ======  (birimler: cm, kg; x = ileri, y = sola)
  "robot": {
    "isim": "Örnek MEB Yumurta Robotu",
    "kutle_kg": 1.1,
    "agirlik_merkezi_z_cm": 5,
    "acil_stop": { "x": 2, "y": -4, "z": 8.9 },   // mantar başlı acil stop butonu

    "tekerlek": {
      "cap_cm": 6.5, "genislik_cm": 2.6,
      "iz_cm": 17,                // iki teker arası mesafe
      "x_cm": -2,                 // teker ekseninin merkeze göre konumu
      "yuk_orani": 0.8,           // ağırlığın tekerlere binen oranı
      "mu_statik": 0.9, "mu_kinetik": 0.75, "mu_yanal": 0.9,
      "yuvarlanma_katsayisi": 0.015
    },
    "sarhos_teker": { "x_cm": -8, "y_cm": 0, "cap_cm": 1.6, "yuvarlanma_katsayisi": 0.03 },

    "motor": {                    // çıkış milindeki (redüktör sonrası) değerler
      "nominal_volt": 6, "bosta_rpm": 200,
      "stall_tork_kgcm": 0.8, "ic_surtunme_kgcm": 0.04
    },
    "surucu": {
      "tip": "L298N",             // L298N | TB6612 | L9110 | DRV8833
      "pil_volt": 7.4, "dusum_volt": 1.8,
      "sol": { "en": 5, "in1": 7, "in2": 8 },
      "sag": { "en": 6, "in1": 9, "in2": 10 },
      "sol_ters": false, "sag_ters": false
    },

    // Gövde parçaları: z0 = yerden alt yükseklik, z1 = üst yükseklik (cm).
    // z0 >= 2 cm olan parçaların altından yumurta (2 cm) geçer, z0 >= 8 cm olanlar duvarın üstünden geçer.
    // "sekil": "silindir" → uzunluk = çap. "kati": false → sadece görsel (çarpışmaz).
    "parcalar": [
      { "ad": "Sol TT motor", "x": -2, "y": 4.9, "uzunluk": 7, "genislik": 2.2, "z0": 2.2, "z1": 4.3, "renk": "#f2c230" },
      { "ad": "Sağ TT motor", "x": -2, "y": -4.9, "uzunluk": 7, "genislik": 2.2, "z0": 2.2, "z1": 4.3, "renk": "#f2c230" },
      { "ad": "Alt pleksi plaka", "x": 0, "y": 0, "uzunluk": 19, "genislik": 15, "z0": 4.3, "z1": 4.6, "renk": "#cfe3f0" },
      { "ad": "Direk 1", "sekil": "silindir", "x": 7, "y": 6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227" },
      { "ad": "Direk 2", "sekil": "silindir", "x": 7, "y": -6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227" },
      { "ad": "Direk 3", "sekil": "silindir", "x": -7.5, "y": 6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227" },
      { "ad": "Direk 4", "sekil": "silindir", "x": -7.5, "y": -6, "uzunluk": 0.6, "genislik": 0.6, "z0": 4.6, "z1": 8.6, "renk": "#c9a227" },
      { "ad": "Üst pleksi plaka", "x": -0.5, "y": 0, "uzunluk": 18, "genislik": 15, "z0": 8.6, "z1": 8.9, "renk": "#cfe3f0" },
      { "ad": "Kepçe arka", "x": 10, "y": 0, "uzunluk": 1, "genislik": 12, "z0": 0.3, "z1": 4.3, "renk": "#374151" },
      { "ad": "Sol kol", "x": 14, "y": 6, "uzunluk": 8, "genislik": 1, "z0": 0.3, "z1": 4.3, "renk": "#374151" },
      { "ad": "Sağ kol", "x": 14, "y": -6, "uzunluk": 8, "genislik": 1, "z0": 0.3, "z1": 4.3, "renk": "#374151" },
      { "ad": "SG90 servo", "x": 16.5, "y": 6.3, "uzunluk": 2.3, "genislik": 1.2, "z0": 4.3, "z1": 6.6, "renk": "#2563eb", "kati": false },
      { "ad": "Kapak", "servo_pin": 3, "pivot": [18, 5.5], "uzunluk": 11, "genislik": 0.8,
        "aci_ofset": -90, "yon": 1, "z0": 0.3, "z1": 4, "renk": "#f59e0b" }
    ],
    "servolar": [ { "ad": "Kapak servosu", "pin": 3, "hiz_derece_s": 450, "baslangic_aci": 0 } ],

    "sensorler": [
      { "tip": "HC-SR04", "ad": "Ön ultrasonik", "trig": 11, "echo": 12, "x": 9.3, "y": 0, "z": 6.5, "aci": 0 },
      { "tip": "IR_ENGEL", "ad": "Sol IR", "pin": 2, "x": 8, "y": 7.5, "z": 1.5, "aci": 40, "menzil_cm": 14 },
      { "tip": "IR_ENGEL", "ad": "Sağ IR", "pin": 4, "x": 8, "y": -7.5, "z": 1.5, "aci": -40, "menzil_cm": 14 },
      { "tip": "TCRT5000", "ad": "Zemin", "pin": "A0", "x": 2, "y": 0, "z": 1, "esik": 500 },
      { "tip": "TCS3200", "ad": "Renk (kepçe)", "s2": "A1", "s3": "A2", "out": 13, "olcek": 20,
        "x": 10.6, "y": 0, "z": 1, "aci": 0, "bakis": "ileri", "menzil_cm": 2.5 }
    ],
    "led": { "kirmizi_pin": "A3", "mavi_pin": "A4", "x": -7, "y": 0, "z": 8.9 },

    // Devre katmanı (Fritzing düzeni) — sahada robotun üstünde çizilir
    "devre": [
      { "ad": "Arduino Uno", "x": 1, "y": 1.5, "z": 8.9, "uzunluk": 6.9, "genislik": 5.3, "kalinlik": 1.3, "renk": "#0e7490" },
      { "ad": "L298N", "x": 4, "y": 0, "z": 4.6, "uzunluk": 4.3, "genislik": 4.3, "kalinlik": 2.5, "renk": "#b91c1c" },
      { "ad": "Pil 2S 18650", "x": -4.5, "y": 0, "z": 4.6, "uzunluk": 4.2, "genislik": 7.6, "kalinlik": 2, "renk": "#1d4ed8" },
      { "ad": "Mini breadboard", "x": -5, "y": 3.5, "z": 8.9, "uzunluk": 4.5, "genislik": 3.4, "kalinlik": 0.9, "renk": "#e5e7eb" }
    ]
  }
}`;

const DEFAULT_CODE = `// Örnek yumurta toplama kodu — kendi kodunu buraya yapıştır
#include <Servo.h>

#define ENA 5
#define IN1 7
#define IN2 8
#define ENB 6
#define IN3 9
#define IN4 10
#define TRIG 11
#define ECHO 12
#define IR_SOL 2
#define IR_SAG 4
#define ZEMIN A0
#define S2 A1
#define S3 A2
#define RENK_OUT 13
#define LED_K A3
#define LED_M A4

Servo kapak;
const bool TAKIM_KIRMIZI = true;   // mavi köşedeysen false yap
unsigned long sonYazdirma = 0;

void motorlar(int sol, int sag) {
  digitalWrite(IN1, sol >= 0 ? HIGH : LOW);
  digitalWrite(IN2, sol >= 0 ? LOW : HIGH);
  digitalWrite(IN3, sag >= 0 ? HIGH : LOW);
  digitalWrite(IN4, sag >= 0 ? LOW : HIGH);
  analogWrite(ENA, abs(sol));
  analogWrite(ENB, abs(sag));
}

long mesafeCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long sure = pulseIn(ECHO, HIGH, 30000);
  if (sure == 0) return 999;
  return sure / 58;
}

int renkOku(int s2, int s3) {
  digitalWrite(S2, s2);
  digitalWrite(S3, s3);
  delay(2);
  return pulseIn(RENK_OUT, LOW);
}

// 0 = yumurta yok, 1 = kırmızı, 2 = mavi
int yumurtaRengi() {
  int r = renkOku(LOW, LOW);
  int b = renkOku(LOW, HIGH);
  if (r > 120 && b > 120) return 0;
  if (r < b) return 1;
  return 2;
}

void setup() {
  Serial.begin(9600);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);
  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);
  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT);
  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);
  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);
  kapak.attach(3);
  kapak.write(0);      // başlangıçta kapalı (30 cm sınırı)
  delay(300);
  kapak.write(90);     // maç başlayınca aç
  Serial.println("Robot hazir");
}

void loop() {
  int renk = yumurtaRengi();
  int benim = TAKIM_KIRMIZI ? 1 : 2;
  if (renk != 0 && renk != benim) {
    // Yanlış renk / ceza yumurtası: geri çekil, bırak
    motorlar(-180, -180);
    delay(350);
    motorlar(-170, 170);
    delay(300);
  }

  long d = mesafeCm();
  bool solVar = digitalRead(IR_SOL) == LOW;
  bool sagVar = digitalRead(IR_SAG) == LOW;

  if (d < 32) {                 // duvar (ultrasonik 6 cm yükseklikte → yumurtayı görmez); açık kapak önde 11 cm
    motorlar(-170, -170);
    delay(250);
    motorlar(180, -180);
    delay(random(250, 600));
  } else if (solVar && !sagVar) {
    motorlar(110, 200);         // solda yumurta → sola yönel
  } else if (sagVar && !solVar) {
    motorlar(200, 110);
  } else {
    motorlar(190, 190);
  }

  if (millis() - sonYazdirma > 500) {
    sonYazdirma = millis();
    Serial.print("mesafe=");
    Serial.print(d);
    Serial.print(" renk=");
    Serial.println(renk);
  }
}
`;
if (typeof module !== 'undefined') module.exports = { DEFAULT_CONFIG, DEFAULT_CODE };
