module.exports = {
  // Fuentes (Inter y Outfit, licencia OFL) que 'npx react-native-asset' enlaza en Android e iOS.
  assets: ['./assets/fonts'],
  // @react-native-voice/voice: su build.gradle no compila con AGP 9. Sus clases Java van copiadas en
  // android/app/src/main/java/com/wenkesj/voice y MainApplication las registra a mano.
  dependencies: {
    '@react-native-voice/voice': { platforms: { android: null } },
  },
};
