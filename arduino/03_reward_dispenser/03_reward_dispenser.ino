#include <Servo.h>

const unsigned long SERIAL_BAUDRATE = 9600;
const int SERVO_PREMIO_PIN = 11;
const int SERVO_CERRADO = 0;
const int SERVO_ABIERTO = 90;

Servo servoPremio;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  servoPremio.attach(SERVO_PREMIO_PIN);
  servoPremio.write(SERVO_CERRADO);
  Serial.println("SMART_PET_REWARD:READY");
}

void loop() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando.startsWith("REWARD:")) {
    int duracionMs = comando.substring(7).toInt();
    dispensar(duracionMs);
    Serial.println("REWARD:OK");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void dispensar(int duracionMs) {
  if (duracionMs < 300) duracionMs = 300;
  if (duracionMs > 5000) duracionMs = 5000; // seguro para demo USB

  servoPremio.write(SERVO_ABIERTO);
  delay(duracionMs);
  servoPremio.write(SERVO_CERRADO);
}
