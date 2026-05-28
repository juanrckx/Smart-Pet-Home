#include <Servo.h>

// ==================== CONFIGURACIÓN ====================
const int SERVO_PIN = 9;  // Pin donde conectaste el servo

// ==================== VARIABLES GLOBALES ====================
Servo servoComida;  // Objeto servo
String comandoRecibido = "";  // Guardar comando que llega

// ==================== SETUP (EJECUTA UNA VEZ) ====================
void setup() {
    Serial.begin(9600);  // Iniciar comunicación serial (misma velocidad que Node.js)
    
    servoComida.attach(SERVO_PIN);  // Conectar servo al PIN 9
    servoComida.write(0);  // Posición inicial: CERRADO (0°)
    
    // Enviar confirmación que Arduino está listo
    Serial.println("ARDUINO_READY");
    
    delay(100);  // Esperar a que Node.js esté listo
}

// ==================== LOOP (EJECUTA CONTINUAMENTE) ====================
void loop() {
    // Leer si hay datos disponibles del puerto serial
    if (Serial.available()) {
        // Leer carácter por carácter hasta newline
        char caracter = Serial.read();
        
        // Si es salto de línea, procesar comando completo
        if (caracter == '\n') {
            procesarComando(comandoRecibido);
            comandoRecibido = "";  // Limpiar para siguiente comando
        } else {
            // Agregar carácter al comando
            comandoRecibido += caracter;
        }
    }
    
    delay(10);  // Pequeño delay para no saturar
}

// ==================== FUNCIONES ====================

void procesarComando(String comando) {
    // Quitar espacios en blanco
    comando.trim();
    
    Serial.print("Comando recibido: ");
    Serial.println(comando);
    
    // -------- COMANDO: DISPENSAR COMIDA --------
    if (comando.startsWith("DISPENSE:")) {
        // Formato: "DISPENSE:3000" (3000 ms = 3 segundos)
        
        // Extraer duración del comando
        int duracion = comando.substring(9).toInt();
        
        // Validación
        if (duracion <= 0 || duracion > 10000) {
            Serial.println("ERROR:Duracion_invalida");
            return;
        }
        
        // ABRIR COMPUERTA
        Serial.println("Abriendo compuerta...");
        servoComida.write(90);  // Giro a 90° (ABIERTO)
        
        // Esperar el tiempo especificado
        delay(duracion);
        
        // CERRAR COMPUERTA
        Serial.println("Cerrando compuerta...");
        servoComida.write(0);   // Giro a 0° (CERRADO)
        
        // Confirmar que terminó
        Serial.println("DISPENSE:OK");
    }
    
    // -------- COMANDO: PROBAR SERVO (TEST) --------
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