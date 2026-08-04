import { describe, it, expect, vi, beforeEach } from 'vitest';
import { personajeVacio, type Personaje } from '../motor/personaje';
import type { Campana, Enemigo, Tirada } from './almacen';
import type { Imagen, ImagenInfo } from './imagenes';

/** `localStorage` es del navegador; en Node hace falta uno de mentira. */
const memoria = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
});

/**
 * El almacén real es IndexedDB, que no existe en Node. Aquí se sustituye por uno en
 * memoria: lo que se prueba es **la lógica de la copia**, no el motor de base de datos.
 */
const bd = {
  personajes: new Map<string, Personaje>(),
  campanas: new Map<string, Campana>(),
  enemigos: new Map<string, Enemigo>(),
  tiradas: new Map<string, Tirada>(),
  imagenes: new Map<string, Imagen>(),
};

vi.mock('./almacen', () => ({
  almacen: {
    listarPersonajes: async () => [...bd.personajes.values()],
    listarCampanas: async () => [...bd.campanas.values()],
    listarEnemigos: async () => [...bd.enemigos.values()],
    listarTiradas: async () => [...bd.tiradas.values()],
    guardarPersonaje: async (p: Personaje) => void bd.personajes.set(p.id, p),
    guardarCampana: async (c: Campana) => void bd.campanas.set(c.id, c),
    guardarEnemigo: async (e: Enemigo) => void bd.enemigos.set(e.id, e),
    guardarTirada: async (t: Tirada) => void bd.tiradas.set(t.id, t),
    borrarPersonaje: async (id: string) => void bd.personajes.delete(id),
    borrarCampana: async (id: string) => void bd.campanas.delete(id),
    borrarEnemigo: async (id: string) => void bd.enemigos.delete(id),
    borrarTirada: async (id: string) => void bd.tiradas.delete(id),
  },
}));

vi.mock('./imagenes', () => ({
  listarImagenes: async (): Promise<ImagenInfo[]> =>
    [...bd.imagenes.values()].map(({ datos: _d, ...info }) => info),
  obtenerImagen: async (id: string) => bd.imagenes.get(id),
  guardarImagenCruda: async (i: Imagen) => void bd.imagenes.set(i.id, i),
  borrarImagen: async (id: string) => void bd.imagenes.delete(id),
}));

const {
  CLAVES_PREFERENCIAS,
  FORMATO,
  analizarCopia,
  crearCopia,
  restaurarCopia,
  resumirCopia,
} = await import('./copiaSeguridad');

function imagenDePrueba(id: string, tipo: ImagenInfo['tipo'] = 'mapa'): Imagen {
  return {
    id,
    tipo,
    nombre: `imagen ${id}`,
    campanaId: null,
    anchura: 10,
    altura: 10,
    bytes: 4,
    creadoEn: '2026-01-01T00:00:00.000Z',
    datos: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }),
  };
}

function campanaDePrueba(id: string): Campana {
  return {
    id,
    propietario: null,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
    nombre: `Campaña ${id}`,
    paquetes: ['core-exxet', 'arcana-exxet'],
    sistemaCombate: 'dramatico',
    ajustes: { formulas: { puntosVida: '20 + CON * 12' } } as Campana['ajustes'],
    notasSesion: [{ id: 'n1', fecha: '2026-01-02', titulo: 'Sesión 1', texto: 'Pasó algo.' }],
    personalizados: { razas: [{ raza: 'Moguri', CON: 2 }] } as Campana['personalizados'],
  };
}

function poblar() {
  bd.personajes.clear();
  bd.campanas.clear();
  bd.enemigos.clear();
  bd.tiradas.clear();
  bd.imagenes.clear();

  const p = personajeVacio('p1');
  p.nombre = 'Meirmeister';
  p.retratoId = 'img-retrato';
  p.pdInvertidos = { HAtaque: 60 };
  bd.personajes.set(p.id, p);

  bd.campanas.set('c1', campanaDePrueba('c1'));
  bd.enemigos.set('e1', {
    id: 'e1', campanaId: 'c1', nombre: 'Goblin', puntosVida: 40, turno: 30,
    ataque: 60, defensa: 50, tipoDefensa: 'Esquiva', dano: 20, tipoDano: 'FIL',
    TA: { FIL: 1, CON: 1, PEN: 1, CAL: 0, ELE: 0, FRI: 0, ENE: 0 },
  } as Enemigo);

  bd.tiradas.set('t1', {
    id: 't1',
    campanaId: 'c1',
    personajeId: 'p1',
    autor: 'Meirmeister',
    actualizadoEn: '2026-08-04T20:00:00.000Z',
    texto: 'Iniciativa: 118',
    detalle: '75 de turno + 43',
  });

  bd.imagenes.set('img-retrato', imagenDePrueba('img-retrato', 'retrato'));
  bd.imagenes.set('img-mapa', imagenDePrueba('img-mapa', 'mapa'));
  bd.imagenes.set('img-pnj', imagenDePrueba('img-pnj', 'pnj'));
}

