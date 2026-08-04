/**
 * Multiclase: un personaje puede repartir sus niveles entre hasta cinco categorías.
 *
 * Reglas extraídas de la ficha (`PDs!Y7` y `PDs!T7`):
 *
 * - **PD disponibles**: `500 + 100 × nivel`. Es decir, 600 al crear el personaje en nivel
 *   1 y **+100 por cada nivel** que suba. No son 600 por nivel.
 * - **Coste de cambiar de categoría**, que se paga en PD:
 *   - **20** si alguna es Novel o comparten arquetipo combinado.
 *   - **40** si comparten uno de sus dos arquetipos (dos «Sin» no cuentan como compartir).
 *   - **60** si no tienen nada en común.
 *   - La ventaja **Versátil** deja el coste a la mitad.
 * - Cada categoría aporta sus bonos **por los niveles que se han hecho en ella**, y los PD
 *   invertidos mientras se está en una categoría usan **los costes de esa categoría**.
 */

import type { Categoria } from '../datos/tipos';

export interface EntradaCategoria {
  categoria: string;
  /** Niveles hechos en esta categoría. */
  nivel: number;
}

export const MAX_CATEGORIAS = 5;

/** PD disponibles según el nivel total. `PDs!T7`. */
export function pdPorNivel(nivelTotal: number): number {
  return nivelTotal > 0 ? 500 + 100 * nivelTotal : 400;
}

function arquetiposDe(c: Categoria | undefined): { a1: string; a2: string; combinado: string } {
  return {
    a1: String(c?.arquetipo1 ?? ''),
    a2: String(c?.arquetipo2 ?? ''),
    combinado: String(c?.arquetipo ?? ''),
  };
}

/**
 * Coste en PD de pasar de una categoría a otra.
 * `mitad` refleja la ventaja Versátil.
 */
export function costeCambio(
  desde: Categoria | undefined,
  hacia: Categoria | undefined,
  mitad = false,
): number {
  if (!desde || !hacia) return 0;
  const a = arquetiposDe(desde);
  const b = arquetiposDe(hacia);

  let coste: number;
  if (desde.categoria === 'Novel' || hacia.categoria === 'Novel' || a.combinado === b.combinado) {
    coste = 20;
  } else {
    const compartenPrimario = a.a1 === b.a1 || a.a1 === b.a2 || a.a2 === b.a1;
    // Dos categorías «Sin» segundo arquetipo no cuentan como que lo comparten.
    const compartenSecundario = a.a2 === 'Sin' && b.a2 === 'Sin' ? false : a.a2 === b.a2;
    coste = compartenPrimario || compartenSecundario ? 40 : 60;
  }
  return mitad ? coste / 2 : coste;
}

export interface ResumenMulticlase {
  nivelTotal: number;
  pdTotales: number;
  /** PD que se van en pagar los cambios de categoría. */
  pdEnCambios: number;
  /** PD que quedan para repartir en habilidades. */
  pdDisponibles: number;
  cambios: { desde: string; hacia: string; coste: number }[];
  /** La categoría en la que está ahora mismo: la última con niveles. */
  categoriaActual: string;
  avisos: string[];
}

/** Calcula niveles, PD y coste de los cambios de categoría. */
export function resumirMulticlase(
  entradas: EntradaCategoria[],
  catalogo: Categoria[],
  versatil = false,
): ResumenMulticlase {
  // El nivel cuenta aunque todavía no se haya elegido categoría: en la ficha
  // `Nivel_Total` es `SUM(S7:S16)`, la suma de los niveles, sin mirar la categoría.
  const nivelTotal = entradas.reduce((t, e) => t + (e.nivel > 0 ? e.nivel : 0), 0);
  // Para los cambios de categoría sí hacen falta las dos categorías puestas.
  const activas = entradas.filter((e) => e.categoria && e.nivel > 0);
  const pdTotales = pdPorNivel(nivelTotal);
  const buscar = (nombre: string) => catalogo.find((c) => c.categoria === nombre);

  const cambios: { desde: string; hacia: string; coste: number }[] = [];
  for (let i = 1; i < activas.length; i++) {
    const desde = activas[i - 1];
    const hacia = activas[i];
    cambios.push({
      desde: desde.categoria,
      hacia: hacia.categoria,
      coste: costeCambio(buscar(desde.categoria), buscar(hacia.categoria), versatil),
    });
  }

  const pdEnCambios = cambios.reduce((t, c) => t + c.coste, 0);
  const avisos: string[] = [];

  if (entradas.length > MAX_CATEGORIAS) {
    avisos.push(`Un personaje no puede tener más de ${MAX_CATEGORIAS} categorías.`);
  }
  // `PDs!AI13`: hay que hacer al menos dos niveles antes de volver a cambiar.
  for (let i = 1; i < activas.length; i++) {
    if (activas[i].nivel === 1 && i < activas.length - 1) {
      avisos.push(
        `Sólo tienes 1 nivel en ${activas[i].categoria}: hacen falta al menos 2 antes de volver a cambiar.`,
      );
    }
  }
  const repetidas = activas.map((e) => e.categoria).filter((c, i, a) => a.indexOf(c) !== i);
  for (const r of new Set(repetidas)) {
    avisos.push(`${r} aparece más de una vez; junta sus niveles en una sola entrada.`);
  }

  return {
    nivelTotal,
    pdTotales,
    pdEnCambios,
    pdDisponibles: pdTotales - pdEnCambios,
    cambios,
    categoriaActual: activas[activas.length - 1]?.categoria ?? '',
    avisos,
  };
}

/**
 * Media ponderada de un campo numérico de categoría, según los niveles hechos en cada una.
 * Se usa para los bonos por nivel: cada categoría aporta lo suyo por sus propios niveles.
 */
export function acumularPorNivel(
  entradas: EntradaCategoria[],
  catalogo: Categoria[],
  campo: string,
): number {
  let total = 0;
  for (const e of entradas) {
    if (!e.categoria || e.nivel <= 0) continue;
    const cat = catalogo.find((c) => c.categoria === e.categoria);
    total += Number(cat?.[campo] ?? 0) * e.nivel;
  }
  return total;
}
