/**
 * Teoremas de Magia. Arcana Exxet, cap. 2.
 *
 * Un Teorema es una forma alternativa de formular la magia. La regla que lo ordena todo es
 * que **un personaje sólo puede usar uno**: puede conocer los demás, pero no beneficiarse
 * de sus reglas especiales. Por eso el Teorema es un campo de la ficha, no una lista.
 *
 * De los cuatro, tres traen cuentas que merecen calculadora —Onmyodo la creación de
 * Ofudas, Vodoun el bono de los Vínculos, Magia natural la dificultad de un efecto— y el
 * cuarto, Shamanica, es sobre todo una tabla de sitios. Lo que **no** se calcula aquí es
 * qué nivel tiene un efecto natural ni si los espíritus de un sitio son afines: eso lo
 * decide el Director, y la aplicación se limita a preguntárselo.
 */

export const TEOREMAS = ['General', 'Onmyodo', 'Vodoun', 'Shamanica', 'Magia natural'] as const;
export type Teorema = (typeof TEOREMAS)[number];

// ─────────────────────────── Onmyodo ───────────────────────────

/** Tabla 3: dificultad del control de Caligrafía Ritual por nivel de conjuro. */
export const CALIGRAFIA_RITUAL: { desde: number; hasta: number; dificultad: number }[] = [
  { desde: 2, hasta: 20, dificultad: 40 },
  { desde: 22, hasta: 30, dificultad: 80 },
  { desde: 32, hasta: 40, dificultad: 120 },
  { desde: 42, hasta: 50, dificultad: 140 },
  { desde: 52, hasta: 60, dificultad: 180 },
  { desde: 62, hasta: 70, dificultad: 240 },
  { desde: 72, hasta: 80, dificultad: 320 },
  { desde: 82, hasta: 90, dificultad: 440 },
];

/** Tabla 4: bono por el tiempo dedicado al Ofuda. */
export const TIEMPO_OFUDA: { tiempo: string; modificador: number }[] = [
  { tiempo: 'Un minuto', modificador: -40 },
  { tiempo: 'Cinco minutos', modificador: -20 },
  { tiempo: 'Media hora', modificador: 0 },
  { tiempo: 'Una hora', modificador: 20 },
  { tiempo: 'Un día', modificador: 40 },
  { tiempo: 'Una semana', modificador: 80 },
  { tiempo: 'Un mes', modificador: 120 },
];

export interface Ofuda {
  /** Lo que hay que sacar en el control de Caligrafía Ritual. */
  dificultad: number;
  dificultadBase: number;
  porTiempo: number;
  /** Zeon que se introduce, y que es el que aporta al lanzar. */
  zeonInvertido: number;
  /** Mientras el Ofuda exista, el Zeon Máximo del creador baja en esa misma cantidad. */
  reduccionZeonMaximo: number;
  /** El manual no da dificultad por encima de nivel 90. */
  fueraDeTabla: boolean;
}

/**
 * Crear un Ofuda.
 *
 * `costeBase` es el coste del conjuro en Grado Base; dentro se introduce **la mitad**, y no
 * cabe más: pasarse quema el talismán de inmediato. Esa misma cantidad se le descuenta al
 * creador de su Zeon Máximo hasta que el Ofuda se consuma o lo destruyan.
 */
export function crearOfuda(nivelConjuro: number, costeBase: number, tiempo: string): Ofuda {
  const fila = CALIGRAFIA_RITUAL.find((f) => nivelConjuro >= f.desde && nivelConjuro <= f.hasta);
  const porTiempo = TIEMPO_OFUDA.find((t) => t.tiempo === tiempo)?.modificador ?? 0;
  const dificultadBase = fila?.dificultad ?? 0;
  // La mitad de un coste impar se redondea hacia abajo: no se puede meter «más de la mitad».
  const zeonInvertido = Math.floor(Math.max(costeBase, 0) / 2);
  return {
    dificultadBase,
    porTiempo,
    dificultad: dificultadBase + porTiempo,
    zeonInvertido,
    reduccionZeonMaximo: zeonInvertido,
    fueraDeTabla: !fila,
  };
}

/** Lo que cuesta lanzar sin el Ofuda apropiado: el doble, y sólo en Grado Base. */
export function costeSinOfuda(costeBase: number): { coste: number; soloGradoBase: true } {
  return { coste: costeBase * 2, soloGradoBase: true };
}

