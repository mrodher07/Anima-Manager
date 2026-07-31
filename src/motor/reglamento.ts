/**
 * El reglamento: catálogo de reglas del sistema, cada una con su fórmula por defecto.
 *
 * Cada mesa puede reescribir cualquier fórmula o desactivar reglas opcionales, y volver
 * en cualquier momento a los valores por defecto (una regla suelta o todas).
 *
 * Las fórmulas se escriben en el lenguaje acotado de `expresiones.ts`.
 */

import { evaluar, validar, type Contexto } from './expresiones';

export type ClaveRegla =
  | 'puntosVida'
  | 'cansancio'
  | 'zeon'
  | 'act'
  | 'nivelMagia'
  | 'presencia'
  | 'resistencia'
  | 'turno'
  | 'habilidadSecundaria'
  | 'danoArma'
  | 'absorcion'
  | 'porcentajeDano'
  | 'limitePrimarias'
  | 'limiteProyeccion'
  | 'zeonPorPD'
  | 'umbralCritico';

export interface DefinicionRegla {
  clave: ClaveRegla;
  nombre: string;
  /** Grupo para agrupar en la interfaz. */
  grupo: 'Derivados' | 'Sobrenatural' | 'Combate' | 'Desarrollo';
  /** Fórmula por defecto, según el Core Exxet. */
  formula: string;
  /** Variables que recibe, con una descripción para la interfaz de edición. */
  variables: Record<string, string>;
  /** Referencia a la regla oficial, para mostrarla junto al editor. */
  referencia: string;
  /** Si es false, la regla es estructural y no puede desactivarse (sólo reescribirse). */
  desactivable: boolean;
}

/**
 * Reglas por defecto. Cada fórmula procede de `docs/FORMULAS-VERIFICADAS.md`, contrastada
 * con el Core Exxet y con la ficha Meirmeister.
 */
