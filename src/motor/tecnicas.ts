/**
 * Creación de Técnicas de Ki. Dominus Exxet, capítulo 5.
 *
 * Una Técnica es un **Efecto Primario** (siempre uno y sólo uno) más los Efectos
 * Secundarios que quepan. Cada efecto cuesta CM y puntos de Ki de una característica
 * concreta; el coste en Ki se puede repartir hacia otras características pagando un
 * recargo. El nivel de la Técnica fija cuánto CM puede costar y cuántas desventajas
 * admite.
 *
 * Los datos —560 opciones de efecto y sus fichas— salen de la hoja «Tablas Técnicas»
 * de la ficha. Aquí sólo vive la aritmética del capítulo 5.
 */

import type { EfectoTecnica, TipoEfectoTecnica } from '../datos/tipos';
import { CARACTERISTICAS_KI, type CaracteristicaKi } from './caracteristicasKi';

export type NivelTecnica = 1 | 2 | 3;

/** Tabla 16: lo que permite cada nivel. */
export const NIVELES: Record<NivelTecnica, { cmMinimo: number; cmMaximo: number; maxDesventajas: number }> = {
  1: { cmMinimo: 20, cmMaximo: 50, maxDesventajas: 1 },
  2: { cmMinimo: 40, cmMaximo: 100, maxDesventajas: 2 },
  3: { cmMinimo: 60, cmMaximo: 200, maxDesventajas: 3 },
};

/** Tabla 17: lo que cuesta poder Mantener la Técnica. */
export const CM_MANTENIDA: Record<NivelTecnica, number> = { 1: 10, 2: 20, 3: 30 };

/** Tabla 18: lo que cuesta Sostenerla. Sólo existe en niveles 2 y 3. */
export const CM_SOSTENIDA: Record<'menor' | 'mayor', Partial<Record<NivelTecnica, number>>> = {
  menor: { 2: 40, 3: 60 },
  mayor: { 2: 60, 3: 90 },
};

/** Cuántos asaltos dura cada grado de Sostenimiento. */
export const ASALTOS_SOSTENIDA = { menor: 5, mayor: 20 };

/**
 * Para crear una Técnica de nivel 2 hacen falta dos de nivel 1, y para una Arcana,
 * dos de nivel 2. La ventaja Técnicas desvinculadas salta esta regla.
 */
export const TECNICAS_PREVIAS: Record<NivelTecnica, { nivel: NivelTecnica; cuantas: number } | null> = {
  1: null,
  2: { nivel: 1, cuantas: 2 },
  3: { nivel: 2, cuantas: 2 },
};

/** Máximos de la regla de alterar el coste. */
export const MAX_REDUCCION_KI = 5;
export const CM_POR_PUNTO_DE_KI = 10;
export const MAX_DESCUENTO_CM = 20;
export const KI_POR_DESCUENTO = 2;
export const CM_POR_DESCUENTO = 5;
/** Hacen falta al menos tres características distintas para poder rebajar el Ki. */
export const CARACTERISTICAS_PARA_REDUCIR = 3;

// ─────────────────────────── Lectura de la ficha del efecto ───────────────────────────

export interface CaracteristicasEfecto {
  /** La característica natural del efecto: la que no lleva recargo. */
  principal: CaracteristicaKi | null;
  /** Las opcionales, con lo que cuesta pasarles parte del coste. */
  alternativas: { caracteristica: CaracteristicaKi; recargo: number }[];
}

const ES_KI = new Set<string>(CARACTERISTICAS_KI);

/**
 * Lee «DES (AGI+2, FUE+2, POD+2, VOL+3)»: la primera es la principal y entre paréntesis
 * van las opcionales con el recargo que hay que sumar al coste en Ki del efecto por
 * usarlas.
 */
