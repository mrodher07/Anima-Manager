/**
 * El motor de sincronización: llevar y traer entre IndexedDB y Supabase.
 *
 * **IndexedDB sigue siendo con lo que trabaja la aplicación.** Nada de esto está en el
 * camino de guardar una ficha: se guarda en local, la pantalla responde al instante, y la
 * nube se entera cuando puede. Si no hay conexión, o no hay cuenta, o el servidor está
 * caído, la aplicación funciona igual. Eso es lo que significa «local-first», y es la razón
 * de que la sincronización viva aquí, aparte, y no dentro del almacén.
 *
 * Lo que decide **qué gana** está en `fusion.ts`, que son funciones puras y se pueden
 * probar. Este archivo es el que habla con la red: lee, aplica el plan y cuenta lo que ha
 * hecho.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { almacen, type Campana, type Enemigo, type Tienda } from '../almacen/almacen';
import { migrarPersonaje, type Personaje } from '../motor/personaje';
import { planificar, lapidasPendientes, type FilaRemota, type Sincronizable } from './fusion';

/** Cada tienda local se corresponde con una tabla que se llama igual. */
const TABLAS: Record<Tienda, string> = {
  personajes: 'personajes',
  campanas: 'campanas',
  enemigos: 'enemigos',
};

export interface ResultadoTienda {
  tienda: Tienda;
  subidos: number;
  bajados: number;
  borradosAqui: number;
  lapidasEnviadas: number;
  error?: string;
}

export interface Resultado {
  ok: boolean;
  cuando: string;
  tiendas: ResultadoTienda[];
  /** El primer error que impidió terminar, si lo hubo. */
  error?: string;
}

/** Las columnas que se sacan del jsonb. El resto del registro vive dentro de `datos`. */
interface FilaEscribible {
  id: string;
  propietario: string;
  datos: unknown;
  actualizado_en: string;
  borrado: boolean;
  campana_id?: string | null;
}

/**
 * Las campañas van primero **por orden, no por gusto**: `personajes.campana_id` y
 * `enemigos.campana_id` apuntan a `campanas.id`. Si se subiera una ficha antes que su
 * campaña, la base de datos rechazaría la fila entera por clave ajena.
 */
const ORDEN: Tienda[] = ['campanas', 'personajes', 'enemigos'];

/**
 * Sincroniza las tres colecciones.
 *
 * Nunca lanza: una sincronización que falla no puede tumbar la aplicación, porque todo lo
 * importante ya está guardado en local. Los problemas se devuelven en el resultado para que
 * la pantalla pueda enseñarlos con calma.
 */
export async function sincronizar(supa: SupabaseClient, usuario: string): Promise<Resultado> {
  const tiendas: ResultadoTienda[] = [];
  let error: string | undefined;

  // Qué campañas existen ya en el servidor, para no mandar una `campana_id` que la base de
  // datos no pueda resolver. Se calcula después de subir las campañas, así que se hace
  // dentro del bucle, en cuanto le toca a `campanas`.
  let campanasConocidas = new Set<string>();

  for (const tienda of ORDEN) {
    try {
      const resultado = await sincronizarTienda(supa, usuario, tienda, campanasConocidas);
      tiendas.push(resultado);
      if (tienda === 'campanas') campanasConocidas = await idsDeCampanas(supa);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      tiendas.push({
        tienda,
        subidos: 0,
        bajados: 0,
        borradosAqui: 0,
        lapidasEnviadas: 0,
        error: mensaje,
      });
      error ??= mensaje;
    }
  }

  return { ok: !error, cuando: new Date().toISOString(), tiendas, error };
}

async function idsDeCampanas(supa: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supa.from('campanas').select('id');
  if (error) return new Set();
  return new Set((data ?? []).map((f) => String((f as { id: unknown }).id)));
}

