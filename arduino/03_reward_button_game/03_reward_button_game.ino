#include <Servo.h>

// ================================================================
// JUEGO DE BOTONES + DISPENSADOR DE PREMIO - SMART PET HOME
// ================================================================

const int TOTAL_BUTTONS = 4;

// LEDs del juego
const int LED_PINS[TOTAL_BUTTONS] = {
  2, 3, 4, 5
};

// Botones del juego
const int BUTTON_PINS[TOTAL_BUTTONS] = {
  7, 8, 12, 13
};

// Servo de premio
const int REWARD_SERVO_PIN = 11;

const int REWARD_CLOSED_ANGLE = 0;
const int REWARD_OPEN_ANGLE = 90;

Servo rewardServo;

// Antirrebote
bool previousButtonState[TOTAL_BUTTONS] = {
  false, false, false, false
};

unsigned long lastButtonChange[TOTAL_BUTTONS] = {
  0, 0, 0, 0
};

const unsigned long DEBOUNCE_MS = 250;

void setup() {
  Serial.begin(9600);

  setupLeds();
  setupButtons();
  setupRewardServo();

  Serial.println("SMART_PET_REWARD_GAME:READY");
}

void loop() {
  readSerialCommand();
  readGameButtons();
}

// ================================================================
// CONFIGURACIÓN
// ================================================================

void setupLeds() {
  for (int i = 0; i < TOTAL_BUTTONS; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
}

void setupButtons() {
  for (int i = 0; i < TOTAL_BUTTONS; i++) {
    pinMode(BUTTON_PINS[i], INPUT_PULLUP);
  }
}

void setupRewardServo() {
  rewardServo.attach(REWARD_SERVO_PIN);
  rewardServo.write(REWARD_CLOSED_ANGLE);
}

// ================================================================
// LECTURA SERIAL
// ================================================================

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
  if (command.startsWith("GAME_WIN:")) {
    int button = command.substring(9).toInt();

    indicateWin(button);

    Serial.println("GAME:OK");
    return;
  }

  if (command.startsWith("GAME_LOSE:")) {
    int button = command.substring(10).toInt();

    indicateLose(button);

    Serial.println("GAME:OK");
    return;
  }

  if (command == "GAME_RESET_LEDS") {
    turnOffAllLeds();

    Serial.println("GAME:OK");
    return;
  }

  if (command.startsWith("GAME_LED:")) {
    controlGameLed(command);

    Serial.println("GAME:OK");
    return;
  }

  if (command.startsWith("REWARD:")) {
    int durationMs = command.substring(7).toInt();

    dispenseReward(durationMs);

    Serial.println("REWARD:OK");
    return;
  }

  if (command == "PING") {
    Serial.println("PONG");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(command);
}

// ================================================================
// BOTONES FÍSICOS
// ================================================================

void readGameButtons() {
  for (int i = 0; i < TOTAL_BUTTONS; i++) {
    bool pressed = digitalRead(BUTTON_PINS[i]) == LOW;
    unsigned long now = millis();

    if (pressed && !previousButtonState[i] && now - lastButtonChange[i] > DEBOUNCE_MS) {
      int buttonNumber = i + 1;

      Serial.print("GAME_BUTTON:");
      Serial.println(buttonNumber);

      lastButtonChange[i] = now;
    }

    previousButtonState[i] = pressed;
  }
}

// ================================================================
// LEDS DEL JUEGO
// ================================================================

void indicateWin(int button) {
  turnOffAllLeds();

  int index = button - 1;

  if (!isValidIndex(index)) {
    return;
  }

  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_PINS[index], HIGH);
    delay(150);
    digitalWrite(LED_PINS[index], LOW);
    delay(150);
  }

  digitalWrite(LED_PINS[index], HIGH);
}

void indicateLose(int button) {
  turnOffAllLeds();

  int index = button - 1;

  if (!isValidIndex(index)) {
    return;
  }

  digitalWrite(LED_PINS[index], HIGH);
  delay(400);
  digitalWrite(LED_PINS[index], LOW);
}

void turnOffAllLeds() {
  for (int i = 0; i < TOTAL_BUTTONS; i++) {
    digitalWrite(LED_PINS[i], LOW);
  }
}

void controlGameLed(String command) {
  // Formato:
  // GAME_LED:1:ON
  // GAME_LED:1:OFF

  int firstSeparator = command.indexOf(':');
  int secondSeparator = command.indexOf(':', firstSeparator + 1);

  if (firstSeparator == -1 || secondSeparator == -1) {
    return;
  }

  int button = command.substring(firstSeparator + 1, secondSeparator).toInt();
  String action = command.substring(secondSeparator + 1);

  int index = button - 1;

  if (!isValidIndex(index)) {
    return;
  }

  if (action == "ON") {
    digitalWrite(LED_PINS[index], HIGH);
  } else if (action == "OFF") {
    digitalWrite(LED_PINS[index], LOW);
  }
}

bool isValidIndex(int index) {
  return index >= 0 && index < TOTAL_BUTTONS;
}

// ================================================================
// SERVO DE PREMIO
// ================================================================

void dispenseReward(int durationMs) {
  if (durationMs < 300) {
    durationMs = 300;
  }

  if (durationMs > 5000) {
    durationMs = 5000;
  }

  rewardServo.write(REWARD_OPEN_ANGLE);
  delay(durationMs);
  rewardServo.write(REWARD_CLOSED_ANGLE);
}