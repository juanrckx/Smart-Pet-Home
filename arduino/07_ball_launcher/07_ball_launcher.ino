// ================================================================
// SMART PET HOME - LANZADOR DE PELOTAS CON L9110S
// ================================================================
//
// Hardware:
// - 2 motores DC 600 RPM
// - 2 ruedas
// - Driver L9110S
// - Adaptador 9V 1A para motores
// - Arduino por USB
//
// Comandos Serial:
// BALL_LAUNCH:5     -> inicia lanzamiento de 5 pelotas
// BALL_STOP         -> detiene motores
// BALL_POWER:200    -> cambia potencia 0-255
// BALL_TEST         -> prueba breve de motores
// PING              -> PONG
//
// Respuestas:
// BALL:LAUNCH:OK
// BALL:SHOT:<n>
// BALL:DONE
// BALL:STOP:OK
// BALL:POWER:<valor>
// BALL:TEST:OK

const int A_IA = 5;
const int A_IB = 6;

const int B_IA = 10;
const int B_IB = 11;

int velocidadMotores = 220;       // 0 a 255
int cantidadObjetivo = 0;
int pelotasLanzadas = 0;

bool lanzando = false;

unsigned long inicioLanzamiento = 0;
unsigned long ultimoDisparo = 0;

const unsigned long TIEMPO_CALENTAMIENTO_MS = 1200;
const unsigned long INTERVALO_ENTRE_PELOTAS_MS = 2500;
const unsigned long TIEMPO_MAXIMO_LANZAMIENTO_MS = 25000;

void setup() {
  pinMode(A_IA, OUTPUT);
  pinMode(A_IB, OUTPUT);
  pinMode(B_IA, OUTPUT);
  pinMode(B_IB, OUTPUT);

  detenerMotoresFisicamente();

  Serial.begin(9600);
  Serial.println("SMART_PET_BALL_LAUNCHER_L9110S:READY");
}

void loop() {
  leerComandosSerial();

  if (lanzando) {
    manejarLanzamiento();
  }
}

void leerComandosSerial() {
  if (!Serial.available()) {
    return;
  }

  String comando = Serial.readStringUntil('\n');
  comando.trim();

  if (comando.length() == 0) {
    return;
  }

  procesarComando(comando);
}

void procesarComando(String comando) {
  if (comando == "PING") {
    Serial.println("PONG");
    return;
  }

  if (comando == "BALL_STOP") {
    detenerLanzamiento();
    Serial.println("BALL:STOP:OK");
    return;
  }

  if (comando == "BALL_TEST") {
    probarMotores();
    Serial.println("BALL:TEST:OK");
    return;
  }

  if (comando.startsWith("BALL_POWER:")) {
    int nuevaVelocidad = comando.substring(11).toInt();
    nuevaVelocidad = constrain(nuevaVelocidad, 0, 255);
    velocidadMotores = nuevaVelocidad;

    Serial.print("BALL:POWER:");
    Serial.println(velocidadMotores);
    return;
  }

  if (comando.startsWith("BALL_LAUNCH:")) {
    int cantidad = comando.substring(12).toInt();
    iniciarLanzamiento(cantidad);
    return;
  }

  Serial.print("ERROR:UNKNOWN_COMMAND:");
  Serial.println(comando);
}

void iniciarLanzamiento(int cantidad) {
  if (cantidad < 1) {
    cantidad = 1;
  }

  if (cantidad > 5) {
    cantidad = 5;
  }

  cantidadObjetivo = cantidad;
  pelotasLanzadas = 0;
  lanzando = true;

  inicioLanzamiento = millis();
  ultimoDisparo = 0;

  encenderMotoresHaciaAdentro();

  Serial.println("BALL:LAUNCH:OK");
}

void manejarLanzamiento() {
  unsigned long ahora = millis();

  if (ahora - inicioLanzamiento > TIEMPO_MAXIMO_LANZAMIENTO_MS) {
    detenerLanzamiento();
    Serial.println("BALL:DONE");
    return;
  }

  if (ahora - inicioLanzamiento < TIEMPO_CALENTAMIENTO_MS) {
    return;
  }

  if (ultimoDisparo == 0 || ahora - ultimoDisparo >= INTERVALO_ENTRE_PELOTAS_MS) {
    ultimoDisparo = ahora;
    pelotasLanzadas++;

    Serial.print("BALL:SHOT:");
    Serial.println(pelotasLanzadas);

    if (pelotasLanzadas >= cantidadObjetivo) {
      detenerLanzamiento();
      Serial.println("BALL:DONE");
    }
  }
}

void detenerLanzamiento() {
  lanzando = false;
  cantidadObjetivo = 0;
  pelotasLanzadas = 0;
  detenerMotoresFisicamente();
}

void probarMotores() {
  encenderMotoresHaciaAdentro();
  delay(2500);
  detenerMotoresFisicamente();
}

void encenderMotoresHaciaAdentro() {
  // Motor A hacia adelante
  analogWrite(A_IA, velocidadMotores);
  analogWrite(A_IB, 0);

  // Motor B en sentido contrario para que ambas ruedas giren hacia adentro
  analogWrite(B_IA, 0);
  analogWrite(B_IB, velocidadMotores);
}

void detenerMotoresFisicamente() {
  analogWrite(A_IA, 0);
  analogWrite(A_IB, 0);
  analogWrite(B_IA, 0);
  analogWrite(B_IB, 0);
}