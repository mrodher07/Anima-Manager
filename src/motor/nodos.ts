/**
 * Nodos y Sanctum Sanctorum. Arcana Exxet, cap. 10 (reglas opcionales).
 *
 * Un Nodo es un punto donde confluyen las Líneas del Dragón, y sólo hay siete en toda
 * Gaïa. Un mago puede tratar de sincronizarse con él para obtener poderes casi divinos, y
 * el precio de fallar es aterrador: en el peor tramo, la desaparición del personaje sin
 * posible salvación.
 *
 * La mecánica es una suma limpia y por eso tiene calculadora: se eligen los beneficios que
 * se quieren, cada uno con su modificador de dificultad, y se hace un **Control de Poder
 * contra 10** más esos modificadores. Lo que decide el Director —si el nodo está corrompido
 * o controlado, y cuánto— se pregunta.
 *
 * El Sanctum Sanctorum es lo contrario: no se tira nada al usarlo, pero **crearlo** cuesta
 * Zeon máximo y puntos de Poder permanentes.
 */

export type Dominio = 'magia' | 'psiquico' | 'ki';

export interface Beneficio {
  beneficio: string;
  modificador: number;
  /** Dos beneficios del mismo grupo no se pueden combinar. */
  grupo: string;
  nota?: string;
}

/** Tabla 18. */
export const BENEFICIOS_MAGIA: Beneficio[] = [
  { beneficio: 'ACT +10', modificador: 0, grupo: 'ACT', nota: 'NA' },
  { beneficio: 'ACT +20', modificador: 1, grupo: 'ACT' },
  { beneficio: 'ACT +30', modificador: 2, grupo: 'ACT' },
  { beneficio: 'ACT +40', modificador: 3, grupo: 'ACT' },
  { beneficio: 'ACT +50', modificador: 4, grupo: 'ACT' },
  { beneficio: 'ACT Doble', modificador: 5, grupo: 'ACT multiplicado' },
  { beneficio: 'ACT Triple', modificador: 6, grupo: 'ACT multiplicado' },
  { beneficio: 'ACT Cuádruple', modificador: 7, grupo: 'ACT multiplicado' },
  { beneficio: 'ACT Quíntuple', modificador: 8, grupo: 'ACT multiplicado' },
  { beneficio: 'Gasto de Zeon a Mitad', modificador: 2, grupo: 'Zeon' },
  { beneficio: 'Sin gasto de Zeon', modificador: 4, grupo: 'Zeon' },
  { beneficio: 'Nivel Máximo +1', modificador: 1, grupo: 'Nivel máximo' },
  { beneficio: 'Nivel Máximo +2', modificador: 2, grupo: 'Nivel máximo' },
  { beneficio: 'Nivel Máximo +3', modificador: 3, grupo: 'Nivel máximo' },
  { beneficio: 'Nivel Máximo +4', modificador: 4, grupo: 'Nivel máximo' },
  { beneficio: 'Nivel Máximo +5', modificador: 5, grupo: 'Nivel máximo' },
  { beneficio: 'Proyección Mágica +25', modificador: 1, grupo: 'Proyección' },
  { beneficio: 'Proyección Mágica +50', modificador: 2, grupo: 'Proyección' },
  { beneficio: 'Proyección Mágica +75', modificador: 3, grupo: 'Proyección' },
  { beneficio: 'Proyección Mágica +100', modificador: 4, grupo: 'Proyección' },
  { beneficio: 'Alta Magia', modificador: 1, grupo: 'Magia superior', nota: 'Con Gnosis inferior a 25.' },
  { beneficio: 'Magia Divina', modificador: 8, grupo: 'Magia superior', nota: 'Con Gnosis inferior a 40.' },
];

