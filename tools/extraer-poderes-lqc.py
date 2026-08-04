#!/usr/bin/env python3
"""
Poderes de criatura del capítulo 3 de *Los que Caminaron con Nosotros*.

El capítulo va **a dos columnas**, y ahí `pdftotext -layout` no sirve tal cual: mezcla las
filas de una tabla con la prosa de al lado. La solución es recortar cada columna por
separado con `-x/-W`, que es lo que hace este script.

Aun así el recorte deja pasar restos de la columna vecina al principio de la línea («tos»,
«ue,», «e9»), y esos restos rompen la detección de encabezados: un poder cuyo título va
precedido de un resto ya no parece ir «después de una línea en blanco». Por eso los
encabezados **no** se detectan por la línea anterior, sino por su firma propia: un título
corto seguido de un párrafo sangrado y largo.

Uso:
    python3 tools/extraer-poderes-lqc.py <ruta al PDF de páginas 151-191>
"""

import json
import re
import subprocess
import sys
from collections import Counter

# El PDF de esa parte empieza en la página 151 del manual.
DESFASE = 148
PRIMERA, ULTIMA = 172, 183  # capítulo 3

FILA = re.compile(r'^\s{0,20}(\S.*?)\s{2,}(-?\d+)\s{2,}(\d+)\s*$')
CABECERA_TABLA = re.compile(r'\s{2,}Coste\s{2,}GN\s*$')
ENCABEZADO = re.compile(r"^\s{1,14}([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'/ ]{3,45})\s*$")
SECCION = re.compile(r'^(PODERES DE [A-ZÁÉÍÓÚÑ ]+|HABILIDADES\s*ESENCIALES|OTROS PODERES)$')
ETIQUETAS = {
    'prohibiciones', 'efecto', 'coste', 'ninguna', 'gn', 'especial', 'requisitos',
    'habilidades esenciales', 'poderes de combate',
}


def limpia(linea: str) -> str:
    """Quita el resto de la columna vecina que se cuela al principio."""
    return re.sub(r'^\s{0,8}\S{1,6}\s{4,}', '    ', linea)


def columnas(pdf: str) -> list[str]:
    salida = []
    for pagina in range(PRIMERA - DESFASE, ULTIMA - DESFASE + 1):
        for x, w in ((0, 300), (295, 305)):
            salida.append(subprocess.run(
                ['pdftotext', '-f', str(pagina), '-l', str(pagina), '-layout',
                 '-x', str(x), '-y', '0', '-W', str(w), '-H', '900', pdf, '-'],
                capture_output=True, text=True, check=True,
            ).stdout)
    return '\n'.join(salida).split('\n')


def extraer(lineas: list[str]) -> list[dict]:
    filas, poder, seccion = [], None, None
    for i, cruda in enumerate(lineas):
        l = limpia(cruda)
        siguiente = limpia(lineas[i + 1]) if i + 1 < len(lineas) else ''

        s = SECCION.match(l.strip())
        if s:
            seccion = ' '.join(s.group(1).split()).title()
            continue
        if CABECERA_TABLA.search(l):
            continue

        m = ENCABEZADO.match(l)
        if m:
            cand = ' '.join(m.group(1).split())
            parrafo = bool(re.match(r'^\s{2,}\S', siguiente)) and len(siguiente.strip()) > 40
            if cand.lower() not in ETIQUETAS and parrafo and not re.search(r'Capítulo|Ilustrad', cand):
                poder = cand
                continue

        f = FILA.match(l)
        if not f:
            continue
        opcion = f.group(1).strip()
        if not opcion or len(opcion) > 70 or opcion.lower() in ETIQUETAS:
            continue
        nombre = poder if opcion.lower() == (poder or '').lower() else f'{poder} ({opcion})'
        filas.append({
            'nombre': nombre,
            'gnosis': int(f.group(3)),
            'coste': int(f.group(2)),
            '_seccion': seccion or 'Poderes de Combate',
        })
    return filas


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    filas = extraer(columnas(sys.argv[1]))

    repes = [n for n, c in Counter(f['nombre'] for f in filas).items() if c > 1]
    if repes:
        print(f'AVISO: nombres repetidos: {repes}', file=sys.stderr)

    # Contrastes contra el manual: si alguno falla, la detección de encabezados se ha roto
    # otra vez y las opciones estarán colgando del poder equivocado.
    esperado = {'Escudo (': 8, 'Ataque Retardado (': 4, 'Ataque Especial Incrementado (': 5}
    for prefijo, n in esperado.items():
        real = sum(1 for f in filas if f['nombre'].startswith(prefijo))
        estado = 'ok' if real == n else 'MAL'
        print(f'  {prefijo[:-2]:32} {real}/{n} {estado}', file=sys.stderr)

    destino = 'data/los-que-caminaron/poderesCriatura.json'
    with open(destino, 'w', encoding='utf-8') as fh:
        json.dump(filas, fh, ensure_ascii=False, indent=1)
    print(f'{len(filas)} entradas → {destino}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
