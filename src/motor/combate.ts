/**
 * Combate: equipo, habilidades por arma y resolución de asaltos.
 *
 * Las fórmulas están en `reglamento.ts` para que una mesa pueda cambiarlas;
 * aquí se encadenan con el equipo y las características del personaje.
 */

import { Reglamento, REGLAMENTO_OFICIAL } from './reglamento';
import { evaluar } from './expresiones';
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
  /** Lo que dispara un arma de proyectiles: una fila de munición del catálogo. */
  municion?: string;
  calidadMunicion?: number;
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
  /**
   * Las capas naturales que no son piezas: Armadura natural, las escamas del Turak, la
   * Armadura de energía del Ki… Cada una es una capa aparte (`Combate!AY21:BE27`).
   */
  capasNaturales: Partial<Record<TipoDano, number>>[] | Partial<Record<TipoDano, number>> = [],
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
  for (const capa of Array.isArray(capasNaturales) ? capasNaturales : [capasNaturales]) {
    if (TIPOS_DANO.some((t) => (capa[t] ?? 0) > 0)) {
      naturales.push(Object.fromEntries(TIPOS_DANO.map((t) => [t, capa[t] ?? 0])) as Record<TipoDano, number>);
    }
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
  /**
   * La defensa que la hoja pone con esta arma: la Parada si es mayor que la Esquiva, si no
   * la Esquiva (`Combate!J29`, `K29`).
   */
  defensa: number;
  tipoDefensa: 'Parada' | 'Esquiva';
  dano: number;
  criticos: string[];
  /** «-» si el arma no tiene (Umbra). `Combate!E31`. */
  entereza: number | string;
  /** «-» si el arma no tiene (las de asedio). `Combate!F31`. */
  rotura: number | string;
  presencia: number | string;
  /** Cómo la conoce el personaje, después de mirar si tiene el Ars Magnus que pide. */
  conocimiento: NonNullable<ArmaEquipada['conocimiento']>;
  /**
   * Falso si no se puede empuñar así (un arma de dos manos a una, una fila de munición…):
   * la hoja deja a 0 lo que no puede calcular.
   */
  utilizable: boolean;
  /** Avisos, por ejemplo si no se llega a la FUE requerida. */
  avisos: string[];
}

export interface ContextoCombate {
  bonoFUE: number;
  FUE: number;
  tamano: number;
  /** El Turno sin los +20 de ir desarmado: la hoja los quita al coger un arma (`Combate!AW40`). */
  turnoNatural: number;
  HAtaque: number;
  HParada: number;
  HEsquiva: number;
  tablas: TablasBase;
  /** Bono de cada característica, para las armas que no suman el de FUE (Umbra, Piscis). */
  bonos?: Partial<Record<string, number>>;
  /** Valor de cada característica, para las fórmulas de daño (Atlatl: FUE + 2). */
  valores?: Partial<Record<string, number>>;
  /** Presencia del personaje: la de algunas armas del Zodiaco y el daño de Umbra. */
  presencia?: number;
  raza?: string;
  legados?: string[];
  /** Ars Magnus que tiene: sin el suyo, un arma del Zodiaco es Distinta. */
  arsMagnus?: string[];
  /** Habilidades del Ki: Daño incrementado y Extensión del aura al arma suman al arma. */
  habilidadesKi?: string[];
}

/** Lo que la hoja hace con IFERROR: lo que no se puede calcular sale 0. */
const oCero = (x: number) => (Number.isFinite(x) ? x : 0);

/** Un valor de la tabla de armas: «-» o un texto no es un número, y lo que lo use tampoco. */
function cifra(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  return typeof v === 'number' ? v : Number.NaN;
}

/** El bono de una característica de valor `x`, como `VLOOKUP(x, Tabla_BonoStats, 2)`. */
function bonoDe(tablas: TablasBase, x: number, exacto = false): number {
  const filas = tablas.bonoCaracteristica ?? [];
  if (exacto) return filas.find((f) => f.valor === x)?.bono ?? Number.NaN;
  let bono = Number.NaN;
  for (const f of filas) if (f.valor <= x) bono = f.bono;
  return bono;
}

