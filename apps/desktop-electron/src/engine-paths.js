import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Gömülü 6 motor ve çalışma ortamları (Python, Java 21, MiniZinc) için
 * ASAR dışı kaynak yollarını (paketli EXE vs geliştirme ortamı) çözümler.
 * Sistem PATH'inden bağımsız çalışmayı garanti eder.
 */
export function resolveEmbeddedPaths({ isPackaged = false, resourcesPath = null } = {}) {
  const baseRes = isPackaged && resourcesPath
    ? resourcesPath
    : path.join(DEV_ROOT, 'resources');

  const pythonCandidates = [
    path.join(baseRes, 'runtime', 'python', 'python.exe'),
    path.join(baseRes, 'runtime', 'python', 'bin', 'python3'),
    path.join(DEV_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(DEV_ROOT, '.venv', 'bin', 'python3')
  ];

  const javaCandidates = [
    path.join(baseRes, 'runtime', 'java', 'bin', 'java.exe'),
    path.join(baseRes, 'runtime', 'java', 'bin', 'java')
  ];

  const minizincCandidates = [
    path.join(baseRes, 'engines', 'minizinc', 'minizinc.exe'),
    path.join(baseRes, 'engines', 'minizinc', 'bin', 'minizinc')
  ];

  const firstExisting = list => list.find(p => fs.existsSync(p)) || list[0];

  return {
    baseResourcesDir: baseRes,
    pythonBin: firstExisting(pythonCandidates),
    javaBin: firstExisting(javaCandidates),
    minizincBin: firstExisting(minizincCandidates),
    timefoldJar: path.join(baseRes, 'engines', 'timefold', 'evrakplus-timefold.jar'),
    chocoJar: path.join(baseRes, 'engines', 'choco', 'evrakplus-choco.jar'),
    licensesFile: path.join(baseRes, 'licenses', 'LICENSES.md'),
    existence: {
      python: pythonCandidates.some(p => fs.existsSync(p)),
      java: javaCandidates.some(p => fs.existsSync(p)),
      minizinc: minizincCandidates.some(p => fs.existsSync(p)),
      timefoldJar: fs.existsSync(path.join(baseRes, 'engines', 'timefold', 'evrakplus-timefold.jar')),
      chocoJar: fs.existsSync(path.join(baseRes, 'engines', 'choco', 'evrakplus-choco.jar'))
    }
  };
}