async function sincronizarTienda(
  supa: SupabaseClient,
  usuario: string,
  tienda: Tienda,
  campanasConocidas: Set<string>,
): Promise<ResultadoTienda> {
  const tabla = TABLAS[tienda];

  // Sólo lo mío. Lo de los demás —las fichas de mis jugadores si soy máster— se consulta
  // aparte y no se guarda aquí: ver `fichasDeCampana`.
  const columnas =
    tienda === 'campanas'
      ? 'id, datos, actualizado_en, borrado'
      : 'id, datos, actualizado_en, borrado, campana_id';
  const { data, error } = await supa.from(tabla).select(columnas).eq('propietario', usuario);
  if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);

  const campanaRemotaDe = new Map<string, string | null>();
  const remotos: FilaRemota[] = (data ?? []).map((f) => {
    // Doble conversión: la lista de columnas se decide en tiempo de ejecución y los tipos
    // de supabase-js sólo saben deducir la forma de la fila con una cadena literal.
    const fila = f as unknown as {
      id: unknown;
      datos: unknown;
      actualizado_en: unknown;
      borrado: unknown;
      campana_id?: unknown;
    };
    const id = String(fila.id);
    if (tienda !== 'campanas') {
      campanaRemotaDe.set(id, fila.campana_id == null ? null : String(fila.campana_id));
    }
    return {
      id,
      datos: fila.datos,
      actualizado_en: String(fila.actualizado_en),
      borrado: Boolean(fila.borrado),
    };
  });

  const locales = await leerLocales(tienda);
  const lapidas = await almacen.listarLapidas(tienda);
  const borradosLocales = lapidas.map((l) => ({ id: l.registroId, actualizadoEn: l.actualizadoEn }));

  const plan = planificar(locales, remotos, borradosLocales);

  // ── Subir ────────────────────────────────────────────────────────────────
  if (plan.subir.length) {
    const filas = plan.subir.map((registro) => aFila(tienda, registro, usuario, campanasConocidas));
    const { error: fallo } = await supa.from(tabla).upsert(filas, { onConflict: 'id' });
    if (fallo) throw new Error(`No se pudo escribir en ${tabla}: ${fallo.message}`);

    // Una ficha creada antes de tener cuenta no tiene dueño. Al subirla pasa a ser mía, y
    // eso hay que apuntarlo también aquí — con su fecha original, para no provocar otra
    // subida en la siguiente vuelta.
    for (const registro of plan.subir) {
      if ('propietario' in registro && (registro as { propietario: unknown }).propietario !== usuario) {
        await almacen.guardarCrudo(tienda, { ...registro, propietario: usuario });
      }
    }
  }

  // ── Bajar ────────────────────────────────────────────────────────────────
  let bajados = 0;
  for (const fila of plan.bajar) {
    const registro = normalizar(tienda, fila);
    if (!registro) continue; // fila corrupta: se ignora antes que romper el almacén local
    await almacen.guardarCrudo(tienda, registro);
    bajados++;
  }

  // ── Borrar aquí lo que se borró en otro sitio ────────────────────────────
  for (const id of plan.borrarLocal) await almacen.borrarCrudo(tienda, id);

  // ── Arreglar la columna de campaña que se quedó a medias ─────────────────
  //
  // Al subir una ficha cuya campaña todavía no existía en el servidor, `campana_id` se dejó
  // a null para que la clave ajena no rechazara la fila. Si no se corrigiera nunca, el
  // máster no vería esa ficha —la busca por esa columna— y el fallo sería mudo: la ficha
  // está subida, con su campaña dentro del jsonb, pero invisible para la mesa. Como el
  // registro local ya no cambia, no vuelve a entrar en `subir` por su cuenta; hay que
  // buscarlo a propósito.
  let corregidos = 0;
  if (tienda !== 'campanas') {
    const aCorregir = locales.filter((l) => {
      if (plan.subir.includes(l)) return false; // ya se está subiendo entero
      const deseada = (l as { campanaId?: string | null }).campanaId ?? null;
      const resoluble = deseada && campanasConocidas.has(deseada) ? deseada : null;
      return campanaRemotaDe.has(l.id) && campanaRemotaDe.get(l.id) !== resoluble;
    });
    if (aCorregir.length) {
      const filas = aCorregir.map((l) => aFila(tienda, l, usuario, campanasConocidas));
      const { error: fallo } = await supa.from(tabla).upsert(filas, { onConflict: 'id' });
      if (fallo) throw new Error(`No se pudo asignar la campaña en ${tabla}: ${fallo.message}`);
      corregidos = aCorregir.length;
    }
  }

  // ── Contar nuestros borrados al servidor ─────────────────────────────────
  const pendientes = lapidasPendientes(borradosLocales, remotos);
  if (pendientes.length) {
    const filas: FilaEscribible[] = pendientes.map((p) => ({
      id: p.id,
      propietario: usuario,
      // La lápida no lleva los datos: borrar no es archivar. Se guarda el id y la fecha,
      // que es lo único que hace falta para que el resto de dispositivos se enteren.
      datos: {},
      actualizado_en: p.actualizadoEn,
      borrado: true,
      ...(tienda === 'campanas' ? {} : { campana_id: null }),
    }));
    const { error: fallo } = await supa.from(tabla).upsert(filas, { onConflict: 'id' });
    if (fallo) throw new Error(`No se pudieron comunicar los borrados de ${tabla}: ${fallo.message}`);
    for (const p of pendientes) await almacen.olvidarLapida(tienda, p.id);
  }

  return {
    tienda,
    subidos: plan.subir.length + corregidos,
    bajados,
    borradosAqui: plan.borrarLocal.length,
    lapidasEnviadas: pendientes.length,
  };
}

