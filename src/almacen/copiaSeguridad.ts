/**
 * Copia de seguridad completa.
 *
 * La exportación que ya había sirve para **compartir**: una ficha, o unas cuantas, con su
 * retrato. Esto es otra cosa: sirve para **no perder nada**. Se lleva todo lo que hay en
 * este dispositivo —fichas, campañas con sus reglas caseras y su contenido propio,
 * enemigos, la galería entera y las preferencias— y lo devuelve tal cual estaba.
 *
 * Los dos casos de uso piden formatos distintos y por eso son funciones distintas:
 *
 *  - Compartir quiere un archivo pequeño y sólo lo necesario.
 *  - Una copia de seguridad quiere estar **completa** aunque pese, porque el día que hace
 *    falta ya no se puede volver a por lo que faltó.
 *
 * La copia se puede restaurar de dos maneras, y esa elección es del usuario, no de la
 * aplicación: **fusionar** (añade sin tocar lo que ya hay) o **reemplazar** (deja el
 * dispositivo exactamente como estaba el día de la copia, borrando lo demás).
 */

import { migrarPersonaje, type Personaje } from '../motor/personaje';
import { almacen, type Campana, type Enemigo, type Tirada } from './almacen';
import {
  guardarImagenCruda,
  listarImagenes,
  obtenerImagen,
  borrarImagen,
  type Imagen,
  type ImagenInfo,
} from './imagenes';

export const FORMATO = 'anima-manager-copia';
export const VERSION_COPIA = 1;

/** Preferencias que viven en `localStorage` y no en la base de datos. */
export const CLAVES_PREFERENCIAS = ['anima-manager:tema'] as const;

export class ErrorCopia extends Error {}

export interface ImagenEnCopia extends ImagenInfo {
  dataUri: string;
}

export interface CopiaSeguridad {
  formato: typeof FORMATO;
  version: number;
  creadaEn: string;
  personajes: Personaje[];
  campanas: Campana[];
  enemigos: Enemigo[];
  /** El registro de tiradas. Opcional: las copias anteriores a v4 no lo traen. */
  tiradas?: Tirada[];
  /** **Todas** las imágenes, no sólo los retratos: mapas, PNJs, objetos… */
  imagenes: ImagenEnCopia[];
  /** Tema elegido y cualquier otra preferencia del navegador. */
  preferencias: Record<string, string>;
}

export interface ResumenCopia {
  personajes: number;
  campanas: number;
  enemigos: number;
  tiradas: number;
  imagenes: number;
  preferencias: number;
  /** Tamaño aproximado del archivo, para poder avisar antes de descargarlo. */
  bytes: number;
}

/**
 * Los bytes de una imagen, en base64 dentro de una data URI.
 *
 * Se hace con `arrayBuffer()` y no con `FileReader` a propósito: `FileReader` sólo existe
 * en el navegador, y así este módulo —que es justo el que no puede fallar— se puede probar
 * de verdad en vez de a través de un simulacro.
 */
