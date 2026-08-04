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
  | 'umbralCritico'
  | 'kiPorCaracteristica'
  | 'kiPorPD'
  | 'acumulacionKi'
  | 'reservaKi'
  | 'conocimientoMarcial'
  | 'cmPorPD'
  | 'limiteCM'
  | 'deteccionKi'
  | 'ocultacionKi';

export interface DefinicionRegla {
  clave: ClaveRegla;
  nombre: string;
  /** Grupo para agrupar en la interfaz. */
  grupo: 'Derivados' | 'Sobrenatural' | 'Combate' | 'Desarrollo' | 'Ki';
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
  // ─────────────────────────── Dominios del Ki ───────────────────────────
  {
    clave: 'kiPorCaracteristica',
    nombre: 'Puntos de Ki por característica',
    grupo: 'Ki',
    formula: 'valor + max(0, valor - 10)',
    variables: { valor: 'Valor total de la característica (FUE, DES, AGI, CON, POD o VOL)' },
    referencia:
      'Core Exxet, cap. 10: cada punto hasta 10 da 1 de Ki y cada punto por encima da 2. ' +
      'Ficha, PDs!W30: =AGI+IF(AGI-10>0,AGI-10,0). Ejemplo Celia: DES 13 → 16.',
    desactivable: false,
  },
  {
    clave: 'kiPorPD',
    nombre: 'Ki adquirido por PD',
    grupo: 'Ki',
    formula: 'truncar(pd / coste)',
    variables: { pd: 'PD invertidos en Ki', coste: 'Coste de Ki de la categoría' },
    referencia: 'Ficha, PDs!V30. Un punto de Ki por cada «coste» PD.',
    desactivable: false,
  },
  {
    clave: 'acumulacionKi',
    nombre: 'Acumulación de Ki',
    grupo: 'Ki',
    formula: 'max(0, acumulacionBase + acumulacionComprada + especial + penalizadorArmadura)',
    variables: {
      acumulacionBase: 'Acumulación de la Tabla 53 según la característica (0 si vale 0)',
      acumulacionComprada: 'Acumulación adquirida con PD',
      especial: 'Bonos especiales (raza, ventajas, personalización)',
      penalizadorArmadura: 'La armadura resta 1 de Acumulación por cada 20 de penalizador',
    },
    referencia:
      'Ficha, PDs!AA36: =MAX(0, base + comprada + especial + IF(Mod_ATA<0, MIN(0, ' +
      'TRUNC(Mod_ATA/20,0)), 0)). Tabla 53: 1-9 → 1, 10-12 → 2, 13-15 → 3, 16+ → 4.',
    desactivable: false,
  },
  {
    clave: 'reservaKi',
    nombre: 'Reserva de Ki',
    grupo: 'Ki',
    formula: 'poderInnato ? kiPOD * 6 + kiComprado : sumaKi',
    variables: {
      sumaKi: 'Suma del Ki de las seis características acumulables',
      kiPOD: 'Ki que aporta el Poder',
      kiComprado: 'Ki adquirido con PD, en todas las características',
      poderInnato: '1 con la ventaja Poder Innato del Dominus Exxet',
    },
    referencia:
      'Core Exxet, cap. 10 (Celia: 5+9+10+5+6+4 = 39). Ficha, Ki!F24, que además ' +
      'implementa Poder Innato: seis veces el Ki de POD. Esa ventaja exige Unificación.',
    desactivable: false,
  },
  {
    clave: 'conocimientoMarcial',
    nombre: 'Conocimiento Marcial',
    grupo: 'Ki',
    formula: 'cmCategoria + cmArtesMarciales + cmVentajas + cmComprado',
    variables: {
      cmCategoria: 'CM que da la categoría, ya multiplicado por sus niveles',
      cmArtesMarciales: 'CM que dan los grados de arte marcial dominados',
      cmVentajas: 'CM de la ventaja Maestro Marcial (40 / 80 / 120)',
      cmComprado: 'CM adquirido con PD',
    },
    referencia:
      'Ficha, PDs!AA42. Verificado: Christopher (Mentalista, nivel 11) 10×11 = 110; ' +
      'Ryo (Tecnicista, nivel 1) 50 + 10 de artes marciales = 60.',
    desactivable: false,
  },
  {
    clave: 'cmPorPD',
    nombre: 'CM adquirido por PD',
    grupo: 'Ki',
    formula: 'truncar(pd / 5) * 5',
    variables: { pd: 'PD invertidos en Conocimiento Marcial' },
    referencia:
      'Dominus Exxet, cap. 2: cada 5 PD dan 5 CM sea cual sea la categoría. ' +
      'Ficha, PDs!V42, que multiplica por 5 el número de compras.',
    desactivable: false,
  },
  {
    clave: 'limiteCM',
    nombre: 'Límite de PD invertibles en CM',
    grupo: 'Ki',
    formula: 'truncar(pdTotales / 10)',
    variables: { pdTotales: 'PD totales del personaje' },
    referencia:
      'Dominus Exxet, cap. 2: no más de una décima parte de los PD totales. ' +
      'Nivel 1 → 60 PD; nivel 5 → 100 PD. Entra además en el límite de combate.',
    desactivable: true,
  },
  {
    clave: 'deteccionKi',
    nombre: 'Detección del Ki',
    grupo: 'Ki',
    formula: 'truncar((cmTotal + advertir) / 2) + especial + bonoPorNivel * nivel',
    variables: {
      cmTotal: 'Conocimiento Marcial total',
      advertir: 'Habilidad de Advertir ya calculada',
      especial: 'Bonos especiales anotados a mano',
      bonoPorNivel: '+10 por nivel con la ventaja Percepción del Ki',
      nivel: 'Nivel del personaje',
    },
    referencia:
      'Core Exxet, cap. 10: media entre el CM total y Advertir. Ejemplo Celia: ' +
      '(120 + 60) / 2 = 90. Ficha, Ki!F35.',
    desactivable: false,
  },
  {
    clave: 'ocultacionKi',
    nombre: 'Ocultación del Ki',
    grupo: 'Ki',
    formula: 'truncar((cmTotal + ocultarse) / 2) + especial + bonoPorNivel * nivel + bonoRaza',
    variables: {
      cmTotal: 'Conocimiento Marcial total',
      ocultarse: 'Habilidad de Ocultarse ya calculada',
      especial: 'Bonos especiales anotados a mano',
      bonoPorNivel: '+10 por nivel con la ventaja Ki Imperceptible',
      nivel: 'Nivel del personaje',
      bonoRaza: '+50 los D’Anjayni, +30 los Nephilim D’Anjayni',
    },
    referencia: 'Core Exxet, cap. 10: media entre el CM total y Ocultarse. Ficha, Ki!F36.',
    desactivable: false,
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

/**
 * Lo que una mesa decide **antes** de que nadie reparta un punto.
 *
 * No son fórmulas, son cifras de partida, y por eso van aparte: el manual las da como
 * números concretos y lo que hace un Director es subirlas o bajarlas, no reescribirlas.
 * Todos los valores por defecto son los del manual básico; si aquí no hay nada, la ficha
 * sale exactamente igual que antes de que esto existiera.
 */
export interface AjustesCreacion {
  /**
   * Nivel con el que empiezan los personajes de la mesa. No cambia ningún cálculo —cada
   * ficha lleva su propio nivel— pero es lo que se rellena al crear una ficha nueva en
   * esta campaña, para no tener que decirlo de viva voz en cada sesión cero.
   */
  nivelInicial?: number;
  /** Puntos de Creación de partida. El básico da 3. */
  puntosCreacion?: number;
  /** Tope de PC que pueden dar las desventajas. El básico lo pone en 3. */
  maximoPorDesventajas?: number;
}

/** Ajustes de una mesa concreta: sólo lo que se desvía de los valores por defecto. */
export interface AjustesMesa {
  /** Fórmulas reescritas, por clave de regla. */
  formulas?: Partial<Record<ClaveRegla, string>>;
  /** Reglas opcionales desactivadas. */
  desactivadas?: ClaveRegla[];
  /** Cifras de partida de la mesa. */
  creacion?: AjustesCreacion;
}

export const AJUSTES_VACIOS: AjustesMesa = {};

/** Lo que dice el manual básico cuando la mesa no ha tocado nada. */
export const CREACION_POR_DEFECTO: Required<AjustesCreacion> = {
  nivelInicial: 1,
  puntosCreacion: 3,
  maximoPorDesventajas: 3,
};

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
   * Las cifras de partida de la mesa, ya rellenadas con las del manual donde no haya nada.
   * Quien las usa no tiene que saber cuáles vienen de la campaña y cuáles del básico.
   */
  creacion(): Required<AjustesCreacion> {
    return { ...CREACION_POR_DEFECTO, ...(this.ajustes.creacion ?? {}) };
  }

  /** true si la mesa se ha apartado de los números del manual. */
  creacionPersonalizada(): boolean {
    const c = this.creacion();
    return (Object.keys(CREACION_POR_DEFECTO) as (keyof AjustesCreacion)[]).some(
      (k) => c[k] !== CREACION_POR_DEFECTO[k],
    );
  }

  /** Devuelve un reglamento nuevo con una cifra de partida cambiada. */
  conCreacion(cambios: AjustesCreacion): Reglamento {
    return new Reglamento({
      ...this.ajustes,
      creacion: { ...(this.ajustes.creacion ?? {}), ...cambios },
    });
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
