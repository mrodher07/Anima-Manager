#!/usr/bin/env python3
"""
Extrae el Apéndice II de *Los que Caminaron con Nosotros*: qué nivel, qué Gnosis y qué
Sellos de Invocación pide cada criatura.

Completa los Sellos del Dominus Exxet, que dicen cómo se invoca pero no qué pide cada ser.

El apéndice está maquetado a **dos columnas**, así que hay que extraerlo con `-layout`
(sin él, `pdftotext` entrelaza los nombres, los niveles y los Sellos y el resultado es
inservible). Uso:

    pdftotext -layout -f 38 -l 38 "Los_que_caminaron_con_nosotros151191.pdf" apendice2.txt
    python3 tools/extraer-sellos-criaturas.py apendice2.txt

Las tres filas que el maquetado rompe se arreglan a mano y quedan anotadas abajo.
"""
import json, os, re, sys

ENTRADA = sys.argv[1] if len(sys.argv) > 1 else 'apendice2.txt'
SALIDA = os.environ.get('OUT_DIR', '/home/user/Anima-Manager/data/los-que-caminaron')

# Nombre, nivel, Gnosis (que a veces es «Esp.» o un rango como «30/40») y Sellos.
FILA = re.compile(
    r'^(.{3,32}?)\s{1,}(\d{1,2})\s{2,}(\d{1,3}(?:/\d{1,3})?|Esp\.?)\s{2,}(.+?)\s*$')

# La tabla parte en dos columnas; el hueco entre ellas es amplio, salvo cuando los Sellos
# de la izquierda son muy largos. Ahí se corta antes del nombre de la derecha.
CORTE = re.compile(r'\s{8,}(?=[A-ZÁÉÍÓÚÑ])')

# La única fila que el maquetado parte de verdad: su nombre ocupa dos líneas, así que el
# nivel y los Sellos quedan huérfanos en la línea de al lado. Se transcribe del apéndice.
#
# Dementia (Gnosis en rango, «30/40») y Maestro de las Sombras (nombre tan largo que se
# come el hueco antes del nivel) también daban guerra, pero el patrón ya los recoge: se
# comprobó que lo que saca coincide con lo transcrito a mano.
A_MANO = [
    {'criatura': 'Gusanos de las Profundidades', 'nivel': 3, 'gnosis': '0', 'sellos': 'Natural'},
]


def leer(ruta):
    texto = open(ruta, encoding='utf-8').read().replace('\t', '  ')
    # El glosario viene justo detrás y no forma parte de la tabla.
    corte = texto.find('Glosario')
    return texto[:corte] if corte > 0 else texto


def extraer(texto):
    filas, sin_parsear = [], []
    for linea in texto.split('\n'):
        s = linea.strip()
        if not s or 'Nombre' in s or 'Apéndice' in s or 'Niveles y Sellos' in s:
            continue
        if 'Ilustrado por' in s or re.fullmatch(r'[\d\s]+', s):
            continue
        for parte in CORTE.split(s):
            parte = parte.strip()
            if not parte:
                continue
            m = FILA.match(parte)
            if m:
                filas.append({
                    'criatura': m.group(1).strip(),
                    'nivel': int(m.group(2)),
                    'gnosis': m.group(3),
                    'sellos': m.group(4).strip(),
                })
            else:
                sin_parsear.append(parte)
    return filas, sin_parsear


def partir_pegadas(filas):
    """
    Cuando los Sellos de la izquierda son largos, el hueco entre columnas se encoge y la
    fila de la derecha se queda pegada al final de los Sellos. Se separa aquí.
    """
    salida = []
    for f in filas:
        m = re.match(r'^(.+?)\s{2,}([A-ZÁÉÍÓÚÑ].{2,30}?)\s+(\d{1,2})\s+(\d{1,3})\s+(.+)$',
                     f['sellos'])
        if m:
            salida.append({**f, 'sellos': m.group(1).strip()})
            salida.append({'criatura': m.group(2).strip(), 'nivel': int(m.group(3)),
                           'gnosis': m.group(4), 'sellos': m.group(5).strip()})
        else:
            salida.append(f)
    return salida


filas, sin_parsear = extraer(leer(ENTRADA))
filas = partir_pegadas(filas)
filas += A_MANO

# Las que no piden Sellos porque no son invocables llevan el motivo en esa columna.
NO_INVOCABLES = {'Natural', 'No Muerto', 'Creación', 'Creación Mágica', 'NA'}
for f in filas:
    f['invocable'] = f['sellos'] not in NO_INVOCABLES

filas.sort(key=lambda f: (f['nivel'], f['criatura']))

repetidas = [c for c in {f['criatura'] for f in filas}
             if sum(1 for f in filas if f['criatura'] == c) > 1]
if repetidas:
    print('⚠ criaturas repetidas:', repetidas)
raras = [f for f in filas if len(f['sellos']) > 40]
if raras:
    print('⚠ Sellos sospechosamente largos:', [(f['criatura'], f['sellos']) for f in raras])

os.makedirs(SALIDA, exist_ok=True)
destino = os.path.join(SALIDA, 'sellosCriatura.json')
with open(destino, 'w', encoding='utf-8') as fh:
    json.dump(filas, fh, ensure_ascii=False, indent=1)

print(f'{len(filas)} criaturas -> {destino}')
print(f'  invocables con Sellos: {sum(1 for f in filas if f["invocable"])}')
print(f'  líneas descartadas (rótulos y glosario): {len(sin_parsear)}')
