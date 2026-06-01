// smart-pet-home.ino
//

#include <Servo.h>

// ==================== CONFIGURACIÓN ====================
const int SERVO_PIN      = 9;   // Servo dispensador de comida
const int SERVO_PIN_AGUA = 10;  // Servo dispensador de agua

// ==================== VARIABLES GLOBALES ====================
Servo  servoComida;
Servo  servoAgua;                  // ← CORRECCIÓN: faltaba punto y coma
String comandoRecibido = "";

// ==================== SETUP ====================
void setup() {
    Serial.begin(9600);

    servoComida.attach(SERVO_PIN);
    servoComida.write(0);          // Posición inicial: cerrado

    servoAgua.attach(SERVO_PIN_AGUA);  // ← CORRECCIÓN: faltaba punto y coma
    servoAgua.write(0);

    Serial.println("ARDUINO_READY");
    delay(100);
}

// ==================== LOOP ====================
void loop() {
    if (Serial.available()) {
        char caracter = Serial.read();

        if (caracter == '\n') {
            procesarComando(comandoRecibido);
            comandoRecibido = "";
        } else {
            comandoRecibido += caracter;
        }
    }

    delay(10);
}

// ==================== PROCESAR COMANDOS ====================
//
// Comandos que acepta este Arduino:
//
//   DISPENSE:<ms>     Dispensar comida por <ms> milisegundos
//                     Responde: DISPENSE:OK
//
//   WATER:<ms>        Abrir compuerta de agua por <ms> milisegundos
//                     Responde: AGUA:OK
//
//   TEST_SERVO        Prueba el servo de comida (abre 2s, cierra)
//                     Responde: TEST:COMPLETADO
//

void procesarComando(String comando) {
    comando.trim();

    Serial.print("Comando recibido: ");
    Serial.println(comando);

    // -------- DISPENSAR COMIDA --------
    if (comando.startsWith("DISPENSE:")) {
        int duracion = comando.substring(9).toInt();

        if (duracion <= 0 || duracion > 25000) {
            Serial.println("ERROR:Duracion_invalida");
            return;
        }

        Serial.println("Abriendo compuerta comida...");
        servoComida.write(90);
        delay(duracion);
        Serial.println("Cerrando compuerta comida...");
        servoComida.write(0);

        Serial.println("DISPENSE:OK");
    }

    // -------- DISPENSAR AGUA --------
    // CORRECCIÓN: era "WATER: " (con espacio), ahora es "WATER:" (sin espacio)
    // substring(6) lee desde el carácter 6, que es justo después de "WATER:"
    else if (comando.startsWith("WATER:")) {
        int duracion = comando.substring(6).toInt();

        if (duracion <= 0 || duracion > 10000) {
            Serial.println("ERROR:Duracion_invalida");
            return;
        }

        Serial.println("Abriendo compuerta agua...");
        servoAgua.write(90);
        delay(duracion);
        Serial.println("Cerrando compuerta agua...");
        servoAgua.write(0);

        Serial.println("WATER:OK");
    }

    // -------- TEST SERVO --------
    else if (comando == "TEST_SERVO") {
        Serial.println("TEST: Abriendo...");
        servoComida.write(90);
        delay(2000);
        Serial.println("TEST: Cerrando...");
        servoComida.write(0);
        delay(1000);
        Serial.println("TEST:COMPLETADO");
    }

    // -------- COMANDO DESCONOCIDO --------
    else {
        Serial.print("ERROR:Comando_desconocido:");
        Serial.println(comando);
    }
}
