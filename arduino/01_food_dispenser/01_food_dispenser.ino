#include <Servo.h>

const unsigned long SERIAL_BAUDRATE = 9600;
const int SERVO_COMIDA_PIN = 9;
const int SERVO_CERRADO = 0;
const int SERVO_ABIERTO = 90;

Servo servoComida;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  servoComida.attach(SERVO_COMIDA_PIN);
  servoComida.write(SERVO_CERRADO);
  Serial.println("SMART_PET_FOOD:READY");
}

void loop() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando.startsWith("DISPENSE:")) {
    int duracionMs = comando.substring(9).toInt();
    dispensar(duracionMs);
    Serial.println("DISPENSE:OK");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void dispensar(int duracionMs) {
  if (duracionMs < 300) duracionMs = 300;
  if (duracionMs > 5000) duracionMs = 5000; // seguro para demo USB

  servoComida.write(SERVO_ABIERTO);
  delay(duracionMs);
  servoComida.write(SERVO_CERRADO);
}
