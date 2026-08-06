/**
 * Modelo de personaje y derivación de valores.
 *
 * Principio: la ficha guarda **sólo lo que el usuario decide** (características base, PD
 * invertidos, equipo…). Todo lo demás se recalcula. Lo único que se persiste de un valor
 * derivado es la *sobrescritura manual*, cuando el usuario decide ignorar el cálculo.
 */

import { Reglamento, REGLAMENTO_OFICIAL, type ClaveRegla } from './reglamento';
import type { EleccionesSheele } from './sheele';
import {
  calcularArma,
  combinarArmadura,
  type ArmaEquipada,
  type HabilidadesArma,
  type PiezaEquipada,
  type ProteccionTotal,
} from './combate';
import { acumularEfectos, type EfectosAplicados } from './efectos';
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
  return { nombre: s.secundaria, grupo, caracteristica, fisica: s.fisica };
}

/**
 * Las 46 del Core Exxet. Son el **valor por defecto**: la lista que manda es la del
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

  /** Las cinco Habilidades Naturales (+10 cada una). */
  habilidadesNaturales: string[];
  /** Bonificador Natural: una secundaria física y una anímica. */
  bonificadorNatural: { fisica?: string; animica?: string };

  ventajas: string[];
  desventajas: string[];
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
  inventario: ResumenInventario;
  secundarias: Record<string, ValorDerivado>;
  /** Lo que aportan las ventajas y desventajas elegidas. */
  efectos: EfectosAplicados;
  puntosCreacion: { disponibles: number; gastados: number; ganados: number };
  combate: {
    HAtaque: ValorDerivado;
    HParada: ValorDerivado;
    HEsquiva: ValorDerivado;
    llevarArmadura: ValorDerivado;
    turnoNatural: ValorDerivado;
    tamano: number;
    proteccion: ProteccionTotal;
    armas: HabilidadesArma[];
  };
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
const CLAVES_MISTICAS = ['Zeon', 'ACT', 'ProyeccionMagica', 'NivelMagia', 'Convocar', 'Controlar', 'Atar', 'Desconvocar'];

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
    armaduras: [...armaduras, ...yelmos.map(({ yelmo, ...resto }) => ({ ...resto, armadura: yelmo }))],
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
  const { raza, categoria, tablas } = datos;
  const avisos: Aviso[] = [];
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
  const efectos = acumularEfectos([...personaje.ventajas, ...personaje.desventajas]);

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
        bonoCategoria: Number(categoria?.[`bon${def.clave}`] ?? 0),
      }) + (personaje.bonosEspeciales[def.clave] ?? 0),
    );
  }

  const inventario = resumirInventario(personaje, datos.objetos);

  // ── Combate: armadura primero, porque su penalizador afecta a casi todo ──
  const especial = (clave: string) => personaje.bonosEspeciales[clave] ?? 0;
  // «Sentido del combate» suma por nivel al bono de categoría, con tope conjunto de 50.
  const bonoCategoriaCombate = (clave: 'HAtaque' | 'HParada' | 'HEsquiva', base: number) =>
    Math.min(50, base + (efectos.bonoCategoria[clave] ?? 0) * nivel);
  const llevarArmaduraBase =
    truncarPD(personaje.pdInvertidos['LlevarArmadura'] ?? 0, Number(categoria?.costeLlevarArmadura ?? 2)) +
    caracteristicas.FUE.bono +
    Number(categoria?.bonoLlevarArmadura ?? 0) +
    efectos.llevarArmaduraPorNivel * nivel +
    especial('LlevarArmadura');
  const llevarArmadura = derivar('LlevarArmadura', llevarArmaduraBase);

  const proteccion = combinarArmadura(personaje.equipo.armadura, datos.armaduras, llevarArmadura.valor);
  // Armadura natural y mística se suman al TA de las piezas llevadas.
  for (const [dano, valor] of Object.entries(efectos.TA)) {
    const t = dano as keyof typeof proteccion.TA;
    proteccion.TA[t] = (proteccion.TA[t] ?? 0) + (valor ?? 0);
  }
  const penalizadorArmadura = proteccion.penalizadorNatural;

  // Habilidades secundarias.
  const secundarias: Record<string, ValorDerivado> = {};
  for (const def of secundarias_) {
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
        mejoraNatural:
        mejoraNatural * efectos.factorMejoraNatural + (personaje.bonosEspeciales[def.nombre] ?? 0),
        penalizadorNoDesarrollada: -30,
        // Sólo las habilidades físicas sufren el penalizador de la armadura.
        penalizadorNatural: def.fisica ? penalizadorArmadura : 0,
      }),
    );
  }

  // ── Habilidades primarias de combate y armas equipadas ──
  const HAtaque = derivar(
    'HAtaque',
    truncarPD(personaje.pdInvertidos['HAtaque'] ?? 0, Number(categoria?.costeHA ?? 2)) +
      caracteristicas.DES.bono +
      bonoCategoriaCombate('HAtaque', Number(categoria?.bonoHA ?? 0)) +
      especial('HAtaque'),
  );
  const HParada = derivar(
    'HParada',
    truncarPD(personaje.pdInvertidos['HParada'] ?? 0, Number(categoria?.costeHP ?? 2)) +
      caracteristicas.DES.bono +
      bonoCategoriaCombate('HParada', Number(categoria?.bonoHP ?? 0)) +
      especial('HParada'),
  );
  const HEsquiva = derivar(
    'HEsquiva',
    truncarPD(personaje.pdInvertidos['HEsquiva'] ?? 0, Number(categoria?.costeHE ?? 2)) +
      caracteristicas.AGI.bono +
      bonoCategoriaCombate('HEsquiva', Number(categoria?.bonoHE ?? 0)) +
      especial('HEsquiva'),
  );

  // Tamaño = CON + FUE **base** (sin modificadores raciales, que ya van aparte)
  // − 1 si es mujer, + el modificador de tamaño de la raza. Ficha, Principal!AO21.
  const tamano = Math.min(
    raza?.raza === 'Jayán' ? 24 : 22,
    Math.max(
      1,
      caracteristicas.CON.base + caracteristicas.FUE.base - (personaje.sexo === 'Mujer' ? 1 : 0),
    ) + (raza?.tamano ?? 0),
  );

  const turnoNatural = derivar(
    'turnoNatural',
    aplicar('turno', {
      // Jayán y Turak de tamaño Grande arrastran −10 al turno base. Ficha, Principal!D24.
      turnoBase:
        20 +
        (tamano >= 20 && (raza?.raza === 'Jayán' || raza?.raza === 'Turak') ? -10 : 0) +
        efectos.turno +
        especial('turnoNatural'),
      bonoAGI: caracteristicas.AGI.bono,
      bonoDES: caracteristicas.DES.bono,
      turnoCategoria: Number(categoria?.turno ?? 0),
      penalizadorNatural: penalizadorArmadura,
      turnoArma: 0,
    }),
  );

  const ctxCombate = {
    bonoFUE: caracteristicas.FUE.bono,
    FUE: caracteristicas.FUE.total,
    tamano,
    turnoNatural: turnoNatural.valor,
    HAtaque: HAtaque.valor,
    HParada: HParada.valor,
    HEsquiva: HEsquiva.valor,
    tablas,
  };
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
  const nivelMagia = derivar(
    'NivelMagia',
    aplicar('nivelMagia', {
      pd: personaje.pdInvertidos['NivelMagia'] ?? 0,
      coste: COSTE_NIVEL_MAGIA,
    }),
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

  // ── Dominios del Ki ──
  // Va después de las secundarias porque Detección y Ocultación se calculan sobre
  // Advertir y Ocultarse ya resueltas.
  const cmPorArteMarcial: Record<string, number> = {};
  for (const arte of datos.artesMarciales) {
    const nombre = String(arte.arte ?? '');
    if (nombre) cmPorArteMarcial[nombre] = Number(arte.CM ?? 0);
  }
  const costesArsMagnus: Record<string, { CM: number; PD: number }> = {};
  for (const ars of datos.arsMagnus) {
    const nombre = String(ars.nombre ?? '');
    if (nombre) costesArsMagnus[nombre] = { CM: Number(ars.CM ?? 0), PD: Number(ars.PD ?? 0) };
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
      penalizadorArmadura,
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
  const costeDe = (nombre: string) =>
    Math.abs(datos.ventajas.find((v) => v.nombre === nombre)?.coste ?? 0);
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

  if (personaje.habilidadesNaturales.length > 5) {
    avisos.push({
      gravedad: 'aviso',
      mensaje: `Habilidades Naturales: has elegido ${personaje.habilidadesNaturales.length} y sólo se permiten 5.`,
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
    inventario,
    secundarias,
    efectos,
    puntosCreacion,
    combate: {
      HAtaque,
      HParada,
      HEsquiva,
      llevarArmadura,
      turnoNatural,
      tamano,
      proteccion,
      armas: armasCalculadas,
    },
    pdGastados,
    limites,
    avisos,
  };
}
