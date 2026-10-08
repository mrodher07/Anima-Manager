/**
 * Efectos mecánicos de ventajas y desventajas.
 *
 * Los valores **no están inventados**: se han extraído de las fórmulas de la ficha
 * Meirmeister, donde cada ventaja aparece como un coeficiente multiplicado por su casilla
 * de «adquirido» (por ejemplo `Principal!D24` contiene `25*Tablas!G315`, es decir
 * Reflejos rápidos (1) = +25 al turno).
 *
 * No todas las 284 ventajas tienen efecto automatizable: muchas cambian la narración o
 * abren opciones que decide la mesa. Esas se marcan con una nota y siguen apareciendo en
 * la ficha, pero no tocan ningún número.
 */

import type { Caracteristica, GrupoSecundarias, Resistencia } from './personaje';
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
  /**
   * Multiplica **cuántos** Bonificadores Naturales se pueden repartir, no lo que suman.
   * Ficha, `PDs!AA185`: `Nivel_Total*IF(Bono natural incrementado,2,1)*IF(Sin bonificador,0,1)`.
   */
  | { tipo: 'factorBonosNaturales'; factor: number }
  /**
   * Conocimiento de todas las materias: +10 a todas las secundarias, dentro del tope de 100
   * del bono, y ninguna cuenta como no desarrollada. Ficha, `PDs!U129` y `PDs!AA129`.
   */
  | { tipo: 'conocimientoTotal' }
  /** Abarata todo un campo de secundarias. `PDs!J129`: `coste - Apto en campo`. */
  | { tipo: 'costeCampo'; grupo: GrupoSecundarias; valor: number }
  /** Bono por nivel a todo un campo. `Tablas!X281`: `5*Apr. innato (2) + 10*Apr. innato (3)`. */
  | { tipo: 'aprendizajeCampo'; grupo: GrupoSecundarias; valor: number }
  /**
   * Lo mismo, pero sólo para las habilidades que el jugador elija: en la hoja se eligen en la
   * pestaña Personalización, tres casillas por ventaja. `PDs!J129` y `Tablas!X281`.
   */
  | { tipo: 'costeElegida'; valor: number }
  | { tipo: 'aprendizajeElegida'; valor: number }
  /** Bono fijo a una secundaria. `PDs!AD` de cada fila. */
  | { tipo: 'bonoSecundaria'; habilidad: string; valor: number }
  /**
   * Tamaño no natural. `Tablas!K319`: el mayor de los positivos más el menor de los
   * negativos, y `Principal!AQ21` lo deja entre −5 y +5.
   */
  | { tipo: 'tamano'; valor: number }
  /** Nivel de Magia por nivel. `PDs!X97`: `IF(Aprendizaje mágico gradual, 5*Nivel_Total)`. */
  | { tipo: 'nivelMagiaPorNivel'; valor: number }
  /**
   * Regeneración zeónica. `Místicos!I12`: el múltiplo se suma una vez más por cada grado de
   * Recuperación superior de magia, y el total se multiplica por ½ (Lenta recuperación) o
   * por 0 (Magia estanca).
   */
  | { tipo: 'regeneracionZeonGrados'; valor: number }
  | { tipo: 'regeneracionZeonFactor'; factor: number }
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

const CAMPOS: GrupoSecundarias[] = [
  'Atléticas', 'Sociales', 'Perceptivas', 'Intelectuales', 'Vigor', 'Subterfugio', 'Creativas',
];

/** `Apto en campo: X` (−1 al coste) y `Apr. innato (2)/(3): X` (+5/+10 por nivel). */
function efectosDeCampos(): Record<string, Efecto[]> {
  const salida: Record<string, Efecto[]> = {};
  for (const grupo of CAMPOS) {
    salida[`Apto en campo: ${grupo}`] = [{ tipo: 'costeCampo', grupo, valor: -1 }];
    salida[`Apr. innato (2): ${grupo}`] = [{ tipo: 'aprendizajeCampo', grupo, valor: 5 }];
    salida[`Apr. innato (3): ${grupo}`] = [{ tipo: 'aprendizajeCampo', grupo, valor: 10 }];
  }
  return salida;
}

