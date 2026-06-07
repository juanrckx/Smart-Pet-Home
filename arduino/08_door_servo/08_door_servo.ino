#include <Servo.h>

// ================================================================
// PUERTA AUTOMÁTICA - SMART PET HOME
// ================================================================

const int SERVO_DOOR_PIN = 9;

const int DOOR_CLOSED_ANGLE = 0;
const int DOOR_OPEN_ANGLE = 90;

Servo doorServo;

void setup() {
  Serial.begin(9600);

  doorServo.attach(SERVO_DOOR_PIN);
  doorServo.write(DOOR_CLOSED_ANGLE);

  Serial.println("SMART_PET_DOOR:READY");
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
  if (command == "DOOR_OPEN") {
    openDoor();
    Serial.println("DOOR:OPEN");
    return;
  }

  if (command == "DOOR_CLOSE") {
    closeDoor();
    Serial.println("DOOR:CLOSE");
    return;
  }

  if (command.startsWith("DOOR_OPEN_FOR:")) {
    int durationMs = command.substring(14).toInt();

    if (durationMs < 300) {
      durationMs = 300;
    }

    if (durationMs > 60000) {
      durationMs = 60000;
    }

    openDoor();
    delay(durationMs);
    closeDoor();

    Serial.println("DOOR:OK");
    return;
  }

  if (command == "PING") {
    Serial.println("PONG");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(command);
}

void openDoor() {
  doorServo.write(DOOR_OPEN_ANGLE);
}

void closeDoor() {
  doorServo.write(DOOR_CLOSED_ANGLE);
}