async function aDataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  // De 8 KB en 8 KB: pasarle el array entero a `fromCharCode` desborda la pila.
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binario)}`;
}

async function deDataUri(uri: string): Promise<Blob> {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!m) throw new ErrorCopia('La imagen no está en el formato esperado.');
  const [, tipo, esBase64, cuerpo] = m;
  if (!esBase64) return new Blob([decodeURIComponent(cuerpo)], { type: tipo });
  const binario = atob(cuerpo);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

function leerPreferencias(): Record<string, string> {
  const salida: Record<string, string> = {};
  try {
    for (const clave of CLAVES_PREFERENCIAS) {
      const v = localStorage.getItem(clave);
      if (v !== null) salida[clave] = v;
    }
  } catch {
    // Navegar en privado puede bloquear localStorage. No es motivo para no hacer la copia.
  }
  return salida;
}

function escribirPreferencias(prefs: Record<string, string>): number {
  let escritas = 0;
  try {
    for (const [clave, valor] of Object.entries(prefs)) {
      // Sólo se restauran las claves conocidas: un archivo manipulado no debería poder
      // escribir lo que le apetezca en el almacenamiento del navegador.
      if (!(CLAVES_PREFERENCIAS as readonly string[]).includes(clave)) continue;
      localStorage.setItem(clave, valor);
      escritas++;
    }
  } catch {
    // Igual que al leerlas.
  }
  return escritas;
}

/** Todas las imágenes del dispositivo, con sus bytes dentro. */
async function recogerImagenes(): Promise<ImagenEnCopia[]> {
  // `listarImagenes(null)` devuelve las de todas las campañas más las sueltas.
  const info = await listarImagenes(null);
  const salida: ImagenEnCopia[] = [];
  for (const i of info) {
    const completa = await obtenerImagen(i.id);
    if (!completa) continue;
    const { datos, ...resto } = completa;
    salida.push({ ...resto, dataUri: await aDataUri(datos) });
  }
  return salida;
}

export async function crearCopia(): Promise<CopiaSeguridad> {
  const [personajes, campanas, enemigos, tiradas, imagenes] = await Promise.all([
    almacen.listarPersonajes(),
    almacen.listarCampanas(),
    // `null` trae los de todas las campañas, no sólo los de la activa.
    almacen.listarEnemigos(null),
    almacen.listarTiradas(null),
    recogerImagenes(),
  ]);

  return {
    formato: FORMATO,
    version: VERSION_COPIA,
    creadaEn: new Date().toISOString(),
    personajes,
    campanas,
    enemigos,
    tiradas,
    imagenes,
    preferencias: leerPreferencias(),
  };
}

export function resumirCopia(c: CopiaSeguridad): ResumenCopia {
  return {
    personajes: c.personajes.length,
    campanas: c.campanas.length,
    enemigos: c.enemigos.length,
    tiradas: (c.tiradas ?? []).length,
    imagenes: c.imagenes.length,
    preferencias: Object.keys(c.preferencias).length,
    // Una data URI en base64 ocupa cuatro tercios de lo que ocupan sus bytes.
    bytes: c.imagenes.reduce((t, i) => t + i.dataUri.length, 0) + JSON.stringify({
      ...c,
      imagenes: [],
    }).length,
  };
}

/**
 * Comprueba que un archivo es una copia y qué trae dentro, **sin tocar nada**.
 *
 * Se separa de la restauración a propósito: primero se enseña lo que va a entrar y se deja
 * decidir, y sólo después se escribe. Una restauración que reemplaza borra cosas, y eso no
 * se hace sin enseñar antes qué hay.
 */
export function analizarCopia(
  datos: unknown,
): { ok: true; copia: CopiaSeguridad; resumen: ResumenCopia } | { ok: false; error: string } {
  if (typeof datos !== 'object' || datos === null) {
    return { ok: false, error: 'El archivo no contiene datos válidos.' };
  }
  const c = datos as Partial<CopiaSeguridad>;
  if (c.formato !== FORMATO) {
    return {
      ok: false,
      error:
        'Este archivo no es una copia de seguridad de Anima Manager. Si es una exportación ' +
        'de fichas, impórtala desde «Importar JSON».',
    };
  }
  if (typeof c.version !== 'number' || c.version > VERSION_COPIA) {
    return {
      ok: false,
      error:
        `La copia es de una versión más nueva (${String(c.version)}) que esta aplicación. ` +
        'Actualiza antes de restaurarla.',
    };
  }

  const copia: CopiaSeguridad = {
    formato: FORMATO,
    version: c.version,
    creadaEn: typeof c.creadaEn === 'string' ? c.creadaEn : '',
    personajes: Array.isArray(c.personajes) ? c.personajes : [],
    campanas: Array.isArray(c.campanas) ? c.campanas : [],
    enemigos: Array.isArray(c.enemigos) ? c.enemigos : [],
    tiradas: Array.isArray(c.tiradas) ? c.tiradas : [],
    imagenes: Array.isArray(c.imagenes) ? c.imagenes : [],
    preferencias:
      typeof c.preferencias === 'object' && c.preferencias !== null ? c.preferencias : {},
  };

  return { ok: true, copia, resumen: resumirCopia(copia) };
}

export type ModoRestauracion = 'fusionar' | 'reemplazar';

export interface ResultadoRestauracion {
  personajes: number;
  campanas: number;
  enemigos: number;
  imagenes: number;
  preferencias: number;
  borrados: number;
  /** Lo que no se ha podido restaurar, dicho en vez de callado. */
  fallos: string[];
}

/**
 * Vuelca una copia sobre este dispositivo.
 *
 * En modo **reemplazar** se borra primero lo que hay: el resultado es el dispositivo tal
 * como estaba el día de la copia, ni más ni menos. En modo **fusionar** no se borra nada y
 * lo que coincida por id se sobrescribe con lo de la copia, que es lo que se espera de una
 * restauración: la copia manda sobre lo que haya.
 *
 * Si una imagen viene dañada se anota y se sigue: perder un mapa no es motivo para dejar
 * las fichas a medio restaurar.
 */
export async function restaurarCopia(
  copia: CopiaSeguridad,
  modo: ModoRestauracion,
): Promise<ResultadoRestauracion> {
  const fallos: string[] = [];
  let borrados = 0;

  if (modo === 'reemplazar') {
    const [personajes, campanas, enemigos, tiradas, imagenes] = await Promise.all([
      almacen.listarPersonajes(),
      almacen.listarCampanas(),
      almacen.listarEnemigos(null),
      almacen.listarTiradas(null),
      listarImagenes(null),
    ]);
    for (const p of personajes) await almacen.borrarPersonaje(p.id);
    for (const c of campanas) await almacen.borrarCampana(c.id);
    for (const e of enemigos) await almacen.borrarEnemigo(e.id);
    for (const t of tiradas) await almacen.borrarTirada(t.id);
    for (const i of imagenes) await borrarImagen(i.id);
    borrados =
      personajes.length + campanas.length + enemigos.length + tiradas.length + imagenes.length;
  }

  for (const bruto of copia.personajes) {
    try {
      await almacen.guardarPersonaje(migrarPersonaje(bruto));
    } catch {
      fallos.push(`No he podido restaurar la ficha «${bruto?.nombre ?? bruto?.id}».`);
    }
  }
  for (const c of copia.campanas) {
    try {
      await almacen.guardarCampana(c);
    } catch {
      fallos.push(`No he podido restaurar la campaña «${c?.nombre ?? c?.id}».`);
    }
  }
  for (const e of copia.enemigos) {
    try {
      await almacen.guardarEnemigo(e);
    } catch {
      fallos.push(`No he podido restaurar el enemigo «${e?.nombre ?? e?.id}».`);
    }
  }
  // Las copias anteriores a la v4 no traen tiradas; `?? []` es lo que las hace restaurables.
  for (const t of copia.tiradas ?? []) {
    try {
      await almacen.guardarTirada(t);
    } catch {
      fallos.push(`No he podido restaurar una tirada de «${t?.autor ?? 'alguien'}».`);
    }
  }

  let imagenes = 0;
  for (const i of copia.imagenes) {
    try {
      const { dataUri, ...info } = i;
      const datos = await deDataUri(dataUri);
      await guardarImagenCruda({ ...info, datos } as Imagen);
      imagenes++;
    } catch {
      fallos.push(`No he podido restaurar la imagen «${i?.nombre ?? i?.id}».`);
    }
  }

  return {
    personajes: copia.personajes.length - fallos.filter((f) => f.includes('ficha')).length,
    campanas: copia.campanas.length - fallos.filter((f) => f.includes('campaña')).length,
    enemigos: copia.enemigos.length - fallos.filter((f) => f.includes('enemigo')).length,
    imagenes,
    preferencias: escribirPreferencias(copia.preferencias),
    borrados,
    fallos,
  };
}