/**
 * Un Ofuda de otro conjuro sirve si es de la **misma Vía** y **no de nivel inferior**.
 * Entonces se puede lanzar en cualquier Grado, pero sin aprovechar su Zeon y al doble.
 */
export function ofudaSirve(
  ofuda: { via: string; nivel: number },
  conjuro: { via: string; nivel: number },
): boolean {
  return ofuda.via === conjuro.via && ofuda.nivel >= conjuro.nivel;
}

// ─────────────────────────── Vodoun ───────────────────────────

export const VINCULOS_FISICOS: { vinculo: string; bono: number; incompatibleCon?: string }[] = [
  { vinculo: 'Pelo', bono: 10 },
  { vinculo: 'Sangre', bono: 20 },
  { vinculo: 'Un pedazo de su cuerpo', bono: 20 },
  { vinculo: 'Objeto personal', bono: 10, incompatibleCon: 'Objeto personal mayor' },
  { vinculo: 'Objeto personal mayor', bono: 20, incompatibleCon: 'Objeto personal' },
  { vinculo: 'Un retrato', bono: 10 },
  { vinculo: 'Un familiar directo', bono: 30, incompatibleCon: 'Restos de un familiar directo' },
  { vinculo: 'Restos de un familiar directo', bono: 10, incompatibleCon: 'Un familiar directo' },
];

/** El objetivo de un Ritual de Vinculación gana esto a su RM. */
export const BONO_RM_VINCULACION = 40;
/** Y esto si el ritual se hace a gran distancia, sin verle. */
export const BONO_RM_VINCULACION_LEJOS = 100;
/** Un ritual a distancia dura una hora por cada tantos kilómetros. */
export const KM_POR_HORA_DE_RITUAL = 25;

export interface EleccionVodoun {
  vinculos: string[];
  /** Gastar un vínculo para que el conjuro alcance al objetivo sin Proyección Mágica. */
  ritualDeVinculacion?: boolean;
  /** El objetivo no está a la vista. Requiere saber su nombre y su aspecto. */
  granDistancia?: boolean;
  kilometros?: number;
}

export interface ResultadoVodoun {
  /** Suma de los vínculos que sí aportan bono. */
  bonoRM: number;
  /** Lo que el objetivo suma a su RM por no haberle fijado con Proyección Mágica. */
  bonoRMObjetivo: number;
  /** Diferencia neta a favor del brujo. */
  neto: number;
  /** El vínculo que se consume para vincular el hechizo, y que por tanto no da bono. */
  gastadoEnVincular: string | null;
  automatico: boolean;
  horasDeRitual: number;
  avisos: string[];
}

/**
 * Bono de los Vínculos físicos y coste del Ritual de Vinculación.
 *
 * Dos matices del manual que la calculadora respeta y que es fácil pasar por alto:
 *  - No se pueden usar **dos vínculos del mismo tipo**, y hay parejas que tampoco se apilan
 *    entre sí (objeto personal con el mayor, familiar directo con sus restos).
 *  - En el Ritual de Vinculación, el vínculo que se gasta en enlazar el hechizo **no aporta
 *    su bono**: sólo sirve para alcanzar al blanco. Se gasta el de menor bono, que es lo
 *    que le conviene al brujo.
 */
