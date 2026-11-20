// Basit rakip: dolaşır, duvar görünce döner
#define ENA 5
#define IN1 7
#define IN2 8
#define ENB 6
#define IN3 9
#define IN4 10
#define TRIG 11
#define ECHO 12
#define LED_K A3
#define LED_M A4
#define KOSE A5   // köşe anahtarı: kırmızıda HIGH

void motor(int sol, int sag) {
  digitalWrite(IN1, sol >= 0); digitalWrite(IN2, sol < 0);
  digitalWrite(IN3, sag >= 0); digitalWrite(IN4, sag < 0);
  analogWrite(ENA, abs(sol)); analogWrite(ENB, abs(sag));
}

long mesafe() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  long t = pulseIn(ECHO, HIGH, 30000);
  return t == 0 ? 999 : t / 58;
}

void setup() {
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(LED_K, OUTPUT); pinMode(LED_M, OUTPUT); pinMode(KOSE, INPUT);
  bool kirmizi = digitalRead(KOSE) == HIGH;
  digitalWrite(LED_K, kirmizi); digitalWrite(LED_M, !kirmizi);
}

void loop() {
  if (mesafe() < 25) { motor(-160, -160); delay(300); motor(170, -170); delay(random(300, 700)); }
  else motor(170, 180);
}
