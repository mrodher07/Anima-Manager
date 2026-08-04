/**
 * Lo que hace falta para jugar juntos: perfil, preferencias, invitaciones y las campañas
 * en las que juegas sin ser el máster.
 *
 * Son cuatro cosas pequeñas que comparten una característica: **no son documentos que se
 * sincronicen en los dos sentidos**. Un perfil se escribe y se lee; una invitación se pide
 * y se canjea. Por eso no pasan por `fusion.ts` ni por el motor de sincronización: serían
 * un caso especial dentro de un mecanismo pensado para otra cosa.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Campana } from '../almacen/almacen';

// ── Perfil ────────────────────────────────────────────────────────────────────

export interface Perfil {
  id: string;
  nombre: string;
}

/**
 * El nombre visible. Existe porque el máster necesita saber que la ficha de Zhaira es de
 * Miguel y no de `a3f1…-9c02`, y `auth.users` no se puede leer desde el navegador —lleva
 * correos dentro.
 */
export async function miPerfil(supa: SupabaseClient, usuario: string): Promise<Perfil | null> {
  const { data, error } = await supa.from('perfiles').select('id, nombre').eq('id', usuario).maybeSingle();
  if (error || !data) return null;
  const fila = data as { id: string; nombre: string };
  return { id: fila.id, nombre: fila.nombre };
}

export async function cambiarNombre(
  supa: SupabaseClient,
  usuario: string,
  nombre: string,
): Promise<string | null> {
  const { error } = await supa
    .from('perfiles')
    .upsert(
      { id: usuario, nombre: nombre.trim().slice(0, 60), actualizado_en: new Date().toISOString() },
      { onConflict: 'id' },
    );
  return error ? error.message : null;
}

/** Los nombres de un grupo de usuarios, para no pedirlos de uno en uno. */
export async function nombresDe(supa: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!unicos.length) return new Map();
  const { data, error } = await supa.from('perfiles').select('id, nombre').in('id', unicos);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
}

// ── Preferencias ──────────────────────────────────────────────────────────────

export interface Preferencias {
  tema?: string;
  [clave: string]: unknown;
}

export async function leerPreferencias(
  supa: SupabaseClient,
  usuario: string,
): Promise<{ datos: Preferencias; actualizadoEn: string } | null> {
  const { data, error } = await supa
    .from('preferencias')
    .select('datos, actualizado_en')
    .eq('id', usuario)
    .maybeSingle();
  if (error || !data) return null;
  const fila = data as { datos: Preferencias; actualizado_en: string };
  return { datos: fila.datos ?? {}, actualizadoEn: fila.actualizado_en };
}

export async function guardarPreferencias(
  supa: SupabaseClient,
  usuario: string,
  datos: Preferencias,
): Promise<string | null> {
  const { error } = await supa
    .from('preferencias')
    .upsert({ id: usuario, datos, actualizado_en: new Date().toISOString() }, { onConflict: 'id' });
  return error ? error.message : null;
}

// ── Invitaciones ──────────────────────────────────────────────────────────────

export interface Invitacion {
  codigo: string;
  campanaId: string;
  caducaEn: string | null;
  usos: number;
  usosMaximos: number;
}

/**
 * Pide un código al servidor.
 *
 * Lo genera él, no el navegador: así no hay forma de fabricarse uno que choque con el de
 * otra mesa, y el formato es siempre el mismo —seis caracteres sin las letras que se
 * confunden al dictarlas por teléfono.
 */
export async function crearInvitacion(
  supa: SupabaseClient,
  campanaId: string,
  dias = 30,
  usos = 20,
): Promise<{ codigo?: string; error?: string }> {
  const { data, error } = await supa.rpc('crear_invitacion', {
    id_campana: campanaId,
    dias_validez: dias,
    usos,
  });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; codigo?: string; error?: string };
  return r.ok ? { codigo: r.codigo } : { error: r.error };
}

export async function invitacionesDe(
  supa: SupabaseClient,
  campanaId: string,
): Promise<Invitacion[]> {
  const { data, error } = await supa
    .from('invitaciones_campana')
    .select('codigo, campana_id, caduca_en, usos, usos_maximos')
    .eq('campana_id', campanaId);
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    codigo: String(f.codigo),
    campanaId: String(f.campana_id),
    caducaEn: f.caduca_en ? String(f.caduca_en) : null,
    usos: Number(f.usos ?? 0),
    usosMaximos: Number(f.usos_maximos ?? 0),
  }));
}