export function calcularVodoun(eleccion: EleccionVodoun): ResultadoVodoun {
  const avisos: string[] = [];
  const unicos = [...new Set(eleccion.vinculos)];
  if (unicos.length !== eleccion.vinculos.length) {
    avisos.push('No se pueden usar dos Vínculos del mismo tipo; los repetidos se ignoran.');
  }

  let validos = unicos.filter((v) => VINCULOS_FISICOS.some((x) => x.vinculo === v));
  for (const v of [...validos]) {
    const incompatible = VINCULOS_FISICOS.find((x) => x.vinculo === v)?.incompatibleCon;
    if (incompatible && validos.includes(incompatible)) {
      // Se queda el de más bono, que es la lectura que favorece al brujo.
      const bonoDe = (n: string) => VINCULOS_FISICOS.find((x) => x.vinculo === n)?.bono ?? 0;
      const peor = bonoDe(v) < bonoDe(incompatible) ? v : incompatible;
      validos = validos.filter((x) => x !== peor);
      avisos.push(`«${v}» y «${incompatible}» no se apilan; se cuenta sólo el de más bono.`);
    }
  }

  let gastadoEnVincular: string | null = null;
  if (eleccion.ritualDeVinculacion) {
    if (validos.length === 0) {
      avisos.push('El Ritual de Vinculación necesita al menos un Vínculo físico que consumir.');
    } else {
      const bonoDe = (n: string) => VINCULOS_FISICOS.find((x) => x.vinculo === n)?.bono ?? 0;
      gastadoEnVincular = [...validos].sort((a, b) => bonoDe(a) - bonoDe(b))[0];
      validos = validos.filter((v) => v !== gastadoEnVincular);
    }
  }

  const bonoRM = validos.reduce(
    (t, v) => t + (VINCULOS_FISICOS.find((x) => x.vinculo === v)?.bono ?? 0),
    0,
  );

  const automatico = Boolean(eleccion.ritualDeVinculacion && gastadoEnVincular);
  const bonoRMObjetivo = automatico
    ? eleccion.granDistancia
      ? BONO_RM_VINCULACION_LEJOS
      : BONO_RM_VINCULACION
    : 0;

  const horasDeRitual =
    automatico && eleccion.granDistancia
      ? Math.ceil(Math.max(eleccion.kilometros ?? 0, 0) / KM_POR_HORA_DE_RITUAL)
      : 0;

  return {
    bonoRM,
    bonoRMObjetivo,
    neto: bonoRM - bonoRMObjetivo,
    gastadoEnVincular,
    automatico,
    horasDeRitual,
    avisos,
  };
}

/** Debilidad ofensiva: el daño final se reduce a la mitad, redondeando en grupos de 5 arriba. */
export function danoVodoun(danoFinal: number): number {
  return Math.ceil(danoFinal / 2 / 5) * 5;
}

// ─────────────────────────── Shamanica ───────────────────────────

export const ZONAS_ESPIRITUALES = [
  'Excepcional',
  'Poderosa',
  'Normal',
  'Débil',
  'Vacía',
] as const;
export type ZonaEspiritual = (typeof ZONAS_ESPIRITUALES)[number];

/** Lo que cuesta llamar espíritus **desde** cada zona, para subirla un grado. */
export const COSTE_LLAMAR: Record<ZonaEspiritual, number | null> = {
  Excepcional: null, // ya es el grado máximo
  Poderosa: 500,
  Normal: 200,
  Débil: 200,
  Vacía: 1000,
};

export type Afinidad = 'Afines' | 'Neutrales' | 'Opuestos';
const GRADOS_CONJURO = ['Base', 'Intermedio', 'Avanzado', 'Arcano'] as const;
export type GradoConjuro = (typeof GRADOS_CONJURO)[number];

export interface ResultadoShamanica {
  /** La zona en la que se acaba lanzando, tras llamar espíritus si se ha hecho. */
  zona: ZonaEspiritual;
  zeonLlamada: number;
  /** Grado en el que sale finalmente el conjuro. */
  grado: GradoConjuro | null;
  /** true si el conjuro fracasa automáticamente. */
  fracasa: boolean;
  mitadDeZeon: boolean;
  bonoACT: number;
  avisos: string[];
}

/**
 * Dónde acaba un conjuro shamánico.
 *
 * `zonaOriginal` es la que tiene el sitio por naturaleza, y hace falta aparte de la actual
 * porque el manual es explícito: *«una Zona Espiritual mantiene siempre su condición
 * original… no se puede aumentar de grado un lugar que ya se encuentra en un grado superior
 * al que tiene normalmente»*. Un chamán en una zona Débil puede subirla a Normal, pero no
 * seguir de ahí a Poderosa.
 */
