// İç hazneli rakip robot (örnek kod)
// Ön huniden giren yumurta boğazdaki stopere dayanır. Ağız sensörü yumurtayı görünce renk okunur:
//   kendi rengimiz ya da yeşilse tokat servosu yumurtayı hazneye iter, değilse yandan dışarı atar.
// Hazne dolunca (ya da süre azalınca) robot kendi köşesini arar, köşeye girince arka kapağı açıp boşaltır.
#include <Servo.h>

#define ENA 5
#define IN1 7
#define IN2 8
#define ENB 6
#define IN3 9
#define IN4 10
#define TRIG 11
#define ECHO 12
#define AGIZ 2        // boğazdaki kızılötesi: yumurta varken LOW
#define ZEMIN A0
#define S2 A1
#define S3 A2
#define RENK_OUT 13
#define LED_K A3
#define LED_M A4
#define KOSE A5

#define SIRALA 1      // 0: rengine bakmadan her yumurtayı al (ayıklayıcısız robot)
#define DOLU 4        // haznede bu kadar yumurta olunca köşeye git
#define HIZ 185
#define DONUS 175

#define ZEMIN_BEYAZ_UST 200
#define ZEMIN_KIRMIZI_ALT 250
#define ZEMIN_KIRMIZI_UST 370
#define ZEMIN_YESIL_ALT 380
#define ZEMIN_YESIL_UST 520
#define ZEMIN_MAVI_ALT 560

Servo tokat;   // pin 3: 170 = hazneye, 10 = dışarı, 90 = bekle
Servo kapi;    // pin 4: arka boşaltma kapağı, 0 = kapalı
bool TAKIM_KIRMIZI = true;
int sayi = 0;
int durum = 0;           // 0 = topla, 1 = köşeye götür
unsigned long sonDonus = 0;

void motorlar(int sol, int sag) {
  digitalWrite(IN1, sol >= 0 ? HIGH : LOW); digitalWrite(IN2, sol >= 0 ? LOW : HIGH);
  digitalWrite(IN3, sag >= 0 ? HIGH : LOW); digitalWrite(IN4, sag >= 0 ? LOW : HIGH);
  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));
}

long mesafeCm() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  long sure = pulseIn(ECHO, HIGH, 30000);
  return sure == 0 ? 999 : sure / 58;
}

int renkOku(int s2, int s3) { digitalWrite(S2, s2); digitalWrite(S3, s3); delay(2); return pulseIn(RENK_OUT, LOW); }

// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil
int yumurtaRengi() {
  int r = renkOku(LOW, LOW), b = renkOku(LOW, HIGH), g = renkOku(HIGH, HIGH);
  if (r > 120 && b > 120 && g > 120) return 0;
  if (r <= b && r <= g) return 1;
  if (g < r && g < b) return 3;
  return 2;
}

// 0 = beyaz, 1 = kırmızı, 2 = mavi, 3 = yeşil
int zeminRengi() {
  int z = analogRead(ZEMIN);
  if (z < ZEMIN_BEYAZ_UST) return 0;
  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;
  if (z >= ZEMIN_YESIL_ALT && z <= ZEMIN_YESIL_UST) return 3;
  if (z >= ZEMIN_MAVI_ALT) return 2;
  return 0;
}

void don(int ms) { motorlar(DONUS, -DONUS); delay(ms); }

void setup() {
  Serial.begin(9600);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(AGIZ, INPUT);
  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);
  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);
  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;
  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);
  tokat.attach(3); tokat.write(90);
  kapi.attach(4); kapi.write(0);
  motorlar(HIZ, HIZ); delay(800);   // köşeden çık
}

// Dolaş: duvar/robot görünce geri çekil ve rastgele dön
void gez() {
  int benim = TAKIM_KIRMIZI ? 1 : 2;
  int z = zeminRengi();
  if (millis() > 3000 && z != 0 && (durum == 0 || z != benim)) {   // toplarken köşelere girme, götürürken başka köşeden çık
    motorlar(-HIZ, -HIZ); delay(300); don(random(300, 700)); return;
  }
  if (mesafeCm() < 22) { motorlar(-HIZ, -HIZ); delay(250); don(random(250, 650)); return; }
  if (millis() - sonDonus > 7000) { sonDonus = millis(); don(random(150, 450)); }   // aynı çizgide dönüp durmasın
  motorlar(HIZ, HIZ);
}

void loop() {
  int benim = TAKIM_KIRMIZI ? 1 : 2;
  if (durum == 0) {
    if (digitalRead(AGIZ) == LOW) {
      motorlar(0, 0); delay(80);
      int r = SIRALA ? yumurtaRengi() : benim;
      bool al = (r == benim || r == 3 || r == 0);
      tokat.write(al ? 170 : 10); delay(350); tokat.write(90); delay(150);
      if (al) sayi++;
      Serial.print(al ? "Yumurta alindi: " : "Yumurta atildi, renk="); Serial.println(al ? sayi : r);
    }
    if (sayi >= DOLU || (millis() > 80000 && sayi > 0)) { durum = 1; Serial.println("Hazne dolu, kose araniyor"); }
    gez();
  } else {
    if (zeminRengi() == benim) {
      motorlar(HIZ, HIZ); delay(450);           // robotun tamamı köşeye girsin
      motorlar(0, 0); kapi.write(150); delay(300 * sayi + 700);
      motorlar(-HIZ, -HIZ); delay(450); kapi.write(0);
      Serial.print("Bosaltildi: "); Serial.println(sayi);
      sayi = 0; durum = 0; don(550);
      return;
    }
    gez();
  }
}
