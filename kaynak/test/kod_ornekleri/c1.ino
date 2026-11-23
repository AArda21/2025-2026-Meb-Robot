#include <Servo.h>
#define KARE(x) ((x)*(x))
#define PIN_LED 13
const int dizi[] = {3, 5, 7};
struct Nokta { int x; int y; };
Nokta n1 = {1, 2};
enum Durum { BEKLE, GIT, DON };
Durum d = BEKLE;
byte b = 200; unsigned int u = 65535; long l = 100000L; float f = 3.14f; double dd = 2.5;
char ad[10] = "robot"; String s = "abc";
int sayac = 0;
int topla(int a, int b) { return a + b; }
float topla(float a, float b) { return a + b + 0.5; }
void setup() {
  Serial.begin(9600);
  pinMode(PIN_LED, OUTPUT);
  for (int i = 0; i < 3; i++) { Serial.print(dizi[i]); Serial.print(','); }
  Serial.println();
  Serial.println(KARE(4));
  Serial.println(n1.x + n1.y);
  switch (d) { case BEKLE: Serial.println("bekle"); break; case GIT: Serial.println("git"); break; default: break; }
  b += 100; Serial.println(b);
  u += 1; Serial.println(u);
  Serial.println(l * 3);
  Serial.println(f * 2, 3);
  Serial.println(7 / 2); Serial.println(7.0 / 2); Serial.println(7 % 3);
  Serial.println(topla(2, 3)); Serial.println(topla(2.0f, 3.0f));
  s += "def"; Serial.println(s.length()); Serial.println(s.substring(1, 3)); Serial.println(s.indexOf('d'));
  Serial.println(strlen(ad));
  Serial.println(map(512, 0, 1023, 0, 255)); Serial.println(constrain(300, 0, 255));
  Serial.println(abs(-5)); Serial.println(min(3, 9)); Serial.println(max(3, 9));
  Serial.println(bitRead(5, 0)); Serial.println(5 >> 1); Serial.println(5 & 4); Serial.println(1 << 3);
  int x = 10; x = x > 5 ? 1 : 0; Serial.println(x);
  unsigned long t = millis(); Serial.println(t < 100 ? "ok" : "no");
  do { sayac++; } while (sayac < 5); Serial.println(sayac);
  char c = 'A'; c++; Serial.println(c);
  Serial.println(String(42) + "x");
  Serial.println(sizeof(dizi) / sizeof(dizi[0]));
  static int st = 0; st++;
  int m2[2][3] = {{1,2,3},{4,5,6}}; Serial.println(m2[1][2]);
  float fl = 10 / 4; Serial.println(fl);
  int neg = -7 / 2; Serial.println(neg);
  Serial.println((int)3.9);
  Serial.println(sqrt(16)); Serial.println(pow(2, 10));
  Serial.println(F("flash"));
}
void loop() { }
