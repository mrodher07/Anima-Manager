/**
 * Persistencia local sobre IndexedDB.
 *
 * La interfaz es asíncrona desde el principio, aunque hoy todo sea local: cuando llegue la
 * sincronización en la nube sólo habrá que cambiar la implementación, no quien la usa.
 * Cada registro lleva `id`, `propietario` y `actualizadoEn` para que esa migración no
 * obligue a rehacer las fichas guardadas.
 */

import type { Personaje } from '../motor/personaje';
import type { AjustesMesa } from '../motor/reglamento';
import { obtenerImagen, type Imagen, type ImagenInfo } from './imagenes';

export interface NotaSesion {
  id: string;
  fecha: string;
  titulo: string;
  texto: string;
}

export interface Campana {
  id: string;
  propietario: string | null;
  actualizadoEn: string;
  nombre: string;
  descripcion?: string;
  /** Paquetes de contenido activos en esta campaña. */
  paquetes: string[];
  /** Reglas caseras de la mesa. */
  ajustes: AjustesMesa;
  /** Diario de la campaña: lo que pasó en cada sesión. Lo escribe la mesa. */
  notasSesion: NotaSesion[];
}

const BD = 'anima-manager';
const VERSION = 1;
const TIENDAS = ['personajes', 'campanas'] as const;
type Tienda = (typeof TIENDAS)[number];

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
    };
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
  return promesaBD;
}

function transaccion<T>(
  tienda: Tienda,
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

export const almacen = {
  async listarPersonajes(): Promise<Personaje[]> {
    const todos = await transaccion<Personaje[]>('personajes', 'readonly', (s) => s.getAll());
    return todos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async obtenerPersonaje(id: string): Promise<Personaje | undefined> {
    return transaccion<Personaje | undefined>('personajes', 'readonly', (s) => s.get(id));
  },

  async guardarPersonaje(p: Personaje): Promise<void> {
    await transaccion('personajes', 'readwrite', (s) => s.put(marcar(p)));
  },

  async borrarPersonaje(id: string): Promise<void> {
    await transaccion('personajes', 'readwrite', (s) => s.delete(id));
  },

  async listarCampanas(): Promise<Campana[]> {
    const todas = await transaccion<Campana[]>('campanas', 'readonly', (s) => s.getAll());
    return todas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async guardarCampana(c: Campana): Promise<void> {
    await transaccion('campanas', 'readwrite', (s) => s.put(marcar(c)));
  },

  async borrarCampana(id: string): Promise<void> {
    await transaccion('campanas', 'readwrite', (s) => s.delete(id));
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
  const [personajes, campanas] = await Promise.all([
    almacen.listarPersonajes(),
    almacen.listarCampanas(),
  ]);
  return {
    formato: 'anima-manager',
    version: 1,
    exportadoEn: new Date().toISOString(),
    personajes,
    campanas,
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

  const existentes = new Set((await almacen.listarPersonajes()).map((p) => p.id));
  const conflictos = personajes.filter((p) => existentes.has(p.id)).map((p) => p.nombre || p.id);

  return {
    ok: true,
    exportacion: { ...(e as Exportacion), personajes, campanas },
    conflictos,
  };
}

export async function importar(exportacion: Exportacion, sobrescribir: boolean): Promise<number> {
  const existentes = new Set((await almacen.listarPersonajes()).map((p) => p.id));
  const importadas = new Set<string>();
  let importados = 0;

  for (const p of exportacion.personajes) {
    if (existentes.has(p.id) && !sobrescribir) continue;
    await almacen.guardarPersonaje(p);
    if (p.retratoId) importadas.add(p.retratoId);
    importados++;
  }
  for (const c of exportacion.campanas) {
    await almacen.guardarCampana(c);
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
