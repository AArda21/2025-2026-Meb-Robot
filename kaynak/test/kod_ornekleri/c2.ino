int zaman = 0;
unsigned long son = 0;
int sayac = 0;
void setup() { Serial.begin(9600); }
void loop() {
  zaman = millis();
  if (millis() - son > 10000) { son = millis(); Serial.print("zaman="); Serial.println(zaman); }
  sayac += 1000;
  delay(100);
}