export async function borrarInvitacion(supa: SupabaseClient, codigo: string): Promise<void> {
  await supa.from('invitaciones_campana').delete().eq('codigo', codigo);
}

/**
 * Canjear un código.
 *
 * Va por una función del servidor y no por un `insert` porque hay que mirar una tabla que
 * el jugador no puede leer —si pudiera, se podrían listar todos los códigos válidos— y
 * comprobar caducidad y usos antes de dejar entrar.
 */
export async function unirseACampana(
  supa: SupabaseClient,
  codigo: string,
): Promise<{ ok: boolean; campanaId?: string; nombre?: string; yaEstaba?: boolean; error?: string }> {
  const { data, error } = await supa.rpc('unirse_a_campana', { codigo_invitacion: codigo });
  if (error) return { ok: false, error: error.message };
  const r = data as {
    ok: boolean;
    campana_id?: string;
    nombre?: string;
    ya_estaba?: boolean;
    error?: string;
  };
  return r.ok
    ? { ok: true, campanaId: r.campana_id, nombre: r.nombre, yaEstaba: r.ya_estaba }
    : { ok: false, error: r.error };
}

export async function salirDeCampana(
  supa: SupabaseClient,
  campanaId: string,
  usuario: string,
): Promise<void> {
  await supa.from('miembros_campana').delete().eq('campana_id', campanaId).eq('usuario', usuario);
}

// ── Quién juega en qué ────────────────────────────────────────────────────────

export interface Miembro {
  usuario: string;
  nombre: string;
  papel: 'master' | 'jugador';
  unidoEn: string;
}

export async function miembrosDe(supa: SupabaseClient, campanaId: string): Promise<Miembro[]> {
  const { data, error } = await supa
    .from('miembros_campana')
    .select('usuario, papel, unido_en')
    .eq('campana_id', campanaId);
  if (error) return [];

  const filas = (data ?? []) as { usuario: string; papel: string; unido_en: string }[];
  const nombres = await nombresDe(supa, filas.map((f) => f.usuario));
  return filas
    .map((f) => ({
      usuario: f.usuario,
      nombre: nombres.get(f.usuario) ?? 'Sin nombre',
      papel: (f.papel === 'master' ? 'master' : 'jugador') as Miembro['papel'],
      unidoEn: f.unido_en,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Las campañas en las que juego sin ser el máster.
 *
 * Hacen falta de verdad, no son un adorno: la campaña es la que lleva las **reglas caseras
 * y los manuales activos**, y una ficha calculada con el reglamento por defecto no da los
 * mismos números que la misma ficha calculada con el de su mesa. Sin esto, un jugador
 * vería su ficha mal.
 *
 * Son de sólo lectura —el jugador no puede editarlas— y por eso se piden aparte en vez de
 * guardarse en el almacén local: si entraran ahí, la siguiente sincronización intentaría
 * subirlas y el servidor la rechazaría.
 */
export async function campanasDondeJuego(
  supa: SupabaseClient,
  usuario: string,
): Promise<{ campanas: Campana[]; error?: string }> {
  const { data: pertenencias, error: fallo } = await supa
    .from('miembros_campana')
    .select('campana_id')
    .eq('usuario', usuario);
  if (fallo) return { campanas: [], error: fallo.message };

  const ids = ((pertenencias ?? []) as { campana_id: string }[]).map((m) => m.campana_id);
  if (!ids.length) return { campanas: [] };

  const { data, error } = await supa
    .from('campanas')
    .select('id, datos, actualizado_en, borrado')
    .in('id', ids)
    .eq('borrado', false);
  if (error) return { campanas: [], error: error.message };

  const campanas = ((data ?? []) as { id: string; datos: unknown; actualizado_en: string }[])
    .map((f) => {
      if (typeof f.datos !== 'object' || f.datos === null) return null;
      return {
        ...(f.datos as Campana),
        id: f.id,
        actualizadoEn: f.actualizado_en,
      } as Campana;
    })
    .filter((c): c is Campana => c !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { campanas };
}
