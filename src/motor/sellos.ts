/**
 * Sellos de Invocación. Dominus Exxet, capítulo 8.
 *
 * Convocar criaturas con Ki, sin tocar Convocar, Dominación, Atar ni Desconvocar: basta
 * con dominar Sellos gastando Conocimiento Marcial y luego pagar el Ki de ejecutarlos.
 *
 * Lo que decide la aplicación y lo que no:
 *  - **Sí** calcula: el CM que cuestan los Sellos dominados, el Ki de una invocación, la
 *    dificultad del Control de Invocación y lo que cuesta mantener a la criatura.
 *  - **No** decide: si la criatura acepta el Pacto de Sangre. El manual dice expresamente
 *    que vale cualquier cosa, «desde llegar a un acuerdo con ella hasta forzarla
 *    violentamente». Eso es de la mesa.
 */

/** Los cinco Sellos, sacados de los elementos del Samsara de Varja. */
export const SELLOS = ['Aire', 'Agua', 'Fuego', 'Metal', 'Madera'] as const;
export type Sello = (typeof SELLOS)[number];

export interface FichaSello {
  sello: Sello;
  /** Elemento o elementos del Samsara a los que está atado. */
  elemento: string;
  /** Qué clase de criaturas atrae. */
  afinidades: string;
  estacion: string;
  direccion: string;
}

export const FICHAS_SELLO: Record<Sello, FichaSello> = {
  Aire: {
    sello: 'Aire',
    elemento: 'Aire',
    afinidades: 'Seres muy veloces, criaturas voladoras y entes etéreos.',
    estacion: 'Primavera',
    direccion: 'Este',
  },
  Agua: {
    sello: 'Agua',
    elemento: 'Agua',
    afinidades: 'Criaturas marinas, seres de gran fuerza y entidades muy hermosas.',
    estacion: 'Invierno',
    direccion: 'Norte',
  },
  Fuego: {
    sello: 'Fuego',
    elemento: 'Fuego y Luz',
    afinidades: 'Entidades puras, criaturas violentas y seres de comportamiento extremo.',
    estacion: 'Verano',
    direccion: 'Sur',
  },
  Metal: {
    sello: 'Metal',
    elemento: 'Tierra',
    afinidades: 'Lo sólido y lo material, todo lo ajeno al mundo místico.',
    estacion: 'Otoño',
    direccion: 'Oeste',
  },
  Madera: {
    sello: 'Madera',
    elemento: 'Oscuridad',
    afinidades: 'Seres atados a la naturaleza, seres espirituales y entidades mágicas.',
    estacion: 'Cambio de estaciones',
    direccion: 'Centro absoluto',
  },
};

export type Grado = 'Menor' | 'Mayor';

/** Lo que cuesta dominar un Sello, en Conocimiento Marcial. */
export const CM_SELLO: Record<Grado, number> = { Menor: 30, Mayor: 60 };

/** Lo que cuesta **ejecutar** un Sello, en puntos de Ki genéricos. */
export const KI_SELLO: Record<Grado, number> = { Menor: 5, Mayor: 15 };

/** Un Sello Mayor vale por cinco Menores de su mismo elemento. */
export const MENORES_POR_MAYOR = 5;

/** Lo que suma cada Sello de refuerzo al Control de Invocación. */
export const REFUERZO: Record<Grado, number> = { Menor: 5, Mayor: 25 };

/** La dificultad sube 10 por cada nivel en que la criatura te supere. */
export const DIFICULTAD_POR_NIVEL = 10;

/** El Pacto de Sangre cuenta como si la criatura fuese tres niveles más. */
export const PENALIZADOR_PACTO = 30;

/** Invocar tiene el mismo Turno que atacar desarmado. */
export const TURNO_INVOCAR = 20;

/** Gnosis a partir de la cual una criatura ignora los Sellos. */
export const GNOSIS_INMUNE = 35;