/** La fila de la tabla de creación de seres que toca a un Tamaño. */
function filaTamano(tablas: TablasBase, tamano: number) {
  let fila: NonNullable<TablasBase['creacionSeres']>[number] | undefined;
  for (const f of tablas.creacionSeres ?? []) if (f.tamano <= tamano) fila = f;
  return fila;
}

/**
 * Las Armas naturales con los números del que las tiene: su raza (o el Legado de Sangre,
 * que manda) y su Tamaño. `Tablas!E639:N639`.
 */
function conArmaNatural(datos: Arma, ctx: ContextoCombate, avisos: string[]): Arma {
  const filas = ctx.tablas.armasNaturales ?? [];
  const propia =
    filas.find((f) => f.legado && ctx.legados?.includes(f.legado)) ??
    filas.find((f) => f.raza && f.raza === ctx.raza);
  const porTamano = filaTamano(ctx.tablas, ctx.tamano);
  if (!propia) avisos.push('Armas naturales no disponibles para su raza: la hoja les pone daño 0.');
  return {
    ...datos,
    dano: propia ? (propia.dano === 'tamaño' ? (porTamano?.armaNatural ?? 0) : propia.dano) : 0,
    critico1: propia?.critico1 ?? '-',
    critico2: propia?.critico2 ?? '-',
    tipoArma: propia?.tipoArma ?? datos.tipoArma,
    entereza: propia?.entereza ?? porTamano?.entereza,
    rotura: propia?.rotura ?? porTamano?.rotura,
  };
}

/**
 * Calcula las habilidades del personaje con un arma concreta, como la pestaña Combate de la
 * hoja de la comunidad (v8.7.0, `Combate!AW40:AW46` y `C31:G31`).
 */
