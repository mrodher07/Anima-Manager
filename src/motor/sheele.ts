/**
 * Sheele: Espíritus del Alma. Arcana Exxet, cap. 7.
 *
 * Una Sheele **no se calcula como una criatura normal**, y ese es todo el asunto: no tiene
 * PD, no desarrolla habilidades, y casi todos sus valores salen de su señor en vez de sus
 * propios atributos. El manual lo dice sin rodeos: *«son un reflejo del alma del invocador
 * que ha cobrado independencia»*.
 *
 * De ahí que esto exista como motor aparte y no como un caso más de `personaje.ts`: aplicar
 * la ficha normal a una Sheele daría números equivocados en casi todas las casillas.
 */

/** Tabla 13: tipo de Sheele al azar. */
export const TIPO_POR_TIRADA: { desde: number; hasta: number; tipo: string }[] = [
  { desde: 1, hasta: 10, tipo: 'Luz' },
  { desde: 11, hasta: 20, tipo: 'Aire' },
  // ⚠ El manual imprime «31-40» aquí y vuelve a imprimir 31-40 más abajo: es 21-30.
  { desde: 21, hasta: 30, tipo: 'Naturaleza' },
  { desde: 31, hasta: 40, tipo: 'Tierra' },
  { desde: 41, hasta: 50, tipo: 'Fuego' },
  { desde: 51, hasta: 60, tipo: 'Ilusión' },
  { desde: 61, hasta: 70, tipo: 'Agua' },
  { desde: 71, hasta: 80, tipo: 'Oscuridad' },
  { desde: 81, hasta: 100, tipo: 'A elección del personaje' },
];

export function tipoPorTirada(d100: number): string {
  return TIPO_POR_TIRADA.find((f) => d100 >= f.desde && d100 <= f.hasta)?.tipo ?? '';
}

/** Tabla 14: tope del bono que se le puede dar gastando Zeon, según la habilidad Controlar. */
export const POTENCIACION: { controlar: number; zeonMaximo: number }[] = [
  { controlar: 0, zeonMaximo: 20 },
  { controlar: 50, zeonMaximo: 30 },
  { controlar: 100, zeonMaximo: 40 },
  { controlar: 150, zeonMaximo: 50 },
  { controlar: 200, zeonMaximo: 60 },
  { controlar: 250, zeonMaximo: 70 },
  { controlar: 300, zeonMaximo: 80 },
  { controlar: 350, zeonMaximo: 90 },
  { controlar: 400, zeonMaximo: 100 },
];

export function zeonMaximoPotenciacion(controlar: number): number {
  let max = POTENCIACION[0].zeonMaximo;
  for (const f of POTENCIACION) if (controlar >= f.controlar) max = f.zeonMaximo;
  return max;
}

export interface Potenciacion {
  /** Lo que de verdad se puede gastar, una vez aplicado el tope de Controlar. */
  zeonGastado: number;
  tope: number;
  /** El bono que recibe la Sheele en esa acción. */
  bono: number;
  recortado: boolean;
  avisos: string[];
}

/**
 * Potenciación Mística: el señor gasta Zeon y su Sheele recibe **ese mismo valor** como bono
 * a una acción, hasta el tope que le permita su Controlar.
 *
 * En Forma de Alma la mejora se reduce a la mitad, *«redondeado en grupos de 5 hacia
 * abajo»* — que no es lo mismo que la mitad a secas: 40 en Forma de Alma da +20, pero 50
 * da +25 y 55 da +25 también.
 */
export function potenciacionMistica(
  zeonGastado: number,
  controlar: number,
  formaDeAlma = false,
): Potenciacion {
  const tope = zeonMaximoPotenciacion(controlar);
  const gastado = Math.max(Math.trunc(zeonGastado), 0);
  const efectivo = Math.min(gastado, tope);
  const avisos: string[] = [];
  if (gastado > tope) {
    avisos.push(
      `Con Controlar ${controlar} el tope son ${tope} puntos: gastar más no sube el bono.`,
    );
  }
  const bono = formaDeAlma ? Math.floor(efectivo / 2 / 5) * 5 : efectivo;
  if (formaDeAlma) {
    avisos.push('En Forma de Alma el bono se reduce a la mitad, redondeando a 5 hacia abajo.');
  }
  return { zeonGastado: efectivo, tope, bono, recortado: gastado > tope, avisos };
}

export interface SenorDeLaSheele {
  /** Presencia actual del señor: de ahí salen los PV de la Sheele. */
  presencia: number;
  /** Presencia **base**, que es la que dobla la Proyección Mágica. */
  presenciaBase: number;
  /** Turno del señor **sin armas**. */
  turnoDesarmado: number;
  resistencias: Record<string, number>;
  nivel: number;
  /** Habilidad de convocatoria, para el tope de la Potenciación. */
  controlar: number;
}

