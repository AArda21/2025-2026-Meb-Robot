// Yum Yum — örnek strateji (2026 kuralları)
// 1) ARA: sahada dolaş, kepçeye giren yumurtanın rengine bak
// 2) Kendi rengimiz ya da yeşilse kapağı kapat, yumurtayı tut
// 3) EVE: duvarı sola alıp duvar takibi yap; zemin sensörü hedef köşenin rengini görünce bırak
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
#define KOSE A5

#define KAPAK_ACIK 90
#define KAPAK_KAPALI 0

// zemin (TCRT5000 analog) eşikleri — kendi ölçümlerinle güncelle
#define ZEMIN_BEYAZ_UST 200
#define ZEMIN_KIRMIZI_ALT 250
#define ZEMIN_KIRMIZI_UST 370
#define ZEMIN_YESIL_ALT 380
#define ZEMIN_YESIL_UST 520
#define ZEMIN_MAVI_ALT 560

Servo kapak;
bool TAKIM_KIRMIZI = true;
int durum = 0;          // 0 = ARA, 1 = EVE (duvar takibi)
int hedef = 0;          // EVE durumunda hedef zemin: 1 kırmızı, 2 mavi, 3 yeşil
unsigned long durumZamani = 0;
unsigned long sonYazdirma = 0;
bool duvarBulundu = false;
long sonMesafe = 0;
unsigned long sonKontrol = 0;
int ayniSayac = 0;

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

// 0 = yok, 1 = kırmızı, 2 = mavi, 3 = yeşil
int yumurtaRengi() {
  int r = renkOku(LOW, LOW);
  int b = renkOku(LOW, HIGH);
  int g = renkOku(HIGH, HIGH);
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

void donSaga(int ms) { motorlar(170, -170); delay(ms); }
void donSola(int ms) { motorlar(-170, 170); delay(ms); }

void durumDegistir(int yeni) {
  durum = yeni;
  durumZamani = millis();
  duvarBulundu = false;
}

void setup() {
  Serial.begin(9600);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  pinMode(IR_SOL, INPUT); pinMode(IR_SAG, INPUT);
  pinMode(S2, OUTPUT); pinMode(S3, OUTPUT); pinMode(RENK_OUT, INPUT);
  pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);
  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;
  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW);
  digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);
  kapak.attach(3);
  kapak.write(KAPAK_KAPALI);
  delay(200);
  kapak.write(KAPAK_ACIK);
  // köşeden sahanın ortasına doğru çık
  motorlar(200, 200);
  delay(700);
  durumDegistir(0);
  Serial.println(TAKIM_KIRMIZI ? "Takim: KIRMIZI" : "Takim: MAVI");
}

void ara() {
  int benim = TAKIM_KIRMIZI ? 1 : 2;
  int renk = yumurtaRengi();
  if (renk == benim || renk == 3) {
    motorlar(0, 0);
    kapak.write(KAPAK_KAPALI);       // yumurtayı kepçeye hapset
    delay(250);
    hedef = renk;
    Serial.print("Yumurta alindi, hedef=");
    Serial.println(hedef);
    durumDegistir(1);
    return;
  }
  if (renk != 0) {                   // rakip rengi: geri çekilip bırak
    motorlar(-180, -180);
    delay(350);
    donSaga(250);
    return;
  }
  if (zeminRengi() != 0 && millis() > 3000) {   // ararken köşelere girme (yanlış yumurta itmeyelim)
    motorlar(-180, -180);
    delay(300);
    donSaga(random(300, 600));
    return;
  }
  long d = mesafeCm();
  bool solVar = digitalRead(IR_SOL) == LOW;
  bool sagVar = digitalRead(IR_SAG) == LOW;
  if (d < 25) {
    motorlar(-170, -170);
    delay(200);
    donSaga(random(250, 600));
  } else if (solVar && !sagVar) {
    motorlar(120, 200);
  } else if (sagVar && !solVar) {
    motorlar(200, 120);
  } else {
    motorlar(190, 190);
  }
}

void eve() {
  // hedef köşeye geldik mi?
  if (zeminRengi() == hedef) {
    motorlar(120, 120);
    delay(250);                       // biraz daha içeri gir
    motorlar(0, 0);
    kapak.write(KAPAK_ACIK);
    delay(250);
    motorlar(-180, -180);             // yumurtayı köşede bırakıp geri çekil
    delay(500);
    donSaga(450);
    Serial.println("Yumurta birakildi");
    durumDegistir(0);
    return;
  }
  long d = mesafeCm();
  bool solDuvar = digitalRead(IR_SOL) == LOW;
  if (!duvarBulundu) {               // önce bir duvar bul
    if (d < 18) { donSaga(320); duvarBulundu = true; }
    else motorlar(190, 190);
    return;
  }
  if (d < 16) {                      // köşe: sağa dön, duvar solda kalsın
    motorlar(-150, -150);
    delay(120);
    donSaga(330);
  } else if (solDuvar) {
    motorlar(200, 130);              // duvara çok yakın: hafif sağa
  } else {
    motorlar(120, 200);              // duvarı kaybettik: sola yanaş
  }
  if (millis() - durumZamani > 40000) {   // çok uzun sürdü: bırak, yeniden ara
    kapak.write(KAPAK_ACIK);
    durumDegistir(0);
  }
}

// Sıkışma kontrolü: ileri giderken mesafe 1.5 sn boyunca değişmiyorsa geri çık
void sikismaKontrol() {
  if (millis() - sonKontrol < 500) return;
  sonKontrol = millis();
  long d = mesafeCm();
  if (abs(d - sonMesafe) < 2) ayniSayac++; else ayniSayac = 0;
  sonMesafe = d;
  if (ayniSayac >= 3) {
    Serial.println("Sikisma! geri cikiliyor");
    motorlar(-200, -200);
    delay(450);
    donSaga(random(250, 550));
    ayniSayac = 0;
    if (durum == 1) duvarBulundu = false;
  }
}

void loop() {
  sikismaKontrol();
  if (durum == 0) ara(); else eve();
  if (millis() - sonYazdirma > 500) {
    sonYazdirma = millis();
    Serial.print("durum=");
    Serial.print(durum);
    Serial.print(" zemin=");
    Serial.print(analogRead(ZEMIN));
    Serial.print(" mesafe=");
    Serial.println(mesafeCm());
  }
}
