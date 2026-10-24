#!/usr/bin/env python3
"""Arma supabase/rodar.sql (instalación completa) concatenando los archivos de sql/ en orden.
Uso:  python3 tools/build_sql.py          # escribe supabase/rodar.sql
      python3 tools/build_sql.py --check  # falla si supabase/rodar.sql no está al día
Los archivos se ordenan por nombre y a cada función plpgsql se le agrega "#variable_conflict use_variable". 20_cambios.sql es una versión vieja de 20_mejoras_viajes.sql y no se incluye."""
import pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
EXCLUIR = {"20_cambios.sql"}
CABECERA = ("-- Remises TOQUE! · Central de despacho — instalación completa para Supabase\n"
            "-- Pegá TODO este archivo en Supabase → SQL Editor → Run. Se puede volver a correr: no borra datos.\n\n")

# En las funciones plpgsql, si un parámetro se llama igual que una columna, gana el parámetro (lo que esperan los archivos de sql/)
PLPGSQL = re.compile(r"(language plpgsql\b[^$;]*?\bas \$\$)", re.I)
def variable_conflict(sql):
    return PLPGSQL.sub(lambda m: m.group(1) + "\n#variable_conflict use_variable\n", sql)

def armar(hasta=None):
    partes = [CABECERA]
    for f in sorted((RAIZ / "sql").glob("*.sql")):
        if f.name in EXCLUIR or (hasta and f.name > hasta):
            continue
        partes.append(f"-- ======== {f.name} ========\n{variable_conflict(f.read_text(encoding='utf-8'))}\n\n")
    return "".join(partes).rstrip("\n") + "\n"

if __name__ == "__main__":
    destino = RAIZ / "supabase" / "rodar.sql"
    nuevo = armar()
    if "--check" in sys.argv:
        ok = destino.exists() and destino.read_text(encoding="utf-8") == nuevo
        print("supabase/rodar.sql al día" if ok else "supabase/rodar.sql DESACTUALIZADO: corré python3 tools/build_sql.py")
        sys.exit(0 if ok else 1)
    destino.write_text(nuevo, encoding="utf-8")
    print(f"Escrito {destino.relative_to(RAIZ)} ({nuevo.count(chr(10))} líneas)")
