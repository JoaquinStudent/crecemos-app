#!/bin/bash
# ============================================================
# setup-rn-env.sh
# Configura JAVA_HOME y ANDROID_HOME para React Native en
# máquinas de laboratorio (Windows + Git Bash).
#
# IMPORTANTE: correr con "source", no ejecutar directamente,
# para que las variables queden activas en la terminal actual:
#
#   source setup-rn-env.sh
#
# Requisitos previos en la máquina:
#   - Android SDK ya instalado por Android Studio en la ruta
#     por defecto ($HOME/AppData/Local/Android/Sdk)
# ============================================================

echo "🔧 Configurando entorno de React Native..."

# --- JAVA_HOME ---
JDK_PATH="$HOME/jdk-17"
JDK_ZIP="$HOME/jdk-17-temp.zip"
# Microsoft Build of OpenJDK 17 (validado: descarga ~178MB, funciona sin bloqueos)
JDK_DOWNLOAD_URL="https://aka.ms/download-jdk/microsoft-jdk-17.0.20.1-windows-x64.zip"

if [ -f "$JDK_PATH/bin/java.exe" ]; then
  echo "✅ JDK 17 ya está presente en $JDK_PATH"
else
  echo "⬇️  No se encontró JDK 17 en $JDK_PATH — descargando desde Microsoft Build of OpenJDK..."
  echo "   (esto puede tardar 1-2 minutos según la conexión del lab)"

  curl -fL -o "$JDK_ZIP" "$JDK_DOWNLOAD_URL" 2>/dev/null
  if [ ! -f "$JDK_ZIP" ] || [ ! -s "$JDK_ZIP" ]; then
    if [ -f "/c/Windows/System32/curl.exe" ]; then
      echo "   (usando curl.exe del sistema)"
      /c/Windows/System32/curl.exe -L -o "$JDK_ZIP" "$JDK_DOWNLOAD_URL"
    else
      echo "   curl no disponible, usando PowerShell (Invoke-WebRequest)..."
      powershell -Command "Invoke-WebRequest -Uri '$JDK_DOWNLOAD_URL' -OutFile '$JDK_ZIP'"
    fi
  fi

  if [ -f "$JDK_ZIP" ]; then
    DOWNLOAD_TMP="$HOME/.jdk17_tmp_extract"
    rm -rf "$DOWNLOAD_TMP"
    mkdir -p "$DOWNLOAD_TMP"
    unzip -q "$JDK_ZIP" -d "$DOWNLOAD_TMP"
    # -mindepth 1 evita que encuentre la propia carpeta temporal como resultado
    EXTRACTED_DIR=$(find "$DOWNLOAD_TMP" -mindepth 1 -maxdepth 1 -type d -name "jdk-17*" | head -1)
    if [ -n "$EXTRACTED_DIR" ]; then
      rm -rf "$JDK_PATH"
      mv "$EXTRACTED_DIR" "$JDK_PATH"
      rm -rf "$DOWNLOAD_TMP" "$JDK_ZIP"
      echo "✅ JDK 17 (Microsoft Build of OpenJDK) descargado e instalado en $JDK_PATH"
    else
      echo "❌ No se pudo encontrar la carpeta extraída. Revisa $DOWNLOAD_TMP manualmente."
    fi
  else
    echo "❌ La descarga falló. Si el lab bloquea aka.ms/download-jdk (poco común),"
    echo "   descarga el ZIP manualmente desde https://learn.microsoft.com/java/openjdk/download"
    echo "   y descomprímelo en: $JDK_PATH"
  fi
fi

if [ -f "$JDK_PATH/bin/java.exe" ]; then
  export JAVA_HOME="$JDK_PATH"
  export PATH="$JAVA_HOME/bin:$PATH"
  echo "✅ JAVA_HOME configurado: $JAVA_HOME"
fi

# --- ANDROID_HOME ---
SDK_PATH="$HOME/AppData/Local/Android/Sdk"

if [ -d "$SDK_PATH" ]; then
  export ANDROID_HOME="$SDK_PATH"
  export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
  echo "✅ ANDROID_HOME configurado: $ANDROID_HOME"
else
  echo "⚠️  No se encontró el Android SDK en $SDK_PATH"
  echo "   Verifica la ruta real en Android Studio > SDK Manager"
  echo "   y edita este script (SDK_PATH) si es distinta."
fi

# --- Limpiar caché de comandos de bash ---
hash -r

# --- Verificación rápida ---
echo ""
echo "📋 Verificación:"
echo "-------------------------------------------"
echo "which java   -> $(which java 2>/dev/null || echo 'NO ENCONTRADO')"
java -version 2>&1 | head -1
echo ""
echo "which adb    -> $(which adb 2>/dev/null || echo 'NO ENCONTRADO')"
echo "-------------------------------------------"
echo ""
echo "👉 Ahora corre: npx react-native doctor"