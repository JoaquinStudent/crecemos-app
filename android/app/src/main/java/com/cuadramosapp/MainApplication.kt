package com.cuadramosapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.wenkesj.voice.VoicePackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Reconocedor de voz de "Cuéntame tu día": ver android/.../wenkesj/voice/LEEME.md.
          add(VoicePackage())
          // Avisa desde JS cuándo quitar el splash nativo (ver SplashEstado.kt).
          add(SplashNativoPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