/** `Tamaño no natural +1` … `+5` y `-1` … `-5`. */
function efectosDeTamano(): Record<string, Efecto[]> {
  const salida: Record<string, Efecto[]> = {};
  for (let n = 1; n <= 5; n++) {
    salida[`Tamaño no natural +${n}`] = [{ tipo: 'tamano', valor: n }];
    salida[`Tamaño no natural -${n}`] = [{ tipo: 'tamano', valor: -n }];
  }
  return salida;
}

const DISCIPLINAS_PSIQUICAS = [
  'Piroquinesis', 'Crioquinesis', 'Telequinesis', 'Telepatía', 'Energía', 'Inc. Físico', 'Sentiente',
  'Telemetría', 'Causalidad', 'Teletransporte', 'Luz',
];

/** `Des. psíquico: X` sólo lo rotula la hoja: «+1 grado: Des. Psíquico» (Psíquicos!J12). */
function notasDeDisciplinas(): Record<string, Efecto[]> {
  const salida: Record<string, Efecto[]> = {};
  const nota = (d: string): Efecto[] => [
    { tipo: 'nota', texto: `+1 grado a los poderes de ${d} (Psíquicos!J12).` },
  ];
  for (const d of DISCIPLINAS_PSIQUICAS) salida[`Des. psíquico: ${d}`] = nota(d);
  salida['Des. psí: Electromagnetismo'] = nota('Electromagnetismo');
  salida['Des. psí: Hipersensibilidad'] = nota('Hipersensibilidad');
  return salida;
}

/** Conocimiento natural de una Vía (+40 a su nivel) y Desequilibrio elemental (+20 al ACT). */
function notasDeVias(): Record<string, Efecto[]> {
  const salida: Record<string, Efecto[]> = {};
  for (const v of ['Luz', 'Osc.', 'Fuego', 'Agua', 'Aire', 'Tierra', 'Creación', 'Destruc.', 'Esencia', 'Ilusión', 'Nigro.']) {
    salida[`Con. natural de Vía: ${v}`] = [
      { tipo: 'nota', texto: `+40 al nivel de la Vía de ${v} (Tablas!I1089).` },
    ];
  }
  for (const v of ['Luz', 'Oscuridad', 'Fuego', 'Agua', 'Aire', 'Tierra', 'Creación', 'Destrucción', 'Esencia', 'Ilusión', 'Nigromancia']) {
    salida[`Des. elemental: ${v}`] = [
      { tipo: 'nota', texto: `+20 al ACT con la Vía de ${v}; +20 a la RM contra lo afín y −20 contra lo opuesto (Místicos!J15).` },
    ];
  }
  return salida;
}

/** Las ventajas que se aplican a una habilidad que elige el jugador. */
export const VENTAJAS_CON_HABILIDAD = [
  'Apto en una materia (1)', 'Apto en una materia (2)',
  'Aprendizaje innato (1)', 'Aprendizaje innato (2)', 'Aprendizaje innato (3)',
] as const;

