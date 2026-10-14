Copia de `@react-native-voice/voice` (MIT, wenkesj) v3.2.4, solo la parte Android.
Su `build.gradle` es de 2019 (jcenter, sin namespace ni compileSdk) y no compila con AGP 9, así que
se desactiva el autolinking en `react-native.config.js` y estas dos clases se compilan con la app.
El JS sigue viniendo del paquete de npm. Lo registra `MainApplication.kt`.

Cambio respecto al original: `VoiceModule.getName()` devuelve "Voice" (antes "RCTVoice"). La librería lee
`NativeModules.Voice`; el puente viejo quitaba el prefijo "RCT" y la New Architecture no, así que
sin este cambio `NativeModules.Voice` es null y el botón Hablar no aparece.
