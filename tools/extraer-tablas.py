#!/usr/bin/env python3
"""Extrae las tablas de reglas de la ficha de la comunidad (v8.7.0, tools/ficha.xlsm) a JSON."""
import json, os, re, warnings
import openpyxl

warnings.filterwarnings('ignore')

SRC = os.path.join(os.path.dirname(__file__), 'ficha.xlsm')
OUT = os.environ.get('OUT_DIR', '/home/user/Anima-Manager/data/reglas')
wb = openpyxl.load_workbook(SRC, data_only=True)
# Segunda copia sin resolver: hace falta para el árbol del Ki, donde el coste vive
# dentro de la fórmula (`=IF(Q10=0,40,"-")`) y el valor resuelto es "-" en cuanto el
# personaje de la ficha ya tiene esa habilidad.
wbf = openpyxl.load_workbook(SRC, data_only=False)


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
# Las casillas «personalizadas» de la hoja (Ventaja personalizada #1…) no son contenido:
# son huecos que la mesa rellena en la pestaña Personalización. En la aplicación eso va a
# «Contenido propio», y la importación trae lo que la mesa haya escrito en ellos.
def sin_huecos(filas):
    return [f for f in filas if 'PERSONALIZ' not in str(f.get('_seccion', '')).upper()]


data['ventajas'] = sin_huecos(ventajas)

# --- Habilidades esenciales (Ventajas/Desventajas esenciales) ---------
data['habilidadesEsenciales'] = table(
    'Tablas', '$E$1249:$J$1455',
    ['nombre', 'gnosis', 'coste', '_adq', 'implementada', '_bono'])
for h in data['habilidadesEsenciales']:
    h.pop('_adq', None)
    h.pop('_bono', None)
data['habilidadesEsenciales'] = sin_huecos(data['habilidadesEsenciales'])

# --- Armas y escudos ---------------------------------------------------
ARMA_H = ['arma', 'dano', 'turno', 'fueRequerida', 'fueReq2M', 'critico1',
          'critico2', 'tipoArma', 'conocida', 'entereza', 'rotura',
          'presencia', 'bonusParada', 'bonusEsquiva', 'cadencia', 'recarga',
          'alcance', 'fuerza', 'especial', '_x', 'tamano', '_atrDano']
armas = table('Tablas', '$D$638:$Y$840', ARMA_H)

# Varias columnas de la tabla de armas no son datos sino fórmulas que miran al personaje:
# la Katana de doble hoja hace «55-Bono_Fue», Umbra hace tanto daño como Presencia, el
# Atlatl tiene la Fuerza del que lo lanza +2… Leer el valor que la hoja tiene calculado
# metería en el catálogo los números del personaje que estuviera rellenado. Así que, fila a
# fila, se mira la fórmula y se guarda lo que dice, en la sintaxis de las fórmulas de la
# aplicación: el motor la evalúa con el personaje que la empuña.
VARIABLES_ARMA = [
    (r'IF\(FUE\+2<1,0,VLOOKUP\(FUE\+2,Tabla_BonoStats,2\)\)', 'bono(FUE + 2)'),
    (r'IF\(FUE=0,0,VLOOKUP\(FUE,Tabla_Fuerza,2\)\)', 'roturaFUE'),
    (r'Presencia_final', 'presencia'), (r'Bono_Fue', 'bonoFUE'), (r'Bono_Pod', 'bonoPOD'),
    (r'\bFUE\b', 'FUE'), (r'\bPOD\b', 'POD'),
]


def expresion_arma(formula):
    """Fórmula de Excel → fórmula de la aplicación, o None si mira algo que no sabe."""
    f = formula.lstrip('=')
    for patron, cambio in VARIABLES_ARMA:
        f = re.sub(patron, cambio, f)
    f = f.replace('*', ' * ').replace('-', ' - ').replace('+', ' + ')
    f = re.sub(r'\s+', ' ', f).strip()
    if re.search(r'[A-Z]{2,}\d|!|\$|IF\(|VLOOKUP|U\d+|V\d+|Ki', f):
        return None
    return f


fila_de = {}
for r in range(638, 841):
    nombre = wb['Tablas'][f'D{r}'].value
    if nombre is not None:
        fila_de[clean(nombre)] = r
nombres_ars = {r: clean(wb['Tablas'][f'E{r}'].value) for r in range(985, 1047)}