/** Cuántas veces se puede tomar cada una: la pestaña Personalización tiene tres casillas. */
export const MAXIMO_HABILIDADES_POR_VENTAJA = 3;

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
  // Combate!AY21:BD21 = 2*Tablas!G329: todo menos Energía. Es una capa más de armadura
  // «Natural», así que no se suma sin más: entra en la regla de capas (`combinarArmadura`).
  'Armadura natural': [
    { tipo: 'TA', dano: 'FIL', valor: 2 },
    { tipo: 'TA', dano: 'CON', valor: 2 },
    { tipo: 'TA', dano: 'PEN', valor: 2 },
    { tipo: 'TA', dano: 'CAL', valor: 2 },
    { tipo: 'TA', dano: 'ELE', valor: 2 },
    { tipo: 'TA', dano: 'FRI', valor: 2 },
  ],
  'Armadura mística': [{ tipo: 'TA', dano: 'ENE', valor: 4 }],
  Ambidestría: [
    { tipo: 'nota', texto: 'Sin penalizador por usar la mano torpe (−40 pasa a −10).' },
  ],

  // ── Movimiento ──  Principal!AQ20
  ' > Desplazamiento rápido': [{ tipo: 'movimiento', valor: 2 }],

  // ── Bonificadores Naturales ──  PDs!AA185: cambian cuántos hay, no lo que valen.
  'Bono natural incrementado': [{ tipo: 'factorBonosNaturales', factor: 2 }],
  'Sin bonificador natural': [{ tipo: 'factorBonosNaturales', factor: 0 }],

  // ── Secundarias ──  PDs!J129:AA179, Tablas!X281:X336
  'Con. de todas las materias': [{ tipo: 'conocimientoTotal' }],
  ...efectosDeCampos(),
  'Apto en una materia (1)': [{ tipo: 'costeElegida', valor: -1 }],
  'Apto en una materia (2)': [{ tipo: 'costeElegida', valor: -2 }],
  'Aprendizaje innato (1)': [{ tipo: 'aprendizajeElegida', valor: 10 }],
  'Aprendizaje innato (2)': [{ tipo: 'aprendizajeElegida', valor: 20 }],
  'Aprendizaje innato (3)': [{ tipo: 'aprendizajeElegida', valor: 30 }],
  // PDs!AD143 y AD144: 50, u 80 si es Tuan Dalyr (eso lo pone el cálculo, que sabe la raza).
  'Sentidos agudos': [
    { tipo: 'bonoSecundaria', habilidad: 'Advertir', valor: 50 },
    { tipo: 'bonoSecundaria', habilidad: 'Buscar', valor: 50 },
  ],
  // PDs!AD175 y AD158.
  Habilidoso: [{ tipo: 'bonoSecundaria', habilidad: 'Trucos de Manos', valor: 30 }],
  'Inmunidad psíquica': [
    { tipo: 'bonoSecundaria', habilidad: 'Frialdad', valor: 60 },
    { tipo: 'nota', texto: 'Inmune a los poderes psíquicos ajenos.' },
  ],
  // Tablas!U1983: el +60 es a la especialidad «Seducción» de Persuasión, no a la habilidad.
  Seductor: [{ tipo: 'nota', texto: '+60 a Persuasión cuando se trata de seducir (especialidad Seducción).' }],

  // ── Tamaño ──  Tablas!K319, Principal!AQ21
  ...efectosDeTamano(),

  // ── Magia ──  PDs!X97
  'Aprendizaje mágico gradual': [{ tipo: 'nivelMagiaPorNivel', valor: 5 }],

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
  Miopía: [{ tipo: 'nota', texto: '−50 a la puntería con proyectiles (Combate!K52).' }],
  // Místicos!I12.
  'Rec. superior de magia (1)': [{ tipo: 'regeneracionZeonGrados', valor: 1 }],
  'Rec. superior de magia (2)': [{ tipo: 'regeneracionZeonGrados', valor: 2 }],
  'Rec. superior de magia (3)': [{ tipo: 'regeneracionZeonGrados', valor: 3 }],
  'Lenta recuperación de magia': [{ tipo: 'regeneracionZeonFactor', factor: 0.5 }],
  'Magia estanca': [{ tipo: 'regeneracionZeonFactor', factor: 0 }],
  // ── Lo que la hoja sólo enseña como rótulo: se deja como recordatorio, con su casilla ──
  'Sin concentración': [{ tipo: 'nota', texto: 'Concentrarse no da bono a los poderes psíquicos: +0 (Psíquicos!Q17).' }],
  'Concentración extrema': [
    { tipo: 'nota', texto: 'Concentrarse da +20 a los poderes psíquicos en vez de +10 (Psíquicos!Q17).' },
  ],
  Calibre: [
    { tipo: 'nota', texto: 'Al potenciar con CV, +20 por CV en vez de +10, hasta +100 en vez de +50 (Psíquicos!K18).' },
  ],
  'Mantenimiento añadido': [{ tipo: 'nota', texto: 'Un poder psíquico más mantenido a la vez (Psíquicos!AK17).' }],
  'Acc. psíquico natural (1)': [{ tipo: 'nota', texto: 'Un poder psíquico natural de dificultad Difícil (Psíquicos!AL11).' }],
  'Acc. psíquico natural (2)': [{ tipo: 'nota', texto: 'Un poder psíquico natural de dificultad Muy difícil (Psíquicos!AL11).' }],
  'Acc. psíquico natural (3)': [{ tipo: 'nota', texto: 'Un poder psíquico natural de dificultad Absurda (Psíquicos!AL11).' }],
  ...notasDeDisciplinas(),
  'Convocador de masas (1)': [{ tipo: 'nota', texto: '+1 nivel de Convocación en masa (Místicos!Q25).' }],
  'Convocador de masas (2)': [{ tipo: 'nota', texto: '+2 niveles de Convocación en masa (Místicos!Q25).' }],
  'Convocador de masas (3)': [{ tipo: 'nota', texto: '+3 niveles de Convocación en masa (Místicos!Q25).' }],
  ...notasDeVias(),
  'Magia innata mejorada (1)': [{ tipo: 'nota', texto: '+10 a la magia innata (Tablas!F1104).' }],
  'Magia innata mejorada (2)': [{ tipo: 'nota', texto: '+20 a la magia innata (Tablas!F1104).' }],
  'Magia innata mejorada (3)': [{ tipo: 'nota', texto: '+30 a la magia innata (Tablas!F1104).' }],
  'Desequilibrio sephirótico': [{ tipo: 'nota', texto: '+20 al ACT con su Vía, como un desequilibrio elemental (Místicos!J15).' }],
  // El cálculo de Ki ya la aplica (ki.ts): la entrada está para que la ficha no la dé por
  // «sin efecto».
  'Poder innato': [
    { tipo: 'nota', texto: 'Sin Ki por característica: todo sale del Poder, ×6 más lo comprado (Ki!F24). Ya está aplicado.' },
  ],
  'Apto desarrollo de la magia': [
    { tipo: 'nota', texto: 'La hoja v8.7.0 la marca como implementada pero no la usa en ninguna fórmula: su efecto lo aplica la mesa.' },
  ],
  'Magia opuesta': [{ tipo: 'nota', texto: 'Las Vías opuestas no cuestan el doble (Tablas!K1089).' }],
  'Lazo existencial': [{ tipo: 'nota', texto: 'Sin conjuros de libre acceso (Místicos!AK10).' }],
  'Esencia Sheele': [{ tipo: 'nota', texto: '+2 mejoras de Sheele (Sheele!H22).' }],
  'Curtido (1)': [{ tipo: 'nota', texto: 'Experiencia de más: 50 PX por PC gastado (General!X14).' }],
  'Curtido (2)': [{ tipo: 'nota', texto: 'Experiencia de más: 50 PX por PC gastado (General!X14).' }],
  'Curtido (3)': [{ tipo: 'nota', texto: 'Experiencia de más: 50 PX por PC gastado (General!X14).' }],
  'Fama (1)': [{ tipo: 'nota', texto: 'Fama de 40 como mínimo (General!AF59).' }],
  'Fama (2)': [{ tipo: 'nota', texto: 'Fama de 65 como mínimo (General!AF59).' }],
  ' > Mutación (1)': [{ tipo: 'nota', texto: '+50 PD adicionales (Principal!AB27).' }],
  ' > Mutación (2)': [{ tipo: 'nota', texto: '+100 PD adicionales (Principal!AB27).' }],
  ' > Mutación (3)': [{ tipo: 'nota', texto: '+150 PD adicionales (Principal!AB27).' }],
  Versátil: [{ tipo: 'nota', texto: 'Abarata los cambios de categoría.' }],
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
  /** Por cuánto se multiplica el número de Bonificadores Naturales que se pueden repartir. */
  factorBonosNaturales: number;
  conocimientoTotal: boolean;
  /** Lo que cambia el coste de cada secundaria, ya resuelto por campo y por elección. */
  costeSecundaria: Record<string, number>;
  /** Bono **por nivel** a cada secundaria. */
  aprendizajeSecundaria: Record<string, number>;
  /** Bono fijo a cada secundaria. */
  bonoSecundaria: Record<string, number>;
  costeCampo: Partial<Record<GrupoSecundarias, number>>;
  aprendizajeCampo: Partial<Record<GrupoSecundarias, number>>;
  /** Tamaño no natural, ya combinado y dentro de ±5. */
  tamano: number;
  nivelMagiaPorNivel: number;
  regeneracionZeonGrados: number;
  regeneracionZeonFactor: number;
  /** Ventajas de una habilidad elegida a las que todavía no se les ha dicho cuál. */
  sinHabilidad: string[];
  /** Recordatorios de lo que la aplicación no automatiza. */
  notas: { origen: string; texto: string }[];
  /** Ventajas elegidas sin ningún efecto registrado. */
  sinEfecto: string[];
}

