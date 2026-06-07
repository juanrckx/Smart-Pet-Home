const unsigned long SERIAL_BAUDRATE = 9600;
const int TOTAL_BOTONES_JUEGO = 5;

const int LED_JUEGO_PINS[TOTAL_BOTONES_JUEGO] = {2, 3, 4, 5, 6};
const int BOTON_JUEGO_PINS[TOTAL_BOTONES_JUEGO] = {7, 8, 12, 13, A0};

bool estadoAnteriorBotones[TOTAL_BOTONES_JUEGO] = {false, false, false, false, false};
unsigned long ultimoCambioBoton[TOTAL_BOTONES_JUEGO] = {0, 0, 0, 0, 0};
const unsigned long DEBOUNCE_MS = 250;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);

  for (int i = 0; i < TOTAL_BOTONES_JUEGO; i++) {
    pinMode(LED_JUEGO_PINS[i], OUTPUT);
    digitalWrite(LED_JUEGO_PINS[i], LOW);
    pinMode(BOTON_JUEGO_PINS[i], INPUT_PULLUP);
  }

  Serial.println("SMART_PET_BUTTON_GAME:READY");
}

void loop() {
  leerComandosSerial();
  leerBotonesJuego();
}

void leerComandosSerial() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando.startsWith("GAME_WIN:")) {
    int boton = comando.substring(9).toInt();
    indicarVictoria(boton);
    Serial.println("GAME:OK");
    return;
  }

  if (comando.startsWith("GAME_LOSE:")) {
    int boton = comando.substring(10).toInt();
    indicarFallo(boton);
    Serial.println("GAME:OK");
    return;
  }

  if (comando == "GAME_RESET_LEDS") {
    apagarLedsJuego();
    Serial.println("GAME:OK");
    return;
  }

  if (comando.startsWith("GAME_LED:")) {
    controlarLedJuego(comando);
    Serial.println("GAME:OK");
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void leerBotonesJuego() {
  for (int i = 0; i < TOTAL_BOTONES_JUEGO; i++) {
    bool presionado = digitalRead(BOTON_JUEGO_PINS[i]) == LOW;
    unsigned long ahora = millis();

    if (presionado && !estadoAnteriorBotones[i] && ahora - ultimoCambioBoton[i] > DEBOUNCE_MS) {
      Serial.print("GAME_BUTTON:");
      Serial.println(i + 1);
      ultimoCambioBoton[i] = ahora;
    }

    estadoAnteriorBotones[i] = presionado;
  }
}

void indicarVictoria(int boton) {
  apagarLedsJuego();
  int indice = boton - 1;
  if (!indiceValido(indice)) return;

  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_JUEGO_PINS[indice], HIGH);
    delay(150);
    digitalWrite(LED_JUEGO_PINS[indice], LOW);
    delay(150);
  }

  digitalWrite(LED_JUEGO_PINS[indice], HIGH);
}

void indicarFallo(int boton) {
  apagarLedsJuego();
  int indice = boton - 1;
  if (!indiceValido(indice)) return;

  digitalWrite(LED_JUEGO_PINS[indice], HIGH);
  delay(400);
  digitalWrite(LED_JUEGO_PINS[indice], LOW);
}

void apagarLedsJuego() {
  for (int i = 0; i < TOTAL_BOTONES_JUEGO; i++) {
    digitalWrite(LED_JUEGO_PINS[i], LOW);
  }
}

void controlarLedJuego(String comando) {
  int primerSeparador = comando.indexOf(':');
  int segundoSeparador = comando.indexOf(':', primerSeparador + 1);
  if (primerSeparador == -1 || segundoSeparador == -1) return;

  int boton = comando.substring(primerSeparador + 1, segundoSeparador).toInt();
  String accion = comando.substring(segundoSeparador + 1);
  int indice = boton - 1;
  if (!indiceValido(indice)) return;

  if (accion == "ON") digitalWrite(LED_JUEGO_PINS[indice], HIGH);
  if (accion == "OFF") digitalWrite(LED_JUEGO_PINS[indice], LOW);
}

bool indiceValido(int indice) {
  return indice >= 0 && indice < TOTAL_BOTONES_JUEGO;
}