for a in armas:
    a.pop('_x', None)
    a.pop('conocida', None)  # Conocida/Distinta es del personaje, no del arma.
    r = fila_de.get(a['arma'])
    if r is None:
        a.pop('_atrDano', None)
        continue
    if a['arma'] in ('Armas naturales', 'Munición natural'):
        # Su daño, críticos, entereza y rotura salen de la raza y del Tamaño
        # (`tablasBase.armasNaturales`), no de la fila: se deja sólo lo que no cambia.
        for k in ('dano', 'critico1', 'critico2', 'entereza', 'rotura', 'presencia', 'fuerza',
                  'especial', '_atrDano'):
            a.pop(k, None)
        if a['arma'] == 'Armas naturales':
            a.update({'turno': 20, 'tipoArma': 'Natural/-', 'presenciaFormula': 'presencia',
                      'fuerzaFormula': 'FUE', 'municiones': ['Munición natural'], 'porRaza': True})
        else:
            a['atributoDano'] = 'ninguno'
            a['porRaza'] = True
        continue
    f = lambda col: wbf['Tablas'][f'{col}{r}'].value
    # Daño: si es una fórmula que mira al personaje, va como fórmula; si sólo son números
    # («60-10»), su resultado.
    if isinstance(f('E'), str) and f('E').startswith('='):
        e = expresion_arma(f('E'))
        if e is not None and re.search('[a-zA-Z]', e):
            # El número que la hoja tiene calculado es el del personaje que estuviera
            # rellenado (Umbra: su Presencia); no vale para nadie más.
            a['danoFormula'] = e
            a.pop('dano', None)
        elif e is not None:
            # «60-10»: sólo números sumados y restados.
            a['dano'] = sum(int(n) for n in re.findall(r'[+-]?\s*\d+', e.replace(' ', '')))
    if isinstance(f('U'), str) and f('U').startswith('='):
        e = expresion_arma(f('U'))
        if e:
            a['fuerzaFormula'] = e
        a.pop('fuerza', None)
    if isinstance(f('N'), str) and f('N').startswith('='):
        # Umbra: su rotura es el POD (la de la Fuerza se le quita para que no cuente dos veces).
        e = expresion_arma(f('N'))
        if e:
            a['roturaFormula'] = e
            a.pop('rotura', None)
    if isinstance(f('O'), str) and f('O').startswith('='):
        e = expresion_arma(f('O'))
        if e:
            a['presenciaFormula'] = e
        a.pop('presencia', None)
    # Qué bono suma al daño (col Y): el de FUE, salvo que la hoja diga otro.
    y = f('Y')
    a.pop('_atrDano', None)
    if isinstance(y, str) and 'VLOOKUP(U' in y:
        a['atributoDano'] = 'propia'
    elif isinstance(y, str) and 'Bono_Pod' in y:
        a['atributoDano'] = 'POD'
    elif isinstance(y, str) and 'Bono_Des' in y:
        a['atributoDano'] = 'DES'
    elif y == 0:
        a['atributoDano'] = 'ninguno'
    # Las armas del Zodiaco sólo son Conocidas con su Ars Magnus (col L), y algunas además
    # piden conocer otras armas: eso no lo puede comprobar la aplicación (el conocimiento de
    # cada arma lo marca el jugador), así que se guarda como texto para avisar.
    l = f('L')
    if isinstance(l, str) and re.fullmatch(r'=\$?L\$?\d+', l):
        l = wbf['Tablas'][l.lstrip('=').replace('$', '')].value  # «Leo … P.» es «=L800»
    if isinstance(l, str):
        filas = [int(x) for x in re.findall(r'H\$?(\d{4})>0', l)]
        if 'VirgoAprendido' in l:
            filas = list(range(1020, 1024))
        if filas:
            a['requiereArsMagnus'] = [nombres_ars[x] for x in filas if nombres_ars.get(x)]
        elif 'Tabla_ArsMagnus' in l:
            a['requiereArsMagnus'] = [n for n in nombres_ars.values() if n and a['arma'].split(' (')[0] in n]
        nombre_fila = lambda x: clean(wb['Tablas'][f'D{x}'].value)
        sueltas = re.sub(r'OR\([^()]*\)', '', l)
        grupos = [[nombre_fila(int(x))] for x in re.findall(r'L(\d{3})="Conocida"', sueltas)]
        grupos += [[nombre_fila(int(x)) for x in re.findall(r'L(\d{3})="Conocida"', o)]
                   for o in re.findall(r'OR\(([^()]*)\)', l)]
        textos = [g[0] if len(g) == 1 else ', '.join(g[:-1]) + ' o ' + g[-1] for g in grupos if g]
        if re.search(r'AA\d+>0', l):  # Ophiucos: la Tabla de tipología de Espadas
            textos.append('la Tabla de tipología: ' + clean(wb['Tablas']['X608'].value))
        if textos:
            a['requiereArmas'] = ' y '.join(textos)
    # «especial» con números del personaje (Virgo: «Alcance 40m»): se deja la regla.
    v = f('V')
    if isinstance(v, str) and v.startswith('=') and 'Presencia_final' in v and '"' in v:
        a['especial'] = re.sub(r'"&2\*Presencia_final&"', '2×Presencia ', v.lstrip('=')).replace('"', '').replace(' m,', 'm,').replace('m,', ' m,')

# La munición que admite cada arma de proyectiles (Tablas!AC801:AV824).
municiones = {}
for r in range(804, 825):
    arma = clean(wb['Tablas'][f'AC{r}'].value)
    lista = [clean(wb['Tablas'].cell(r, c).value) for c in range(31, 49)]
    lista = [x for x in lista if isinstance(x, str) and not str(x).startswith('#')]
    if arma and lista:
        municiones[arma] = ['Jabalina (Munición)' if x == 'Jabalina' else x for x in lista]
for a in armas:
    if a['arma'] in municiones:
        a['municiones'] = municiones[a['arma']]

data['armas'] = [a for a in armas if not str(a['arma']).startswith('Arma #')]

# --- Armaduras ---------------------------------------------------------
data['armaduras'] = table('Tablas', '$D$580:$R$632', [
    'armadura', 'requerimiento', 'penNatural', 'restMovimiento', 'entereza',
    'presencia', 'localizacion', 'clase',
    'FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'])
data['armaduras'] = [a for a in data['armaduras'] if not str(a['armadura']).startswith('Armadura #')]

data['yelmos'] = table('Tablas', '$V$619:$AI$628', [
    'yelmo', 'requerimiento', 'penNatural', 'entereza', 'presencia',
    'localizacion', 'clase',
    'FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'])
data['yelmos'] = [y for y in data['yelmos'] if not str(y['yelmo']).startswith('Armadura #')]

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

# Los requisitos (col I) y algunos costes (col F) son fórmulas que miran al personaje: el
# valor calculado («NO» / «-») sólo dice si el personaje que estuviera rellenado los
# cumple. Se traducen a texto, y los descuentos de PD a datos que el motor aplica.