export const REGLAS: readonly DefinicionRegla[] = [
  {
    clave: 'puntosVida',
    nombre: 'Puntos de Vida',
    grupo: 'Derivados',
    formula: '20 + CONx10 + bonoCON + pvCategoria * nivelTotal',
    variables: {
      CONx10: 'Constitución total × 10',
      bonoCON: 'Bono de Constitución',
      pvCategoria: 'PV por nivel que dan las categorías',
      nivelTotal: 'Multiplicador de nivel (ya viene incluido en pvCategoria)',
      pvBasePorCON: 'PV base de la Tabla 4, por si prefieres usar la tabla',
      CON: 'Constitución total',
    },
    referencia:
      'Ficha, PDs!U188: 20 + CON×10 + Bono_CON. La Tabla 4 del manual da lo mismo salvo ' +
      'en CON 1, donde la tabla dice 5 y la fórmula 0. Se sigue la ficha.',
    desactivable: false,
  },
  {
    clave: 'cansancio',
    nombre: 'Cansancio',
    grupo: 'Derivados',
    formula: 'CON + cansancioRaza',
    variables: { CON: 'Constitución total', cansancioRaza: 'Modificador racial al cansancio' },
    referencia: 'Ficha Meirmeister, Principal!AS22. Verificado: 9 + 3 (Jayán) = 12.',
    desactivable: false,
  },
  {
    clave: 'presencia',
    nombre: 'Presencia',
    grupo: 'Derivados',
    formula: 'truncar(pdTotales / 20)',
    variables: { pdTotales: 'PD totales acumulados del personaje' },
    referencia: 'Core Exxet, cap. 1. 600 PD en nivel 1 → 30.',
    desactivable: false,
  },
  {
    clave: 'resistencia',
    nombre: 'Resistencias (RF/RE/RV/RM/RP)',
    grupo: 'Derivados',
    formula: 'truncar((presencia + bonoCaracteristica + modRaza + especial) * factor)',
    variables: {
      presencia: 'Presencia del personaje',
      bonoCaracteristica: 'Bono de la característica asociada (CON, POD o VOL)',
      modRaza: 'Modificador racial a esa resistencia',
      especial: 'Bonos especiales (ventajas, Elan, poderes…)',
      factor: '0.5 con la desventaja correspondiente, si no 1',
    },
    referencia: 'Ficha, Principal!J58. Verificado RF: 30 + 10 + 20 = 60.',
    desactivable: false,
  },
  {
    clave: 'turno',
    nombre: 'Turno / Iniciativa',
    grupo: 'Combate',
    formula: 'turnoBase + bonoAGI + bonoDES + turnoCategoria + penalizadorNatural + turnoArma',
    variables: {
      turnoBase: 'Base 20, más ajustes raciales y ventajas como Reflejos rápidos',
      bonoAGI: 'Bono de Agilidad',
      bonoDES: 'Bono de Destreza',
      turnoCategoria: 'Bono de turno de la categoría',
      penalizadorNatural: 'Penalizador de la armadura y del peso',
      turnoArma: 'Modificador del arma empuñada (+20 desarmado)',
    },
    referencia: 'Core Exxet, cap. 1. Ejemplo Celia: 20+10+15+20+10 = 75.',
    desactivable: false,
  },
  {
    clave: 'habilidadSecundaria',
    nombre: 'Habilidad secundaria',
    grupo: 'Desarrollo',
    formula:
      'truncar(pd / coste) + bonoCaracteristica + bonoCategoria + mejoraNatural' +
      ' + (pd == 0 ? penalizadorNoDesarrollada : 0) + penalizadorNatural',
    variables: {
      pd: 'PD invertidos en la habilidad',
      coste: 'Coste de desarrollo según la categoría',
      bonoCaracteristica: 'Bono de la característica asociada',
      bonoCategoria: 'Bono innato de la categoría a esa habilidad',
      mejoraNatural: 'Habilidades Naturales (+10) y Bonificador Natural',
      penalizadorNoDesarrollada: 'Penalizador por no invertir PD (−30 por defecto)',
      penalizadorNatural: 'Penalizador de la armadura, si aplica',
    },
    referencia: 'Core Exxet, cap. 4. Verificado Trepar: 0+15−30−20 = −35.',
    desactivable: false,
  },
  {
    clave: 'zeon',
    nombre: 'Zeón máximo',
    grupo: 'Sobrenatural',
    formula: 'zeonBasePorPOD + zeonComprado + zeonCategoria * nivelTotal',
    variables: {
      zeonBasePorPOD: 'Zeón base de la tabla, según POD',
      zeonComprado: 'Zeón adquirido con PD',
      zeonCategoria: 'Zeón por nivel que da la categoría',
      nivelTotal: 'Nivel + ajuste de nivel racial',
    },
    referencia: 'Ficha, PDs!W93. Verificado: POD 3 → 40.',
    desactivable: false,
  },
  {
    clave: 'zeonPorPD',
    nombre: 'Zeón adquirido por PD',
    grupo: 'Sobrenatural',
    formula: 'truncar(pd / coste) * 5',
    variables: { pd: 'PD invertidos en Zeón', coste: 'Coste de desarrollo del Zeón' },
    referencia:
      'Core Exxet cap. 1 ("grupos de cinco"). OJO: el cap. 11 da un ejemplo que sugiere ×10. ' +
      'La ficha implementa ×5. Si tu mesa sigue el cap. 11, cambia el 5 por un 10.',
    desactivable: false,
  },
  {
    clave: 'act',
    nombre: 'ACT (Acumulación por Turno)',
    grupo: 'Sobrenatural',
    formula: 'actBasePorPOD + truncar(pd / coste) * actBasePorPOD',
    variables: {
      actBasePorPOD: 'ACT base de la tabla, según POD',
      pd: 'PD invertidos en ACT',
      coste: 'Coste de desarrollo del ACT',
    },
    referencia: 'Ficha, PDs!V94 y W94.',
    desactivable: false,
  },
  {
    clave: 'nivelMagia',
    nombre: 'Nivel de Magia',
    grupo: 'Sobrenatural',
    formula: 'truncar(pd / coste) * 5',
    variables: { pd: 'PD invertidos', coste: 'Coste de desarrollo' },
    referencia: 'Ficha, PDs!V97.',
    desactivable: false,
  },
  {
    clave: 'danoArma',
    nombre: 'Daño del arma',
    grupo: 'Combate',
    formula:
      'multiploInferior((danoBase + danoMunicion) * multTamano, 5)' +
      ' + bonoFUE * (aDosManos ? 2 : 1) + 2 * calidad + extras',
    variables: {
      danoBase: 'Daño base del arma',
      danoMunicion: 'Daño de la munición, si la hay',
      multTamano: 'Multiplicador por tamaño del arma (Normal 1, Enorme 1.5, Gigante 2)',
      bonoFUE: 'Bono de Fuerza',
      aDosManos: '1 si se empuña a dos manos',
      calidad: 'Calidad del arma',
      extras: 'Ki, Elan y otros añadidos al daño',
    },
    referencia: 'Ficha, Combate!AW46. Verificado: suelo(100×1.5,5) + 20×2 = 190.',
    desactivable: false,
  },
  {
    clave: 'absorcion',
    nombre: 'Absorción',
    grupo: 'Combate',
    formula: '20 + 10 * TA',
    variables: { TA: 'Tipo de Armadura contra ese tipo de daño' },
    referencia: 'Core Exxet, cap. 9. TA 1 → 30; TA 6 → 80.',
    desactivable: false,
  },
  {
    clave: 'porcentajeDano',
    nombre: 'Porcentaje de daño',
    grupo: 'Combate',
    formula: 'margen < 10 ? 0 : suelo(margen / 10) * 10',
    variables: { margen: 'Resultado del asalto menos la absorción del defensor' },
    referencia: 'Core Exxet, cap. 9. Margen 27 → 20 %; margen 185 → 180 %.',
    desactivable: false,
  },
  {
    clave: 'umbralCritico',
    nombre: 'Umbral de crítico',
    grupo: 'Combate',
    formula: 'pvActuales / 2',
    variables: { pvActuales: 'PV actuales del objetivo', pvMaximos: 'PV máximos del objetivo' },
    referencia:
      'Core Exxet, cap. 9. Un único impacto que quite la mitad de los PV actuales. ' +
      'Algunas mesas lo calculan sobre los PV máximos: cambia pvActuales por pvMaximos.',
    desactivable: true,
  },
  {
    clave: 'limitePrimarias',
    nombre: 'Límite de PD en habilidades primarias',
    grupo: 'Desarrollo',
    formula: 'truncar(pdTotales * limiteCategoria)',
    variables: {
      pdTotales: 'PD totales del personaje',
      limiteCategoria: 'Fracción que permite la categoría (0.5 o 0.6)',
    },
    referencia: 'Core Exxet, cap. 1. 300 o 360 PD en nivel 1.',
    desactivable: true,
  },
  {
    clave: 'limiteProyeccion',
    nombre: 'Límite de PD en Proyección Mágica/Psíquica',
    grupo: 'Desarrollo',
    formula: 'truncar(limitePrimarias / 2)',
    variables: { limitePrimarias: 'Límite del campo primario correspondiente' },
    referencia: 'Core Exxet, cap. 1. Un hechicero: 180 PD en nivel 1.',
    desactivable: true,
  },
] as const;

