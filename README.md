# Crecemos

**Cuadra tu día. Crece tu negocio.**

Crecemos es una app móvil de registro y decisiones para pequeños vendedores informales. Nació de entrevistar a un vendedor real de anticuchos, a quien aquí se llama **Freddy** (sin apellido ni datos de contacto). Es un proyecto académico del React Native Lab, pensado para mostrar cómo una entidad financiera podría entender el negocio de quien no tiene historial formal.

## Qué es

### El problema

Freddy compra mercadería cada 2 días y razona por ciclos: "el primer día es para el capital y el segundo es la ganancia". Tres cosas le dolían:

- **No sabe cuánto le queda de verdad.** Todo es memoria, y parte de lo que cobra por Yape entra a una cuenta que no es suya.
- **No sabe qué producto le deja más.** Cree que el que más vende es el que más deja, y no siempre es así.
- **Para el banco, no existe.** Quien evalúa un crédito verifica sus ventas preguntando a los vecinos.

### Qué hace

| Función                       | Qué resuelve                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Barra de navegación           | Inicio, Historial, **Cerrar día** (botón central grande), Resumen y Asistente. Cerrar día se abre como pantalla modal y termina con una pantalla de éxito. |
| Cerrar mi día                 | Anota las porciones preparadas y las que sobraron por producto, el Yape y los gastos. La app calcula la venta.                                   |
| Cuéntame tu día               | Escribe una frase libre ("hice 40 anticuchos y sobraron 3") y la app **llena el formulario para que lo revises**. Se interpreta en el teléfono: no envía nada. |
| Anotar un yape                | Apunta un Yape en el momento en que entra; al cerrar el día la suma ya viene puesta (se puede cambiar).                                          |
| Resultado registrado, por ciclo de compra | Lo vendido menos los gastos registrados desde que compró mercadería; incluye pagos pendientes de recibir.                       |
| Para mañana                   | Sugiere cuánto preparar de cada producto según los mismos días de semanas anteriores, con la mercadería que costaría.                            |
| Tu semana                     | Los lunes, Inicio muestra el resumen de la semana pasada (ventas, mejor día, comparación).                                                       |
| Recordatorio                  | A la hora que elijas, un aviso **dentro de la app** si aún no cerraste tu día. No son notificaciones del sistema.                                 |
| Historial                     | Un grupo por día, con filtros (ingresos, gastos, por cobrar) y resumen del mes. Se puede editar o borrar un día sin tocar los precios viejos.    |
| Cobros del Yape               | Suma lo que entró a una cuenta ajena y falta cobrar, y permite marcarlo como cobrado.                                                            |
| Qué me deja cada uno          | Contrasta lo que vendes con lo que te deja cada producto.                                                      |
| Simulador de precio           | Prueba "¿y si subo el precio?" y muestra cuánto más ganarías, sin tocar tus datos.                                                            |
| Mi cuota (meta de ahorro)     | Una alcancía con la cuota que quieres juntar y un aporte diario sugerido; cada aporte se anota y se suma.                                        |
| Perfil                        | Un menú limpio de seis opciones (Mis datos, Cómo me pagan, Recordatorio diario, Mis productos, Borrar datos y Ayuda), cada una con un resumen en vivo y su propia pantalla. La foto se cambia con el botón de cámara sobre el avatar: elegir de la galería, tomar foto o quitarla. |
| Mis productos                 | Permite crear, renombrar, editar, desactivar y reactivar productos desde Perfil → Mis productos.                                                  |
| Recomendaciones               | Seis reglas fijas (cobro, precio, cuánto preparar, cuánto retirar, día flojo, comparación con el ciclo anterior). Muestra las 2 más importantes. |
| Resumen con gráficos y periodo   | Debajo del ciclo, "Tus números": una **torta** de ventas por producto (cada porción con su color y su dibujo, para que se lea sin depender del color), barras por mes y por producto y los últimos 7, 14 o 30 días, donde un día sin cierre se ve como un hueco y no como cero. Un botón "Periodo" elige todo el historial (por defecto), este mes, el mes pasado, los últimos 30 días, un mes o un rango de meses. |
| Mi reporte y pasaporte para la entidad financiera | Totales con venta y ganancia promedio mensual, una **cuota mensual de referencia** y una constancia de registro con código QR generado en el teléfono, en texto o en PDF. **Se puede compartir desde el primer día cerrado**, sin esperar al fin de mes, y respeta el periodo elegido en Resumen. Suma ventas, gastos y resultado registrado por mes, el mes más fuerte y el más débil, comparaciones entre meses, el promedio por día cerrado, el día de la semana que más vendes y el producto estrella; el PDF tiene varias páginas. La cuota de referencia sigue necesitando un mes completo. Es una referencia, no una aprobación ni una calificación: la entidad decide con su propio análisis, y el código no reemplaza su verificación. Se comparte solo si la persona lo decide. |
| Asistente (Preguntarle a mis datos) | Pregunta con sus palabras ("¿qué día me va peor?"). Con internet, la app calcula la cifra, un modelo la redacta con un tono cercano y también puede conversar sobre el negocio. **Sin internet responde solo las preguntas predefinidas**, con la etiqueta "Sin internet". Ver [El chat](#el-chat-preguntarle-a-mis-datos). |
| Datos de ejemplo              | Se cargan y se **borran** desde Perfil → Borrar datos, para probar la app sin registrar nada propio.                                                            |

La interfaz usa React Native Elements con un tema propio y las fuentes Inter (cuerpo y montos) y Outfit (títulos).

No es un score que decide créditos. Las reglas son aritmética sobre lo que él registró y cada una se puede explicar línea por línea.

### Capturas

Las capturas de pantalla están en la presentación del proyecto; este repositorio no las incluye.

## Cómo correrla

### Requisitos

- Node 22.11 o superior y npm.
- Para iOS: Xcode, CocoaPods (por ejemplo con Homebrew) y un simulador o un iPhone. El mínimo es iOS 15.1.
- Para Android: JDK 17, Android SDK (Android Studio) y la variable `ANDROID_HOME`. El mínimo es Android 7 (API 24).
- `setup-rn-env.sh` configura `JAVA_HOME` y `ANDROID_HOME` en las máquinas de laboratorio con Windows y Git Bash (`source setup-rn-env.sh`).

### Desarrollo

```sh
npm install
cd ios && pod install && cd ..
npm start            # Metro, en una terminal
npm run ios          # en otra: abre el simulador de iOS
npm run android      # o un emulador o teléfono Android conectado
```

Si cambias `babel.config.js`, `tsconfig.json` o la configuración de Metro, reinícialo con `npm start -- --reset-cache`.

### Build Release en un iPhone por cable

La versión Release lleva el JavaScript adentro: abre sin Mac ni internet. Se usó así:

1. Abre `ios/CuadramosApp.xcworkspace` en Xcode y, en Signing & Capabilities, elige tu propio equipo de firma.
2. Compila con `xcodebuild -workspace CuadramosApp.xcworkspace -scheme CuadramosApp -configuration Release -destination id=<ID_DEL_IPHONE> -derivedDataPath build/DerivedDevice -allowProvisioningUpdates build`, desde `ios/`.
3. Busca el identificador del teléfono con `xcrun devicectl list devices`.
4. Instala con `xcrun devicectl device install app --device <ID_DEL_IPHONE> build/DerivedDevice/Build/Products/Release-iphoneos/CuadramosApp.app`.

Con una cuenta gratuita de Apple, la app instalada **dura 7 días**; después hay que reinstalarla por cable.

### APK de Android

```sh
cd android
./gradlew assembleRelease
```

Necesita `ANDROID_HOME` y JDK 17. El APK queda en `android/app/build/outputs/apk/release/`. Está firmado con la clave de depuración de la plantilla: sirve para instalarlo a mano, no para publicarlo en una tienda.

El nombre que ve la persona es **Crecemos**. Los identificadores nativos conservan el nombre anterior del proyecto (`CuadramosApp`).

## El chat "Preguntarle a mis datos"

Es una función **opcional**: la app entera funciona sin ella. Se abre desde la pestaña **Asistente** y le permite a Freddy escribir o tocar una pregunta ("¿cuánto vendí ayer?", "¿qué día me va peor?", "¿cuánto me deben?").

- **Con internet, en capas.** Un modelo entiende la pregunta (a cuál de catorce preguntas conocidas se refiere) y, en algunas respuestas, puede valorarla con un semáforo (Bien, Ojo, Urgente). La app calcula la cifra. Otro modelo escribe esa respuesta con un tono cercano, teniendo en cuenta lo último que se habló. Si la pregunta no encaja en ninguna conocida (o es un saludo), ese modelo conversa sobre el negocio usando solo un resumen de totales que arma la app.
- **Las cifras las calcula siempre la app, no los modelos, y la app las vigila.** Si un texto de un modelo cambia, quita o inventa una cifra (o, al conversar, usa una que no está en el resumen), se descarta y se muestra la frase fija de la app o un mensaje amable. Los comentarios o consejos en palabras no se pueden comprobar de la misma forma: son sugerencias, no seguridades.
- **Sin internet responde solo lo predefinido.** Las preguntas que la app reconoce con claridad (las sugeridas y otras parecidas) se responden con su frase fija, sin semáforo y con una etiqueta visible "Sin internet". Todo lo demás (saludos, preguntas libres) pide conectarse. La app no se bloquea ni muestra errores técnicos.
- **Qué viaja y qué no.** Abrir la pantalla o escribir no manda nada; con red, cada petición sale al tocar "Preguntar". Viaja el texto de la pregunta. Para redactar y conversar viajan además lo último que se habló (hasta cuatro intervenciones) y, según el caso, la respuesta ya calculada (que puede incluir el total de un día concreto) o un resumen con totales por mes y por producto, el mejor y el peor día, el ciclo actual y hoy. Para el semáforo, la respuesta calculada y señales de una palabra. **Nunca** viajan el nombre, el negocio, la foto, el Yape, la ubicación, el monto ni la fecha de lo que te deben, ni un cierre suelto. La pantalla avisa de esto al abrirse. La conversación **solo vive en memoria**: no se guarda en el teléfono y se pierde al cerrar la app.
- **Puede tardar unos segundos.** Con internet, una pregunta hace de una a tres llamadas seguidas; si se alarga, la pantalla lo dice.
- **La clave del proveedor no está en la app ni en el repositorio.** La app habla con un servidor intermedio propio (un Cloudflare Worker, en `servidor/`) que guarda la clave como secreto y reenvía lo mínimo a un proveedor de modelos (OpenRouter). El servidor valida el tamaño de lo que recibe y limita las peticiones por dirección IP. El endpoint es público: la protección de MVP es ese límite y un tope de gasto en la clave; una autenticación real queda fuera.
- **Las dos únicas direcciones de red de la app** son `src/services/seed.ts` (los datos de ejemplo) y `src/services/jev.ts` (este chat). La dirección del servidor está en `src/config.ts`.
- **Los modelos los alojan terceros.** Se restringe a proveedores de EE. UU. y se pide que no guarden ni entrenen con los datos; eso reduce el riesgo pero no lo elimina.

Para usar tu propio servidor, sigue los pasos de [`servidor/README.md`](servidor/README.md): publicar el Worker (`npx wrangler deploy`), guardar la clave como secreto (`npx wrangler secret put OPENROUTER_API_KEY`) y poner su dirección en `src/config.ts`.

## Datos de ejemplo

Una instalación nueva empieza con el catálogo vacío. Si la persona toca **«Cargar datos de ejemplo»**, la app descarga `seed/semilla.json` desde GitHub (unos 34 KB, 75 cierres de día en unos 90 días, con 4 productos). Su dirección está en `src/config.ts`.

- Sin señal, abre vacía y ofrece reintentar la carga voluntaria. Nunca muestra un error técnico.
- **Para volver a empezar la demostración:** Perfil → «Borrar datos» → «Borrar datos de ejemplo» y, cuando no queda nada, «Cargar datos de ejemplo». Borrar quita solo lo marcado como ejemplo (días y productos); los datos propios, la meta «Mi cuota» y los yapes anotados no se tocan, y cargar el ejemplo no crea ni meta ni yapes.
- No reemplaza productos ni cierres propios. Las instalaciones anteriores conservan su catálogo y sus importes históricos.
- Las fechas se corren para que cada cierre caiga en el mismo día de la semana en que se pensó, sea cual sea el día en que se abre la app.
- Se regenera con `npm run semilla`. Es determinista: el mismo comando da siempre los mismos bytes.

**Las cifras de la semilla son supuestos, no datos reales de nadie.** Los precios y costos de los productos tampoco están confirmados con el vendedor.

## Qué se construyó

| Sprint | Entregó                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 01     | Flujo mínimo: cerrar el día por porciones e Inicio con "Te queda".                                                           |
| 02     | Perfil desde el avatar, cambiar un precio con vigencia (sin reescribir el historial), aviso de precio viejo y datos de Yape. |
| 03     | Historial por día con filtros, editar y borrar un día, ciclos de compra y Resumen con capital y mercadería.                  |
| 04     | Cobros del Yape, datos de ejemplo descargados una sola vez (también sin señal) e Inicio con el ciclo.                        |
| 05     | Motor de decisiones: insight, seis reglas, "Qué me deja cada uno" y comparación entre ciclos.                                |
| 06     | Reporte para el banco con vista previa y compartir, semilla de 75 cierres y documentación de entrega.                        |
| 07     | Foto de perfil desde la galería o la cámara y reporte en PDF de una página para compartir.                                   |
| 08     | El chat "Preguntarle a mis datos": las cifras las calcula la app, el modelo entiende la pregunta y puede juzgarla; servidor propio. |
| 09     | Lenguaje claro, fórmulas explicadas y catálogo configurable; datos de ejemplo voluntarios. |
| 12     | Auditoría: barra de navegación con Cerrar día al centro, Asistente como pestaña (también sin internet), Para mañana, Tu semana, simulador de precio, Mi cuota, Anotar un yape, Cuéntame tu día, recordatorio, pasaporte con cuota de referencia, datos de ejemplo borrables, React Native Elements con Inter y Outfit, cola de escrituras y versión del esquema. |
| 13     | El chat responde "cómo me fue el mes pasado" y "cómo voy este mes", y el servidor da un segundo intento cuando el primer modelo duda. |
| 14     | El asistente vuelve a pensar: un modelo redacta las respuestas y conversa con un resumen de totales, la app vigila cada cifra, y sin internet responde solo lo predefinido. |
| 15     | Resumen con torta de ventas por producto, barras por mes y por producto y últimos días, con un filtro de periodo compartido con Mi reporte; el reporte se puede compartir desde el primer cierre y suma el mes más fuerte y el más débil, comparaciones y el producto estrella, en un PDF de varias páginas. |

Quedan pendientes las compras y los pagos, y una auditoría final que verifica sin agregar funciones.

### Metodología

Se trabajó con **SDD + TDD con compuerta**. Cada sprint tiene un SPEC con escenarios Given-When-Then. Cada escenario tiene su prueba antes que su código. Un sprint no cierra si falla una sola prueba, y la compuerta la corre un rol separado del que construye:

```sh
python3 scripts/gate.py --sprint 09 --e2e "sh scripts/e2e.sh 09"
```

El trabajo lo ejecutaron agentes de desarrollo bajo reglas de proyecto escritas. Los SPEC y la memoria del proyecto no se publican en este repositorio, así que la compuerta completa necesita esa carpeta; las pruebas sí corren con solo clonar.

## Cómo probarla

```sh
npm test
npx tsc --noEmit
npm run lint
```

En una máquina cargada (por ejemplo, con el simulador encendido) las pruebas de interfaz pueden agotar el tiempo por lentitud, no por un error. En ese caso:

```sh
npx jest --runInBand --testTimeout=120000
```

| Qué                             | Dónde                              | Qué cubre                                                                                                                        |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Escenarios del SPEC             | `__tests__/sdd/sprint-NN.test.ts`  | Un test por escenario Given-When-Then. Los que llevan `e2e` en el nombre montan la app y recorren una pantalla de punta a punta. |
| Dominio y análisis              | `__tests__/*.test.ts`              | Funciones puras: cierre, ciclos, historial, cobros, reglas, señales, semilla.                                                    |
| Repositorio, estado y pantallas | `__tests__/*.test.tsx`             | Guardado en el teléfono, el proveedor de estado y la interfaz.                                                                   |
| Tipos y estilo                  | `tsc`, `eslint`                    | El código compila sin errores de tipo y respeta las reglas de lint.                                                              |
| De punta a punta                | `sh scripts/e2e.sh NN [--android]` | Typecheck, escenarios e2e, bundle de producción de iOS y, con `--android`, el APK release.                                       |

Jest fija la zona horaria a `America/Lima`: la fecha del negocio es la fecha local del teléfono.

## Arquitectura en breve

```
src/
  dominio/      Reglas del negocio y tipos. TypeScript puro, sin React.
  analisis/     Métricas, reglas de decisión, señales del reporte y lógica del chat (intenciones, semáforo, charla). Puro.
  storage/      Repositorio sobre AsyncStorage (guarda en SQLite por dentro): escrituras en cola y versión del esquema.
  context/      Estado de la app: un solo proveedor.
  navigation/   Pestañas y pantallas apiladas.
  screens/      Inicio, Cerrar mi día, Historial, Resumen, Qué me deja cada uno, Mi cuota, Perfil (y sus seis pantallas: Mis datos, Cómo me pagan, Recordatorio diario, Mis productos, Borrar datos y Ayuda), Mi reporte, Asistente.
  hooks/        Derivados compartidos (ciclos), recordatorio, conteo animado y acciones seguras.
  components/   Átomos, moléculas y organismos reutilizables.
  services/     La red (seed.ts y jev.ts), la hoja de compartir, la foto y el PDF.
servidor/       Servidor intermedio del chat (Cloudflare Worker): guarda la clave y reenvía.
  theme/        Colores, espaciado y tipografía.
```

`dominio/` y `analisis/` no importan React ni React Native, y reciben la fecha de hoy como parámetro. Por eso se prueban sin montar nada y sin simular el reloj. La interfaz no calcula: pide el resultado al dominio y lo dibuja. El stack es React Native 0.87, TypeScript, React Navigation 7, React Native Elements 5, AsyncStorage 3, Zod y lucide para los íconos. No hay librerías de gráficos: las barras son `View` de ancho porcentual.

## Privacidad y datos

- Los registros viven en el teléfono, en una base propia de la app. Registrar, ver el historial, calcular recomendaciones y preguntarle al asistente sin internet usan cero bytes de red. El asistente usa internet (si hay) al tocar "Preguntar" y los datos de ejemplo se descargan solo al solicitarlos.
- Nada sale sin una acción explícita. El reporte se comparte con la hoja nativa del teléfono, solo cuando se toca "Compartir reporte", y se ve antes la vista previa.
- El reporte de texto tiene un tope de 2,000 caracteres (la parte del banco ocupa cerca de 1,040; si el historial es largo, salen menos meses). Lleva el nombre y el negocio del perfil, la venta y la ganancia promedio mensual, la constancia de registro, los días registrados por mes y el resumen del periodo elegido (totales por mes, por producto y por día de la semana). **Nunca** lleva el número de Yape, el titular, el parentesco, la ubicación ni el monto de un cierre suelto.
- Sin analítica, sin publicidad, sin reporte de errores y sin cuentas ni inicio de sesión.
- La descarga de la semilla es una petición `GET` sin cuerpo, sin encabezados propios y sin datos de la persona.
- Las peticiones del chat son `POST` al servidor intermedio: el texto de la pregunta y, según el caso, lo último que se habló, una respuesta ya calculada o un resumen de totales; nunca el nombre, el negocio, el Yape ni un cierre suelto. Ver [El chat](#el-chat-preguntarle-a-mis-datos).

## Limitaciones conocidas

| Limitación                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los precios y costos de la semilla son supuestos y no se confirmaron con el vendedor. Cuando se confirmen, se cambian y se corre `npm run semilla`. |
| Los avisos y el recordatorio son **solo dentro de la app**: no hay notificaciones del sistema, así que no suenan con la app cerrada.               |
| La conversación del asistente solo vive en memoria: se pierde al cerrar la app.                                                                     |
| La cuota de referencia y el código de constancia **no son una aprobación ni una calificación**: la entidad decide con su propio análisis.          |
| El reporte se puede compartir desde el primer cierre, pero la **cuota de referencia** sigue pidiendo al menos un mes completo: antes de eso el reporte lo dice con palabras y trae todo lo demás. El texto compartido se recorta a 2,000 caracteres; el PDF lleva todo. |
| El PDF de varias páginas y el dibujo de la torta se probaron en el simulador y con medidas en un navegador, no en un iPhone ni en un Android reales. El día de la semana que más deja necesita al menos 4 semanas de registro. |
| El asistente reconoce catorce tipos de preguntas con cifras calculadas por la app; lo demás lo conversa un modelo que puede opinar en palabras sin que la app lo compruebe, y puede tardar unos segundos. Sin internet solo responde lo predefinido. Su endpoint es público (con límite por IP y tope de gasto, sin autenticación). |
| iPhone: con la firma gratuita de Apple la app dura 7 días.                                                                                          |
| Android y los iPhone chicos con texto del sistema agrandado **no se probaron en un dispositivo real**; las pruebas automáticas no reemplazan esa revisión. |
| El dinero se calcula en soles con redondeo a 2 decimales en cada total (no en centavos enteros); las pruebas de propiedades vigilan que no aparezcan decimales de más. |
| Con el simulador encendido, las pruebas de interfaz son lentas y pueden agotar el tiempo (ver Cómo probarla).                                       |
| Sin backend ni inicio de sesión, por decisión de diseño. Si se pierde el teléfono, se pierden los datos: no hay respaldo ni importación.            |

Estado del build de Android: se genera el APK release (ver arriba), pendiente de probar en un teléfono físico.

## Autoría

Proyecto académico, React Native Lab, 2026. Repositorio: `JoaquinStudent/crecemos-app`.
