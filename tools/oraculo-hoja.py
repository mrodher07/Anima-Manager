#!/usr/bin/env python3
"""
La hoja de cálculo de la comunidad como oráculo.

Abre `tools/ficha.xlsm` (la ficha vacía, v8.7.0) en LibreOffice **sin macros**, rellena en
ella cada personaje de `data/pruebas/escenarios.json` tal y como lo rellenaría un jugador,
deja que la hoja calcule y guarda lo que sale en `data/pruebas/hoja-v870.json`.

Así la comparación no depende de lo que alguien haya transcrito a mano: los números son los
de la propia hoja. `src/motor/hojaV870.test.ts` compara después la aplicación con ellos.

Con `--armas` hace lo mismo con las armas: empuña en la hoja cada arma del catálogo (a una
y a dos manos, con calidad, con cada munición, con y sin su Ars Magnus, las naturales de
cada raza…) y guarda lo que sale en `data/pruebas/hoja-v870-armas.json`, que compara
`src/motor/hojaV870Armas.test.ts`. Tarda un cuarto de hora.

Necesita LibreOffice Calc y su módulo de Python (`uno`). El .xlsm no va en el repositorio.

    python3 tools/oraculo-hoja.py
    python3 tools/oraculo-hoja.py --armas
"""
import json, os, subprocess, sys, time

import uno
from com.sun.star.beans import PropertyValue

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHA = os.path.join(RAIZ, 'tools', 'ficha.xlsm')
ESCENARIOS = os.path.join(RAIZ, 'data', 'pruebas', 'escenarios.json')
SALIDA = os.path.join(RAIZ, 'data', 'pruebas', 'hoja-v870.json')
PUERTO = 2083

# ── Dónde se escribe cada cosa ──────────────────────────────────────────────

CARACTERISTICAS = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL']
FILA_CARACTERISTICA = {c: 11 + i for i, c in enumerate(CARACTERISTICAS)}  # Principal!E11:E18

# Primarias: la columna M es la de la primera categoría (PDs!L22 = Categoría_1).
FILA_PRIMARIA = {
    'HAtaque': 25, 'HParada': 26, 'HEsquiva': 27, 'LlevarArmadura': 28,
    'KiAGI': 30, 'KiCON': 31, 'KiDES': 32, 'KiFUE': 33, 'KiPOD': 34, 'KiVOL': 35,
    'AcumKiAGI': 36, 'AcumKiCON': 37, 'AcumKiDES': 38, 'AcumKiFUE': 39, 'AcumKiPOD': 40, 'AcumKiVOL': 41,
    'CM': 42, 'Zeon': 93, 'ACT': 94, 'ProyeccionMagica': 96, 'NivelMagia': 97,
    'Convocar': 98, 'Controlar': 99, 'Atar': 100, 'Desconvocar': 101,
    'CV': 111, 'ProyeccionPsiquica': 112,
}

# Secundarias: PDs!K es la primera categoría; Principal!Q el total con la armadura.
SECUNDARIAS = [
    'Acrobacias', 'Atletismo', 'Montar', 'Nadar', 'Trepar', 'Saltar', 'Pilotar',
    'Estilo', 'Intimidar', 'Liderazgo', 'Persuasión', 'Comercio', 'Callejeo', 'Etiqueta',
    'Advertir', 'Buscar', 'Rastrear',
    'Animales', 'Ciencia', 'Ley', 'Herbolaria', 'Historia', 'Táctica', 'Medicina', 'Memorizar',
    'Navegación', 'Ocultismo', 'Tasación', 'Valoración Mágica',
    'Frialdad', 'Proezas de Fuerza', 'Resistencia al Dolor',
    'Cerrajería', 'Disfraz', 'Ocultarse', 'Robo', 'Sigilo', 'Trampería', 'Venenos',
    'Arte', 'Baile', 'Forja', 'Runas', 'Alquimia', 'Animismo', 'Música', 'Trucos de Manos',
    'Caligrafía ritual', 'Orfebrería', 'Confección', 'Confección de marionetas',
]
FILA_SECUNDARIA_PD = {n: 129 + i for i, n in enumerate(SECUNDARIAS)}
FILA_SECUNDARIA_TOTAL = {n: 22 + i for i, n in enumerate(SECUNDARIAS)}