export function calcularShamanica(
  zonaOriginal: ZonaEspiritual,
  llamarEspiritus: boolean,
  gradoPretendido: GradoConjuro,
  afinidad: Afinidad,
): ResultadoShamanica {
  const avisos: string[] = [];
  const i = ZONAS_ESPIRITUALES.indexOf(zonaOriginal);
  let zona = zonaOriginal;
  let zeonLlamada = 0;

  if (llamarEspiritus) {
    const coste = COSTE_LLAMAR[zonaOriginal];
    if (coste === null) {
      avisos.push('Una Zona Excepcional ya es el grado máximo: no hay nada que llamar.');
    } else {
      zona = ZONAS_ESPIRITUALES[i - 1];
      zeonLlamada = coste;
      avisos.push(
        `La zona sube a ${zona} por ${coste} Zeon, pero sigue siendo originalmente ` +
          `${zonaOriginal}: desde aquí ya no se puede subir más.`,
      );
    }
  }

  if (zona === 'Vacía') {
    return {
      zona,
      zeonLlamada,
      grado: null,
      fracasa: true,
      mitadDeZeon: false,
      bonoACT: 0,
      avisos: [...avisos, 'En una Zona Vacía no hay espíritus: no se puede lanzar nada.'],
    };
  }

  // Techo de grado que impone la zona.
  const techo: Record<Exclude<ZonaEspiritual, 'Vacía'>, GradoConjuro> = {
    Excepcional: 'Arcano',
    Poderosa: 'Arcano',
    Normal: 'Avanzado',
    Débil: 'Base',
  };
  const limite = GRADOS_CONJURO.indexOf(techo[zona as Exclude<ZonaEspiritual, 'Vacía'>]);
  let g = GRADOS_CONJURO.indexOf(gradoPretendido);
  if (g > limite) {
    avisos.push(`Una Zona ${zona} no da para grado ${gradoPretendido}; se queda en ${GRADOS_CONJURO[limite]}.`);
    g = limite;
  }

  // La afinidad se aplica **después** del límite: el manual dice que los espíritus afines
  // permiten saltárselo.
  const cambio = afinidad === 'Afines' ? 1 : afinidad === 'Opuestos' ? -1 : 0;
  const final = g + cambio;

  if (final < 0) {
    return {
      zona,
      zeonLlamada,
      grado: null,
      fracasa: true,
      mitadDeZeon: zona === 'Poderosa' || zona === 'Excepcional',
      bonoACT: zona === 'Excepcional' ? 30 : 0,
      avisos: [
        ...avisos,
        'Con los espíritus opuestos, un conjuro de grado base fracasa automáticamente.',
      ],
    };
  }

  return {
    zona,
    zeonLlamada,
    grado: GRADOS_CONJURO[Math.min(final, GRADOS_CONJURO.length - 1)],
    fracasa: false,
    mitadDeZeon: zona === 'Poderosa' || zona === 'Excepcional',
    bonoACT: zona === 'Excepcional' ? 30 : 0,
    avisos,
  };
}

// ─────────────────────────── Magia natural ───────────────────────────

/** Tabla 6: dificultad base del control de Poder por nivel de efecto. */
export const NIVEL_EFECTO: Record<number, number> = { 1: 14, 2: 18, 3: 24, 4: 30, 5: 36 };

/** Tabla 7, primera mitad. */
export const DISTANCIA_EFECTO: { distancia: string; modificador: number }[] = [
  { distancia: 'Toque', modificador: 0 },
  { distancia: 'Objeto', modificador: 1 },
  { distancia: 'Proyectado +0', modificador: 1 },
  { distancia: 'Proyectado +40', modificador: 2 },
  { distancia: 'Proyectado +80', modificador: 3 },
  { distancia: 'Proyectado +120', modificador: 4 },
];

/** Tabla 7, segunda mitad. */
export const DURACION_EFECTO: { duracion: string; modificador: number }[] = [
  { duracion: 'Instantáneo', modificador: 0 },
  { duracion: '5 asaltos', modificador: 1 },
  { duracion: '1 minuto', modificador: 2 },
  { duracion: '10 minutos', modificador: 3 },
  { duracion: '1 hora', modificador: 4 },
  { duracion: '1 día', modificador: 5 },
];

/** Tabla 8: bono al control de Poder por el Zeon acumulado. */
export const ZEON_EFECTO: { zeon: number; bono: number }[] = [
  { zeon: 0, bono: -8 },
  { zeon: 20, bono: -4 },
  { zeon: 50, bono: 0 },
  { zeon: 100, bono: 2 },
  { zeon: 150, bono: 4 },
  { zeon: 200, bono: 6 },
  { zeon: 300, bono: 8 },
  { zeon: 400, bono: 10 },
  { zeon: 500, bono: 12 },
  { zeon: 750, bono: 14 },
  { zeon: 1000, bono: 16 },
];

export function bonoPorZeon(zeon: number): number {
  let bono = ZEON_EFECTO[0].bono;
  for (const f of ZEON_EFECTO) if (zeon >= f.zeon) bono = f.bono;
  return bono;
}