def nombre_definido(n):
    """Una casilla con nombre de la pestaña Ki (UsodelKi…) → el nombre de esa habilidad."""
    try:
        hoja, ref = wbf.defined_names[n].attr_text.split('!')
    except KeyError:
        return None
    if hoja.strip("'") != 'Ki':
        return n  # Inhumanidad y Zen son marcas que la hoja calcula aparte (`Tablas!AI55`)
    fila = int(re.sub(r'\D', '', ref.split(':')[0]))
    for col in 'KLMN':
        v = clean(wb[hoja.strip("'")][f'{col}{fila}'].value)
        if isinstance(v, str) and v not in ('├', '└', '│'):
            return v
    return None


def partir(texto):
    """Separa por comas de primer nivel."""
    partes, nivel, actual = [], 0, ''
    for ch in texto:
        if ch == ',' and nivel == 0:
            partes.append(actual)
            actual = ''
            continue
        nivel += ch == '('
        nivel -= ch == ')'
        actual += ch
    return partes + [actual]


SECUNDARIA_FINAL = {'T.Manos': 'Trucos de manos', 'P.Fuerza': 'Proezas de fuerza'}
o_lista = lambda xs: xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' o ' + xs[-1]


def requisito(c):
    t = wb['Tablas']
    c = c.replace('Tablas!', '')
    reglas = [
        # Las de las artes marciales: AA, AB y AC son su Ataque, Esquiva y Parada.
        (r'AA\d+<(\d+)', lambda m: f'Ataque {m[1]}'),
        (r'MAX\(A[BC]\d+,A[BC]\d+\)<(\d+)', lambda m: f'Defensa {m[1]}'),
        (r'AB\d+<(\d+)', lambda m: f'Esquiva {m[1]}'),
        (r'AC\d+<(\d+)', lambda m: f'Parada {m[1]}'),
        (r'\$Y\$(\d+)=0', lambda m: clean(t[f'D{m[1]}'].value)),
        (r'NOT\(OR\(((?:\$Y\$\d+=1,?)+)\)\)', lambda m: o_lista(
            [clean(t[f'D{x}'].value) for x in re.findall(r'Y\$(\d+)', m[1])])),
        (r'Turno_SinArmas_final-IFERROR\(.*\)<(\d+)', lambda m: f'Turno {m[1]}'),
        (r'NOT\(OR\(Medicina_final>=(\d+),AND\(PDs!I\d+="Anatomía",Medicina_final>=(\d+)\)\)\)',
         lambda m: f'Medicina {m[1]} (o {m[2]} con la especialidad Anatomía)'),
        (r'MAX\(HA_final,Místicos!\$P\$12,Psíquicos!\$P\$12\)<(\d+)',
         lambda m: f'Ataque, Proyección mágica o psíquica {m[1]}'),
        (r'(?:MAX\()?HA_final(?:,HA_SinArmas\))?<(\d+)', lambda m: f'Ataque {m[1]}'),
        (r'(?:MAX\()?HD_final(?:,HD_SinArmas\))?<(\d+)', lambda m: f'Defensa {m[1]}'),
        (r'(AGI|CON|DES|FUE|INT|PER|POD|VOL)<(\d+)', lambda m: f'{m[1]} {m[2]}'),
        (r'([\w.]+)_final="-"', lambda m: ''),
        (r'([\w.]+)_final<(\d+)', lambda m: f'{SECUNDARIA_FINAL.get(m[1], m[1])} {m[2]}'),
        (r'NOT\(Ki!P(\d+)="-"\)', lambda m: clean(wb['Ki'][f'K{m[1]}'].value)),
        (r'NOT\(OR\((.*)\)\)', lambda m: 'conocer ' + o_lista(
            [clean(t[f'D{x}'].value) for x in re.findall(r'L(\d+)="Conocida"', m[1])])
            if 'Conocida' in m[1] else 'la Tabla de tipología: ' + re.findall(r'"(\w+)"', m[1])[0]),
        (r'NOT\(\$L\$(\d+)="Conocida"\)', lambda m: 'conocer ' + clean(t[f'D{m[1]}'].value)),
        (r'NOT\((\w+)\)', lambda m: nombre_definido(m[1])),
        (r'U1046<(\d+)', lambda m: f'conocer {m[1]} Tablas de tipología'),
        (r'H(\d{4})=0', lambda m: clean(t[f'E{m[1]}'].value)),
        (r'((?:\$?Y\$?\d+\+?)+)=0', lambda m: 'un arte marcial en grado Avanzado'),
        (r'((?:\$?P\$?\d+\+?)+)=0', lambda m: o_lista(
            [re.sub(r' \(\d\)$', '', clean(t[f'N{x}'].value)) for x in re.findall(r'P\$?(\d+)', m[1])][:1]
            if len({re.sub(r' \(\d\)$', '', clean(t[f'N{x}'].value)) for x in re.findall(r'P\$?(\d+)', m[1])}) == 1
            else [clean(t[f'N{x}'].value) for x in re.findall(r'P\$?(\d+)', m[1])])),
    ]
    for patron, texto in reglas:
        m = re.fullmatch(patron, c)
        if m:
            return texto(m)
    raise ValueError(f'Requisito de Ars Magnus sin traducir: {c}')