# Las casillas de ventajas y desventajas de la pestaña Principal. Tablas!G cuenta las
# ventajas en C35:J47 y C48:F49, y las desventajas sólo en las tres de C51:F53.
CASILLAS_VENTAJA = [f'C{r}' for r in range(35, 50)] + [f'G{r}' for r in range(35, 48)]
CASILLAS_DESVENTAJA = ['C51', 'C52', 'C53']

# Personalización: qué habilidad lleva cada ventaja de secundaria (tres casillas por fila).
FILA_MATERIA = {
    'Apto en una materia (1)': 11, 'Apto en una materia (2)': 12,
    'Aprendizaje innato (1)': 13, 'Aprendizaje innato (2)': 14, 'Aprendizaje innato (3)': 15,
}
# La pestaña Personalización usa los nombres cortos de la hoja.
NOMBRE_CORTO = {
    'Táctica': 'Tactica', 'Valoración Mágica': 'V. Mágica', 'Proezas de Fuerza': 'P. Fuerza',
    'Resistencia al Dolor': 'Res. Dolor', 'Trucos de Manos': 'T. Manos',
    'Confección de marionetas': 'Conf. marionetas',
}

# ── Qué se lee ──────────────────────────────────────────────────────────────

LECTURAS = {
    'PV': ('Principal', 'N11'), 'Cansancio': ('Principal', 'N16'),
    'Turno': ('Principal', 'D31'), 'Presencia': ('Principal', 'J57'),
    'RF': ('Principal', 'J58'), 'RE': ('Principal', 'J59'), 'RV': ('Principal', 'J60'),
    'RM': ('Principal', 'J61'), 'RP': ('Principal', 'J62'),
    'Tamaño': ('Principal', 'K6'), 'Regeneración': ('Principal', 'J11'),
    'Movimiento': ('Principal', 'J16'),
    'HAtaque': ('PDs', 'AA25'), 'HParada': ('PDs', 'AA26'), 'HEsquiva': ('PDs', 'AA27'),
    'LlevarArmadura': ('PDs', 'AA28'), 'CM': ('PDs', 'AA42'),
    'Zeon': ('PDs', 'AA93'), 'ACT': ('PDs', 'AA94'), 'ProyeccionMagica': ('PDs', 'AA96'),
    'NivelMagia': ('PDs', 'AA97'),
    'Convocar': ('PDs', 'AA98'), 'Controlar': ('PDs', 'AA99'), 'Atar': ('PDs', 'AA100'),
    'Desconvocar': ('PDs', 'AA101'),
    'CV': ('PDs', 'AA111'), 'ProyeccionPsiquica': ('PDs', 'AA112'),
    'PotencialPsiquico': ('Psíquicos', 'H11'),
    'Ki': ('Ki', 'F24'),
    'PenalizadorNatural': ('Combate', 'S17'),
    'PenalizadorAccionFisica': ('Combate', 'S16'),
    'Requisito': ('Combate', 'H16'),
}
for c in CARACTERISTICAS:
    LECTURAS[f'{c} total'] = ('Principal', f'G{FILA_CARACTERISTICA[c]}')
    LECTURAS[f'{c} bono'] = ('Principal', f'H{FILA_CARACTERISTICA[c]}')
for n, f in FILA_SECUNDARIA_TOTAL.items():
    LECTURAS[f'· {n}'] = ('Principal', f'Q{f}')
for i, t in enumerate(['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE']):
    LECTURAS[f'TA {t}'] = ('Combate', f'{"IJKLMNO"[i]}16')
for c, f in zip(['AGI', 'CON', 'DES', 'FUE', 'POD', 'VOL'], [12, 14, 16, 18, 20, 22]):
    LECTURAS[f'Acumulación {c}'] = ('Ki', f'D{f}')
