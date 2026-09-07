import { describe, expect, it } from 'vitest';
import {
  COLUMNAS_MAXIMAS,
  COLUMNAS_MINIMAS,
  COLUMNAS_POR_DEFECTO,
  casillaDesde,
  colocacionInicial,
  columnasValidas,
  filasDe,
  type EnElMapa,
} from './mapaBatalla';

describe('la cuadrícula', () => {
  it('acota las columnas a algo usable', () => {
    expect(columnasValidas(20)).toBe(20);
    expect(columnasValidas(1)).toBe(COLUMNAS_MINIMAS);
    expect(columnasValidas(500)).toBe(COLUMNAS_MAXIMAS);
    expect(columnasValidas(12.4)).toBe(12);
  });

  it('un campo vacío o con letras no rompe el mapa', () => {
    expect(columnasValidas(NaN)).toBe(COLUMNAS_POR_DEFECTO);
    expect(columnasValidas(Infinity)).toBe(COLUMNAS_POR_DEFECTO);
  });

  it('las filas salen de la proporción de la imagen, para que la casilla sea cuadrada', () => {
    expect(filasDe(20, 1000, 500)).toBe(10);
    expect(filasDe(20, 800, 800)).toBe(20);
    // Sin imagen, 16:9, que es lo que mide casi cualquier mapa y casi cualquier pantalla.
    expect(filasDe(16)).toBe(9);
  });
});

describe('soltar una ficha', () => {
  it('cae en la casilla que le toca', () => {
    // 10 columnas: el 0,25 del ancho es la casilla 2.
    expect(casillaDesde(0.25, 0.55, 10, 10)).toEqual({ x: 2, y: 5 });
    expect(casillaDesde(0, 0, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it('pasarse del borde no tira la ficha fuera del mapa', () => {
    // Arrastrando con el dedo uno se pasa constantemente; que la ficha desapareciera por
    // eso sería absurdo.
    expect(casillaDesde(1.4, -0.3, 10, 10)).toEqual({ x: 9, y: 0 });
    expect(casillaDesde(0.999, 0.999, 10, 10)).toEqual({ x: 9, y: 9 });
  });

  it('un punto imposible cae en el origen en vez de romper nada', () => {
    expect(casillaDesde(NaN, NaN, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe('colocación inicial', () => {
  const p = (id: string, tipo: EnElMapa['tipo'], x?: number, y?: number): EnElMapa =>
    ({ id, tipo, x, y });

  it('los jugadores a la izquierda y los enemigos a la derecha', () => {
    const puestas = colocacionInicial(
      [p('a', 'personaje'), p('b', 'personaje'), p('e', 'enemigo')],
      10,
      6,
    );
    expect(puestas.get('a')).toEqual({ x: 0, y: 0 });
    expect(puestas.get('b')).toEqual({ x: 0, y: 1 });
    expect(puestas.get('e')).toEqual({ x: 9, y: 0 });
  });

  it('a quien ya está puesto no se le mueve', () => {
    const puestas = colocacionInicial([p('a', 'personaje', 5, 5), p('b', 'personaje')], 10, 6);
    expect(puestas.has('a')).toBe(false); // no se le toca
    expect(puestas.get('b')).toEqual({ x: 0, y: 0 });
  });

  it('no se apilan dos en la misma casilla', () => {
    const puestas = colocacionInicial(
      [p('ya', 'personaje', 0, 0), p('a', 'personaje'), p('b', 'personaje')],
      10,
      6,
    );
    expect(puestas.get('a')).toEqual({ x: 0, y: 1 });
    expect(puestas.get('b')).toEqual({ x: 0, y: 2 });
  });

  it('si una columna se llena se sigue por la de al lado, hacia dentro', () => {
    const muchos = Array.from({ length: 5 }, (_, i) => p(`p${i}`, 'personaje'));
    const puestas = colocacionInicial(muchos, 10, 3);
    expect([...puestas.values()]).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 },
      { x: 1, y: 0 }, { x: 1, y: 1 },
    ]);
  });

  it('los enemigos avanzan hacia dentro desde su borde', () => {
    const enemigos = Array.from({ length: 4 }, (_, i) => p(`e${i}`, 'enemigo'));
    const puestas = colocacionInicial(enemigos, 10, 3);
    expect([...puestas.values()]).toEqual([
      { x: 9, y: 0 }, { x: 9, y: 1 }, { x: 9, y: 2 }, { x: 8, y: 0 },
    ]);
  });

  it('con el mapa lleno se apila antes que dejar a alguien fuera', () => {
    const seis = Array.from({ length: 6 }, (_, i) => p(`p${i}`, 'personaje'));
    const puestas = colocacionInicial(seis, 2, 2);
    expect(puestas.size).toBe(6);
    for (const c of puestas.values()) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(2);
      expect(c.y).toBeLessThan(2);
    }
  });
});
