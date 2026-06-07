#include <Servo.h>

// ================================================================
// LANZADOR DE PELOTAS - SMART PET HOME
// ================================================================

// Según el plan de defensa:
// MG90S 360 izquierdo → D5
// MG90S 360 derecho   → D6

const int LEFT_SERVO_PIN = 5;
const int RIGHT_SERVO_PIN = 9;

Servo leftServo;
Servo rightServo;

// Servos 360:
// 1500 = detenido aproximadamente.
// Si giran mal, ajusta estos valores.
const int SERVO_STOP = 1500;
const int LEFT_FORWARD = 1700;
const int RIGHT_FORWARD = 1300;

const unsigned long SHOT_TIME_MS = 850;
const unsigned long PAUSE_BETWEEN_SHOTS_MS = 300;

bool launching = false;

int targetShots = 0;
int currentShot = 0;

enum LauncherState {
  IDLE,
  SPINNING,
  PAUSE
};

LauncherState launcherState = IDLE;

unsigned long stateStartTime = 0;

void setup() {
  Serial.begin(9600);

  leftServo.attach(LEFT_SERVO_PIN);
  rightServo.attach(RIGHT_SERVO_PIN);

  stopMotors();

  Serial.println("SMART_PET_BALL_LAUNCHER:READY");
}

void loop() {
  readSerialCommand();
  updateLauncher();
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
if (command.startsWith("BALL_LAUNCH:")) {
  int amount = command.substring(12).toInt();

  if (amount < 1) {
    amount = 1;
  }

  if (amount > 5) {
    amount = 5;
  }

  startLaunch(amount);

  Serial.println("BALL:LAUNCH:OK");
  return;
}

if (command == "BALL_STOP") {
  stopLaunch();
  Serial.println("BALL:STOP:OK");
  return;
}

  if (command == "PING") {
    Serial.println("PONG");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(command);
}

void startLaunch(int amount) {
  targetShots = amount;
  currentShot = 0;
  launching = true;

  startNextShot();
}

void stopLaunch() {
  launching = false;
  launcherState = IDLE;
  targetShots = 0;
  currentShot = 0;
  stopMotors();
}

void startNextShot() {
  if (!launching) {
    return;
  }

  currentShot++;

  Serial.print("BALL:SHOT:");
  Serial.println(currentShot);

  spinMotors();

  launcherState = SPINNING;
  stateStartTime = millis();
}

void updateLauncher() {
  if (!launching) {
    return;
  }

  unsigned long now = millis();

  if (launcherState == SPINNING) {
    if (now - stateStartTime >= SHOT_TIME_MS) {
      stopMotors();

      launcherState = PAUSE;
      stateStartTime = now;
    }

    return;
  }

  if (launcherState == PAUSE) {
    if (now - stateStartTime >= PAUSE_BETWEEN_SHOTS_MS) {
      if (currentShot >= targetShots) {
        stopLaunch();
        Serial.println("BALL:DONE");
      } else {
        startNextShot();
      }
    }
  }
}

void spinMotors() {
  leftServo.writeMicroseconds(LEFT_FORWARD);
  rightServo.writeMicroseconds(RIGHT_FORWARD);
}

void stopMotors() {
  leftServo.writeMicroseconds(SERVO_STOP);
  rightServo.writeMicroseconds(SERVO_STOP);
}