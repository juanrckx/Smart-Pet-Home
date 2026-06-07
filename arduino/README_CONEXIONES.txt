SMART PET HOME - SKETCHES INDIVIDUALES PARA DEFENSA
Baudios en todos los sketches: 9600

REGLA DE DEFENSA:
1. Apagar/detener el servidor Node.js antes de subir un nuevo .ino.
2. Cerrar el Serial Monitor antes de iniciar Node.js.
3. Desconectar USB antes de cambiar cables.
4. Conectar solo el módulo que se va a defender.
5. Subir el .ino correspondiente.
6. Probar primero en Serial Monitor.
7. Cerrar Serial Monitor.
8. Iniciar Node.js y probar desde la interfaz HTML.

01_food_dispenser:
- Servo SG90 comida
- Señal: D9
- Rojo: 5V Arduino solo para demo individual
- Café/negro: GND Arduino
- Comando: DISPENSE:<milisegundos>
- Respuesta: DISPENSE:OK

02_water_dispenser:
- Servo SG90 agua
- Señal: D10
- Rojo: 5V Arduino solo para demo individual
- Café/negro: GND Arduino
- Comando: WATER:<milisegundos>
- Respuesta: WATER:OK

03_reward_dispenser:
- Servo SG90 premio
- Señal: D11
- Rojo: 5V Arduino solo para demo individual
- Café/negro: GND Arduino
- Comando: REWARD:<milisegundos>
- Respuesta: REWARD:OK

04_button_game:
- LEDs con resistencia 220/330 ohm:
  LED1 D2, LED2 D3, LED3 D4, LED4 D5, LED5 D6
- Botones con INPUT_PULLUP:
  BTN1 D7 a GND
  BTN2 D8 a GND
  BTN3 D12 a GND
  BTN4 D13 a GND
  BTN5 A0 a GND
- Arduino envía: GAME_BUTTON:<boton>
- Node envía: GAME_WIN:<boton>, GAME_LOSE:<boton>, GAME_RESET_LEDS, GAME_LED:<boton>:ON/OFF

05_dht11_temperature:
- DHT11/V182:
  + a 5V
  OUT a A1
  - a GND
- Arduino envía: TEMP:<valor>
- Comando opcional: READ_TEMP

06_ldr_presence:
- Divisor de voltaje:
  5V -> LDR -> A2 -> resistencia 10k -> GND
- Arduino envía: PRESENCE:1 o PRESENCE:0
- Comandos opcionales: READ_PRESENCE, READ_LDR

07_ball_launcher:
- MG90S 360 izquierdo señal: D5
- MG90S 360 derecho señal: D6
- Rojo de ambos: 5V Arduino SOLO si es prueba breve y sin carga fuerte. No recomendado para fricción real.
- Café/negro de ambos: GND Arduino
- Comando nuevo sugerido: BALL_LAUNCH:<cantidad>
- Comando para detener: BALL_STOP
- Respuestas: BALL:SHOT:<n>, BALL:OK

ADVERTENCIA:
El plan sin fuente externa es razonable para un SG90 individual, LEDs, botones y sensores.
Para dos MG90S de 360 grados generando fricción real, el 5V del Arduino/laptop puede fallar.
Si en defensa los MG90S tiemblan, reinician el Arduino o no lanzan, usar power bank/cargador 5V 2A/3A prestado como alimentación externa.
