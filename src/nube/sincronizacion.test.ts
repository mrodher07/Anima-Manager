import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { personajeVacio, type Personaje } from '../motor/personaje';
import type { Campana, Enemigo, Lapida, Tienda } from '../almacen/almacen';

/**
 * Ni IndexedDB ni Supabase existen aquí, y es justo lo que interesa: lo que se prueba es
 * **el orden de las operaciones y las cuentas**, no el motor de base de datos ni la red.
 * Los dos lados son de mentira, pero se comportan como los de verdad en lo que importa:
 * el almacén guarda por id y el servidor rechaza lo que rechazaría de verdad.
 */
const bd = {
  personajes: new Map<string, Personaje>(),
  campanas: new Map<string, Campana>(),
  enemigos: new Map<string, Enemigo>(),
  tiradas: new Map<string, { id: string }>(),
  lapidas: new Map<string, Lapida>(),
};

const tiendaDe = (t: Tienda) => bd[t] as Map<string, { id: string }>;

vi.mock('../almacen/almacen', () => ({
  almacen: {
    listarPersonajes: async () => [...bd.personajes.values()],
    listarCampanas: async () => [...bd.campanas.values()],
    listarEnemigos: async () => [...bd.enemigos.values()],
    listarTiradas: async () => [...bd.tiradas.values()],
    guardarCrudo: async (t: Tienda, r: { id: string }) => {
      tiendaDe(t).set(r.id, r);
      bd.lapidas.delete(`${t}:${r.id}`);
    },
    borrarCrudo: async (t: Tienda, id: string) => void tiendaDe(t).delete(id),
    listarLapidas: async (t?: Tienda) =>
      [...bd.lapidas.values()].filter((l) => !t || l.tienda === t),
    olvidarLapida: async (t: Tienda, id: string) => void bd.lapidas.delete(`${t}:${id}`),
  },
}));

/**
 * Las imágenes se prueban aparte, en `imagenesNube.test.ts`: llevan archivo además de
 * fila y tienen su propia lógica. Aquí se sustituyen para poder comprobar una cosa
 * concreta —que un fallo suyo no se lleva por delante a las fichas— sin arrastrar Storage.
 */
const imagenes = { subidas: 0, bajadas: 0, borradasAqui: 0, lapidasEnviadas: 0, fallos: [] as string[] };
let imagenesLanza: string | null = null;

vi.mock('./imagenesNube', () => ({
  sincronizarImagenes: async () => {
    if (imagenesLanza) throw new Error(imagenesLanza);
    return imagenes;
  },
}));

const { sincronizar, fichasDeCampana, resumir } = await import('./sincronizacion');

const YO = 'usuario-1';
const OTRO = 'usuario-2';
const AYER = '2026-08-03T10:00:00.000Z';
const HOY = '2026-08-04T10:00:00.000Z';
const LUEGO = '2026-08-04T18:00:00.000Z';

// ── Servidor de mentira ───────────────────────────────────────────────────────

interface FilaServidor {
  id: string;
  propietario: string;
  datos: unknown;
  actualizado_en: string;
  borrado: boolean;
  campana_id?: string | null;
}

/** Lo que el servidor tiene guardado y lo que se le ha pedido. */
const servidor = {
  tablas: {
    campanas: new Map<string, FilaServidor>(),
    personajes: new Map<string, FilaServidor>(),
    enemigos: new Map<string, FilaServidor>(),
    tiradas: new Map<string, FilaServidor>(),
  } as Record<string, Map<string, FilaServidor>>,
  /** Tablas que deben fallar, para probar que un error no tumba la sincronización. */
  falla: new Set<string>(),
  /** Orden en el que se ha escrito cada tabla. Sirve para comprobar que las campañas van antes. */
  escrituras: [] as string[],
};

