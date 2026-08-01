import { describe, it, expect } from 'vitest';
import {
  PENALIZADOR_SIN_INFORMACION,
  TIEMPOS_SINCRONIZACION,
  afinidadDe,
  agruparPoderes,
  gradosAlcanzables,
  sincronizar,
} from './encarnaciones';
import encarnacionesJson from '../../data/arcana/encarnaciones.json';
import invocacionesJson from '../../data/arcana/invocaciones.json';
import type { Encarnacion, Invocacion } from '../datos/tipos';

const encarnaciones = encarnacionesJson as Encarnacion[];
const invocaciones = invocacionesJson as unknown as Invocacion[];
const buscar = (n: string) => encarnaciones.find((e) => e.encarnacion === n)!;

describe('los datos del Arcana Exxet', () => {
  it('trae las quince encarnaciones del capítulo 6', () => {
    expect(encarnaciones).toHaveLength(15);
  });

  it('todas tienen los tres grados de afinidad', () => {
    for (const e of encarnaciones) {
      expect(e.afinidades.map((a) => a.grado)).toEqual(['Menor', 'Intermedia', 'Real']);
    }
  });

  it('la dificultad y el nivel nunca bajan al subir de grado', () => {
    for (const e of encarnaciones) {
      const niveles = e.afinidades.map((a) => a.nivel);
      const dificultades = e.afinidades.map((a) => a.dificultad);
      expect(niveles).toEqual([...niveles].sort((a, b) => a - b));
      expect(dificultades).toEqual([...dificultades].sort((a, b) => a - b));
    }
  });

  it('cada poder de una invocación apunta a una entrada madre que existe', () => {
    const nombres = new Set(invocaciones.map((i) => i.invocacion));
    const huerfanos = invocaciones.filter((i) => i.parteDe && !nombres.has(i.parteDe));
    expect(huerfanos.map((i) => i.invocacion)).toEqual([]);
  });

  it('ninguna invocación se queda sin dificultad ni sin coste', () => {
    const cojas = invocaciones.filter((i) => !i.dificultad || !i.coste);
    expect(cojas.map((i) => i.invocacion)).toEqual([]);
  });
});

describe('el ejemplo del propio manual', () => {
  // «Evangeline, invocadora de nivel 4, podría tratar de invocar a Linx Kazte Hex en
  // afinidad menor, ya que el nivel requerido de esta es 4, pero no en grado intermedio o
  // real, ya que requiere 8 y 12.» (Arcana Exxet, pág. 73)
  const linx = () => buscar('Linx Kazte Hex, La sombra que trae la Muerte');

  it('reproduce los niveles que cita el manual', () => {
    expect(linx().afinidades.map((a) => a.nivel)).toEqual([4, 8, 12]);
  });

  it('a nivel 4 sólo alcanza la afinidad Menor', () => {
    expect(gradosAlcanzables(linx(), 4)).toEqual(['Menor']);
    expect(gradosAlcanzables(linx(), 8)).toEqual(['Menor', 'Intermedia']);
    expect(gradosAlcanzables(linx(), 12)).toEqual(['Menor', 'Intermedia', 'Real']);
  });
});

describe('calcular la sincronización', () => {
  const linx = () => buscar('Linx Kazte Hex, La sombra que trae la Muerte');

  it('sin rasgos y a un minuto, la dificultad es la del grado', () => {
    const s = sincronizar(linx(), { grado: 'Menor', rasgos: [], tiempo: 'Un minuto' });
    expect(s.base).toBe(260);
    expect(s.dificultad).toBe(260);
    expect(s.zeon).toBe(400);
    expect(s.nivelRequerido).toBe(4);
  });

  it('un rasgo afín rebaja la dificultad; uno contrario la sube', () => {
    const conAfines = sincronizar(linx(), {
      grado: 'Menor',
      rasgos: ['Ser mujer', 'Poseer el broche de Linx'],
      tiempo: 'Un minuto',
    });
    // +10 y +120 acercan al invocador, así que restan 130.
    expect(conAfines.porRasgos).toBe(-130);
    expect(conAfines.dificultad).toBe(130);

    const conContrarios = sincronizar(linx(), {
      grado: 'Menor',
      rasgos: ['Oprimir a la gente'],
      tiempo: 'Un minuto',
    });
    expect(conContrarios.porRasgos).toBe(100);
    expect(conContrarios.dificultad).toBe(360);
  });

  it('el tiempo de sincronización se suma tal cual (Tabla 12)', () => {
    const corta = sincronizar(linx(), { grado: 'Menor', rasgos: [], tiempo: '5 Asaltos' });
    expect(corta.porTiempo).toBe(-50);
    expect(corta.dificultad).toBe(210);

    const larga = sincronizar(linx(), { grado: 'Menor', rasgos: [], tiempo: 'Una hora' });
    expect(larga.porTiempo).toBe(120);
    expect(larga.dificultad).toBe(380);
  });

  it('no conocer a la entidad cuesta +50', () => {
    const s = sincronizar(linx(), {
      grado: 'Real',
      rasgos: [],
      tiempo: 'Un minuto',
      sinInformacion: true,
    });
    expect(s.porInformacion).toBe(PENALIZADOR_SIN_INFORMACION);
    expect(s.dificultad).toBe(380 + 50);
  });

  it('un rasgo que esa encarnación no tiene se ignora', () => {
    const s = sincronizar(linx(), {
      grado: 'Menor',
      rasgos: ['Matar a un Dragón'],
      tiempo: 'Un minuto',
    });
    expect(s.porRasgos).toBe(0);
  });

  it('la Tabla 12 es la del manual', () => {
    expect(TIEMPOS_SINCRONIZACION.map((t) => t.modificador)).toEqual([-50, -25, 0, 40, 80, 120]);
  });

  it('encuentra la afinidad por su grado', () => {
    expect(afinidadDe(linx(), 'Real')?.zeon).toBe(900);
  });
});

describe('agrupar los poderes de una invocación', () => {
  it('cuelga cada poder de su entrada madre', () => {
    const grupos = agruparPoderes(invocaciones);
    const seiryu = grupos.find((g) =>
      g.madre.invocacion === 'Seiryu, El Dragón Celeste, Guardián del Este',
    )!;
    expect(seiryu.poderes.map((p) => p.invocacion)).toEqual([
      'Seiryu — Tormenta',
      'Seiryu — Rayo',
      'Seiryu — Señor del Este',
      'Seiryu — La Furia de la Última Tormenta',
    ]);
  });

  it('las invocaciones de un solo poder no tienen hijos', () => {
    const grupos = agruparPoderes(invocaciones);
    const hermod = grupos.find((g) => g.madre.invocacion === 'Hermod, El Mensajero de los Dioses')!;
    expect(hermod.poderes).toEqual([]);
  });

  it('no pierde ninguna invocación por el camino', () => {
    const grupos = agruparPoderes(invocaciones);
    const total = grupos.reduce((t, g) => t + 1 + g.poderes.length, 0);
    expect(total).toBe(invocaciones.length);
  });
});
