#!/usr/bin/env python3
"""Extrae las tablas de reglas de la ficha Meirmeister.xlsm a JSON."""
import json, os, warnings
import openpyxl

warnings.filterwarnings('ignore')

SRC = os.path.join(os.path.dirname(__file__), 'ficha.xlsm')
OUT = os.environ.get('OUT_DIR', '/home/user/Anima-Manager/data/reglas')
wb = openpyxl.load_workbook(SRC, data_only=True)


def cells(sheet, ref):
    return wb[sheet][ref.replace('$', '')]


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    if isinstance(v, float) and abs(v - round(v)) < 1e-9:
        return int(round(v))
    return v


def table(sheet, ref, headers, key_idx=0, drop_headings=True):
    """Filas -> dicts. Descarta filas vacías y las cabeceras de sección '> XXX'."""
    rows, section = [], None
    for row in cells(sheet, ref):
        vals = [clean(c.value) for c in row]
        key = vals[key_idx]
        if key is None:
            continue
        if isinstance(key, str) and key.startswith('>'):
            section = key.lstrip('> ').strip()
            if drop_headings:
                continue
        item = {h: v for h, v in zip(headers, vals) if v is not None}
        if section:
            item['_seccion'] = section
        rows.append(item)
    return rows


def matrix(sheet, ref, headers):
    return table(sheet, ref, headers, drop_headings=False)


data = {}

# --- Razas -------------------------------------------------------------
RAZA_H = ['raza', 'RF', 'RE', 'RV', 'RM', 'RP', 'ajusteNivel',
          'AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL',
          'tamano', 'regeneracion', 'cansancio', 'natura', 'descripciones']
data['razas'] = matrix('Tablas', '$J$109:$AC$129', RAZA_H)

# --- Categorías --------------------------------------------------------
CAT_H = ['categoria', 'turno', 'PV', 'costeMultiploPV', 'conocimientoMarcial',
         'limiteCombate', 'limiteMagia', 'limitePsi', 'nvPorCV',
         'bonoHA', 'bonoHP', 'bonoHE', 'bonoLlevarArmadura', 'bonoZeon',
         'costeHA', 'costeHP', 'costeHE', 'costeLlevarArmadura', 'costeKi',
         'costeAcumKi', 'costeZeon', 'costeACT', 'costeProyeccionMagica',
         'costeConvocar', 'costeControlar', 'costeAtar', 'costeDesconvocar',
         'costeCV', 'costeProyeccionPsiquica',
         'costeAtleticas', 'costeSociales', 'costePerceptivas',
         'costeIntelectuales', 'costeVigor', 'costeSubterfugio',
         'costeCreativas',
         'costePFuerza', 'costeResDolor', 'costeFrialdad', 'costeTramperia',
         'costeHerbolaria', 'costeAnimales', 'costeMedicina', 'costeTasacion',
         'costeSigilo', 'costeMemorizar', 'costeVMagica', 'costeTManos',
         'costePersuasion', 'costeOcultismo',
         'bonPFuerza', 'bonAcrobacias', 'bonSaltar', 'bonAtletismo',
         'bonTManos', 'bonEstilo', 'bonLiderazgo', 'bonResDolor',
         'bonIntimidar', 'bonFrialdad', 'bonPersuasion', 'bonDesconvocar',
         'bonControlar', 'bonAdvertir', 'bonBuscar', 'bonRastrear',
         'bonTramperia', 'bonAnimales', 'bonHerbolaria', 'bonOcultarse',
         'bonSigilo', 'bonRobo', 'bonVenenos', 'bonOcultismo', 'bonVMagica',
         'bonDisfraz', 'bonConvocar', 'bonAtar', 'bonDeteccionKi',
         'bonOcultacionKi', 'arquetipo1', 'arquetipo2', 'arquetipo']
data['categorias'] = matrix('Tablas', '$D$202:$CH$223', CAT_H)

# --- Ventajas y desventajas -------------------------------------------
VENT_H = ['nombre', 'coste', '_adq', '_pts', 'implementada', 'tipo']
ventajas = table('Tablas', '$E$256:$J$569', VENT_H)
for v in ventajas:
    v.pop('_adq', None)
    v.pop('_pts', None)
    v['esDesventaja'] = isinstance(v.get('coste'), int) and v['coste'] < 0