export function leerCaracteristicas(texto: string | undefined): CaracteristicasEfecto {
  const vacio: CaracteristicasEfecto = { principal: null, alternativas: [] };
  if (!texto) return vacio;
  const m = /^\s*([A-Z]{3})\s*(?:\(([^)]*)\))?/.exec(texto);
  if (!m || !ES_KI.has(m[1])) return vacio;
  const alternativas: CaracteristicasEfecto['alternativas'] = [];
  for (const trozo of (m[2] ?? '').split(',')) {
    const a = /([A-Z]{3})\s*\+\s*(\d+)/.exec(trozo);
    if (a && ES_KI.has(a[1])) {
      alternativas.push({ caracteristica: a[1] as CaracteristicaKi, recargo: Number(a[2]) });
    }
  }
  return { principal: m[1] as CaracteristicaKi, alternativas };
}

// ─────────────────────────────── Diseño de una Técnica ───────────────────────────────

/** Un efecto elegido para la Técnica, con el reparto de su coste en Ki. */
export interface EfectoElegido {
  /** Clave de la opción en `efectosTecnica`: «Habilidad De Ataque +25». */
  referencia: string;
  /** Sólo uno de los efectos puede ser el Primario, y es más barato en Ki. */
  primario: boolean;
  /**
   * Cómo se reparte el coste en Ki. Si está vacío se usa la característica principal
   * del efecto y no hay recargo.
   */
  reparto: Partial<Record<CaracteristicaKi, number>>;
}

export interface DisenoTecnica {
  nombre: string;
  nivel: NivelTecnica;
  arbol?: string;
  efectos: EfectoElegido[];
  /** Desventajas elegidas, por su referencia; rebajan el CM. */
  desventajas: string[];
  /** Se puede Mantener asalto a asalto pagando Ki. */
  mantenida: boolean;
  /** Sostenimiento: dura sola 5 o 20 asaltos. No se mezcla con Mantenida. */
  sostenida?: 'menor' | 'mayor' | null;
  /** Puntos de Ki que se rebajan pagando 10 CM cada uno (máximo 5). */
  reduccionKi: Partial<Record<CaracteristicaKi, number>>;
  /** CM que se descuenta a cambio de Ki de más (máximo 20, en pasos de 5). */
  descuentoCM: number;
  descripcion?: string;
}

export function disenoVacio(nombre = ''): DisenoTecnica {
  return {
    nombre,
    nivel: 1,
    efectos: [],
    desventajas: [],
    mantenida: false,
    sostenida: null,
    reduccionKi: {},
    descuentoCM: 0,
  };
}

export interface CatalogoTecnicas {
  opciones: EfectoTecnica[];
  fichas: TipoEfectoTecnica[];
}

export interface DetalleEfecto {
  referencia: string;
  efecto: string;
  opcion: string;
  primario: boolean;
  /** Coste en Ki antes de repartir. */
  kiBase: number;
  /** Recargo por usar características opcionales. */
  recargo: number;
  /** Lo que hay que repartir de verdad: base + recargo. */
  kiTotal: number;
  /** Lo que suma el reparto que ha hecho el jugador. */
  repartido: number;
  CM: number;
  nivelMinimo: number;
  tipo: string;
  clase: string;
  caracteristicas: CaracteristicasEfecto;
  /** Ki extra por Mantener o Sostener este efecto. */
  extraMantenimiento: number;
  extraSostenimiento: number;
}

export interface TecnicaCalculada {
  detalles: DetalleEfecto[];
  /** CM de los efectos, antes de mantenimientos y ajustes. */
  cmEfectos: number;
  cmMantenida: number;
  cmSostenida: number;
  cmReduccionKi: number;
  cmDescuento: number;
  /** CM final, ya con el mínimo del nivel aplicado. */
  CM: number;
  /** Coste en Ki por característica, ya con reducciones y recargos. */
  ki: Partial<Record<CaracteristicaKi, number>>;
  kiTotal: number;
  /** Ki que hay que pagar cada asalto para mantenerla. */
  kiMantenimiento: number;
  avisos: string[];
}

const suma = (o: Partial<Record<CaracteristicaKi, number>>) =>
  CARACTERISTICAS_KI.reduce((t, c) => t + (o[c] ?? 0), 0);

