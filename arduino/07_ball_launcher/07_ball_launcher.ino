#include <Servo.h>

const unsigned long SERIAL_BAUDRATE = 9600;

const int SERVO_PELOTA_IZQ_PIN = 5;
const int SERVO_PELOTA_DER_PIN = 6;

// En servos 360 grados:
// 90 normalmente es detenido.
// 0 y 180 giran en direcciones contrarias.
// Puede variar un poco según el servo; ajustar si hace falta.
const int STOP_360 = 90;
const int IZQ_LANZAR = 180;
const int DER_LANZAR = 0;

const int DURACION_LANZAMIENTO_MS = 600;
const int PAUSA_ENTRE_PELOTAS_MS = 800;
const int MAX_PELOTAS = 5;

Servo servoIzq;
Servo servoDer;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  servoIzq.attach(SERVO_PELOTA_IZQ_PIN);
  servoDer.attach(SERVO_PELOTA_DER_PIN);
  detenerServos();
  Serial.println("SMART_PET_BALL_LAUNCHER:READY");
}

void loop() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando.startsWith("BALL_LAUNCH:")) {
    int cantidad = comando.substring(12).toInt();
    lanzarPelotas(cantidad);
    Serial.println("BALL:OK");
    return;
  }

  if (comando == "BALL_STOP") {
    detenerServos();
    Serial.println("BALL:STOPPED");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void lanzarPelotas(int cantidad) {
  if (cantidad < 1) cantidad = 1;
  if (cantidad > MAX_PELOTAS) cantidad = MAX_PELOTAS;

  for (int i = 1; i <= cantidad; i++) {
    servoIzq.write(IZQ_LANZAR);
    servoDer.write(DER_LANZAR);
    delay(DURACION_LANZAMIENTO_MS);

    detenerServos();

    Serial.print("BALL:SHOT:");
    Serial.println(i);

    delay(PAUSA_ENTRE_PELOTAS_MS);
  }
}

void detenerServos() {
  servoIzq.write(STOP_360);
  servoDer.write(STOP_360);
}
