/**
 * Modelo de personaje y derivación de valores.
 *
 * Principio: la ficha guarda **sólo lo que el usuario decide** (características base, PD
 * invertidos, equipo…). Todo lo demás se recalcula. Lo único que se persiste de un valor
 * derivado es la *sobrescritura manual*, cuando el usuario decide ignorar el cálculo.
 */

import { Reglamento, REGLAMENTO_OFICIAL, type ClaveRegla } from './reglamento';
import type { EleccionesSheele } from './sheele';
import { armaduraRacial, avisosRaza, razaDelPersonaje, type OpcionesRaza } from './razas';
import {
  calcularArma,
  type ContextoCombate,
  combinarArmadura,
  type ArmaEquipada,
  type HabilidadesArma,
  type PiezaEquipada,
  type ProteccionTotal,
} from './combate';
import {
  acumularEfectos, MAXIMO_HABILIDADES_POR_VENTAJA, VENTAJAS_CON_HABILIDAD, type EfectosAplicados,
} from './efectos';
import {
  CARACTERISTICAS_KI,
  ELECCIONES_KI_VACIAS,
  calcularKi,
  type CaracteristicaKi,
  type EleccionesKi,
  type FichaKi,
} from './ki';
import {
  acumularPorNivel,
  resumirMulticlase,
  type EntradaCategoria,
  type ResumenMulticlase,
} from './multiclase';
import type { Catalogo } from '../datos/paquetes';
import type {
  Arma,
  Armadura,
  Categoria,
  EfectoTecnica,
  EntradaTabla,
  HabilidadKiCatalogo,
  EsferaMetamagica,
  LegadoSangre,
  Objeto,
  Raza,
  Secundaria,
  TipoEfectoTecnica,
  TablasBase,
  Ventaja,
} from '../datos/tipos';

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
  /** Si sufre el penalizador natural de la armadura. */
  fisica?: boolean;
  /**
   * Si sin formación no se puede ni intentar: la hoja enseña «-» en vez de un −30. Son las
   * de saber de verdad —Ciencia, Medicina, Forja…—. Ficha, `PDs!AA147`.
   */
  requiereFormacion?: boolean;
}

/**
 * Traduce una fila del catálogo a la definición que usa el motor. Un grupo o una
 * característica que no existan se cambian por los primeros de la lista en vez de romper
 * el cálculo: la mesa verá la habilidad en un sitio raro y lo corregirá, que es mejor que
 * una ficha en blanco.
 */
export function secundariaDeCatalogo(s: Secundaria): DefinicionSecundaria {
  const grupo = GRUPOS_SECUNDARIAS.find((g) => g === s.grupo) ?? GRUPOS_SECUNDARIAS[0];
  const caracteristica = CARACTERISTICAS.find((c) => c === s.caracteristica) ?? 'AGI';
  return {
    nombre: s.secundaria, grupo, caracteristica, fisica: s.fisica,
    requiereFormacion: s.requiereFormacion,
  };
}

