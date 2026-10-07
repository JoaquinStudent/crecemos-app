module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    '@babel/plugin-transform-export-namespace-from',
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@theme': './src/theme',
          '@components': './src/components',
          '@context': './src/context',
          '@utils': './src/utils',
          '@validations': './src/validations',
          '@services': './src/services',
          '@hooks': './src/hooks',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@storage': './src/storage',
          '@types': './src/types',
        },
      },
    ],
  ],
};