function clienteFalso(): SupabaseClient {
  return {
    from(tabla: string) {
      const filas = servidor.tablas[tabla];
      const consulta = {
        _filtros: [] as [string, unknown][],
        select() {
          return this;
        },
        eq(columna: string, valor: unknown) {
          this._filtros.push([columna, valor]);
          return this;
        },
        then(resolver: (r: { data: unknown[] | null; error: { message: string } | null }) => void) {
          if (servidor.falla.has(tabla)) {
            resolver({ data: null, error: { message: 'la red se fue' } });
            return;
          }
          const datos = [...filas.values()].filter((f) =>
            this._filtros.every(([c, v]) => (f as unknown as Record<string, unknown>)[c] === v),
          );
          resolver({ data: datos, error: null });
        },
        upsert(nuevas: FilaServidor[]) {
          servidor.escrituras.push(tabla);
          return {
            then(resolver: (r: { error: { message: string } | null }) => void) {
              if (servidor.falla.has(tabla)) {
                resolver({ error: { message: 'la red se fue' } });
                return;
              }
              for (const f of nuevas) {
                // Como el servidor de verdad: no se puede escribir lo de otro.
                const previa = filas.get(f.id);
                if (previa && previa.propietario !== f.propietario) {
                  resolver({ error: { message: 'row-level security' } });
                  return;
                }
                // Clave ajena: `campana_id` tiene que existir o venir a null.
                if (f.campana_id && !servidor.tablas.campanas.has(f.campana_id)) {
                  resolver({ error: { message: 'violates foreign key constraint' } });
                  return;
                }
                filas.set(f.id, f);
              }
              resolver({ error: null });
            },
          };
        },
      };
      return consulta as unknown as ReturnType<SupabaseClient['from']>;
    },
  } as unknown as SupabaseClient;
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function ficha(id: string, actualizadoEn: string, campanaId: string | null = null): Personaje {
  return { ...personajeVacio(id), nombre: id, actualizadoEn, campanaId, propietario: null };
}

function campana(id: string, actualizadoEn: string): Campana {
  return {
    id,
    propietario: null,
    actualizadoEn,
    nombre: id,
    paquetes: [],
    ajustes: {} as Campana['ajustes'],
    notasSesion: [],
  };
}

function enServidor(tabla: string, fila: Partial<FilaServidor> & { id: string }) {
  servidor.tablas[tabla].set(fila.id, {
    propietario: YO,
    datos: { id: fila.id, nombre: fila.id, actualizadoEn: fila.actualizado_en ?? HOY },
    actualizado_en: HOY,
    borrado: false,
    ...fila,
  });
}

beforeEach(() => {
  bd.personajes.clear();
  bd.campanas.clear();
  bd.enemigos.clear();
  bd.tiradas.clear();
  bd.lapidas.clear();
  for (const t of Object.values(servidor.tablas)) t.clear();
  servidor.falla.clear();
  servidor.escrituras = [];
  Object.assign(imagenes, { subidas: 0, bajadas: 0, borradasAqui: 0, lapidasEnviadas: 0, fallos: [] });
  imagenesLanza = null;
});

// ── Pruebas ───────────────────────────────────────────────────────────────────

describe('sincronizar', () => {
  it('sube lo que sólo está aquí', async () => {
    bd.personajes.set('a', ficha('a', HOY));
    const resultado = await sincronizar(clienteFalso(), YO);

    expect(resultado.ok).toBe(true);
    expect(servidor.tablas.personajes.get('a')?.actualizado_en).toBe(HOY);
    expect(resumir(resultado)).toBe('1 enviados');
  });

  it('le pone dueño a una ficha creada antes de tener cuenta', async () => {
    bd.personajes.set('a', ficha('a', HOY));
    await sincronizar(clienteFalso(), YO);

    expect(servidor.tablas.personajes.get('a')?.propietario).toBe(YO);
    // Y también aquí, para que la próxima vez ya no cuente como cambio.
    expect(bd.personajes.get('a')?.propietario).toBe(YO);
  });

  it('no le cambia la fecha a lo que baja de la nube', async () => {
    // Si al guardar se le pusiera la fecha de ahora, quedaría más nueva que la del
    // servidor y la siguiente sincronización la volvería a subir. Y la siguiente. Y la
    // siguiente.
    enServidor('personajes', { id: 'a', actualizado_en: AYER });
    const cliente = clienteFalso();

    await sincronizar(cliente, YO);
    expect(bd.personajes.get('a')?.actualizadoEn).toBe(AYER);

    servidor.escrituras = [];
    const segunda = await sincronizar(cliente, YO);
    expect(servidor.escrituras).toEqual([]);
    expect(resumir(segunda)).toBe('Ya estaba todo al día');
  });

  it('gana la versión más reciente', async () => {
    bd.personajes.set('a', { ...ficha('a', LUEGO), nombre: 'la mía' });
    enServidor('personajes', {
      id: 'a',
      actualizado_en: HOY,
      datos: { id: 'a', nombre: 'la vieja', actualizadoEn: HOY },
    });

    await sincronizar(clienteFalso(), YO);
    expect((servidor.tablas.personajes.get('a')?.datos as Personaje).nombre).toBe('la mía');
    expect(bd.personajes.get('a')?.nombre).toBe('la mía');
  });

  it('trae la del servidor cuando es la más reciente', async () => {
    bd.personajes.set('a', { ...ficha('a', AYER), nombre: 'la mía vieja' });
    enServidor('personajes', {
      id: 'a',
      actualizado_en: LUEGO,
      datos: { id: 'a', nombre: 'la nueva', actualizadoEn: LUEGO },
    });

    await sincronizar(clienteFalso(), YO);
    expect(bd.personajes.get('a')?.nombre).toBe('la nueva');
  });

  it('comunica un borrado hecho aquí', async () => {
    enServidor('personajes', { id: 'a', actualizado_en: AYER });
    bd.lapidas.set('personajes:a', {
      clave: 'personajes:a',
      tienda: 'personajes',
      registroId: 'a',
      actualizadoEn: HOY,
    });

    await sincronizar(clienteFalso(), YO);

    expect(servidor.tablas.personajes.get('a')?.borrado).toBe(true);
    // Comunicada la lápida, ya no hace falta guardarla.
    expect(bd.lapidas.size).toBe(0);
  });

  it('no resucita una ficha borrada aquí que el servidor todavía tiene viva', async () => {
    enServidor('personajes', { id: 'a', actualizado_en: AYER });
    bd.lapidas.set('personajes:a', {
      clave: 'personajes:a',
      tienda: 'personajes',
      registroId: 'a',
      actualizadoEn: HOY,
    });

    await sincronizar(clienteFalso(), YO);
    expect(bd.personajes.has('a')).toBe(false);
  });

  it('borra aquí lo que se borró en otro dispositivo', async () => {
    bd.personajes.set('a', ficha('a', AYER));
    enServidor('personajes', { id: 'a', actualizado_en: HOY, borrado: true });

    const resultado = await sincronizar(clienteFalso(), YO);
    expect(bd.personajes.has('a')).toBe(false);
    expect(resumir(resultado)).toBe('1 borrados aquí');
  });

  it('no se baja una lápida como si fuera una ficha', async () => {
    enServidor('personajes', { id: 'a', actualizado_en: HOY, borrado: true, datos: {} });
    await sincronizar(clienteFalso(), YO);
    expect(bd.personajes.size).toBe(0);
  });

  it('sube las campañas antes que las fichas', async () => {
    // Sin este orden, `personajes.campana_id` apuntaría a una campaña que aún no existe y
    // la base de datos rechazaría la fila entera.
    bd.campanas.set('c1', campana('c1', HOY));
    bd.personajes.set('a', ficha('a', HOY, 'c1'));

    const resultado = await sincronizar(clienteFalso(), YO);

    expect(resultado.ok).toBe(true);
    expect(servidor.escrituras).toEqual(['campanas', 'personajes']);
    expect(servidor.tablas.personajes.get('a')?.campana_id).toBe('c1');
  });

  it('deja campana_id a null si la campaña no está en el servidor, sin perder el dato', async () => {
    // La campaña es de otro máster y este jugador todavía no la ve. La columna es sólo un
    // índice: la verdad está en el jsonb, así que la ficha se sube igual.
    bd.personajes.set('a', ficha('a', HOY, 'campana-ajena'));

    const resultado = await sincronizar(clienteFalso(), YO);

    expect(resultado.ok).toBe(true);
    const fila = servidor.tablas.personajes.get('a')!;
    expect(fila.campana_id).toBeNull();
    expect((fila.datos as Personaje).campanaId).toBe('campana-ajena');
  });

  it('rellena la campaña que se quedó a null cuando ya se puede resolver', async () => {
    // La ficha se subió cuando su campaña todavía no estaba en el servidor, así que su
    // `campana_id` quedó a null. Si no se corrigiera, el máster nunca vería esa ficha —la
    // busca por esa columna— y el fallo sería mudo: la ficha está subida y parece correcta.
    const p = { ...ficha('a', HOY, 'c1'), propietario: YO };
    bd.personajes.set('a', p);
    bd.campanas.set('c1', { ...campana('c1', HOY), propietario: YO });
    enServidor('campanas', { id: 'c1', actualizado_en: HOY, datos: { ...campana('c1', HOY), propietario: YO } });
    enServidor('personajes', { id: 'a', actualizado_en: HOY, campana_id: null, datos: p });

    const resultado = await sincronizar(clienteFalso(), YO);

    expect(resultado.ok).toBe(true);
    expect(servidor.tablas.personajes.get('a')?.campana_id).toBe('c1');
    expect(resultado.tiendas.find((t) => t.tienda === 'personajes')?.subidos).toBe(1);
  });

  it('no reescribe nada si la columna de campaña ya está bien', async () => {
    const p = { ...ficha('a', HOY, 'c1'), propietario: YO };
    bd.personajes.set('a', p);
    bd.campanas.set('c1', { ...campana('c1', HOY), propietario: YO });
    enServidor('campanas', { id: 'c1', actualizado_en: HOY, datos: { ...campana('c1', HOY), propietario: YO } });
    enServidor('personajes', { id: 'a', actualizado_en: HOY, campana_id: 'c1', datos: p });

    await sincronizar(clienteFalso(), YO);
    expect(servidor.escrituras).toEqual([]);
  });

  it('no se lleva por delante lo demás cuando una tabla falla', async () => {
    servidor.falla.add('enemigos');
    bd.personajes.set('a', ficha('a', HOY));

    const resultado = await sincronizar(clienteFalso(), YO);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain('la red se fue');
    // La ficha se subió igual: el fallo de una tabla no cancela las otras.
    expect(servidor.tablas.personajes.has('a')).toBe(true);
    expect(resultado.tiendas.find((t) => t.tienda === 'enemigos')?.error).toBeTruthy();
    expect(resumir(resultado)).toContain('Error al sincronizar');
  });

  it('sube las fichas aunque las imágenes fallen', async () => {
    // Un mapa que no sube no puede impedir que la ficha esté a salvo. Por eso las
    // imágenes van al final y en su propio try.
    imagenesLanza = 'Storage no responde';
    bd.personajes.set('a', ficha('a', HOY));

    const resultado = await sincronizar(clienteFalso(), YO);

    expect(servidor.tablas.personajes.has('a')).toBe(true);
    expect(resultado.ok).toBe(false);
    expect(resultado.tiendas.find((t) => t.tienda === 'imagenes')?.error).toBe('Storage no responde');
  });

  it('cuenta las imágenes en el resumen', async () => {
    Object.assign(imagenes, { subidas: 2, bajadas: 1 });
    const resultado = await sincronizar(clienteFalso(), YO);
    expect(resumir(resultado)).toBe('2 enviados, 1 recibidos');
  });

  it('no toca nada si no hay nada que hacer', async () => {
    bd.personajes.set('a', { ...ficha('a', HOY), propietario: YO });
    enServidor('personajes', {
      id: 'a',
      actualizado_en: HOY,
      datos: { ...ficha('a', HOY), propietario: YO },
    });

    const resultado = await sincronizar(clienteFalso(), YO);
    expect(servidor.escrituras).toEqual([]);
    expect(resumir(resultado)).toBe('Ya estaba todo al día');
  });

  it('ignora una fila corrupta en vez de romper el almacén', async () => {
    enServidor('personajes', { id: 'malo', actualizado_en: HOY, datos: null });
    enServidor('personajes', { id: 'bueno', actualizado_en: HOY });

    const resultado = await sincronizar(clienteFalso(), YO);

    expect(resultado.ok).toBe(true);
    expect(bd.personajes.has('malo')).toBe(false);
    expect(bd.personajes.has('bueno')).toBe(true);
  });

  it('sólo se trae lo suyo', async () => {
    enServidor('personajes', { id: 'mia', actualizado_en: HOY });
    enServidor('personajes', { id: 'ajena', actualizado_en: HOY, propietario: OTRO });

    await sincronizar(clienteFalso(), YO);

    expect(bd.personajes.has('mia')).toBe(true);
    expect(bd.personajes.has('ajena')).toBe(false);
  });
});

describe('fichasDeCampana', () => {
  it('trae las fichas de la mesa sin guardarlas en local', async () => {
    // El máster puede leerlas pero no escribirlas. Si entraran en IndexedDB, la siguiente
    // sincronización intentaría subirlas y se llevaría un rechazo del servidor.
    enServidor('personajes', {
      id: 'del-jugador',
      propietario: OTRO,
      campana_id: 'c1',
      actualizado_en: HOY,
      datos: { ...ficha('del-jugador', HOY, 'c1'), nombre: 'Zhaira' },
    });

    const { personajes, error } = await fichasDeCampana(clienteFalso(), 'c1');

    expect(error).toBeUndefined();
    expect(personajes.map((p) => p.nombre)).toEqual(['Zhaira']);
    expect(bd.personajes.size).toBe(0);
  });

  it('devuelve el error en vez de lanzarlo', async () => {
    servidor.falla.add('personajes');
    const { personajes, error } = await fichasDeCampana(clienteFalso(), 'c1');
    expect(personajes).toEqual([]);
    expect(error).toBe('la red se fue');
  });
});
