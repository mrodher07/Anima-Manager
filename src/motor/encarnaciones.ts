/**
 * Encarnaciones e Invocaciones del Arcana Exxet.
 *
 * De todo el capítulo, lo único que de verdad se **calcula** es la dificultad de
 * sincronizar con una Encarnación. El manual la construye sumando tres cosas:
 *
 *   1. La dificultad base del grado de afinidad que se pretende alcanzar.
 *   2. Los rasgos del invocador que le acercan o le alejan de esa entidad, cada uno con
 *      su modificador (Tabla de Modificadores de Invocación de cada encarnación).
 *   3. Cuánto tiempo se quiere mantener activa (Tabla 12).
 *
 * Y añade un cuarto término que no está en ninguna tabla: **+50 si el invocador no tiene
 * información suficiente sobre la vida y personalidad de la encarnación**. Eso no lo puede
 * decidir la aplicación —depende de lo que el personaje haya investigado en partida—, así
 * que aquí es una casilla que el Director marca.
 *
 * El requisito de nivel se comprueba pero **no bloquea**: se avisa, como el resto de
 * límites de la aplicación.
 */

import type { AfinidadEncarnacion, Encarnacion } from '../datos/tipos';

/** Tabla 12: lo que cuesta mantener activa la Encarnación. */
export const TIEMPOS_SINCRONIZACION: { tiempo: string; modificador: number }[] = [
  { tiempo: '5 Asaltos', modificador: -50 },
  { tiempo: '10 Asaltos', modificador: -25 },
  { tiempo: 'Un minuto', modificador: 0 },
  { tiempo: 'Diez minutos', modificador: 40 },
  { tiempo: 'Media hora', modificador: 80 },
  { tiempo: 'Una hora', modificador: 120 },
];

/** Recargo por no conocer bien a la entidad a la que se invoca. */
export const PENALIZADOR_SIN_INFORMACION = 50;

export const GRADOS = ['Menor', 'Intermedia', 'Real'] as const;
export type Grado = (typeof GRADOS)[number];

export interface EleccionSincronizacion {
  grado: Grado;
  /** Rasgos marcados, por su texto tal como lo escribe el manual. */
  rasgos: string[];
  tiempo: string;
  sinInformacion?: boolean;
}

export interface Sincronizacion {
  /** Dificultad base del grado de afinidad. */
  base: number;
  /** Suma de los rasgos marcados; puede ser negativa. */
  porRasgos: number;
  porTiempo: number;
  porInformacion: number;
  /** Lo que hay que sacar en el Control de Invocación. */
  dificultad: number;
  zeon: number;
  nivelRequerido: number;
  afinidad: AfinidadEncarnacion | undefined;
}

export function afinidadDe(e: Encarnacion, grado: Grado): AfinidadEncarnacion | undefined {
  return e.afinidades.find((a) => a.grado === grado);
}

/**
 * Un modificador **resta** dificultad cuando el rasgo acerca al invocador a la entidad.
 * El manual lo escribe con el signo ya puesto: «Ser mujer +10», «Ser sincero -50», y esos
 * valores se suman tal cual a la dificultad… con el signo invertido, porque un rasgo
 * favorable (+10) hace la invocación **más fácil**.
 *
 * Esa inversión es la lectura que hace esta aplicación de un punto que el manual no
 * explicita: dice que «cuantos más rasgos tengan en común, más fácil le resultará entrar
 * en sincronización», y los rasgos afines son justamente los que llevan signo positivo.
 */
export function sincronizar(e: Encarnacion, eleccion: EleccionSincronizacion): Sincronizacion {
  const afinidad = afinidadDe(e, eleccion.grado);
  const base = afinidad?.dificultad ?? 0;

  const porRasgos = e.modificadores
    .filter((m) => eleccion.rasgos.includes(m.rasgo))
    .reduce((t, m) => t - m.modificador, 0);

  const porTiempo = TIEMPOS_SINCRONIZACION.find((t) => t.tiempo === eleccion.tiempo)?.modificador ?? 0;
  const porInformacion = eleccion.sinInformacion ? PENALIZADOR_SIN_INFORMACION : 0;

  return {
    base,
    porRasgos,
    porTiempo,
    porInformacion,
    dificultad: base + porRasgos + porTiempo + porInformacion,
    zeon: afinidad?.zeon ?? 0,
    nivelRequerido: afinidad?.nivel ?? 0,
    afinidad,
  };
}

/** Grados que el personaje **puede** intentar por nivel. Los demás se avisan, no se ocultan. */
export function gradosAlcanzables(e: Encarnacion, nivel: number): Grado[] {
  return e.afinidades.filter((a) => a.nivel <= nivel).map((a) => a.grado);
}

/**
 * Las invocaciones con varios poderes se listan como una entrada madre más una entrada por
 * poder. Esto las agrupa para poder pintarlas juntas.
 */
export function agruparPoderes<T extends { invocacion: string; parteDe?: string }>(
  invocaciones: T[],
): { madre: T; poderes: T[] }[] {
  const madres = invocaciones.filter((i) => !i.parteDe);
  return madres.map((madre) => ({
    madre,
    poderes: invocaciones.filter((i) => i.parteDe === madre.invocacion),
  }));
}
