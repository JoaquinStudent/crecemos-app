#!/usr/bin/env python3
"""
Lint del PLAN (no del codigo).

gate.py audita la implementacion. Este script audita la planificacion:
incoherencias entre backlog, SPECs, tests, criterios y capacidad.

Se corre al terminar de generar la planificacion y al inicio de cada sprint.

Adaptado para Crecemos:
  - Documentos segun la estructura declarada: sdd/ con AGENTS.md, contexto.md,
    domain.md, api-contracts.md, memory.md, informe-sprints.md y database/.
  - El backlog es sdd/informe-sprints.md; los SPEC viven en sdd/spec/.
  - Tests de Jest en __tests__/.
  - El detector de plantillas sin llenar ignora enlaces Markdown y la palabra
    "todo" en castellano (solo cuenta TODO en mayusculas).

Uso:
    python3 scripts/validate.py
    python3 scripts/validate.py --plazo-min 2640

Codigos de salida:
    0 -> plan coherente (puede haber avisos)
    1 -> incoherencias bloqueantes
"""

import argparse
import re
import sys
from pathlib import Path

GREEN, RED, YELLOW, BOLD, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[1m", "\033[0m"


def c(t, col):
    return f"{col}{t}{RESET}" if sys.stdout.isatty() else t


SPECS_DIR = "sdd/spec"
BACKLOG = "sdd/informe-sprints.md"
CONTEXTO = "sdd/contexto.md"

# Verbos no observables: un Then debe poder verificarse mirando algo concreto.
VAGOS = ["funciona correctamente", "funciona bien", "es correcto", "esta ok",
         "sin problemas", "adecuadamente", "de forma apropiada", "exitosamente",
         "trabaja bien", "responde bien", "todo bien"]

TALLAS = {"S": 30, "M": 60, "L": 120}


def leer(p: Path):
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def specs(root: Path):
    """{ '01': texto } por sprint."""
    out = {}
    for f in sorted((root / SPECS_DIR).glob("Sprint-*/SPEC*.md")):
        m = re.search(r"Sprint-(\d+)", str(f))
        if m:
            out[m.group(1)] = leer(f)
    return out


def escenarios(texto):
    return re.findall(r"^#+\s*Escenario\s+(\d+)\s*[—\-–:]?\s*(.*)$", texto, re.M)


def bloque_escenario(texto, num):
    m = re.search(rf"^#+\s*Escenario\s+{num}\b(.*?)(?=^#+\s|\Z)", texto, re.M | re.S)
    return m.group(1) if m else ""


def test_names(root: Path):
    names = []
    for pat in ("__tests__/**/*.*", "src/**/*.test.*", "tests/**/*.*"):
        for f in root.glob(pat):
            names.append(leer(f))
    return " ".join(names).lower()


def main():
    ap = argparse.ArgumentParser(description="Lint del plan de proyecto")
    ap.add_argument("--root", default=".")
    ap.add_argument("--plazo-min", type=int, default=0,
                    help="Minutos reales disponibles para construir")
    ap.add_argument("--modo", choices=["completo", "ligero"], default="completo")
    args = ap.parse_args()
    root = Path(args.root).resolve()

    errores, avisos = [], []

    print(c(f"\n{'='*66}", BOLD))
    print(c("  LINT DEL PLAN", BOLD))
    print(c("  gate.py audita el codigo. Esto audita la planificacion.", YELLOW))
    print(c(f"{'='*66}\n", BOLD))

    # --- 1. Documentos obligatorios -------------------------------------
    req_completo = ["sdd/AGENTS.md", "sdd/contexto.md", "sdd/domain.md",
                    "sdd/api-contracts.md", "sdd/memory.md", BACKLOG,
                    "sdd/database/esquema.md", "sdd/database/manejo-de-datos.md",
                    "contexto-hack/03-producto/Arquitectura.md"]
    req_ligero = [CONTEXTO, "sdd/api-contracts.md", BACKLOG]
    req = req_ligero if args.modo == "ligero" else req_completo
    faltan = [f for f in req if not (root / f).exists()]
    if faltan:
        errores.append(f"Documentos ausentes: {', '.join(faltan)}")

    # --- 2. Plantillas sin llenar ---------------------------------------
    # [texto] que NO es un enlace Markdown ni una casilla de verificacion.
    marcadores = [(r"\[(?! \]|x\])[^\]\n]{1,40}\](?!\()", 0),
                  (r"\bTODO\b", 0), (r"\bXXX\b", 0),
                  (r"por definir", re.I), (r"completar aqui", re.I)]
    for f in req:
        p = root / f
        if not p.exists():
            continue
        t = leer(p)
        t = re.sub(r"```.*?```", "", t, flags=re.S)  # el codigo de ejemplo no cuenta
        hits = sum(len(re.findall(m, t, fl)) for m, fl in marcadores)
        if hits > 6:
            avisos.append(f"{f}: {hits} marcadores de plantilla sin llenar")

    # --- 3. Backlog: cada sprint tiene SPEC ------------------------------
    backlog = leer(root / BACKLOG)
    sprints_backlog = sorted(set(re.findall(r"Sprint-(\d+)", backlog)))
    sp = specs(root)
    for s in sprints_backlog:
        if s not in sp:
            errores.append(f"Sprint-{s} aparece en el BACKLOG pero no tiene SPEC.md")
    for s in sp:
        if s not in sprints_backlog:
            avisos.append(f"Sprint-{s} tiene SPEC pero no aparece en el BACKLOG")

    # --- 4. SPECs: escenarios presentes y verificables --------------------
    tests = test_names(root)
    for s, texto in sorted(sp.items()):
        escs = escenarios(texto)
        if not escs:
            errores.append(f"SPEC-{s}: sin escenarios Given-When-Then. Un SPEC sin escenarios es una intencion, no un contrato")
            continue
        for num, nombre in escs:
            blk = bloque_escenario(texto, num)
            if not re.search(r"\bGiven\b", blk, re.I) or not re.search(r"\bThen\b", blk, re.I):
                errores.append(f"SPEC-{s} Escenario {num}: falta Given o Then")
            then = re.search(r"Then\s*:?(.*?)(?:\n\s*\n|\Z)", blk, re.I | re.S)
            if then:
                cuerpo = then.group(1).strip().lower()
                if len(cuerpo) < 15:
                    avisos.append(f"SPEC-{s} Escenario {num}: el Then es demasiado corto para ser verificable")
                for v in VAGOS:
                    if v in cuerpo:
                        errores.append(f"SPEC-{s} Escenario {num}: Then no falsable ('{v}'). Debe decir QUE se observa")
                        break
            if not re.search(rf"spec{s}_e{num}\b", tests):
                errores.append(f"SPEC-{s} Escenario {num}: sin test que lo cubra (esperado 'spec{s}_e{num}')")

    # --- 5. Invariantes de forma del plan ---------------------------------
    if sprints_backlog:
        ctx = backlog.lower()
        if not re.search(r"entrega|envio|empaquet|document|publicar|deploy|cierre", ctx):
            errores.append("El ultimo sprint no incluye cierre de entrega. Un proyecto no entregado vale cero")
        primero = sp.get(sprints_backlog[0], "")
        if primero and not re.search(r"punta a punta|end.to.end|end a end|flujo completo|e2e", primero, re.I):
            avisos.append("Sprint-01 no declara un flujo de punta a punta. Si no puede demostrar un recorrido completo, el alcance esta mal cortado")

    # --- 6. Criterios de evaluacion cubiertos -----------------------------
    criterios = set(re.findall(r"\|\s*([ABCD])\s*\|", backlog))
    ctxt = leer(root / CONTEXTO)
    declarados = set(re.findall(r"\*\*([ABCD])\s*[·.\-]", ctxt)) or {"A", "B", "C", "D"}
    sin_cubrir = declarados - criterios
    if sin_cubrir and criterios:
        avisos.append(f"Criterios sin ninguna tarea que los ataque: {', '.join(sorted(sin_cubrir))}")

    # --- 7. Capacidad -----------------------------------------------------
    tallas = re.findall(r"\|\s*([SML])\s*\|", backlog)
    if args.plazo_min:
        if not tallas:
            avisos.append("El BACKLOG no declara tallas (S/M/L). Sin ellas no se puede verificar capacidad")
        else:
            carga = sum(TALLAS[t] for t in tallas)
            n_gates = len(sprints_backlog)
            reserva = n_gates * 15
            disponible = args.plazo_min - reserva
            pct = (carga / disponible * 100) if disponible > 0 else 999
            detalle = f"carga {carga} min vs {disponible} min utiles ({args.plazo_min} - {reserva} de compuertas)"
            if pct > 100:
                errores.append(f"SOBRE-ALCANCE: {detalle} = {pct:.0f}%. Recorta antes de empezar, no a mitad del Sprint-02")
            elif pct > 80:
                avisos.append(f"Capacidad al {pct:.0f}%: {detalle}. Sin margen para imprevistos")
            else:
                print(c(f"  Capacidad: {pct:.0f}% ({detalle})\n", GREEN))

    # --- Reporte ----------------------------------------------------------
    for e in errores:
        print(c(f"  ERROR   {e}", RED))
    for a in avisos:
        print(c(f"  AVISO   {a}", YELLOW))
    if not errores and not avisos:
        print(c("  Plan coherente. Sin incoherencias detectadas.", GREEN))

    print(c("\n" + "-" * 66, BOLD))
    if errores:
        print(c(f"  PLAN RECHAZADO — {len(errores)} incoherencia(s) bloqueante(s), {len(avisos)} aviso(s)", RED))
        print(c("  Corrige el plan antes de abrir el Sprint-01.", RED))
    else:
        print(c(f"  PLAN COHERENTE — {len(avisos)} aviso(s)", GREEN))
    print(c("-" * 66 + "\n", BOLD))
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
