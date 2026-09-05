/**
 * El orden de un combate: quién entra, qué saca de iniciativa y a quién le toca.
 *
 * Anima resuelve la iniciativa una vez y el orden se mantiene durante todo el combate,
 * así que lo que hace falta guardar no es una tirada suelta sino **la mesa entera**: los
 * que participan, lo que sacó cada uno y por dónde va el asalto.
 *
 * Aquí no se decide nada de lo que pasa en el combate. Quién ataca a quién, si alguien
 * retrasa su turno o si una criatura entra a mitad de asalto lo lleva la mesa; esto sólo
 * sostiene el orden para que nadie tenga que apuntarlo en un papel.
 */

/** De dónde sale un participante: de una ficha de jugador o del bestiario. */
export type TipoParticipante = 'personaje' | 'enemigo';

export interface Participante {
  /** Único dentro del combate. Un enemigo repetido entra tres veces con tres ids. */
  id: string;
  tipo: TipoParticipante;
  /** Id de la ficha o del enemigo del que salió. */
  refId: string;
  nombre: string;
  /** Turno de partida, antes de tirar. */
  turnoBase: number;
  /** Lo que salió en el d100. Sin valor mientras no haya tirado. */
  tirada?: number;
  /** Turno base + tirada. Se puede escribir a mano: la mesa manda sobre el dado. */
  iniciativa?: number;
  /**
   * Fuera del combate sin salir de la lista: alguien que cae, que huye o que todavía no
   * ha llegado. Se conserva porque el registro de lo que pasó importa más que la lista
   * de quien queda en pie.
   */
  activo: boolean;
}

export type EstadoCombate = 'preparando' | 'enCurso' | 'terminado';

export interface Combate {
  id: string;
  campanaId: string | null;
  actualizadoEn: string;
  nombre: string;
  estado: EstadoCombate;
  /** Asalto en el que va. Empieza en 1 cuando arranca. */
  asalto: number;
  /**
   * A quién le toca, por su id.
   *
   * Guardaba la **posición** dentro del orden, y eso se rompe en cuanto alguien cae: si el
   * que cae iba antes del que está actuando, la lista se acorta por delante, la posición
   * pasa a señalar al siguiente y a alguien le roban su turno en mitad de la pelea. Con el
   * id no hay ambigüedad, que es la información que de verdad se quiere guardar.
   */
  turnoDe: string | null;
  participantes: Participante[];
  empezadoEn?: string;
  terminadoEn?: string;
}

/**
 * Adapta un combate guardado con el modelo viejo, que apuntaba la **posición** de quien
 * actuaba en vez de su id. Se traduce una vez al leerlo y no se pierde el combate.
 */
export function migrarCombate(c: Combate & { turno?: number }): Combate {
  if (c.turnoDe !== undefined) return c;
  const { turno, ...resto } = c;
  const lista = orden(resto.participantes ?? []).filter((p) => p.activo);
  return { ...resto, turnoDe: lista[turno ?? 0]?.id ?? null };
}

export function combateVacio(id: string, campanaId: string | null, nombre = 'Combate'): Combate {
  return {
    id,
    campanaId,
    actualizadoEn: new Date().toISOString(),
    nombre,
    estado: 'preparando',
    asalto: 0,
    turnoDe: null,
    participantes: [],
  };
}

/**
 * El orden de actuación: de más iniciativa a menos.
 *
 * Los empates se rompen por el turno de partida, que es lo que dice el manual —quien tiene
 * mejores reflejos actúa antes—, y si también empatan, por nombre, para que el orden sea
 * el mismo cada vez que se pinta la lista en vez de bailar entre repintados.
 *
 * Quien no ha tirado todavía va al final: no es que tenga cero, es que no tiene número.
 */
