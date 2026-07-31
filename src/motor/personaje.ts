/**
 * Modelo de personaje y derivación de valores.
 *
 * Principio: la ficha guarda **sólo lo que el usuario decide** (características base, PD
 * invertidos, equipo…). Todo lo demás se recalcula. Lo único que se persiste de un valor
 * derivado es la *sobrescritura manual*, cuando el usuario decide ignorar el cálculo.
 */

import { Reglamento, REGLAMENTO_OFICIAL, type ClaveRegla } from './reglamento';
import type { Catalogo } from '../datos/paquetes';
import type { Categoria, Raza, TablasBase } from '../datos/tipos';

export const CARACTERISTICAS = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'] as const;
export type Caracteristica = (typeof CARACTERISTICAS)[number];

export const GRUPOS_SECUNDARIAS = [
  'Atléticas', 'Sociales', 'Perceptivas', 'Intelectuales', 'Vigor', 'Subterfugio', 'Creativas',
] as const;
export type GrupoSecundarias = (typeof GRUPOS_SECUNDARIAS)[number];

/** Habilidad secundaria: grupo al que pertenece y característica de la que depende. */
export interface DefinicionSecundaria {
  nombre: string;
  grupo: GrupoSecundarias;
  caracteristica: Caracteristica;
}

export const SECUNDARIAS: readonly DefinicionSecundaria[] = [
  { nombre: 'Acrobacias', grupo: 'Atléticas', caracteristica: 'AGI' },
  { nombre: 'Atletismo', grupo: 'Atléticas', caracteristica: 'AGI' },
  { nombre: 'Montar', grupo: 'Atléticas', caracteristica: 'AGI' },
  { nombre: 'Nadar', grupo: 'Atléticas', caracteristica: 'AGI' },
  { nombre: 'Trepar', grupo: 'Atléticas', caracteristica: 'AGI' },
  { nombre: 'Saltar', grupo: 'Atléticas', caracteristica: 'FUE' },
  { nombre: 'Pilotar', grupo: 'Atléticas', caracteristica: 'DES' },
  { nombre: 'Estilo', grupo: 'Sociales', caracteristica: 'POD' },
  { nombre: 'Intimidar', grupo: 'Sociales', caracteristica: 'VOL' },
  { nombre: 'Liderazgo', grupo: 'Sociales', caracteristica: 'POD' },
  { nombre: 'Persuasión', grupo: 'Sociales', caracteristica: 'INT' },
  { nombre: 'Comercio', grupo: 'Sociales', caracteristica: 'INT' },
  { nombre: 'Callejeo', grupo: 'Sociales', caracteristica: 'INT' },
  { nombre: 'Etiqueta', grupo: 'Sociales', caracteristica: 'INT' },
  { nombre: 'Advertir', grupo: 'Perceptivas', caracteristica: 'PER' },
  { nombre: 'Buscar', grupo: 'Perceptivas', caracteristica: 'PER' },
  { nombre: 'Rastrear', grupo: 'Perceptivas', caracteristica: 'PER' },
  { nombre: 'Animales', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Ciencia', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Herbolaria', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Historia', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Medicina', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Memorizar', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Navegación', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Ocultismo', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Tasación', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Táctica', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Valoración Mágica', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Frialdad', grupo: 'Vigor', caracteristica: 'VOL' },
  { nombre: 'Proezas de Fuerza', grupo: 'Vigor', caracteristica: 'FUE' },
  { nombre: 'Resistencia al Dolor', grupo: 'Vigor', caracteristica: 'CON' },
  { nombre: 'Cerrajería', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Disfraz', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Ocultarse', grupo: 'Subterfugio', caracteristica: 'PER' },
  { nombre: 'Robo', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Sigilo', grupo: 'Subterfugio', caracteristica: 'AGI' },
  { nombre: 'Trampería', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Venenos', grupo: 'Subterfugio', caracteristica: 'INT' },
  { nombre: 'Arte', grupo: 'Creativas', caracteristica: 'POD' },
  { nombre: 'Baile', grupo: 'Creativas', caracteristica: 'AGI' },
  { nombre: 'Forja', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Runas', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Alquimia', grupo: 'Creativas', caracteristica: 'INT' },
  { nombre: 'Animismo', grupo: 'Creativas', caracteristica: 'POD' },
  { nombre: 'Música', grupo: 'Creativas', caracteristica: 'POD' },
  { nombre: 'Trucos de Manos', grupo: 'Creativas', caracteristica: 'DES' },
];

export const RESISTENCIAS = ['RF', 'RE', 'RV', 'RM', 'RP'] as const;
export type Resistencia = (typeof RESISTENCIAS)[number];

/** Característica de la que depende cada resistencia. */
export const CARACTERISTICA_DE_RESISTENCIA: Record<Resistencia, Caracteristica> = {
  RF: 'CON', RE: 'CON', RV: 'CON', RM: 'POD', RP: 'VOL',
};

// ───────────────────────────── La ficha guardada ─────────────────────────────

export interface Personaje {
  id: string;
  /** Para la futura sincronización: quién es el dueño de la ficha. */
  propietario: string | null;
  campanaId: string | null;
  actualizadoEn: string;

  nombre: string;
  jugador?: string;
  raza: string;
  categoria: string;
  nivel: number;

  /** Valores comprados, antes de modificadores raciales. */
  caracteristicas: Record<Caracteristica, number>;

  /** PD invertidos, por clave de habilidad. */
  pdInvertidos: Record<string, number>;

  /** Las cinco Habilidades Naturales (+10 cada una). */
  habilidadesNaturales: string[];
  /** Bonificador Natural: una secundaria física y una anímica. */
  bonificadorNatural: { fisica?: string; animica?: string };

  ventajas: string[];
  desventajas: string[];

  /** Estado de juego, lo que cambia durante la partida. */
  estado: {
    pvActuales?: number;
    cansancioActual?: number;
    zeonActual?: number;
    kiActual?: number;
    cvLibres?: number;
    puntosDestinoUsados?: number;
  };

  /** Sobrescrituras manuales de valores derivados: el usuario manda sobre el cálculo. */
  manuales: Partial<Record<string, number>>;

  notas?: string;
}

export function personajeVacio(id: string): Personaje {
  return {
    id,
    propietario: null,
    campanaId: null,
    actualizadoEn: new Date().toISOString(),
    nombre: '',
    raza: 'Humano',
    categoria: 'Novel',
    nivel: 1,
    caracteristicas: { AGI: 5, CON: 5, DES: 5, FUE: 5, INT: 5, PER: 5, POD: 5, VOL: 5 },
    pdInvertidos: {},
    habilidadesNaturales: [],
    bonificadorNatural: {},
    ventajas: [],
    desventajas: [],
    estado: {},
    manuales: {},
  };
}

// ───────────────────────────── Valores derivados ─────────────────────────────

export interface ValorDerivado {
  /** Resultado del cálculo según el reglamento vigente. */
  calculado: number;
  /** Valor mostrado: el manual si lo hay, si no el calculado. */
  valor: number;
  /** true si el usuario lo ha sobrescrito a mano. */
  manual: boolean;
}

export interface Aviso {
  gravedad: 'error' | 'aviso';
  mensaje: string;
}

export interface FichaCalculada {
  nivelTotal: number;
  pdTotales: number;
  caracteristicas: Record<Caracteristica, { total: number; bono: number; base: number; raza: number }>;
  puntosVida: ValorDerivado;
  cansancio: ValorDerivado;
  presencia: ValorDerivado;
  resistencias: Record<Resistencia, ValorDerivado>;
  zeon: ValorDerivado;
  act: ValorDerivado;
  secundarias: Record<string, ValorDerivado>;
  pdGastados: { combate: number; misticas: number; psiquicas: number; secundarias: number; total: number };
  limites: { combate: number; misticas: number; psiquicas: number };
  avisos: Aviso[];
}

/** Campo de la categoría que da el coste de desarrollo de cada grupo de secundarias. */
const CAMPO_COSTE: Record<GrupoSecundarias, string> = {
  'Atléticas': 'costeAtleticas',
  'Sociales': 'costeSociales',
  'Perceptivas': 'costePerceptivas',
  'Intelectuales': 'costeIntelectuales',
  'Vigor': 'costeVigor',
  'Subterfugio': 'costeSubterfugio',
  'Creativas': 'costeCreativas',
};

const CLAVES_COMBATE = ['HAtaque', 'HParada', 'HEsquiva', 'LlevarArmadura', 'Ki', 'AcumKi', 'CM'];
const CLAVES_MISTICAS = ['Zeon', 'ACT', 'ProyeccionMagica', 'NivelMagia', 'Convocar', 'Controlar', 'Atar', 'Desconvocar'];
const CLAVES_PSIQUICAS = ['CV', 'ProyeccionPsiquica'];

/** Contexto de datos que necesita el cálculo. Se carga una vez y se reutiliza. */
export interface DatosCalculo {
  raza: Raza | undefined;
  categoria: Categoria | undefined;
  tablas: TablasBase;
}

export async function cargarDatosCalculo(
  personaje: Personaje,
  catalogo: Catalogo,
): Promise<DatosCalculo> {
  const [raza, categoria, tablas] = await Promise.all([
    catalogo.buscar('razas', personaje.raza),
    catalogo.buscar('categorias', personaje.categoria),
    catalogo.tablasBase(),
  ]);
  return { raza, categoria, tablas };
}

function bonoDe(valor: number, tablas: TablasBase): number {
  if (valor < 1) return 0;
  const fila = tablas.bonoCaracteristica.find((f) => f.valor === Math.min(valor, 20));
  return fila?.bono ?? 0;
}

function pvBase(valor: number, tablas: TablasBase): number {
  const fila = tablas.valoresBase.find((f) => f.valor === Math.min(Math.max(valor, 1), 20));
  return fila?.PV ?? 0;
}

function actBase(valor: number, tablas: TablasBase): number {
  const fila = tablas.valoresBase.find((f) => f.valor === Math.min(Math.max(valor, 1), 20));
  return fila?.ACT ?? 0;
}

/** Calcula la ficha completa. Función pura: mismos datos, mismo resultado. */
export function calcular(
  personaje: Personaje,
  datos: DatosCalculo,
  reglamento: Reglamento = REGLAMENTO_OFICIAL,
): FichaCalculada {
  const { raza, categoria, tablas } = datos;
  const avisos: Aviso[] = [];

  if (!raza) avisos.push({ gravedad: 'error', mensaje: `Raza desconocida: "${personaje.raza}".` });
  if (!categoria)
    avisos.push({ gravedad: 'error', mensaje: `Categoría desconocida: "${personaje.categoria}".` });

  const ajusteNivel = raza?.ajusteNivel ?? 0;
  const nivelTotal = personaje.nivel + ajusteNivel;
  const pdTotales = personaje.nivel * 600;

  // Características: base + raza, con tope 20 y suelo 0.
  const caracteristicas = {} as FichaCalculada['caracteristicas'];
  for (const c of CARACTERISTICAS) {
    const base = personaje.caracteristicas[c] ?? 0;
    const modRaza = (raza?.[c] as number | undefined) ?? 0;
    const total = Math.min(20, Math.max(0, base + modRaza));
    caracteristicas[c] = { base, raza: modRaza, total, bono: bonoDe(total, tablas) };
  }

  const derivar = (clave: string, calculado: number): ValorDerivado => {
    const manual = personaje.manuales[clave];
    return manual !== undefined
      ? { calculado, valor: manual, manual: true }
      : { calculado, valor: calculado, manual: false };
  };

  const aplicar = (regla: ClaveRegla, ctx: Record<string, number | boolean>, siInactiva = 0) => {
    try {
      return reglamento.aplicar(regla, ctx, siInactiva);
    } catch (e) {
      avisos.push({
        gravedad: 'error',
        mensaje: `La fórmula de "${regla}" ha fallado: ${e instanceof Error ? e.message : e}`,
      });
      return 0;
    }
  };

  const puntosVida = derivar(
    'puntosVida',
    aplicar('puntosVida', {
      pvBasePorCON: pvBase(caracteristicas.CON.total, tablas),
      pvCategoria: categoria?.PV ?? 0,
      nivelTotal,
      CON: caracteristicas.CON.total,
      bonoCON: caracteristicas.CON.bono,
    }),
  );

  const cansancio = derivar(
    'cansancio',
    aplicar('cansancio', {
      CON: caracteristicas.CON.total,
      cansancioRaza: raza?.cansancio ?? 0,
    }),
  );

  const presencia = derivar('presencia', aplicar('presencia', { pdTotales }));

  const resistencias = {} as Record<Resistencia, ValorDerivado>;
  for (const r of RESISTENCIAS) {
    const car = CARACTERISTICA_DE_RESISTENCIA[r];
    resistencias[r] = derivar(
      r,
      aplicar('resistencia', {
        presencia: presencia.valor,
        bonoCaracteristica: caracteristicas[car].bono,
        modRaza: (raza?.[r] as number | undefined) ?? 0,
        especial: 0,
        factor: 1,
      }),
    );
  }

  const costeZeon = Number(categoria?.costeZeon ?? 0);
  const pdZeon = personaje.pdInvertidos['Zeon'] ?? 0;
  const zeonComprado =
    costeZeon > 0 ? aplicar('zeonPorPD', { pd: pdZeon, coste: costeZeon }) : 0;
  const zeon = derivar(
    'zeon',
    aplicar('zeon', {
      zeonBasePorPOD: pvBase(caracteristicas.POD.total, tablas),
      zeonComprado,
      zeonCategoria: Number(categoria?.bonoZeon ?? 0),
      nivelTotal,
    }),
  );

  const costeACT = Number(categoria?.costeACT ?? 0);
  const base = actBase(caracteristicas.POD.total, tablas);
  const act = derivar(
    'act',
    costeACT > 0
      ? aplicar('act', { actBasePorPOD: base, pd: personaje.pdInvertidos['ACT'] ?? 0, coste: costeACT })
      : base,
  );

  // Habilidades secundarias.
  const secundarias: Record<string, ValorDerivado> = {};
  for (const def of SECUNDARIAS) {
    const pd = personaje.pdInvertidos[def.nombre] ?? 0;
    const coste = Number(categoria?.[CAMPO_COSTE[def.grupo]] ?? 2);
    const bonoCategoria = Number(categoria?.[`bon${def.nombre.replace(/\s/g, '')}`] ?? 0);
    const mejoraNatural =
      (personaje.habilidadesNaturales.includes(def.nombre) ? 10 : 0) +
      (personaje.bonificadorNatural.fisica === def.nombre ||
      personaje.bonificadorNatural.animica === def.nombre
        ? caracteristicas[def.caracteristica].bono
        : 0);

    secundarias[def.nombre] = derivar(
      def.nombre,
      aplicar('habilidadSecundaria', {
        pd,
        coste: coste || 2,
        bonoCaracteristica: caracteristicas[def.caracteristica].bono,
        bonoCategoria,
        mejoraNatural,
        penalizadorNoDesarrollada: -30,
        penalizadorNatural: 0,
      }),
    );
  }

  // Reparto de PD y límites.
  const sumar = (claves: string[]) =>
    claves.reduce((t, k) => t + (personaje.pdInvertidos[k] ?? 0), 0);
  const pdSecundarias = SECUNDARIAS.reduce((t, d) => t + (personaje.pdInvertidos[d.nombre] ?? 0), 0);
  const pdGastados = {
    combate: sumar(CLAVES_COMBATE),
    misticas: sumar(CLAVES_MISTICAS),
    psiquicas: sumar(CLAVES_PSIQUICAS),
    secundarias: pdSecundarias,
    total: 0,
  };
  pdGastados.total =
    pdGastados.combate + pdGastados.misticas + pdGastados.psiquicas + pdGastados.secundarias;

  const limite = (fraccion: number) =>
    aplicar('limitePrimarias', { pdTotales, limiteCategoria: fraccion }, Number.POSITIVE_INFINITY);
  const limites = {
    combate: limite(categoria?.limiteCombate ?? 0.5),
    misticas: limite(categoria?.limiteMagia ?? 0.5),
    psiquicas: limite(categoria?.limitePsi ?? 0.5),
  };

  // Los límites avisan, no bloquean: muchas mesas juegan con reglas caseras.
  if (pdGastados.total > pdTotales) {
    avisos.push({
      gravedad: 'error',
      mensaje: `Has repartido ${pdGastados.total} PD y sólo tienes ${pdTotales}.`,
    });
  }
  const comprobarLimite = (campo: keyof typeof limites, etiqueta: string) => {
    if (pdGastados[campo] > limites[campo]) {
      avisos.push({
        gravedad: 'aviso',
        mensaje: `${etiqueta}: ${pdGastados[campo]} PD superan el límite de ${limites[campo]} de la categoría.`,
      });
    }
  };
  comprobarLimite('combate', 'Habilidades de combate');
  comprobarLimite('misticas', 'Habilidades místicas');
  comprobarLimite('psiquicas', 'Habilidades psíquicas');

  if (personaje.habilidadesNaturales.length > 5) {
    avisos.push({
      gravedad: 'aviso',
      mensaje: `Habilidades Naturales: has elegido ${personaje.habilidadesNaturales.length} y sólo se permiten 5.`,
    });
  }

  return {
    nivelTotal,
    pdTotales,
    caracteristicas,
    puntosVida,
    cansancio,
    presencia,
    resistencias,
    zeon,
    act,
    secundarias,
    pdGastados,
    limites,
    avisos,
  };
}