const POR_CLAVE = new Map(REGLAS.map((r) => [r.clave, r]));

export function definicion(clave: ClaveRegla): DefinicionRegla {
  const d = POR_CLAVE.get(clave);
  if (!d) throw new Error(`Regla desconocida: ${clave}`);
  return d;
}

/** Ajustes de una mesa concreta: sólo lo que se desvía de los valores por defecto. */
export interface AjustesMesa {
  /** Fórmulas reescritas, por clave de regla. */
  formulas?: Partial<Record<ClaveRegla, string>>;
  /** Reglas opcionales desactivadas. */
  desactivadas?: ClaveRegla[];
}

export const AJUSTES_VACIOS: AjustesMesa = {};

export class Reglamento {
  constructor(private ajustes: AjustesMesa = AJUSTES_VACIOS) {}

  /** Fórmula vigente de una regla: la de la mesa si la hay, si no la oficial. */
  formula(clave: ClaveRegla): string {
    return this.ajustes.formulas?.[clave] ?? definicion(clave).formula;
  }

  estaPersonalizada(clave: ClaveRegla): boolean {
    const propia = this.ajustes.formulas?.[clave];
    return propia !== undefined && propia !== definicion(clave).formula;
  }

  estaActiva(clave: ClaveRegla): boolean {
    return !(this.ajustes.desactivadas ?? []).includes(clave);
  }

