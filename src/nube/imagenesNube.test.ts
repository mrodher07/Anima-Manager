import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Imagen, ImagenInfo } from '../almacen/imagenes';
import type { Lapida } from '../almacen/bd';

/**
 * Las imágenes son el único caso donde un registro son **dos cosas**: una fila y un
 * archivo. Lo que se prueba aquí es sobre todo el **orden** en que se tocan, porque es lo
 * único que decide en qué estado queda todo si algo falla a medias.
 */
const local = new Map<string, Imagen>();
const lapidas = new Map<string, Lapida>();

vi.mock('../almacen/imagenes', () => ({
  fechaDe: (i: { creadoEn: string; actualizadoEn?: string }) => i.actualizadoEn ?? i.creadoEn,
  listarImagenes: async () => [...local.values()].map(({ datos: _d, ...info }) => info),
  obtenerImagen: async (id: string) => local.get(id),
  guardarImagenCruda: async (i: Imagen) => {
    local.set(i.id, i);
    lapidas.delete(`imagenes:${i.id}`);
  },
  borrarImagenCruda: async (id: string) => void local.delete(id),
}));

vi.mock('../almacen/bd', () => ({
  listarLapidas: async () => [...lapidas.values()],
  quitarLapida: async (_c: string, id: string) => void lapidas.delete(`imagenes:${id}`),
}));

const { sincronizarImagenes, rutaDe } = await import('./imagenesNube');

const YO = 'usuario-1';
const AYER = '2026-08-03T10:00:00.000Z';
const HOY = '2026-08-04T10:00:00.000Z';
const LUEGO = '2026-08-04T18:00:00.000Z';

// ── Servidor de mentira: tabla + almacén de archivos ──────────────────────────

const servidor = {
  filas: new Map<string, Record<string, unknown>>(),
  archivos: new Map<string, Blob>(),
  /** Orden real de las operaciones. Es lo que se comprueba. */
  pasos: [] as string[],
  fallaSubidaArchivo: false,
  fallaTabla: false,
};

function blob(texto = 'imagen'): Blob {
  return new Blob([texto], { type: 'image/webp' });
}

