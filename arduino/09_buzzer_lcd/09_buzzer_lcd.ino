#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ================================================================
// BUZZER + LCD 1602 - SMART PET HOME
// ================================================================

// Dirección común: 0x27.
// Si tu LCD no muestra nada, prueba cambiar a 0x3F.
LiquidCrystal_I2C lcd(0x3F, 20, 4);

const int BUZZER_PIN = 8;

void setup() {
  Serial.begin(9600);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  lcd.init();
  lcd.backlight();

  showWelcomeMessage();

  Serial.println("SMART_PET_COMMUNICATION:READY");
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
  if (command.startsWith("BUZZER_PLAY:")) {
    int durationMs = command.substring(12).toInt();

    if (durationMs < 200) {
      durationMs = 200;
    }

    if (durationMs > 10000) {
      durationMs = 10000;
    }

    playBuzzer(durationMs);

    Serial.println("BUZZER:OK");
    return;
  }

  if (command == "LCD_VIDEO_ON") {
    showVideoOn();
    Serial.println("LCD:OK");
    return;
  }

  if (command == "LCD_VIDEO_OFF") {
    showVideoOff();
    Serial.println("LCD:OK");
    return;
  }

  if (command.startsWith("LCD_TEXT:")) {
    String text = command.substring(9);
    showCustomText(text);
    Serial.println("LCD:OK");
    return;
  }

  if (command == "PING") {
    Serial.println("PONG");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(command);
}

void playBuzzer(int durationMs) {
  // Funciona bien con buzzer pasivo.
  // Con buzzer activo también puede sonar, dependiendo del módulo.
  showTalkingMessage();

  tone(BUZZER_PIN, 1000);
  delay(durationMs);
  noTone(BUZZER_PIN);

  showWelcomeMessage();
}

void showWelcomeMessage() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART PET HOME");
  lcd.setCursor(0, 1);
  lcd.print("Sistema listo");
  lcd.setCursor(0, 2);
  lcd.print("Mascota segura");
  lcd.setCursor(0, 3);
  lcd.print("Esperando accion");
}

void showVideoOn() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("VIDEO EN VIVO");
  lcd.setCursor(0, 1);
  lcd.print("Mascota online :)");
  lcd.setCursor(0, 2);
  lcd.print("Camara simulada");
  lcd.setCursor(0, 3);
  lcd.print("Smart Pet activo");
}

void showVideoOff() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("VIDEO APAGADO");
  lcd.setCursor(0, 1);
  lcd.print("Monitoreo pausado");
  lcd.setCursor(0, 2);
  lcd.print("Smart Pet Home");
  lcd.setCursor(0, 3);
  lcd.print("Sistema listo");
}

void showTalkingMessage() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("COMUNICACION");
  lcd.setCursor(0, 1);
  lcd.print("Dueno hablando...");
  lcd.setCursor(0, 2);
  lcd.print("Escucha mascota");
  lcd.setCursor(0, 3);
  lcd.print("Sonido activo");
}

void showCustomText(String text) {
  String lines[4] = {"", "", "", ""};

  int currentLine = 0;

  while (text.length() > 0 && currentLine < 4) {
    int separatorIndex = text.indexOf('|');

    if (separatorIndex == -1) {
      lines[currentLine] = text;
      text = "";
    } else {
      lines[currentLine] = text.substring(0, separatorIndex);
      text = text.substring(separatorIndex + 1);
    }

    lines[currentLine] = limitLCDText(lines[currentLine]);
    currentLine++;
  }

  lcd.clear();

  for (int i = 0; i < 4; i++) {
    lcd.setCursor(0, i);
    lcd.print(lines[i]);
  }
}

String limitLCDText(String text) {
  text.trim();

  if (text.length() > 20) {
    return text.substring(0, 20);
  }

  return text;
}