  /**
   * Aplica una regla. Si está desactivada devuelve `valorSiInactiva` (0 por defecto),
   * lo que permite anular reglas opcionales sin tocar el código que las llama.
   */
  aplicar(clave: ClaveRegla, ctx: Contexto, valorSiInactiva = 0): number {
    if (!this.estaActiva(clave)) return valorSiInactiva;
    return evaluar(this.formula(clave), ctx);
  }

  /** Reescribe una fórmula. Valida antes y devuelve un reglamento nuevo (inmutable). */
  conFormula(clave: ClaveRegla, formula: string): Reglamento {
    const v = validar(formula);
    if (!v.ok) throw new Error(`Fórmula inválida para "${definicion(clave).nombre}": ${v.error}`);
    const desconocidas = v.variables.filter(
      (n) => !(n in definicion(clave).variables) && !(n in FUNCIONES_PERMITIDAS),
    );
    if (desconocidas.length > 0) {
      throw new Error(
        `Variables no disponibles en "${definicion(clave).nombre}": ${desconocidas.join(', ')}. ` +
          `Disponibles: ${Object.keys(definicion(clave).variables).join(', ')}`,
      );
    }
    return new Reglamento({
      ...this.ajustes,
      formulas: { ...this.ajustes.formulas, [clave]: formula },
    });
  }

  /** Devuelve una regla a su fórmula oficial. */
  restablecer(clave: ClaveRegla): Reglamento {
    const formulas = { ...this.ajustes.formulas };
    delete formulas[clave];
    const desactivadas = (this.ajustes.desactivadas ?? []).filter((c) => c !== clave);
    return new Reglamento({ formulas, desactivadas });
  }

  /** Devuelve todo el reglamento a los valores por defecto. */
  restablecerTodo(): Reglamento {
    return new Reglamento(AJUSTES_VACIOS);
  }

  activar(clave: ClaveRegla, activa: boolean): Reglamento {
    const def = definicion(clave);
    if (!activa && !def.desactivable) {
      throw new Error(`La regla "${def.nombre}" es estructural y no puede desactivarse.`);
    }
    const set = new Set(this.ajustes.desactivadas ?? []);
    if (activa) set.delete(clave);
    else set.add(clave);
    return new Reglamento({ ...this.ajustes, desactivadas: [...set] });
  }

  /** Lo que hay que guardar: sólo las desviaciones respecto a las reglas oficiales. */
  serializar(): AjustesMesa {
    return this.ajustes;
  }

  /** Resumen de lo que esta mesa ha cambiado, para mostrarlo en la interfaz. */
  cambios(): { clave: ClaveRegla; nombre: string; motivo: 'reescrita' | 'desactivada' }[] {
    const out: { clave: ClaveRegla; nombre: string; motivo: 'reescrita' | 'desactivada' }[] = [];
    for (const r of REGLAS) {
      if (!this.estaActiva(r.clave)) out.push({ clave: r.clave, nombre: r.nombre, motivo: 'desactivada' });
      else if (this.estaPersonalizada(r.clave))
        out.push({ clave: r.clave, nombre: r.nombre, motivo: 'reescrita' });
    }
    return out;
  }
}

/** Nombres reservados que no son variables sino funciones del lenguaje. */
const FUNCIONES_PERMITIDAS: Record<string, true> = {
  min: true, max: true, abs: true, redondear: true, techo: true,
  suelo: true, truncar: true, multiploInferior: true, signo: true,
};

/** Reglamento oficial, sin modificaciones. */
export const REGLAMENTO_OFICIAL = new Reglamento();