/** Tabla 20. */
export const BENEFICIOS_PSIQUICO: Beneficio[] = [
  { beneficio: 'Potencial Psíquico +10', modificador: 0, grupo: 'Potencial', nota: 'NA' },
  { beneficio: 'Potencial Psíquico +20', modificador: 1, grupo: 'Potencial' },
  { beneficio: 'Potencial Psíquico +30', modificador: 2, grupo: 'Potencial' },
  { beneficio: 'Potencial Psíquico +40', modificador: 3, grupo: 'Potencial' },
  { beneficio: 'Potencial Psíquico +50', modificador: 4, grupo: 'Potencial' },
  { beneficio: 'Proyección Psíquica +10', modificador: 1, grupo: 'Proyección' },
  { beneficio: 'Proyección Psíquica +25', modificador: 2, grupo: 'Proyección' },
  { beneficio: 'Proyección Psíquica +50', modificador: 3, grupo: 'Proyección' },
  { beneficio: 'Poder de Nivel 1', modificador: 1, grupo: 'Poder' },
  { beneficio: 'Poder de Nivel 2', modificador: 2, grupo: 'Poder' },
  { beneficio: 'Poder de Nivel 3', modificador: 3, grupo: 'Poder' },
];

/** Tabla 22. */
export const BENEFICIOS_KI: Beneficio[] = [
  { beneficio: 'Acumulaciones +1', modificador: 1, grupo: 'Acumulaciones' },
  { beneficio: 'Acumulaciones +2', modificador: 2, grupo: 'Acumulaciones' },
  { beneficio: 'Acumulaciones +3', modificador: 4, grupo: 'Acumulaciones' },
  { beneficio: 'Gasto de Ki a Mitad', modificador: 2, grupo: 'Ki' },
  { beneficio: 'Sin gasto de Ki', modificador: 4, grupo: 'Ki' },
];

export function beneficiosDe(dominio: Dominio): Beneficio[] {
  return dominio === 'magia'
    ? BENEFICIOS_MAGIA
    : dominio === 'psiquico'
      ? BENEFICIOS_PSIQUICO
      : BENEFICIOS_KI;
}

/** La dificultad de partida de cualquier Control de Poder en un Nodo. */
export const DIFICULTAD_BASE_NODO = 10;
/** Tabla 24. */
export const PRIMER_ENLACE = 1;

export interface EleccionNodo {
  dominio: Dominio;
  beneficios: string[];
  /** Tabla 24: +1 a +5 si está corrompido, -1 a -3 si está controlado. Lo pone el Director. */
  estadoDelNodo?: number;
  primerEnlace?: boolean;
}

export interface ResultadoNodo {
  dificultad: number;
  porBeneficios: number;
  porEstado: number;
  porPrimerEnlace: number;
  avisos: string[];
}

/**
 * Dificultad del Control de Poder.
 *
 * El manual es explícito en un punto que la calculadora respeta: **no se puede elegir dos
 * veces el mismo tipo de ventaja**, ni combinar el bono al ACT con el que lo multiplica.
 * Aquí eso se modela como grupos: dos beneficios del mismo grupo no conviven, y se queda el
 * de más modificador, que es el que el jugador estaba pidiendo.
 *
 * Otra regla que se aplica sola: un Nodo **ignora cualquier modificador innatural al
 * Poder**, así que el Control se hace con el atributo desnudo. Eso no es una cuenta, es un
 * aviso, y como tal aparece.
 */
export function calcularNodo(e: EleccionNodo): ResultadoNodo {
  const avisos: string[] = [];
  const tabla = beneficiosDe(e.dominio);
  const elegidos = [...new Set(e.beneficios)]
    .map((b) => tabla.find((x) => x.beneficio === b))
    .filter((b): b is Beneficio => Boolean(b));

  // Un solo beneficio por grupo: se queda el de mayor modificador.
  const porGrupo = new Map<string, Beneficio>();
  for (const b of elegidos) {
    const previo = porGrupo.get(b.grupo);
    if (!previo) porGrupo.set(b.grupo, b);
    else {
      avisos.push(
        `«${previo.beneficio}» y «${b.beneficio}» son del mismo tipo de ventaja y no se ` +
          'pueden combinar; se cuenta sólo el mayor.',
      );
      if (b.modificador > previo.modificador) porGrupo.set(b.grupo, b);
    }
  }
  // El ACT sumado y el ACT multiplicado tampoco se combinan entre sí.
  if (porGrupo.has('ACT') && porGrupo.has('ACT multiplicado')) {
    const sumado = porGrupo.get('ACT')!;
    const multiplicado = porGrupo.get('ACT multiplicado')!;
    avisos.push(
      'El bono al ACT no se puede combinar con el que lo multiplica; se cuenta sólo el mayor.',
    );
    porGrupo.delete(sumado.modificador > multiplicado.modificador ? 'ACT multiplicado' : 'ACT');
  }

  const porBeneficios = [...porGrupo.values()].reduce((t, b) => t + b.modificador, 0);
  const porEstado = e.estadoDelNodo ?? 0;
  const porPrimerEnlace = e.primerEnlace ? PRIMER_ENLACE : 0;

  avisos.push(
    'Un Nodo ignora cualquier modificador innatural al Poder: el Control se hace con el ' +
      'atributo desnudo.',
  );

  return {
    dificultad: DIFICULTAD_BASE_NODO + porBeneficios + porEstado + porPrimerEnlace,
    porBeneficios,
    porEstado,
    porPrimerEnlace,
    avisos,
  };
}

