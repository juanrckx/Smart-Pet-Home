#include <DHT.h>

const unsigned long SERIAL_BAUDRATE = 9600;
const int DHT_PIN = 2;
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long ultimaLectura = 0;
const unsigned long INTERVALO_MS = 5000;

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  dht.begin();
  Serial.println("SMART_PET_DHT11:READY");
}

void loop() {
  leerComandosSerial();
  enviarTemperaturaCadaCiertoTiempo();
}

void leerComandosSerial() {
  if (!Serial.available()) return;

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando == "READ_TEMP") {
    enviarTemperatura();
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void enviarTemperaturaCadaCiertoTiempo() {
  unsigned long ahora = millis();
  if (ahora - ultimaLectura < INTERVALO_MS) return;
  ultimaLectura = ahora;
  enviarTemperatura();
}

void enviarTemperatura() {
  float temperatura = dht.readTemperature();

  if (isnan(temperatura)) {
    Serial.println("TEMP:ERROR");
    return;
  }

  Serial.print("TEMP:");
  Serial.println(temperatura);
}
