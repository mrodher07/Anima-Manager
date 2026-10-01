/**
 * Aviso de que algo se ha escrito en este aparato.
 *
 * Existe para la partida en vivo. Antes, lo que se guardaba aquí esperaba a la
 * sincronización de cada tres minutos para llegar a la nube, y en una mesa eso se nota: el
 * jugador tiraba su iniciativa y el máster no la veía, el máster pasaba el turno y el
 * «es tu turno» llegaba con la ronda ya acabada. Con este aviso, quien tenga la cuenta
 * abierta sube lo que acaba de cambiar en el momento.
 *
 * Es un aviso y nada más: el almacén no sabe que existe la nube —ni debe saberlo, la
 * aplicación funciona sin ella— y quien no escuche no se entera de nada.
 */

import type { Tienda } from './bd';

export type Cambio =
  /** Un registro guardado tal cual: se puede subir él solo. */
  | { tipo: 'guardado'; tienda: Tienda; registro: { id: string; actualizadoEn: string } }
  /** Algo que no es un guardado simple —un borrado, una imagen—: pide sincronizar. */
  | { tipo: 'otro'; tienda: Tienda | 'imagenes' };

type Oyente = (c: Cambio) => void;
const oyentes = new Set<Oyente>();

export function alCambiar(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function avisarCambio(c: Cambio): void {
  for (const o of oyentes) {
    // Que un oyente que falla no impida guardar: el dato ya está en el almacén local, que
    // es lo que importa.
    try { o(c); } catch { /* nada */ }
  }
}