export function calcularArma(
  equipada: ArmaEquipada,
  catalogo: Arma[],
  ctx: ContextoCombate,
  reglamento: Reglamento = REGLAMENTO_OFICIAL,
): HabilidadesArma {
  const avisos: string[] = [];
  const encontrada = catalogo.find((a) => a.arma === equipada.arma);
  if (!encontrada) {
    return {
      arma: equipada.arma,
      turno: 0, ataque: 0, parada: 0, esquiva: ctx.HEsquiva, defensa: 0, tipoDefensa: 'Esquiva',
      dano: 0, criticos: [], entereza: 0, rotura: 0, presencia: 0,
      conocimiento: equipada.conocimiento ?? 'Conocida', utilizable: false,
      avisos: [`Arma desconocida: "${equipada.arma}".`],
    };
  }
  // Las Armas naturales salen de la raza; su munición, del arma (`Tablas!I793:N793`), con
  // daño 0.
  const datos = !encontrada.porRaza
    ? encontrada
    : encontrada.arma === 'Armas naturales'
      ? conArmaNatural(encontrada, ctx, avisos)
      : { ...conArmaNatural(encontrada, ctx, []), dano: 0, tipoArma: encontrada.tipoArma };

  const calidad = equipada.calidad ?? 0;
  const aDosManos = equipada.aDosManos ?? false;
  const esVirgo = datos.arma.includes('Virgo');
  const calidadQueSuma = esVirgo ? 0 : calidad;
  const esEscudo = (datos.tipoArma ?? '').includes('Escudo');
  const habilidadKi = (n: string) => ctx.habilidadesKi?.includes(n) ?? false;
  const extensionAura = habilidadKi('Extensión del aura al arma');

  // Las armas del Zodiaco sólo se conocen con su Ars Magnus.
  let conocimiento = equipada.conocimiento ?? 'Conocida';
  if (datos.requiereArsMagnus?.length && !datos.requiereArsMagnus.some((a) => ctx.arsMagnus?.includes(a))) {
    conocimiento = 'Distinta';
    avisos.push(`Sin el Ars Magnus (${datos.requiereArsMagnus.join(' o ')}) es un arma Distinta.`);
  } else if (datos.requiereArmas && conocimiento === 'Conocida') {
    avisos.push(`Para que sea Conocida la hoja pide además conocer ${datos.requiereArmas}.`);
  }

  // Armas Enormes o Gigantes: multiplican el daño pero exigen más Fuerza y Tamaño.
  const escala = equipada.escala ?? 'Normal';
  const filaEscala = ctx.tablas.armasEnormes?.find((f) => f.tamano === escala);
  const multTamano = filaEscala?.multDano ?? 1;
  const penTamano = filaEscala?.penFUE ?? 0;
  const tamanoInsuficiente = escala !== 'Normal' && ctx.tamano < (filaEscala?.tamanoMin ?? 0);
  if (tamanoInsuficiente) {
    avisos.push(
      `Tu Tamaño (${ctx.tamano}) no llega al mínimo del arma ${escala} (${filaEscala?.tamanoMin}): −40 al turno.`,
    );
  }

  // «-» en la FUE requerida: así no se puede empuñar, y la hoja deja ataque y defensa a 0.
  const fueRequerida = cifra(aDosManos ? datos.fueReq2M : datos.fueRequerida);
  const faltaFUE = Math.min(0, 10 * (ctx.FUE - fueRequerida - penTamano));
  if (faltaFUE < 0) {
    avisos.push(`Te falta Fuerza para esta arma (requiere ${fueRequerida + penTamano}): ${faltaFUE} al ataque.`);
  }
  const esMunicion = (datos.tipoArma ?? '').startsWith('Munición');
  const utilizable = Number.isFinite(faltaFUE) && !esMunicion;
  if (!utilizable) {
    avisos.push(
      esMunicion
        ? 'Es munición: va en un arma de proyectiles.'
        : `No se puede empuñar ${aDosManos ? 'a dos manos' : 'a una mano'}.`,
    );
  }

  // Una fila de munición no tiene casilla de conocimiento: sin ella la hoja no saca ni
  // ataque ni defensa (`Combate!C29`).
  const penConocimiento = esMunicion ? Number.NaN : (PENALIZADOR_CONOCIMIENTO[conocimiento] ?? 0);
  // La Lanza y la Vara a una mano: −10 al ataque (`Combate!AW42`).
  const lanzaUnaMano = (datos.arma === 'Lanza' || datos.arma === 'Vara') && !aDosManos ? -10 : 0;

  // El turno de la hoja ya lleva los +20 de ir desarmado: un arma los quita, un escudo no.
  const turno =
    ctx.turnoNatural + (esEscudo ? 20 : 0) + calidad + cifra(datos.turno) + (tamanoInsuficiente ? -40 : 0);
  const ataque = ctx.HAtaque + penConocimiento + calidadQueSuma + faltaFUE + lanzaUnaMano;
  const parada = ctx.HParada + calidadQueSuma + cifra(datos.bonusParada) + penConocimiento + faltaFUE;
  const esquiva = ctx.HEsquiva + cifra(datos.bonusEsquiva);

  // ── Daño ──
  // Lo que la Tabla de Fuerza suma a la rotura (`Tablas!G14:J33`).
  const roturaFUE = ctx.FUE === 0 ? 0 : (
    [...(ctx.tablas.fuerza ?? [])].reverse().find((f) => f.valor <= ctx.FUE)?.bonoRotura ?? 0
  );
  const variables = {
    FUE: ctx.valores?.FUE ?? ctx.FUE,
    POD: ctx.valores?.POD ?? 0,
    bonoFUE: ctx.bonoFUE,
    bonoPOD: ctx.bonos?.POD ?? 0,
    presencia: ctx.presencia ?? 0,
    roturaFUE,
  };
  const funciones = { bono: (x: number) => bonoDe(ctx.tablas, x) };
  const evaluarArma = (formula: string | undefined, valor: unknown) => {
    if (!formula) return cifra(valor);
    try {
      return evaluar(formula, variables, funciones);
    } catch {
      avisos.push(`No se puede calcular «${formula}».`);
      return Number.NaN;
    }
  };
  const fuerzaArma = evaluarArma(datos.fuerzaFormula, datos.fuerza);
  const atributo = datos.atributoDano ?? 'FUE';
  const bonoAtributo =
    atributo === 'ninguno' ? 0
      : atributo === 'propia' ? bonoDe(ctx.tablas, fuerzaArma)
        : atributo === 'FUE' ? ctx.bonoFUE
          : (ctx.bonos?.[atributo] ?? 0);

  const municion = equipada.municion ? catalogo.find((a) => a.arma === equipada.municion) : undefined;
  if (equipada.municion && !municion) avisos.push(`Munición desconocida: "${equipada.municion}".`);
  if (municion && datos.municiones && !datos.municiones.includes(municion.arma)) {
    avisos.push(`${municion.arma} no es munición de ${datos.arma}.`);
  }
  const calidadMunicion = equipada.calidadMunicion ?? 0;
  const extras = (habilidadKi('Daño incrementado') ? 10 : 0) + (extensionAura ? 10 : 0);

  const dano = reglamento.aplicar('danoArma', {
    danoBase: evaluarArma(datos.danoFormula, datos.dano),
    danoMunicion: municion ? cifra(municion.dano) : 0,
    multTamano,
    bonoFUE: bonoAtributo,
    aDosManos,
    calidad: calidadQueSuma,
    conMunicion: !!municion,
    // Con munición, la Fuerza del arma (la Ballesta tira con la suya) más su calidad / 5.
    bonoMunicion: fuerzaArma === 0 ? bonoAtributo : bonoDe(ctx.tablas, fuerzaArma + calidad / 5, true),
    calidadMunicion,
    extras,
  });

  // ── Entereza, rotura y presencia (`Combate!E31:G31`) ──
  const entereza = Math.max(0, (extensionAura ? 10 : 0) + calidad * 2 + cifra(datos.entereza) + (filaEscala?.enterezaExtra ?? 0));
  const rotura =
    (extensionAura ? 5 : 0) + (calidad * 2) / 5 + evaluarArma(datos.roturaFormula, datos.rotura) +
    (filaEscala?.roturaExtra ?? 0) + roturaFUE + (ctx.legados?.includes('Ojos de la Muerte') ? 5 : 0);
  const presenciaArma = evaluarArma(datos.presenciaFormula, datos.presencia);
  const presencia =
    (datos.arma === 'Ophiucos' ? 0 : Math.max((esVirgo || datos.arma === 'Umbra' ? 0 : calidad) * 10, 0)) +
    presenciaArma;

  const paradaFinal = oCero(parada);
  const esquivaFinal = oCero(esquiva);
  const tipoDefensa = parada > esquiva ? 'Parada' : 'Esquiva';
  return {
    arma: datos.arma,
    turno: oCero(turno),
    ataque: oCero(ataque),
    parada: paradaFinal,
    esquiva: esquivaFinal,
    defensa:
      !Number.isFinite(parada) || !Number.isFinite(esquiva) ? 0
        : tipoDefensa === 'Parada' ? paradaFinal : esquivaFinal,
    tipoDefensa,
    dano: oCero(dano),
    criticos: [municion?.critico1 ?? datos.critico1, municion?.critico2 ?? datos.critico2].filter(
      (c): c is string => !!c && c !== '-',
    ),
    entereza: Number.isFinite(entereza) ? entereza : '-',
    rotura: Number.isFinite(rotura) ? rotura : '-',
    presencia: Number.isFinite(presencia) ? presencia : '-',
    conocimiento,
    utilizable,
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