for fila in range(985, 1047):
    nombre = clean(wb['Tablas'][f'E{fila}'].value)
    a = next((x for x in data['arsMagnus'] if x['nombre'] == nombre), None)
    if a is None or 'Personalización' in str(wbf['Tablas'][f'F{fila}'].value):
        continue  # los huecos «Ars Magnus Personalizado» se quitan abajo
    req = wbf['Tablas'][f'I{fila}'].value
    if isinstance(req, str) and req.startswith('='):
        m = re.fullmatch(r'=IF\(OR\((.*)\),"NO","-"\)', req) or re.fullmatch(r'=IF\((.*),"NO","-"\)', req)
        if m:
            textos = [requisito(c) for c in partir(m[1])]
        else:
            # Yuuse Batojutsu: «-» si tiene el arte marcial (`PDs!E49:H58`).
            m = re.fullmatch(r'=IF\(COUNTIF\(PDs!\$E\$49:\$H\$58,Tablas!\$R\$(\d+)\)>0,"-","NO"\)', req)
            textos = [clean(wb['Tablas'][f'R{m[1]}'].value)]
        a['requisitos'] = ', '.join(x for x in textos if x)
    else:
        a.pop('requisitos', None)
    f = wbf['Tablas'][f'F{fila}'].value
    if isinstance(f, str) and f.startswith('='):
        m = re.fullmatch(r'=(\d+)\+IF\(\$H\$(\d+)>0,-(\d+),0\)', f)
        if m:
            # Cáncer: 10 PD menos con Virgo: Instrumentos de cuerda.
            a['PD'] = int(m[1])
            a['descuentoPD'] = int(m[3])
            a['descuentoCon'] = clean(wb['Tablas'][f'E{m[2]}'].value)
        elif re.fullmatch(r'=MAX\(80-10\*U1046,10\)', f):
            a['PD'] = 80
            a['notaPD'] = ('80 PD, −10 por cada Tabla de tipología de armas que conozca (Asta, Corta, '
                           'Cuerda, Escudo, Espada, Hacha, Mandoble, Maza, Proyectiles), mínimo 10 '
                           '(Tablas!F1032).')
        else:
            raise ValueError(f'Coste de Ars Magnus sin traducir: {nombre}: {f}')
for a in data['arsMagnus']:
    a.pop('_adq', None)
data['arsMagnus'] = sin_huecos(data['arsMagnus'])

# Las artes marciales tienen lo mismo: el daño base suma el bono de FUE (o de POD) del que
# pelea, y los requisitos (col Z) miran sus habilidades. Ataque, Esquiva y Parada (cols AA,
# AB, AC) son las del personaje con los bonos de las artes que ya tenga.
for fila in range(850, 940):
    nombre = clean(wb['Tablas'][f'D{fila}'].value)
    a = next((x for x in data['artesMarciales'] if x['arte'] == nombre), None)
    if a is None:
        continue
    e = wbf['Tablas'][f'E{fila}'].value
    if isinstance(e, str) and e.startswith('='):
        formula = e.lstrip('=').replace('Combate!$L$24', 'bonoDanoDesarmado')
        for patron, cambio in VARIABLES_ARMA:
            formula = re.sub(patron, cambio, formula)
        formula = re.sub(r'\s+', ' ', formula.replace('*', ' * ').replace('-', ' - ').replace('+', ' + ')).strip()
        a['danoFormula'] = formula
        a.pop('danoBase', None)
    f = wbf['Tablas'][f'F{fila}'].value
    if isinstance(f, str) and f.startswith('='):
        a['bonoDanoFormula'] = 'bonoPOD' if f == '=Bono_Pod' else f
        a.pop('bonoDano', None)
    z = wbf['Tablas'][f'Z{fila}'].value
    if isinstance(z, str) and z.startswith('='):
        m = re.fullmatch(r'=IF\(OR\((.*)\),"NO","-"\)', z) or re.fullmatch(r'=IF\((.*),"NO","-"\)', z)
        a['requisitos'] = ', '.join(x for x in (requisito(c) for c in partir(m[1])) if x)
    else:
        a.pop('requisitos', None)

# --- Habilidades del Ki y del Némesis ----------------------------------
# La hoja «Ki» dibuja los dos árboles con caracteres de línea (├ └ │). El nombre de
# cada habilidad está en la columna que corresponde a su profundidad, así que la
# columna basta para saber de quién cuelga: el padre es el último nombre que hay por
# encima una columna a la izquierda.
GLIFOS = '├└│  '

# La hoja abrevia para que quepa; aquí se devuelven los nombres del manual.
NOMBRE_LARGO = {
    'Mult. de cuerpos': 'Multiplicación de cuerpos',
    'Mult. mayor': 'Multiplicación de cuerpos mayor',
    'Mult. arcana': 'Multiplicación de cuerpos arcana',
    'Mag. arcana': 'Magnitud arcana',
    'Mov. de masas': 'Movimiento de masas',
    'Armadura mayor': 'Armadura de energía mayor',
    'Arm. arcana': 'Armadura de energía arcana',
    'Inmunidad elem. FUE': 'Inmunidad elemental: Fuego',
    'Inmunidad elem. FRI': 'Inmunidad elemental: Frío',
    'Inmunidad elem. ELE': 'Inmunidad elemental: Electricidad',
}


def arbol_habilidades(hoja, filas, columnas, col_coste, dominio):
    """Recorre un árbol dibujado en columnas y devuelve nombre, requisito y coste."""
    hf, hv = wbf[hoja], wb[hoja]
    salida, ultimo_en = [], {}
    for fila in filas:
        for profundidad, col in enumerate(columnas):
            crudo = hv.cell(fila, col).value
            if not isinstance(crudo, str):
                continue
            nombre = crudo.strip(GLIFOS).strip()
            if not nombre:
                continue
            nombre = NOMBRE_LARGO.get(nombre, nombre)
            # El coste está dentro de la fórmula, no en el valor resuelto.
            formula = str(hf.cell(fila, col_coste).value or '')
            m = re.search(r',\s*(\d+)\s*,\s*"-"', formula)
            if not m:
                continue
            salida.append({
                'habilidad': nombre,
                'dominio': dominio,
                'requisito': ultimo_en.get(profundidad - 1),
                'CM': int(m.group(1)),
            })
            ultimo_en[profundidad] = nombre
            # Un nombre nuevo a esta profundidad invalida lo que colgaba más adentro.
            for mas_hondo in [d for d in ultimo_en if d > profundidad]:
                ultimo_en.pop(mas_hondo, None)
            break
    return salida


