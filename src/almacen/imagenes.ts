/**
 * Almacén de imágenes: retratos, mapas, enemigos y cualquier otra cosa que la mesa
 * quiera tener a mano.
 *
 * Las imágenes se guardan como Blob en su propio almacén de IndexedDB, no dentro de la
 * ficha. Así una ficha sigue pesando unos kilobytes y se puede exportar y compartir sin
 * arrastrar megas de fotos.
 *
 * Al subir, se reescalan: una foto de móvil ronda los 5 MB y llenaría la cuota del
 * navegador en pocas subidas.
 */

import { ponerLapida, quitarLapida } from './bd';

export type TipoImagen = 'retrato' | 'mapa' | 'pnj' | 'enemigo' | 'objeto' | 'otro';

export interface Imagen {
  id: string;
  /** A qué sirve: retrato de personaje, mapa de la mazmorra… */
  tipo: TipoImagen;
  nombre: string;
  descripcion?: string;
  campanaId: string | null;
  /** Ficha a la que pertenece, si es un retrato. */
  personajeId?: string | null;
  anchura: number;
  altura: number;
  bytes: number;
  creadoEn: string;
  /**
   * Cuándo se tocó por última vez. `creadoEn` no vale para sincronizar: renombrar un mapa
   * no lo crea de nuevo, pero sí tiene que ganarle a la versión del servidor.
   */
  actualizadoEn?: string;
  datos: Blob;
}

/** El píxel no cambia, pero el nombre o la descripción sí. */
function tocada<T extends { creadoEn: string; actualizadoEn?: string }>(imagen: T): T {
  return { ...imagen, actualizadoEn: new Date().toISOString() };
}

/**
 * La fecha con la que se compara al sincronizar. Las imágenes anteriores a la nube no
 * tienen `actualizadoEn`; para ellas vale la de creación, que es cuando se tocaron.
 */
export function fechaDe(imagen: { creadoEn: string; actualizadoEn?: string }): string {
  return imagen.actualizadoEn ?? imagen.creadoEn;
}

/** Metadatos sin el Blob, para listar sin cargar las imágenes en memoria. */
export type ImagenInfo = Omit<Imagen, 'datos'>;

const BD = 'anima-manager-imagenes';
const VERSION = 1;
const TIENDA = 'imagenes';

/** Lado máximo tras reescalar. Suficiente para verlo a pantalla completa. */
export const LADO_MAXIMO = 1600;
/** Lado máximo de un retrato: se muestra pequeño, no hace falta más. */
export const LADO_MAXIMO_RETRATO = 640;
/** Tamaño máximo del archivo original que aceptamos leer. */
export const BYTES_MAXIMOS_ENTRADA = 25 * 1024 * 1024;

export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

let promesaBD: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((resolver, rechazar) => {
    const s = indexedDB.open(BD, VERSION);
    s.onupgradeneeded = () => {
      const bd = s.result;
      if (!bd.objectStoreNames.contains(TIENDA)) {
        const tienda = bd.createObjectStore(TIENDA, { keyPath: 'id' });
        tienda.createIndex('porCampana', 'campanaId');
        tienda.createIndex('porPersonaje', 'personajeId');
      }
    };
    s.onsuccess = () => resolver(s.result);
    s.onerror = () => rechazar(s.error);
  });
  return promesaBD;
}

function pedir<T>(modo: IDBTransactionMode, fn: (t: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (bd) =>
      new Promise<T>((resolver, rechazar) => {
        const tx = bd.transaction(TIENDA, modo);
        const s = fn(tx.objectStore(TIENDA));
        s.onsuccess = () => resolver(s.result);
        s.onerror = () => rechazar(s.error);
      }),
  );
}

export class ErrorImagen extends Error {}

/**
 * Reescala una imagen manteniendo la proporción y la convierte a WebP.
 * Devuelve el Blob y sus dimensiones finales.
 */
