/**
 * Sincronizar imágenes: la ficha técnica a una tabla, el archivo a Storage.
 *
 * Las imágenes son el único caso donde un registro son **dos cosas** —una fila y un
 * archivo— y eso obliga a decidir en qué orden se tocan. La regla aquí es: **primero el
 * archivo, después la fila**. Si falla el archivo no se escribe la fila y no ha pasado
 * nada; si se escribiera antes la fila y luego fallara la subida, quedaría un mapa
 * anunciado que nadie puede descargar, y ese es el estado que peor se arregla solo.
 *
 * Al borrar, al revés: **primero la fila, después el archivo**. Marcar la fila como
 * borrada es lo que hace que el resto de dispositivos se enteren; si el archivo se quedara
 * sin borrar por un fallo de red, lo que queda es basura invisible, no un enlace roto.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fechaDe,
  guardarImagenCruda,
  borrarImagenCruda,
  listarImagenes,
  obtenerImagen,
  type Imagen,
  type ImagenInfo,
  type TipoImagen,
} from '../almacen/imagenes';
import { listarLapidas, quitarLapida } from '../almacen/bd';
import { planificar, lapidasPendientes, type FilaRemota } from './fusion';

const CUBO = 'imagenes';

export interface ResultadoImagenes {
  subidas: number;
  bajadas: number;
  borradasAqui: number;
  lapidasEnviadas: number;
  /** Las que no se han podido subir o bajar, con el motivo. No cortan el resto. */
  fallos: string[];
}

interface FilaImagen {
  id: string;
  propietario: string;
  campana_id: string | null;
  personaje_id: string | null;
  tipo: TipoImagen;
  nombre: string;
  descripcion: string | null;
  anchura: number;
  altura: number;
  bytes: number;
  ruta: string;
  actualizado_en: string;
  borrado: boolean;
}

/** `{uid}/{id}.webp`. La primera carpeta es lo que miran las políticas de Storage. */
export function rutaDe(usuario: string, id: string): string {
  return `${usuario}/${id}.webp`;
}

export async function sincronizarImagenes(
  supa: SupabaseClient,
  usuario: string,
): Promise<ResultadoImagenes> {
  const fallos: string[] = [];

  const { data, error } = await supa
    .from('imagenes')
    .select(
      'id, propietario, campana_id, personaje_id, tipo, nombre, descripcion, anchura, altura, bytes, ruta, actualizado_en, borrado',
    )
    .eq('propietario', usuario);
  if (error) throw new Error(`No se pudo leer el catálogo de imágenes: ${error.message}`);

  const filas = (data ?? []) as unknown as FilaImagen[];
  const porId = new Map(filas.map((f) => [f.id, f]));
  const remotos: FilaRemota[] = filas.map((f) => ({
    id: f.id,
    datos: f,
    actualizado_en: f.actualizado_en,
    borrado: f.borrado,
  }));

  // `listarImagenes(null)` da todas, con o sin campaña.
  const locales = (await listarImagenes(null)).map((i) => ({ ...i, actualizadoEn: fechaDe(i) }));
  const lapidas = await listarLapidas('imagenes');
  const borradosLocales = lapidas.map((l) => ({ id: l.registroId, actualizadoEn: l.actualizadoEn }));

  const plan = planificar(locales, remotos, borradosLocales);

  // ── Subir ────────────────────────────────────────────────────────────────
  let subidas = 0;
  for (const info of plan.subir) {
    try {
      await subirUna(supa, usuario, info);
      subidas++;
    } catch (e) {
      fallos.push(`${info.nombre || info.id}: ${mensaje(e)}`);
    }
  }

  // ── Bajar ────────────────────────────────────────────────────────────────
  let bajadas = 0;
  for (const fila of plan.bajar) {
    const f = fila.datos as FilaImagen;
    try {
      await bajarUna(supa, f);
      bajadas++;
    } catch (e) {
      fallos.push(`${f.nombre || f.id}: ${mensaje(e)}`);
    }
  }

  // ── Borrar aquí lo que se borró en otro sitio ────────────────────────────
  for (const id of plan.borrarLocal) await borrarImagenCruda(id);

  // ── Contar nuestros borrados ─────────────────────────────────────────────
  const pendientes = lapidasPendientes(borradosLocales, remotos);
  let lapidasEnviadas = 0;
  for (const p of pendientes) {
    try {
      const previa = porId.get(p.id);
      // La fila se marca; los datos que quedan (nombre, tamaño) dan igual, pero se
      // conservan los que ya estaban para no inventar una fila nueva vacía.
      const fila: FilaImagen = {
        id: p.id,
        propietario: usuario,
        campana_id: previa?.campana_id ?? null,
        personaje_id: previa?.personaje_id ?? null,
        tipo: previa?.tipo ?? 'otro',
        nombre: previa?.nombre ?? '',
        descripcion: previa?.descripcion ?? null,
        anchura: 0,
        altura: 0,
        bytes: 0,
        ruta: previa?.ruta ?? rutaDe(usuario, p.id),
        actualizado_en: p.actualizadoEn,
        borrado: true,
      };
      const { error: fallo } = await supa.from('imagenes').upsert(fila, { onConflict: 'id' });
      if (fallo) throw new Error(fallo.message);

      // El archivo después de la fila: si esto falla queda basura invisible, que es mucho
      // mejor que una imagen que sigue anunciada y ya no se puede descargar.
      await supa.storage.from(CUBO).remove([fila.ruta]);
      await quitarLapida('imagenes', p.id);
      lapidasEnviadas++;
    } catch (e) {
      // La lápida se queda puesta: se reintentará en la siguiente sincronización, que es
      // exactamente lo que tiene que pasar con un borrado que no se ha podido comunicar.
      fallos.push(`borrado de ${p.id}: ${mensaje(e)}`);
    }
  }

  return { subidas, bajadas, borradasAqui: plan.borrarLocal.length, lapidasEnviadas, fallos };
}