habilidades_ki = arbol_habilidades('Ki', range(10, 65), (11, 12, 13, 14), 16, 'Ki')
# El árbol del Némesis arranca en «Uso del Némesis», que no depende de nada.
habilidades_ki += arbol_habilidades('Ki', range(43, 65), (3, 4, 5), 8, 'Némesis')

# La hoja dibuja algunas ramas con `└` a la misma profundidad que sus hermanas, de
# modo que el requisito sale mal. Aquí manda el manual (Dominus Exxet, cap. 3).
REQUISITO_CORREGIDO = {
    'Multiplicación de cuerpos arcana': 'Multiplicación de cuerpos mayor',
    'Magnitud arcana': 'Magnitud',
}
# Némesis: Inhumanidad y Zen repiten el nombre de las del Ki, pero son otra cosa
# (Dominus Exxet las llama «Inhumanidad (Némesis)» y «Zen (Némesis)»).
SUFIJO_NEMESIS = {'Inhumanidad': 'Inhumanidad (Némesis)', 'Zen': 'Zen (Némesis)'}
# Raíz de cada dominio: todo lo que la hoja deja al ras cuelga de ella.
RAIZ = {'Ki': 'Uso del Ki', 'Némesis': 'Uso del Némesis'}

for h in habilidades_ki:
    if h['dominio'] == 'Némesis':
        h['habilidad'] = SUFIJO_NEMESIS.get(h['habilidad'], h['habilidad'])
        h['requisito'] = SUFIJO_NEMESIS.get(h['requisito'], h['requisito'])
    raiz = RAIZ[h['dominio']]
    if h['requisito'] is None and h['habilidad'] != raiz:
        h['requisito'] = raiz
    h['requisito'] = REQUISITO_CORREGIDO.get(h['habilidad'], h['requisito'])

# Forma de Vacío pide dos: el árbol sólo puede dibujar una.
for h in habilidades_ki:
    if h['habilidad'] == 'Forma de Vacío':
        h['requisitoExtra'] = 'Cuerpo de Vacío'
data['habilidadesKi'] = habilidades_ki

# --- Creación de Técnicas: efectos, opciones y coste -------------------
# Cada fila es una **opción** de un efecto: «Habilidad de Ataque» + «+25» cuesta 3
# puntos de Ki de la característica principal, 5 de la secundaria y 5 de CM.
data['efectosTecnica'] = table('Tablas Técnicas', '$C$10:$K$643', [
    'efecto', 'opcion', 'kiPrincipal', 'kiSecundaria', 'CM',
    'mantenimiento', 'sostenidaMenor', 'sostenidaMayor', 'nivel'])
for e in data['efectosTecnica']:
    # Un efecto tiene varias opciones; lo que identifica una fila es la pareja.
    e['referencia'] = f"{e['efecto']} {e.get('opcion', '')}".strip()
# «EFECTOS PERSONALIZADOS» son los huecos vacíos que la hoja deja para inventarse
# efectos. Quien quiera los suyos los añade desde Contenido propio.
data['efectosTecnica'] = [
    e for e in data['efectosTecnica'] if e.get('_seccion') != 'EFECTOS PERSONALIZADOS']

# Ficha de cada efecto: a qué característica va, de qué tipo y clase es, y con qué
# elementos casa. `caracteristicas` viene como «DES (AGI+2, FUE+2, POD+2, VOL+3)»:
# la primera es la principal y entre paréntesis van las alternativas con su recargo.
data['tiposEfectoTecnica'] = table('Tablas Técnicas', '$O$9:$W$98', [
    'efecto', '_ref', 'tipo', 'clase', 'caracteristicas',
    'elemento1', 'elemento2', 'elemento3', 'elementos'])
for t in data['tiposEfectoTecnica']:
    t.pop('_ref', None)
# El bloque «EFECTOS PERSONALIZADOS» son huecos vacíos de la propia hoja y, a
# continuación, la tabla de Reducción de CM, que no es un efecto. Fuera los dos: quien
# quiera inventarse efectos los añade desde Contenido propio.
data['tiposEfectoTecnica'] = [
    t for t in data['tiposEfectoTecnica']
    if t.get('_seccion') != 'EFECTOS PERSONALIZADOS']

# --- Compendio de Técnicas del Dominus Exxet --------------------------
# Las filas 655-665 son huecos para las Técnicas propias del jugador; el compendio
# publicado empieza en la 666.
data['tecnicasCompendio'] = table('Tablas Técnicas', '$C$666:$J$854', [
    'tecnica', '_arbol', 'nivel', 'CM', '_cmReducido', 'coste', 'efectos',
    'desventajas'])
for t in data['tecnicasCompendio']:
    t.pop('_arbol', None)
    t.pop('_cmReducido', None)
    t['arbol'] = t.pop('_seccion', None)

# --- Metamagia: el Arcana Shepirah -------------------------------------
# Arcana Exxet, cap. 3. La hoja «Metamagia» dibuja el árbol como una rejilla: el nombre
# de la esfera va en una columna, el **nivel de personaje requerido** dos columnas a la
# derecha, y el **coste en puntos de Nivel de Magia** tres filas más abajo en esa misma
# columna. Lo confirma la fórmula de la celda del rótulo:
#     =IF(AND($T$12, PDs!$R$17 >= Metamagia!E28), "", "Nv " & Metamagia!E28)
# donde `PDs!R17` es el nivel del personaje.
#
# La misma habilidad aparece en varias posiciones del árbol con requisitos y costes
# distintos: así funciona el Shepirah, y el manual lo dibuja igual. Por eso la clave es
# la posición (la celda), no el nombre.
#
# Lo que **no** se puede sacar de aquí son las líneas que unen unas esferas con otras.
# La regla de moverse sólo a esferas conectadas se queda para la mesa.
metamagia = []
for col in range(3, 36, 3):
    for fila in range(9, 63):
        nombre = clean(wb['Metamagia'].cell(fila, col).value)
        if not isinstance(nombre, str) or nombre in ('0', 'Nivel Usado'):
            continue
        if nombre.startswith('Nv '):
            continue
        coste = clean(wb['Metamagia'].cell(fila + 3, col + 2).value)
        if not isinstance(coste, int):
            continue
        metamagia.append({
            'posicion': f'{openpyxl.utils.get_column_letter(col)}{fila}',
            'habilidad': nombre,
            'nivelRequerido': clean(wb['Metamagia'].cell(fila, col + 2).value) or 0,
            'coste': coste,
        })
