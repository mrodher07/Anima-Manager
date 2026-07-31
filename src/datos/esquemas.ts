/**
 * Qué campos tiene cada cosa que una mesa puede inventarse.
 *
 * La ficha original dedica una hoja entera a esto —armas, armaduras, ventajas, habilidades
 * esenciales, poderes de criatura, raíces culturales, idiomas, técnicas…— y las razas se
 * añaden editando la tabla oculta. Aquí está descrito como datos para que un único editor
 * sirva para todo: al añadir una colección nueva basta con describirla.
 */

import type { NombreColeccion } from './tipos';

export type TipoCampo = 'texto' | 'numero' | 'parrafo' | 'opcion';

export interface Campo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Para `opcion`. */
  opciones?: string[];
  /** Texto de ayuda dentro del propio campo. */
  pista?: string;
  /** Agrupa campos en filas compactas (por ejemplo las ocho características). */
  grupo?: string;
  ancho?: number;
}

export interface EsquemaColeccion {
  coleccion: NombreColeccion;
  /** Cómo llamarlo en singular y en plural, para la interfaz. */
  singular: string;
  plural: string;
  /** Campo que hace de nombre. Repetirlo sustituye a la entrada oficial. */
  clave: string;
  ayuda: string;
  campos: Campo[];
}

const CARACTERISTICAS = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'];
const RESISTENCIAS = ['RF', 'RE', 'RV', 'RM', 'RP'];
const TIPOS_DANO = ['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'];

const num = (clave: string, etiqueta: string, grupo?: string, ancho = 70): Campo => ({
  clave, etiqueta, tipo: 'numero', grupo, ancho,
});
const txt = (clave: string, etiqueta: string, pista?: string): Campo => ({
  clave, etiqueta, tipo: 'texto', pista,
});