async function leerLocales(tienda: Tienda): Promise<Sincronizable[]> {
  if (tienda === 'personajes') return almacen.listarPersonajes();
  if (tienda === 'campanas') return almacen.listarCampanas();
  return almacen.listarEnemigos(null);
}

function aFila(
  tienda: Tienda,
  registro: Sincronizable,
  usuario: string,
  campanasConocidas: Set<string>,
): FilaEscribible {
  const fila: FilaEscribible = {
    id: registro.id,
    propietario: usuario,
    datos: { ...registro, propietario: usuario },
    actualizado_en: registro.actualizadoEn,
    borrado: false,
  };
  if (tienda !== 'campanas') {
    // La columna es sólo para poder filtrar. La verdad está dentro de `datos`, así que si
    // la campaña todavía no existe en el servidor se deja a null en vez de fallar: cuando
    // la campaña suba, la siguiente sincronización la rellenará.
    const campanaId = (registro as { campanaId?: string | null }).campanaId ?? null;
    fila.campana_id = campanaId && campanasConocidas.has(campanaId) ? campanaId : null;
  }
  return fila;
}

/**
 * Convierte lo que baja del servidor en un registro que el almacén local pueda guardar.
 *
 * Devuelve `null` si la fila no tiene forma de registro. Es defensivo a propósito: `datos`
 * es un jsonb y podría venir de una versión más nueva de la aplicación, de una restauración
 * a medias o de alguien tocando la tabla a mano.
 */
function normalizar(tienda: Tienda, fila: FilaRemota): { id: string } | null {
  const datos = fila.datos;
  if (typeof datos !== 'object' || datos === null) return null;
  const registro = { ...(datos as Record<string, unknown>) };
  registro.id = fila.id;
  registro.actualizadoEn = fila.actualizado_en;
  if (tienda === 'personajes') return migrarPersonaje(registro as unknown as Personaje);
  return registro as unknown as { id: string };
}

/**
 * Las fichas de quienes juegan en una campaña, para el máster.
 *
 * **No se guardan en local a propósito.** El máster puede leerlas pero no escribirlas —así
 * están puestas las políticas, porque la ficha de un jugador es del jugador—, y si entraran
 * en IndexedDB acabarían mezcladas con las suyas y la siguiente sincronización intentaría
 * subirlas y se llevaría un rechazo. Se consultan cuando hacen falta y se enseñan, y ya.
 */
export async function fichasDeCampana(
  supa: SupabaseClient,
  campanaId: string,
): Promise<{ personajes: Personaje[]; error?: string }> {
  const { data, error } = await supa
    .from('personajes')
    .select('id, datos, actualizado_en, borrado')
    .eq('campana_id', campanaId)
    .eq('borrado', false);
  if (error) return { personajes: [], error: error.message };

  const personajes: Personaje[] = [];
  for (const f of data ?? []) {
    const fila = f as { id: unknown; datos: unknown; actualizado_en: unknown };
    const registro = normalizar('personajes', {
      id: String(fila.id),
      datos: fila.datos,
      actualizado_en: String(fila.actualizado_en),
      borrado: false,
    });
    if (registro) personajes.push(registro as unknown as Personaje);
  }
  return { personajes: personajes.sort((a, b) => a.nombre.localeCompare(b.nombre)) };
}

/** Resumen de una sincronización, para enseñarlo de una línea. */
export function resumir(resultado: Resultado): string {
  if (resultado.error) return `Error al sincronizar: ${resultado.error}`;
  const subidos = suma(resultado.tiendas, (t) => t.subidos + t.lapidasEnviadas);
  const bajados = suma(resultado.tiendas, (t) => t.bajados);
  const borrados = suma(resultado.tiendas, (t) => t.borradosAqui);
  const partes: string[] = [];
  if (subidos) partes.push(`${subidos} enviados`);
  if (bajados) partes.push(`${bajados} recibidos`);
  if (borrados) partes.push(`${borrados} borrados aquí`);
  return partes.length ? partes.join(', ') : 'Ya estaba todo al día';
}

function suma(tiendas: ResultadoTienda[], fn: (t: ResultadoTienda) => number): number {
  return tiendas.reduce((total, t) => total + fn(t), 0);
}

// Tipos re-exportados por comodidad de quien use el módulo.
export type { Campana, Enemigo };
