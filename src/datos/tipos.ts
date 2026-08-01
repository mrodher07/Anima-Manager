/** Tipos del catálogo de reglas. Comunes a todos los paquetes de contenido. */

export interface Raza {
  raza: string;
  RF?: number; RE?: number; RV?: number; RM?: number; RP?: number;
  ajusteNivel?: number;
  AGI?: number; CON?: number; DES?: number; FUE?: number;
  INT?: number; PER?: number; POD?: number; VOL?: number;
  tamano?: number;
  regeneracion?: number;
  cansancio?: number;
  natura?: number;
  descripciones?: string;
}

export interface Categoria {
  categoria: string;
  turno: number;
  PV: number;
  conocimientoMarcial?: number;
  limiteCombate: number;
  limiteMagia: number;
  limitePsi: number;
  nvPorCV?: number;
  bonoHA?: number; bonoHP?: number; bonoHE?: number;
  bonoLlevarArmadura?: number; bonoZeon?: number;
  arquetipo1?: string; arquetipo2?: string;
  /** Costes y bonos: `costeHA`, `costeAtleticas`, `bonIntimidar`… */
  [campo: string]: string | number | undefined;
}

export interface Ventaja {
  nombre: string;
  coste: number;
  tipo: string;
  esDesventaja: boolean;
  _seccion?: string;
}

export interface Arma {
  arma: string;
  dano?: number;
  turno?: number;
  fueRequerida?: number;
  fueReq2M?: number;
  critico1?: string;
  critico2?: string;
  tipoArma?: string;
  conocida?: string;
  entereza?: number;
  rotura?: number;
  presencia?: number;
  bonusParada?: number;
  bonusEsquiva?: number;
  cadencia?: string | number;
  recarga?: string | number;
  alcance?: string | number;
  especial?: string;
  tamano?: string;
  _seccion?: string;
}

export interface Armadura {
  armadura: string;
  requerimiento?: number;
  penNatural?: number;
  restMovimiento?: number;
  entereza?: number;
  presencia?: number;
  localizacion?: string;
  clase?: string;
  FIL?: number; CON?: number; PEN?: number;
  CAL?: number; ELE?: number; FRI?: number; ENE?: number;
  _seccion?: string;
}

export interface Conjuro {
  conjuro: string;
  via: string;
  nivel: number;
  diario?: string;
  tipo?: string;
  accion?: string;
  zeonBase?: number; zeonIntermedio?: number;
  zeonAvanzado?: number; zeonArcano?: number;
  efecto?: string;
  [campo: string]: string | number | undefined;
}

export interface PoderPsiquico {
  poder: string;
  disciplina: string;
  nivel: number;
  mantenido?: string;
  accion?: string;
  [dificultad: string]: string | number | undefined;
}

export interface HabilidadEsencial {
  nombre: string;
  gnosis?: number;
  coste?: number;
  _seccion?: string;
}

export interface EntradaTabla {
  [columna: string]: string | number | null | undefined;
}

/**
 * Legado de Sangre. Dominus Exxet, cap. 6. Se compra con Puntos de Creación como una
 * ventaja, pero **da +1 al ajuste de nivel**, y por eso va en su propia colección.
 */
export interface LegadoSangre {
  legado: string;
  /** Casi todos valen 1 o 2 PC; Grandes Bestias admite «1, 2 o 3». */
  coste: number | string;
  efecto?: string;
}

/**
 * Una esfera del Arcana Shepirah. Arcana Exxet, cap. 3.
 *
 * La misma habilidad aparece en varias posiciones del árbol con requisitos y costes
 * distintos —así lo dibuja el manual—, de modo que lo que identifica una esfera es su
 * **posición**, no su nombre.
 */
export interface EsferaMetamagica {
  /** Casilla de la hoja «Metamagia», que hace de identificador de la posición. */
  posicion: string;
  habilidad: string;
  /** Nivel de personaje que hay que tener. 0 si es un punto de partida del árbol. */
  nivelRequerido: number;
  /** Lo que cuesta en puntos de Nivel de Magia. */
  coste: number;
}

/**
 * Qué pide una criatura para ser invocada por Ki. Apéndice II de *Los que Caminaron con
 * Nosotros*, que completa los Sellos del Dominus: ese dice **cómo** se invoca, y este
 * **qué** pide cada ser.
 */
export interface SellosCriatura {
  criatura: string;
  nivel: number;
  /** A veces es «Esp.» o un rango como «30/40». */
  gnosis: string;
  /** «Fuego Mayor 1, Aire 1», o el motivo de que no se pueda: «Natural», «No Muerto»… */
  sellos: string;
  invocable: boolean;
}