/** Un Sello dominado: su elemento y su grado. */
export interface SelloDominado {
  sello: Sello;
  grado: Grado;
}

export const clave = (s: SelloDominado) => `${s.sello} ${s.grado}`;

/** Descompone «Fuego Mayor» en sus dos partes. */
export function leerClave(texto: string): SelloDominado | null {
  const m = /^(\w+)\s+(Menor|Mayor)$/.exec(texto.trim());
  if (!m || !(SELLOS as readonly string[]).includes(m[1])) return null;
  return { sello: m[1] as Sello, grado: m[2] as Grado };
}

/** Todos los Sellos que se pueden dominar: los cinco elementos por sus dos grados. */
export const CATALOGO_SELLOS: SelloDominado[] = SELLOS.flatMap((sello) =>
  (['Menor', 'Mayor'] as Grado[]).map((grado) => ({ sello, grado })),
);

export interface ResumenSellos {
  dominados: SelloDominado[];
  /** CM comprometido en dominarlos. */
  cm: number;
  avisos: string[];
}

/**
 * Comprueba y cobra los Sellos dominados. Para el Mayor de un elemento hace falta antes
 * el Menor de ese mismo elemento.
 */
export function resumirSellos(claves: string[]): ResumenSellos {
  const avisos: string[] = [];
  const dominados: SelloDominado[] = [];
  let cm = 0;

  for (const texto of claves) {
    const s = leerClave(texto);
    if (!s) {
      avisos.push(`Sello desconocido: "${texto}".`);
      continue;
    }
    dominados.push(s);
    cm += CM_SELLO[s.grado];
  }

  const tiene = new Set(dominados.map(clave));
  for (const s of dominados) {
    if (s.grado === 'Mayor' && !tiene.has(`${s.sello} Menor`)) {
      avisos.push(`Para el Sello de ${s.sello} Mayor hace falta antes el de ${s.sello} Menor.`);
    }
  }

  return { dominados, cm, avisos };
}

// ─────────────────────────────── Ejecutar una invocación ───────────────────────────────

/** Los Sellos que se ejecutan para una invocación concreta, por elemento y grado. */
export type Ejecucion = { sello: Sello; grado: Grado; cantidad: number }[];

/** Cuántos Sellos Menores equivalentes aporta una ejecución, por elemento. */
export function equivalenciaEnMenores(ejecucion: Ejecucion): Record<string, number> {
  const total: Record<string, number> = {};
  for (const e of ejecucion) {
    const menores = e.cantidad * (e.grado === 'Mayor' ? MENORES_POR_MAYOR : 1);
    total[e.sello] = (total[e.sello] ?? 0) + menores;
  }
  return total;
}

/** Lo que cuesta en Ki ejecutar esos Sellos. El Pacto de Sangre lo dobla. */
export function costeEnKi(ejecucion: Ejecucion, esPacto = false): number {
  const base = ejecucion.reduce((t, e) => t + e.cantidad * KI_SELLO[e.grado], 0);
  return esPacto ? base * 2 : base;
}

export interface ControlInvocacion {
  /** Lo que hay que sacar o superar en el D100. */
  dificultad: number;
  /** Lo que suman los Sellos de refuerzo. */
  bonoRefuerzo: number;
  /** Dificultad ya descontado el refuerzo: lo que de verdad hay que sacar. */
  objetivo: number;
  /** Las criaturas de nivel inferior salen solas, salvo Pifia. */
  automatica: boolean;
  avisos: string[];
}

/**
 * Control de Invocación: 10 puntos de dificultad por cada nivel en que la criatura
 * supere al invocador. Los Sellos de más suman +5 (Menor) o +25 (Mayor).
 */