/** Calcula el coste completo de una Técnica diseñada. */
export function calcularTecnica(
  diseno: DisenoTecnica,
  catalogo: CatalogoTecnicas,
): TecnicaCalculada {
  const avisos: string[] = [];
  const nivel = diseno.nivel;
  const limites = NIVELES[nivel];
  const porReferencia = new Map(catalogo.opciones.map((o) => [o.referencia, o]));
  const porEfecto = new Map(catalogo.fichas.map((f) => [f.efecto, f]));

  const primarios = diseno.efectos.filter((e) => e.primario);
  if (diseno.efectos.length === 0) {
    avisos.push('Una Técnica necesita al menos un Efecto Primario.');
  } else if (primarios.length === 0) {
    avisos.push('Falta el Efecto Primario: toda Técnica tiene uno, y sólo uno.');
  } else if (primarios.length > 1) {
    avisos.push(`Has marcado ${primarios.length} Efectos Primarios y sólo puede haber uno.`);
  }

  const detalles: DetalleEfecto[] = [];
  const ki: Partial<Record<CaracteristicaKi, number>> = {};

  for (const elegido of diseno.efectos) {
    const opcion = porReferencia.get(elegido.referencia);
    if (!opcion) {
      avisos.push(`Efecto desconocido: "${elegido.referencia}".`);
      continue;
    }
    // La ficha del efecto usa el nombre «bonito»; la tabla de opciones lo escribe en
    // mayúsculas iniciales. Se busca por los dos.
    const ficha =
      porEfecto.get(opcion.efecto) ??
      catalogo.fichas.find((f) => f.efecto.toLowerCase() === opcion.efecto.toLowerCase());
    const caracteristicas = leerCaracteristicas(ficha?.caracteristicas);

    const kiBase = elegido.primario ? (opcion.kiPrincipal ?? 0) : (opcion.kiSecundaria ?? 0);
    const usadas = CARACTERISTICAS_KI.filter((c) => (elegido.reparto[c] ?? 0) > 0);
    // Sólo se paga recargo por las opcionales; la principal va incluida en el coste.
    const recargo = usadas
      .filter((c) => c !== caracteristicas.principal)
      .reduce(
        (t, c) => t + (caracteristicas.alternativas.find((a) => a.caracteristica === c)?.recargo ?? 0),
        0,
      );
    const kiTotal = kiBase + recargo;
    const repartido = suma(elegido.reparto);

    for (const c of usadas) ki[c] = (ki[c] ?? 0) + (elegido.reparto[c] ?? 0);
    // Sin reparto, todo el coste va a la característica natural del efecto.
    if (usadas.length === 0 && caracteristicas.principal) {
      ki[caracteristicas.principal] = (ki[caracteristicas.principal] ?? 0) + kiBase;
    }

    if (usadas.length > 0 && repartido !== kiTotal) {
      avisos.push(
        `${opcion.efecto} ${opcion.opcion}: has repartido ${repartido} puntos de Ki y hacen ` +
          `falta ${kiTotal}${recargo > 0 ? ` (${kiBase} + ${recargo} de recargo)` : ''}.`,
      );
    }
    for (const c of usadas) {
      if (c !== caracteristicas.principal && !caracteristicas.alternativas.some((a) => a.caracteristica === c)) {
        avisos.push(`${opcion.efecto}: ${c} no es una característica válida para este Efecto.`);
      }
    }

    const nivelMinimo = opcion.nivel ?? 1;
    if (nivelMinimo > nivel) {
      avisos.push(
        `${opcion.efecto} ${opcion.opcion} es un Efecto de nivel ${nivelMinimo}: no cabe en una ` +
          `Técnica de nivel ${nivel}.`,
      );
    }
    // Las Sostenidas sólo admiten Efectos de nivel **inferior** al suyo.
    if (diseno.sostenida && nivelMinimo >= nivel) {
      avisos.push(
        `Una Técnica Sostenida sólo puede usar Efectos de nivel inferior al suyo, y ` +
          `${opcion.efecto} ${opcion.opcion} es de nivel ${nivelMinimo}.`,
      );
    }

    detalles.push({
      referencia: elegido.referencia,
      efecto: opcion.efecto,
      opcion: String(opcion.opcion ?? ''),
      primario: elegido.primario,
      kiBase,
      recargo,
      kiTotal,
      repartido: usadas.length > 0 ? repartido : kiBase,
      CM: opcion.CM ?? 0,
      nivelMinimo,
      tipo: ficha?.tipo ?? '',
      clase: ficha?.clase ?? '',
      caracteristicas,
      extraMantenimiento: opcion.mantenimiento ?? 0,
      extraSostenimiento:
        diseno.sostenida === 'mayor'
          ? (opcion.sostenidaMayor ?? 0)
          : diseno.sostenida === 'menor'
            ? (opcion.sostenidaMenor ?? 0)
            : 0,
    });
  }

  // ── Mantener y Sostener ──
  if (diseno.mantenida && diseno.sostenida) {
    avisos.push('Una Técnica no puede tener Efectos Mantenidos y Sostenidos a la vez.');
  }
  const cmMantenida = diseno.mantenida ? CM_MANTENIDA[nivel] : 0;
  let cmSostenida = 0;
  if (diseno.sostenida) {
    const coste = CM_SOSTENIDA[diseno.sostenida][nivel];
    if (coste === undefined) {
      avisos.push('Las Técnicas Sostenidas son siempre de segundo o tercer nivel.');
    } else {
      cmSostenida = coste;
    }
  }
  const kiMantenimiento = diseno.mantenida
    ? detalles.reduce((t, d) => t + d.extraMantenimiento, 0)
    : 0;
  const kiSostenimiento = detalles.reduce((t, d) => t + d.extraSostenimiento, 0);

  // El Ki añadido por Mantener o Sostener se reparte libremente; aquí se suma al total
  // y en la interfaz se indica que hay que colocarlo.
  const extra = kiMantenimiento + kiSostenimiento;

  // ── Alterar el coste (regla de la página 46) ──
  const reduccion = suma(diseno.reduccionKi);
  const cmReduccionKi = reduccion * CM_POR_PUNTO_DE_KI;
  if (reduccion > MAX_REDUCCION_KI) {
    avisos.push(
      `Sólo se pueden rebajar ${MAX_REDUCCION_KI} puntos de Ki (${MAX_REDUCCION_KI * CM_POR_PUNTO_DE_KI} CM) y has puesto ${reduccion}.`,
    );
  }
  const caracteristicasUsadas = CARACTERISTICAS_KI.filter((c) => (ki[c] ?? 0) > 0);
  if (reduccion > 0 && caracteristicasUsadas.length < CARACTERISTICAS_PARA_REDUCIR) {
    avisos.push(
      `Para rebajar el coste en Ki la Técnica tiene que apoyarse en al menos ` +
        `${CARACTERISTICAS_PARA_REDUCIR} características distintas, y usa ${caracteristicasUsadas.length}.`,
    );
  }
  for (const c of CARACTERISTICAS_KI) {
    const rebaja = diseno.reduccionKi[c] ?? 0;
    if (rebaja <= 0) continue;
    const base = ki[c] ?? 0;
    // No se puede bajar por debajo de la mitad del coste base, redondeando hacia arriba.
    const suelo = Math.ceil(base / 2);
    if (base - rebaja < suelo) {
      avisos.push(`${c}: no puedes bajar de ${suelo}, la mitad de su coste base (${base}).`);
    }
    ki[c] = Math.max(0, base - rebaja);
  }

  if (diseno.descuentoCM > MAX_DESCUENTO_CM) {
    avisos.push(`El descuento máximo en CM es ${MAX_DESCUENTO_CM} y has puesto ${diseno.descuentoCM}.`);
  }
  if (diseno.descuentoCM % CM_POR_DESCUENTO !== 0) {
    avisos.push(`El descuento de CM va de ${CM_POR_DESCUENTO} en ${CM_POR_DESCUENTO}.`);
  }
  // Cada 5 CM de descuento cuestan 2 puntos de Ki más.
  const kiPorDescuento = (diseno.descuentoCM / CM_POR_DESCUENTO) * KI_POR_DESCUENTO;

  // ── Desventajas ──
  if (diseno.desventajas.length > limites.maxDesventajas) {
    avisos.push(
      `Una Técnica de nivel ${nivel} admite ${limites.maxDesventajas} desventaja(s) y has elegido ` +
        `${diseno.desventajas.length}.`,
    );
  }
  const cmDesventajas = diseno.desventajas.reduce(
    (t, ref) => t + Math.abs(porReferencia.get(ref)?.CM ?? 0),
    0,
  );

  // ── CM final ──
  const cmEfectos = detalles.reduce((t, d) => t + d.CM, 0);
  const bruto =
    cmEfectos + cmMantenida + cmSostenida + cmReduccionKi - diseno.descuentoCM - cmDesventajas;

  let CM = bruto;
  if (bruto < limites.cmMinimo) {
    // El manual lo dice expresamente: se puede crear igual, pero cuesta el mínimo.
    CM = limites.cmMinimo;
  }
  if (bruto > limites.cmMaximo) {
    avisos.push(
      `Una Técnica de nivel ${nivel} no puede pasar de ${limites.cmMaximo} CM y la tuya suma ${bruto}. ` +
        'Quita algún Efecto o añade una Desventaja.',
    );
  }

  return {
    detalles,
    cmEfectos,
    cmMantenida,
    cmSostenida,
    cmReduccionKi,
    cmDescuento: diseno.descuentoCM + cmDesventajas,
    CM,
    ki,
    kiTotal: suma(ki) + extra + kiPorDescuento,
    kiMantenimiento,
    avisos,
  };
}

