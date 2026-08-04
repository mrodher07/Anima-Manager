/**
 * Persistencia local sobre IndexedDB.
 *
 * La interfaz es asíncrona desde el principio, aunque hoy todo sea local: cuando llegue la
 * sincronización en la nube sólo habrá que cambiar la implementación, no quien la usa.
 * Cada registro lleva `id`, `propietario` y `actualizadoEn` para que esa migración no
 * obligue a rehacer las fichas guardadas.
 */

import { migrarPersonaje, type Personaje } from '../motor/personaje';
import type { AjustesMesa } from '../motor/reglamento';
import type { SistemaCombate } from '../motor/combateAlternativo';
import { obtenerImagen, type Imagen, type ImagenInfo } from './imagenes';
import type { TipoDano } from '../motor/combate';
import { PERSONALIZADOS_VACIOS, type Personalizados } from '../datos/paquetes';

export interface NotaSesion {
  id: string;
  fecha: string;
  titulo: string;
  texto: string;
}

/**
 * Ficha reducida de enemigo o PNJ. No es un personaje completo: al Director le basta con
 * lo que necesita para resolver un combate, y el resto lo lleva en la cabeza o en notas.
 */
export interface Enemigo {
  id: string;
  campanaId: string | null;
  actualizadoEn: string;
  nombre: string;
  descripcion?: string;
  imagenId?: string | null;
  /** Nivel o categoría de amenaza, sólo informativo. */
  tipo?: string;
  puntosVida: number;
  /** PV actuales durante el combate. */
  pvActuales?: number;
  turno: number;
  ataque: number;
  defensa: number;
  tipoDefensa: 'Parada' | 'Esquiva';
  dano: number;
  tipoDano: TipoDano;
  /** Tipo de Armadura contra cada tipo de daño. */
  TA: Record<TipoDano, number>;
  notas?: string;
}

export function enemigoVacio(id: string, campanaId: string | null): Enemigo {
  return {
    id,
    campanaId,
    actualizadoEn: new Date().toISOString(),
    nombre: '',
    // Sin inventar nada: los valores arrancan a 0 y los pone el Director.
    puntosVida: 0,
    turno: 0,
    ataque: 0,
    defensa: 0,
    tipoDefensa: 'Parada',
    dano: 0,
    tipoDano: 'FIL',
    TA: { FIL: 0, CON: 0, PEN: 0, CAL: 0, ELE: 0, FRI: 0, ENE: 0 },
  };
}

export interface Campana {
  id: string;
  propietario: string | null;
  actualizadoEn: string;
  nombre: string;
  descripcion?: string;
  /** Paquetes de contenido activos en esta campaña. */
  paquetes: string[];
  /**
   * Sistema de combate de la mesa. El **dramático** sólo estira la duración de cada asalto
   * para que un duelo entre leyendas se sienta épico; no cambia ninguna otra regla. Se
   * decide por campaña porque el manual pide que todos lo sepan desde el principio.
   * (*Los que Caminaron con Nosotros*, cap. 4.)
   */
  sistemaCombate?: SistemaCombate;
  /** Reglas caseras de la mesa. */
  ajustes: AjustesMesa;
  /** Diario de la campaña: lo que pasó en cada sesión. Lo escribe la mesa. */
  notasSesion: NotaSesion[];
  /** Razas, armas, armaduras y ventajas propias de esta mesa. */
  personalizados?: Personalizados;
}

const BD = 'anima-manager';
const VERSION = 3;
const TIENDAS = ['personajes', 'campanas', 'enemigos'] as const;
export type Tienda = (typeof TIENDAS)[number];

/**
 * Lápidas: qué se ha borrado aquí y cuándo.
 *
 * Borrar de IndexedDB y ya está funcionaba mientras la aplicación vivía en un solo
 * dispositivo. Con nube no vale: si el borrado no deja rastro, la siguiente sincronización
 * se encuentra una ficha que está en el servidor y no está aquí, y la única conclusión
 * razonable que puede sacar es que es nueva. La ficha borrada resucita.
 *
 * La lápida guarda **cuándo** se borró, no sólo que se borró, porque hay que poder
 * compararlo con la última edición del servidor: si allí se tocó después, gana el servidor.
 */
const BORRADOS = 'borrados';

export interface Lapida {
  /** `tienda:id`, para que dos tiendas puedan usar el mismo id sin pisarse. */
  clave: string;
  tienda: Tienda;
  registroId: string;
  actualizadoEn: string;
}

let promesaBD: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(BD, VERSION);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      for (const t of TIENDAS) {
        if (!bd.objectStoreNames.contains(t)) bd.createObjectStore(t, { keyPath: 'id' });
      }
      if (!bd.objectStoreNames.contains(BORRADOS)) {
        bd.createObjectStore(BORRADOS, { keyPath: 'clave' });
      }
    };
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
  return promesaBD;
}

