// scripts/android.js
const { spawn, spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';

const commandExists = command => {
  const checker = isWindows ? 'where' : 'which';
  return spawnSync(checker, [command], { stdio: 'ignore' }).status === 0;
};

/** Devuelve los teléfonos físicos conectados por USB (ignora emuladores) */
const getPhysicalDevices = () => {
  const result = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  if (result.status !== 0) return [];

  return result.stdout
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(line => line.endsWith('\tdevice'))
    .map(line => line.split('\t')[0])
    .filter(id => !id.startsWith('emulator-'));
};

const startScrcpy = () => {
  if (!commandExists('scrcpy')) {
    console.log('ℹ️  scrcpy no está instalado, se omite la duplicación de pantalla.');
    return;
  }

  if (!commandExists('adb')) {
    console.log('ℹ️  adb no está en el PATH, no se puede iniciar scrcpy.');
    return;
  }

  const [device] = getPhysicalDevices();
  if (!device) {
    console.log('ℹ️  No hay un teléfono conectado por USB, se omite scrcpy.');
    return;
  }

  console.log(`📱 Iniciando scrcpy en ${device}...`);
  const scrcpy = spawn(
    'scrcpy',
    ['--serial', device, '--stay-awake', '--window-title', 'CuadramosApp'],
    { detached: true, stdio: 'ignore', shell: isWindows, windowsHide: true },
  );
  scrcpy.unref();
};

startScrcpy();

// Pasa cualquier argumento extra a run-android (por ejemplo --mode release)
const args = process.argv.slice(2);
const build = spawn('npx', ['react-native', 'run-android', ...args], {
  stdio: 'inherit',
  shell: isWindows,
});

build.on('exit', code => process.exit(code ?? 0));