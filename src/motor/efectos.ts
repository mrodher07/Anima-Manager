/**
 * Efectos mecánicos de ventajas y desventajas.
 *
 * Los valores **no están inventados**: se han extraído de las fórmulas de la ficha
 * Meirmeister, donde cada ventaja aparece como un coeficiente multiplicado por su casilla
 * de «adquirido» (por ejemplo `Principal!D24` contiene `25*Tablas!G315`, es decir
 * Reflejos rápidos (1) = +25 al turno).
 *
 * No todas las 292 ventajas tienen efecto automatizable: muchas cambian la narración o
 * abren opciones que decide la mesa. Esas se marcan con una nota y siguen apareciendo en
 * la ficha, pero no tocan ningún número.
 */

import type { Caracteristica, Resistencia } from './personaje';
import type { TipoDano } from './combate';

export type Efecto =
  | { tipo: 'caracteristica'; car: Caracteristica; valor: number }
  | { tipo: 'resistencia'; res: Resistencia; valor: number }
  /** Multiplica la resistencia. Las desventajas la dejan a la mitad. */
  | { tipo: 'resistenciaFactor'; res: Resistencia; factor: number }
  | { tipo: 'turno'; valor: number }
  | { tipo: 'regeneracion'; valor: number }
  | { tipo: 'cansancio'; valor: number }
  | { tipo: 'movimiento'; valor: number }
  /** Por nivel: se multiplica por el nivel del personaje. */
  | { tipo: 'pvPorNivel'; valor: number }
  | { tipo: 'zeonPorNivel'; valor: number }
  | { tipo: 'llevarArmaduraPorNivel'; valor: number }
  /** Bono de categoría a una primaria de combate, +valor por nivel, tope 50. */
  | { tipo: 'bonoCategoriaPorNivel'; clave: 'HAtaque' | 'HParada' | 'HEsquiva'; valor: number }
  | { tipo: 'conocimientoMarcial'; valor: number }
  /** Ventajas del Dominus Exxet que suman a las dos habilidades derivadas del Ki. */
  | { tipo: 'deteccionKiPorNivel'; valor: number }
  | { tipo: 'ocultacionKiPorNivel'; valor: number }
  | { tipo: 'TA'; dano: TipoDano; valor: number }
  /** Multiplica la mejora natural (Habilidades Naturales y Bonificador Natural). */
  | { tipo: 'factorMejoraNatural'; factor: number }
  /** Efecto real pero no automatizable: se muestra como recordatorio. */
  | { tipo: 'nota'; texto: string };

const CARACTERISTICAS_NOMBRE: Caracteristica[] = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'];

/** `+1 a característica: AGI` y `-2 a característica: AGI` para las ocho. */
function efectosDeCaracteristicas(): Record<string, Efecto[]> {
  const salida: Record<string, Efecto[]> = {};
  for (const car of CARACTERISTICAS_NOMBRE) {
    salida[`+1 a característica: ${car}`] = [{ tipo: 'caracteristica', car, valor: 1 }];
    salida[`-2 a característica: ${car}`] = [{ tipo: 'caracteristica', car, valor: -2 }];
  }
  return salida;
}

