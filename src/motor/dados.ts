/**
 * Tiradas de Anima: d100 con tiradas abiertas y pifias.
 *
 * - **Tirada abierta**: a partir de 90 (según habilidad) se repite y se suma.
 * - **Pifia**: con 1-3 se tira de nuevo para ver su gravedad, y el resultado resta.
 */

export type Aleatorio = () => number;

/** Generador por defecto. Se puede sustituir en pruebas para obtener tiradas fijas. */
export const azarReal: Aleatorio = Math.random;

export function d(caras: number, azar: Aleatorio = azarReal): number {
  return Math.floor(azar() * caras) + 1;
}

/**
 * Umbral a partir del cual una tirada se abre, según la habilidad empleada.
 * Core Exxet, cap. 0: 90 de base, y baja conforme sube la habilidad.
 */
export function umbralApertura(habilidad: number): number {
  if (habilidad >= 300) return 60;
  if (habilidad >= 200) return 70;
  if (habilidad >= 100) return 80;
  return 90;
}

export interface Tirada {
  /** Suma final de los dados, ya con aperturas y pifia aplicadas. */
  total: number;
  /** Cada dado lanzado, en orden. */
  dados: number[];
  abierta: boolean;
  pifia: boolean;
  /** Cuánto ha restado la pifia, si la hubo. */
  nivelPifia: number;
}

/**
 * Tira un d100 con las reglas de Anima.
 *
 * `habilidad` sólo se usa para saber a partir de qué número se abre la tirada;
 * no se suma al total (eso lo hace quien llama, que conoce sus propios modificadores).
 */
export function tirarD100(habilidad = 0, azar: Aleatorio = azarReal): Tirada {
  const dados: number[] = [];
  const umbral = umbralApertura(habilidad);

  let primero = d(100, azar);
  dados.push(primero);

  // Pifia: con 1-3 se comprueba su gravedad con una segunda tirada.
  if (primero <= 3) {
    const control = d(100, azar);
    dados.push(control);
    // Cuanto más bajo el control, peor la pifia. Por encima de 50 no hay pifia real.
    const nivelPifia = control > 50 ? 0 : Math.ceil((51 - control) / 5) * 5;
    return { total: primero - nivelPifia, dados, abierta: false, pifia: nivelPifia > 0, nivelPifia };
  }

  let total = primero;
  let abierta = false;
  // Las tiradas abiertas encadenan, pero cada repetición exige superar el umbral otra vez.
  let vueltas = 0;
  while (primero >= umbral && vueltas < 10) {
    abierta = true;
    const siguiente = d(100, azar);
    dados.push(siguiente);
    total += siguiente;
    primero = siguiente;
    vueltas++;
  }

  return { total, dados, abierta, pifia: false, nivelPifia: 0 };
}