export interface Consecuencia {
  desde: number;
  hasta: number;
  resultado: string;
  efecto: string;
}

/** Tablas 19, 21 y 23. Los tramos cambian según el dominio. */
export const FALLO_NODO: Record<Dominio, Consecuencia[]> = {
  magia: [
    {
      desde: 1,
      hasta: 3,
      resultado: 'Shock Sobrenatural',
      efecto:
        '-120 a Toda Acción y pierde la mitad de sus puntos de vida actuales, que se ' +
        'recuperan a 10 por día sin importar la regeneración ni ningún medio sobrenatural. ' +
        'Además, control de Presencia Base contra 140 o pierde un Punto de Poder por cada 10 ' +
        'puntos de fracaso.',
    },
    {
      desde: 3,
      hasta: 6,
      resultado: 'Consunción Espiritual',
      efecto:
        'El alma queda parcialmente consumida: inconsciente un tiempo indeterminado —de horas ' +
        'a años— y destruida su capacidad de usar magia el resto de su existencia. Se ' +
        'considera que deja de poseer el Don.',
    },
    {
      desde: 7,
      hasta: Infinity,
      resultado: 'Descreación',
      efecto:
        'La existencia del hechicero es consumida por completo, destruyendo cualquier rastro ' +
        'de él sin posible salvación.',
    },
  ],
  psiquico: [
    {
      desde: 1,
      hasta: 4,
      resultado: 'Shock Psíquico',
      efecto:
        'Fatiga 10 y -60 a toda acción, recuperable a 10 puntos por día. Además, control de ' +
        'Presencia Base contra 140 o pierde un Punto de Voluntad por cada 10 de fracaso.',
    },
    {
      desde: 5,
      hasta: 8,
      resultado: 'Consunción Espiritual',
      efecto:
        'La mente queda parcialmente destrozada: inconsciente un tiempo indeterminado y con ' +
        'Inteligencia y Voluntad reducidas a la mitad.',
    },
    {
      desde: 9,
      hasta: Infinity,
      resultado: 'Descreación',
      efecto: 'La existencia del mentalista es consumida por completo, sin posible salvación.',
    },
  ],
  ki: [
    {
      desde: 1,
      hasta: 4,
      resultado: 'Shock Físico',
      efecto:
        '-60 a toda acción y pierde la mitad de sus puntos de vida actuales, recuperables a ' +
        '10 por día. Además, control de Presencia Base contra 140 o pierde un Punto de ' +
        'Voluntad por cada 10 de fracaso.',
    },
    {
      desde: 5,
      hasta: 8,
      resultado: 'Consunción Espiritual',
      efecto:
        'Las energías físicas quedan parcialmente consumidas: inconsciente un tiempo ' +
        'indeterminado, con sus acumulaciones y su reserva máxima de Ki a la mitad.',
    },
    {
      desde: 9,
      hasta: Infinity,
      resultado: 'Descreación',
      efecto: 'La existencia del personaje es consumida por completo, sin posible salvación.',
    },
  ],
};

/**
 * Qué le pasa al que falla. `fallo` es por cuánto se falló el Control, en positivo.
 * Un fallo de 0 o menos significa que no se falló: no hay consecuencia.
 */
export function consecuenciaDe(dominio: Dominio, fallo: number): Consecuencia | null {
  if (fallo <= 0) return null;
  return FALLO_NODO[dominio].find((c) => fallo >= c.desde && fallo <= c.hasta) ?? null;
}