data['metamagia'] = metamagia

# --- Sheele: espíritus del alma ----------------------------------------
# Arcana Exxet, cap. 7. Ocho tipos elementales, cada uno con sus características, sus
# habilidades de partida y sus mejoras. Las mejoras generales sirven para cualquier
# Sheele; las de la sección de un elemento, sólo para las de ese tipo.
TIPOS_SHEELE = ['Aire', 'Agua', 'Fuego', 'Tierra', 'Luz', 'Oscuridad', 'Naturaleza', 'Ilusión']

sheele = {'tipos': [], 'mejoras': [], 'potenciacion': []}

# Nombre propio y características base de cada tipo. `Tablas Sheele`, filas 5-12 y 18-25.
nombres_propios = {clean(r[0].value): clean(r[1].value)
                   for r in cells('Tablas Sheele', '$C$5:$G$12') if clean(r[0].value)}
for i, tipo in enumerate(TIPOS_SHEELE):
    entrada = {'tipo': tipo, 'nombre': None, 'caracteristicas': {}, 'habilidades': {}}
    for fila in cells('Tablas Sheele', '$C$18:$O$25'):
        car = clean(fila[0].value)
        if car:
            entrada['caracteristicas'][car] = clean(fila[4 + i].value)
    for fila in cells('Tablas Sheele', '$C$30:$K$80'):
        hab = clean(fila[0].value)
        valor = clean(fila[1 + i].value)
        if hab and valor:
            entrada['habilidades'][hab] = valor
    sheele['tipos'].append(entrada)

# Los nombres propios van en la columna G de la tabla de tipos (Haley, Corale, Faren…).
for fila in cells('Tablas Sheele', '$C$5:$G$12'):
    tipo, propio = clean(fila[0].value), clean(fila[4].value)
    for e in sheele['tipos']:
        if e['tipo'] == tipo:
            e['nombre'] = propio

# Muchas mejoras dan números que salen de la propia Sheele («RF 70», «Daño 60»): la hoja los
# calcula con la Sheele que tenga rellenada. Se guarda la regla en palabras, no el número.
CASILLAS_SHEELE = [
    (r'ROUNDDOWN\(Sheele!\$?G\$?11/2,0\)', 'DES/2'),
    (r'MROUND\(Sheele!\$?L\$?27\*3,10\)', 'Presencia×3, redondeado a 10'),
    (r'Sheele!\$?L\$?27', 'Presencia'), (r'Sheele!\$?H\$?15', 'bono de POD'),
    (r'Sheele!\$?H\$?12', 'bono de FUE'), (r'Sheele!\$?G\$?15', 'POD'), (r'Sheele!\$?G\$?16', 'VOL'),
    (r'Sheele!\$?G\$?11', 'DES'), (r'Sheele!\$?E\$?12', 'FUE'), (r'Sheele!\$?E\$?15', 'POD'),
    (r'Sheele!\$?E\$?16', 'VOL'), (r'Sheele!\$?J\$?19', 'su Movimiento'),
    (r'Sheele!\$?J\$?9', 'sus PV'), (r'Sheele!\$?F\$?45', 'Proyección ofensiva'),
    (r'Sheele!\$?F\$?47', 'Proyección defensiva'),
]


def regla_sheele(formula, entre_texto):
    """«="RF "&Sheele!L27*2+Sheele!H15&" o…"» → «RF [Presencia×2 + bono de POD] o…»."""
    trozos, actual, comillas = [], '', False
    for ch in formula.lstrip('='):
        if ch == '"':
            comillas = not comillas
        if ch == '&' and not comillas:
            trozos.append(actual)
            actual = ''
            continue
        actual += ch
    trozos.append(actual)
    salida = ''
    for t in trozos:
        if t.startswith('"'):
            salida += t.strip('"')
            continue
        for patron, nombre in CASILLAS_SHEELE:
            t = re.sub(patron, nombre, t)
        if re.search(r'[A-Z]{1,2}\$?\d|!', t):
            raise ValueError(f'Mejora de Sheele sin traducir: {formula}')
        t = t.replace('*', '×').replace('+', ' + ').replace('-', ' − ')
        salida += f'[{t}]' if entre_texto and len(trozos) > 1 else t
    return salida


# Mejoras: generales primero y luego las de cada elemento, con su coste y su efecto.
seccion = None
for r in range(91, 201):
    valor = lambda col: clean(wb['Tablas Sheele'][f'{col}{r}'].value)
    nombre = valor('C')
    if not nombre:
        continue
    if nombre.startswith('>'):
        seccion = nombre.lstrip('> ').strip()
        continue
    mejora = {'mejora': nombre, 'grupo': seccion}
    # Sólo las de elemento tienen coste en Zeón, Proyección y Daño.
    for clave, col in (('zeon', 'I'), ('proyeccion', 'J'), ('dano', 'K'), ('efecto', 'L')):
        f = wbf['Tablas Sheele'][f'{col}{r}'].value
        mejora[clave] = regla_sheele(f, clave == 'efecto') if isinstance(f, str) and f.startswith('=') else valor(col)
    sheele['mejoras'].append(mejora)

