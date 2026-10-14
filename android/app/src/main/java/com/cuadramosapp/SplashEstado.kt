package com.cuadramosapp

import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * Cuándo se puede quitar el splash nativo. Se retiene hasta que JS pinta el mismo logo
 * (SplashAnimado llama a `SplashNativo.ocultar()`): así no hay un parpadeo vacío entre el splash
 * del sistema y la app. Si JS nunca avisa (error al cargar), el tope lo suelta igual.
 */
object SplashEstado {
  /** Si JS no avisa en este tiempo, el splash se suelta solo: nunca deja la app trabada. */
  private const val TOPE_MS = 6000L

  @Volatile var listo = false

  fun armarTope() {
    Handler(Looper.getMainLooper()).postDelayed({ listo = true }, TOPE_MS)
  }
}

class SplashNativoModule(contexto: ReactApplicationContext) : ReactContextBaseJavaModule(contexto) {
  // El nombre es el que lee JS en NativeModules (la Nueva Arquitectura no quita prefijos).
  override fun getName(): String = "SplashNativo"

  @ReactMethod
  fun ocultar() {
    SplashEstado.listo = true
  }
}

class SplashNativoPackage : ReactPackage {
  override fun createNativeModules(contexto: ReactApplicationContext): List<NativeModule> =
      listOf(SplashNativoModule(contexto))

  override fun createViewManagers(contexto: ReactApplicationContext): List<ViewManager<*, *>> =
      emptyList()
}
