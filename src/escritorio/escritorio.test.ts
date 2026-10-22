/**
 * El puente con el programa de escritorio, con la ventana de Tauri simulada: lo que la página
 * le manda a cada comando de `src-tauri/src/lib.rs`, y que en el navegador todo sigue igual.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { direccionVuelta, esEscritorio, guardarArchivo } from './escritorio';

type Global = Record<string, unknown>;
const g = globalThis as unknown as Global;

/** Hace como si la página corriera dentro de Tauri; devuelve el `invoke` espiado. */
function enEscritorio(respuesta: unknown) {
  const invoke = vi.fn(async () => respuesta);
  g.isTauri = true;
  g.window = { __TAURI_INTERNALS__: { invoke }, location: { origin: 'tauri://localhost' } };
  return invoke;
}

afterEach(() => {
  delete g.isTauri;
  delete g.window;
});

describe('en el programa de escritorio', () => {
  it('se sabe que lo es', () => {
    enEscritorio(null);
    expect(esEscritorio()).toBe(true);
  });

  it('guardar un archivo manda sus bytes en crudo y el nombre en una cabecera', async () => {
    const invoke = enEscritorio('/home/ana/Fichas/Áldric Ñúñez.xlsx');
    const r = await guardarArchivo('Áldric Ñúñez.xlsx', new Blob([new Uint8Array([1, 2, 3])]));
    expect(r).toEqual({ guardado: true, ruta: '/home/ana/Fichas/Áldric Ñúñez.xlsx' });
    const [comando, datos, opciones] = invoke.mock.calls[0] as unknown as [
      string, Uint8Array, { headers: Record<string, string> },
    ];
    expect(comando).toBe('guardar_archivo');
    expect([...datos]).toEqual([1, 2, 3]);
    // Las tildes no caben en una cabecera: van codificadas y el lado de Rust las decodifica.
    expect(decodeURIComponent(opciones.headers['x-nombre'])).toBe('Áldric Ñúñez.xlsx');
    expect(opciones.headers['x-nombre']).toMatch(/^[\x20-\x7e]+$/);
  });

  it('si el usuario cancela el diálogo, no se ha guardado', async () => {
    enEscritorio(null);
    expect(await guardarArchivo('x.json', new Blob(['{}']))).toEqual({ guardado: false });
  });

  it('el enlace para cambiar la contraseña no apunta a la ventana, que no se puede abrir', () => {
    enEscritorio(null);
    expect(direccionVuelta()).not.toBe('tauri://localhost');
  });
});

describe('en el navegador', () => {
  it('no es el escritorio y el enlace vuelve a la misma página', () => {
    g.window = { location: { origin: 'https://anima-manager.vercel.app' } };
    expect(esEscritorio()).toBe(false);
    expect(direccionVuelta()).toBe('https://anima-manager.vercel.app');
  });
});