# Potenciación Mística: cuánto Zeón máximo da cada grado de Controlar. Filas 5-13.
sheele['potenciacion'] = [
    {'controlar': clean(r[0].value), 'zeonMaximo': clean(r[1].value)}
    for r in cells('Tablas Sheele', '$I$5:$J$13') if clean(r[1].value) is not None]

# La colección es la lista de mejoras, que es lo que se elige; los tipos y la tabla de
# Potenciación Mística son tablas de referencia y van con las demás.
data['sheele'] = sheele['mejoras']
TIPOS_SHEELE_DATOS = sheele['tipos']
POTENCIACION_SHEELE = sheele['potenciacion']

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
# El coste de algunos poderes depende del tipo de criatura (`Tablas!Q1284`, `Q1541`): se
# guarda el normal y se anota la excepción. (La columna de Gnosis tiene además un guiño
# para quien se llame «Xavi» en `General!T65`; se deja el valor de todos los demás.)
for r in range(1249, 1746):
    q = wbf['Tablas'][f'Q{r}'].value
    if not (isinstance(q, str) and q.startswith('=')) or 'Personalización' in q:
        continue
    p = next((x for x in data['poderesCriatura'] if x['nombre'] == clean(wb['Tablas'][f'O{r}'].value)), None)
    if p is None:
        continue
    m = re.fullmatch(r'=(\d+)\+IF\(OR\(TipoDeCriatura="Entre mundos, Elemental",TipoDeCriatura="Ánima, Elemental"\),(\d+),0\)', q)
    if m:
        p['coste'] = int(m[1])
        p['notaCoste'] = f'{int(m[1]) + int(m[2])} para un Elemental (Entre mundos o Ánima)'
        continue
    m = re.fullmatch(r'=IF\(TipoDeCriatura="([^"]+)",(\d+),(\d+)\)', q)
    if m:
        p['coste'] = int(m[3])
        p['notaCoste'] = f'{m[2]} para un {m[1]}'
        continue
    raise ValueError(f'Coste de poder de criatura sin traducir: {q}')
data['poderesCriatura'] = sin_huecos(data['poderesCriatura'])

# --- Elan --------------------------------------------------------------
# Las descripciones llevan números que salen del Elan que el personaje tenga con ese patrón
# (la F de la cabecera del bloque): «enfermedad de nivel igual o inferior a 40». Se guarda la
# regla en palabras: «… inferior a [Elan]». Y el requisito (col H) es «tener el poder de
# encima» (`IF(J1768=1,1,0)`): se guarda su nombre, no el 0/1 que da la hoja vacía.


def expresion_elan(t, fila_k):
    t = re.sub(r'IF\(\$?F\$?\d+<20,"1 vez",FLOOR\(\$?F\$?\d+/10,1\)&" veces"\)',
               '1 vez (Elan/10 veces con Elan 20 o más)', t)
    t = re.sub(r'IF\(\$?F\$?\d+>60,"(.*)",""\)', r' (con Elan de más de 60) \1', t)
    m = re.fullmatch(r'K(\d+)', t)
    if m:  # «Bono final»: su propia fórmula, sin el «× aprendida».
        t = wbf['Tablas'][f'K{m[1]}'].value.lstrip('=')
        t = re.sub(r'\*J\$?\d+|J\$?\d+\*', '', t)
        t = re.sub(r'IF\(J\d+>0,1,0\)', '1', t)
    t = re.sub(r'FLOOR\(([^,()]*),5\)', r'\1, a múltiplos de 5', t)
    t = re.sub(r'(?:FLOOR|ROUNDDOWN)\(([^,()]*),[01]\)', r'\1', t)
    t = re.sub(r'\$?F\$?\d+', 'Elan', t)
    if re.search(r'[A-Z]{2,}\(|[A-Z]\$?\d', t):
        raise ValueError(f'Elan sin traducir: {t}')
    return t.replace('*', '×').replace('+', ' + ').replace('-', ' − ')


def descripcion_elan(formula):
    trozos, actual, comillas, nivel = [], '', False, 0
    for ch in formula.lstrip('='):
        if ch == '"':
            comillas = not comillas
        if not comillas:
            nivel += ch == '('
            nivel -= ch == ')'
        if ch == '&' and not comillas and nivel == 0:
            trozos.append(actual)
            actual = ''
            continue
        actual += ch
    trozos.append(actual)
    salida = ''
    for t in trozos:
        if t.startswith('"'):
            salida += t.strip('"')
        else:
            e = expresion_elan(t, None)
            salida += e if e.startswith('1 vez') or e.startswith('(con') else f'[{e}]'
    return salida


elan, patron = [], None
for r in range(1764, 1964):
    v = [clean(wb['Tablas'].cell(r, c).value) for c in range(5, 13)]
    if v[0] is None:
        continue
    if v[2] == 'Elan':          # fila cabecera de bloque: nombra al patrón
        patron = v[0]
        continue
    poder = {'patron': patron, 'nombre': v[0], 'elan': v[2], 'coste': v[4], 'descripcion': v[7]}
    h = wbf['Tablas'][f'H{r}'].value
    m = re.fullmatch(r'=IF\(J(\d+)(?:=1)?,1,0\)', h) if isinstance(h, str) else None
    if m:
        poder['requisito'] = clean(wb['Tablas'][f'E{m[1]}'].value)
    l = wbf['Tablas'][f'L{r}'].value
    if isinstance(l, str) and l.startswith('=') and patron != 'Elan Personalizado':
        poder['descripcion'] = descripcion_elan(l)
    elan.append(poder)
data['elan'] = [e for e in elan if e['patron'] != 'Elan Personalizado']

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
    {'valor': clean(r[0].value), 'bonoRotura': clean(r[1].value),
     'pesoKg': clean(r[2].value), 'pesoMaxKg': clean(r[3].value)}
    for r in cells('Tablas', '$G$14:$J$33')]