data['ventajas'] = ventajas

# --- Habilidades esenciales (Ventajas/Desventajas esenciales) ---------
data['habilidadesEsenciales'] = table(
    'Tablas', '$E$1249:$J$1455',
    ['nombre', 'gnosis', 'coste', '_adq', 'implementada', '_bono'])
for h in data['habilidadesEsenciales']:
    h.pop('_adq', None)
    h.pop('_bono', None)

# --- Armas y escudos ---------------------------------------------------
ARMA_H = ['arma', 'dano', 'turno', 'fueRequerida', 'fueReq2M', 'critico1',
          'critico2', 'tipoArma', 'conocida', 'entereza', 'rotura',
          'presencia', 'bonusParada', 'bonusEsquiva', 'cadencia', 'recarga',
          'alcance', 'fuerza', 'especial', '_x', 'tamano', '_atrDano']
armas = table('Tablas', '$D$638:$Y$840', ARMA_H)
for a in armas:
    a.pop('_x', None)
    # 'Atr. Daño' (col Y) no es dato del arma: en la hoja es la fórmula
    # =Bono_Fue, es decir el bono de FUE del personaje. Se descarta.
    a.pop('_atrDano', None)
data['armas'] = [a for a in armas if not str(a['arma']).startswith('Arma #')]

# --- Armaduras ---------------------------------------------------------
data['armaduras'] = table('Tablas', '$D$580:$R$632', [
    'armadura', 'requerimiento', 'penNatural', 'restMovimiento', 'entereza',
    'presencia', 'localizacion', 'clase',
    'FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'])

data['yelmos'] = table('Tablas', '$V$619:$AI$628', [
    'yelmo', 'requerimiento', 'penNatural', 'entereza', 'presencia',
    'FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE', 'c13', 'c14'])

# --- Artes marciales ---------------------------------------------------
data['artesMarciales'] = table('Tablas', '$D$850:$Z$939', [
    'arte', 'danoBase', 'bonoDano', 'CM', 'bonoAtaque', 'bonoEsquiva',
    'bonoParada', 'bonoTurno', 'bonoEntereza', 'bonoRotura', 'especial',
    '_o', '_p', '_q', '_r', 'longEsp', 'critico1', 'critico2',
    'bonoMaestroAt', 'bonoMaestroDef', 'danoMaximo', '_adq', 'requisitos'])
for a in data['artesMarciales']:
    for k in ('_o', '_p', '_q', '_r', '_adq'):
        a.pop(k, None)

# --- Ars Magnus --------------------------------------------------------
data['arsMagnus'] = table('Tablas', '$E$985:$J$1046', [
    'nombre', 'PD', 'CM', '_adq', 'requisitos', 'descripcion'])
for a in data['arsMagnus']:
    a.pop('_adq', None)

# --- Conjuros ----------------------------------------------------------
data['conjuros'] = table('Tablas Magia', '$D$6:$Z$680', [
    'conjuro', 'via', 'nivel', 'diario', 'tipo', 'accion',
    'intRBase', 'intRIntermedio', 'intRAvanzado', 'intRArcano',
    'zeonBase', 'zeonIntermedio', 'zeonAvanzado', 'zeonArcano',
    'mantBase', 'mantIntermedio', 'mantAvanzado', 'mantArcano',
    'efectoBase', 'efectoIntermedio', 'efectoAvanzado', 'efectoArcano',
    'efecto'])

# --- Poderes psíquicos y disciplinas -----------------------------------
data['poderesPsiquicos'] = table('Tablas psiquica', '$D$8:$R$145', [
    'poder', 'disciplina', 'nivel', 'mantenido', 'accion',
    'RUT', 'FAC', 'MED', 'DIF', 'MDF', 'ABS', 'CIM', 'IMP', 'INH', 'ZEN'])

data['disciplinasPsiquicas'] = table('Tablas', '$D$1190:$E$1202',
                                     ['disciplina', 'modificadores'])

# --- Poderes de criatura ----------------------------------------------
data['poderesCriatura'] = table('Tablas', '$O$1249:$R$1755',
                                ['nombre', 'gnosis', 'coste', '_adq'])