LECTURAS['Regeneración zeónica'] = ('Místicos', 'J9')
# La primera arma: Combate!E28 el arma, C28 cómo se empuña, F29 su tamaño; H29:L29 lo que sale.
LECTURAS.update({
    'Arma turno': ('Combate', 'H29'), 'Arma ataque': ('Combate', 'I29'),
    'Arma defensa': ('Combate', 'J29'), 'Arma daño': ('Combate', 'L29'),
})


def prop(nombre, valor):
    p = PropertyValue()
    p.Name = nombre
    p.Value = valor
    return p


def arrancar(perfil):
    proc = subprocess.Popen(
        ['soffice', '--headless', '--invisible', '--norestore', '--nologo',
         f'-env:UserInstallation={uno.systemPathToFileUrl(perfil)}',
         f'--accept=socket,host=127.0.0.1,port={PUERTO};urp;'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    for _ in range(90):
        try:
            return proc, resolver.resolve(
                f'uno:socket,host=127.0.0.1,port={PUERTO};urp;StarOffice.ComponentContext')
        except Exception:
            time.sleep(1)
    proc.terminate()
    raise RuntimeError('LibreOffice no arranca')


class Hoja:
    def __init__(self, ctx):
        desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
        # MacroExecutionMode 0: NEVER_EXECUTE. La hoja trae VBA y aquí no hace falta.
        self.doc = desktop.loadComponentFromURL(
            uno.systemPathToFileUrl(FICHA), '_blank', 0,
            (prop('Hidden', True), prop('MacroExecutionMode', 0)))
        self.escritas = []

    def celda(self, hoja, ref):
        return self.doc.Sheets.getByName(hoja).getCellRangeByName(ref)

    def poner(self, hoja, ref, valor):
        c = self.celda(hoja, ref)
        self.escritas.append((hoja, ref, c.getFormula()))
        if isinstance(valor, (int, float)) and not isinstance(valor, bool):
            c.setValue(valor)
        else:
            c.setString(str(valor))

    def limpiar(self):
        for hoja, ref, antes in reversed(self.escritas):
            self.celda(hoja, ref).setFormula(antes)
        self.escritas = []

    def leer(self, hoja, ref):
        c = self.celda(hoja, ref)
        if c.getError() != 0:
            return None
        texto = c.getString()
        tipo = c.getType().value
        if tipo == 'EMPTY':
            return None
        if tipo == 'TEXT':
            return texto
        try:
            float(texto.replace(',', '.'))
            v = c.getValue()
            return int(v) if v == int(v) else v
        except ValueError:
            return texto


def rellenar(h, e):
    # En la hoja un Nephilim es un Humano con la casilla «Nephilim» puesta (`General!J23`).
    if e['raza'].startswith('Nephilim'):
        h.poner('General', 'F23', 'Humano')
        h.poner('General', 'J23', e['raza'])
    else:
        h.poner('General', 'F23', e['raza'])
    h.poner('General', 'F24', e.get('sexo', 'Hombre'))
    h.poner('PDs', 'O7', e['categoria'])
    h.poner('PDs', 'S7', e.get('nivel', 1))
    for c, v in e['caracteristicas'].items():
        h.poner('Principal', f'E{FILA_CARACTERISTICA[c]}', v)
    for casilla, v in zip(CASILLAS_VENTAJA, e.get('ventajas', [])):
        h.poner('Principal', casilla, v)
    for casilla, v in zip(CASILLAS_DESVENTAJA, e.get('desventajas', [])):
        h.poner('Principal', casilla, v)
    for clave, pd in e.get('pd', {}).items():
        if clave in FILA_PRIMARIA:
            h.poner('PDs', f'M{FILA_PRIMARIA[clave]}', pd)
        else:
            h.poner('PDs', f'K{FILA_SECUNDARIA_PD[clave]}', pd)
    for n in e.get('naturales', []):
        h.poner('PDs', f'X{FILA_SECUNDARIA_PD[n]}', 1)
    for n, veces in e.get('bonosNaturales', {}).items():
        h.poner('PDs', f'W{FILA_SECUNDARIA_PD[n]}', veces)
    for n, v in e.get('especiales', {}).items():
        if n in FILA_PRIMARIA:
            h.poner('PDs', f'Z{FILA_PRIMARIA[n]}', v)
        else:
            h.poner('PDs', f'Z{FILA_SECUNDARIA_PD[n]}', v)
    for ventaja, habilidades in e.get('materias', {}).items():
        for col, n in zip('LNP', habilidades):
            h.poner('Personalización', f'{col}{FILA_MATERIA[ventaja]}', NOMBRE_CORTO.get(n, n))
    for fila, pieza in zip((12, 13, 14), e.get('armadura', [])):
        h.poner('Combate', f'C{fila}', pieza['armadura'])
        if pieza.get('calidad'):
            h.poner('Combate', f'H{fila}', pieza['calidad'])
    # El estado de juego que la hoja también tiene en cuenta: Cansancio y PV actuales.
    estado = e.get('estado', {})
    if 'cansancioActual' in estado:
        h.poner('Principal', 'P16', estado['cansancioActual'])
    if 'pvActuales' in estado:
        h.poner('Principal', 'P11', estado['pvActuales'])
    for arma in e.get('armas', [])[:1]:
        h.poner('Combate', 'E28', arma['arma'])
        h.poner('Combate', 'C28', 'A dos manos' if arma.get('aDosManos') else 'A una mano')
        h.poner('Combate', 'F29', arma.get('escala', 'Normal'))
        # El arma desarrollada: sin ella la hoja la trata como desconocida.
        h.poner('Principal', 'F31', arma['arma'])
    if e.get('yelmo'):
        h.poner('Combate', 'C15', e['yelmo']['yelmo'])
        if e['yelmo'].get('calidad'):
            h.poner('Combate', 'H15', e['yelmo']['calidad'])
    # Las casillas de raza de la pestaña Personalización.
    o = e.get('opcionesRaza', {})
    si = lambda v: 'Sí' if v else 'No'
    if o.get('extasis'):
        h.poner('Personalización', 'G45', f"+1 {o['extasis']}")
    for ref, clave in (('G46', 'extasisActivo'), ('G47', 'nocturno'), ('G48', 'bienAlimentado')):
        if clave in o:
            h.poner('Personalización', ref, si(o[clave]))
    if o.get('sueAman'):
        h.poner('Personalización', 'E50', 'Cumplido')
    if o.get('trascendido'):
        h.poner('Personalización', 'E52', 'Sí')
    if 'transformado' in o:
        h.poner('Personalización', 'L50', si(o['transformado']))
    for ref, c in (('N49', 'FUE'), ('O49', 'DES'), ('P49', 'AGI'), ('Q49', 'PER')):
        if o.get('transformacion', {}).get(c):
            h.poner('Personalización', ref, f"+{o['transformacion'][c]} {c}")
    if o.get('faseLunar'):
        h.poner('Personalización', 'P50', o['faseLunar'])
    for ref, rasgo in zip(('C40', 'C41', 'C42'), o.get('cercaniaDragon', [])):
        h.poner('Personalización', ref, rasgo)


# Todas las armas del catálogo, una a una, en el mismo personaje: lo que sale en la hoja.
# FUE, DES y POD con bonos distintos (+20, +5, +10) para que se note cuál suma cada arma.
PERSONAJE_ARMAS = {
    'id': 'armas', 'raza': 'Humano', 'categoria': 'Guerrero', 'nivel': 1,
    'caracteristicas': {'AGI': 9, 'CON': 8, 'DES': 7, 'FUE': 11, 'INT': 6, 'PER': 6, 'POD': 9, 'VOL': 6},
    'pd': {'HAtaque': 100, 'HParada': 100},
}
SALIDA_ARMAS = os.path.join(RAIZ, 'data', 'pruebas', 'hoja-v870-armas.json')

# Dónde está cada cosa en el hueco 1 (cuerpo a cuerpo) y en el 7 (proyectiles).
HUECO_ARMA = {
    1: {'arma': 'E28', 'manos': 'C28', 'escala': 'F29', 'calidad': 'J31'},
    7: {'arma': 'E49', 'manos': 'C49', 'escala': 'F51', 'calidad': 'J52',
        'municion': 'E50', 'calidadMunicion': 'J53'},
}
LECTURAS_ARMA = {
    1: {'turno': 'H29', 'ataque': 'I29', 'defensa': 'J29', 'tipoDefensa': 'K29', 'dano': 'L29',
        'conocimiento': 'C29', 'critico1': 'C31', 'critico2': 'D31',
        'entereza': 'E31', 'rotura': 'F31', 'presencia': 'G31'},
    7: {'turno': 'H50', 'ataque': 'I50', 'defensa': 'J50', 'tipoDefensa': 'K50', 'dano': 'L50',
        'conocimiento': 'C51', 'critico1': 'C53', 'critico2': 'D53'},
}
# Las habilidades del Ki que tocan al arma: se marcan en la columna Q de la pestaña Ki.
FILA_KI = {'Extensión del aura al arma': 36, 'Daño incrementado': 38}
RAZAS_ARMAS_NATURALES = ['Humano', 'Ebudan', 'Tuan Dalyr', 'Turak', 'Daimah', 'Jayán', 'Nephilim Turak']


def casos_armas(catalogo):
    """Cada caso: un personaje (el de arriba con cambios), un arma en un hueco y su nombre."""
    base = PERSONAJE_ARMAS
    for a in catalogo:
        for manos in (False, True):
            for calidad in (0, 5):
                yield (f"{a['arma']} · {'A dos manos' if manos else 'A una mano'} · +{calidad}", base,
                       {'hueco': 1, 'arma': a['arma'], 'aDosManos': manos, 'calidad': calidad})
        if a.get('requiereArsMagnus'):
            for manos in (False, True):
                yield (f"{a['arma']} · {'A dos manos' if manos else 'A una mano'} · con Ars Magnus",
                       {**base, 'arsMagnus': a['requiereArsMagnus'][:1]},
                       {'hueco': 1, 'arma': a['arma'], 'aDosManos': manos, 'calidad': 0})
        for m in a.get('municiones', []):
            for manos in (False, True):
                for calidad, cal_m in ((0, 0), (5, 10)):
                    yield (f"{a['arma']} con {m} · {'A dos manos' if manos else 'A una mano'} · +{calidad}/+{cal_m}",
                           base, {'hueco': 7, 'arma': a['arma'], 'aDosManos': manos, 'calidad': calidad,
                                  'municion': m, 'calidadMunicion': cal_m})
    # Las Armas naturales de cada raza, y con un Tamaño grande (el daño del Jayán va con él).
    for raza in RAZAS_ARMAS_NATURALES:
        for fue_con in ((11, 8), (13, 12)):
            car = {**base['caracteristicas'], 'FUE': fue_con[0], 'CON': fue_con[1]}
            yield (f'Armas naturales · {raza} · FUE {fue_con[0]} CON {fue_con[1]}',
                   {**base, 'raza': raza, 'caracteristicas': car},
                   {'hueco': 1, 'arma': 'Armas naturales', 'aDosManos': False, 'calidad': 0})
    yield ('Armas naturales · Legado de Sangre', {**base, 'ventajas': ['Armas Naturales (1)']},
           {'hueco': 1, 'arma': 'Armas naturales', 'aDosManos': False, 'calidad': 0})
    # Enormes y Gigantes, con un Tamaño que no llega y con uno que sí.
    for escala in ('Enorme', 'Gigante'):
        for raza, fue, con in (('Humano', 11, 8), ('Jayán', 15, 15)):
            car = {**base['caracteristicas'], 'FUE': fue, 'CON': con}
            for arma in ('Espada larga', 'Mandoble', 'Hacha a dos manos'):
                if not any(a['arma'] == arma for a in catalogo):
                    continue
                yield (f'{arma} {escala} · {raza} FUE {fue} CON {con}',
                       {**base, 'raza': raza, 'caracteristicas': car},
                       {'hueco': 1, 'arma': arma, 'aDosManos': True, 'calidad': 0, 'escala': escala})
    # El Ki que suma al arma.
    for arma in ('Espada larga', 'Ballesta'):
        yield (f'{arma} · Daño incrementado y Extensión del aura al arma',
               {**base, 'ki': list(FILA_KI)},
               {'hueco': 1, 'arma': arma, 'aDosManos': False, 'calidad': 0})


def armas(h):
    catalogo = json.load(open(os.path.join(RAIZ, 'data', 'reglas', 'armas.json'), encoding='utf-8'))
    resultados = {}
    for n, (clave, personaje, arma) in enumerate(casos_armas(catalogo)):
        rellenar(h, personaje)
        for i, ars in enumerate(personaje.get('arsMagnus', [])):
            h.poner('PDs', f'E{81 + i}', ars)
        for hab in personaje.get('ki', []):
            h.poner('Ki', f'Q{FILA_KI[hab]}', 1)
        hueco = HUECO_ARMA[arma['hueco']]
        h.poner('Combate', hueco['arma'], arma['arma'])
        h.poner('Combate', hueco['manos'], 'A dos manos' if arma['aDosManos'] else 'A una mano')
        h.poner('Combate', hueco['escala'], arma.get('escala', 'Normal'))
        if arma.get('calidad'):
            h.poner('Combate', hueco['calidad'], arma['calidad'])
        if arma.get('municion'):
            h.poner('Combate', hueco['municion'], arma['municion'])
            if arma.get('calidadMunicion'):
                h.poner('Combate', hueco['calidadMunicion'], arma['calidadMunicion'])
        # El arma desarrollada: la que la hoja da por Conocida.
        h.poner('Principal', 'F31', arma['arma'])
        h.doc.calculateAll()
        resultados[clave] = {
            'personaje': {k: v for k, v in personaje.items() if k != 'id'} if personaje is not PERSONAJE_ARMAS else None,
            'arma': arma,
            'hoja': {k: h.leer('Combate', ref) for k, ref in LECTURAS_ARMA[arma['hueco']].items()},
        }
        if resultados[clave]['personaje'] is None:
            del resultados[clave]['personaje']
        h.limpiar()
        if n % 50 == 0:
            print(f'· {n} {clave}', file=sys.stderr)
    return resultados


def main():
    if '--armas' in sys.argv:
        perfil = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'oraculo-libreoffice')
        proc, ctx = arrancar(perfil)
        try:
            h = Hoja(ctx)
            resultados = armas(h)
            h.doc.close(True)
        finally:
            proc.terminate()
        with open(SALIDA_ARMAS, 'w', encoding='utf-8') as f:
            json.dump({'_nota': 'Cada arma del catálogo empuñada en la hoja v8.7.0 por el mismo guerrero '
                                '(FUE 11, DES 7, POD 9), a una y a dos manos, con y sin calidad; las de '
                                'proyectiles con cada munición; las del Zodiaco con su Ars Magnus; las '
                                'Armas naturales de cada raza. «personaje» es lo que cambia respecto al '
                                'guerrero. Calculado con tools/oraculo-hoja.py --armas; no editar a mano.',
                       'personaje': PERSONAJE_ARMAS, 'armas': resultados}, f, ensure_ascii=False, indent=1)
            f.write('\n')
        return
    escenarios = json.load(open(ESCENARIOS, encoding='utf-8'))
    perfil = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'oraculo-libreoffice')
    proc, ctx = arrancar(perfil)
    try:
        h = Hoja(ctx)
        resultados = {}
        for e in escenarios:
            rellenar(h, e)
            h.doc.calculateAll()
            resultados[e['id']] = {k: h.leer(*donde) for k, donde in LECTURAS.items()}
            h.limpiar()
            print(f"· {e['id']}", file=sys.stderr)
        h.doc.close(True)
    finally:
        proc.terminate()
    salida = {
        '_nota': 'Calculado por la propia hoja (Ficha_Anima_v8.7.0.xlsm) con tools/oraculo-hoja.py. '
                 'No editar a mano: se regenera.',
        'escenarios': resultados,
    }
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
