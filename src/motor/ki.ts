/**
 * Los Dominios del Ki.
 *
 * Base: Core Exxet, capítulo 10. Ampliación: **Dominus Exxet**, que añade el árbol de
 * habilidades nuevas, el Némesis, los Límites y la creación de Técnicas.
 *
 * Lo que decide la aplicación y lo que no:
 *  - **Sí** calcula: puntos de Ki, Acumulaciones, reserva, CM total y gastado, Detección
 *    y Ocultación del Ki, y valida los requisitos del árbol de habilidades.
 *  - **No** decide: cuándo se acumula, qué Técnica se lanza o si el maestro deja aprender
 *    una habilidad. El manual insiste en que el aprendizaje lo arbitra el Director, así
 *    que aquí sólo se avisa, nunca se bloquea.
 */

import type { Reglamento } from './reglamento';
import { REGLAMENTO_OFICIAL } from './reglamento';
import type { Caracteristica } from './personaje';
import { calcularTecnica, type CatalogoTecnicas, type DisenoTecnica } from './tecnicas';
import { CARACTERISTICAS_KI, type CaracteristicaKi } from './caracteristicasKi';

export { CARACTERISTICAS_KI, type CaracteristicaKi };

export function esCaracteristicaKi(c: Caracteristica): c is CaracteristicaKi {
  return (CARACTERISTICAS_KI as readonly string[]).includes(c);
}

/** Fila de la Tabla 53: valor de característica → Acumulación base. */
export interface FilaAcumulacion {
  valor: number;
  acumulacion: number;
}

/**
 * Acumulación base de la Tabla 53. Un 0 en la característica da 0, no 1:
 * la ficha lo escribe como `IF(AGI=0, 0, VLOOKUP(AGI, Tabla_Acum, 2))`.
 */
export function acumulacionBase(valor: number, tabla: FilaAcumulacion[]): number {
  if (valor < 1) return 0;
  const fila = tabla.find((f) => f.valor === Math.min(valor, 20));
  return fila?.acumulacion ?? 0;
}

/** Habilidad del Ki o del Némesis, tal como sale del árbol de la ficha. */
export interface HabilidadKi {
  habilidad: string;
  dominio: 'Ki' | 'Némesis';
  /** De qué habilidad cuelga. Sólo las dos raíces no tienen. */
  requisito?: string | null;
  /** Algunas piden dos: Forma de Vacío necesita también Cuerpo de Vacío. */
  requisitoExtra?: string | null;
  CM: number;
}

/** Límite: recupera Ki en una circunstancia concreta, a cambio de CM. */
export interface LimiteKi {
  limite: string;
  coste: number;
  efecto: string;
}

/** Natura mínima para poder tener un Límite. Dominus Exxet, cap. 3. */
export const NATURA_MINIMA_LIMITE = 10;

// ─────────────────────────── Consecuencias de acumular ───────────────────────────

/**
 * Lo que pasa cuando se acumula mucho Ki y no se descarga (Dominus Exxet, cap. 1).
 * No son efectos que el personaje controle: son las consecuencias de concentrar energía.
 */
export interface ConsecuenciaAcumulacion {
  desde: number;
  /** Ki que se pierde si el asalto acaba sin darle uso. `'mitad'` a partir de 120. */
  perdidaSiNoSeUsa: number | 'mitad';
  efecto: string;
}

