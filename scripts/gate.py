#!/usr/bin/env python3
"""
Compuerta TDD de cierre de sprint (LEY 2 de /planificacion).

Un sprint NO cierra si una sola de las cinco condiciones falla.
Este script es el arbitro: no opina, ejecuta. Su salida se pega
como evidencia en sdd/spec/Sprint-NN/GATE.md

Adaptado para Crecemos (React Native + Jest):
  - Los SPEC viven en sdd/spec/ en vez de .sprints/ (estructura declarada).
  - El acta se escribe en la carpeta existente del sprint, aunque tenga sufijo
    (por ejemplo sdd/spec/Sprint-07-auditoria/).
  - Los tests se buscan en __tests__/ y src/, no en todo el arbol: recorrer
    node_modules y ios/Pods cuatro veces no aporta nada y tarda.

Uso:
    python3 scripts/gate.py --sprint 01
    python3 scripts/gate.py --sprint 02 --e2e "sh scripts/e2e.sh 02"

Codigos de salida:
    0 -> APROBADO, el sprint puede cerrar
    1 -> RECHAZADO, al menos una condicion fallo
    2 -> Error de configuracion (no se encontro runner o SPECs)
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

GREEN, RED, YELLOW, BOLD, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[1m", "\033[0m"

SPECS_DIR = "sdd/spec"


def c(text, color):
    return f"{color}{text}{RESET}" if sys.stdout.isatty() else text


# --------------------------------------------------------------------------
# Deteccion del runner de tests
# --------------------------------------------------------------------------

def detect_runner(root: Path):
    """Devuelve (nombre, comando) del runner de tests del proyecto."""
    if (root / "pytest.ini").exists() or (root / "pyproject.toml").exists() or list(root.glob("tests/test_*.py")):
        # Siempre "python -m pytest", nunca el binario 'pytest' suelto.
        return "pytest", [sys.executable, "-m", "pytest", "-v", "--tb=short", "-rs"]
    pkg = root / "package.json"
    if pkg.exists():
        try:
            scripts = json.loads(pkg.read_text()).get("scripts", {})
            if "test" in scripts:
                return "npm", ["npm", "test", "--", "--verbose"]
        except Exception:
            pass
    if (root / "go.mod").exists():
        return "go", ["go", "test", "./...", "-v"]
    if (root / "pom.xml").exists():
        return "maven", ["mvn", "-q", "test"]
    if (root / "Cargo.toml").exists():
        return "cargo", ["cargo", "test"]
    return None, None


def purge_caches(root: Path):
    """
    Elimina bytecode y caches de test antes de ejecutar.

    Sin esto la compuerta puede certificar codigo OBSOLETO. Un sprint aprobado
    sobre bytecode viejo es un falso verde, el peor resultado posible.
    """
    purged = 0
    for d in list(root.rglob("__pycache__")) + list(root.rglob(".pytest_cache")):
        if ".venv" in str(d) or "node_modules" in str(d) or "site-packages" in str(d):
            continue
        shutil.rmtree(d, ignore_errors=True)
        purged += 1
    return purged


def run_tests(root: Path):
    name, cmd = detect_runner(root)
    if not cmd:
        return None, None, "No se detecto runner de tests en el proyecto."
    purged = purge_caches(root)
    if purged:
        print(c(f"  Caches purgadas: {purged} (evita certificar bytecode obsoleto)\n", YELLOW))
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    if name == "pytest":
        cmd = cmd + ["-p", "no:cacheprovider"]
    try:
        proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=900, env=env)
        return name, proc, None
    except FileNotFoundError:
        return name, None, f"Runner '{name}' no esta instalado en este entorno."
    except subprocess.TimeoutExpired:
        return name, None, "La suite de tests excedio 15 minutos. Revisa bucles o llamadas de red."


def failed_test_names(runner: str, out: str):
    """Nombres de los tests que fallaron, para distinguir regresion de fallo nuevo."""
    names = []
    if runner == "pytest":
        names += re.findall(r"::(\w+)\s+(?:FAILED|ERROR)", out)
        names += re.findall(r"^(?:FAILED|ERROR)\s+\S+::(\w+)", out, re.M)
    elif runner == "npm":
        names += re.findall(r"[x✕✗]\s+(\w+)", out)
    elif runner == "go":
        names += re.findall(r"^--- FAIL:\s+(\w+)", out, re.M)
    return sorted(set(names))


def check_regression(runner: str, out: str, current_sprint: str):
    """
    Regresion = un test de un sprint ANTERIOR al actual esta fallando.
    Se distingue del fallo nuevo por el prefijo spec<NN> del nombre del test.
    """
    failures = failed_test_names(runner, out)
    if not failures:
        return True, "Ningun test fallando en la suite acumulada", []
    regressions = []
    for name in failures:
        m = re.search(r"spec(\d+)_e\d+", name.lower())
        if m and m.group(1) < current_sprint:
            regressions.append(f"{name} (Sprint-{m.group(1)})")
    if regressions:
        return False, f"{len(regressions)} test(s) de sprints previos rotos: " + ", ".join(regressions[:4]), regressions
    return True, f"Sin regresion: los {len(failures)} fallo(s) son del sprint actual o de sprints futuros (placeholders)", []


def split_future_failures(runner: str, out: str, current_sprint: str):
    """
    Separa los fallos entre 'bloqueantes' (del sprint actual o uno anterior)
    y 'tolerados' (de un sprint FUTURO todavia no abierto).

    LEY 1 (SDD) siembra tests rojos de TODOS los sprints desde el dia uno.
    Sin esta separacion, el Sprint-01 nunca podria aprobar mientras existan
    los placeholders rojos del Sprint-02 en adelante.
    """
    failures = failed_test_names(runner, out)
    blocking, future = [], []
    for name in failures:
        m = re.search(r"spec(\d+)_e\d+", name.lower())
        if m and m.group(1) > current_sprint:
            future.append(name)
        else:
            blocking.append(name)
    return blocking, future


def parse_results(runner: str, out: str):
    """Extrae (pasados, fallidos, saltados) de la salida del runner."""
    passed = failed = skipped = 0
    if runner == "pytest":
        m = re.search(r"(\d+) passed", out);   passed = int(m.group(1)) if m else 0
        for pat in (r"(\d+) failed", r"(\d+) error"):
            m = re.search(pat, out)
            if m:
                failed += int(m.group(1))
        for pat in (r"(\d+) skipped", r"(\d+) xfailed"):
            m = re.search(pat, out)
            if m:
                skipped += int(m.group(1))
    elif runner == "npm":
        m = re.search(r"Tests:.*?(\d+) passed", out, re.S);  passed = int(m.group(1)) if m else 0
        m = re.search(r"Tests:.*?(\d+) failed", out, re.S);  failed = int(m.group(1)) if m else 0
        m = re.search(r"Tests:.*?(\d+) skipped", out, re.S); skipped = int(m.group(1)) if m else 0
    elif runner == "go":
        passed = len(re.findall(r"^--- PASS", out, re.M))
        failed = len(re.findall(r"^--- FAIL", out, re.M))
        skipped = len(re.findall(r"^--- SKIP", out, re.M))
    else:
        failed = 0 if "BUILD SUCCESS" in out or "test result: ok" in out else 1
    return passed, failed, skipped


# --------------------------------------------------------------------------
# Cobertura de escenarios: cada escenario de cada SPEC necesita su test
# --------------------------------------------------------------------------

def collect_scenarios(sprints_dir: Path, upto: str):
    """Escenarios declarados en los SPEC hasta el sprint 'upto' inclusive."""
    scenarios = []
    if not sprints_dir.exists():
        return scenarios
    for spec in sorted(sprints_dir.glob("Sprint-*/SPEC*.md")):
        m = re.search(r"Sprint-(\d+)", str(spec))
        if not m or m.group(1) > upto:
            continue
        sprint_no = m.group(1)
        text = spec.read_text(encoding="utf-8", errors="ignore")
        for head in re.findall(r"^#+\s*Escenario\s+(\d+)", text, re.M):
            scenarios.append((sprint_no, head))
        if not re.search(r"^#+\s*Escenario", text, re.M):
            scenarios.append((sprint_no, "?"))  # SPEC sin escenarios: se reporta
    return scenarios


def collect_test_names(root: Path):
    """
    Recolecta identificadores de tests. En Jest el nombre del test es un
    string, asi que se aceptan dos formas:
      - el string del test:      it('spec01_e2 hace X')
      - un comentario marcador:  // @spec01_e2
    """
    names = []
    patterns = [
        r"(?:def |func )\s*(\w+)",
        r"(?:it|test|describe)\s*\(\s*['\"`]([^'\"`]+)",
        r"@(spec\d+_e\d+)",
    ]
    globs = ("__tests__/**/*.ts", "__tests__/**/*.tsx", "__tests__/**/*.js",
             "src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.py")
    seen = set()
    for pat in globs:
        for f in root.glob(pat):
            if f in seen:
                continue
            seen.add(f)
            try:
                text = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for rx in patterns:
                names += re.findall(rx, text)
    return names


def check_coverage(root: Path, specs_dir: str, upto: str):
    """Cada escenario NN-E necesita un test cuyo nombre contenga spec<NN>_e<E>."""
    scenarios = collect_scenarios(root / specs_dir, upto)
    tests = " ".join(collect_test_names(root)).lower()
    missing, malformed = [], []
    for sprint_no, esc in scenarios:
        if esc == "?":
            malformed.append(f"Sprint-{sprint_no}: SPEC sin escenarios Given-When-Then declarados")
            continue
        if not re.search(rf"spec{sprint_no}_e{esc}\b", tests):
            missing.append(f"SPEC-{sprint_no} Escenario {esc}")
    return scenarios, missing, malformed


# --------------------------------------------------------------------------
# Condicion 5: el entregable corre de punta a punta
# --------------------------------------------------------------------------

def check_e2e(root: Path, cmd: str, sprint: str):
    """
    La tolerancia a N/D solo aplica al Sprint-01. Desde el Sprint-02, no tener
    comando end-to-end significa que nadie integro nada: BLOQUEA.
    """
    if not cmd:
        if sprint == "01":
            return None, "Sprint-01 sin comando e2e: tolerado. Verificacion MANUAL obligatoria en el acta."
        return False, ("Sin comando e2e declarado (--e2e). Desde el Sprint-02 es bloqueante: "
                       "un sprint cerrado sin ejecutar el sistema completo no esta cerrado.")
    try:
        # shell=True a proposito: el comando lo escribe quien corre la compuerta
        # en su propia maquina (ej. "sh scripts/e2e.sh 02"), no viene de afuera.
        p = subprocess.run(cmd, cwd=root, shell=True, capture_output=True, text=True, timeout=600)
        return p.returncode == 0, (p.stdout + p.stderr)[-1500:]
    except subprocess.TimeoutExpired:
        return False, "El comando end-to-end excedio 10 minutos."


# --------------------------------------------------------------------------
# Acta
# --------------------------------------------------------------------------

def sprint_dir(root: Path, specs_dir: str, sprint: str) -> Path:
    """La carpeta existente del sprint, aunque tenga sufijo (Sprint-07-auditoria)."""
    base = root / specs_dir
    existentes = sorted(base.glob(f"Sprint-{sprint}*"))
    return existentes[0] if existentes else base / f"Sprint-{sprint}"


def write_act(root: Path, specs_dir: str, sprint: str, verdict: str, rows, evidence: str):
    d = sprint_dir(root, specs_dir, sprint)
    d.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        f"# GATE.md — Compuerta TDD del Sprint-{sprint}",
        "",
        f"**Ejecutada:** {ts}",
        f"**Veredicto del Supervisor TDD: {verdict}**",
        "",
        "| # | Condicion | Resultado | Detalle |",
        "| --- | --- | --- | --- |",
    ]
    for i, (name, ok, detail) in enumerate(rows, 1):
        mark = "PASA" if ok else ("N/D" if ok is None else "FALLA")
        lines.append(f"| {i} | {name} | **{mark}** | {detail} |")
    lines += [
        "",
        "## Evidencia (salida real del runner)",
        "",
        "```",
        evidence.strip()[-4000:],
        "```",
        "",
        "## Justificacion de tests saltados",
        "",
        "*(Obligatorio si la condicion 4 reporta skips. Sin justificacion escrita, la compuerta es RECHAZADO.)*",
        "",
        "## Verificacion manual",
        "",
        "*(Fecha, quien verifico y resultado. En el Sprint-07, las verificaciones M1 a M8 del SPEC.)*",
        "",
    ]
    if verdict == "RECHAZADO":
        lines += [
            "## Acciones correctivas",
            "",
            "El sprint NO cierra. El siguiente sprint NO se abre.",
            "Prohibido: relajar aserciones, borrar tests, marcarlos skip, o mover la tarea",
            "al siguiente sprint para esquivar el fallo. Se arregla el codigo.",
            "",
        ]
    (d / "GATE.md").write_text("\n".join(lines), encoding="utf-8")
    return d / "GATE.md"


def main():
    ap = argparse.ArgumentParser(description="Compuerta TDD de cierre de sprint")
    ap.add_argument("--sprint", required=True, help="Numero de sprint, ej. 01")
    ap.add_argument("--root", default=".", help="Raiz del proyecto")
    ap.add_argument("--specs", default=SPECS_DIR, help="Carpeta de los SPEC, relativa a la raiz")
    ap.add_argument("--e2e", default="", help="Comando que prueba el flujo de punta a punta")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    sprint = args.sprint.zfill(2)

    print(c(f"\n{'='*66}", BOLD))
    print(c(f"  COMPUERTA TDD — Sprint-{sprint}", BOLD))
    print(c(f"  Un sprint no cierra si una sola condicion falla.", YELLOW))
    print(c(f"{'='*66}\n", BOLD))

    runner, proc, err = run_tests(root)
    if err:
        print(c(f"  ERROR DE CONFIGURACION: {err}", RED))
        print(c("  La compuerta no puede certificar sin ejecutar tests.\n", RED))
        sys.exit(2)

    out = (proc.stdout or "") + (proc.stderr or "")
    passed, failed, skipped = parse_results(runner, out)

    # Si el runner nunca llego a ejecutar una sesion de tests, la salida no
    # trae ningun conteo y todo daria 0. Eso NO es un aprobado.
    if passed + failed + skipped == 0:
        print(c("  ERROR DE CONFIGURACION: el runner no devolvio resultados reconocibles.", RED))
        print(c(f"  ({runner} pudo no haberse ejecutado realmente: revisa la salida cruda)\n", RED))
        print(out[-2000:])
        print(c("\n  La compuerta no puede certificar sin evidencia de una suite ejecutada.\n", RED))
        sys.exit(2)

    scenarios, missing, malformed = check_coverage(root, args.specs, sprint)
    prev_ok, prev_detail, regressions = check_regression(runner, out, sprint)
    blocking_failures, future_failures = split_future_failures(runner, out, sprint)
    e2e_ok, e2e_detail = check_e2e(root, args.e2e, sprint)

    # Un fallo de RECOLECCION (import roto, sintaxis) no trae nombre de test.
    # Sin este chequeo quedaria invisible y produciria un falso APROBADO.
    sin_nombre = max(0, failed - len(blocking_failures) - len(future_failures))

    rows = [
        ("100% de tests pasan (hasta este sprint)",
         len(blocking_failures) == 0 and sin_nombre == 0,
         f"{passed} pasados, {len(blocking_failures)} fallidos bloqueantes (runner: {runner})"
         + (f"; {len(future_failures)} rojo(s) de sprint(s) futuro(s) tolerados (LEY 1: placeholder a proposito)"
            if future_failures else "")
         + (f"; {sin_nombre} fallo(s)/error(es) SIN nombre de test identificable "
            "(posible fallo de recoleccion: import roto o sintaxis) -- revisar la evidencia completa"
            if sin_nombre else "")),
        ("Cobertura de escenarios SPEC",
         len(missing) == 0 and len(malformed) == 0,
         f"{len(scenarios)} escenarios declarados; sin test: {', '.join(missing) if missing else 'ninguno'}"
         + (f"; malformados: {len(malformed)}" if malformed else "")),
        ("Sin regresion en sprints previos",
         prev_ok,
         prev_detail),
        ("Sin tests saltados sin justificar",
         skipped == 0,
         "Ninguno" if skipped == 0 else f"{skipped} saltados — justificar por escrito en GATE.md"),
        ("Entregable corre de punta a punta",
         e2e_ok,
         (e2e_detail or "")[:160]),
    ]

    for i, (name, ok, detail) in enumerate(rows, 1):
        mark = c("PASA ", GREEN) if ok else (c("N/D  ", YELLOW) if ok is None else c("FALLA", RED))
        print(f"  [{i}] {mark}  {name}")
        print(f"        {detail}\n")

    for m in malformed:
        print(c(f"  AVISO: {m}", YELLOW))

    blocking = [r for r in rows if r[1] is False]
    verdict = "APROBADO" if not blocking else "RECHAZADO"

    act = write_act(root, args.specs, sprint, verdict, rows, out)

    print(c("-" * 66, BOLD))
    if verdict == "APROBADO":
        print(c(f"  Supervisor TDD: APROBADO — Sprint-{sprint} puede cerrar.", GREEN))
        if any(r[1] is None for r in rows):
            print(c("  Pendiente: verificacion manual end-to-end, registrala en GATE.md.", YELLOW))
    else:
        print(c(f"  Supervisor TDD: RECHAZADO — Sprint-{sprint} NO cierra.", RED))
        print(c(f"  Condiciones fallidas: {len(blocking)}", RED))
        print(c("  El siguiente sprint NO se abre. Se arregla el codigo,", RED))
        print(c("  no se relaja la compuerta.", RED))
    print(f"\n  Acta: {act}")
    print(c("-" * 66 + "\n", BOLD))

    sys.exit(0 if verdict == "APROBADO" else 1)


if __name__ == "__main__":
    main()
