/**
 * Traducción de una ficha de criatura de manual a la ficha reducida del bestiario.
 *
 * El manual describe a las criaturas con mucho más detalle del que hace falta para
 * resolver un asalto: poderes, disciplinas, habilidades esenciales… Aquí se saca lo que la
 * mesa necesita —PV, turno, ataque, defensa, daño y TA— y **todo lo demás se conserva en
 * las notas**, sin resumir, para que el Director lo tenga delante.
 *
 * Los campos del manual son texto libre («175 Tentáculos (Especial), 200 Vaciar mente»),
 * así que aquí se toma **el primer número** de cada uno y se deja constancia del resto.
 */

import type { TipoDano } from './combate';
import type { CriaturaManual } from '../datos/tipos';

/** Primer número de un campo, que es el valor principal. «3.000 (Especial)» → 3000. */
export function primerNumero(texto: string | undefined): number {
  if (!texto) return 0;
  const m = /-?\d[\d.]*/.exec(texto.replace(/\s/g, ''));
  if (!m) return 0;
  // El manual escribe los miles con punto: «3.000».
  return Math.trunc(Number(m[0].replace(/\./g, ''))) || 0;
}

const TIPOS: TipoDano[] = ['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'];

/**
 * Crítico del ataque. El manual lo pone entre paréntesis tras el daño:
 * «130 Tentáculos (Con)». Si no se reconoce, se deja en CON, que es el genérico.
 */
export function criticoDe(dano: string | undefined): TipoDano {
  const texto = (dano ?? '').toUpperCase();
  return TIPOS.find((t) => new RegExp(`\\(${t}|\\b${t}\\b`).test(texto)) ?? 'CON';
}

/**
 * Armadura. «Natural 6» significa el mismo TA contra todo, incluida Energía; si no, se
 * intenta leer valor por valor y lo que falte queda a 0.
 */
export function armaduraDe(ta: string | undefined): Record<TipoDano, number> {
  const vacia = Object.fromEntries(TIPOS.map((t) => [t, 0])) as Record<TipoDano, number>;
  if (!ta) return vacia;
  const natural = /Natural\s*(\d+)/i.exec(ta);
  if (natural) {
    const v = Number(natural[1]);
    return Object.fromEntries(TIPOS.map((t) => [t, v])) as Record<TipoDano, number>;
  }
  for (const t of TIPOS) {
    const m = new RegExp(`${t}\\s*(\\d+)`, 'i').exec(ta);
    if (m) vacia[t] = Number(m[1]);
  }
  return vacia;
}

/** Se defiende acumulando daño en vez de parar o esquivar. */
export function acumulaDano(defensa: string | undefined): boolean {
  return /acumulaci/i.test(defensa ?? '');
}

/**
 * El manual escribe cómo se defiende cada criatura junto al número: «115 Esquiva»,
 * «180 Parada». Cuando no lo dice —porque la defensa es un poder con nombre propio, como
 * «Defensa Fantasmal»— se deja Parada, que es lo que la ficha trae por defecto.
 */
export function tipoDefensaDe(defensa: string | undefined): 'Parada' | 'Esquiva' {
  return /esquiva/i.test(defensa ?? '') ? 'Esquiva' : 'Parada';
}

/** Los campos que no caben en la ficha reducida, tal como los escribe el manual. */
const EXTRAS: { clave: keyof CriaturaManual; etiqueta: string }[] = [
  { clave: 'clase', etiqueta: 'Clase' },
  { clave: 'categoria', etiqueta: 'Categoría' },
  { clave: 'tamano', etiqueta: 'Tamaño' },
  { clave: 'movimiento', etiqueta: 'Movimiento' },
  { clave: 'regeneracion', etiqueta: 'Regeneración' },
  { clave: 'cansancio', etiqueta: 'Cansancio' },
  { clave: 'ACT', etiqueta: 'ACT' },
  { clave: 'zeon', etiqueta: 'Zeón' },
  { clave: 'proyeccionMagica', etiqueta: 'Proyección Mágica' },
  { clave: 'nivelMagia', etiqueta: 'Nivel de Magia' },
  { clave: 'potencialPsiquico', etiqueta: 'Potencial Psíquico' },
  { clave: 'cvLibres', etiqueta: 'CV libres' },
  { clave: 'disciplinas', etiqueta: 'Disciplinas' },
  { clave: 'innatos', etiqueta: 'Innatos' },
  { clave: 'proyeccionPsiquica', etiqueta: 'Proyección Psíquica' },
  { clave: 'ki', etiqueta: 'Ki' },
  { clave: 'acumulacionKi', etiqueta: 'Acumulaciones de Ki' },
  { clave: 'habilidadesKi', etiqueta: 'Habilidades del Ki' },
  { clave: 'tecnicas', etiqueta: 'Técnicas' },
  { clave: 'habilidadesNaturales', etiqueta: 'Habilidades naturales' },
  { clave: 'habilidadesEsenciales', etiqueta: 'Habilidades esenciales' },
  { clave: 'poderes', etiqueta: 'Poderes' },
  { clave: 'secundarias', etiqueta: 'Habilidades secundarias' },
];

/** Todo lo que no cabe en la ficha reducida, en un texto para las notas del Director. */
export function notasDe(c: CriaturaManual): string {
  const lineas: string[] = [];
  if (c.caracteristicas) {
    lineas.push(
      Object.entries(c.caracteristicas)
        .map(([k, v]) => `${k} ${v}`)
        .join('  '),
    );
  }
  if (c.resistencias) {
    lineas.push(
      Object.entries(c.resistencias)
        .map(([k, v]) => `${k} ${v}`)
        .join('  '),
    );
  }
  // El ataque y el daño completos, que en la ficha reducida se quedan en un solo número.
  if (c.ataque) lineas.push(`Ataque: ${c.ataque}`);
  if (c.defensa) lineas.push(`Defensa: ${c.defensa}`);
  if (c.dano) lineas.push(`Daño: ${c.dano}`);
  if (c.TA) lineas.push(`TA: ${c.TA}`);
  for (const { clave, etiqueta } of EXTRAS) {
    const v = c[clave];
    if (v) lineas.push(`${etiqueta}: ${v}`);
  }
  return lineas.join('\n');
}

export interface EnemigoDesdeManual {
  nombre: string;
  tipo: string;
  puntosVida: number;
  turno: number;
  ataque: number;
  defensa: number;
  tipoDefensa: 'Parada' | 'Esquiva';
  dano: number;
  tipoDano: TipoDano;
  TA: Record<TipoDano, number>;
  notas: string;
}

/** Convierte una criatura del manual en la ficha reducida que usa la mesa. */
export function desdeManual(c: CriaturaManual): EnemigoDesdeManual {
  const acumula = acumulaDano(c.defensa);
  return {
    nombre: c.criatura,
    tipo: `Nivel ${c.nivel}${c.clase ? ` · ${c.clase}` : ''}`,
    puntosVida: primerNumero(c.puntosVida),
    turno: primerNumero(c.turno),
    ataque: primerNumero(c.ataque),
    // Quien acumula daño no tiene defensa que tirar; se deja a 0 y se avisa en las notas.
    defensa: acumula ? 0 : primerNumero(c.defensa),
    tipoDefensa: tipoDefensaDe(c.defensa),
    dano: primerNumero(c.dano),
    tipoDano: criticoDe(c.dano),
    TA: armaduraDe(c.TA),
    notas: notasDe(c),
  };
}