export function orden(participantes: Participante[]): Participante[] {
  return [...participantes].sort((a, b) => {
    const ia = a.iniciativa;
    const ib = b.iniciativa;
    if (ia === undefined && ib === undefined) return a.nombre.localeCompare(b.nombre);
    if (ia === undefined) return 1;
    if (ib === undefined) return -1;
    if (ib !== ia) return ib - ia;
    if (b.turnoBase !== a.turnoBase) return b.turnoBase - a.turnoBase;
    return a.nombre.localeCompare(b.nombre);
  });
}

/** Los que siguen en pie, en orden. Es sobre esta lista sobre la que avanza el turno. */
export function enJuego(combate: Combate): Participante[] {
  return orden(combate.participantes).filter((p) => p.activo);
}

/**
 * A quién le toca ahora mismo, o `undefined` si no hay combate en curso.
 *
 * Si a quien le tocaba ha caído —pasa: alguien muere en su propio turno— le toca al
 * siguiente que siga en pie, no a nadie.
 */
export function actuando(combate: Combate): Participante | undefined {
  if (combate.estado !== 'enCurso') return undefined;
  const lista = enJuego(combate);
  if (lista.length === 0) return undefined;
  return lista.find((p) => p.id === combate.turnoDe) ?? lista[0];
}

/**
 * Arranca el combate: asalto 1 y el turno al primero del orden.
 *
 * No se comprueba que todo el mundo haya tirado. Es normal empezar con una criatura cuya
 * iniciativa lleva escrita el máster y que aparecerá dentro de dos asaltos, y negarse a
 * empezar por eso sería la aplicación decidiendo por la mesa.
 */
export function empezar(combate: Combate): Combate {
  const enCurso: Combate = { ...combate, estado: 'enCurso' };
  return {
    ...enCurso,
    asalto: 1,
    turnoDe: enJuego(enCurso)[0]?.id ?? null,
    empezadoEn: combate.empezadoEn ?? new Date().toISOString(),
  };
}

/**
 * Pasa al siguiente. Cuando se acaba la vuelta empieza el asalto siguiente.
 *
 * La iniciativa **no se vuelve a tirar** entre asaltos: en Anima se tira una vez y el
 * orden se mantiene. Si en la mesa decidís volver a tirarla, para eso está el botón de
 * tirar por todos.
 */
export function siguiente(combate: Combate): Combate {
  if (combate.estado !== 'enCurso') return combate;
  const lista = enJuego(combate);
  if (lista.length === 0) return combate;
  // Quién va después **del que actúa de verdad**, que no siempre es `turnoDe`: si a quien
  // le tocaba ha caído en su propio turno, `actuando` ya señala al siguiente en pie.
  // Partir de `turnoDe` a pelo dejaba el botón sin hacer nada en ese caso.
  const actual = actuando(combate);
  const donde = actual ? lista.findIndex((p) => p.id === actual.id) : -1;
  const siguienteIndice = donde + 1;
  // Al pasar del último se cierra la vuelta: turno al primero y un asalto más.
  const daLaVuelta = siguienteIndice >= lista.length;
  return {
    ...combate,
    turnoDe: (daLaVuelta ? lista[0] : lista[siguienteIndice]).id,
    asalto: combate.asalto + (daLaVuelta ? 1 : 0),
    actualizadoEn: new Date().toISOString(),
  };
}

export function terminar(combate: Combate): Combate {
  return {
    ...combate,
    estado: 'terminado',
    terminadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };
}

/** Cambia un participante sin tocar los demás. */
export function conParticipante(
  combate: Combate,
  id: string,
  cambios: Partial<Participante>,
): Combate {
  return {
    ...combate,
    participantes: combate.participantes.map((p) => (p.id === id ? { ...p, ...cambios } : p)),
    actualizadoEn: new Date().toISOString(),
  };
}

/** Apunta lo que ha salido en el dado: la iniciativa es el turno base más la tirada. */
export function conTirada(combate: Combate, id: string, tirada: number): Combate {
  const p = combate.participantes.find((x) => x.id === id);
  if (!p) return combate;
  return conParticipante(combate, id, { tirada, iniciativa: p.turnoBase + tirada });
}
