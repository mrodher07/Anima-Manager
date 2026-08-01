#!/usr/bin/env python3
"""
Extrae el bestiario de *Los que Caminaron con Nosotros* (capítulo 1: Hijos de Gaïa).

Las fichas de criatura siguen un formato muy regular —una etiqueta por línea— así que
esta vez sí se puede automatizar sin adivinar nada:

    Semilla Primigenia
    Nivel: 8
    Clase: Entre mundos 25
    Puntos de Vida: 3.000 (Especial)
    Categoría: Guerrero
    Fue: 15 Des: 6 Agi: 4 Con: 15 Pod: 12 Int: 4 Vol: 10 Per: 10
    RF 95 RM 85 RP 80 RV 95 RE 95
    Turno: 60 Natural
    ...

Aquí **no** hay que usar `-layout`: las fichas van en una sola columna y el texto en flujo
sale mejor. (El Apéndice II sí lo necesita, y por eso va en otro script.)

Uso:
    for f in 623b0dfa d749b72a 2c83cc3c c4e8a847; do
      pdftotext "Los_que_caminaron_*.pdf" lqN.txt
    done
    python3 tools/extraer-bestiario.py lq1.txt lq2.txt lq3.txt lq4.txt
"""
import json, os, re, sys

SALIDA = os.environ.get('OUT_DIR', '/home/user/Anima-Manager/data/los-que-caminaron')

# Las etiquetas de una ficha, en el orden en que suelen aparecer. La clave es cómo se
# guarda; el valor, cómo la escribe el manual (que no siempre respeta las mayúsculas).
ETIQUETAS = {
    'nivel': r'Nivel',
    'clase': r'Clase',
    'puntosVida': r'Puntos de [Vv]ida',
    'categoria': r'Categoría',
    'turno': r'Turno',
    'ataque': r'Habilidad de [Aa]taque',
    'defensa': r'Habilidad de [Dd]efensa',
    'dano': r'Daño',
    'TA': r'TA',
    'ACT': r'ACT',
    'zeon': r'Zeon|Zeón',
    'proyeccionMagica': r'Proyección [Mm]ágica',
    'nivelMagia': r'Nivel de magia|Nivel de Magia',
    'potencialPsiquico': r'Potencial [Pp]síquico',
    'cvLibres': r'CV [Ll]ibres',
    'disciplinas': r'Disciplinas',
    'innatos': r'Innatos',
    'proyeccionPsiquica': r'Proyección [Pp]síquica',
    'ki': r'Ki',
    'acumulacionKi': r'Acumulaciones de Ki',
    'habilidadesKi': r'Habilidades del Ki',
    'tecnicas': r'Técnicas',
    'habilidadesNaturales': r'Habilidades naturales',
    'habilidadesEsenciales': r'Habilidades esenciales',
    'poderes': r'Poderes',
    'tamano': r'Tamaño',
    'movimiento': r'Tipo de movimiento',
    'regeneracion': r'Regeneración',
    'cansancio': r'Cansancio',
    'secundarias': r'Habilidades [Ss]ecundarias',
}
# Cualquier etiqueta corta la anterior.
CORTE = re.compile(r'^(?:' + '|'.join(ETIQUETAS.values()) + r')\s*:', re.M)

CARACTERISTICAS = ['Fue', 'Des', 'Agi', 'Con', 'Pod', 'Int', 'Vol', 'Per']
LINEA_CARS = re.compile(
    r'\b' + r'\s*:\s*(\d+)\D+'.join(CARACTERISTICAS) + r'\s*:\s*(\d+)')
LINEA_RES = re.compile(r'RF\s*(\d+)\D+RM\s*(\d+)\D+RP\s*(\d+)\D+RV\s*(\d+)\D+RE\s*(\d+)')

# Ruido de página que nunca puede ser el nombre de una criatura.
RUIDO = re.compile(
    r'^(\s*'
    r'|[\d\s.]+'
    r'|Ilustrado por.*|Hijos de Gaïa|Los que Caminaron.*|Capítulo.*'
    # Rótulos de prosa que el maquetado deja sueltos entre la ficha y su nombre.
    r'|Modus operandi|Términos de Juego|Poderes|Notas'
    # Líneas de estadísticas: resistencias, características, costes de Técnica.
    r'|.*\bR[FMPVE]\s*\d.*'
    r'|.*\b(AGI|DES|POD|FUE|CON|INT|VOL|PER|Fue|Des|Agi|Con|Pod|Int|Vol|Per)\s*\d.*'
    # Frases: si lleva artículos o preposiciones, es prosa.
    r'|.*\b(el|la|los|las|un|una|de|que|con|por|para|su|sus)\b.*'
    r')$', re.I)

# Un fragmento que empieza en minúscula es un corte de palabra, no un nombre. Va aparte
# porque RUIDO lleva `re.I` y ahí un rango [a-z] casaría también con las mayúsculas.
EMPIEZA_MINUSCULA = re.compile(r'^[a-záéíóúñ]')


def espaciado(linea):
    """
    Encabezados decorativos con las letras separadas: «A l t o s E l e m e n ta l e s».
    Se reconocen porque casi todos sus «palabras» son de una sola letra.
    """
    trozos = linea.split()
    return len(trozos) >= 4 and sum(len(t) == 1 for t in trozos) > len(trozos) / 2

# Las Técnicas de Ki también empiezan por «Nivel: N», pero les sigue «CM:». No son fichas.
ES_TECNICA = re.compile(r'^Nivel\s*:\s*\d+\s*\n\s*CM\s*:', re.M)