export const EFECTOS: Record<string, Efecto[]> = {
  ...efectosDeCaracteristicas(),

  // ── Resistencias ──  Principal!J58-J62
  'Res. física excepcional (1)': [
    { tipo: 'resistencia', res: 'RF', valor: 25 },
    { tipo: 'resistencia', res: 'RE', valor: 25 },
    { tipo: 'resistencia', res: 'RV', valor: 25 },
  ],
  'Res. física excepcional (2)': [
    { tipo: 'resistencia', res: 'RF', valor: 50 },
    { tipo: 'resistencia', res: 'RE', valor: 50 },
    { tipo: 'resistencia', res: 'RV', valor: 50 },
  ],
  'Res. mágica excepcional (1)': [{ tipo: 'resistencia', res: 'RM', valor: 25 }],
  'Res. mágica excepcional (2)': [{ tipo: 'resistencia', res: 'RM', valor: 50 }],
  'Res. psi. excepcional (1)': [{ tipo: 'resistencia', res: 'RP', valor: 25 }],
  'Res. psi. excepcional (2)': [{ tipo: 'resistencia', res: 'RP', valor: 50 }],
  Don: [
    { tipo: 'resistencia', res: 'RM', valor: 10 },
    { tipo: 'nota', texto: 'Da acceso a las habilidades místicas (Zeón, ACT, Nivel de Magia).' },
  ],

  // ── Turno ──  Principal!D24
  'Reflejos rápidos (1)': [{ tipo: 'turno', valor: 25 }],
  'Reflejos rápidos (2)': [{ tipo: 'turno', valor: 45 }],
  'Reflejos rápidos (3)': [{ tipo: 'turno', valor: 60 }],
  'Reacción lenta (1)': [{ tipo: 'turno', valor: -30 }],
  'Reacción lenta (2)': [{ tipo: 'turno', valor: -60 }],

  // ── Regeneración y cansancio ──  Principal!AQ19, AQ22
  'Regeneración (1) básica': [{ tipo: 'regeneracion', valor: 2 }],
  'Regeneración (2) avanzada': [{ tipo: 'regeneracion', valor: 4 }],
  'Regeneración (3) mayor': [{ tipo: 'regeneracion', valor: 6 }],
  'Infatigable (1)': [{ tipo: 'cansancio', valor: 3 }],
  'Infatigable (2)': [{ tipo: 'cansancio', valor: 6 }],
  'Infatigable (3)': [{ tipo: 'cansancio', valor: 9 }],

  // ── Puntos de Vida ──  PDs!V188
  'Difícil de matar (1)': [{ tipo: 'pvPorNivel', valor: 10 }],
  'Difícil de matar (2)': [{ tipo: 'pvPorNivel', valor: 20 }],
  'Difícil de matar (3)': [{ tipo: 'pvPorNivel', valor: 30 }],

  // ── Zeón ──  PDs!W93
  'Naturaleza mágica (1)': [{ tipo: 'zeonPorNivel', valor: 50 }],
  'Naturaleza mágica (2)': [{ tipo: 'zeonPorNivel', valor: 100 }],
  'Naturaleza mágica (3)': [{ tipo: 'zeonPorNivel', valor: 150 }],

  // ── Combate ──  PDs!W28, X25-X27, W42, Combate!AY21
  'Uso de armadura (1)': [{ tipo: 'llevarArmaduraPorNivel', valor: 5 }],
  'Uso de armadura (2)': [{ tipo: 'llevarArmaduraPorNivel', valor: 10 }],
  'Uso de armadura (3)': [{ tipo: 'llevarArmaduraPorNivel', valor: 15 }],
  'Sentido del combate: Ataque': [{ tipo: 'bonoCategoriaPorNivel', clave: 'HAtaque', valor: 5 }],
  'Sentido del combate: Parada': [{ tipo: 'bonoCategoriaPorNivel', clave: 'HParada', valor: 5 }],
  'Sentido del combate: Esquiva': [{ tipo: 'bonoCategoriaPorNivel', clave: 'HEsquiva', valor: 5 }],
  'Maestro marcial (1)': [{ tipo: 'conocimientoMarcial', valor: 40 }],
  'Maestro marcial (2)': [{ tipo: 'conocimientoMarcial', valor: 80 }],
  'Maestro marcial (3)': [{ tipo: 'conocimientoMarcial', valor: 120 }],

  // ── Dominios del Ki ──  Dominus Exxet, cap. 3. Ficha, Ki!F35 y F36.
  'Percepción del Ki': [
    { tipo: 'deteccionKiPorNivel', valor: 10 },
    { tipo: 'nota', texto: 'No sirve de nada si no desarrollas la habilidad Detección del Ki.' },
  ],
  'Ki imperceptible': [
    { tipo: 'ocultacionKiPorNivel', valor: 10 },
    { tipo: 'nota', texto: 'No sirve de nada si no desarrollas la habilidad Ocultación del Ki.' },
  ],
  'Límite dual': [{ tipo: 'nota', texto: 'Puedes escoger dos Límites en lugar de uno.' }],
  'Acumulación plena': [
    {
      tipo: 'nota',
      texto:
        'No reduces tus Acumulaciones por hacer otra cosa durante el asalto: siempre ' +
        'dispones de la Acumulación plena.',
    },
  ],
  'Ac. de Ki incrementada (1)': [
    {
      tipo: 'nota',
      texto:
        '+1 a todas las Acumulaciones el asalto en que no hagas nada más que acumular. ' +
        'No se combina con Acumulación plena.',
    },
  ],
  'Ac. de Ki incrementada (2)': [
    {
      tipo: 'nota',
      texto:
        '+2 a todas las Acumulaciones el asalto en que no hagas nada más que acumular. ' +
        'No se combina con Acumulación plena.',
    },
  ],
  'Técnicas desvinculadas': [
    {
      tipo: 'nota',
      texto: 'Aprendes Técnicas de Dominio sin seguir las reglas de árbol: no necesitas las de nivel inferior.',
    },
  ],
  'Sellos magistrales': [
    {
      tipo: 'nota',
      texto: 'Para el Control de Dificultad de una invocación cuentas como si tuvieras dos niveles más.',
    },
  ],
  'Recuperación de Ki (1)': [
    { tipo: 'nota', texto: 'Recuperas 1 punto de Ki por minuto (veinte asaltos).' },
  ],
  'Recuperación de Ki (2)': [
    { tipo: 'nota', texto: 'Recuperas 1 punto de Ki cada treinta segundos (diez asaltos).' },
  ],
  'Recuperación de Ki (3)': [
    { tipo: 'nota', texto: 'Recuperas 1 punto de Ki cada seis segundos (dos asaltos).' },
  ],
  'Armadura natural': [
    { tipo: 'TA', dano: 'FIL', valor: 2 },
    { tipo: 'TA', dano: 'CON', valor: 2 },
    { tipo: 'TA', dano: 'PEN', valor: 2 },
    { tipo: 'TA', dano: 'CAL', valor: 2 },
  ],
  'Armadura mística': [{ tipo: 'TA', dano: 'ENE', valor: 4 }],
  Ambidestría: [
    { tipo: 'nota', texto: 'Sin penalizador por usar la mano torpe (−40 pasa a −10).' },
  ],

  // ── Movimiento ──  Principal!AQ20
  ' > Desplazamiento rápido': [{ tipo: 'movimiento', valor: 2 }],

  // ── Mejora natural ──  PDs!AA185
  'Bono natural incrementado': [{ tipo: 'factorMejoraNatural', factor: 2 }],
  'Sin bonificador natural': [{ tipo: 'factorMejoraNatural', factor: 0 }],

  // ── Desventajas que reducen resistencias a la mitad ──
  'Debilidad física': [{ tipo: 'resistenciaFactor', res: 'RF', factor: 0.5 }],
  'Salud enfermiza': [{ tipo: 'resistenciaFactor', res: 'RE', factor: 0.5 }],
  'Vulnerable a los venenos': [{ tipo: 'resistenciaFactor', res: 'RV', factor: 0.5 }],
  'Vulnerable a la magia': [{ tipo: 'resistenciaFactor', res: 'RM', factor: 0.5 }],

  // ── Efectos reales que decide la mesa en el momento ──
  Endeble: [{ tipo: 'nota', texto: 'Recibe crítico con sólo un tercio de sus PV, no la mitad.' }],
  'Al límite': [{ tipo: 'nota', texto: 'Recibe crítico con sólo un cuarto de sus PV.' }],
  'Vulnerable al dolor': [{ tipo: 'nota', texto: 'Penalizador por Dolor doblado.' }],
  Exhausto: [
    { tipo: 'cansancio', valor: -1 },
    { tipo: 'nota', texto: 'Penalizador por Cansancio doblado.' },
  ],
  'Inm. al dolor y al cansancio': [
    { tipo: 'nota', texto: 'Ignora los penalizadores por Dolor y Cansancio.' },
  ],
  'Arma exclusiva': [
    { tipo: 'nota', texto: '−30 al Ataque y −30 a la Parada con cualquier arma que no sea la desarrollada.' },
  ],
  Miopía: [{ tipo: 'nota', texto: 'Penalizador al combate a distancia.' }],
  'Lenta recuperación de magia': [{ tipo: 'nota', texto: 'Regenera la mitad de Zeón al día.' }],
  'Magia estanca': [{ tipo: 'nota', texto: 'No regenera Zeón de forma natural.' }],
  'Sin concentración': [{ tipo: 'nota', texto: 'No puede acumular bonos por concentrarse.' }],
  'Concentración extrema': [{ tipo: 'nota', texto: 'Mejora los bonos por concentración psíquica.' }],
  'Inmunidad psíquica': [{ tipo: 'nota', texto: 'Inmune a los poderes psíquicos ajenos.' }],
  Versátil: [{ tipo: 'nota', texto: 'Abarata los cambios de categoría.' }],
  Habilidoso: [{ tipo: 'nota', texto: 'PD adicionales para habilidades secundarias.' }],
  'Sentidos agudos': [{ tipo: 'nota', texto: 'Bono a las habilidades perceptivas.' }],
};