export function controlDeInvocacion(opciones: {
  nivelInvocador: number;
  nivelCriatura: number;
  refuerzo?: Ejecucion;
  /** La invocación inicial, la del Pacto de Sangre, sube 30 la dificultad. */
  esPacto?: boolean;
  gnosisCriatura?: number;
  gnosisInvocador?: number;
}): ControlInvocacion {
  const {
    nivelInvocador,
    nivelCriatura,
    refuerzo = [],
    esPacto = false,
    gnosisCriatura = 0,
    gnosisInvocador = 0,
  } = opciones;
  const avisos: string[] = [];

  const diferencia = Math.max(0, nivelCriatura - nivelInvocador);
  const dificultad = diferencia * DIFICULTAD_POR_NIVEL + (esPacto ? PENALIZADOR_PACTO : 0);
  const bonoRefuerzo = refuerzo.reduce((t, e) => t + e.cantidad * REFUERZO[e.grado], 0);

  if (gnosisCriatura >= GNOSIS_INMUNE && gnosisInvocador <= gnosisCriatura) {
    avisos.push(
      `Con Gnosis ${gnosisCriatura} la criatura ignora los Sellos, salvo que quiera venir o ` +
        'que tu Gnosis sea mayor que el suyo.',
    );
  }

  return {
    dificultad,
    bonoRefuerzo,
    objetivo: Math.max(0, dificultad - bonoRefuerzo),
    // Sin diferencia de nivel y sin ser un Pacto, la criatura viene sola.
    automatica: dificultad === 0,
    avisos,
  };
}

/** Tabla 25: lo que pasa cuando el Control de Invocación se queda corto. */
export interface ConsecuenciaFracaso {
  desde: number;
  efecto: string;
}

/*
 * El manual escribe los tramos como «Entre -21 y -50» y «Entre -50 y -100», de modo que
 * el −50 cae en los dos. Aquí se cierra en −51 para que no haya ambigüedad.
 */
export const FRACASO_INVOCAR: readonly ConsecuenciaFracaso[] = [
  { desde: 0, efecto: 'La invocación falla y pierdes el Ki invertido en activar los Sellos.' },
  {
    desde: -21,
    efecto:
      'Como lo anterior y además se rompe de inmediato el Pacto de Sangre con esa criatura.',
  },
  {
    desde: -51,
    efecto:
      'Como lo anterior, salvo que pierdes el doble de Ki y la mitad de tus puntos de ' +
      'Cansancio totales.',
  },
  {
    desde: -101,
    efecto:
      'Fracaso estrepitoso: un shock terrible te hace perder la consciencia y todos tus ' +
      'puntos de Ki.',
  },
];

/** La consecuencia que toca para un nivel de fracaso (0 o negativo). */
export function consecuenciaFracaso(nivelFracaso: number): ConsecuenciaFracaso {
  return (
    [...FRACASO_INVOCAR].reverse().find((c) => nivelFracaso <= c.desde) ?? FRACASO_INVOCAR[0]
  );
}

/**
 * Ki por asalto para mantener a la criatura en el mundo: 1 si es de nivel menor que 10 y
 * 2 a partir de ahí. Es automático, sin necesidad de acumular.
 */
export function mantenimiento(nivelCriatura: number): number {
  return nivelCriatura >= 10 ? 2 : 1;
}

/**
 * Ki que se pierde cada asalto por retrasar una invocación ya preparada: tantos puntos
 * como Sellos se hayan invertido en ella.
 */
export function costeDeRetrasar(ejecucion: Ejecucion): number {
  return ejecucion.reduce((t, e) => t + e.cantidad, 0);
}

/** Naturalezas que los Sellos **no** pueden traer al mundo. */
export const NO_INVOCABLES = [
  'Sólo responden a los Sellos los Seres Entre Mundos y los Espíritus; los Seres Naturales no.',
  'Las criaturas construidas —golems, marionetas tecnomágicas— quedan fuera.',
  'Los no muertos tampoco: su esencia no responde a los Sellos.',
  `Las criaturas con Gnosis ${GNOSIS_INMUNE} o más son inmunes, salvo que quieran venir o que tu Gnosis sea mayor.`,
];
