// Buldozer tipi rakip (örnek kod)
// Renk sensörü yok: önündeki bıçakla yumurtaları sürükleyerek sahayı tarar, duvarda döner.
// Kendi köşesine girerse sürüklediğini bırakıp geri çıkar; rakip köşesinden kaçar (rakibe puan yazdırmamak için).
#define ENA 5
#define IN1 7
#define IN2 8
#define ENB 6
#define IN3 9
#define IN4 10
#define TRIG 11
#define ECHO 12
#define ZEMIN A0
#define LED_K A3
#define LED_M A4
#define KOSE A5

#define HIZ 200
#define KAVIS 18      // sağ motor biraz yavaş: geniş yay çizerek tarar

#define ZEMIN_BEYAZ_UST 200
#define ZEMIN_KIRMIZI_ALT 250
#define ZEMIN_KIRMIZI_UST 370
#define ZEMIN_MAVI_ALT 560

bool TAKIM_KIRMIZI = true;

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

// 0 = beyaz, 1 = kırmızı köşe, 2 = mavi köşe, 3 = diğer (yeşil)
int zeminRengi() {
  int z = analogRead(ZEMIN);
  if (z < ZEMIN_BEYAZ_UST) return 0;
  if (z >= ZEMIN_KIRMIZI_ALT && z <= ZEMIN_KIRMIZI_UST) return 1;
  if (z >= ZEMIN_MAVI_ALT) return 2;
  return 3;
}

void setup() {
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);
  TAKIM_KIRMIZI = digitalRead(KOSE) == HIGH;
  digitalWrite(LED_K, TAKIM_KIRMIZI ? HIGH : LOW); digitalWrite(LED_M, TAKIM_KIRMIZI ? LOW : HIGH);
}

void loop() {
  int benim = TAKIM_KIRMIZI ? 1 : 2;
  int z = zeminRengi();
  if (millis() > 2500 && z == benim) {          // kendi köşemiz: sürüklediklerini bırak
    motorlar(150, 150); delay(350);
    motorlar(-HIZ, -HIZ); delay(600);
    motorlar(HIZ, -HIZ); delay(random(500, 900));
    return;
  }
  if (millis() > 2500 && z != 0) {              // başka köşe: kaç
    motorlar(-HIZ, -HIZ); delay(450);
    motorlar(-HIZ, HIZ); delay(random(400, 800));
    return;
  }
  if (mesafeCm() < 20) {
    motorlar(-HIZ, -HIZ); delay(300);
    motorlar(HIZ, -HIZ); delay(random(400, 900));
    return;
  }
  motorlar(HIZ, HIZ - KAVIS);
}
