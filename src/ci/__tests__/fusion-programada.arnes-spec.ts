/**
 * Arnés para probar `.github/workflows/fusion-programada.yml` sin tocar GitHub.
 *
 * Extrae el bloque `run:` real del workflow y lo ejecuta con bash, con un `gh` simulado y el `jq` de
 * verdad (así también se prueba el filtro de los PR que se fusionan). Las pruebas están en
 * `../fusion-programada.workflow.spec.ts`.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

export const REPO = 'org/repo';
const RUTA_WORKFLOW = resolve(
  process.cwd(),
  '.github/workflows/fusion-programada.yml',
);

// gh simulado: lee su comportamiento de archivos del escenario y deja cada llamada en llamadas.log.
const GH_SIMULADO =
  [
    '#!/usr/bin/env bash',
    'set -u',
    'echo "$*" >> "${ESCENARIO}/llamadas.log"',
    'sub="$1 $2"',
    'if [ "${sub}" = "pr list" ]; then',
    '  base=""; previo=""',
    '  for argumento in "$@"; do',
    '    if [ "${previo}" = "--base" ]; then base="${argumento}"; fi',
    '    previo="${argumento}"',
    '  done',
    '  if [ "${base}" = "main" ]; then cat "${ESCENARIO}/lista-de-prs.json"; exit 0; fi',
    '  clave="${base//\\//_}"',
    '  if [ -f "${ESCENARIO}/hijos-${clave}.fallo" ]; then exit 1; fi',
    '  if [ -f "${ESCENARIO}/hijos-${clave}" ]; then cat "${ESCENARIO}/hijos-${clave}"; fi',
    '  exit 0',
    'fi',
    'numero="$3"',
    'contar() { c="$(cat "${ESCENARIO}/$1.contador" 2>/dev/null || echo 0)"; echo $((c + 1)) > "${ESCENARIO}/$1.contador"; echo "${c}"; }',
    'case "${sub}" in',
    '  "pr view")',
    '    if [ -f "${ESCENARIO}/ver-${numero}.fallo" ]; then exit 1; fi',
    '    case "$*" in',
    '      *headRefOid*)',
    '        k="$(contar "oid-${numero}")"',
    '        if [ "${k}" = "0" ] || [ -f "${ESCENARIO}/oid-${numero}.nocambia" ]; then echo \'{"headRefOid":"aaa"}\'; else echo \'{"headRefOid":"bbb"}\'; fi ;;',
    '      *statusCheckRollup*)',
    '        k="$(contar "comprobaciones-${numero}")"',
    '        jq -c --argjson k "${k}" \'{statusCheckRollup: .[([$k, (length - 1)] | min)]}\' "${ESCENARIO}/comprobaciones-${numero}.json" ;;',
    '      *) cat "${ESCENARIO}/estado-${numero}" ;;',
    '    esac ;;',
    '  "pr merge") if [ -f "${ESCENARIO}/fusionar-${numero}.fallo" ]; then exit 1; fi ;;',
    '  "pr update-branch") if [ -f "${ESCENARIO}/actualizar-${numero}.fallo" ]; then exit 1; fi ;;',
    '  "workflow run") if [ -f "${ESCENARIO}/lanzar-ci.fallo" ]; then exit 1; fi ;;',
    '  "pr edit") if [ -f "${ESCENARIO}/reapuntar-${numero}.fallo" ]; then exit 1; fi ;;',
    '  "pr comment") ;;',
    '  *) exit 99 ;;',
    'esac',
  ].join('\n') + '\n';

export interface Pr {
  number: number;
  title: string;
  isDraft: boolean;
  reviewDecision: string;
  mergeable: string;
  labels: { name: string }[];
  statusCheckRollup: { conclusion?: string | null; state?: string }[];
  createdAt: string;
  headRefName: string;
}

export interface Escenario {
  prs: Pr[];
  /** Estado de fusión por número de PR; por defecto CLEAN. */
  estados?: Record<number, string>;
  /** Números de los PR apilados sobre cada rama. */
  hijos?: Record<string, number[]>;
  /** Llamadas de gh que deben fallar (nombre del archivo marcador, sin extensión). */
  fallan?: string[];
  soloSimular?: boolean;
  /**
   * Resultado de las comprobaciones de un PR, una por cada vez que el robot las consulta tras actualizar
   * su rama (la última se repite). Por defecto, verde.
   */
  comprobaciones?: Record<number, EstadoComprobaciones[]>;
  /** PR cuya rama no cambia de commit tras `pr update-branch`. */
  sinCommitNuevo?: number[];
  /** Segundos de PRESUPUESTO_SEGUNDOS; por defecto, de sobra. */
  presupuesto?: number;
}

export type EstadoComprobaciones = 'verde' | 'rojo' | 'pendiente';

const COMPROBACION: Record<EstadoComprobaciones, object[]> = {
  verde: [{ conclusion: 'SUCCESS' }],
  rojo: [{ conclusion: 'FAILURE' }],
  pendiente: [{ conclusion: null, status: 'IN_PROGRESS' }],
};

export interface Resultado {
  codigo: number | null;
  llamadas: string[];
  resumen: string;
  salida: string;
}

/** PR listo para fusionar; `cambios` rompe una condición. Los números menores son más antiguos. */
export function pr(numero: number, cambios: Partial<Pr> = {}): Pr {
  return {
    number: numero,
    title: `PR ${numero}`,
    isDraft: false,
    reviewDecision: 'APPROVED',
    mergeable: 'MERGEABLE',
    labels: [],
    statusCheckRollup: [{ conclusion: 'SUCCESS' }],
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, numero)).toISOString(),
    headRefName: `dani/pr-${numero}`,
    ...cambios,
  };
}

