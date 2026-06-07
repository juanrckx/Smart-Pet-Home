const unsigned long SERIAL_BAUDRATE = 9600;
const int LDR_PIN = A0;
const int UMBRAL_LDR = 500; // ajustar después de probar

bool presenciaAnterior = false;
unsigned long ultimaLectura = 0;
const unsigned long INTERVALO_MS = 500;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  pinMode(LDR_PIN, INPUT);
  Serial.println("SMART_PET_LDR:READY");
}

void loop() {
  leerComandosSerial();
  revisarPresencia();
}

void leerComandosSerial() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando == "READ_PRESENCE") {
    enviarPresenciaActual();
    return;
  }

  if (comando == "READ_LDR") {
    Serial.print("LDR:");
    Serial.println(analogRead(LDR_PIN));
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void revisarPresencia() {
  unsigned long ahora = millis();
  if (ahora - ultimaLectura < INTERVALO_MS) return;
  ultimaLectura = ahora;

  bool presenciaActual = calcularPresencia();

  if (presenciaActual != presenciaAnterior) {
    Serial.print("PRESENCE:");
    Serial.println(presenciaActual ? 1 : 0);
    presenciaAnterior = presenciaActual;
  }
}

void enviarPresenciaActual() {
  bool presenciaActual = calcularPresencia();
  Serial.print("PRESENCE:");
  Serial.println(presenciaActual ? 1 : 0);
}

bool calcularPresencia() {
  int valor = analogRead(LDR_PIN);
  return valor < UMBRAL_LDR; // si queda al revés, cambiar < por >
}