export const CONSECUENCIAS_ACUMULACION: readonly ConsecuenciaAcumulacion[] = [
  {
    desde: 20,
    perdidaSiNoSeUsa: 1,
    efecto:
      'El aura se vuelve visible para todo el mundo, incluso para quien no siente el Ki. ' +
      'El ambiente se embravece, pero sin consecuencias físicas.',
  },
  {
    desde: 40,
    perdidaSiNoSeUsa: 5,
    efecto:
      'Ligeros temblores, las piedras alrededor empiezan a flotar y al aire libre se ' +
      'levanta un fuerte viento.',
  },
  {
    desde: 80,
    perdidaSiNoSeUsa: 10,
    efecto:
      'Atrae tormentas y rayos a kilómetros, la tierra se agrieta y las construcciones ' +
      'endebles se tambalean. Quien no pueda hacer acciones Inhumanas necesita superar un ' +
      'control enfrentado de Fuerza contra el Poder del personaje para acercarse.',
  },
  {
    desde: 120,
    perdidaSiNoSeUsa: 'mitad',
    efecto:
      'A partir de aquí lo decide el Director de Juego, pero debería ser tan espectacular ' +
      'como formidable.',
  },
];

/** La consecuencia que toca para una cantidad de Ki acumulado, si es que hay alguna. */
export function consecuenciaDe(kiAcumulado: number): ConsecuenciaAcumulacion | undefined {
  return [...CONSECUENCIAS_ACUMULACION].reverse().find((c) => kiAcumulado >= c.desde);
}

/**
 * Ritmo de recuperación de Ki, en puntos por hora.
 * Un punto por hora en cada una de las seis características, o seis por hora en total
 * si se juega con Unificación. La ventaja Recuperación de Ki lo acelera por niveles, y
 * meditar lo dobla (Core Exxet cap. 10; Dominus Exxet cap. 1).
 */
export function recuperacionPorHora(nivelVentaja = 0, meditando = false): number {
  // Con la ventaja: 1 punto cada minuto / cada 30 s / cada 6 s.
  const porHora = [6, 60, 120, 600][Math.min(Math.max(nivelVentaja, 0), 3)];
  return meditando ? porHora * 2 : porHora;
}

/** Con 10 o menos de Ki el cuerpo empieza a fallar (Dominus Exxet, cap. 1). */
export function desgasteporKiBajo(kiActual: number): string | null {
  if (kiActual <= 0) return 'Sin Ki: pierde 1 punto de Cansancio cada cinco asaltos.';
  if (kiActual <= 10) return 'Ki muy bajo: pierde 1 punto de Cansancio cada cinco minutos.';
  return null;
}

// ─────────────────────────────── Cálculo de la ficha ───────────────────────────────

export interface KiPorCaracteristica {
  /** Lo que da la característica por sí sola. */
  base: number;
  /** Lo comprado con PD. */
  comprado: number;
  /** Anotado a mano (raza, Elan, poderes…). */
  especial: number;
  total: number;
}

export interface AcumulacionPorCaracteristica {
  base: number;
  comprada: number;
  especial: number;
  /** Lo que resta la armadura: −1 por cada 20 de penalizador. */
  penalizadorArmadura: number;
  total: number;
  /** La mitad, redondeada hacia arriba: lo que queda si haces algo más ese asalto. */
  mitad: number;
}

export interface FichaKi {
  puntos: Record<CaracteristicaKi, KiPorCaracteristica>;
  acumulacion: Record<CaracteristicaKi, AcumulacionPorCaracteristica>;
  /** Suma de los puntos de Ki. Con Poder Innato sale de otra fórmula. */
  reserva: number;
  /** Suma de las Acumulaciones: cuánto Ki puede reunir en un asalto. */
  acumulacionTotal: number;
  /** La suma de las mitades, para el asalto en que además hace otra cosa. */
  acumulacionReducida: number;
  conocimientoMarcial: {
    total: number;
    categoria: number;
    artesMarciales: number;
    ventajas: number;
    comprado: number;
    /** CM ya comprometido en habilidades, Límites y Técnicas. */
    gastado: number;
    disponible: number;
    /** Tope de PD que se pueden meter en CM. */
    limitePD: number;
  };
  deteccion: number | null;
  ocultacion: number | null;
  /** Si la mesa juega con la Reserva de Ki unificada. */
  unificado: boolean;
  avisos: string[];
}