const claveDeRama = (rama: string): string => rama.replace(/\//g, '_');

/** Saca el contenido del `run: |` del workflow, sin la sangría del YAML ni retornos de carro. */
function extraerScript(texto: string): string {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const inicio = lineas.findIndex((linea) => /^\s+run: \|\s*$/.test(linea));
  if (inicio === -1)
    throw new Error('No se encontró el bloque `run: |` en el workflow');
  const sangria = (/^\s*/.exec(lineas[inicio])?.[0].length ?? 0) + 2;
  const cuerpo: string[] = [];
  for (const linea of lineas.slice(inicio + 1)) {
    if (linea.trim() !== '' && !linea.startsWith(' '.repeat(sangria))) break;
    cuerpo.push(linea.slice(sangria));
  }
  return cuerpo.join('\n') + '\n';
}

function existe(comando: string): boolean {
  return spawnSync(comando, ['--version'], { stdio: 'ignore' }).status === 0;
}

/**
 * Necesita `bash` y `jq`. En CI (variable CI) nunca se salta: si falta alguno, la prueba debe fallar.
 * En local, sin ellos, las pruebas se saltan. En Windows hace falta Git Bash (no el bash de WSL, que es el
 * que aparece primero en el PATH de PowerShell) y jq instalado (`winget install jqlang.jq`).
 */
export const hayHerramientas =
  (existe('bash') && existe('jq')) || Boolean(process.env.CI);

const carpetas: string[] = [];

export function limpiarEscenarios(): void {
  for (const carpeta of carpetas.splice(0))
    rmSync(carpeta, { recursive: true, force: true });
}

/**
 * En Windows el jq nativo termina cada línea con CRLF y `read` del script recibiría "10\r". Su opción
 * `--binary` lo evita y deja la salida igual que en Linux. En Linux (CI) no hace falta envolverlo.
 */
function envolverJqEnWindows(carpeta: string): void {
  if (process.platform !== 'win32') return;
  const real = spawnSync('bash', ['-c', 'command -v jq'], {
    encoding: 'utf8',
  }).stdout.trim();
  writeFileSync(
    `${carpeta}/bin/jq`,
    `#!/usr/bin/env bash\nexec "${real}" --binary "$@"\n`,
    { mode: 0o755 },
  );
}

function prepararEscenario(escenario: Escenario): string {
  const carpeta = mkdtempSync(join(tmpdir(), 'fusion-programada-')).replace(
    /\\/g,
    '/',
  );
  carpetas.push(carpeta);
  mkdirSync(`${carpeta}/bin`);
  writeFileSync(`${carpeta}/bin/gh`, GH_SIMULADO, { mode: 0o755 });
  envolverJqEnWindows(carpeta);
  writeFileSync(`${carpeta}/lista-de-prs.json`, JSON.stringify(escenario.prs));
  for (const { number } of escenario.prs) {
    writeFileSync(
      `${carpeta}/estado-${number}`,
      escenario.estados?.[number] ?? 'CLEAN',
    );
  }
  for (const [rama, numeros] of Object.entries(escenario.hijos ?? {})) {
    writeFileSync(
      `${carpeta}/hijos-${claveDeRama(rama)}`,
      numeros.join('\n') + '\n',
    );
  }
  for (const { number } of escenario.prs) {
    const secuencia = escenario.comprobaciones?.[number] ?? ['verde'];
    writeFileSync(
      `${carpeta}/comprobaciones-${number}.json`,
      JSON.stringify(secuencia.map((estado) => COMPROBACION[estado])),
    );
  }
  for (const numero of escenario.sinCommitNuevo ?? [])
    writeFileSync(`${carpeta}/oid-${numero}.nocambia`, '');
  for (const marcador of escenario.fallan ?? [])
    writeFileSync(`${carpeta}/${marcador}.fallo`, '');
  writeFileSync(
    `${carpeta}/fusionar.sh`,
    extraerScript(readFileSync(RUTA_WORKFLOW, 'utf8')),
  );
  return carpeta;
}

function leerArchivo(ruta: string): string {
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    return '';
  }
}

export function ejecutar(escenario: Escenario): Resultado {
  const carpeta = prepararEscenario(escenario);
  const proceso = spawnSync('bash', ['fusionar.sh'], {
    cwd: carpeta,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${carpeta}/bin${delimiter}${process.env.PATH ?? ''}`,
      ESCENARIO: carpeta,
      REPO,
      SOLO_SIMULAR: escenario.soloSimular ? 'true' : 'false',
      // Sin esperas reales: 3 consultas del CI sin pausa.
      ESPERA_INTENTOS: '3',
      ESPERA_INTERVALO: '0',
      PRESUPUESTO_SEGUNDOS: String(escenario.presupuesto ?? 100000),
      GITHUB_STEP_SUMMARY: `${carpeta}/resumen.md`,
    },
  });
  return {
    codigo: proceso.status,
    llamadas: leerArchivo(`${carpeta}/llamadas.log`)
      .split('\n')
      .filter(Boolean),
    resumen: leerArchivo(`${carpeta}/resumen.md`),
    salida: `${proceso.stdout}${proceso.stderr}`,
  };
}

export const llamadasA = (resultado: Resultado, subcomando: string): string[] =>
  resultado.llamadas.filter((llamada) => llamada.startsWith(subcomando));

/** Número de PR de cada llamada (`pr merge 10 --repo …` → "10"). */
export const numerosDe = (resultado: Resultado, subcomando: string): string[] =>
  llamadasA(resultado, subcomando).map((llamada) => llamada.split(' ')[2]);
