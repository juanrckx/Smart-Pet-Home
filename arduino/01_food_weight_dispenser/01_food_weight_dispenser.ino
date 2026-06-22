#include <Servo.h>
#include "HX711.h"

// ================================================================
// DISPENSADOR DE COMIDA POR PESO - SMART PET HOME
// ================================================================

// HX711
const int HX711_DT_PIN = 3;
const int HX711_SCK_PIN = 2;

// Servo compuerta
const int FOOD_SERVO_PIN = 9;

const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;

// Seguridad
const float MIN_TARGET_GRAMS = 5.0;
const float MAX_TARGET_GRAMS = 500.0;
const unsigned long MAX_DISPENSE_TIME_MS = 20000;

// Calibración inicial.
// Este valor se ajusta en pruebas con CAL:<factor>
float calibrationFactor = -7050.0;

HX711 scale;
Servo foodServo;

void setup() {
  Serial.begin(9600);

  foodServo.attach(FOOD_SERVO_PIN);
  closeGate();

  scale.begin(HX711_DT_PIN, HX711_SCK_PIN);
  scale.set_scale(calibrationFactor);
  scale.tare();

  Serial.println("SMART_PET_FOOD_WEIGHT:READY");
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

  if (command == "TARE") {
    scale.tare();
    Serial.println("FOOD:TARE:OK");
    return;
  }

  if (command == "READ_WEIGHT") {
    sendWeight();
    return;
  }

  if (command.startsWith("CAL:")) {
    float newFactor = command.substring(4).toFloat();

    if (newFactor != 0) {
      calibrationFactor = newFactor;
      scale.set_scale(calibrationFactor);

      Serial.print("FOOD:CAL:");
      Serial.println(calibrationFactor);
    } else {
      Serial.println("FOOD:CAL:ERROR");
    }

    return;
  }

  if (command.startsWith("FOOD_TARGET:")) {
    float target = command.substring(12).toFloat();
    dispenseByWeight(target);
    return;
  }

  // Compatibilidad con el sistema anterior por tiempo.
  if (command.startsWith("DISPENSE:")) {
    int durationMs = command.substring(9).toInt();
    dispenseByTime(durationMs);
    Serial.println("DISPENSE:OK");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(command);
}

void sendWeight() {
  float weight = getWeightGrams();

  Serial.print("FOOD:WEIGHT:");
  Serial.println(weight, 2);
}

float getWeightGrams() {
  if (!scale.is_ready()) {
    return 0;
  }

  float value = scale.get_units(5);

  // Evitamos valores negativos pequeños por vibración.
  if (value < 0 && value > -2) {
    value = 0;
  }

  return value;
}

void dispenseByWeight(float targetGrams) {
  if (targetGrams < MIN_TARGET_GRAMS) {
    targetGrams = MIN_TARGET_GRAMS;
  }

  if (targetGrams > MAX_TARGET_GRAMS) {
    targetGrams = MAX_TARGET_GRAMS;
  }

  scale.tare();

  Serial.print("FOOD:TARGET:");
  Serial.println(targetGrams, 2);

  openGate();

  unsigned long startTime = millis();

  while (millis() - startTime < MAX_DISPENSE_TIME_MS) {
    float currentWeight = getWeightGrams();

    Serial.print("FOOD:GRAMS:");
    Serial.println(currentWeight, 2);

    if (currentWeight >= targetGrams) {
      break;
    }

    delay(150);
  }

  closeGate();

  delay(500);

  float finalWeight = getWeightGrams();

  Serial.print("FOOD:FINAL:");
  Serial.println(finalWeight, 2);

  Serial.println("FOOD:OK");
}

void dispenseByTime(int durationMs) {
  if (durationMs < 300) {
    durationMs = 300;
  }

  if (durationMs > 20000) {
    durationMs = 20000;
  }

  openGate();
  delay(durationMs);
  closeGate();
}

void openGate() {
  foodServo.write(SERVO_OPEN_ANGLE);
}

void closeGate() {
  foodServo.write(SERVO_CLOSED_ANGLE);
}