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

export interface TablasBase {
  bonoCaracteristica: { valor: number; bono: number; multiplicadorPV: number }[];
  valoresBase: { valor: number; PV: number; ACT: number }[];
  fuerza: { valor: number; bonoTamano: number; pesoKg: number; pesoMaxKg: number }[];
  gnosis: { gnosis: number; PDs: number; nivelesSobrenat?: number }[];
  limitesKi: { limite: string; coste: number; efecto: string }[];
  armasEnormes: { tamano: string; fueMin: number; tamanoMin: number; penFUE: number; multDano: number }[];
  potencialPsiquico: { VOL: number; potencial: number }[];
  potencialPorCV: { CVacumulados: number; bono: number }[];
  acumulacionPorPOD: { POD: number; multiplicador: number }[];
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
  conjuros: 'conjuro',
  poderesPsiquicos: 'poder',
  disciplinasPsiquicas: 'disciplina',
  elan: 'nombre',
};
