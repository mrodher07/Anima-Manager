import { describe, it, expect } from 'vitest';
import { ESQUEMAS, esquemaDe } from './esquemas';
import { CLAVE_DE, type NombreColeccion } from './tipos';
import { Catalogo, paquetePersonalizado, cuentaPersonalizados, type Personalizados } from './paquetes';

describe('esquemas de contenido propio', () => {
  it('cubre todas las colecciones del catálogo', () => {
    const cubiertas = new Set(ESQUEMAS.map((e) => e.coleccion));
    const todas = Object.keys(CLAVE_DE) as NombreColeccion[];
    const sinCubrir = todas.filter((c) => !cubiertas.has(c));
    expect(sinCubrir, 'colecciones sin esquema').toEqual([]);
  });

  it('cada esquema usa como clave el mismo campo que el catálogo', () => {
    for (const e of ESQUEMAS) {
      expect(e.clave, e.coleccion).toBe(CLAVE_DE[e.coleccion]);
    }
  });

  it('el campo clave está entre los campos editables', () => {
    for (const e of ESQUEMAS) {
      expect(e.campos.map((c) => c.clave), e.coleccion).toContain(e.clave);
    }
  });

  it('no hay campos repetidos dentro de un esquema', () => {
    for (const e of ESQUEMAS) {
      const claves = e.campos.map((c) => c.clave);
      expect(new Set(claves).size, e.coleccion).toBe(claves.length);
    }
  });

  it('los campos de opción traen sus opciones', () => {
    for (const e of ESQUEMAS) {
      for (const c of e.campos.filter((x) => x.tipo === 'opcion')) {
        expect(c.opciones?.length, `${e.coleccion}.${c.clave}`).toBeGreaterThan(0);
      }
    }
  });

  it('cada esquema tiene textos para la interfaz', () => {
    for (const e of ESQUEMAS) {
      expect(e.singular.length, e.coleccion).toBeGreaterThan(0);
      expect(e.plural.length, e.coleccion).toBeGreaterThan(0);
      expect(e.ayuda.length, e.coleccion).toBeGreaterThan(10);
    }
  });

  it('esquemaDe encuentra por nombre de colección', () => {
    expect(esquemaDe('razas')?.plural).toBe('Razas');
    expect(esquemaDe('conjuros')?.clave).toBe('conjuro');
  });
});

describe('el contenido propio entra en el catálogo', () => {
  it('añade entradas nuevas y sustituye las oficiales del mismo nombre', async () => {
    const propio: Personalizados = {
      razas: [
        { raza: 'Moguri', RM: 20, ajusteNivel: 1, AGI: 1, FUE: -1, tamano: -3 },
        // Mismo nombre que una oficial: debe sustituirla.
        { raza: 'Humano', RF: 999 },
      ],
    };
    const catalogo = new Catalogo(['core-exxet'], [paquetePersonalizado(propio)]);
    const razas = await catalogo.obtener('razas');

    const moguri = razas.find((r) => r.raza === 'Moguri');
    expect(moguri?.RM).toBe(20);
    expect(moguri?._sigla).toBe('Tuyo'); // se ve de dónde viene

    const humano = razas.find((r) => r.raza === 'Humano');
    expect(humano?.RF).toBe(999);
    expect(humano?._sigla).toBe('Tuyo');

    // Las demás oficiales siguen ahí.
    expect(razas.find((r) => r.raza === 'Jayán')?._sigla).toBe('CE');
  });

  it('cuenta las entradas propias de todas las colecciones', () => {
    expect(cuentaPersonalizados({})).toBe(0);
    expect(
      cuentaPersonalizados({
        razas: [{ raza: 'Moguri' }],
        armas: [{ arma: 'Mandoble roto' }, { arma: 'Daga curva' }],
      }),
    ).toBe(3);
  });
});
