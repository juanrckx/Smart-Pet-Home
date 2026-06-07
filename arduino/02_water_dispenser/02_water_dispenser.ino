#include <Servo.h>

const unsigned long SERIAL_BAUDRATE = 9600;
const int SERVO_AGUA_PIN = 10;
const int SERVO_CERRADO = 0;
const int SERVO_ABIERTO = 90;

Servo servoAgua;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  servoAgua.attach(SERVO_AGUA_PIN);
  servoAgua.write(SERVO_CERRADO);
  Serial.println("SMART_PET_WATER:READY");
}

void loop() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando.startsWith("WATER:")) {
    int duracionMs = comando.substring(6).toInt();
    dispensar(duracionMs);
    Serial.println("WATER:OK");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void dispensar(int duracionMs) {
  if (duracionMs < 300) duracionMs = 300;
  if (duracionMs > 5000) duracionMs = 5000; // seguro para demo USB

  servoAgua.write(SERVO_ABIERTO);
  delay(duracionMs);
  servoAgua.write(SERVO_CERRADO);
}
