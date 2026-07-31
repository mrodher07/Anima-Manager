/**
 * Paquetes de contenido.
 *
 * El Core Exxet es sólo el primer manual: Prometheus, Arcana, Dominus y los demás añaden
 * razas, categorías, ventajas, conjuros y técnicas nuevas, y en ocasiones **corrigen**
 * entradas del básico. Por eso el catálogo no es un JSON fijo, sino la combinación
 * ordenada de varios paquetes que el usuario activa o desactiva por campaña.
 *
 * Reglas de combinación:
 *  - Los paquetes se aplican en orden de prioridad.
 *  - Una entrada con la misma clave **sustituye** a la anterior (así un suplemento corrige
 *    el básico), y se anota de qué paquete viene para poder mostrarlo en la interfaz.
 *  - Cada entrada del catálogo sabe siempre su procedencia.
 */

import { CLAVE_DE, type Colecciones, type NombreColeccion, type TablasBase } from './tipos';

/**
 * Contenido propio de una mesa: razas, armas, armaduras y ventajas que no están en ningún
 * manual. En el Excel esto se hace editando a mano la hoja oculta de tablas — así es como
 * ese grupo metió la raza «Moguri» y compañía.
 */
export type Personalizados = { [K in NombreColeccion]?: Colecciones[K][] };

export const PERSONALIZADOS_VACIOS: Personalizados = {};

/** Cuántas entradas propias hay en total. */
export function cuentaPersonalizados(propio: Personalizados): number {
  return Object.values(propio).reduce((t, lista) => t + (lista?.length ?? 0), 0);
}

/**
 * Convierte el contenido propio de una campaña en un paquete.
 * Va con prioridad alta para que pueda además **corregir** entradas de los manuales.
 */
export function paquetePersonalizado(propio: Personalizados): PaqueteContenido {
  return {
    id: 'personalizado',
    nombre: 'Contenido propio',
    sigla: 'Tuyo',
    descripcion: 'Lo que ha creado tu mesa: razas, armas, armaduras y ventajas.',
    prioridad: 1000,
    cargar: async (coleccion) => (propio[coleccion] as never) ?? null,
  };
}

export interface PaqueteContenido {
  id: string;
  nombre: string;
  /** Abreviatura para mostrar junto a las entradas. */
  sigla: string;
  descripcion: string;
  /** Menor va primero; los suplementos deben ir por encima del básico. */
  prioridad: number;
  /** Carga diferida: los 640 conjuros no se traen hasta que hagan falta. */
  cargar: <K extends NombreColeccion>(coleccion: K) => Promise<Colecciones[K][] | null>;
  cargarTablasBase?: () => Promise<Partial<TablasBase>>;
}

/** Una entrada del catálogo, con su procedencia. */
export type ConOrigen<T> = T & { readonly _paquete: string; readonly _sigla: string };

/** Paquete del manual básico, con los datos ya extraídos de la ficha. */
export const CORE_EXXET: PaqueteContenido = {
  id: 'core-exxet',
  nombre: 'Core Exxet',
  sigla: 'CE',
  descripcion: 'Manual básico de Anima Beyond Fantasy, edición revisada.',
  prioridad: 0,
  cargar: async (coleccion) => {
    // Vite resuelve estos import() de forma estática y los sirve como fragmentos aparte.
    const modulos = import.meta.glob('../../data/reglas/*.json');
    const ruta = `../../data/reglas/${coleccion}.json`;
    const cargador = modulos[ruta];
    if (!cargador) return null;
    const mod = (await cargador()) as { default: unknown };
    return mod.default as never;
  },
  cargarTablasBase: async () => {
    const mod = await import('../../data/reglas/tablasBase.json');
    return mod.default as unknown as Partial<TablasBase>;
  },
};

/**
 * Paquetes conocidos. Al llegar un manual nuevo basta con añadir aquí su entrada y sus
 * JSON; ni el motor ni la interfaz necesitan cambiar.
 */
export const PAQUETES: PaqueteContenido[] = [CORE_EXXET];

export function registrarPaquete(paquete: PaqueteContenido): void {
  const i = PAQUETES.findIndex((p) => p.id === paquete.id);
  if (i >= 0) PAQUETES[i] = paquete;
  else PAQUETES.push(paquete);
}

/**
 * Catálogo combinado. Se instancia con los paquetes activos de una campaña y cachea
 * cada colección la primera vez que se pide.
 */
export class Catalogo {
  private cache = new Map<NombreColeccion, ConOrigen<unknown>[]>();
  private tablas: TablasBase | null = null;
  private readonly paquetes: PaqueteContenido[];

  constructor(idsActivos: string[] = [CORE_EXXET.id], extra: PaqueteContenido[] = []) {
    this.paquetes = [...PAQUETES.filter((p) => idsActivos.includes(p.id)), ...extra].sort(
      (a, b) => a.prioridad - b.prioridad,
    );
    if (this.paquetes.length === 0) {
      throw new Error('Una campaña necesita al menos un paquete de contenido activo.');
    }
  }

  get paquetesActivos(): readonly PaqueteContenido[] {
    return this.paquetes;
  }

  /** Carga una colección combinando todos los paquetes activos. */
  async obtener<K extends NombreColeccion>(coleccion: K): Promise<ConOrigen<Colecciones[K]>[]> {
    const cacheada = this.cache.get(coleccion);
    if (cacheada) return cacheada as ConOrigen<Colecciones[K]>[];

    const clave = CLAVE_DE[coleccion];
    const porClave = new Map<string, ConOrigen<Colecciones[K]>>();

    for (const paquete of this.paquetes) {
      const entradas = await paquete.cargar(coleccion);
      if (!entradas) continue;
      for (const entrada of entradas) {
        const id = String((entrada as Record<string, unknown>)[clave] ?? '');
        if (!id) continue;
        porClave.set(id, {
          ...entrada,
          _paquete: paquete.nombre,
          _sigla: paquete.sigla,
        } as ConOrigen<Colecciones[K]>);
      }
    }

    const combinada = [...porClave.values()];
    this.cache.set(coleccion, combinada as ConOrigen<unknown>[]);
    return combinada;
  }

  /** Busca una entrada concreta por su clave. */
  async buscar<K extends NombreColeccion>(
    coleccion: K,
    nombre: string,
  ): Promise<ConOrigen<Colecciones[K]> | undefined> {
    const todas = await this.obtener(coleccion);
    const clave = CLAVE_DE[coleccion];
    return todas.find((e) => (e as Record<string, unknown>)[clave] === nombre);
  }

  async tablasBase(): Promise<TablasBase> {
    if (this.tablas) return this.tablas;
    let acumulado: Partial<TablasBase> = {};
    for (const paquete of this.paquetes) {
      if (!paquete.cargarTablasBase) continue;
      acumulado = { ...acumulado, ...(await paquete.cargarTablasBase()) };
    }
    this.tablas = acumulado as TablasBase;
    return this.tablas;
  }

  /** Descarta la caché. Útil al activar o desactivar un paquete. */
  invalidar(): void {
    this.cache.clear();
    this.tablas = null;
  }
}