function transaccion<T>(
  tienda: Tienda | typeof BORRADOS,
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (bd) =>
      new Promise<T>((resolver, rechazar) => {
        const tx = bd.transaction(tienda, modo);
        const solicitud = fn(tx.objectStore(tienda));
        solicitud.onsuccess = () => resolver(solicitud.result);
        solicitud.onerror = () => rechazar(solicitud.error);
      }),
  );
}

function marcar<T extends { actualizadoEn: string }>(registro: T): T {
  return { ...registro, actualizadoEn: new Date().toISOString() };
}

const clave = (tienda: Tienda, id: string) => `${tienda}:${id}`;

/** Deja constancia de un borrado para que la nube pueda enterarse más tarde. */
async function ponerLapida(tienda: Tienda, registroId: string): Promise<void> {
  const lapida: Lapida = {
    clave: clave(tienda, registroId),
    tienda,
    registroId,
    actualizadoEn: new Date().toISOString(),
  };
  await transaccion(BORRADOS, 'readwrite', (s) => s.put(lapida));
}

/**
 * Quita la lápida de un registro que vuelve a existir.
 *
 * Pasa en dos casos legítimos: se recupera una ficha desde una copia de seguridad con el
 * mismo id, o baja de la nube porque otro dispositivo la editó después del borrado. Si la
 * lápida se quedara puesta, la siguiente sincronización volvería a borrarla.
 */
async function quitarLapida(tienda: Tienda, registroId: string): Promise<void> {
  await transaccion(BORRADOS, 'readwrite', (s) => s.delete(clave(tienda, registroId)));
}