/** Habilidad del Ki o del Némesis. Dominus Exxet, cap. 3. */
export interface HabilidadKiCatalogo {
  habilidad: string;
  dominio: 'Ki' | 'Némesis';
  requisito?: string | null;
  requisitoExtra?: string | null;
  CM: number;
}

/**
 * Una opción concreta de un efecto de Técnica: «Habilidad de Ataque» con «+25».
 * Los dos costes en Ki son el de la característica principal y el de una secundaria.
 */
export interface EfectoTecnica {
  /** Clave única: el efecto y su opción juntos, «Habilidad De Ataque +25». */
  referencia: string;
  efecto: string;
  opcion: string;
  kiPrincipal?: number;
  kiSecundaria?: number;
  CM?: number;
  mantenimiento?: number;
  sostenidaMenor?: number;
  sostenidaMayor?: number;
  nivel?: number;
  _seccion?: string;
}

/** Ficha de un efecto: tipo, clase, característica de referencia y elementos afines. */
export interface TipoEfectoTecnica {
  efecto: string;
  tipo?: string;
  clase?: string;
  /** «DES (AGI+2, FUE+2, POD+2, VOL+3)»: la primera es la principal. */
  caracteristicas?: string;
  elementos?: string;
  _seccion?: string;
}

/** Técnica ya construida del compendio del Dominus Exxet. */
export interface TecnicaCompendio {
  tecnica: string;
  arbol?: string | null;
  nivel?: number;
  CM?: number;
  /** Coste en Ki tal como lo escribe el manual: «AGI 4 DES 4 POD 2». */
  coste?: string;
  efectos?: string;
  desventajas?: string;
}

export interface TablasBase {
  bonoCaracteristica: { valor: number; bono: number; multiplicadorPV: number }[];
  valoresBase: { valor: number; PV: number; ACT: number }[];
  fuerza: { valor: number; bonoTamano: number; pesoKg: number; pesoMaxKg: number }[];
  gnosis: { gnosis: number; PDs: number; nivelesSobrenat?: number }[];
  limitesKi: { limite: string; coste: number; efecto: string }[];
  armasEnormes: { tamano: string; fueMin: number; tamanoMin: number; penFUE: number; multDano: number }[];
  potencialPsiquico: { VOL: number; potencial: number }[];
  potencialPorCV: { CVacumulados: number; bono: number }[];
  /** Tabla 53: valor de característica → Acumulación de Ki base. */
  acumulacionKi: { valor: number; acumulacion: number }[];
  experienciaNecesaria: { nota: string; filas: (number | null)[][] };
  [tabla: string]: unknown;
}

/** Nombre de cada colección del catálogo y el tipo que contiene. */
export interface Colecciones {
  razas: Raza;
  categorias: Categoria;
  ventajas: Ventaja;
  habilidadesEsenciales: HabilidadEsencial;
  poderesCriatura: HabilidadEsencial;
  armas: Arma;
  armaduras: Armadura;
  yelmos: EntradaTabla;
  artesMarciales: EntradaTabla;
  arsMagnus: EntradaTabla;
  habilidadesKi: HabilidadKiCatalogo;
  legadosSangre: LegadoSangre;
  metamagia: EsferaMetamagica;
  sellosCriatura: SellosCriatura;
  sheele: EntradaTabla;
  efectosTecnica: EfectoTecnica;
  tiposEfectoTecnica: TipoEfectoTecnica;
  tecnicasCompendio: TecnicaCompendio;
  conjuros: Conjuro;
  poderesPsiquicos: PoderPsiquico;
  disciplinasPsiquicas: EntradaTabla;
  elan: EntradaTabla;
}

export type NombreColeccion = keyof Colecciones;

/** Campo que identifica de forma única cada entrada, por colección. */
export const CLAVE_DE: Record<NombreColeccion, string> = {
  razas: 'raza',
  categorias: 'categoria',
  ventajas: 'nombre',
  habilidadesEsenciales: 'nombre',
  poderesCriatura: 'nombre',
  armas: 'arma',
  armaduras: 'armadura',
  yelmos: 'yelmo',
  artesMarciales: 'arte',
  arsMagnus: 'nombre',
  habilidadesKi: 'habilidad',
  legadosSangre: 'legado',
  metamagia: 'posicion',
  sellosCriatura: 'criatura',
  sheele: 'mejora',
  // Un efecto tiene varias opciones, así que la clave es la pareja efecto + opción.
  efectosTecnica: 'referencia',
  tiposEfectoTecnica: 'efecto',
  tecnicasCompendio: 'tecnica',
  conjuros: 'conjuro',
  poderesPsiquicos: 'poder',
  disciplinasPsiquicas: 'disciplina',
  elan: 'nombre',
};