# Muchas criaturas traen variantes bajo un encabezado común (Balzak → Guerrero y
# Sacerdote; Hormiga Roja → Obrera y Guerrera). El subtítulo solo no identifica nada, así
# que se sigue subiendo hasta el nombre de verdad y se juntan: «Balzak (Guerrero)».
VARIANTE = re.compile(
    r'^(Menor|Mayor|Superior|Guerrero|Guerrera|Obrera|Sacerdote|Arcano|Reina|Macho|Hembra|'
    r'Primera|Segunda|Tercera|Cuarta|Quinta)$', re.I)


def limpiar(texto):
    """Junta las líneas partidas y quita los saltos sobrantes."""
    t = re.sub(r'-\n(?=[a-záéíóúñ])', '', texto)          # guiones de corte
    t = re.sub(r'\n(?=[a-záéíóúñ,;)])', ' ', t)           # frase que sigue abajo
    return re.sub(r'[ \t]+', ' ', t)


def nombre_antes(texto, pos):
    """
    El nombre de la ficha es la última línea limpia antes de «Nivel:». Si esa línea es un
    subtítulo de variante, se sigue subiendo hasta el nombre de la criatura y se juntan.
    """
    candidatos = []
    for linea in reversed(texto[max(0, pos - 1200):pos].split('\n')):
        s = linea.strip()
        if not s or RUIDO.match(s) or espaciado(s) or EMPIEZA_MINUSCULA.match(s):
            continue
        if len(s) > 46 or ':' in s:
            continue
        if s.endswith(('.', ',')):
            continue
        candidatos.append(s)
        # Con el subtítulo hay que seguir; con un nombre de verdad, ya está.
        if not VARIANTE.match(s):
            break
    if not candidatos:
        return None
    if len(candidatos) == 1:
        return candidatos[0]
    # `candidatos` va de dentro hacia fuera: [variante, …, nombre].
    nombre, *variantes = reversed(candidatos)
    return f'{nombre} ({", ".join(variantes)})' if variantes else nombre


def extraer_ficha(bloque):
    """Convierte el texto de una ficha en un diccionario de campos."""
    ficha = {}
    marcas = [(m.start(), m.group(0).rstrip(':').strip()) for m in CORTE.finditer(bloque)]
    for i, (ini, etiqueta) in enumerate(marcas):
        fin = marcas[i + 1][0] if i + 1 < len(marcas) else len(bloque)
        valor = bloque[ini:fin].split(':', 1)[1].strip().rstrip('.').strip()
        clave = next((k for k, patron in ETIQUETAS.items()
                      if re.fullmatch(patron, etiqueta)), None)
        # Una etiqueta repetida no pisa a la primera: las fichas no repiten campos, y si
        # pasa es que el bloque se ha comido el principio de la siguiente criatura.
        if clave and clave not in ficha and valor:
            ficha[clave] = re.sub(r'\s+', ' ', valor)

    m = LINEA_CARS.search(bloque)
    if m:
        ficha['caracteristicas'] = dict(zip(CARACTERISTICAS, map(int, m.groups())))
    m = LINEA_RES.search(bloque)
    if m:
        ficha['resistencias'] = dict(zip(['RF', 'RM', 'RP', 'RV', 'RE'], map(int, m.groups())))
    return ficha


def extraer(texto):
    texto = limpiar(texto)
    fichas = []
    for m in re.finditer(r'^Nivel\s*:\s*\d+\s*$', texto, re.M):
        # Las Técnicas de Ki empiezan igual pero siguen con «CM:».
        if ES_TECNICA.match(texto[m.start():m.start() + 60]):
            continue
        nombre = nombre_antes(texto, m.start())
        if not nombre:
            continue
        # La ficha llega hasta que empieza la prosa: se corta en la última etiqueta
        # conocida que haya en los siguientes 3.000 caracteres.
        bloque = texto[m.start():m.start() + 3000]
        etiquetas = list(CORTE.finditer(bloque))
        if etiquetas:
            ultimo = etiquetas[-1]
            fin = bloque.find('\n\n', ultimo.end())
            bloque = bloque[: fin if fin > 0 else len(bloque)]
        ficha = extraer_ficha(bloque)
        if 'nivel' in ficha and ('caracteristicas' in ficha or 'ataque' in ficha):
            fichas.append({'criatura': nombre, **ficha})
    return fichas


todas = []
for ruta in (sys.argv[1:] or ['lq1.txt', 'lq2.txt', 'lq3.txt', 'lq4.txt']):
    encontradas = extraer(open(ruta, encoding='utf-8').read())
    print(f'{os.path.basename(ruta):10} {len(encontradas):3} fichas')
    todas += encontradas

# Un mismo ser puede tener varias fichas (jerarquías de demonios, grados de dragón); lo
# que no puede es repetirse el nombre, así que se numeran las coincidencias.
vistos = {}
for f in todas:
    n = f['criatura']
    vistos[n] = vistos.get(n, 0) + 1
    if vistos[n] > 1:
        f['criatura'] = f'{n} ({vistos[n]})'

todas.sort(key=lambda f: (int(re.sub(r'\D', '', f['nivel']) or 0), f['criatura']))

os.makedirs(SALIDA, exist_ok=True)
destino = os.path.join(SALIDA, 'bestiario.json')
with open(destino, 'w', encoding='utf-8') as fh:
    json.dump(todas, fh, ensure_ascii=False, indent=1)

completas = sum(1 for f in todas if 'caracteristicas' in f and 'resistencias' in f)
print(f'\n{len(todas)} criaturas -> {destino}')
print(f'  con características y resistencias completas: {completas}')
repes = [n for n, v in vistos.items() if v > 1]
if repes:
    print(f'  nombres repetidos y numerados: {", ".join(repes)}')
