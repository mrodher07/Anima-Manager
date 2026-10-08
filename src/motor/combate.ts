/**
 * Combate: equipo, habilidades por arma y resolución de asaltos.
 *
 * Las fórmulas están en `reglamento.ts` para que una mesa pueda cambiarlas;
 * aquí se encadenan con el equipo y las características del personaje.
 */

import { Reglamento, REGLAMENTO_OFICIAL } from './reglamento';
import { tirarD100, type Aleatorio, type Tirada, azarReal } from './dados';
import type { Arma, Armadura, TablasBase } from '../datos/tipos';

/** Los siete tipos de daño de Anima. Cada armadura da un TA distinto contra cada uno. */
export const TIPOS_DANO = ['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'] as const;
export type TipoDano = (typeof TIPOS_DANO)[number];

export interface PiezaEquipada {
  armadura: string;
  calidad?: number;
  /** Encantada: sólo entonces la calidad sube también el TA contra Energía. `Combate!S12`. */
  encantada?: boolean;
}

/**
 * Escala del arma. No es el campo `tamano` del catálogo (Pequeña/Mediana/Grande, que mide
 * el bulto para transportarla), sino la versión del arma: una Enorme multiplica el daño
 * pero exige más Fuerza y Tamaño. Lo elige el jugador al equiparla.
 */
export type EscalaArma = 'Normal' | 'Enorme' | 'Gigante';

export interface ArmaEquipada {
  arma: string;
  calidad?: number;
  aDosManos?: boolean;
  escala?: EscalaArma;
  /** Conocimiento del personaje sobre el arma. Modifica ataque y parada. */
  conocimiento?: 'Conocida' | 'Similar' | 'Mixta' | 'Distinta';
}

/** Penalizadores por usar un arma que no se domina. Core Exxet, cap. 7. */
export const PENALIZADOR_CONOCIMIENTO: Record<string, number> = {
  Conocida: 0,
  Similar: -20,
  Mixta: -40,
  Distinta: -60,
};

export interface ProteccionTotal {
  /**
   * TA del cuerpo por tipo de daño. No se suman: la mejor capa, más la mitad de la segunda y
   * la mitad de la tercera. Ficha, `Combate!AY9`.
   */
  TA: Record<TipoDano, number>;
  /** TA de la cabeza: el yelmo combinado con las capas naturales. Ficha, `Combate!AY10`. */
  TACabeza: Record<TipoDano, number>;
  /** Requerimiento combinado, yelmo incluido. La calidad lo rebaja. `Combate!H16`. */
  requisito: number;
  /** Penalizador al turno y a las secundarias físicas. `Combate!S17`. */
  penalizadorNatural: number;
  /**
   * Nadar no se beneficia de que Llevar Armadura sobrepase el requerimiento: le llega el
   * penalizador de las piezas entero. `Principal!O25`.
   */
  penalizadorNadar: number;
  /** Sigilo sólo puede compensar hasta la mitad del penalizador de las piezas. `Principal!O58`. */
  penalizadorSigilo: number;
  /** El yelmo no da penalizador natural sino a la percepción: Advertir y Buscar. `Principal!O36`. */
  penalizadorPercepcion: number;
  /** Penalizador a toda acción física por no llegar al requerimiento. `Combate!S16`. */
  penalizadorAccionFisica: number;
  restriccionMovimiento: number;
  presencia: number;
}

/** El yelmo va en su casilla, aparte del cuerpo. Los del catálogo dicen «Cabeza». */
function esYelmo(a: Armadura): boolean {
  return a.esYelmo === true || a.localizacion === 'Cabeza';
}

/** La mejor capa más la mitad de la otra. `Combate!AY9` y `AY10`. */
function combinarCapas(a: number, b: number): number {
  return a > b ? a + Math.trunc(b / 2) : b + Math.trunc(a / 2);
}