export interface EfectosAplicados {
  caracteristicas: Partial<Record<Caracteristica, number>>;
  resistencias: Partial<Record<Resistencia, number>>;
  factorResistencia: Partial<Record<Resistencia, number>>;
  turno: number;
  regeneracion: number;
  cansancio: number;
  movimiento: number;
  pvPorNivel: number;
  zeonPorNivel: number;
  llevarArmaduraPorNivel: number;
  bonoCategoria: Partial<Record<'HAtaque' | 'HParada' | 'HEsquiva', number>>;
  conocimientoMarcial: number;
  deteccionKiPorNivel: number;
  ocultacionKiPorNivel: number;
  TA: Partial<Record<TipoDano, number>>;
  factorMejoraNatural: number;
  /** Recordatorios de lo que la aplicación no automatiza. */
  notas: { origen: string; texto: string }[];
  /** Ventajas elegidas sin ningún efecto registrado. */
  sinEfecto: string[];
}

/** Suma los efectos de todas las ventajas y desventajas elegidas. */
export function acumularEfectos(nombres: string[]): EfectosAplicados {
  const out: EfectosAplicados = {
    caracteristicas: {},
    resistencias: {},
    factorResistencia: {},
    turno: 0,
    regeneracion: 0,
    cansancio: 0,
    movimiento: 0,
    pvPorNivel: 0,
    zeonPorNivel: 0,
    llevarArmaduraPorNivel: 0,
    bonoCategoria: {},
    conocimientoMarcial: 0,
    deteccionKiPorNivel: 0,
    ocultacionKiPorNivel: 0,
    TA: {},
    factorMejoraNatural: 1,
    notas: [],
    sinEfecto: [],
  };

  for (const nombre of nombres) {
    const efectos = EFECTOS[nombre];
    if (!efectos) {
      out.sinEfecto.push(nombre);
      continue;
    }
    for (const e of efectos) {
      switch (e.tipo) {
        case 'caracteristica':
          out.caracteristicas[e.car] = (out.caracteristicas[e.car] ?? 0) + e.valor;
          break;
        case 'resistencia':
          out.resistencias[e.res] = (out.resistencias[e.res] ?? 0) + e.valor;
          break;
        case 'resistenciaFactor':
          out.factorResistencia[e.res] = (out.factorResistencia[e.res] ?? 1) * e.factor;
          break;
        case 'turno': out.turno += e.valor; break;
        case 'regeneracion': out.regeneracion += e.valor; break;
        case 'cansancio': out.cansancio += e.valor; break;
        case 'movimiento': out.movimiento += e.valor; break;
        case 'pvPorNivel': out.pvPorNivel += e.valor; break;
        case 'zeonPorNivel': out.zeonPorNivel += e.valor; break;
        case 'llevarArmaduraPorNivel': out.llevarArmaduraPorNivel += e.valor; break;
        case 'bonoCategoriaPorNivel':
          out.bonoCategoria[e.clave] = (out.bonoCategoria[e.clave] ?? 0) + e.valor;
          break;
        case 'conocimientoMarcial': out.conocimientoMarcial += e.valor; break;
        case 'deteccionKiPorNivel': out.deteccionKiPorNivel += e.valor; break;
        case 'ocultacionKiPorNivel': out.ocultacionKiPorNivel += e.valor; break;
        case 'TA': out.TA[e.dano] = (out.TA[e.dano] ?? 0) + e.valor; break;
        case 'factorMejoraNatural': out.factorMejoraNatural *= e.factor; break;
        case 'nota': out.notas.push({ origen: nombre, texto: e.texto }); break;
      }
    }
  }

  return out;
}

/** Cuántas ventajas del catálogo tienen efecto automatizado. Para poder informarlo. */
export function cobertura(catalogo: string[]): { conEfecto: number; total: number } {
  return {
    conEfecto: catalogo.filter((n) => EFECTOS[n]).length,
    total: catalogo.length,
  };
}
