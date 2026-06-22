#include <Servo.h>

// ================================================================
// DISPENSADOR DE "AGUA" SIMULADO CON ARROZ + LDR
// SMART PET HOME
// ================================================================
//
// El sistema sigue representando agua, pero en la maqueta usamos arroz.
// La LDR detecta si el plato/recipiente ya está lleno.
//
// Servo agua/arroz -> D10
// LDR divisor de voltaje -> A3
//
// Comandos:
// WATER_AUTO_FILL      -> llena hasta que la LDR detecte nivel lleno
// WATER_STATUS         -> devuelve lectura actual
// READ_WATER_LEVEL     -> devuelve lectura actual
// WATER_CAL_EMPTY      -> calibra lectura de recipiente vacío
// WATER_CAL_FULL       -> calibra lectura de recipiente lleno
// WATER:<ms>           -> compatibilidad con sistema anterior
// PING                 -> PONG

const int WATER_SERVO_PIN = 10;
const int LDR_PIN = A3;

const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;

const unsigned long MAX_FILL_TIME_MS = 12000;
const unsigned long READ_INTERVAL_MS = 150;

// Valores iniciales de calibración.
// Luego los ajustamos con WATER_CAL_EMPTY y WATER_CAL_FULL.
int emptyValue = 800;
int fullValue = 350;
int fullThreshold = 575;

Servo waterServo;

void setup() {
  Serial.begin(9600);

  waterServo.attach(WATER_SERVO_PIN);
  closeGate();

  Serial.println("SMART_PET_WATER_RICE_LEVEL:READY");
}

void loop() {
  readSerialCommand();
}

void readSerialCommand() {
  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command.length() == 0) {
    return;
  }

  processCommand(command);
}

void processCommand(String command) {
  if (command == "PING") {
    Serial.println("PONG");
    return;
  }

  if (command == "WATER_STATUS" || command == "READ_WATER_LEVEL") {
    sendWaterStatus();
    return;
  }

  if (command == "WATER_CAL_EMPTY") {
    emptyValue = readLdrAverage();
    updateThreshold();

    Serial.print("WATER:CAL:EMPTY:");
    Serial.println(emptyValue);
    Serial.println("WATER:CAL:OK");
    return;
  }

  if (command == "WATER_CAL_FULL") {
    fullValue = readLdrAverage();
    updateThreshold();

    Serial.print("WATER:CAL:FULL:");
    Serial.println(fullValue);
    Serial.println("WATER:CAL:OK");
    return;
  }

  if (command == "WATER_AUTO_FILL") {
    autoFill();
    return;
  }

  // Compatibilidad vieja: abre por tiempo fijo.
  if (command.startsWith("WATER:")) {
    int durationMs = command.substring(6).toInt();
    dispenseByTime(durationMs);
    Serial.println("WATER:OK");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(command);
}

int readLdrAverage() {
  long total = 0;

  for (int i = 0; i < 10; i++) {
    total += analogRead(LDR_PIN);
    delay(10);
  }

  return total / 10;
}

void updateThreshold() {
  fullThreshold = (emptyValue + fullValue) / 2;
}

bool isFull() {
  int value = readLdrAverage();

  // Con el divisor recomendado:
  // luz = alto, tapado por arroz = bajo.
  return value <= fullThreshold;
}

void sendWaterStatus() {
  int value = readLdrAverage();

  Serial.print("WATER:STATUS:");
  Serial.print(value);
  Serial.print(":");

  if (value <= fullThreshold) {
    Serial.println("FULL");
  } else {
    Serial.println("LOW");
  }
}

void autoFill() {
  Serial.println("WATER:FILLING");

  if (isFull()) {
    sendWaterStatus();
    Serial.println("WATER:ALREADY_FULL");
    Serial.println("WATER:OK");
    return;
  }

  openGate();

  unsigned long startTime = millis();
  unsigned long lastRead = 0;

  while (millis() - startTime < MAX_FILL_TIME_MS) {
    if (millis() - lastRead >= READ_INTERVAL_MS) {
      lastRead = millis();

      int value = readLdrAverage();

      Serial.print("WATER:LEVEL:");
      Serial.println(value);

      if (value <= fullThreshold) {
        break;
      }
    }
  }

  closeGate();
  delay(300);

  sendWaterStatus();
  Serial.println("WATER:OK");
}

void dispenseByTime(int durationMs) {
  if (durationMs < 300) {
    durationMs = 300;
  }

  if (durationMs > 15000) {
    durationMs = 15000;
  }

  openGate();
  delay(durationMs);
  closeGate();
}

void openGate() {
  waterServo.write(SERVO_OPEN_ANGLE);
}

void closeGate() {
  waterServo.write(SERVO_CLOSED_ANGLE);
}