for p in data['poderesCriatura']:
    p.pop('_adq', None)

# --- Elan --------------------------------------------------------------
elan, patron = [], None
for row in cells('Tablas', '$E$1764:$L$1963'):
    v = [clean(c.value) for c in row]
    if v[0] is None:
        continue
    if v[2] == 'Elan':          # fila cabecera de bloque: nombra al patrón
        patron = v[0]
        continue
    elan.append({'patron': patron, 'nombre': v[0], 'elan': v[2],
                 'requisito': v[3], 'coste': v[4], 'descripcion': v[7]})
data['elan'] = elan

# --- Tablas numéricas base --------------------------------------------
base = {}
base['bonoCaracteristica'] = [
    {'valor': clean(r[0].value), 'bono': clean(r[1].value),
     'multiplicadorPV': clean(r[2].value)}
    for r in cells('Tablas', '$C$14:$E$33')]
# Tabla 55 del manual. Se usa tres veces con índices distintos:
#   col PV  indexada por CON -> Puntos de Vida base
#   col PV  indexada por POD -> Zeón base
#   col ACT indexada por POD -> base de Acumulación (ACT)
# La 3.ª columna NO es el Cansancio (ese sale de CON + raza).
base['valoresBase'] = [
    {'valor': clean(r[0].value), 'PV': clean(r[1].value), 'ACT': clean(r[2].value)}
    for r in cells('Tablas', '$M$37:$O$56')]
base['fuerza'] = [
    {'valor': clean(r[0].value), 'bonoTamano': clean(r[1].value),
     'pesoKg': clean(r[2].value), 'pesoMaxKg': clean(r[3].value)}
    for r in cells('Tablas', '$G$14:$J$33')]
base['acumulacionPorPOD'] = [
    {'POD': clean(r[0].value), 'multiplicador': clean(r[1].value)}
    for r in cells('Tablas', '$P$14:$Q$33') if clean(r[0].value)]
base['gnosis'] = [
    {'gnosis': clean(r[0].value), 'PDs': clean(r[1].value), 'nivelesSobrenat': clean(r[2].value)}
    for r in cells('Tablas', '$W$27:$Y$37')]
base['limitesKi'] = [
    {'limite': clean(r[1].value), 'coste': clean(r[2].value), 'efecto': clean(r[3].value)}
    for r in cells('Tablas', '$C$1065:$M$1071') if clean(r[1].value)]
base['cordura'] = [[clean(c.value) for c in r] for r in cells('Tablas', '$AA$27:$AC$36')]
base['fama'] = [[clean(c.value) for c in r] for r in cells('Tablas', '$AE$27:$AG$34')]
base['idiomas'] = [clean(r[0].value) for r in cells('Tablas', '$AI$27:$AJ$46') if clean(r[0].value)]
base['nivelMagia'] = [[clean(c.value) for c in r] for r in cells('Tablas', '$P$1065:$Q$1084')]
base['experienciaNecesaria'] = {
    'nota': 'fila = nivel actual; columnas = ajuste de nivel 0..10',
    'filas': [[clean(c.value) for c in r] for r in cells('Tablas', '$P$69:$AA$99')]}
base['armasEnormes'] = [
    {'tamano': clean(r[0].value), 'fueMin': clean(r[1].value),
     'tamanoMin': clean(r[2].value), 'penFUE': clean(r[3].value),
     'multDano': clean(r[4].value), 'c5': clean(r[5].value), 'c6': clean(r[6].value)}
    for r in cells('Tablas', '$AE$598:$AK$600') if clean(r[0].value)]
base['tipologias'] = [[clean(c.value) for c in r] for r in cells('Tablas', '$X$603:$AA$614')]
data['tablasBase'] = base

os.makedirs(OUT, exist_ok=True)
index = {}
for name, payload in data.items():
    path = os.path.join(OUT, f'{name}.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    index[name] = len(payload)
    print(f'{name:24s} {len(payload):5d} -> {path}')

with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
    json.dump({'fuente': 'Meirmeister.xlsm', 'conjuntos': index}, fh,
              ensure_ascii=False, indent=1)