/**
 * Combina las piezas de armadura. Core Exxet, cap. 8, tal como lo cuenta la hoja de la
 * comunidad (v8.7.0, pestaña Combate):
 *
 * - **Calidad**: cada +5 suma 1 al TA (a Energía sólo si la pieza está encantada), y rebaja
 *   en lo mismo el requerimiento y el penalizador natural de esa pieza.
 * - **Capas**: los TA no se suman. Del cuerpo cuenta la mejor armadura dura o la mejor no
 *   dura —la que sea mayor— más la mitad de la otra, más la mitad de la segunda no dura.
 *   Las capas «naturales» (Armadura natural, Armadura mística…) cuentan como no duras.
 * - Cada armadura de más que no sea natural añade −20 al penalizador natural, hasta −40.
 * - El **yelmo** va aparte: protege la cabeza, suma su requerimiento y penaliza la
 *   percepción, no el resto de acciones.
 * - Si Llevar Armadura no llega al requerimiento, la diferencia penaliza **toda acción
 *   física**. Lo que lo sobrepasa compensa el penalizador natural, y cada 50 puntos de
 *   exceso bajan un punto la restricción de movimiento.
 */
export function combinarArmadura(
  piezas: PiezaEquipada[],
  catalogo: Armadura[],
  llevarArmadura: number,
  capaNatural: Partial<Record<TipoDano, number>> = {},
): ProteccionTotal {
  const cero = () => Object.fromEntries(TIPOS_DANO.map((t) => [t, 0])) as Record<TipoDano, number>;
  const TA = cero();
  const TACabeza = cero();
  let requisito = 0;
  let penPiezas = 0;
  let restBruta = 0;
  let presencia = 0;
  let noNaturales = 0;
  let penalizadorPercepcion = 0;

  /** TA de cada capa: las piezas que lleva y, si las hay, las naturales. */
  const duras: Record<TipoDano, number>[] = [];
  const blandas: Record<TipoDano, number>[] = [];
  const naturales: Record<TipoDano, number>[] = [];
  let yelmo: Record<TipoDano, number> | null = null;

  for (const pieza of piezas) {
    const datos = catalogo.find((a) => a.armadura === pieza.armadura);
    if (!datos) continue;
    const calidad = pieza.calidad ?? 0;
    const ta = cero();
    for (const t of TIPOS_DANO) {
      ta[t] = (datos[t] ?? 0) + (t === 'ENE' && !pieza.encantada ? 0 : calidad / 5);
    }
    requisito += Math.max(0, (datos.requerimiento ?? 0) - calidad);
    presencia = Math.max(presencia, datos.presencia ?? 0);
    if (esYelmo(datos)) {
      yelmo = ta;
      // La tercera columna de la tabla de yelmos es el penalizador a la percepción.
      penalizadorPercepcion += datos.penNatural ?? 0;
      continue;
    }
    penPiezas += Math.min(0, (datos.penNatural ?? 0) + calidad);
    // La calidad también alivia la restricción: un punto por cada +5. Combate!R12.
    restBruta += Math.max(0, (datos.restMovimiento ?? 0) - calidad / 5);
    if (datos.clase === 'Natural') naturales.push(ta);
    else {
      noNaturales++;
      (datos.clase === 'Dura' ? duras : blandas).push(ta);
    }
  }
  if (TIPOS_DANO.some((t) => (capaNatural[t] ?? 0) > 0)) {
    naturales.push(Object.fromEntries(TIPOS_DANO.map((t) => [t, capaNatural[t] ?? 0])) as Record<TipoDano, number>);
  }

  for (const t of TIPOS_DANO) {
    const mejores = (capas: Record<TipoDano, number>[]) => capas.map((c) => c[t]).sort((a, b) => b - a);
    const dura = mejores(duras)[0] ?? 0;
    const [noDura1 = 0, noDura2 = 0] = mejores([...blandas, ...naturales]);
    TA[t] = combinarCapas(dura, noDura1) + Math.trunc(noDura2 / 2);
    const [nat1 = 0, nat2 = 0] = mejores(naturales);
    TACabeza[t] = combinarCapas(yelmo?.[t] ?? 0, nat1) + Math.trunc(nat2 / 2);
  }

  const excedente = Math.max(0, llevarArmadura - requisito);
  const capas = Math.max(-40, Math.min(0, -20 * noNaturales + 20));
  const penalizadorNatural = Math.min(0, excedente + penPiezas) + capas;
  return {
    TA,
    TACabeza,
    requisito,
    penalizadorNatural,
    penalizadorNadar: capas + penPiezas,
    penalizadorSigilo: capas + Math.min(penPiezas + excedente, Math.trunc(penPiezas / 2)),
    penalizadorPercepcion,
    penalizadorAccionFisica: requisito === 0 ? 0 : Math.min(0, llevarArmadura - requisito),
    restriccionMovimiento: Math.max(0, restBruta - Math.trunc(excedente / 50)),
    presencia,
  };
}

