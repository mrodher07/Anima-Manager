#!/usr/bin/env python3
"""
Saca las tablas de precios del Capítulo VIII del Core Exxet («Armas y Equipamiento»,
páginas 68–72) y las deja en data/reglas/objetos.json.

El PDF va a dos columnas, así que se recorta cada página por la mitad con `pdftotext
-layout -x`: intentar leer la página entera mezcla las dos tablas que van en paralelo.

    python3 tools/extraer-equipamiento.py <CORE_EXXET51100.pdf>

No inventa nada: lo que no encaja con el formato de fila se queda fuera y se avisa por
la salida de error para poder repasarlo a mano.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

PAGINAS = (21, 22, 23, 24)
ANCHO_COLUMNA = 298

# Cada sección es uno de los rótulos en mayúsculas que centra el manual.
SECCIONES = {
    'VESTIMENTA', 'VIAJES', 'TRANSPORTE', 'COMIDA Y BEBIDA', 'ESTANCIA', 'VIVIENDA',
    'SERVICIOS Y CONTRATAS', 'ARTE Y DECORACIÓN', 'VENENOS', 'ÚTILES VARIOS',
    'ARMAS Y ESCUDOS', 'ARMADURAS',
}

# «5 MP», «1.200 MO», «5/50 MO» (las gemas dan un rango), «x10», «1/2».
MONEDA = r'(?:\d[\d.]*(?:/\d[\d.]*)?\s*M[OPC])'
FILA = re.compile(
    rf'^(?P<nombre>.+?)\s{{2,}}(?P<coste>{MONEDA}|x\d+|1/2)'
    r'(?:\s+(?P<peso>NA|\d+(?:,\d+)?))?'
    r'(?:\s+(?P<disp>[AB]))?\s*$'
)
CABECERA = re.compile(r'^(?P<grupo>.+?)\s{2,}Coste\b')

VALOR_MC = {'MC': 1, 'MP': 10, 'MO': 1000}


def en_cobre(coste: str) -> int | None:
    """Pasa el precio a monedas de cobre para poder ordenar y sumar. 1 MO = 100 MP."""
    m = re.match(rf'^(\d[\d.]*)(?:/\d[\d.]*)?\s*(M[OPC])$', coste)
    if not m:
        return None
    return int(m.group(1).replace('.', '')) * VALOR_MC[m.group(2)]


def columnas(pdf: Path):
    for pagina in PAGINAS:
        for x in (0, ANCHO_COLUMNA):
            texto = subprocess.run(
                ['pdftotext', '-layout', '-f', str(pagina), '-l', str(pagina),
                 '-x', str(x), '-y', '0', '-W', str(ANCHO_COLUMNA), '-H', '800',
                 str(pdf), '-'],
                capture_output=True, text=True, check=True,
            ).stdout
            yield texto.splitlines()


def extraer(pdf: Path):
    objetos = []
    descartadas = []
    # La sección y el grupo se arrastran de una columna a la siguiente: hay tablas que
    # empiezan al final de la columna izquierda y siguen arriba de la derecha, como la
    # orfebrería de la página 70.
    seccion = ''
    grupo = ''
    for lineas in columnas(pdf):
        for linea in lineas:
            limpia = linea.strip()
            if not limpia:
                continue
            if limpia in SECCIONES:
                seccion, grupo = limpia, ''
                continue
            if limpia == 'EQUIPAMIENTO':
                continue
            if limpia == 'Precio':
                # Bloque de multiplicadores por calidad. Va al pie de una columna, pero
                # en el manual se aplica a toda la sección, no sólo a la última tabla.
                grupo = 'Precio por calidad'
                continue
            cabecera = CABECERA.match(linea)
            if cabecera:
                grupo = cabecera.group('grupo').strip()
                continue
            fila = FILA.match(linea)
            if not fila or not seccion:
                # El pie de página y los números sueltos caen aquí; se avisa igualmente.
                if re.search(r'\d', limpia) and len(limpia) > 12:
                    descartadas.append(limpia)
                continue
            peso = fila.group('peso')
            objeto = {
                'objeto': fila.group('nombre').strip(),
                'seccion': seccion,
                'grupo': grupo,
                'coste': fila.group('coste').replace(' ', ' '),
            }
            cobre = en_cobre(objeto['coste'])
            if cobre is not None:
                objeto['costeMC'] = cobre
            if peso and peso != 'NA':
                objeto['peso'] = float(peso.replace(',', '.'))
            if fila.group('disp'):
                objeto['disponibilidad'] = fila.group('disp')
            objetos.append(objeto)
    return objetos, descartadas


def main():
    pdf = Path(sys.argv[1])
    objetos, descartadas = extraer(pdf)
    # Un mismo nombre puede repetirse entre secciones (Arpón es útil y arma): la clave
    # es el nombre, así que se desambigua sólo cuando choca de verdad.
    vistos = {}
    for o in objetos:
        clave = o['objeto']
        if clave in vistos and vistos[clave]['seccion'] != o['seccion']:
            o['objeto'] = f"{clave} ({o['seccion'].lower()})"
        vistos.setdefault(clave, o)
    salida = Path('data/reglas/objetos.json')
    salida.write_text(json.dumps(objetos, ensure_ascii=False, indent=1) + '\n')
    print(f'{len(objetos)} objetos → {salida}')
    if descartadas:
        print(f'{len(descartadas)} líneas sin encajar:', file=sys.stderr)
        for d in descartadas:
            print('  ', d, file=sys.stderr)


if __name__ == '__main__':
    main()