beforeEach(() => {
  poblar();
  localStorage.clear();
  localStorage.setItem('anima-manager:tema', 'medieval');
});

describe('lo que entra en una copia', () => {
  it('se lleva fichas, campañas, enemigos e imágenes', async () => {
    const c = await crearCopia();
    expect(c.formato).toBe(FORMATO);
    expect(c.personajes).toHaveLength(1);
    expect(c.campanas).toHaveLength(1);
    expect(c.enemigos).toHaveLength(1);
    expect(c.imagenes).toHaveLength(3);
  });

  it('se lleva **toda** la galería, no sólo los retratos', async () => {
    const c = await crearCopia();
    expect(c.imagenes.map((i) => i.tipo).sort()).toEqual(['mapa', 'pnj', 'retrato']);
    // Y con sus bytes dentro, no sólo la ficha técnica.
    expect(c.imagenes.every((i) => i.dataUri.startsWith('data:'))).toBe(true);
  });

  it('se lleva las reglas caseras y el contenido propio de la campaña', async () => {
    const c = await crearCopia();
    const campana = c.campanas[0];
    expect(campana.ajustes).toEqual({ formulas: { puntosVida: '20 + CON * 12' } });
    expect(campana.personalizados?.razas?.[0]?.raza).toBe('Moguri');
    expect(campana.notasSesion).toHaveLength(1);
    // Y el sistema de combate elegido para esa mesa.
    expect(campana.sistemaCombate).toBe('dramatico');
  });

  it('se lleva el registro de tiradas', async () => {
    // Las tiradas son lo último que se guardó de verdad en vez de en memoria; si la copia
    // no las cogiera, «copia de seguridad completa» dejaría de ser cierto.
    const c = await crearCopia();
    expect(c.tiradas).toHaveLength(1);
    expect(c.tiradas?.[0]?.texto).toBe('Iniciativa: 118');
    expect(resumirCopia(c).tiradas).toBe(1);
  });

  it('se lleva las preferencias del navegador, que no están en la base de datos', async () => {
    const c = await crearCopia();
    expect(c.preferencias['anima-manager:tema']).toBe('medieval');
  });

  it('el resumen cuenta lo que hay y estima lo que pesa', async () => {
    const r = resumirCopia(await crearCopia());
    expect(r).toMatchObject({ personajes: 1, campanas: 1, enemigos: 1, imagenes: 3, preferencias: 1 });
    expect(r.bytes).toBeGreaterThan(0);
  });
});