export interface HabilidadesArma {
  arma: string;
  turno: number;
  ataque: number;
  parada: number;
  esquiva: number;
  dano: number;
  criticos: string[];
  /** Avisos, por ejemplo si no se llega a la FUE requerida. */
  avisos: string[];
}

export interface ContextoCombate {
  bonoFUE: number;
  FUE: number;
  tamano: number;
  turnoNatural: number;
  HAtaque: number;
  HParada: number;
  HEsquiva: number;
  tablas: TablasBase;
}

/** Calcula las habilidades del personaje con un arma concreta. */
export function calcularArma(
  equipada: ArmaEquipada,
  catalogo: Arma[],
  ctx: ContextoCombate,
  reglamento: Reglamento = REGLAMENTO_OFICIAL,
): HabilidadesArma {
  const avisos: string[] = [];
  const datos = catalogo.find((a) => a.arma === equipada.arma);
  if (!datos) {
    return {
      arma: equipada.arma,
      turno: 0, ataque: 0, parada: 0, esquiva: ctx.HEsquiva, dano: 0,
      criticos: [],
      avisos: [`Arma desconocida: "${equipada.arma}".`],
    };
  }

  const calidad = equipada.calidad ?? 0;
  const aDosManos = equipada.aDosManos ?? false;
  const conocimiento = equipada.conocimiento ?? 'Conocida';

  // Armas Enormes o Gigantes: multiplican el daño pero exigen más Fuerza y Tamaño.
  const escala = equipada.escala ?? 'Normal';
  const filaTamano = ctx.tablas.armasEnormes?.find((f) => f.tamano === escala);
  const multTamano = filaTamano?.multDano ?? 1;
  const penTamano = filaTamano?.penFUE ?? 0;

  const tamanoInsuficiente = escala !== 'Normal' && ctx.tamano < (filaTamano?.tamanoMin ?? 0);
  if (tamanoInsuficiente) {
    avisos.push(
      `Tu Tamaño (${ctx.tamano}) no llega al mínimo del arma ${escala} (${filaTamano?.tamanoMin}): −40 al turno.`,
    );
  }

  const fueRequerida = (aDosManos ? datos.fueReq2M : datos.fueRequerida) ?? 0;
  const faltaFUE = Math.min(0, 10 * (ctx.FUE - fueRequerida - penTamano));
  if (faltaFUE < 0) {
    avisos.push(`Te falta Fuerza para esta arma (requiere ${fueRequerida + penTamano}): ${faltaFUE} al ataque.`);
  }

  const penConocimiento = PENALIZADOR_CONOCIMIENTO[conocimiento] ?? 0;
  const penTamanoTurno = tamanoInsuficiente ? -40 : 0;

  const turno = ctx.turnoNatural + (datos.turno ?? 0) + calidad + penTamanoTurno;
  const ataque = ctx.HAtaque + penConocimiento + calidad + faltaFUE;
  const parada = ctx.HParada + penConocimiento + calidad + faltaFUE + (datos.bonusParada ?? 0);
  const esquiva = ctx.HEsquiva + (datos.bonusEsquiva ?? 0);

  const dano = reglamento.aplicar('danoArma', {
    danoBase: datos.dano ?? 0,
    danoMunicion: 0,
    multTamano,
    bonoFUE: ctx.bonoFUE,
    aDosManos,
    calidad,
    extras: 0,
  });

  return {
    arma: datos.arma,
    turno,
    ataque,
    parada,
    esquiva,
    dano,
    criticos: [datos.critico1, datos.critico2].filter((c): c is string => !!c && c !== '-'),
    avisos,
  };
}