/** Tabla 9, ordenada de mejor a peor. */
export const RESULTADO_EFECTO: { desde: number; resultado: string; efecto: string }[] = [
  { desde: 3, resultado: '3+', efecto: 'Éxito, sin el más mínimo perjuicio para el lanzador.' },
  {
    desde: 1,
    resultado: '1+',
    efecto: 'Éxito, pero el lanzador pierde tantos puntos de cansancio como el nivel del efecto.',
  },
  { desde: 0, resultado: '0+', efecto: 'Éxito parcial: los poderes salen algo más débiles de lo esperado.' },
  {
    desde: -4,
    resultado: '-1 a -4',
    efecto: 'Fracaso; el lanzador pierde tantos puntos de cansancio como el nivel del efecto.',
  },
  {
    desde: -8,
    resultado: '-5 a -8',
    efecto:
      'Fracaso estrepitoso con consecuencias inesperadas. Pierde la mitad del Zeon que le ' +
      'quedaba y aplica -80 a toda acción, que se recupera a 10 puntos por hora.',
  },
  {
    desde: -Infinity,
    resultado: '-9 o inferior',
    efecto:
      'Fracaso absoluto: queda inconsciente varios días y pierde de forma irremediable ' +
      'tantos puntos de Poder como el nivel del efecto.',
  },
];

export function resultadoDe(margen: number): (typeof RESULTADO_EFECTO)[number] {
  return RESULTADO_EFECTO.find((r) => margen >= r.desde)!;
}

export const ESPECIALIDADES = [
  'Creador',
  'Destructor',
  'Transmutador',
  'Controlador',
  'Animista',
  'Sanador',
  'Elementalista',
  'Ilusionista',
] as const;
export type Especialidad = (typeof ESPECIALIDADES)[number];

/** Penalizador de la regla opcional «Un paso atrás». */
export const PENALIZADOR_UN_PASO_ATRAS = -4;

export interface EleccionEfectoNatural {
  nivel: number;
  distancia: string;
  duracion: string;
  zeon: number;
  /** +2 si el efecto cae dentro de su campo, -2 si no. */
  dentroDeSuEspecialidad?: boolean | null;
  /** El elementalista de un solo elemento gana +4, pero nada con el resto. */
  elementalistaPuro?: boolean;
  /** Un mago acostumbrado a conjuros que recurre a la magia natural. */
  unPasoAtras?: boolean;
}

export interface EfectoNatural {
  dificultadBase: number;
  porDistancia: number;
  porDuracion: number;
  /** Lo que hay que superar, antes de bonos al control. */
  dificultadFinal: number;
  bonoZeon: number;
  bonoEspecialidad: number;
  penalizacion: number;
  /** Todo lo que se suma a la tirada de Poder. */
  bonoTotal: number;
  fueraDeTabla: boolean;
}

/**
 * Dificultad y bonos de un efecto místico natural.
 *
 * El **nivel** del efecto no lo decide la aplicación: el manual dice que el jugador explica
 * lo que pretende y el Director le otorga un nivel de 1 a 5. Aquí se pregunta y ya está.
 */
export function calcularEfectoNatural(e: EleccionEfectoNatural): EfectoNatural {
  const dificultadBase = NIVEL_EFECTO[e.nivel] ?? 0;
  const porDistancia = DISTANCIA_EFECTO.find((d) => d.distancia === e.distancia)?.modificador ?? 0;
  const porDuracion = DURACION_EFECTO.find((d) => d.duracion === e.duracion)?.modificador ?? 0;

  const bonoZeon = bonoPorZeon(e.zeon);
  const bonoEspecialidad =
    e.dentroDeSuEspecialidad === null || e.dentroDeSuEspecialidad === undefined
      ? 0
      : e.dentroDeSuEspecialidad
        ? e.elementalistaPuro
          ? 4
          : 2
        : e.elementalistaPuro
          ? 0
          : -2;
  const penalizacion = e.unPasoAtras ? PENALIZADOR_UN_PASO_ATRAS : 0;

  return {
    dificultadBase,
    porDistancia,
    porDuracion,
    dificultadFinal: dificultadBase + porDistancia + porDuracion,
    bonoZeon,
    bonoEspecialidad,
    penalizacion,
    bonoTotal: bonoZeon + bonoEspecialidad + penalizacion,
    fueraDeTabla: !(e.nivel in NIVEL_EFECTO),
  };
}

/**
 * Proyección Mágica de un efecto natural proyectado: **el doble de la presencia** más el
 * bono de Destreza, más la X del modificador de distancia.
 */
export function proyeccionNatural(presencia: number, bonoDestreza: number, x: number): number {
  return presencia * 2 + bonoDestreza + x;
}