/**
 * Suma los efectos de todas las ventajas y desventajas elegidas.
 *
 * `elecciones` dice a qué habilidad va cada ventaja que se aplica a una que elige el jugador
 * («Apto en una materia (1)» → «Medicina»). Como en la hoja, cada habilidad elegida es una
 * vez que se ha tomado la ventaja.
 */
export function acumularEfectos(
  nombres: string[],
  elecciones: Record<string, string[]> = {},
): EfectosAplicados {
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
    factorBonosNaturales: 1,
    conocimientoTotal: false,
    costeSecundaria: {},
    aprendizajeSecundaria: {},
    bonoSecundaria: {},
    costeCampo: {},
    aprendizajeCampo: {},
    tamano: 0,
    nivelMagiaPorNivel: 0,
    regeneracionZeonGrados: 0,
    regeneracionZeonFactor: 1,
    sinHabilidad: [],
    notas: [],
    sinEfecto: [],
  };
  const suma = (r: Record<string, number>, k: string, v: number) => {
    r[k] = (r[k] ?? 0) + v;
  };
  let tamanoMayor = 0;
  let tamanoMenor = 0;

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
        case 'factorBonosNaturales': out.factorBonosNaturales *= e.factor; break;
        case 'conocimientoTotal': out.conocimientoTotal = true; break;
        case 'costeCampo': suma(out.costeCampo, e.grupo, e.valor); break;
        case 'aprendizajeCampo': suma(out.aprendizajeCampo, e.grupo, e.valor); break;
        case 'costeElegida':
        case 'aprendizajeElegida': {
          const habilidades = (elecciones[nombre] ?? []).filter(Boolean).slice(0, MAXIMO_HABILIDADES_POR_VENTAJA);
          if (habilidades.length === 0 && !out.sinHabilidad.includes(nombre)) out.sinHabilidad.push(nombre);
          const destino = e.tipo === 'costeElegida' ? out.costeSecundaria : out.aprendizajeSecundaria;
          for (const h of habilidades) suma(destino, h, e.valor);
          break;
        }
        case 'bonoSecundaria': suma(out.bonoSecundaria, e.habilidad, e.valor); break;
        case 'tamano':
          tamanoMayor = Math.max(tamanoMayor, e.valor);
          tamanoMenor = Math.min(tamanoMenor, e.valor);
          break;
        case 'nivelMagiaPorNivel': out.nivelMagiaPorNivel += e.valor; break;
        case 'regeneracionZeonGrados': out.regeneracionZeonGrados += e.valor; break;
        case 'regeneracionZeonFactor': out.regeneracionZeonFactor *= e.factor; break;
        case 'nota': out.notas.push({ origen: nombre, texto: e.texto }); break;
      }
    }
  }
  out.tamano = Math.max(-5, Math.min(5, tamanoMayor + tamanoMenor));

  return out;
}

/** Cuántas ventajas del catálogo tienen efecto automatizado. Para poder informarlo. */
export function cobertura(catalogo: string[]): { conEfecto: number; total: number } {
  return {
    conEfecto: catalogo.filter((n) => EFECTOS[n]).length,
    total: catalogo.length,
  };
}
