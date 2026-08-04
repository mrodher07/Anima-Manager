/**
 * La base de datos local y las lápidas.
 *
 * Esto vivía dentro de `almacen.ts` hasta que las imágenes también tuvieron que dejar
 * constancia de sus borrados. Como `almacen.ts` ya importa de `imagenes.ts`, que
 * `imagenes.ts` importara de `almacen.ts` habría cerrado un círculo. Lo que las dos
 * necesitan —abrir la base y apuntar un borrado— se queda aquí, que no importa a nadie.
 */

export const TIENDAS = ['personajes', 'campanas', 'enemigos'] as const;
export type Tienda = (typeof TIENDAS)[number];

/**
 * Todo lo que se sincroniza. Las imágenes no están en esta base de datos —tienen la suya,
 * porque un Blob no debe compartir almacén con las fichas— pero sus borrados sí se apuntan
 * aquí, para que haya un único sitio donde mirar qué falta por comunicar.
 */
export type Coleccion = Tienda | 'imagenes';

const BD = 'anima-manager';
const VERSION = 3;
const BORRADOS = 'borrados';

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
export interface Lapida {
  /** `tienda:id`, para que dos colecciones puedan usar el mismo id sin pisarse. */
  clave: string;
  tienda: Coleccion;
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

export function transaccion<T>(
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

const clave = (coleccion: Coleccion, id: string) => `${coleccion}:${id}`;

/** Deja constancia de un borrado para que la nube pueda enterarse más tarde. */
export async function ponerLapida(coleccion: Coleccion, registroId: string): Promise<void> {
  const lapida: Lapida = {
    clave: clave(coleccion, registroId),
    tienda: coleccion,
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
export async function quitarLapida(coleccion: Coleccion, registroId: string): Promise<void> {
  await transaccion(BORRADOS, 'readwrite', (s) => s.delete(clave(coleccion, registroId)));
}

/** Todo lo que se ha borrado aquí, para poder comunicárselo a la nube. */
export async function listarLapidas(coleccion?: Coleccion): Promise<Lapida[]> {
  const todas = await transaccion<Lapida[]>(BORRADOS, 'readonly', (s) => s.getAll());
  return coleccion ? todas.filter((l) => l.tienda === coleccion) : todas;
}
