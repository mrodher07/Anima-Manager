import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEMAS, TEMA_POR_DEFECTO, temaDe, temaGuardado, guardarTema } from './temas';

const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');

/** Variables que cualquier tema debe definir para que la interfaz no se rompa. */
const VARIABLES_MINIMAS = [
  '--fondo', '--fondo-2', '--panel', '--panel-alto', '--borde', '--borde-suave',
  '--texto', '--texto-tenue', '--texto-debil', '--oro', '--oro-claro',
  '--sangre', '--sangre-claro', '--arcano', '--arcano-claro',
];

function bloqueDe(id: string): string {
  if (id === TEMA_POR_DEFECTO) {
    // El tema por defecto vive en :root, no en un bloque con data-tema.
    return css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  }
  const inicio = css.indexOf(`:root[data-tema='${id}']`);
  if (inicio < 0) return '';
  return css.slice(inicio, css.indexOf('}', inicio));
}

describe('catálogo de temas', () => {
  it('incluye los cuatro pedidos, con el oscuro por defecto', () => {
    expect(TEMAS.map((t) => t.id)).toEqual(['oscuro', 'claro', 'steampunk', 'medieval']);
    expect(TEMA_POR_DEFECTO).toBe('oscuro');
  });

  it('cada tema tiene nombre, descripción, icono y esquema de color', () => {
    for (const t of TEMAS) {
      expect(t.nombre.length, t.id).toBeGreaterThan(0);
      expect(t.descripcion.length, t.id).toBeGreaterThan(10);
      expect(t.icono.length, t.id).toBeGreaterThan(0);
      expect(['dark', 'light'], t.id).toContain(t.esquema);
    }
  });

  it('no hay identificadores repetidos', () => {
    expect(new Set(TEMAS.map((t) => t.id)).size).toBe(TEMAS.length);
  });

  it('cada tema define en el CSS todas las variables que la interfaz usa', () => {
    for (const t of TEMAS) {
      const bloque = bloqueDe(t.id);
      expect(bloque.length, `falta el bloque CSS de "${t.id}"`).toBeGreaterThan(0);
      const faltan = VARIABLES_MINIMAS.filter((v) => !bloque.includes(`${v}:`));
      expect(faltan, `${t.id} no define`).toEqual([]);
    }
  });

  it('temaDe cae en el tema por defecto si el id no existe', () => {
    expect(temaDe('steampunk').nombre).toBe('Steampunk');
    expect(temaDe('inventado').id).toBe(TEMA_POR_DEFECTO);
  });
});

describe('preferencia guardada', () => {
  beforeEach(() => {
    const almacen = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
    });
  });

  it('recuerda el tema elegido', () => {
    expect(temaGuardado()).toBe(TEMA_POR_DEFECTO);
    guardarTema('medieval');
    expect(temaGuardado()).toBe('medieval');
  });

  it('ignora un tema guardado que ya no existe', () => {
    guardarTema('inventado');
    expect(temaGuardado()).toBe(TEMA_POR_DEFECTO);
  });

  it('no falla si el navegador bloquea localStorage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
    });
    expect(() => guardarTema('claro')).not.toThrow();
    expect(temaGuardado()).toBe(TEMA_POR_DEFECTO);
  });
});