export const almacen = {
  async listarPersonajes(): Promise<Personaje[]> {
    const todos = await transaccion<Personaje[]>('personajes', 'readonly', (s) => s.getAll());
    return todos.map(migrarPersonaje).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async obtenerPersonaje(id: string): Promise<Personaje | undefined> {
    const p = await transaccion<Personaje | undefined>('personajes', 'readonly', (s) => s.get(id));
    return p ? migrarPersonaje(p) : undefined;
  },

  async guardarPersonaje(p: Personaje): Promise<void> {
    await transaccion('personajes', 'readwrite', (s) => s.put(marcar(p)));
    await quitarLapida('personajes', p.id);
  },

  async borrarPersonaje(id: string): Promise<void> {
    await transaccion('personajes', 'readwrite', (s) => s.delete(id));
    await ponerLapida('personajes', id);
  },

  async listarCampanas(): Promise<Campana[]> {
    const todas = await transaccion<Campana[]>('campanas', 'readonly', (s) => s.getAll());
    return todas
      .map((c) => ({ ...c, personalizados: { ...PERSONALIZADOS_VACIOS, ...c.personalizados } }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async guardarCampana(c: Campana): Promise<void> {
    await transaccion('campanas', 'readwrite', (s) => s.put(marcar(c)));
    await quitarLapida('campanas', c.id);
  },

  async borrarCampana(id: string): Promise<void> {
    await transaccion('campanas', 'readwrite', (s) => s.delete(id));
    await ponerLapida('campanas', id);
  },

  async listarEnemigos(campanaId: string | null): Promise<Enemigo[]> {
    const todos = await transaccion<Enemigo[]>('enemigos', 'readonly', (s) => s.getAll());
    return todos
      .filter((e) => campanaId === null || e.campanaId === campanaId || e.campanaId === null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async guardarEnemigo(e: Enemigo): Promise<void> {
    await transaccion('enemigos', 'readwrite', (s) => s.put(marcar(e)));
    await quitarLapida('enemigos', e.id);
  },

  async borrarEnemigo(id: string): Promise<void> {
    await transaccion('enemigos', 'readwrite', (s) => s.delete(id));
    await ponerLapida('enemigos', id);
  },

  // ── Lo que usa la sincronización ──────────────────────────────────────────
  //
  // Estos métodos existen porque la nube necesita algo que las pantallas no: escribir un
  // registro **sin tocarle la fecha**. `guardarPersonaje` y compañía llaman a `marcar()`,
  // que pone `actualizadoEn` a ahora mismo — es lo correcto cuando quien edita es una
  // persona, y es exactamente lo que no se puede hacer con algo que baja del servidor: le
  // pondría una fecha más nueva que la del servidor y la siguiente sincronización lo
  // volvería a subir, en bucle, para siempre.

  /** Escribe un registro tal cual viene, respetando su `actualizadoEn`. */
  async guardarCrudo(tienda: Tienda, registro: { id: string } & Record<string, unknown>): Promise<void> {
    await transaccion(tienda, 'readwrite', (s) => s.put(registro));
    await quitarLapida(tienda, registro.id);
  },

  /** Borra sin dejar lápida: el borrado ya venía de fuera, no hay que devolvérselo. */
  async borrarCrudo(tienda: Tienda, id: string): Promise<void> {
    await transaccion(tienda, 'readwrite', (s) => s.delete(id));
  },

  /** Todo lo que se ha borrado aquí, para poder comunicárselo a la nube. */
  async listarLapidas(tienda?: Tienda): Promise<Lapida[]> {
    const todas = await transaccion<Lapida[]>(BORRADOS, 'readonly', (s) => s.getAll());
    return tienda ? todas.filter((l) => l.tienda === tienda) : todas;
  },

  /** Una lápida ya comunicada deja de hacer falta. */
  async olvidarLapida(tienda: Tienda, registroId: string): Promise<void> {
    await quitarLapida(tienda, registroId);
  },
};

// ─────────────────── Exportar / importar (compartir sin nube) ───────────────────

/** Imagen dentro de una exportación: el Blob va como data URI para que quepa en el JSON. */
export interface ImagenExportada extends Omit<ImagenInfo, never> {
  dataUri: string;
}

export interface Exportacion {
  formato: 'anima-manager';
  version: 1;
  exportadoEn: string;
  personajes: Personaje[];
  campanas: Campana[];
  enemigos?: Enemigo[];
  /** Retratos de las fichas exportadas. Sin esto, al compartir se perderían. */
  imagenes?: ImagenExportada[];
}

function aDataUri(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(blob);
  });
}

async function deDataUri(uri: string): Promise<Blob> {
  return (await fetch(uri)).blob();
}

/** Recoge los retratos de unas fichas para incluirlos en la exportación. */
async function recogerRetratos(personajes: Personaje[]): Promise<ImagenExportada[]> {
  const salida: ImagenExportada[] = [];
  for (const p of personajes) {
    if (!p.retratoId) continue;
    const img = await obtenerImagen(p.retratoId);
    if (!img) continue;
    const { datos, ...info } = img;
    salida.push({ ...info, dataUri: await aDataUri(datos) });
  }
  return salida;
}

export async function exportarTodo(): Promise<Exportacion> {
  const [personajes, campanas, enemigos] = await Promise.all([
    almacen.listarPersonajes(),
    almacen.listarCampanas(),
    almacen.listarEnemigos(null),
  ]);
  return {
    formato: 'anima-manager',
    version: 1,
    exportadoEn: new Date().toISOString(),
    personajes,
    campanas,
    enemigos,
    imagenes: await recogerRetratos(personajes),
  };
}

export async function exportarPersonaje(p: Personaje): Promise<Exportacion> {
  return {
    formato: 'anima-manager',
    version: 1,
    exportadoEn: new Date().toISOString(),
    personajes: [p],
    campanas: [],
    imagenes: await recogerRetratos([p]),
  };
}

/**
 * Valida y carga una exportación. No sobrescribe en silencio: devuelve qué entraría en
 * conflicto para que sea el usuario quien decida.
 */
export async function analizarImportacion(
  datos: unknown,
): Promise<{ ok: true; exportacion: Exportacion; conflictos: string[] } | { ok: false; error: string }> {
  if (typeof datos !== 'object' || datos === null) {
    return { ok: false, error: 'El archivo no contiene datos válidos.' };
  }
  const e = datos as Partial<Exportacion>;
  if (e.formato !== 'anima-manager') {
    return { ok: false, error: 'Este archivo no es una exportación de Anima Manager.' };
  }
  if (e.version !== 1) {
    return { ok: false, error: `Versión de formato no soportada: ${String(e.version)}.` };
  }
  const personajes = Array.isArray(e.personajes) ? e.personajes : [];
  const campanas = Array.isArray(e.campanas) ? e.campanas : [];
  const enemigos = Array.isArray(e.enemigos) ? e.enemigos : [];

  const existentes = new Set((await almacen.listarPersonajes()).map((p) => p.id));
  const conflictos = personajes.filter((p) => existentes.has(p.id)).map((p) => p.nombre || p.id);

  return {
    ok: true,
    exportacion: { ...(e as Exportacion), personajes, campanas, enemigos },
    conflictos,
  };
}

export async function importar(exportacion: Exportacion, sobrescribir: boolean): Promise<number> {
  const existentes = new Set((await almacen.listarPersonajes()).map((p) => p.id));
  const importadas = new Set<string>();
  let importados = 0;

  for (const bruto of exportacion.personajes) {
    const p = migrarPersonaje(bruto);
    if (existentes.has(p.id) && !sobrescribir) continue;
    await almacen.guardarPersonaje(p);
    if (p.retratoId) importadas.add(p.retratoId);
    importados++;
  }
  for (const c of exportacion.campanas) {
    await almacen.guardarCampana(c);
  }
  for (const e of exportacion.enemigos ?? []) {
    await almacen.guardarEnemigo(e);
  }

  // Sólo se restauran los retratos de las fichas que de verdad han entrado.
  for (const img of exportacion.imagenes ?? []) {
    if (!importadas.has(img.id)) continue;
    const { dataUri, ...info } = img;
    const completa: Imagen = { ...info, datos: await deDataUri(dataUri) };
    await guardarImagenImportada(completa);
  }

  return importados;
}

/** Escribe una imagen recibida en una importación, respetando su id original. */
async function guardarImagenImportada(imagen: Imagen): Promise<void> {
  const { guardarImagenCruda } = await import('./imagenes');
  await guardarImagenCruda(imagen);
}