/** Lo que el personaje ha elegido en materia de Ki. */
export interface EleccionesKi {
  habilidades: string[];
  limites: string[];
  /** Técnicas del compendio, con su coste en CM ya resuelto. */
  tecnicas: { nombre: string; CM: number; nivel?: number }[];
  /**
   * Técnicas construidas efecto a efecto con el creador del capítulo 5. Se guarda el
   * diseño entero, no el resultado: así una fórmula distinta o un manual nuevo recalculan
   * el coste sin que haya que rehacerlas.
   */
  propias?: DisenoTecnica[];
  /** Grados de arte marcial dominados. */
  artesMarciales: string[];
  unificado?: boolean;
}

export const ELECCIONES_KI_VACIAS: EleccionesKi = {
  habilidades: [],
  limites: [],
  tecnicas: [],
  propias: [],
  artesMarciales: [],
};

export interface DatosKi {
  tablaAcumulacion: FilaAcumulacion[];
  habilidades: HabilidadKi[];
  limites: LimiteKi[];
  /** CM que aporta cada grado de arte marcial, por nombre. */
  cmPorArteMarcial: Record<string, number>;
  /** Tablas de creación de Técnicas, para poder cobrar las propias. */
  tecnicas?: CatalogoTecnicas;
}

export interface ContextoKi {
  caracteristicas: Record<CaracteristicaKi, number>;
  /** PD invertidos en Ki y en Acumulación, por característica. */
  pdKi: Partial<Record<CaracteristicaKi, number>>;
  pdAcumulacion: Partial<Record<CaracteristicaKi, number>>;
  pdCM: number;
  /** Bonos anotados a mano, que no salen de ninguna regla. */
  especialKi: Partial<Record<CaracteristicaKi, number>>;
  especialAcumulacion: Partial<Record<CaracteristicaKi, number>>;
  costeKi: number;
  costeAcumulacion: number;
  /** CM de la categoría, ya multiplicado por los niveles hechos en ella. */
  cmCategoria: number;
  /** CM de la ventaja Maestro Marcial. */
  cmVentajas: number;
  nivel: number;
  pdTotales: number;
  penalizadorArmadura: number;
  /** Habilidades de Advertir y Ocultarse ya calculadas, para las dos derivadas. */
  advertir: number;
  ocultarse: number;
  especialDeteccion: number;
  especialOcultacion: number;
  bonoDeteccionPorNivel: number;
  bonoOcultacionPorNivel: number;
  bonoOcultacionRaza: number;
  natura: number;
  /** Ventajas del Dominus Exxet que cambian el cálculo. */
  poderInnato: boolean;
  limiteDual: boolean;
}

const cero = <T>(hacer: (c: CaracteristicaKi) => T): Record<CaracteristicaKi, T> =>
  Object.fromEntries(CARACTERISTICAS_KI.map((c) => [c, hacer(c)])) as Record<CaracteristicaKi, T>;