export interface FichaSheele {
  tipo: string;
  nombre: string;
  /** Doble de la presencia del señor. No sale de Constitución. */
  puntosVida: number;
  /** El mismo que su señor desarmado. */
  turno: number;
  /** Las mismas que su señor. */
  resistencias: Record<string, number>;
  /** Doble de la presencia base del señor, **sin** sumar su bono de Destreza. */
  proyeccionMagica: number;
  caracteristicas: Record<string, number>;
  /** Las del tipo, más los +10 que le haya repartido su señor al subir de nivel. */
  habilidades: Record<string, number>;
  /** Cuántos +10 puede repartir en total: cinco por cada nivel de su señor. */
  bonosDisponibles: number;
  bonosRepartidos: number;
  zeonMaximoPotenciacion: number;
  avisos: string[];
}

/** Cada vez que el señor sube de nivel puede dar +10 a cinco habilidades distintas. */
export const BONOS_POR_NIVEL = 5;
export const VALOR_DEL_BONO = 10;

export interface TipoSheele {
  tipo: string;
  nombre: string;
  caracteristicas: Record<string, number>;
  habilidades: Record<string, number>;
}

export interface EleccionesSheele {
  tipo: string;
  /** +1 a una característica por cada nivel del señor, no uno cada dos. */
  subidasCaracteristica: Record<string, number>;
  /** Cuántos +10 se le han dado a cada habilidad secundaria. */
  bonosHabilidad: Record<string, number>;
  formaDeAlma?: boolean;
  mejoras?: string[];
}

export const SHEELE_VACIA: EleccionesSheele = {
  tipo: '',
  subidasCaracteristica: {},
  bonosHabilidad: {},
  mejoras: [],
};

/**
 * Calcula la ficha de una Sheele.
 *
 * `habilidadesDelSenor` sirve para el límite que impone el manual: *«ninguna de ellas puede
 * tener jamás una habilidad basada en el conocimiento superior al valor que posee su señor
 * en esa misma habilidad»*. Se avisa, no se recorta: es el criterio de siempre.
 */
export function calcularSheele(
  elecciones: EleccionesSheele,
  tipo: TipoSheele | undefined,
  senor: SenorDeLaSheele,
  habilidadesDelSenor: Record<string, number> = {},
): FichaSheele {
  const avisos: string[] = [];

  const caracteristicas: Record<string, number> = { ...(tipo?.caracteristicas ?? {}) };
  for (const [c, n] of Object.entries(elecciones.subidasCaracteristica)) {
    if (n > 0) caracteristicas[c] = (caracteristicas[c] ?? 0) + n;
  }
  const subidas = Object.values(elecciones.subidasCaracteristica).reduce((t, n) => t + Math.max(n, 0), 0);
  if (subidas > senor.nivel) {
    avisos.push(
      `Se han repartido ${subidas} subidas de característica y su señor sólo tiene nivel ` +
        `${senor.nivel}: le corresponde una por nivel.`,
    );
  }

  const habilidades: Record<string, number> = { ...(tipo?.habilidades ?? {}) };
  let bonosRepartidos = 0;
  for (const [h, n] of Object.entries(elecciones.bonosHabilidad)) {
    if (n <= 0) continue;
    bonosRepartidos += n;
    habilidades[h] = (habilidades[h] ?? 0) + n * VALOR_DEL_BONO;
  }

  const bonosDisponibles = Math.max(senor.nivel, 0) * BONOS_POR_NIVEL;
  if (bonosRepartidos > bonosDisponibles) {
    avisos.push(
      `Se han repartido ${bonosRepartidos} bonos de +10 y sólo hay ${bonosDisponibles}: ` +
        `cinco por cada nivel de su señor.`,
    );
  }

  // El techo del conocimiento: una Sheele no sabe más que su señor.
  const pasadas = Object.entries(habilidades)
    .filter(([h, v]) => habilidadesDelSenor[h] !== undefined && v > habilidadesDelSenor[h])
    .map(([h]) => h);
  if (pasadas.length > 0) {
    avisos.push(
      `Estas habilidades superan a las de su señor, y el manual no lo permite: ` +
        `${pasadas.join(', ')}.`,
    );
  }

  if (!tipo && elecciones.tipo) {
    avisos.push(`No encuentro el tipo «${elecciones.tipo}» en el catálogo.`);
  }

  return {
    tipo: elecciones.tipo,
    nombre: tipo?.nombre ?? '',
    puntosVida: senor.presencia * 2,
    turno: senor.turnoDesarmado,
    resistencias: { ...senor.resistencias },
    proyeccionMagica: senor.presenciaBase * 2,
    caracteristicas,
    habilidades,
    bonosDisponibles,
    bonosRepartidos,
    zeonMaximoPotenciacion: zeonMaximoPotenciacion(senor.controlar),
    avisos,
  };
}

/**
 * Ceder ACT a la Sheele para que acumule por su cuenta. Lo que se cede se le quita al señor
 * ese asalto; es un reparto, no un extra.
 */
export function cederACT(actDelSenor: number, cedido: number): { senor: number; sheele: number } {
  const c = Math.min(Math.max(Math.trunc(cedido), 0), Math.max(actDelSenor, 0));
  return { senor: actDelSenor - c, sheele: c };
}