export const ESQUEMAS: EsquemaColeccion[] = [
  {
    coleccion: 'razas',
    singular: 'raza',
    plural: 'Razas',
    clave: 'raza',
    ayuda:
      'Razas que no vienen en ningún manual. Los modificadores funcionan igual que los de ' +
      'las oficiales.',
    campos: [
      txt('raza', 'Nombre', 'Moguri, Bangaa, Viera…'),
      ...CARACTERISTICAS.map((c) => num(c, c, 'Características')),
      ...RESISTENCIAS.map((r) => num(r, r, 'Resistencias')),
      num('tamano', 'Tamaño', 'Otros'),
      num('regeneracion', 'Regeneración', 'Otros', 84),
      num('cansancio', 'Cansancio', 'Otros', 84),
      num('ajusteNivel', 'Ajuste de nivel', 'Otros', 96),
      num('natura', 'Natura', 'Otros'),
      { clave: 'descripciones', etiqueta: 'Capacidades raciales', tipo: 'parrafo',
        pista: 'Se muestran como recordatorio; no modifican números.' },
    ],
  },
  {
    coleccion: 'categorias',
    singular: 'categoría',
    plural: 'Categorías',
    clave: 'categoria',
    ayuda:
      'Categorías propias. Los límites van en tanto por uno: 0,5 es el 50 % y 0,6 el 60 %. ' +
      'Los costes son PD por punto de habilidad.',
    campos: [
      txt('categoria', 'Nombre'),
      num('turno', 'Turno', 'Bonos por nivel'),
      num('PV', 'PV', 'Bonos por nivel'),
      num('bonoZeon', 'Zeón', 'Bonos por nivel'),
      num('conocimientoMarcial', 'CM', 'Bonos por nivel'),
      num('bonoHA', 'H. Ataque', 'Bonos por nivel', 84),
      num('bonoHP', 'H. Parada', 'Bonos por nivel', 84),
      num('bonoHE', 'H. Esquiva', 'Bonos por nivel', 84),
      num('bonoLlevarArmadura', 'Llev. Armadura', 'Bonos por nivel', 96),
      num('limiteCombate', 'Combate', 'Límites', 78),
      num('limiteMagia', 'Mística', 'Límites', 78),
      num('limitePsi', 'Psíquica', 'Límites', 78),
      num('costeHA', 'H. Ataque', 'Costes', 84),
      num('costeHP', 'H. Parada', 'Costes', 84),
      num('costeHE', 'H. Esquiva', 'Costes', 84),
      num('costeLlevarArmadura', 'Llev. Armadura', 'Costes', 96),
      num('costeZeon', 'Zeón', 'Costes'),
      num('costeACT', 'ACT', 'Costes'),
      num('costeProyeccionMagica', 'Proy. Mágica', 'Costes', 90),
      num('costeCV', 'CV', 'Costes'),
      num('costeProyeccionPsiquica', 'Proy. Psíquica', 'Costes', 96),
      num('costeKi', 'Ki', 'Costes'),
      num('costeAcumKi', 'Acum. Ki', 'Costes', 84),
      num('costeAtleticas', 'Atléticas', 'Costes de secundarias', 84),
      num('costeSociales', 'Sociales', 'Costes de secundarias', 84),
      num('costePerceptivas', 'Perceptivas', 'Costes de secundarias', 90),
      num('costeIntelectuales', 'Intelectuales', 'Costes de secundarias', 96),
      num('costeVigor', 'Vigor', 'Costes de secundarias'),
      num('costeSubterfugio', 'Subterfugio', 'Costes de secundarias', 90),
      num('costeCreativas', 'Creativas', 'Costes de secundarias', 84),
      { clave: 'arquetipo1', etiqueta: 'Arquetipo 1', tipo: 'opcion',
        opciones: ['Sin', 'Luchador', 'Acechador', 'Místico', 'Psíquico', 'Domine'] },
      { clave: 'arquetipo2', etiqueta: 'Arquetipo 2', tipo: 'opcion',
        opciones: ['Sin', 'Luchador', 'Acechador', 'Místico', 'Psíquico', 'Domine'] },
    ],
  },
  {
    coleccion: 'ventajas',
    singular: 'ventaja',
    plural: 'Ventajas y desventajas',
    clave: 'nombre',
    ayuda:
      'Coste en Puntos de Creación: positivo para una ventaja, negativo para una desventaja. ' +
      'Su efecto lo aplicáis vosotros, o lo anotas en la columna «Esp.» de la ficha.',
    campos: [
      txt('nombre', 'Nombre'),
      num('coste', 'Coste en PC', undefined, 90),
      { clave: 'tipo', etiqueta: 'Tipo', tipo: 'opcion',
        opciones: ['Comunes', 'Trasfondo', 'Don', 'Psíquicas'] },
    ],
  },
  {
    coleccion: 'habilidadesEsenciales',
    singular: 'habilidad esencial',
    plural: 'Habilidades esenciales',
    clave: 'nombre',
    ayuda: 'Se compran con PD y pueden exigir un mínimo de Gnosis.',
    campos: [
      txt('nombre', 'Nombre'),
      num('gnosis', 'Gnosis mínima', undefined, 100),
      num('coste', 'Coste en PD', undefined, 90),
    ],
  },
  {
    coleccion: 'poderesCriatura',
    singular: 'poder de criatura',
    plural: 'Poderes de criatura',
    clave: 'nombre',
    ayuda: 'Para criaturas y seres creados.',
    campos: [
      txt('nombre', 'Nombre'),
      num('gnosis', 'Gnosis mínima', undefined, 100),
      num('coste', 'Coste en PD', undefined, 90),
    ],
  },
  {
    coleccion: 'armas',
    singular: 'arma',
    plural: 'Armas',
    clave: 'arma',
    ayuda: 'Los huecos «Arma #1, #2, #3» de la ficha original, sin límite de número.',
    campos: [
      txt('arma', 'Nombre'),
      num('dano', 'Daño', 'Valores'),
      num('turno', 'Turno', 'Valores'),
      num('fueRequerida', 'FUE 1 mano', 'Valores', 90),
      num('fueReq2M', 'FUE 2 manos', 'Valores', 96),
      num('entereza', 'Entereza', 'Valores', 84),
      num('rotura', 'Rotura', 'Valores'),
      num('presencia', 'Presencia', 'Valores', 84),
      num('bonusParada', 'Bono Parada', 'Valores', 96),
      num('bonusEsquiva', 'Bono Esquiva', 'Valores', 96),
      { clave: 'critico1', etiqueta: 'Crítico 1', tipo: 'opcion', opciones: ['-', ...TIPOS_DANO] },
      { clave: 'critico2', etiqueta: 'Crítico 2', tipo: 'opcion', opciones: ['-', ...TIPOS_DANO] },
      txt('tipoArma', 'Tipo de arma', 'Espada/Corta'),
      { clave: 'conocida', etiqueta: 'Conocimiento', tipo: 'opcion',
        opciones: ['Conocida', 'Similar', 'Mixta', 'Distinta'] },
      { clave: 'tamano', etiqueta: 'Tamaño', tipo: 'opcion',
        opciones: ['Pequeña', 'Mediana', 'Grande'] },
      txt('alcance', 'Alcance'),
      txt('cadencia', 'Cadencia'),
      txt('recarga', 'Recarga'),
      { clave: 'especial', etiqueta: 'Especial', tipo: 'parrafo' },
    ],
  },
  {
    coleccion: 'armaduras',
    singular: 'armadura',
    plural: 'Armaduras',
    clave: 'armadura',
    ayuda: 'Protecciones propias, con su TA contra cada tipo de daño.',
    campos: [
      txt('armadura', 'Nombre'),
      num('requerimiento', 'Requerimiento', 'Valores', 100),
      num('penNatural', 'Pen. Natural', 'Valores', 96),
      num('restMovimiento', 'Rest. Movimiento', 'Valores', 110),
      num('entereza', 'Entereza', 'Valores', 84),
      num('presencia', 'Presencia', 'Valores', 84),
      ...TIPOS_DANO.map((t) => num(t, t, 'Tipo de Armadura', 58)),
      txt('localizacion', 'Localización', 'Completa, Camisola, Cabeza…'),
      { clave: 'clase', etiqueta: 'Clase', tipo: 'opcion', opciones: ['Blanda', 'Dura', 'Natural'] },
    ],
  },
  {
    coleccion: 'yelmos',
    singular: 'yelmo',
    plural: 'Yelmos',
    clave: 'yelmo',
    ayuda: 'Protecciones de cabeza.',
    campos: [
      txt('yelmo', 'Nombre'),
      num('requerimiento', 'Requerimiento', 'Valores', 100),
      num('penNatural', 'Pen. Natural', 'Valores', 96),
      num('entereza', 'Entereza', 'Valores', 84),
      num('presencia', 'Presencia', 'Valores', 84),
      ...TIPOS_DANO.map((t) => num(t, t, 'Tipo de Armadura', 58)),
    ],
  },
  {
    coleccion: 'artesMarciales',
    singular: 'arte marcial',
    plural: 'Artes marciales',
    clave: 'arte',
    ayuda: 'Estilos de combate sin armas.',
    campos: [
      txt('arte', 'Nombre'),
      num('danoBase', 'Daño base', 'Valores', 90),
      num('bonoDano', 'Bono al daño', 'Valores', 96),
      num('CM', 'CM necesario', 'Valores', 100),
      num('bonoAtaque', 'Bono Ataque', 'Valores', 96),
      num('bonoParada', 'Bono Parada', 'Valores', 96),
      num('bonoEsquiva', 'Bono Esquiva', 'Valores', 96),
      num('bonoTurno', 'Bono Turno', 'Valores', 92),
      { clave: 'critico1', etiqueta: 'Crítico 1', tipo: 'opcion', opciones: ['-', ...TIPOS_DANO] },
      { clave: 'critico2', etiqueta: 'Crítico 2', tipo: 'opcion', opciones: ['-', ...TIPOS_DANO] },
      { clave: 'requisitos', etiqueta: 'Requisitos', tipo: 'parrafo' },
      { clave: 'especial', etiqueta: 'Especial', tipo: 'parrafo' },
    ],
  },
  {
    coleccion: 'arsMagnus',
    singular: 'Ars Magnus',
    plural: 'Ars Magnus',
    clave: 'nombre',
    ayuda: 'Técnicas marciales avanzadas.',
    campos: [
      txt('nombre', 'Nombre'),
      num('PD', 'Coste en PD', 'Valores', 90),
      num('CM', 'CM necesario', 'Valores', 100),
      { clave: 'requisitos', etiqueta: 'Requisitos', tipo: 'parrafo' },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'parrafo' },
    ],
  },
  {
    coleccion: 'conjuros',
    singular: 'conjuro',
    plural: 'Conjuros',
    clave: 'conjuro',
    ayuda: 'Conjuros propios, con su coste en Zeón por grado.',
    campos: [
      txt('conjuro', 'Nombre'),
      txt('via', 'Vía', 'Luz, Fuego, Nigromancia…'),
      num('nivel', 'Nivel', 'Valores'),
      { clave: 'tipo', etiqueta: 'Tipo', tipo: 'opcion',
        opciones: ['Efecto', 'Ataque', 'Anímico', 'Detección', 'Automático', 'Espiritual'] },
      { clave: 'accion', etiqueta: 'Acción', tipo: 'opcion', opciones: ['Activa', 'Pasiva'] },
      { clave: 'diario', etiqueta: '¿Diario?', tipo: 'opcion', opciones: ['Sí', 'No'] },
      num('zeonBase', 'Zeón Base', 'Coste en Zeón', 92),
      num('zeonIntermedio', 'Intermedio', 'Coste en Zeón', 92),
      num('zeonAvanzado', 'Avanzado', 'Coste en Zeón', 92),
      num('zeonArcano', 'Arcano', 'Coste en Zeón', 92),
      num('intRBase', 'Base', 'Intensidad requerida', 78),
      num('intRIntermedio', 'Intermedio', 'Intensidad requerida', 92),
      num('intRAvanzado', 'Avanzado', 'Intensidad requerida', 92),
      num('intRArcano', 'Arcano', 'Intensidad requerida', 92),
      { clave: 'efectoBase', etiqueta: 'Efecto en grado Base', tipo: 'parrafo' },
      { clave: 'efecto', etiqueta: 'Descripción', tipo: 'parrafo' },
    ],
  },
  {
    coleccion: 'poderesPsiquicos',
    singular: 'poder psíquico',
    plural: 'Poderes psíquicos',
    clave: 'poder',
    ayuda: 'Cada casilla es lo que consigue el poder en ese grado de dificultad.',
    campos: [
      txt('poder', 'Nombre'),
      txt('disciplina', 'Disciplina', 'Telepatía, Piroquinesis…'),
      num('nivel', 'Nivel', 'Valores'),
      { clave: 'mantenido', etiqueta: '¿Mantenido?', tipo: 'opcion', opciones: ['Sí', 'No'] },
      { clave: 'accion', etiqueta: 'Acción', tipo: 'opcion', opciones: ['Activa', 'Pasiva'] },
      ...['RUT', 'FAC', 'MED', 'DIF', 'MDF', 'ABS', 'CIM', 'IMP', 'INH', 'ZEN'].map((d) =>
        txt(d, d),
      ),
    ],
  },
  {
    coleccion: 'disciplinasPsiquicas',
    singular: 'disciplina psíquica',
    plural: 'Disciplinas psíquicas',
    clave: 'disciplina',
    ayuda: 'Los modificadores describen cómo el entorno afecta al Potencial.',
    campos: [
      txt('disciplina', 'Nombre'),
      { clave: 'modificadores', etiqueta: 'Modificadores', tipo: 'parrafo' },
    ],
  },
  {
    coleccion: 'elan',
    singular: 'poder de Elan',
    plural: 'Elan',
    clave: 'nombre',
    ayuda: 'Dones de los Señores. El patrón agrupa los poderes de un mismo Señor.',
    campos: [
      txt('nombre', 'Nombre'),
      txt('patron', 'Patrón', 'Mikael, Erebus, Jedah…'),
      num('elan', 'Elan necesario', 'Valores', 100),
      num('requisito', 'Requisito', 'Valores', 90),
      num('coste', 'Coste', 'Valores'),
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'parrafo' },
    ],
  },
];

export function esquemaDe(coleccion: NombreColeccion): EsquemaColeccion | undefined {
  return ESQUEMAS.find((e) => e.coleccion === coleccion);
}