// ──────────────────────── Resolución de un asalto ────────────────────────

export interface Atacante {
  nombre: string;
  habilidadAtaque: number;
  dano: number;
  tipoDano: TipoDano;
}

export interface Defensor {
  nombre: string;
  habilidadDefensa: number;
  /** Tipo de defensa, sólo informativo. */
  tipoDefensa: 'Parada' | 'Esquiva';
  TA: Record<TipoDano, number>;
  pvActuales: number;
}

export interface ResultadoAsalto {
  tiradaAtaque: Tirada;
  tiradaDefensa: Tirada;
  totalAtaque: number;
  totalDefensa: number;
  /** Diferencia entre ataque y defensa. */
  resultado: number;
  impacta: boolean;
  contraataque: boolean;
  absorcion: number;
  margen: number;
  porcentajeDano: number;
  danoInfligido: number;
  critico: boolean;
  descripcion: string;
}

/**
 * Resuelve un asalto completo: ataque contra defensa, daño y crítico.
 * Core Exxet, cap. 9.
 */
export function resolverAsalto(
  atacante: Atacante,
  defensor: Defensor,
  reglamento: Reglamento = REGLAMENTO_OFICIAL,
  azar: Aleatorio = azarReal,
): ResultadoAsalto {
  const tiradaAtaque = tirarD100(atacante.habilidadAtaque, azar);
  const tiradaDefensa = tirarD100(defensor.habilidadDefensa, azar);

  const totalAtaque = atacante.habilidadAtaque + tiradaAtaque.total;
  const totalDefensa = defensor.habilidadDefensa + tiradaDefensa.total;
  const resultado = totalAtaque - totalDefensa;

  const TA = defensor.TA[atacante.tipoDano] ?? 0;
  const absorcion = reglamento.aplicar('absorcion', { TA });

  if (resultado <= 0) {
    return {
      tiradaAtaque, tiradaDefensa, totalAtaque, totalDefensa, resultado,
      impacta: false,
      contraataque: true,
      absorcion, margen: 0, porcentajeDano: 0, danoInfligido: 0, critico: false,
      descripcion: `${defensor.nombre} se defiende y consigue contraataque (Acción Respuesta).`,
    };
  }

  const margen = resultado - absorcion;
  const porcentajeDano = reglamento.aplicar('porcentajeDano', { margen });
  const danoInfligido = Math.floor((atacante.dano * porcentajeDano) / 100);

  const umbral = reglamento.aplicar(
    'umbralCritico',
    { pvActuales: defensor.pvActuales, pvMaximos: defensor.pvActuales },
    Number.POSITIVE_INFINITY,
  );
  const critico = danoInfligido > 0 && danoInfligido >= umbral;

  let descripcion: string;
  if (porcentajeDano === 0) {
    descripcion = `Impacta, pero la armadura lo detiene (margen ${margen}, hace falta 10).`;
  } else {
    descripcion =
      `Impacta: ${porcentajeDano} % de ${atacante.dano} = ${danoInfligido} PV` +
      (critico ? '. ¡CRÍTICO!' : '.');
  }

  return {
    tiradaAtaque, tiradaDefensa, totalAtaque, totalDefensa, resultado,
    impacta: true,
    contraataque: false,
    absorcion, margen, porcentajeDano, danoInfligido, critico,
    descripcion,
  };
}
