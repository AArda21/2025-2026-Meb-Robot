struct Yumurta { int x; int y; char renk; };
Yumurta liste[3] = { {1, 2, 'K'}, {3, 4, 'M'}, {5, 6, 'Y'} };
typedef struct { float kp; float ki; } PID;
PID pid = {1.5, 0.2};
Yumurta tek;
int topla(Yumurta y) { return y.x + y.y; }
byte durum = B101;
unsigned long t0 = 0UL;
void setup() {
  Serial.begin(9600);
  Serial.println(topla(liste[1]));
  Serial.println(liste[2].renk);
  Serial.println(pid.kp * 2);
  tek.x = 9; Serial.println(tek.x);
  Serial.println(durum);
  bitSet(durum, 4); Serial.println(durum);
  bitClear(durum, 0); Serial.println(durum);
  EEPROM.write(0, 77); Serial.println(EEPROM.read(0));
  int a = 5, b = 2; Serial.println(a / b); float c = a; Serial.println(c / b);
  long uzun = 70000; Serial.println(uzun / 7);
  for (int i = 0; i < 3; i++) { liste[i].x++; } Serial.println(liste[0].x);
}
void loop() {}