function clienteFalso(): SupabaseClient {
  return {
    from() {
      const q = {
        _filtros: [] as [string, unknown][],
        select() {
          return this;
        },
        eq(c: string, v: unknown) {
          this._filtros.push([c, v]);
          return this;
        },
        then(res: (r: { data: unknown[] | null; error: { message: string } | null }) => void) {
          if (servidor.fallaTabla) return res({ data: null, error: { message: 'tabla caída' } });
          const datos = [...servidor.filas.values()].filter((f) =>
            this._filtros.every(([c, v]) => f[c] === v),
          );
          res({ data: datos, error: null });
        },
        upsert(fila: Record<string, unknown> | Record<string, unknown>[]) {
          servidor.pasos.push('fila');
          return {
            then(res: (r: { error: { message: string } | null }) => void) {
              if (servidor.fallaTabla) return res({ error: { message: 'tabla caída' } });
              for (const f of [fila].flat()) servidor.filas.set(String(f.id), f);
              res({ error: null });
            },
          };
        },
      };
      return q as unknown as ReturnType<SupabaseClient['from']>;
    },
    storage: {
      from() {
        return {
          async upload(ruta: string, datos: Blob) {
            servidor.pasos.push('archivo');
            if (servidor.fallaSubidaArchivo) return { error: { message: 'sin espacio' } };
            servidor.archivos.set(ruta, datos);
            return { error: null };
          },
          async download(ruta: string) {
            const b = servidor.archivos.get(ruta);
            return b ? { data: b, error: null } : { data: null, error: { message: 'no está' } };
          },
          async remove(rutas: string[]) {
            servidor.pasos.push('borrar-archivo');
            for (const r of rutas) servidor.archivos.delete(r);
            return { error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

function imagenLocal(id: string, actualizadoEn: string, campanaId: string | null = null): Imagen {
  return {
    id,
    tipo: 'mapa',
    nombre: id,
    campanaId,
    personajeId: null,
    anchura: 100,
    altura: 80,
    bytes: 6,
    creadoEn: AYER,
    actualizadoEn,
    datos: blob(id),
  };
}

function enServidor(id: string, actualizado_en: string, borrado = false) {
  servidor.filas.set(id, {
    id,
    propietario: YO,
    campana_id: null,
    personaje_id: null,
    tipo: 'mapa',
    nombre: id,
    descripcion: null,
    anchura: 100,
    altura: 80,
    bytes: 6,
    ruta: rutaDe(YO, id),
    actualizado_en,
    borrado,
  });
  if (!borrado) servidor.archivos.set(rutaDe(YO, id), blob(id));
}

beforeEach(() => {
  local.clear();
  lapidas.clear();
  servidor.filas.clear();
  servidor.archivos.clear();
  servidor.pasos = [];
  servidor.fallaSubidaArchivo = false;
  servidor.fallaTabla = false;
});

describe('sincronizarImagenes', () => {
  it('sube el archivo antes que la fila', async () => {
    // Si se escribiera la fila primero y fallara la subida, quedaría un mapa anunciado que
    // nadie puede descargar. Ese es el estado que peor se arregla solo.
    local.set('a', imagenLocal('a', HOY));

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(r.subidas).toBe(1);
    expect(servidor.pasos).toEqual(['archivo', 'fila']);
    expect(servidor.archivos.has(rutaDe(YO, 'a'))).toBe(true);
    expect(servidor.filas.get('a')?.ruta).toBe(rutaDe(YO, 'a'));
  });

  it('no anuncia una imagen cuyo archivo no ha subido', async () => {
    servidor.fallaSubidaArchivo = true;
    local.set('a', imagenLocal('a', HOY));

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(r.subidas).toBe(0);
    expect(servidor.filas.has('a')).toBe(false);
    expect(r.fallos[0]).toContain('sin espacio');
  });

  it('un fallo en una imagen no impide subir las demás', async () => {
    local.set('a', imagenLocal('a', HOY));
    local.set('b', imagenLocal('b', HOY));
    // Sólo el primer upload falla.
    const cliente = clienteFalso();
    let primera = true;
    const almacenamiento = cliente.storage.from('imagenes');
    const subirOriginal = almacenamiento.upload.bind(almacenamiento);
    vi.spyOn(cliente.storage, 'from').mockReturnValue({
      ...almacenamiento,
      upload: async (ruta: string, datos: Blob) => {
        if (primera) {
          primera = false;
          return { error: { message: 'se cortó' } } as never;
        }
        return subirOriginal(ruta, datos) as never;
      },
    } as never);

    const r = await sincronizarImagenes(cliente, YO);

    expect(r.subidas).toBe(1);
    expect(r.fallos).toHaveLength(1);
  });

  it('baja el archivo y lo guarda con la fecha del servidor', async () => {
    // Ponerle la fecha de ahora la dejaría más nueva que la del servidor y se volvería a
    // subir en la siguiente vuelta. Y en la siguiente.
    enServidor('a', HOY);

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(r.bajadas).toBe(1);
    expect(local.get('a')?.actualizadoEn).toBe(HOY);
    expect(await local.get('a')?.datos.text()).toBe('a');
  });

  it('gana la versión más reciente', async () => {
    local.set('a', { ...imagenLocal('a', LUEGO), nombre: 'el mío' });
    enServidor('a', HOY);

    await sincronizarImagenes(clienteFalso(), YO);
    expect(servidor.filas.get('a')?.nombre).toBe('el mío');
  });

  it('marca la fila antes de borrar el archivo', async () => {
    // Al revés que al subir: marcar la fila es lo que hace que los demás se enteren. Si el
    // archivo se quedara sin borrar, lo que queda es basura invisible, no un enlace roto.
    enServidor('a', AYER);
    lapidas.set('imagenes:a', {
      clave: 'imagenes:a',
      tienda: 'imagenes',
      registroId: 'a',
      actualizadoEn: HOY,
    });

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(servidor.pasos).toEqual(['fila', 'borrar-archivo']);
    expect(servidor.filas.get('a')?.borrado).toBe(true);
    expect(servidor.archivos.has(rutaDe(YO, 'a'))).toBe(false);
    expect(r.lapidasEnviadas).toBe(1);
    expect(lapidas.size).toBe(0);
  });

  it('mantiene la lápida si el borrado no se ha podido comunicar', async () => {
    enServidor('a', AYER);
    lapidas.set('imagenes:a', {
      clave: 'imagenes:a',
      tienda: 'imagenes',
      registroId: 'a',
      actualizadoEn: HOY,
    });
    servidor.fallaTabla = true;

    await expect(sincronizarImagenes(clienteFalso(), YO)).rejects.toThrow();
    expect(lapidas.size).toBe(1); // se reintentará
  });

  it('borra aquí lo que se borró en otro dispositivo', async () => {
    local.set('a', imagenLocal('a', AYER));
    enServidor('a', HOY, true);

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(r.borradasAqui).toBe(1);
    expect(local.has('a')).toBe(false);
  });

  it('no se baja una imagen marcada como borrada', async () => {
    enServidor('a', HOY, true);
    const r = await sincronizarImagenes(clienteFalso(), YO);
    expect(r.bajadas).toBe(0);
    expect(local.size).toBe(0);
  });

  it('avisa cuando el archivo no está donde dice la fila', async () => {
    // Fila sin archivo: pasa si una subida se cortó justo entre los dos pasos en una
    // versión anterior, o si alguien borró el archivo a mano desde el panel.
    enServidor('a', HOY);
    servidor.archivos.clear();

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(r.bajadas).toBe(0);
    expect(r.fallos[0]).toContain('no está');
    expect(local.size).toBe(0);
  });

  it('no hace nada cuando los dos lados están al día', async () => {
    local.set('a', imagenLocal('a', HOY));
    enServidor('a', HOY);

    const r = await sincronizarImagenes(clienteFalso(), YO);

    expect(servidor.pasos).toEqual([]);
    expect(r).toMatchObject({ subidas: 0, bajadas: 0, borradasAqui: 0, lapidasEnviadas: 0 });
  });

  it('usa la fecha de creación si la imagen es anterior a la nube', async () => {
    // Las imágenes guardadas antes de que existiera todo esto no tienen `actualizadoEn`.
    const vieja = imagenLocal('a', HOY);
    delete vieja.actualizadoEn;
    local.set('a', vieja);

    await sincronizarImagenes(clienteFalso(), YO);
    expect(servidor.filas.get('a')?.actualizado_en).toBe(AYER); // su creadoEn
  });
});

describe('rutaDe', () => {
  it('pone el usuario como primera carpeta', () => {
    // No es cosmético: las políticas de Storage miran esa carpeta para decidir de quién es
    // el archivo. La estructura de la ruta **es** el permiso.
    expect(rutaDe('abc-123', 'img-9')).toBe('abc-123/img-9.webp');
  });
});

describe('imagenesDeCampana', () => {
  it('no guarda en local lo que es de otra persona', async () => {
    const { imagenesDeCampana } = await import('./imagenesNube');
    servidor.filas.set('suya', {
      id: 'suya',
      propietario: 'otro',
      campana_id: 'c1',
      personaje_id: null,
      tipo: 'mapa',
      nombre: 'El bosque',
      descripcion: null,
      anchura: 10,
      altura: 10,
      bytes: 4,
      ruta: 'otro/suya.webp',
      actualizado_en: HOY,
      borrado: false,
    });

    const { imagenes, error } = await imagenesDeCampana(clienteFalso(), 'c1');

    expect(error).toBeUndefined();
    expect(imagenes.map((i: ImagenInfo) => i.nombre)).toEqual(['El bosque']);
    expect(local.size).toBe(0);
  });
});
