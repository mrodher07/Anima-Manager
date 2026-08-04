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
  /** TA final por tipo de daño; se toma el mayor de las piezas, no la suma. */
  TA: Record<TipoDano, number>;
  /** Requerimiento combinado: los de las piezas se suman. */
  requisito: number;
  /** Penalizador al turno y a las secundarias físicas. */
  penalizadorNatural: number;
  /** Penalizador a toda acción física por no llegar al requerimiento. */
  penalizadorAccionFisica: number;
  restriccionMovimiento: number;
  presencia: number;
}

/**
 * Combina las piezas de armadura. Core Exxet, cap. 8.
 *
 * - Los **TA** no se suman: se toma el **valor más alto** de cada tipo entre las piezas.
 * - Los **requerimientos**, los penalizadores naturales y las restricciones de movimiento
 *   sí se **acumulan**.
 * - Si Llevar Armadura no llega al requerimiento, la diferencia penaliza **toda acción
 *   física**.
 * - El excedente de Llevar Armadura sobre el requerimiento **compensa** el penalizador
 *   natural, y por cada 50 puntos de exceso baja un punto la restricción de movimiento.
 */
export function combinarArmadura(
  piezas: PiezaEquipada[],
  catalogo: Armadura[],
  llevarArmadura: number,
): ProteccionTotal {
  const TA = Object.fromEntries(TIPOS_DANO.map((t) => [t, 0])) as Record<TipoDano, number>;
  let requisito = 0;
  let penNaturalBruto = 0;
  let restBruta = 0;
  let presencia = 0;

  for (const pieza of piezas) {
    const datos = catalogo.find((a) => a.armadura === pieza.armadura);
    if (!datos) continue;
    const calidad = pieza.calidad ?? 0;
    for (const t of TIPOS_DANO) {
      const valor = (datos[t] ?? 0) + (calidad >= 5 ? 1 : 0);
      TA[t] = Math.max(TA[t], valor);
    }
    requisito += datos.requerimiento ?? 0;
    penNaturalBruto += datos.penNatural ?? 0;
    restBruta += datos.restMovimiento ?? 0;
    presencia = Math.max(presencia, datos.presencia ?? 0);
  }

  if (piezas.length === 0) {
    return {
      TA, requisito: 0, penalizadorNatural: 0, penalizadorAccionFisica: 0,
      restriccionMovimiento: 0, presencia: 0,
    };
  }

  const excedente = Math.max(0, llevarArmadura - requisito);
  const penalizadorNatural = Math.min(0, excedente + penNaturalBruto);
  const penalizadorAccionFisica = Math.min(0, llevarArmadura - requisito);
  const restriccionMovimiento = Math.max(0, restBruta - Math.trunc(excedente / 50));

  return {
    TA, requisito, penalizadorNatural, penalizadorAccionFisica, restriccionMovimiento, presencia,
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
