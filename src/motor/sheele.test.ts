import { describe, it, expect } from 'vitest';
import {
  BONOS_POR_NIVEL,
  calcularSheele,
  cederACT,
  potenciacionMistica,
  tipoPorTirada,
  zeonMaximoPotenciacion,
  type SenorDeLaSheele,
  type TipoSheele,
} from './sheele';
import tablas from '../../data/reglas/tablasBase.json';

const tipos = (tablas as unknown as { tiposSheele: TipoSheele[] }).tiposSheele;
const haley = () => tipos.find((t) => t.tipo === 'Aire')!;

const senor: SenorDeLaSheele = {
  presencia: 40,
  presenciaBase: 35,
  turnoDesarmado: 75,
  resistencias: { RF: 60, RE: 55, RV: 50, RM: 70, RP: 65 },
  nivel: 3,
  controlar: 120,
};

describe('los datos de las Sheele', () => {
  it('el Excel trae los ocho tipos con sus nombres', () => {
    expect(tipos).toHaveLength(8);
    expect(haley().nombre).toBe('Haley');
    expect(tipos.find((t) => t.tipo === 'Agua')?.nombre).toBe('Corale');
  });
});

describe('la ficha sale del señor, no de la propia Sheele', () => {
  const ficha = () => calcularSheele({ tipo: 'Aire', subidasCaracteristica: {}, bonosHabilidad: {} }, haley(), senor);

  it('los PV son el doble de la presencia del señor, no salen de Constitución', () => {
    // Haley tiene CON 2: por la fórmula normal tendría 40 PV, y son 80.
    expect(ficha().puntosVida).toBe(80);
    expect(haley().caracteristicas.CON).toBe(2);
  });

  it('el turno es el de su señor desarmado', () => {
    expect(ficha().turno).toBe(75);
  });

  it('comparte las resistencias de su señor', () => {
    expect(ficha().resistencias).toEqual(senor.resistencias);
  });

  it('la Proyección Mágica es el doble de la presencia base, sin bono de Destreza', () => {
    expect(ficha().proyeccionMagica).toBe(70);
  });

  it('las características y habilidades de partida son las de su elemento', () => {
    expect(ficha().caracteristicas.POD).toBe(8);
    expect(ficha().habilidades['V. Mágica']).toBe(80);
  });
});

describe('lo que el señor le reparte al subir de nivel', () => {
  it('cinco bonos de +10 por nivel', () => {
    const f = calcularSheele(
      { tipo: 'Aire', subidasCaracteristica: {}, bonosHabilidad: { Acrobacias: 2 } },
      haley(),
      senor,
    );
    expect(f.bonosDisponibles).toBe(3 * BONOS_POR_NIVEL);
    expect(f.bonosRepartidos).toBe(2);
    // Acrobacias parte de 60 y sube +20.
    expect(f.habilidades.Acrobacias).toBe(80);
  });

  it('avisa si se reparten más bonos de los que hay, pero calcula igual', () => {
    const f = calcularSheele(
      { tipo: 'Aire', subidasCaracteristica: {}, bonosHabilidad: { Acrobacias: 30 } },
      haley(),
      senor,
    );
    expect(f.avisos.join(' ')).toMatch(/sólo hay 15/);
    expect(f.habilidades.Acrobacias).toBe(360);
  });

  it('una subida de característica por nivel, no una cada dos', () => {
    const f = calcularSheele(
      { tipo: 'Aire', subidasCaracteristica: { POD: 3 }, bonosHabilidad: {} },
      haley(),
      senor,
    );
    expect(f.caracteristicas.POD).toBe(11);
    expect(f.avisos.filter((a) => a.includes('subidas'))).toEqual([]);
  });

  it('avisa si se suben más características que niveles tiene el señor', () => {
    const f = calcularSheele(
      { tipo: 'Aire', subidasCaracteristica: { POD: 5 }, bonosHabilidad: {} },
      haley(),
      senor,
    );
    expect(f.avisos.join(' ')).toMatch(/una por nivel/);
  });

  it('una Sheele no puede saber más que su señor', () => {
    const f = calcularSheele(
      { tipo: 'Aire', subidasCaracteristica: {}, bonosHabilidad: {} },
      haley(),
      senor,
      { 'V. Mágica': 50 },
    );
    expect(f.avisos.join(' ')).toMatch(/V\. Mágica/);
  });

  it('un tipo que no existe se dice, no se traga', () => {
    const f = calcularSheele(
      { tipo: 'Inventado', subidasCaracteristica: {}, bonosHabilidad: {} },
      undefined,
      senor,
    );
    expect(f.avisos.join(' ')).toMatch(/no encuentro el tipo/i);
  });
});

