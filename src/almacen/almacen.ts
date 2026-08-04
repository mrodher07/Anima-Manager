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
import {
  listarLapidas,
  ponerLapida,
  quitarLapida,
  transaccion,
  type Coleccion,
  type Lapida,
  type Tienda,
} from './bd';
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

/**
 * Una tirada del registro de partida.
 *
 * Hasta ahora el registro vivía en un `useState` y desaparecía al recargar o al cambiar de
 * pestaña: en mitad de una sesión, media hora de tiradas se iba porque alguien tocó el
 * botón de atrás. Guardarlas cuesta poco y tiene dos ventajas más: la partida se puede
 * repasar después, y con nube el Director ve lo que han sacado sus jugadores sin que se lo
 * canten.
 *
 * `actualizadoEn` hace también de fecha de la tirada. No es un atajo perezoso: una tirada
 * no se edita nunca, así que las dos fechas serían siempre la misma, y la sincronización
 * necesita ese campo con ese nombre.
 */
export interface Tirada {
  id: string;
  campanaId: string | null;
  personajeId: string | null;
  /** Quién tiró, en texto, para poder leer el registro sin ir a buscar la ficha. */
  autor: string;
  actualizadoEn: string;
  texto: string;
  detalle: string;
  critico?: boolean;
}

/**
 * Cuántas tiradas se guardan por campaña. Una sesión larga son unas decenas; doscientas
 * cubren varias sesiones y evitan que el registro crezca sin fin en un dispositivo que
 * nadie limpia nunca.
 */
export const TIRADAS_GUARDADAS = 200;

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

function marcar<T extends { actualizadoEn: string }>(registro: T): T {
  return { ...registro, actualizadoEn: new Date().toISOString() };
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

  /** Las tiradas de una campaña, de la más reciente a la más antigua. */
  async listarTiradas(campanaId: string | null): Promise<Tirada[]> {
    const todas = await transaccion<Tirada[]>('tiradas', 'readonly', (s) => s.getAll());
    return todas
      .filter((t) => campanaId === null || t.campanaId === campanaId)
      .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
  },

  /**
   * Apunta una tirada y poda las viejas de esa campaña.
   *
   * La poda deja lápida, igual que un borrado a mano: si no, las tiradas podadas aquí
   * volverían del servidor en la siguiente sincronización y el registro no adelgazaría
   * nunca.
   */
  async guardarTirada(t: Tirada): Promise<void> {
    await transaccion('tiradas', 'readwrite', (s) => s.put(t));
    await quitarLapida('tiradas', t.id);

    const suyas = await this.listarTiradas(t.campanaId);
    for (const vieja of suyas.slice(TIRADAS_GUARDADAS)) {
      await transaccion('tiradas', 'readwrite', (s) => s.delete(vieja.id));
      await ponerLapida('tiradas', vieja.id);
    }
  },

  async borrarTirada(id: string): Promise<void> {
    await transaccion('tiradas', 'readwrite', (s) => s.delete(id));
    await ponerLapida('tiradas', id);
  },

  /** Vaciar el registro de una campaña. Lo pide el Director cuando acaba una sesión. */
  async vaciarTiradas(campanaId: string | null): Promise<number> {
    const suyas = await this.listarTiradas(campanaId);
    for (const t of suyas) await this.borrarTirada(t.id);
    return suyas.length;
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
  async listarLapidas(coleccion?: Coleccion): Promise<Lapida[]> {
    return listarLapidas(coleccion);
  },

  /** Una lápida ya comunicada deja de hacer falta. */
  async olvidarLapida(coleccion: Coleccion, registroId: string): Promise<void> {
    await quitarLapida(coleccion, registroId);
  },
};

export type { Coleccion, Lapida, Tienda };

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