/** Calcula el bloque de Ki de la ficha. Función pura, como el resto del motor. */
export function calcularKi(
  elecciones: EleccionesKi,
  datos: DatosKi,
  ctx: ContextoKi,
  reglamento: Reglamento = REGLAMENTO_OFICIAL,
): FichaKi {
  const avisos: string[] = [];
  const aplicar = (clave: Parameters<Reglamento['aplicar']>[0], vars: Record<string, number | boolean>, siInactiva = 0) => {
    try {
      return reglamento.aplicar(clave, vars, siInactiva);
    } catch (e) {
      avisos.push(`La fórmula de "${clave}" ha fallado: ${e instanceof Error ? e.message : e}`);
      return 0;
    }
  };

  // ── Puntos de Ki ──
  const puntos = cero<KiPorCaracteristica>((c) => {
    const valor = ctx.caracteristicas[c] ?? 0;
    const base = valor > 0 ? aplicar('kiPorCaracteristica', { valor }) : 0;
    const comprado =
      ctx.costeKi > 0 ? aplicar('kiPorPD', { pd: ctx.pdKi[c] ?? 0, coste: ctx.costeKi }) : 0;
    const especial = ctx.especialKi[c] ?? 0;
    return { base, comprado, especial, total: base + comprado + especial };
  });

  // ── Acumulaciones ──
  // La armadura resta 1 por cada 20 de penalizador, truncando hacia cero.
  const penalizadorArmadura =
    ctx.penalizadorArmadura < 0 ? Math.min(0, Math.trunc(ctx.penalizadorArmadura / 20)) : 0;

  const acumulacion = cero<AcumulacionPorCaracteristica>((c) => {
    const base = acumulacionBase(ctx.caracteristicas[c] ?? 0, datos.tablaAcumulacion);
    const comprada =
      ctx.costeAcumulacion > 0
        ? aplicar('kiPorPD', { pd: ctx.pdAcumulacion[c] ?? 0, coste: ctx.costeAcumulacion })
        : 0;
    const especial = ctx.especialAcumulacion[c] ?? 0;
    const total = aplicar('acumulacionKi', {
      acumulacionBase: base,
      acumulacionComprada: comprada,
      especial,
      penalizadorArmadura,
    });
    return { base, comprada, especial, penalizadorArmadura, total, mitad: Math.ceil(total / 2) };
  });

  const sumaKi = CARACTERISTICAS_KI.reduce((t, c) => t + puntos[c].total, 0);
  const kiComprado = CARACTERISTICAS_KI.reduce((t, c) => t + puntos[c].comprado, 0);
  const reserva = aplicar('reservaKi', {
    sumaKi,
    kiPOD: puntos.POD.base,
    kiComprado,
    poderInnato: ctx.poderInnato,
  });

  // ── Conocimiento Marcial ──
  const cmArtesMarciales = elecciones.artesMarciales.reduce(
    (t, a) => t + (datos.cmPorArteMarcial[a] ?? 0),
    0,
  );
  const cmComprado = aplicar('cmPorPD', { pd: ctx.pdCM });
  const cmTotal = aplicar('conocimientoMarcial', {
    cmCategoria: ctx.cmCategoria,
    cmArtesMarciales,
    cmVentajas: ctx.cmVentajas,
    cmComprado,
  });

  const porNombre = new Map(datos.habilidades.map((h) => [h.habilidad, h]));
  const elegidas = new Set(elecciones.habilidades);
  let cmHabilidades = 0;
  for (const nombre of elecciones.habilidades) {
    const h = porNombre.get(nombre);
    if (!h) {
      avisos.push(`Habilidad del Ki desconocida: "${nombre}".`);
      continue;
    }
    cmHabilidades += h.CM;
    for (const req of [h.requisito, h.requisitoExtra]) {
      if (req && !elegidas.has(req)) {
        avisos.push(`${h.habilidad} necesita ${req}, que no tienes.`);
      }
    }
  }

  const limitesPorNombre = new Map(datos.limites.map((l) => [l.limite, l]));
  let cmLimites = 0;
  for (const nombre of elecciones.limites) {
    const l = limitesPorNombre.get(nombre);
    if (!l) {
      avisos.push(`Límite desconocido: "${nombre}".`);
      continue;
    }
    cmLimites += l.coste;
  }
  const limitesPermitidos = ctx.limiteDual ? 2 : 1;
  if (elecciones.limites.length > limitesPermitidos) {
    avisos.push(
      `Sólo puedes tener ${limitesPermitidos} Límite${limitesPermitidos > 1 ? 's' : ''}` +
        `${ctx.limiteDual ? ' (Límite Dual)' : ''} y has elegido ${elecciones.limites.length}.`,
    );
  }
  if (elecciones.limites.length > 0 && ctx.natura > 0 && ctx.natura < NATURA_MINIMA_LIMITE) {
    avisos.push(
      `Los Límites piden Natura ${NATURA_MINIMA_LIMITE} o más, y la tuya es ${ctx.natura}.`,
    );
  }

  const cmTecnicas = elecciones.tecnicas.reduce((t, x) => t + (x.CM || 0), 0);
  // Las Técnicas propias se recalculan desde su diseño en cada pasada: así una fórmula
  // de la mesa o un manual nuevo cambian su coste sin tener que rehacerlas.
  let cmPropias = 0;
  for (const diseno of elecciones.propias ?? []) {
    if (!datos.tecnicas) break;
    const calculada = calcularTecnica(diseno, datos.tecnicas);
    cmPropias += calculada.CM;
    for (const texto of calculada.avisos) {
      avisos.push(`${diseno.nombre || 'Técnica sin nombre'}: ${texto}`);
    }
  }
  const cmGastado = cmHabilidades + cmLimites + cmTecnicas + cmPropias;
  if (cmGastado > cmTotal) {
    avisos.push(`Has comprometido ${cmGastado} CM y sólo tienes ${cmTotal}.`);
  }

  const limitePD = aplicar('limiteCM', { pdTotales: ctx.pdTotales }, Number.POSITIVE_INFINITY);
  if (ctx.pdCM > limitePD) {
    avisos.push(`Has metido ${ctx.pdCM} PD en Conocimiento Marcial y el tope es ${limitePD}.`);
  }

  // ── Detección y Ocultación: sólo existen si tienes la habilidad ──
  const deteccion = elegidas.has('Detección del Ki')
    ? aplicar('deteccionKi', {
        cmTotal,
        advertir: ctx.advertir,
        especial: ctx.especialDeteccion,
        bonoPorNivel: ctx.bonoDeteccionPorNivel,
        nivel: ctx.nivel,
      })
    : null;
  const ocultacion = elegidas.has('Ocultación del Ki')
    ? aplicar('ocultacionKi', {
        cmTotal,
        ocultarse: ctx.ocultarse,
        especial: ctx.especialOcultacion,
        bonoPorNivel: ctx.bonoOcultacionPorNivel,
        nivel: ctx.nivel,
        bonoRaza: ctx.bonoOcultacionRaza,
      })
    : null;

  if (ctx.poderInnato && !elecciones.unificado) {
    avisos.push('Poder Innato sólo puede usarse con la regla de Unificación de puntos de Ki.');
  }

  return {
    puntos,
    acumulacion,
    reserva,
    acumulacionTotal: CARACTERISTICAS_KI.reduce((t, c) => t + acumulacion[c].total, 0),
    acumulacionReducida: CARACTERISTICAS_KI.reduce((t, c) => t + acumulacion[c].mitad, 0),
    conocimientoMarcial: {
      total: cmTotal,
      categoria: ctx.cmCategoria,
      artesMarciales: cmArtesMarciales,
      ventajas: ctx.cmVentajas,
      comprado: cmComprado,
      gastado: cmGastado,
      disponible: cmTotal - cmGastado,
      limitePD,
    },
    deteccion,
    ocultacion,
    unificado: elecciones.unificado ?? false,
    avisos,
  };
}

/**
 * Habilidades que se pueden aprender ahora mismo: las que aún no se tienen y cuyos
 * requisitos sí. Se usa para guiar en la interfaz, no para impedir nada.
 */
export function habilidadesDisponibles(
  habilidades: HabilidadKi[],
  elegidas: string[],
): HabilidadKi[] {
  const tiene = new Set(elegidas);
  return habilidades.filter(
    (h) =>
      !tiene.has(h.habilidad) &&
      (!h.requisito || tiene.has(h.requisito)) &&
      (!h.requisitoExtra || tiene.has(h.requisitoExtra)),
  );
}

/** Las habilidades que dejarían de tener requisito si se quitase `habilidad`. */
export function dependientesDe(habilidades: HabilidadKi[], habilidad: string): string[] {
  return habilidades
    .filter((h) => h.requisito === habilidad || h.requisitoExtra === habilidad)
    .map((h) => h.habilidad);
}