# Tabla 53: Acumulación de Ki base. Vale para **cualquiera** de las seis
# características acumulables, no sólo para POD: 1-9 → 1, 10-12 → 2, 13-15 → 3, 16+ → 4.
base['acumulacionKi'] = [
    {'valor': clean(r[0].value), 'acumulacion': clean(r[1].value)}
    for r in cells('Tablas', '$P$14:$Q$33') if clean(r[0].value)]
# Tabla 68 del manual: Potencial Psíquico base según VOL.
base['potencialPsiquico'] = [
    {'VOL': clean(r[0].value), 'potencial': clean(r[1].value)}
    for r in cells('Tablas', '$W$1064:$X$1083') if clean(r[0].value)]
# Tabla 70: incrementar el Potencial gastando CV (CV acumulados -> bono).
base['potencialPorCV'] = [
    {'CVacumulados': clean(r[0].value), 'bono': clean(r[1].value)}
    for r in cells('Tablas', '$L$1104:$M$1113') if clean(r[0].value)]
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
# Tabla_Regen: la CON da el nivel de Regeneración (C:D) y cada nivel, lo que se recupera
# (I: cantidad, F: unidad, G: reducción de penalizadores, H: especial). Principal!J11.
base['regeneracion'] = {
    'porCON': [[clean(r[0].value), clean(r[1].value)]
               for r in cells('Tablas', '$C$38:$D$57') if clean(r[0].value) is not None],
    # Las filas van por CON, así que un mismo nivel sale varias veces: basta la primera.
    'niveles': list({
        clean(r[1].value): {'nivel': clean(r[1].value), 'cantidad': clean(r[6].value),
                            'unidad': clean(r[3].value), 'reduccion': clean(r[4].value),
                            'especial': clean(r[5].value)}
        for r in reversed(cells('Tablas', '$C$38:$I$65'))}.values())[::-1],
}
# Tabla_TipoMovimiento: el Tipo de Movimiento y lo que avanza por asalto. Principal!K17.
base['movimiento'] = [[clean(r[0].value), clean(r[1].value)] for r in cells('Tablas', '$J$38:$K$57')]
base['experienciaNecesaria'] = {
    'nota': 'fila = nivel actual; columnas = ajuste de nivel 0..10',
    'filas': [[clean(c.value) for c in r] for r in cells('Tablas', '$P$69:$AA$99')]}
# Tabla de Armas Enormes y Gigantes: por debajo del «Tamaño mínimo» el arma es demasiado
# grande; por debajo del «Tamaño no pen.», −40 al turno (`Combate!AW40`, `J32`).
base['armasEnormes'] = [
    {'tamano': clean(r[0].value), 'tamanoMinimo': clean(r[1].value),
     'tamanoMin': clean(r[2].value), 'penFUE': clean(r[3].value),
     'multDano': clean(r[4].value), 'enterezaExtra': clean(r[5].value),
     'roturaExtra': clean(r[6].value)}
    for r in cells('Tablas', '$AE$598:$AK$600') if clean(r[0].value)]
# Tabla_CreaciónSeres: lo que va con el Tamaño (FUE+CON) de un ser. De aquí salen el daño,
# la rotura y la entereza de las Armas naturales que dependen del Tamaño.
base['creacionSeres'] = [
    {'tamano': clean(r[0].value), 'nombre': clean(r[1].value), 'turnoBase': clean(r[2].value),
     'tipoMovimiento': clean(r[3].value), 'multAcumulacion': clean(r[4].value),
     'armadura': clean(r[5].value), 'ataqueFisico': clean(r[6].value),
     'armaNatural': clean(r[7].value), 'rotura': clean(r[8].value), 'entereza': clean(r[9].value)}
    for r in cells('Tablas', '$W$47:$AF$54')]
# Las Armas naturales de cada raza. La hoja no las tiene en una tabla sino escritas en las
# fórmulas de la fila «Armas naturales» (`Tablas!E639:N639`); se copian tal cual.
# «'tamaño'» en el daño quiere decir: la columna Arma Natural de `creacionSeres`.
# Sin entereza ni rotura propias, las del Tamaño.
base['armasNaturales'] = [
    {'raza': 'Ebudan', 'dano': 60, 'critico1': 'FIL', 'critico2': '-', 'tipoArma': 'Mandoble/-',
     'entereza': 20, 'rotura': 5},
    {'raza': 'Tuan Dalyr', 'dano': 40, 'critico1': '-', 'critico2': '-'},
    {'raza': 'Turak', 'dano': 40, 'critico1': 'FIL', 'critico2': '-'},
    {'raza': 'Daimah', 'dano': 30, 'critico1': 'FIL', 'critico2': 'PEN'},
    # La hoja escribe «Nehpilim Turak» en el primer crítico (`Tablas!I639`), así que a un
    # Nephilim Turak no le pone FIL: se deja como la hoja.
    {'raza': 'Nephilim Turak', 'dano': 30, 'critico1': '-', 'critico2': '-'},
    {'raza': 'Jayán', 'dano': 'tamaño', 'critico1': 'FIL', 'critico2': 'PEN'},
    # El Legado de Sangre «Armas Naturales» (`Tablas!P256`): 40, +25 por Daño incrementado.
    {'legado': 'Armas Naturales', 'dano': 40, 'critico1': '-', 'critico2': '-'},
]
base['tipologias'] = [[clean(c.value) for c in r] for r in cells('Tablas', '$X$603:$AA$614')]
# Arcana Exxet, cap. 7: los ocho tipos de Sheele y su tabla de Potenciación Mística.
base['tiposSheele'] = TIPOS_SHEELE_DATOS
base['potenciacionSheele'] = POTENCIACION_SHEELE
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
    json.dump({'fuente': 'Ficha_Anima_v8.7.0.xlsm', 'conjuntos': index}, fh,
              ensure_ascii=False, indent=1)