/**
 * Comprueba la regla de árbol: dos Técnicas del nivel anterior antes de subir.
 * `nivelesConocidos` es la lista de niveles de las Técnicas que ya tiene el personaje.
 */
export function puedeCrearNivel(
  nivel: NivelTecnica,
  nivelesConocidos: number[],
  tecnicasDesvinculadas = false,
): { puede: boolean; motivo?: string } {
  if (tecnicasDesvinculadas) return { puede: true };
  const previo = TECNICAS_PREVIAS[nivel];
  if (!previo) return { puede: true };
  const cuantas = nivelesConocidos.filter((n) => n === previo.nivel).length;
  if (cuantas >= previo.cuantas) return { puede: true };
  return {
    puede: false,
    motivo:
      `Para una Técnica de nivel ${nivel} hacen falta ${previo.cuantas} de nivel ${previo.nivel}, ` +
      `y tienes ${cuantas}. La ventaja Técnicas desvinculadas se salta esta regla.`,
  };
}

/**
 * Reparto por defecto de un efecto: todo a su característica natural. Es el punto de
 * partida del paso 6, antes de que el jugador mueva puntos a las opcionales.
 */
export function repartoPorDefecto(
  opcion: EfectoTecnica,
  ficha: TipoEfectoTecnica | undefined,
  primario: boolean,
): Partial<Record<CaracteristicaKi, number>> {
  const { principal } = leerCaracteristicas(ficha?.caracteristicas);
  const coste = primario ? (opcion.kiPrincipal ?? 0) : (opcion.kiSecundaria ?? 0);
  return principal ? { [principal]: coste } : {};
}

/** Resumen en una línea, con el mismo formato que usa el compendio del manual. */
export function resumirCoste(ki: Partial<Record<CaracteristicaKi, number>>): string {
  return CARACTERISTICAS_KI.filter((c) => (ki[c] ?? 0) > 0)
    .map((c) => `${c} ${ki[c]}`)
    .join(' ');
}