describe('Potenciación Mística', () => {
  it('el tope depende de Controlar (Tabla 14)', () => {
    expect(zeonMaximoPotenciacion(0)).toBe(20);
    expect(zeonMaximoPotenciacion(49)).toBe(20);
    expect(zeonMaximoPotenciacion(120)).toBe(40);
    expect(zeonMaximoPotenciacion(400)).toBe(100);
    expect(zeonMaximoPotenciacion(9999)).toBe(100);
  });

  it('reproduce el ejemplo del manual', () => {
    // «Un convocador con Controlar 120 podría declarar que gasta 40 puntos de Zeon en
    // otorgar un +40 a la Proyección Mágica de su Sheele, pero si este estuviera en Forma
    // de Alma, obtendría únicamente un +20.»
    expect(potenciacionMistica(40, 120).bono).toBe(40);
    expect(potenciacionMistica(40, 120, true).bono).toBe(20);
  });

  it('gastar por encima del tope no sube el bono, y lo dice', () => {
    const p = potenciacionMistica(200, 120);
    expect(p.bono).toBe(40);
    expect(p.recortado).toBe(true);
    expect(p.avisos.join(' ')).toMatch(/el tope son 40/);
  });

  it('en Forma de Alma se redondea a grupos de 5 hacia abajo, no a la mitad exacta', () => {
    expect(potenciacionMistica(50, 200, true).bono).toBe(25);
    // 55/2 = 27,5 → hacia abajo en grupos de 5 son 25, no 30.
    expect(potenciacionMistica(55, 200, true).bono).toBe(25);
    expect(potenciacionMistica(30, 200, true).bono).toBe(15);
  });
});

describe('ceder ACT a la Sheele', () => {
  it('reproduce el ejemplo del manual', () => {
    // «Un hechicero con ACT 60 declara que cede 20 puntos: puede seguir acumulando 40 por
    // asalto, mientras que la elemental dispone de 20.»
    expect(cederACT(60, 20)).toEqual({ senor: 40, sheele: 20 });
  });

  it('no se puede ceder más de lo que se tiene', () => {
    expect(cederACT(60, 100)).toEqual({ senor: 0, sheele: 60 });
    expect(cederACT(60, -5)).toEqual({ senor: 60, sheele: 0 });
  });
});

describe('el tipo al azar (Tabla 13)', () => {
  it('cubre todo el rango del d100 sin huecos', () => {
    for (let n = 1; n <= 100; n++) expect(tipoPorTirada(n)).not.toBe('');
  });

  /**
   * El manual imprime «31-40» en la fila de Naturaleza y **vuelve a imprimir 31-40** en la
   * de Tierra, dejando 21-30 sin asignar. Se corrige a 21-30, que es lo único que encaja.
   */
  it('corrige la errata del salto de 21 a 30', () => {
    expect(tipoPorTirada(25)).toBe('Naturaleza');
    expect(tipoPorTirada(35)).toBe('Tierra');
    expect(tipoPorTirada(5)).toBe('Luz');
    expect(tipoPorTirada(95)).toBe('A elección del personaje');
  });
});