/**
 * Las 51 de la hoja de la comunidad (las 46 del Core Exxet, más Ley, Caligrafía ritual,
 * Orfebrería, Confección y Confección de marionetas). Son el **valor por defecto**: la lista que manda es la del
 * catálogo (`datos.secundarias`), para que una mesa pueda añadir las suyas. Ésta se usa
 * cuando no hay catálogo cargado, y es de donde salió `data/reglas/secundarias.json`.
 */
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
  { nombre: 'Ciencia', grupo: 'Intelectuales', caracteristica: 'INT', requiereFormacion: true },
  { nombre: 'Ley', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Herbolaria', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Historia', grupo: 'Intelectuales', caracteristica: 'INT', requiereFormacion: true },
  { nombre: 'Medicina', grupo: 'Intelectuales', caracteristica: 'INT', requiereFormacion: true },
  { nombre: 'Memorizar', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Navegación', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Ocultismo', grupo: 'Intelectuales', caracteristica: 'INT' },
  { nombre: 'Tasación', grupo: 'Intelectuales', caracteristica: 'INT', requiereFormacion: true },
  { nombre: 'Táctica', grupo: 'Intelectuales', caracteristica: 'INT' },
  // Poder, no Inteligencia: PDs!H157.
  { nombre: 'Valoración Mágica', grupo: 'Intelectuales', caracteristica: 'POD', requiereFormacion: true },
  { nombre: 'Frialdad', grupo: 'Vigor', caracteristica: 'VOL' },
  { nombre: 'Proezas de Fuerza', grupo: 'Vigor', caracteristica: 'FUE' },
  // Voluntad, no Constitución: es la que reproduce la hoja de Meirmeister (VOL 6 → +5,
  // −30 sin desarrollar, +10 del Paladín Oscuro = −15) y la que da el manual.
  { nombre: 'Resistencia al Dolor', grupo: 'Vigor', caracteristica: 'VOL' },
  { nombre: 'Cerrajería', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Disfraz', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Ocultarse', grupo: 'Subterfugio', caracteristica: 'PER' },
  { nombre: 'Robo', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Sigilo', grupo: 'Subterfugio', caracteristica: 'AGI' },
  { nombre: 'Trampería', grupo: 'Subterfugio', caracteristica: 'DES' },
  { nombre: 'Venenos', grupo: 'Subterfugio', caracteristica: 'INT', requiereFormacion: true },
  { nombre: 'Arte', grupo: 'Creativas', caracteristica: 'POD' },
  { nombre: 'Baile', grupo: 'Creativas', caracteristica: 'AGI', requiereFormacion: true },
  { nombre: 'Forja', grupo: 'Creativas', caracteristica: 'DES', requiereFormacion: true },
  { nombre: 'Runas', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Alquimia', grupo: 'Creativas', caracteristica: 'INT' },
  { nombre: 'Animismo', grupo: 'Creativas', caracteristica: 'POD' },
  { nombre: 'Música', grupo: 'Creativas', caracteristica: 'POD', requiereFormacion: true },
  { nombre: 'Trucos de Manos', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Caligrafía ritual', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Orfebrería', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Confección', grupo: 'Creativas', caracteristica: 'DES' },
  { nombre: 'Confección de marionetas', grupo: 'Creativas', caracteristica: 'POD' },
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
  sexo?: 'Hombre' | 'Mujer';
  /** Imagen de la galería que hace de retrato. */
  retratoId?: string | null;
  raza: string;
  /**
   * Categorías del personaje con los niveles hechos en cada una. Un personaje de una sola
   * clase tiene una entrada; el multiclase, hasta cinco.
   */
  categorias: EntradaCategoria[];

  /** Valores comprados, antes de modificadores raciales. */
  caracteristicas: Record<Caracteristica, number>;

  /** PD invertidos, por clave de habilidad. */
  pdInvertidos: Record<string, number>;

  /** Habilidades Naturales (+10 cada una): cinco por nivel. Ficha, `PDs!X` y `AA186`. */
  habilidadesNaturales: string[];
  /**
   * Bonificador Natural del modelo antiguo: una secundaria física y una anímica. Se sigue
   * leyendo, pero lo que manda es `bonosNaturales`.
   */
  bonificadorNatural: { fisica?: string; animica?: string };
  /**
   * Bonificadores Naturales por habilidad: cuántas veces se le suma el bono de su
   * característica. Hay tantos físicos y tantos anímicos como niveles. Ficha, `PDs!W`,
   * `PDs!U129` (`bono*(1+W)`) y `PDs!AA185`.
   */
  bonosNaturales?: Record<string, number>;
  /**
   * A qué habilidades va cada ventaja de las que se aplican a una que elige el jugador:
   * `{ 'Apto en una materia (1)': ['Medicina'] }`. Cada habilidad es una vez que se toma la
   * ventaja. Ficha, pestaña Personalización, «Ventajas en Secundarias».
   */
  eleccionesVentajas?: Record<string, string[]>;

  ventajas: string[];
  desventajas: string[];
  /**
   * Las casillas de raza de la hoja (pestaña Personalización): Éxtasis sanguíneo del
   * Vetala, Sue'Aman del Ebudan, transformación y fase lunar del Tuan Dalyr, Cercanía con
   * El Dragón del Turak.
   */
  opcionesRaza?: OpcionesRaza;
  /**
   * Legados de Sangre. Se pagan con Puntos de Creación como las ventajas, pero además
   * dan **+1 al ajuste de nivel** por muchos que se tengan (Dominus Exxet, cap. 6).
   */
  legados?: string[];
  /**
   * Esferas metamágicas del Arcana Shepirah, por su posición en el árbol. La misma
   * habilidad está en varios sitios con costes distintos, así que lo que identifica una
   * elección es la posición, no el nombre.
   */
  metamagia?: string[];

  /**
   * Teorema de Magia con el que formula (Arcana Exxet, cap. 2). Sólo se puede usar uno.
   * Vacío o «General» es el sistema del manual básico.
   */
  teorema?: string;

  /**
   * Espíritu del Alma (Arcana Exxet, cap. 7). No es un personaje aparte: casi todos sus
   * valores salen de este, así que vive dentro de su ficha.
   */
  sheele?: EleccionesSheele;

  /**
   * Habilidades Esenciales (Core Exxet, cap. 6). Se compran con PD y algunas exigen un
   * mínimo de Gnosis; su efecto lo aplicáis vosotros, como con las ventajas.
   */
  habilidadesEsenciales?: string[];

  /** Conjuros aprendidos, por nombre. */
  conjuros: string[];
  /** Poderes psíquicos dominados, por nombre. */
  poderesPsiquicos: string[];

  /** Dominios del Ki: habilidades, Límites, Técnicas y artes marciales. */
  ki: EleccionesKi;

  /**
   * Bonos especiales por habilidad, escritos a mano. En la ficha original es la columna
   * «Esp.»: no hay regla que los derive, el jugador anota ahí lo que le den sus
   * capacidades raciales, ventajas, Elan o poderes.
   */
  bonosEspeciales: Record<string, number>;

  /** Equipo llevado puesto. */
  equipo: {
    armadura: PiezaEquipada[];
    armas: ArmaEquipada[];
    /** Mochila: lo que lleva encima y no da números de combate. */
    objetos?: ObjetoLlevado[];
    /** Bolsa. Se guarda por tipo de moneda, como en el manual. */
    dinero?: Bolsa;
  };

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

  /**
   * Todo lo que no se calcula. Un juego de rol se juega interpretando, y esa parte no la
   * decide la aplicación: aquí sólo se guarda lo que la mesa escriba.
   */
  trasfondo: {
    apariencia?: string;
    personalidad?: string;
    motivacion?: string;
    historia?: string;
    particularidades?: string;
    contactos?: string;
    equipoLibre?: string;
    dinero?: string;
  };

  /**
   * Puntos de Experiencia acumulados. Los reparte el Director de Juego, no los deduce
   * ninguna regla: aquí sólo se guardan y se comparan con lo que pide la tabla.
   */
  experiencia?: number;

  notas?: string;
}

/**
 * Adapta fichas guardadas con el modelo antiguo (una sola `categoria` y `nivel`, y PD
 * sueltos) al modelo multiclase. Así no se pierde nada de lo ya creado.
 */
export function migrarPersonaje(p: Personaje & { categoria?: string; nivel?: number }): Personaje {
  // El bloque de Ki llegó con el Dominus Exxet: las fichas anteriores no lo traen.
  const conKi: Personaje = p.ki ? p : { ...p, ki: { ...ELECCIONES_KI_VACIAS } };
  if (Array.isArray(conKi.categorias) && conKi.categorias.length > 0) return conKi;
  const { categoria, nivel, ...resto } = conKi as Personaje & { categoria?: string; nivel?: number };
  return {
    ...(resto as Personaje),
    categorias: [{ categoria: categoria ?? 'Novel', nivel: nivel ?? 1 }],
  };
}

/** Categoría en la que está el personaje ahora mismo. */
export function categoriaActual(p: Personaje): string {
  const activas = p.categorias.filter((c) => c.categoria && c.nivel > 0);
  return activas[activas.length - 1]?.categoria ?? p.categorias[0]?.categoria ?? 'Novel';
}

/** Nivel total: la suma de los niveles de todas sus categorías. */
export function nivelTotalDe(p: Personaje): number {
  return p.categorias.reduce((t, c) => t + (c.nivel > 0 ? c.nivel : 0), 0);
}

/** Una línea del inventario: qué objeto del catálogo, cuántos y qué anota el jugador. */
export interface ObjetoLlevado {
  objeto: string;
  cantidad?: number;
  nota?: string;
}

/** Monedas de oro, plata y cobre. Core Exxet, cap. VIII: 1 MO = 100 MP = 1000 MC. */
export interface Bolsa {
  MO?: number;
  MP?: number;
  MC?: number;
}

export const MC_POR_MONEDA: Record<keyof Bolsa, number> = { MO: 1000, MP: 10, MC: 1 };

/** Pasa una bolsa a monedas de cobre, que es la unidad con la que se suma todo. */
export function bolsaEnCobre(bolsa: Bolsa | undefined): number {
  if (!bolsa) return 0;
  return (bolsa.MO ?? 0) * 1000 + (bolsa.MP ?? 0) * 10 + (bolsa.MC ?? 0);
}

/**
 * Escribe una cantidad de cobre como la escribiría el manual: «2 MO 5 MP 3 MC».
 * Se omiten las monedas que no hacen falta, y 0 se muestra como «0 MC».
 */
export function enMonedas(cobre: number): string {
  const signo = cobre < 0 ? '−' : '';
  let resto = Math.abs(Math.round(cobre));
  const partes: string[] = [];
  for (const moneda of ['MO', 'MP', 'MC'] as const) {
    const valor = MC_POR_MONEDA[moneda];
    const n = Math.trunc(resto / valor);
    if (n > 0) partes.push(`${n} ${moneda}`);
    resto -= n * valor;
  }
  return signo + (partes.length > 0 ? partes.join(' ') : '0 MC');
}

export function personajeVacio(id: string): Personaje {
  return {
    id,
    propietario: null,
    campanaId: null,
    actualizadoEn: new Date().toISOString(),
    nombre: '',
    // Una ficha en blanco no trae nada elegido ni ninguna característica puesta: en el
    // Excel las casillas están vacías y todo lo derivado sale a 0.
    raza: '',
    categorias: [{ categoria: '', nivel: 1 }],
    caracteristicas: { AGI: 0, CON: 0, DES: 0, FUE: 0, INT: 0, PER: 0, POD: 0, VOL: 0 },
    pdInvertidos: {},
    habilidadesNaturales: [],
    bonificadorNatural: {},
    ventajas: [],
    desventajas: [],
    conjuros: [],
    poderesPsiquicos: [],
    ki: { ...ELECCIONES_KI_VACIAS },
    bonosEspeciales: {},
    equipo: { armadura: [], armas: [] },
    estado: {},
    manuales: {},
    trasfondo: {},
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

/**
 * Lo que lleva encima, ya sumado. **No** entra en ningún cálculo de reglas: el manual no
 * pone tope de carga, así que esto es una ayuda de mesa, no un límite que imponga la
 * aplicación. El peso de la armadura y las armas equipadas no se cuenta aquí, porque esas
 * tablas no traen peso.
 */
export interface ResumenInventario {
  lineas: {
    objeto: string;
    cantidad: number;
    nota?: string;
    /** Lo que dice el manual, «5 MP». Vacío si el objeto no está en el catálogo. */
    coste: string;
    /** Coste de la línea entera en monedas de cobre, ya multiplicado por la cantidad. */
    cobre: number;
    peso: number;
    disponibilidad: string;
    /** true si el objeto ya no existe en el catálogo: se avisa en vez de perderlo. */
    desconocido: boolean;
  }[];
  peso: number;
  /** Valor del inventario en monedas de cobre. */
  valor: number;
  /** Dinero en la bolsa, en monedas de cobre. */
  dinero: number;
}

/**
 * Lo que puede cargar el personaje, y lo que lleva.
 *
 * Ánima **no impone** un tope de carga: la Tabla de Fuerza dice cuánto levanta alguien de
 * ese Índice, y qué pasa cuando se pasa lo decide la mesa. Por eso aquí no hay
 * penalizadores automáticos, sólo las tres cifras de la ficha y el peso de la mochila para
 * poder compararlas de un vistazo.
 */
export interface CargaCalculada {
  /** Índice de Peso: la Fuerza total, más lo que se anote a mano. */
  indice: number;
  /** Peso natural: lo que carga sin esfuerzo, en kilos. Tabla de Fuerza. */
  natural: number;
  /** Peso máximo: lo que llega a levantar, en kilos. Tabla de Fuerza. */
  maximo: number;
  /** Lo que pesa la mochila. Sólo los objetos: el manual no da peso a armas ni armaduras. */
  equipo: number;
}

/**
 * La experiencia, comparada con lo que pide la tabla para el siguiente nivel.
 *
 * Quién da los puntos y cuándo es cosa del Director de Juego; lo único que hace la
 * aplicación es decir cuánto falta.
 */
export interface ExperienciaCalculada {
  /** Los que tiene ahora. */
  actual: number;
  /** Los que pide la tabla para pasar al siguiente nivel, con el ajuste de nivel puesto. */
  siguienteNivel: number;
  /** Lo que falta. Cero si ya llega. */
  faltan: number;
  /** true cuando ya tiene suficientes para subir. */
  puedeSubir: boolean;
}

export interface FichaCalculada {
  /** Nivel real del personaje. Es el que da los bonos de categoría. */
  nivel: number;
  /**
   * Ajuste de nivel de la raza. **No** suma a los bonos: sólo encarece la experiencia
   * necesaria para subir. Ficha: `Nivel_Total` vale 1 en Meirmeister pese al «1 + 1».
   */
  ajusteNivel: number;
  /** Nivel que se usa contra la tabla de experiencia. */
  nivelParaExperiencia: number;
  pdTotales: number;
  multiclase: ResumenMulticlase;
  caracteristicas: Record<Caracteristica, { total: number; bono: number; base: number; raza: number }>;
  puntosVida: ValorDerivado;
  cansancio: ValorDerivado;
  presencia: ValorDerivado;
  resistencias: Record<Resistencia, ValorDerivado>;
  zeon: ValorDerivado;
  act: ValorDerivado;
  nivelMagia: ValorDerivado;
  /** Esferas del Arcana Shepirah y lo que consumen del Nivel de Magia. */
  metamagia: { esferas: string[]; gastado: number; disponible: number };
  ki: FichaKi;
  /** Convocar, Controlar, Atar y Desconvocar: las cuatro habilidades de invocación. */
  invocacion: Record<ClaveInvocacion, ValorDerivado>;
  proyeccionMagica: ValorDerivado;
  proyeccionPsiquica: ValorDerivado;
  potencialPsiquico: ValorDerivado;
  /** Cargas Vitales: las que dan los niveles más las compradas. `PDs!AA111`. */
  cv: ValorDerivado;
  /** Zeón que se recupera al día. `Místicos!J9`. */
  regeneracionZeonica: ValorDerivado;
  /** Nivel de Regeneración y lo que supone. `Principal!J11` y `K11`. */
  regeneracion: ValorDerivado;
  regeneracionTexto: string;
  /** Tipo de Movimiento y lo que avanza por asalto. `Tablas!U58` y `Principal!K17`. */
  movimiento: ValorDerivado;
  movimientoTexto: string;
  inventario: ResumenInventario;
  /** Índice de Peso y lo que carga. */
  carga: CargaCalculada;
  /** Puntos de Experiencia frente a lo que pide la tabla. */
  experiencia: ExperienciaCalculada;
  secundarias: Record<string, ValorDerivado>;
  /**
   * Las secundarias que no se pueden usar sin formación y que el personaje no tiene: la hoja
   * enseña «-». El número de `secundarias` se sigue calculando, por si la mesa lo quiere.
   */
  secundariasSinUso: string[];
  /** Lo que aportan las ventajas y desventajas elegidas. */
  efectos: EfectosAplicados;
  puntosCreacion: { disponibles: number; gastados: number; ganados: number };
  combate: {
    HAtaque: ValorDerivado;
    HParada: ValorDerivado;
    HEsquiva: ValorDerivado;
    llevarArmadura: ValorDerivado;
    /** Turno sin arma en la mano: el natural, sin el modificador de ninguna. */
    turnoNatural: ValorDerivado;
    /**
     * Turno con las manos vacías, que es el que la ficha enseña como «el» Turno del
     * personaje: el natural más los +20 de la fila «Desarmado». Nadie va por ahí sin poder
     * pegar, así que es el número que se usa cuando no hay arma equipada.
     */
    turnoSinArma: number;
    tamano: number;
    proteccion: ProteccionTotal;
    armas: HabilidadesArma[];
  };
  pdGastados: { combate: number; misticas: number; psiquicas: number; secundarias: number; total: number };
  limites: { combate: number; misticas: number; psiquicas: number };
  avisos: Aviso[];
}

/** Campo de la categoría que da el coste de desarrollo de cada grupo de secundarias. */
/**
 * Cómo se llama una secundaria en las columnas de la tabla de categorías.
 *
 * Las columnas van sin tildes ni espacios —`bonPersuasion`, `costeTasacion`— y cuatro
 * están abreviadas. Antes se buscaba el nombre tal cual, sin quitar las tildes, y ni
 * «Persuasión» ni «Resistencia al Dolor» encontraban su columna: el +5 y el +10 del
 * Paladín Oscuro no se sumaban, y los costes propios de cada categoría —Frialdad a 1,
 * Proezas de Fuerza a 3…— se ignoraban por completo.
 */
const ABREVIATURAS_SECUNDARIAS: Record<string, string> = {
  'Proezas de Fuerza': 'PFuerza',
  'Resistencia al Dolor': 'ResDolor',
  'Trucos de Manos': 'TManos',
  'Valoración Mágica': 'VMagica',
};

export function columnaDeSecundaria(nombre: string): string {
  return (
    ABREVIATURAS_SECUNDARIAS[nombre] ??
    nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '')
  );
}

const CAMPO_COSTE: Record<GrupoSecundarias, string> = {
  'Atléticas': 'costeAtleticas',
  'Sociales': 'costeSociales',
  'Perceptivas': 'costePerceptivas',
  'Intelectuales': 'costeIntelectuales',
  'Vigor': 'costeVigor',
  'Subterfugio': 'costeSubterfugio',
  'Creativas': 'costeCreativas',
};

/** Puntos comprados con PD: el coste 0 significa que la categoría no permite la habilidad. */
function truncarPD(pd: number, coste: number): number {
  return coste > 0 ? Math.trunc(pd / coste) : 0;
}

/**
 * El Ki y la Acumulación se compran **por característica**, así que sus claves son
 * `KiAGI`, `AcumKiPOD`… y hay que enumerarlas todas para que el gasto cuente dentro del
 * límite de habilidades de combate.
 */
const CLAVES_COMBATE = [
  'HAtaque', 'HParada', 'HEsquiva', 'LlevarArmadura', 'CM',
  ...CARACTERISTICAS_KI.map((c) => `Ki${c}`),
  ...CARACTERISTICAS_KI.map((c) => `AcumKi${c}`),
];
const CLAVES_MISTICAS = [
  'Zeon', 'ACT', 'MultiploRegeneracion', 'ProyeccionMagica', 'NivelMagia',
  'Convocar', 'Controlar', 'Atar', 'Desconvocar',
];

/**
 * Las cuatro habilidades de invocación. Core Exxet, cap. 4: Convocar, Atar y Desconvocar
 * dependen del Poder; Dominar —«Controlar» en la ficha de la comunidad— de la Voluntad.
 */
export const INVOCACION = [
  { clave: 'Convocar', nombre: 'Convocar', coste: 'costeConvocar', caracteristica: 'POD' },
  { clave: 'Controlar', nombre: 'Controlar', coste: 'costeControlar', caracteristica: 'VOL' },
  { clave: 'Atar', nombre: 'Atar', coste: 'costeAtar', caracteristica: 'POD' },
  { clave: 'Desconvocar', nombre: 'Desconvocar', coste: 'costeDesconvocar', caracteristica: 'POD' },
] as const satisfies readonly {
  clave: string;
  nombre: string;
  coste: string;
  caracteristica: Caracteristica;
}[];

export type ClaveInvocacion = (typeof INVOCACION)[number]['clave'];
const CLAVES_PSIQUICAS = ['CV', 'ProyeccionPsiquica'];

/** Contexto de datos que necesita el cálculo. Se carga una vez y se reutiliza. */
export interface DatosCalculo {
  raza: Raza | undefined;
  /** La categoría actual, la que manda para costes y límites. */
  categoria: Categoria | undefined;
  /** Todas las categorías, para poder resolver el multiclase. */
  categorias: Categoria[];
  tablas: TablasBase;
  armas: Arma[];
  armaduras: Armadura[];
  /** Las habilidades secundarias vigentes en esta mesa, con las de la casa si las hay. */
  secundarias: DefinicionSecundaria[];
  /** Lista de precios del manual, para el inventario. */
  objetos: Objeto[];
  ventajas: Ventaja[];
  habilidadesKi: HabilidadKiCatalogo[];
  artesMarciales: EntradaTabla[];
  arsMagnus: EntradaTabla[];
  legadosSangre: LegadoSangre[];
  metamagia: EsferaMetamagica[];
  efectosTecnica: EfectoTecnica[];
  tiposEfectoTecnica: TipoEfectoTecnica[];
}

/** Lo que cuesta un bloque de Nivel de Magia, igual para todas las categorías. */
export const COSTE_NIVEL_MAGIA = 5;

/**
 * Puntos de Creación: 3 de partida, más los que den las desventajas, con tope de 3.
 * Core Exxet, cap. 1.
 *
 * Se quedan aquí como referencia de lo que dice el manual, pero **el cálculo ya no los
 * usa**: las cifras vigentes salen de `reglamento.creacion()`, porque una mesa puede
 * decidir empezar con más. Los valores por defecto de allí son exactamente estos.
 */
export const PC_INICIALES = 3;
export const PC_MAXIMO_POR_DESVENTAJAS = 3;

export async function cargarDatosCalculo(
  personaje: Personaje,
  catalogo: Catalogo,
): Promise<DatosCalculo> {
  const [
    raza,
    categorias,
    tablas,
    armas,
    armaduras,
    yelmos,
    objetos,
    secundarias,
    ventajas,
    habilidadesKi,
    artesMarciales,
    arsMagnus,
    legadosSangre,
    metamagia,
    efectosTecnica,
    tiposEfectoTecnica,
  ] = await Promise.all([
    catalogo.buscar('razas', personaje.raza),
    catalogo.obtener('categorias'),
    catalogo.tablasBase(),
    catalogo.obtener('armas'),
    catalogo.obtener('armaduras'),
    catalogo.obtener('yelmos'),
    catalogo.obtener('objetos'),
    catalogo.obtener('secundarias'),
    catalogo.obtener('ventajas'),
    catalogo.obtener('habilidadesKi'),
    catalogo.obtener('artesMarciales'),
    catalogo.obtener('arsMagnus'),
    catalogo.obtener('legadosSangre'),
    catalogo.obtener('metamagia'),
    catalogo.obtener('efectosTecnica'),
    catalogo.obtener('tiposEfectoTecnica'),
  ]);
  const actual = categoriaActual(personaje);
  return {
    raza,
    categoria: categorias.find((c) => c.categoria === actual),
    categorias,
    tablas,
    armas,
    // Los yelmos son piezas de armadura como las demás, sólo que en otra tabla del
    // Excel. Se juntan aquí para que el selector de armadura los ofrezca igual.
    armaduras: [
      ...armaduras,
      ...yelmos.map(({ yelmo, ...resto }) => ({ ...resto, armadura: yelmo, esYelmo: true })),
    ],
    objetos,
    secundarias: secundarias.map(secundariaDeCatalogo),
    ventajas,
    habilidadesKi,
    artesMarciales,
    arsMagnus,
    legadosSangre,
    metamagia,
    efectosTecnica,
    tiposEfectoTecnica,
  };
}

/**
 * Suma la mochila. Un objeto que ya no esté en el catálogo —porque la mesa desactivó el
 * paquete que lo traía— **no se borra**: se marca como desconocido y se sigue viendo.
 */
export function resumirInventario(
  personaje: Personaje,
  catalogo: Objeto[],
): ResumenInventario {
  const porNombre = new Map(catalogo.map((o) => [o.objeto, o]));
  const lineas = (personaje.equipo.objetos ?? []).map((llevado) => {
    const datos = porNombre.get(llevado.objeto);
    const cantidad = Math.max(0, llevado.cantidad ?? 1);
    return {
      objeto: llevado.objeto,
      cantidad,
      nota: llevado.nota,
      coste: datos?.coste ?? '',
      cobre: (datos?.costeMC ?? 0) * cantidad,
      peso: (datos?.peso ?? 0) * cantidad,
      disponibilidad: datos?.disponibilidad ?? '',
      desconocido: datos === undefined,
    };
  });
  return {
    lineas,
    // Los pesos del manual llevan un decimal («0,25 kg»), así que se redondea al sumar
    // para no arrastrar el error del coma flotante.
    peso: Math.round(lineas.reduce((t, l) => t + l.peso, 0) * 100) / 100,
    valor: lineas.reduce((t, l) => t + l.cobre, 0),
    dinero: bolsaEnCobre(personaje.equipo.dinero),
  };
}

function bonoDe(valor: number, tablas: TablasBase): number {
  if (valor < 1) return 0;
  const fila = tablas.bonoCaracteristica.find((f) => f.valor === Math.min(valor, 20));
  return fila?.bono ?? 0;
}

/**
 * Valor de la tabla 55 para una característica. Como en la hoja, un 0 da 0:
 * `IF(POD=0, 0, VLOOKUP(POD, Tabla_ValoresBase, 2))`.
 */
function deTabla55(valor: number, tablas: TablasBase, columna: 'PV' | 'ACT'): number {
  if (valor < 1) return 0;
  const fila = tablas.valoresBase.find((f) => f.valor === Math.min(valor, 20));
  return fila?.[columna] ?? 0;
}

const pvBase = (valor: number, tablas: TablasBase) => deTabla55(valor, tablas, 'PV');
const actBase = (valor: number, tablas: TablasBase) => deTabla55(valor, tablas, 'ACT');

/** Calcula la ficha completa. Función pura: mismos datos, mismo resultado. */
export function calcular(
  personaje: Personaje,
  datos: DatosCalculo,
  reglamento: Reglamento = REGLAMENTO_OFICIAL,
): FichaCalculada {
  const { categoria, tablas } = datos;
  // La fila de la raza con lo que depende del personaje: sexo, Éxtasis sanguíneo,
  // Sue'Aman, transformación, Cercanía con El Dragón…
  const raza = razaDelPersonaje(datos.raza, personaje.sexo, personaje.opcionesRaza);
  const avisos: Aviso[] = avisosRaza(raza, personaje.opcionesRaza).map((mensaje) => ({
    gravedad: 'aviso' as const,
    mensaje,
  }));
  // Una mesa puede añadir secundarias propias, así que la lista buena es la del catálogo.
  // Si viene vacía —catálogo sin cargar— se usan las del manual para no dejar la ficha coja.
  const secundarias_ = datos.secundarias.length > 0 ? datos.secundarias : [...SECUNDARIAS];

  if (!raza) avisos.push({ gravedad: 'error', mensaje: `Raza desconocida: "${personaje.raza}".` });
  if (!categoria)
    avisos.push({
      gravedad: 'error',
      mensaje: `Categoría desconocida: "${categoriaActual(personaje)}".`,
    });

  // Efectos de ventajas y desventajas, antes de nada: modifican características.
  const efectos = acumularEfectos(
    [...personaje.ventajas, ...personaje.desventajas],
    personaje.eleccionesVentajas ?? {},
  );
  /**
   * Los bonos de la tabla de categorías son **por nivel**: cada categoría da el suyo por cada
   * nivel hecho en ella. Ficha, `Tablas!E225` (`Bonos_Cat_Base`): SUMPRODUCT de los niveles
   * por el bono de cada categoría.
   */
  const bonoPorNiveles = (campo: string) =>
    acumularPorNivel(personaje.categorias, datos.categorias, campo);

  // Ser Legado encarece la experiencia: +1 sea cual sea el número de Legados que tengas.
  const esLegado = (personaje.legados ?? []).length > 0;
  const ajusteNivel = (raza?.ajusteNivel ?? 0) + (esLegado ? 1 : 0);
  const multiclase = resumirMulticlase(
    personaje.categorias,
    datos.categorias,
    personaje.ventajas.includes('Versátil'),
  );
  const nivel = multiclase.nivelTotal;
  const nivelParaExperiencia = nivel + ajusteNivel;

  /*
   * Experiencia.
   *
   * La tabla del manual se lee por filas: la fila es el nivel que tienes ahora y la columna
   * es tu ajuste de nivel. La primera casilla de cada fila es el número de nivel, así que la
   * columna del ajuste 0 es la 1. Verificado contra Meirmeister: nivel 1 con ajuste 1 pide
   * 125 PX, que es lo que muestra su ficha.
   *
   * Los puntos los da el Director de Juego. La aplicación no sube de nivel sola —eso es una
   * decisión de la mesa, no una cuenta— y se limita a decir cuánto falta.
   */
  const filasExperiencia = tablas.experienciaNecesaria?.filas ?? [];
  const filaExperiencia = filasExperiencia.find((f) => f[0] === nivel) ?? filasExperiencia[0];
  const experienciaSiguiente = Number(filaExperiencia?.[Math.max(0, ajusteNivel) + 1] ?? 0);
  const experienciaActual = Math.max(0, personaje.experiencia ?? 0);
  const experiencia: ExperienciaCalculada = {
    actual: experienciaActual,
    siguienteNivel: experienciaSiguiente,
    faltan: Math.max(0, experienciaSiguiente - experienciaActual),
    puedeSubir: experienciaSiguiente > 0 && experienciaActual >= experienciaSiguiente,
  };
  // 600 al crear el personaje y +100 por nivel; los cambios de categoría se descuentan.
  const pdTotales = multiclase.pdDisponibles;
  for (const texto of multiclase.avisos) avisos.push({ gravedad: 'aviso', mensaje: texto });

  // Características: base + raza, con tope 20 y suelo 0.
  const caracteristicas = {} as FichaCalculada['caracteristicas'];
  for (const c of CARACTERISTICAS) {
    const base = personaje.caracteristicas[c] ?? 0;
    const modRaza = (raza?.[c] as number | undefined) ?? 0;
    const modVentajas = efectos.caracteristicas[c] ?? 0;
    const total = Math.min(20, Math.max(0, base + modRaza + modVentajas));
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
      CONx10: caracteristicas.CON.total * 10,
      // Cada categoría aporta sus PV por los niveles hechos en ella.
      pvCategoria: acumularPorNivel(personaje.categorias, datos.categorias, 'PV') + efectos.pvPorNivel * nivel,
      nivelTotal: 1,
      CON: caracteristicas.CON.total,
      bonoCON: caracteristicas.CON.bono,
    }),
  );

  /*
   * Modificador a toda acción: el `Mod_ATA` de la hoja (`Combate!AD15`). Lo forman:
   * - el Cansancio (`AU5`): con 4 o menos de Cansancio actual, −10, −20, −40 y −80, y −120 a
   *   cero. Exhausto lo dobla; Inmunidad al dolor y al cansancio o Eliminación de
   *   penalizadores lo dejan a la mitad (a un tercio las dos juntas), y Esencia de Vacío lo
   *   anula (`AV5`);
   * - Endeble: −30 con menos de un tercio de los PV (`AY5`);
   * - y lo que se anote a mano en «TodaAccion», la casilla «Esp.» de la hoja (`AD14`).
   * Resta a las habilidades de combate, a las secundarias y a las proyecciones, y la mitad
   * al Turno y al ACT.
   */
  const cansancioActual = personaje.estado?.cansancioActual;
  const penalizadorCansancio =
    cansancioActual === undefined || cansancioActual > 4
      ? 0
      : cansancioActual <= 0 ? -120 : -10 * 2 ** (4 - cansancioActual);
  const tieneKi = (h: string) => (personaje.ki?.habilidades ?? []).includes(h);
  const alivioVentaja = personaje.ventajas.includes('Inm. al dolor y al cansancio');
  const alivioKi = tieneKi('Eliminación de penalizadores');
  const factorCansancio = tieneKi('Esencia de Vacío')
    ? 0
    : personaje.desventajas.includes('Exhausto')
      ? (alivioVentaja || alivioKi ? 1 : 2)
      : alivioVentaja && alivioKi ? 1 / 3 : alivioVentaja || alivioKi ? 1 / 2 : 1;
  const pvActuales = personaje.estado?.pvActuales;
  const penalizadorEndeble =
    personaje.desventajas.includes('Endeble') && pvActuales !== undefined && pvActuales < puntosVida.valor / 3
      ? -30
      : 0;
  const modificadorTodaAccion =
    Math.trunc(penalizadorCansancio * factorCansancio) + penalizadorEndeble +
    (personaje.bonosEspeciales['TodaAccion'] ?? 0);
  /** La mitad, sólo si resta: así lo aplica la hoja al Turno y al ACT. */
  const mitadSiResta = modificadorTodaAccion < 0 ? Math.trunc(modificadorTodaAccion / 2) : 0;

  const cansancio = derivar(
    'cansancio',
    aplicar('cansancio', {
      CON: caracteristicas.CON.total,
      cansancioRaza: (raza?.cansancio ?? 0) + efectos.cansancio,
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
        especial: efectos.resistencias[r] ?? 0,
        factor: efectos.factorResistencia[r] ?? 1,
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
      zeonCategoria:
        acumularPorNivel(personaje.categorias, datos.categorias, 'bonoZeon') + efectos.zeonPorNivel * nivel,
      nivelTotal: 1,
    }) + (personaje.bonosEspeciales['Zeon'] ?? 0),
  );

  const costeACT = Number(categoria?.costeACT ?? 0);
  const base = actBase(caracteristicas.POD.total, tablas);
  const act = derivar(
    'act',
    Math.max(
      0,
      (costeACT > 0
        ? aplicar('act', { actBasePorPOD: base, pd: personaje.pdInvertidos['ACT'] ?? 0, coste: costeACT })
        : base) + (personaje.bonosEspeciales['ACT'] ?? 0) + mitadSiResta,
    ),
  );

  // Convocar, Controlar, Atar y Desconvocar. Son místicas, así que no llevan el −30 de
  // habilidad sin desarrollar: con 0 PD ya valen el bono de la característica.
  const invocacion = {} as Record<ClaveInvocacion, ValorDerivado>;
  for (const def of INVOCACION) {
    // Coste 0 significa que la categoría no permite desarrollarla: los PD no compran nada,
    // pero el bono de la característica se tiene igual.
    const coste = Number(categoria?.[def.coste] ?? 0);
    invocacion[def.clave] = derivar(
      def.clave,
      aplicar('habilidadInvocacion', {
        pd: coste > 0 ? personaje.pdInvertidos[def.clave] ?? 0 : 0,
        coste: coste || 1,
        bonoCaracteristica: caracteristicas[def.caracteristica].bono,
        bonoCategoria: bonoPorNiveles(`bon${def.clave}`),
      }) + (personaje.bonosEspeciales[def.clave] ?? 0) + Math.min(0, modificadorTodaAccion),
    );
  }

  // Proyecciones: primarias, así que sin PD valen el bono de Destreza y nada más. Con
  // coste 0 la categoría no deja comprarlas, pero el bono se tiene igual.
  const proyeccion = (clave: 'ProyeccionMagica' | 'ProyeccionPsiquica', columna: string) => {
    const coste = Number(categoria?.[columna] ?? 0);
    return derivar(
      clave,
      aplicar('proyeccion', {
        pd: coste > 0 ? personaje.pdInvertidos[clave] ?? 0 : 0,
        coste: coste || 1,
        bonoDES: caracteristicas.DES.bono,
      }) + (personaje.bonosEspeciales[clave] ?? 0) + modificadorTodaAccion,
    );
  };
  const proyeccionMagica = proyeccion('ProyeccionMagica', 'costeProyeccionMagica');
  const proyeccionPsiquica = proyeccion('ProyeccionPsiquica', 'costeProyeccionPsiquica');
  const tablaPotencial = (tablas as { potencialPsiquico?: { VOL: number; potencial: number }[] }).potencialPsiquico ?? [];
  const vol = caracteristicas.VOL.total;
  // La tabla llega hasta VOL 20; por encima vale la última fila.
  const filaPotencial =
    tablaPotencial.find((f) => f.VOL === vol) ??
    (vol > 0 ? [...tablaPotencial].reverse().find((f) => f.VOL <= vol) : undefined);
  const potencialPsiquico = derivar(
    'PotencialPsiquico',
    aplicar('potencialPsiquico', {
      potencialPorVOL: filaPotencial?.potencial ?? 0,
      especial: personaje.bonosEspeciales['PotencialPsiquico'] ?? 0,
    }) + Math.min(0, modificadorTodaAccion), // Psíquicos!H11: + MIN(0, Mod_ATA)
  );

  /*
   * Cargas Vitales. `PDs!X111`: la primera categoría da 1 al empezar y otra cada tantos
   * niveles como diga su columna «nvPorCV»; las demás, una cada tantos niveles. Más las
   * compradas con PD (`V111`) y lo que se anote a mano (`Z111`).
   */
  const nvPorCV = (nombre: string) =>
    Number(datos.categorias.find((c) => c.categoria === nombre)?.nvPorCV ?? 0) || 1;
  let cvPorNiveles = 0;
  if (nivel > 0) {
    personaje.categorias.slice(0, 5).forEach((c, i) => {
      if (!c.categoria || !(c.nivel > 0)) return;
      const empieza = i === 0 || (i === 1 && !((personaje.categorias[0]?.nivel ?? 0) > 0));
      cvPorNiveles += empieza ? 1 + (c.nivel - 1) / nvPorCV(c.categoria) : c.nivel / nvPorCV(c.categoria);
    });
  }
  const cv = derivar(
    'CV',
    Math.trunc(cvPorNiveles) +
      truncarPD(personaje.pdInvertidos['CV'] ?? 0, Number(categoria?.costeCV ?? 0)) +
      (personaje.bonosEspeciales['CV'] ?? 0),
  );

  /*
   * Regeneración. `Principal!J11`: el nivel que da la CON en la Tabla_Regen, más el de la
   * raza y el de las ventajas, hasta 20. Lenta curación deja lo que se recupera a la mitad
   * (`Tablas!E40`).
   */
  const tablaRegen = tablas.regeneracion;
  const conTotal = caracteristicas.CON.total;
  const regenPorCON =
    conTotal > 0 ? [...(tablaRegen?.porCON ?? [])].reverse().find(([c]) => c <= conTotal)?.[1] ?? 0 : 0;
  const regeneracion = derivar(
    'Regeneracion',
    Math.min(
      20,
      regenPorCON + Number(raza?.regeneracion ?? 0) + efectos.regeneracion +
        (personaje.bonosEspeciales['Regeneracion'] ?? 0),
    ),
  );
  const filaRegen = tablaRegen?.niveles.find((f) => f.nivel === regeneracion.valor);
  const lentaCuracion = personaje.desventajas.includes('Lenta curación');
  const regeneracionTexto = !filaRegen || filaRegen.cantidad === null
    ? (filaRegen?.unidad ?? '')
    : `${filaRegen.cantidad * (lentaCuracion ? 0.5 : 1)} ${filaRegen.unidad.trim()} · ` +
      `penalizadores ${filaRegen.reduccion}` + (filaRegen.especial ? ` · ${filaRegen.especial}` : '');

  const inventario = resumirInventario(personaje, datos.objetos);

  /*
   * Índice de Peso y lo que carga.
   *
   * El Índice es la Fuerza total; la Tabla de Fuerza (Core Exxet, Tabla 8) la convierte en
   * los kilos que se llevan sin esfuerzo y en los que se llegan a levantar. Verificado
   * contra la ficha de Meirmeister: FUE 12 → 350 kg naturales y 1.000 kg de máximo.
   *
   * La columna «Esp.» sirve también aquí, porque hay capacidades raciales y poderes que
   * suben el Índice sin tocar la Fuerza. Se acota a la tabla en vez de romperse: si algún
   * poder deja el Índice en 25, se coge la última fila que hay.
   */
  const filasFuerza = tablas.fuerza ?? [];
  const indicePeso = Math.max(
    0,
    caracteristicas.FUE.total + (personaje.bonosEspeciales['indicePeso'] ?? 0),
  );
  const filaFuerza =
    filasFuerza.find((f) => f.valor === indicePeso) ??
    (indicePeso > 0 ? filasFuerza[filasFuerza.length - 1] : undefined);
  const carga: CargaCalculada = {
    indice: indicePeso,
    natural: filaFuerza?.pesoKg ?? 0,
    maximo: filaFuerza?.pesoMaxKg ?? 0,
    equipo: inventario.peso,
  };

  // ── Combate: armadura primero, porque su penalizador afecta a casi todo ──
  const especial = (clave: string) => personaje.bonosEspeciales[clave] ?? 0;
  // «Sentido del combate» suma por nivel al bono de categoría, con tope conjunto de 50.
  const bonoCategoriaCombate = (clave: 'HAtaque' | 'HParada' | 'HEsquiva', base: number) =>
    Math.min(50, base + (efectos.bonoCategoria[clave] ?? 0) * nivel);
  const llevarArmaduraBase =
    truncarPD(personaje.pdInvertidos['LlevarArmadura'] ?? 0, Number(categoria?.costeLlevarArmadura ?? 2)) +
    caracteristicas.FUE.bono +
    bonoPorNiveles('bonoLlevarArmadura') +
    efectos.llevarArmaduraPorNivel * nivel +
    especial('LlevarArmadura');
  const llevarArmadura = derivar('LlevarArmadura', llevarArmaduraBase);

  // Las ventajas de armadura (natural, mística), las escamas de la raza y la Armadura de
  // energía del Ki son cada una una capa más, no un suplemento (`Combate!AY21:BE27`). Del
  // Ki la hoja sólo cuenta la Armadura de energía (2 contra Energía) y la arcana (4).
  const kiHabilidades = personaje.ki?.habilidades ?? [];
  const armaduraKi = Math.max(
    kiHabilidades.includes('Armadura de energía') ? 2 : 0,
    kiHabilidades.includes('Armadura de energía arcana') ? 4 : 0,
  );
  const proteccion = combinarArmadura(
    personaje.equipo.armadura,
    datos.armaduras,
    llevarArmadura.valor,
    [efectos.TA, armaduraRacial(raza, personaje.opcionesRaza), { ENE: armaduraKi }],
  );
  const penalizadorArmadura = proteccion.penalizadorNatural;

  /*
   * Tipo de Movimiento. `Principal!AQ20` y `Tablas!U58`: la Agilidad, +2 por Desplazamiento
   * rápido, menos la restricción de la armadura y lo que pese de más (+2 si pasa del peso
   * natural, +3 más si pasa del máximo, `Principal!L16`), entre 1 y 10. Por encima de 10
   * sólo se llega con Inhumanidad o Zen, que la aplicación no sabe: se anota en «Esp.».
   */
  const restriccionMovimiento =
    proteccion.restriccionMovimiento +
    (carga.natural > 0 && carga.equipo > carga.natural ? 2 : 0) +
    (carga.maximo > 0 && carga.equipo > carga.maximo ? 3 : 0);
  const movimiento = derivar(
    'Movimiento',
    Math.max(
      1,
      Math.min(10, caracteristicas.AGI.total + efectos.movimiento - restriccionMovimiento) +
        (personaje.bonosEspeciales['Movimiento'] ?? 0),
    ),
  );
  const movimientoTexto =
    (tablas.movimiento ?? []).find(([v]) => v === Math.min(20, movimiento.valor))?.[1] ?? '';

  /*
   * Habilidades secundarias, como las cuenta la hoja: `PDs!J129:AA179` y, encima, el
   * penalizador de la armadura de `Principal!O22:O73`.
   *
   * - Coste: el propio de la habilidad o el de su campo, el menor (`PDs!AL129`), menos lo
   *   que abaraten Apto en campo y Apto en una materia, entre 1 y 3 (`PDs!J129`).
   * - Bono: el de la característica, una vez más por cada Bonificador Natural, +10 por
   *   Habilidad Natural y +10 por Conocimiento de todas las materias, con tope 100 (`U129`).
   * - Categoría: su bono, más lo que den por nivel los Aprendizajes innatos (`V129`).
   * - Sin al menos 5 de base, −30; y las que piden formación, ni eso: «-» (`AA129`, `AA147`).
   */
  const secundarias: Record<string, ValorDerivado> = {};
  const secundariasSinUso: string[] = [];
  // Los Bonificadores Naturales del modelo antiguo cuentan como uno cada uno.
  const bonosNaturales: Record<string, number> = { ...(personaje.bonosNaturales ?? {}) };
  for (const n of [personaje.bonificadorNatural.fisica, personaje.bonificadorNatural.animica]) {
    if (n && bonosNaturales[n] === undefined) bonosNaturales[n] = 1;
  }
  const conocimientoTotal = efectos.conocimientoTotal ? 10 : 0;
  /** Sentidos agudos da 80 y no 50 a los Tuan Dalyr. `PDs!AD143`. */
  const bonoVentajas = (nombre: string) =>
    (efectos.bonoSecundaria[nombre] ?? 0) *
    (raza?.raza === 'Tuan Dalyr' && personaje.ventajas.includes('Sentidos agudos') &&
    (nombre === 'Advertir' || nombre === 'Buscar') ? 80 / 50 : 1);
  /** Lo que la armadura resta a cada una. `Principal!O22:O73` y `PDs!AA129:AA135`. */
  const penalizadorSecundaria = (def: DefinicionSecundaria) => {
    const natural =
      def.nombre === 'Nadar' ? proteccion.penalizadorNadar
      : def.nombre === 'Sigilo' ? proteccion.penalizadorSigilo
      : def.fisica ? penalizadorArmadura : 0;
    const percepcion = def.nombre === 'Advertir' || def.nombre === 'Buscar' ? proteccion.penalizadorPercepcion : 0;
    // No llegar al requerimiento castiga las Atléticas, que son la acción física pura.
    const accionFisica = def.grupo === 'Atléticas' ? proteccion.penalizadorAccionFisica : 0;
    return natural + percepcion + accionFisica;
  };

  for (const def of secundarias_) {
    const pd = personaje.pdInvertidos[def.nombre] ?? 0;
    const columna = columnaDeSecundaria(def.nombre);
    const costeCampo = Number(categoria?.[CAMPO_COSTE[def.grupo]] ?? 2) || 2;
    const costePropio = Number(categoria?.[`coste${columna}`]);
    const costeCategoria = costePropio > 0 ? Math.min(costePropio, costeCampo) : costeCampo;
    const coste = Math.max(
      1,
      Math.min(
        3,
        costeCategoria + (efectos.costeCampo[def.grupo] ?? 0) + (efectos.costeSecundaria[def.nombre] ?? 0),
      ),
    );
    const bono = caracteristicas[def.caracteristica].bono;
    const naturales = bonosNaturales[def.nombre] ?? 0;
    const habilidadNatural = personaje.habilidadesNaturales.includes(def.nombre) ? 1 : 0;
    const bonoTotal = Math.min(bono * (1 + naturales) + conocimientoTotal + 10 * habilidadNatural, 100);
    const aprendizaje =
      (efectos.aprendizajeSecundaria[def.nombre] ?? 0) + (efectos.aprendizajeCampo[def.grupo] ?? 0);
    const bonoCategoria = bonoPorNiveles(`bon${columna}`) + aprendizaje * nivel;
    const especialHabilidad = (personaje.bonosEspeciales[def.nombre] ?? 0) + bonoVentajas(def.nombre);

    if (def.requiereFormacion && conocimientoTotal === 0 && Math.trunc(pd / coste) < 5) {
      secundariasSinUso.push(def.nombre);
    }
    secundarias[def.nombre] = derivar(
      def.nombre,
      aplicar('habilidadSecundaria', {
        pd,
        coste,
        bonoCaracteristica: bono,
        bonosNaturales: naturales,
        habilidadNatural,
        conocimientoTotal,
        bonoCategoria,
        especial: especialHabilidad,
        // Lo de antes, para las fórmulas que una mesa haya reescrito con estas variables.
        mejoraNatural: bonoTotal - bono + especialHabilidad,
        penalizadorNoDesarrollada: -30,
        penalizadorNatural: penalizadorSecundaria(def),
        modificadorTodaAccion,
      }),
    );
  }

  // ── Habilidades primarias de combate y armas equipadas ──
  // No llegar al requerimiento de la armadura castiga también el combate: `PDs!AA25:AA27`
  // suman `Mod_Fisico`, que es `Combate!S16`, y el modificador a toda acción.
  const accionFisica = proteccion.penalizadorAccionFisica + modificadorTodaAccion;
  const HAtaque = derivar(
    'HAtaque',
    truncarPD(personaje.pdInvertidos['HAtaque'] ?? 0, Number(categoria?.costeHA ?? 2)) +
      caracteristicas.DES.bono +
      bonoCategoriaCombate('HAtaque', bonoPorNiveles('bonoHA')) +
      especial('HAtaque') +
      accionFisica,
  );
  const HParada = derivar(
    'HParada',
    truncarPD(personaje.pdInvertidos['HParada'] ?? 0, Number(categoria?.costeHP ?? 2)) +
      caracteristicas.DES.bono +
      bonoCategoriaCombate('HParada', bonoPorNiveles('bonoHP')) +
      especial('HParada') +
      accionFisica,
  );
  const HEsquiva = derivar(
    'HEsquiva',
    truncarPD(personaje.pdInvertidos['HEsquiva'] ?? 0, Number(categoria?.costeHE ?? 2)) +
      caracteristicas.AGI.bono +
      bonoCategoriaCombate('HEsquiva', bonoPorNiveles('bonoHE')) +
      especial('HEsquiva') +
      accionFisica,
  );

  // Tamaño = CON + FUE **base** (sin modificadores raciales, que ya van aparte)
  // − 1 si es mujer, + el modificador de tamaño de la raza, + Tamaño no natural (±5 como
  // mucho). Ficha, Principal!AO21, AQ21 y K6.
  // Un Jayán, o un Turak con rasgos Descomunales, puede llegar a 24 (y a «Grande»).
  const puedeSerGrande =
    raza?.raza === 'Jayán' ||
    (raza?.raza === 'Turak' && (personaje.opcionesRaza?.cercaniaDragon ?? []).includes('Descomunales'));
  const tamano = Math.min(
    puedeSerGrande ? 24 : 22,
    Math.max(
      1,
      caracteristicas.CON.base + caracteristicas.FUE.base - (personaje.sexo === 'Mujer' ? 1 : 0),
    ) + (raza?.tamano ?? 0) + efectos.tamano,
  );

  const turnoNatural = derivar(
    'turnoNatural',
    aplicar('turno', {
      // El Turak tiene −20 al turno base, y −10 más si es Grande (Tamaño de más de 22),
      // como el Jayán. Ficha, Principal!D24 y L6.
      turnoBase:
        20 +
        (raza?.raza === 'Turak' ? -20 : 0) +
        (puedeSerGrande && tamano > 22 ? -10 : 0) +
        efectos.turno +
        especial('turnoNatural') +
        mitadSiResta,
      bonoAGI: caracteristicas.AGI.bono,
      bonoDES: caracteristicas.DES.bono,
      turnoCategoria: bonoPorNiveles('turno'),
      penalizadorNatural: penalizadorArmadura,
      turnoArma: 0,
    }),
  );

  const ctxCombate: ContextoCombate = {
    bonoFUE: caracteristicas.FUE.bono,
    FUE: caracteristicas.FUE.total,
    tamano,
    turnoNatural: turnoNatural.valor,
    HAtaque: HAtaque.valor,
    HParada: HParada.valor,
    HEsquiva: HEsquiva.valor,
    tablas,
    bonos: Object.fromEntries(CARACTERISTICAS.map((c) => [c, caracteristicas[c].bono])),
    valores: Object.fromEntries(CARACTERISTICAS.map((c) => [c, caracteristicas[c].total])),
    presencia: presencia.valor,
    raza: raza?.raza,
    legados: personaje.legados,
    arsMagnus: personaje.ki?.arsMagnus,
    habilidadesKi: personaje.ki?.habilidades,
  };
  // El Turno con las manos vacías: +20 «Sin arma» (`Principal!D28`), que la hoja quita al
  // coger un arma y deja con un escudo (`Combate!AW40`).
  const turnoSinArma = turnoNatural.valor + 20;

  const armasCalculadas = personaje.equipo.armas.map((a) =>
    calcularArma(a, datos.armas, ctxCombate, reglamento),
  );
  for (const arma of armasCalculadas) {
    for (const texto of arma.avisos) avisos.push({ gravedad: 'aviso', mensaje: `${arma.arma}: ${texto}` });
  }

  // ── Nivel de Magia y Metamagia (Arcana Exxet, cap. 3) ──
  // El Nivel de Magia cuesta **5 PD fijos**, no lo que diga la categoría: en la ficha,
  // `PDs!L97:T97` vale 5 en todas las columnas y no hay columna «CosteNivelMagia».
  //
  // Ojo: la ficha suma además un Nivel de Magia **innato** (`PDs!W97`, que Mogunbun tiene
  // en 50 y Christopher en 40 sin haber invertido un solo PD) y el que da una ventaja por
  // nivel. Eso todavía no se deriva aquí; si tu personaje lo tiene, sobrescribe el valor
  // a mano como cualquier otro derivado.
  // El innato sale de la Inteligencia: `PDs!W97` busca `Principal!AQ15` en Tabla_NivelMagia.
  const intTotal = caracteristicas.INT.total;
  const nivelInnato =
    intTotal > 0
      ? Number([...((tablas.nivelMagia as [number, number][] | undefined) ?? [])].reverse().find(([i]) => Number(i) <= intTotal)?.[1] ?? 0)
      : 0;
  const nivelMagia = derivar(
    'NivelMagia',
    aplicar('nivelMagia', {
      pd: personaje.pdInvertidos['NivelMagia'] ?? 0,
      coste: COSTE_NIVEL_MAGIA,
      nivelInnato,
      porNivel: efectos.nivelMagiaPorNivel,
      nivel,
    }) + (personaje.bonosEspeciales['NivelMagia'] ?? 0),
  );

  const esferasElegidas = personaje.metamagia ?? [];
  const porPosicion = new Map(datos.metamagia.map((m) => [m.posicion, m]));
  let metamagiaGastada = 0;
  for (const posicion of esferasElegidas) {
    const esfera = porPosicion.get(posicion);
    if (!esfera) {
      avisos.push({ gravedad: 'aviso', mensaje: `Esfera metamágica desconocida: "${posicion}".` });
      continue;
    }
    metamagiaGastada += esfera.coste;
    if (esfera.nivelRequerido > nivel) {
      avisos.push({
        gravedad: 'aviso',
        mensaje:
          `${esfera.habilidad} pide nivel ${esfera.nivelRequerido} y tienes ${nivel}. El ` +
          'Requerimiento de Nivel no se salta ni teniendo puntos de Nivel de Magia de sobra.',
      });
    }
  }
  if (metamagiaGastada > nivelMagia.valor) {
    avisos.push({
      gravedad: 'error',
      mensaje:
        `Las esferas metamágicas cuestan ${metamagiaGastada} puntos de Nivel de Magia y sólo ` +
        `tienes ${nivelMagia.valor}.`,
    });
  }
  const metamagia = {
    esferas: esferasElegidas,
    gastado: metamagiaGastada,
    disponible: nivelMagia.valor - metamagiaGastada,
  };

  /*
   * Regeneración zeónica, lo que se recupera de Zeón cada día. `PDs!AA95` y `Místicos!I12`:
   * el Múltiplo de regeneración —el ACT, +10 por cada esfera de Regeneración zeónica
   * avanzada, y otra vez el ACT base por cada múltiplo comprado a medio coste de ACT—, que
   * Recuperación superior de magia suma una vez más por grado. Lenta recuperación lo deja a
   * la mitad y Magia estanca a cero; lo anotado a mano en ACT y en el múltiplo no se
   * multiplica.
   */
  const esferasRegeneracion = esferasElegidas.filter(
    (pos) => porPosicion.get(pos)?.habilidad === 'Regeneración zeónica avanzada',
  ).length;
  const costeMultiplo = costeACT / 2;
  const multiplosComprados =
    costeMultiplo > 0 ? Math.trunc((personaje.pdInvertidos['MultiploRegeneracion'] ?? 0) / costeMultiplo) * base : 0;
  const especialACT = personaje.bonosEspeciales['ACT'] ?? 0;
  const especialMultiplo = personaje.bonosEspeciales['MultiploRegeneracion'] ?? 0;
  const multiploRegeneracion = act.valor + 10 * esferasRegeneracion + multiplosComprados + especialMultiplo;
  const regeneracionZeonica = derivar(
    'RegeneracionZeonica',
    Math.trunc(
      (multiploRegeneracion - especialACT - especialMultiplo) *
        (1 + efectos.regeneracionZeonGrados) *
        efectos.regeneracionZeonFactor,
    ) + especialACT + especialMultiplo,
  );

  // ── Dominios del Ki ──
  // Va después de las secundarias porque Detección y Ocultación se calculan sobre
  // Advertir y Ocultarse ya resueltas.
  const cmPorArteMarcial: Record<string, number> = {};
  for (const arte of datos.artesMarciales) {
    const nombre = String(arte.arte ?? '');
    if (nombre) cmPorArteMarcial[nombre] = Number(arte.CM ?? 0);
  }
  // El coste en PD de un Ars Magnus, como `PDs!L81`: el Maestro en Armas paga la mitad de
  // todos y el Tao la de Kiai; Cáncer cuesta 10 menos con Virgo: Instrumentos de cuerda
  // (`Tablas!F1017`).
  const costesArsMagnus: Record<string, { CM: number; PD: number }> = {};
  const arsTenidos = new Set(personaje.ki?.arsMagnus ?? []);
  const categoriaArs = categoriaActual(personaje);
  for (const ars of datos.arsMagnus) {
    const nombre = String(ars.nombre ?? '');
    if (!nombre) continue;
    let pd = Number(ars.PD ?? 0);
    if (ars.descuentoCon && arsTenidos.has(String(ars.descuentoCon))) pd -= Number(ars.descuentoPD ?? 0);
    if (categoriaArs === 'Maestro en Armas' || (categoriaArs === 'Tao' && nombre === 'Kiai')) pd *= 0.5;
    costesArsMagnus[nombre] = { CM: Number(ars.CM ?? 0), PD: pd };
  }
  const caracteristicasKi = Object.fromEntries(
    CARACTERISTICAS_KI.map((c) => [c, caracteristicas[c].total]),
  ) as Record<CaracteristicaKi, number>;
  const porCaracteristica = (prefijo: string) =>
    Object.fromEntries(
      CARACTERISTICAS_KI.map((c) => [c, personaje.pdInvertidos[`${prefijo}${c}`] ?? 0]),
    ) as Record<CaracteristicaKi, number>;
  const especialPor = (prefijo: string) =>
    Object.fromEntries(
      CARACTERISTICAS_KI.map((c) => [c, personaje.bonosEspeciales[`${prefijo}${c}`] ?? 0]),
    ) as Record<CaracteristicaKi, number>;

  const ki = calcularKi(
    personaje.ki ?? { habilidades: [], limites: [], tecnicas: [], artesMarciales: [] },
    {
      tablaAcumulacion: tablas.acumulacionKi ?? [],
      habilidades: datos.habilidadesKi,
      limites: tablas.limitesKi ?? [],
      cmPorArteMarcial,
      arsMagnus: costesArsMagnus,
      tecnicas: { opciones: datos.efectosTecnica, fichas: datos.tiposEfectoTecnica },
    },
    {
      caracteristicas: caracteristicasKi,
      pdKi: porCaracteristica('Ki'),
      pdAcumulacion: porCaracteristica('AcumKi'),
      pdCM: personaje.pdInvertidos['CM'] ?? 0,
      especialKi: especialPor('Ki'),
      especialAcumulacion: especialPor('AcumKi'),
      costeKi: Number(categoria?.costeKi ?? 0),
      costeAcumulacion: Number(categoria?.costeAcumKi ?? 0),
      // Cada categoría aporta su CM por los niveles hechos en ella.
      cmCategoria: acumularPorNivel(personaje.categorias, datos.categorias, 'conocimientoMarcial'),
      cmVentajas: efectos.conocimientoMarcial,
      nivel,
      pdTotales,
      /*
       * `Mod_ATA` en la hoja (`PDs!AA36`): el modificador **a toda acción** —cansancio,
       * Endeble y lo anotado a mano—. Ni el penalizador natural ni el de no llegar al
       * requerimiento, que es `Mod_Fisico` y la hoja no lo pone aquí.
       */
      penalizadorArmadura: modificadorTodaAccion,
      advertir: secundarias['Advertir']?.valor ?? 0,
      ocultarse: secundarias['Ocultarse']?.valor ?? 0,
      especialDeteccion: especial('DeteccionKi'),
      especialOcultacion: especial('OcultacionKi'),
      bonoDeteccionPorNivel: efectos.deteccionKiPorNivel,
      bonoOcultacionPorNivel: efectos.ocultacionKiPorNivel,
      // Los D'Anjayni nacen sabiendo esconderse. Ficha, Ki!F36.
      bonoOcultacionRaza: raza?.raza === "D'Anjayni" ? 50 : 0,
      natura: raza?.natura ?? 0,
      poderInnato: personaje.ventajas.includes('Poder innato'),
      limiteDual: personaje.ventajas.includes('Límite dual'),
    },
    reglamento,
  );
  for (const texto of ki.avisos) avisos.push({ gravedad: 'aviso', mensaje: texto });

  // ── Puntos de Creación: ventajas contra desventajas ──
  /**
   * Las ventajas de una habilidad elegida se toman una vez por habilidad, y cada vez se
   * paga (`Tablas!H284 = G284*F284`, con G contando las casillas).
   */
  const vecesTomada = (nombre: string) =>
    (VENTAJAS_CON_HABILIDAD as readonly string[]).includes(nombre)
      ? Math.max(1, Math.min(MAXIMO_HABILIDADES_POR_VENTAJA, (personaje.eleccionesVentajas?.[nombre] ?? []).filter(Boolean).length))
      : 1;
  const costeDe = (nombre: string) =>
    Math.abs(datos.ventajas.find((v) => v.nombre === nombre)?.coste ?? 0) * vecesTomada(nombre);
  // Los Legados de Sangre salen de los mismos Puntos de Creación que las ventajas. Cuando
  // el coste es un rango («1, 2 o 3») se cobra el mínimo: lo demás lo decide el jugador.
  const costeLegado = (nombre: string) => {
    const l = datos.legadosSangre.find((x) => x.legado === nombre);
    if (!l) return 0;
    return typeof l.coste === 'number' ? l.coste : Number(String(l.coste).match(/\d+/)?.[0] ?? 0);
  };
  const gastados =
    personaje.ventajas.reduce((t, n) => t + costeDe(n), 0) +
    (personaje.legados ?? []).reduce((t, n) => t + costeLegado(n), 0);
  const ganadosBruto = personaje.desventajas.reduce((t, n) => t + costeDe(n), 0);
  // Las cifras de partida salen de la mesa, no de una constante: una campaña heroica puede
  // dar cinco Puntos de Creación en vez de tres, y eso lo decide el Director en su campaña.
  // Sin campaña activa, el reglamento devuelve los números del manual básico.
  const creacion = reglamento.creacion();
  const ganados = Math.min(ganadosBruto, creacion.maximoPorDesventajas);
  const puntosCreacion = { disponibles: creacion.puntosCreacion + ganados, gastados, ganados };

  if (gastados > puntosCreacion.disponibles) {
    avisos.push({
      gravedad: 'error',
      mensaje: `Has gastado ${gastados} Puntos de Creación y sólo tienes ${puntosCreacion.disponibles}.`,
    });
  }
  if (ganadosBruto > creacion.maximoPorDesventajas) {
    avisos.push({
      gravedad: 'aviso',
      mensaje:
        `Las desventajas dan como mucho ${creacion.maximoPorDesventajas} PC; ` +
        `las tuyas sumarían ${ganadosBruto}.`,
    });
  }

  // Reparto de PD y límites.
  const sumar = (claves: string[]) =>
    claves.reduce((t, k) => t + (personaje.pdInvertidos[k] ?? 0), 0);
  const pdSecundarias = secundarias_.reduce((t, d) => t + (personaje.pdInvertidos[d.nombre] ?? 0), 0);
  const pdGastados = {
    // Los Ars Magnus se pagan en PD además de en CM, y son habilidades de combate.
    combate: sumar(CLAVES_COMBATE) + ki.pdArsMagnus,
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

  // Cinco Habilidades Naturales por nivel (PDs!AA186) y un Bonificador Natural físico y uno
  // anímico por nivel, que las ventajas doblan o anulan (PDs!AA185).
  const maxNaturales = 5 * Math.max(1, nivel);
  if (personaje.habilidadesNaturales.length > maxNaturales) {
    avisos.push({
      gravedad: 'aviso',
      mensaje:
        `Habilidades Naturales: has elegido ${personaje.habilidadesNaturales.length} y a tu nivel ` +
        `se permiten ${maxNaturales}.`,
    });
  }
  const maxBonos = nivel === 0 ? 1 : nivel * efectos.factorBonosNaturales;
  const FISICAS = new Set<string>(['AGI', 'DES', 'CON', 'FUE']);
  const repartidos = { fisica: 0, animica: 0 };
  for (const def of secundarias_) {
    const n = bonosNaturales[def.nombre] ?? 0;
    if (FISICAS.has(def.caracteristica)) repartidos.fisica += n;
    else repartidos.animica += n;
  }
  for (const [tipo, n] of Object.entries(repartidos)) {
    if (n > maxBonos) {
      avisos.push({
        gravedad: 'aviso',
        mensaje:
          `Bonificadores Naturales ${tipo === 'fisica' ? 'físicos' : 'anímicos'}: has puesto ${n} ` +
          `y a tu nivel ${maxBonos === 0 ? 'no te corresponde ninguno' : `te corresponden ${maxBonos}`}.`,
      });
    }
  }
  for (const nombre of efectos.sinHabilidad) {
    avisos.push({
      gravedad: 'aviso',
      mensaje: `${nombre}: elige a qué habilidad se aplica; mientras no la elijas no suma nada.`,
    });
  }

  if (efectos.sinEfecto.length > 0) {
    avisos.push({
      gravedad: 'aviso',
      mensaje:
        `Estas ventajas todavía no se aplican solas, apúntalas en «Esp.» si te dan bonos: ` +
        efectos.sinEfecto.join(', ') + '.',
    });
  }

  return {
    nivel,
    ajusteNivel,
    nivelParaExperiencia,
    experiencia,
    carga,
    pdTotales,
    multiclase,
    caracteristicas,
    puntosVida,
    cansancio,
    presencia,
    resistencias,
    zeon,
    act,
    nivelMagia,
    metamagia,
    ki,
    invocacion,
    proyeccionMagica,
    proyeccionPsiquica,
    potencialPsiquico,
    cv,
    regeneracionZeonica,
    regeneracion,
    regeneracionTexto,
    movimiento,
    movimientoTexto,
    inventario,
    secundarias,
    secundariasSinUso,
    efectos,
    puntosCreacion,
    combate: {
      HAtaque,
      HParada,
      HEsquiva,
      llevarArmadura,
      turnoNatural,
      turnoSinArma,
      tamano,
      proteccion,
      armas: armasCalculadas,
    },
    pdGastados,
    limites,
    avisos,
  };
}