// ─────────────────────────── Sanctum Sanctorum ───────────────────────────

export interface GradoSanctum {
  grado: number;
  presencia: number;
  menores: number;
  mayores: number;
  ritual: string;
  requisitos: string;
}

/** Tabla 25. */
export const GRADOS_SANCTUM: GradoSanctum[] = [
  {
    grado: 1,
    presencia: 40,
    menores: 3,
    mayores: 0,
    ritual: 'Muy Difícil',
    requisitos:
      'Grabados en el suelo, marcas con sangre o preparativos similares. De tres horas a un día entero.',
  },
  {
    grado: 2,
    presencia: 50,
    menores: 6,
    mayores: 1,
    ritual: 'Absurdo',
    requisitos:
      'Construcciones de complejidad media y grabados detallados, de precio similar al de una pequeña mansión. De una semana a tres meses.',
  },
  {
    grado: 3,
    presencia: 60,
    menores: 9,
    mayores: 2,
    ritual: 'Casi Imposible',
    requisitos: 'Como el anterior, más dos o tres componentes sobrenaturales únicos.',
  },
  {
    grado: 4,
    presencia: 70,
    menores: 12,
    mayores: 3,
    ritual: 'Imposible',
    requisitos:
      'Edificaciones muy grandes o extremadamente complejas, de materiales inusuales. Puede llevar varios años.',
  },
  {
    grado: 5,
    presencia: 85,
    menores: 15,
    mayores: 4,
    ritual: 'Inhumano',
    requisitos:
      'Magna Sacra Sanctum Sanctorum: construcciones por valor de una pequeña ciudad, componentes únicos, artefactos de alto poder existencial o sacrificios de individuos únicos. Más de una década.',
  },
];

/** Cada Efecto Menor cuesta esto de Zeon **máximo**, no de Zeon gastado. */
export const ZEON_POR_EFECTO_MENOR = 50;

export interface Sanctum {
  grado: GradoSanctum | undefined;
  zeonMaximoSacrificado: number;
  poderSacrificado: number;
  presenciaRequerida: number;
  ritual: string;
  avisos: string[];
}

/**
 * Lo que cuesta crear un Santuario.
 *
 * El sacrificio es **permanente** y se paga aunque el ritual falle, si falla por más de dos
 * niveles de dificultad; eso último no lo calcula la aplicación porque depende de la tirada,
 * pero queda avisado. Nada obliga a elegir el máximo de efectos: se puede hacer un
 * Santuario de tercer grado con ocho Efectos Menores y ningún Mayor.
 */
export function crearSanctum(grado: number, menores: number, mayores: number, presenciaBase = 0): Sanctum {
  const g = GRADOS_SANCTUM.find((x) => x.grado === grado);
  const avisos: string[] = [];

  if (!g) {
    avisos.push('Los Santuarios van del grado 1 al 5.');
  } else {
    if (menores > g.menores) {
      avisos.push(`Un Santuario de grado ${grado} admite como máximo ${g.menores} Efectos Menores.`);
    }
    if (mayores > g.mayores) {
      avisos.push(
        g.mayores === 0
          ? `Un Santuario de grado ${grado} no admite Efectos Mayores.`
          : `Un Santuario de grado ${grado} admite como máximo ${g.mayores} Efectos Mayores.`,
      );
    }
    if (presenciaBase > 0 && presenciaBase < g.presencia) {
      avisos.push(
        `Hace falta presencia base ${g.presencia} para un Santuario de grado ${grado}; ` +
          `este personaje tiene ${presenciaBase}.`,
      );
    }
  }

  avisos.push(
    'El sacrificio es permanente y se paga igual si el ritual falla por más de dos niveles ' +
      'de dificultad: no hay manera de recuperar el Zeon ni los puntos de Poder invertidos.',
  );

  return {
    grado: g,
    zeonMaximoSacrificado: Math.max(menores, 0) * ZEON_POR_EFECTO_MENOR,
    poderSacrificado: Math.max(mayores, 0),
    presenciaRequerida: g?.presencia ?? 0,
    ritual: g?.ritual ?? '—',
    avisos,
  };
}