export async function reescalar(
  archivo: Blob,
  ladoMaximo: number,
): Promise<{ blob: Blob; anchura: number; altura: number }> {
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new ErrorImagen('No se ha podido leer la imagen. ¿Seguro que el archivo no está dañado?');
  });

  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const anchura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = anchura;
  lienzo.height = altura;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new ErrorImagen('El navegador no ha permitido procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, anchura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/webp', 0.85));
  if (!blob) throw new ErrorImagen('No se ha podido convertir la imagen.');
  return { blob, anchura, altura };
}

export interface OpcionesGuardado {
  tipo: TipoImagen;
  nombre: string;
  descripcion?: string;
  campanaId: string | null;
  personajeId?: string | null;
}

export async function guardarImagen(archivo: File, opciones: OpcionesGuardado): Promise<Imagen> {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new ErrorImagen(
      `Formato no admitido (${archivo.type || 'desconocido'}). Usa JPG, PNG, WebP, GIF o AVIF.`,
    );
  }
  if (archivo.size > BYTES_MAXIMOS_ENTRADA) {
    throw new ErrorImagen(
      `La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo son ` +
        `${BYTES_MAXIMOS_ENTRADA / 1024 / 1024} MB.`,
    );
  }

  const lado = opciones.tipo === 'retrato' ? LADO_MAXIMO_RETRATO : LADO_MAXIMO;
  const { blob, anchura, altura } = await reescalar(archivo, lado);

  const imagen: Imagen = {
    id: globalThis.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tipo: opciones.tipo,
    nombre: opciones.nombre || archivo.name.replace(/\.[^.]+$/, ''),
    descripcion: opciones.descripcion,
    campanaId: opciones.campanaId,
    personajeId: opciones.personajeId ?? null,
    anchura,
    altura,
    bytes: blob.size,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    datos: blob,
  };

  try {
    await pedir('readwrite', (t) => t.put(imagen));
    await quitarLapida('imagenes', imagen.id);
  } catch (e) {
    // El navegador limita cuánto puede guardar un sitio; conviene decirlo claro.
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new ErrorImagen(
        'No queda espacio en el navegador. Borra alguna imagen antigua o exporta la campaña.',
      );
    }
    throw e;
  }

  return imagen;
}

/**
 * Guarda una imagen ya construida, sin reescalar ni cambiarle la fecha. Se usa al importar
 * y al bajarla de la nube: en los dos casos la fecha que trae es la buena, y ponerle la de
 * ahora haría que pareciera más nueva que la del servidor y se volviera a subir en bucle.
 */
export async function guardarImagenCruda(imagen: Imagen): Promise<void> {
  await pedir('readwrite', (t) => t.put(imagen));
  await quitarLapida('imagenes', imagen.id);
}

export async function obtenerImagen(id: string): Promise<Imagen | undefined> {
  return pedir('readonly', (t) => t.get(id));
}

export async function listarImagenes(campanaId: string | null): Promise<ImagenInfo[]> {
  const todas = await pedir<Imagen[]>('readonly', (t) => t.getAll());
  return todas
    .filter((i) => campanaId === null || i.campanaId === campanaId || i.campanaId === null)
    .map(({ datos: _datos, ...info }) => info)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function borrarImagen(id: string): Promise<void> {
  await pedir('readwrite', (t) => t.delete(id));
  await ponerLapida('imagenes', id);
}

/** Borra sin dejar lápida: el borrado venía de fuera, no hay que devolvérselo. */
export async function borrarImagenCruda(id: string): Promise<void> {
  await pedir('readwrite', (t) => t.delete(id));
}

export async function actualizarImagen(
  id: string,
  cambios: Partial<Pick<Imagen, 'nombre' | 'descripcion' | 'tipo' | 'campanaId'>>,
): Promise<void> {
  const actual = await obtenerImagen(id);
  if (!actual) return;
  await pedir('readwrite', (t) => t.put(tocada({ ...actual, ...cambios })));
}

/** Cuánto ocupan las imágenes, para poder avisar antes de llenar la cuota. */
export async function espacioUsado(): Promise<{ imagenes: number; bytes: number }> {
  const todas = await pedir<Imagen[]>('readonly', (t) => t.getAll());
  return { imagenes: todas.length, bytes: todas.reduce((t, i) => t + i.bytes, 0) };
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
