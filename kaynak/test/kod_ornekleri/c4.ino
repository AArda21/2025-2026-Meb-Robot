unsigned long n = 0;
void setup() { Serial.begin(115200); }
void loop() { n++; Serial.println("sensor degerleri: 123 456 789"); if (millis() > 3000 && millis() < 3050) { Serial.print("dongu sayisi "); Serial.println(n); } }