async function subirUna(supa: SupabaseClient, usuario: string, info: ImagenInfo): Promise<void> {
  const completa = await obtenerImagen(info.id);
  if (!completa) throw new Error('la imagen ya no está en este dispositivo');

  const ruta = rutaDe(usuario, info.id);
  const { error: fallo } = await supa.storage.from(CUBO).upload(ruta, completa.datos, {
    contentType: completa.datos.type || 'image/webp',
    // `upsert` porque renombrar una imagen la vuelve a subir: la ruta ya existe y
    // sobrescribirla con el mismo contenido es lo correcto.
    upsert: true,
  });
  if (fallo) throw new Error(fallo.message);

  const fila: FilaImagen = {
    id: info.id,
    propietario: usuario,
    campana_id: info.campanaId,
    personaje_id: info.personajeId ?? null,
    tipo: info.tipo,
    nombre: info.nombre,
    descripcion: info.descripcion ?? null,
    anchura: info.anchura,
    altura: info.altura,
    bytes: info.bytes,
    ruta,
    actualizado_en: fechaDe(info),
    borrado: false,
  };
  const { error: fallo2 } = await supa.from('imagenes').upsert(fila, { onConflict: 'id' });
  if (fallo2) throw new Error(fallo2.message);
}

async function bajarUna(supa: SupabaseClient, fila: FilaImagen): Promise<void> {
  const { data, error } = await supa.storage.from(CUBO).download(fila.ruta);
  if (error) throw new Error(error.message);
  if (!data) throw new Error('el servidor no ha devuelto el archivo');

  const imagen: Imagen = {
    id: fila.id,
    tipo: fila.tipo,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? undefined,
    campanaId: fila.campana_id,
    personajeId: fila.personaje_id,
    anchura: fila.anchura,
    altura: fila.altura,
    bytes: fila.bytes || data.size,
    creadoEn: fila.actualizado_en,
    actualizadoEn: fila.actualizado_en,
    datos: data,
  };
  await guardarImagenCruda(imagen);
}

/**
 * Las imágenes de una campaña que ha subido otra persona.
 *
 * Igual que con las fichas de los jugadores, esto **no se guarda en local**: son de otro,
 * no se pueden editar, y si entraran en IndexedDB la siguiente sincronización intentaría
 * subirlas. Se piden cuando hacen falta y se enseñan.
 */
export async function imagenesDeCampana(
  supa: SupabaseClient,
  campanaId: string,
): Promise<{ imagenes: ImagenInfo[]; error?: string }> {
  const { data, error } = await supa
    .from('imagenes')
    .select(
      'id, propietario, campana_id, personaje_id, tipo, nombre, descripcion, anchura, altura, bytes, ruta, actualizado_en, borrado',
    )
    .eq('campana_id', campanaId)
    .eq('borrado', false);
  if (error) return { imagenes: [], error: error.message };

  const imagenes = ((data ?? []) as unknown as FilaImagen[]).map((f) => ({
    id: f.id,
    tipo: f.tipo,
    nombre: f.nombre,
    descripcion: f.descripcion ?? undefined,
    campanaId: f.campana_id,
    personajeId: f.personaje_id,
    anchura: f.anchura,
    altura: f.altura,
    bytes: f.bytes,
    creadoEn: f.actualizado_en,
    actualizadoEn: f.actualizado_en,
  }));
  return { imagenes };
}

/**
 * Un enlace temporal para enseñar una imagen del servidor sin bajarla al almacén local.
 * El cubo es privado, así que no vale con componer la URL: hay que pedirla firmada.
 */
export async function enlaceTemporal(
  supa: SupabaseClient,
  ruta: string,
  segundos = 3600,
): Promise<string | null> {
  const { data, error } = await supa.storage.from(CUBO).createSignedUrl(ruta, segundos);
  return error ? null : (data?.signedUrl ?? null);
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