describe('leer un archivo antes de tocar nada', () => {
  it('acepta una copia buena y dice qué trae', async () => {
    const r = analizarCopia(JSON.parse(JSON.stringify(await crearCopia())));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resumen.imagenes).toBe(3);
  });

  it('rechaza lo que no es una copia, y sugiere qué hacer', () => {
    const r = analizarCopia({ formato: 'anima-manager', version: 1, personajes: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Importar JSON/);
  });

  it('rechaza una copia de una versión más nueva en vez de romperse', () => {
    const r = analizarCopia({ formato: 'anima-manager-copia', version: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/más nueva/);
  });

  it('una copia a la que le faltan listas se lee igual, con lo que tenga', () => {
    const r = analizarCopia({ formato: 'anima-manager-copia', version: 1, personajes: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resumen).toMatchObject({ personajes: 0, imagenes: 0 });
  });

  it('analizar no escribe nada', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    bd.personajes.clear();
    analizarCopia(copia);
    expect(bd.personajes.size).toBe(0);
  });
});

describe('restaurar', () => {
  it('fusionar devuelve lo perdido sin borrar lo que ya hay', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    // Se pierde todo menos una ficha nueva que se creó después.
    bd.personajes.clear();
    bd.imagenes.clear();
    const nueva = personajeVacio('p2');
    nueva.nombre = 'Ryo';
    bd.personajes.set('p2', nueva);

    const r = await restaurarCopia(copia, 'fusionar');
    expect(r.borrados).toBe(0);
    expect(bd.personajes.size).toBe(2);
    expect(bd.personajes.get('p1')?.nombre).toBe('Meirmeister');
    expect(bd.personajes.get('p2')?.nombre).toBe('Ryo');
    expect(bd.imagenes.size).toBe(3);
    expect(r.fallos).toEqual([]);
  });

  it('reemplazar deja el dispositivo como el día de la copia', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    const nueva = personajeVacio('p2');
    bd.personajes.set('p2', nueva);
    bd.imagenes.set('img-suelta', imagenDePrueba('img-suelta'));

    const r = await restaurarCopia(copia, 'reemplazar');
    expect(r.borrados).toBeGreaterThan(0);
    // La ficha que no estaba en la copia se ha ido; la que sí, ha vuelto.
    expect(bd.personajes.has('p2')).toBe(false);
    expect(bd.personajes.has('p1')).toBe(true);
    expect(bd.imagenes.has('img-suelta')).toBe(false);
    expect(bd.imagenes.size).toBe(3);
  });

  it('lo que coincide por id lo manda la copia', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    const tocada = { ...bd.personajes.get('p1')!, nombre: 'Cambiado' };
    bd.personajes.set('p1', tocada);

    await restaurarCopia(copia, 'fusionar');
    expect(bd.personajes.get('p1')?.nombre).toBe('Meirmeister');
  });

  it('devuelve las imágenes con sus bytes, no sólo la ficha', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    bd.imagenes.clear();
    await restaurarCopia(copia, 'fusionar');
    const mapa = bd.imagenes.get('img-mapa');
    expect(mapa?.datos).toBeInstanceOf(Blob);
    expect(await mapa!.datos.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3, 4]).buffer);
  });

  it('devuelve las preferencias', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    localStorage.setItem('anima-manager:tema', 'claro');
    const r = await restaurarCopia(copia, 'fusionar');
    expect(localStorage.getItem('anima-manager:tema')).toBe('medieval');
    expect(r.preferencias).toBe(1);
  });

  /**
   * Un archivo manipulado no debería poder escribir lo que le apetezca en el navegador de
   * quien lo abre. Sólo se restauran las claves que la aplicación conoce.
   */
  it('ignora preferencias que no son suyas', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    copia.preferencias['algo:ajeno'] = 'valor';
    const r = await restaurarCopia(copia, 'fusionar');
    expect(localStorage.getItem('algo:ajeno')).toBeNull();
    expect(r.preferencias).toBe(CLAVES_PREFERENCIAS.length);
  });

  it('una imagen dañada se anota y el resto se restaura igual', async () => {
    const copia = JSON.parse(JSON.stringify(await crearCopia()));
    copia.imagenes[0].dataUri = 'esto no es una data URI';
    bd.imagenes.clear();
    const r = await restaurarCopia(copia, 'fusionar');
    expect(r.fallos).toHaveLength(1);
    expect(r.fallos[0]).toMatch(/imagen/);
    // Las otras dos sí han entrado, y las fichas también.
    expect(r.imagenes).toBe(2);
    expect(bd.personajes.size).toBe(1);
  });

  it('el viaje completo: copiar, perderlo todo y volver a estar igual', async () => {
    const antes = await crearCopia();
    const archivo = JSON.parse(JSON.stringify(antes));

    bd.personajes.clear();
    bd.campanas.clear();
    bd.enemigos.clear();
    bd.tiradas.clear();
    bd.imagenes.clear();
    localStorage.clear();

    await restaurarCopia(archivo, 'reemplazar');
    const despues = await crearCopia();

    expect(despues.personajes).toEqual(antes.personajes);
    expect(despues.campanas).toEqual(antes.campanas);
    expect(despues.enemigos).toEqual(antes.enemigos);
    expect(despues.tiradas).toEqual(antes.tiradas);
    expect(despues.imagenes.map((i) => i.id).sort()).toEqual(antes.imagenes.map((i) => i.id).sort());
    expect(despues.preferencias).toEqual(antes.preferencias);
  });
});
