# Crecemos

**Cuadra tu día. Crece tu negocio.**

Crecemos es una app móvil de registro y decisiones para pequeños vendedores informales. Nació de entrevistar a un vendedor real de anticuchos, a quien aquí se llama **Freddy** (sin apellido ni datos de contacto). Es un proyecto académico del React Native Lab de Compartamos Banco × UTP.

## Qué es

### El problema

Freddy compra mercadería cada 2 días y razona por ciclos: "el primer día es para el capital y el segundo es la ganancia". Tres cosas le dolían:

- **No sabe cuánto le queda de verdad.** Todo es memoria, y parte de lo que cobra por Yape entra a una cuenta que no es suya.
- **No sabe qué producto le deja más.** Cree que el que más vende es el que más deja, y no siempre es así.
- **Para el banco, no existe.** Quien evalúa un crédito verifica sus ventas preguntando a los vecinos.

### Qué hace

| Función                       | Qué resuelve                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cerrar mi día                 | Anota las porciones preparadas y las que sobraron por producto, el Yape y los gastos. La app calcula la venta.                                   |
| Te queda, por ciclo de compra | Lo vendido menos lo gastado desde que compró mercadería, con el capital recuperado en una barra.                                                 |
| Historial                     | Un grupo por día, con filtros (ingresos, gastos, por cobrar). Se puede editar o borrar un día sin tocar los precios viejos.                      |
| Cobros del Yape               | Suma lo que entró a una cuenta ajena y falta cobrar, y permite marcarlo como cobrado.                                                            |
| Qué me deja cada uno          | Contrasta lo que más se vende con lo que más deja por porción.                                                                                   |
| Recomendaciones               | Seis reglas fijas (cobro, precio, cuánto preparar, cuánto retirar, día flojo, comparación con el ciclo anterior). Muestra las 2 más importantes. |
| Mi reporte                    | Un reporte con totales para el banco: venta y ganancia promedio mensual, y constancia de registro. Freddy decide si lo comparte.                 |

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

## Datos de ejemplo

La primera vez que abre, si el almacenamiento está vacío, la app descarga **una sola vez** `seed/semilla.json` desde GitHub (unos 34 KB, 75 cierres de día en unos 90 días, con 4 productos). Es la **única llamada de red** de la app y su dirección está en `src/config.ts`.

- Sin señal, abre vacía y ofrece el botón "Cargar datos de ejemplo". Nunca muestra un error técnico.
- Una vez resuelta, no vuelve a pedirla. Un teléfono que ya tiene cierres propios no la descarga.
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

Un séptimo sprint de auditoría estaba planeado para verificar, no para agregar funciones.

### Metodología

Se trabajó con **SDD + TDD con compuerta**. Cada sprint tiene un SPEC con escenarios Given-When-Then. Cada escenario tiene su prueba antes que su código. Un sprint no cierra si falla una sola prueba, y la compuerta la corre un rol separado del que construye:

```sh
python3 scripts/gate.py --sprint 06 --e2e "sh scripts/e2e.sh 06 --android"
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
  analisis/     Métricas, reglas de decisión y señales del reporte. Puro.
  storage/      Repositorio sobre AsyncStorage (guarda en SQLite por dentro).
  context/      Estado de la app: un solo proveedor.
  navigation/   Pestañas y pantallas apiladas.
  screens/      Inicio, Cerrar mi día, Historial, Resumen, Qué me deja cada uno, Perfil, Mi reporte.
  components/   Átomos, moléculas y organismos reutilizables.
  services/     La única red (seed.ts) y la hoja de compartir (compartir.ts).
  theme/        Colores, espaciado y tipografía.
```

`dominio/` y `analisis/` no importan React ni React Native, y reciben la fecha de hoy como parámetro. Por eso se prueban sin montar nada y sin simular el reloj. La interfaz no calcula: pide el resultado al dominio y lo dibuja. El stack es React Native 0.87, TypeScript, React Navigation 7, AsyncStorage 3, Zod y lucide para los íconos. No hay librerías de gráficos: las barras son `View` de ancho porcentual.

## Privacidad y datos

- Todo vive en el teléfono, en una base propia de la app. Registrar, ver el historial y calcular recomendaciones usa cero bytes de red.
- Nada sale sin una acción explícita. El reporte se comparte con la hoja nativa del teléfono, solo cuando se toca "Compartir reporte", y se ve antes la vista previa.
- El reporte es texto plano de unos 500 caracteres (el tope es 2,000). Lleva el nombre y el negocio del perfil, la venta y la ganancia promedio mensual, la constancia de registro y los días registrados por mes. **Nunca** lleva el número de Yape, el titular, el parentesco, la ubicación ni el monto de un cierre suelto.
- Sin analítica, sin publicidad, sin reporte de errores y sin cuentas ni inicio de sesión.
- La descarga de la semilla es una petición `GET` sin cuerpo, sin encabezados propios y sin datos de la persona.

## Limitaciones conocidas

| Limitación                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los precios y costos de la semilla son supuestos y no se confirmaron con el vendedor. Cuando se confirmen, se cambian y se corre `npm run semilla`. |
| No hay foto de perfil: el avatar muestra las iniciales.                                                                                             |
| Solo se puede cambiar el precio de los 4 productos que trae la app; no se pueden agregar productos nuevos.                                          |
| No existe "Anotar un yape" suelto: el Yape se anota al cerrar el día.                                                                               |
| El reporte comparte texto plano con un periodo fijo; no hay PDF ni selector de periodo.                                                             |
| iPhone: con la firma gratuita de Apple la app dura 7 días.                                                                                          |
| No se verificó en un iPhone chico, con el texto del sistema agrandado ni en Android.                                                                |
| La carga automática de datos de ejemplo no está pensada para el teléfono de un usuario real, y falta un "Borrar datos de ejemplo".                  |
| Con el simulador encendido, las pruebas de interfaz son lentas y pueden agotar el tiempo (ver Cómo probarla).                                       |
| Sin backend ni inicio de sesión, por decisión de diseño. Si se pierde el teléfono, se pierden los datos: no hay respaldo ni importación.            |

<!-- ANDROID-ESTADO: pendiente de completar -->

Estado del build de Android: por confirmar.

## Autoría

Proyecto académico, React Native Lab, Compartamos Banco × UTP, 2026. Repositorio: `JoaquinStudent/crecemos-app`.
