import { describe, it, expect } from 'vitest';
import {
  BONO_RM_VINCULACION,
  BONO_RM_VINCULACION_LEJOS,
  bonoPorZeon,
  calcularEfectoNatural,
  calcularShamanica,
  calcularVodoun,
  costeSinOfuda,
  crearOfuda,
  danoVodoun,
  ofudaSirve,
  proyeccionNatural,
  resultadoDe,
  TEOREMAS,
} from './teoremas';
import teoremasJson from '../../data/arcana/teoremas.json';

describe('los Teoremas como concepto', () => {
  it('son los cuatro del capítulo más el general', () => {
    expect(TEOREMAS).toEqual(['General', 'Onmyodo', 'Vodoun', 'Shamanica', 'Magia natural']);
  });

  it('los datos traen los cinco, y cada uno con su descripción', () => {
    const datos = teoremasJson as { teorema: string; descripcion: string }[];
    expect(datos.map((t) => t.teorema)).toEqual([...TEOREMAS]);
    for (const t of datos) expect(t.descripcion.length).toBeGreaterThan(50);
  });
});

describe('Onmyodo: crear un Ofuda', () => {
  it('la dificultad sale de la tabla y el tiempo la modifica', () => {
    // Nivel 20 → 40 de dificultad; media hora es el punto neutro.
    expect(crearOfuda(20, 50, 'Media hora').dificultad).toBe(40);
    expect(crearOfuda(20, 50, 'Un minuto').dificultad).toBe(0);
    expect(crearOfuda(20, 50, 'Un mes').dificultad).toBe(160);
    // Nivel 82-90 es el tramo más caro.
    expect(crearOfuda(90, 50, 'Media hora').dificultadBase).toBe(440);
  });

  it('dentro va la mitad del coste en Grado Base, y eso baja el Zeon Máximo', () => {
    // El ejemplo del manual: Descarga Oscura, coste base 50 → 25 dentro del Ofuda.
    const o = crearOfuda(30, 50, 'Media hora');
    expect(o.zeonInvertido).toBe(25);
    expect(o.reduccionZeonMaximo).toBe(25);
  });

  it('avisa cuando el nivel se sale de la tabla en vez de inventarse una dificultad', () => {
    expect(crearOfuda(120, 50, 'Media hora').fueraDeTabla).toBe(true);
    expect(crearOfuda(120, 50, 'Media hora').dificultadBase).toBe(0);
    expect(crearOfuda(50, 50, 'Media hora').fueraDeTabla).toBe(false);
  });

  it('sin Ofuda se paga el doble y sólo en Grado Base', () => {
    // El ejemplo del manual: Impacto de Agua, coste base 40 → 80 sin Ofuda.
    expect(costeSinOfuda(40)).toEqual({ coste: 80, soloGradoBase: true });
  });

  it('un Ofuda de otro conjuro sirve si es de la misma Vía y no de nivel inferior', () => {
    // El ejemplo del manual: Ofuda de Control sobre los Líquidos (Agua 22) para lanzar
    // Impacto de Agua (Agua 20).
    expect(ofudaSirve({ via: 'Agua', nivel: 22 }, { via: 'Agua', nivel: 20 })).toBe(true);
    expect(ofudaSirve({ via: 'Agua', nivel: 20 }, { via: 'Agua', nivel: 22 })).toBe(false);
    expect(ofudaSirve({ via: 'Fuego', nivel: 40 }, { via: 'Agua', nivel: 20 })).toBe(false);
  });
});

describe('Vodoun: Vínculos físicos', () => {
  it('los vínculos suman su bono a la RM del conjuro', () => {
    const r = calcularVodoun({ vinculos: ['Pelo', 'Sangre'] });
    expect(r.bonoRM).toBe(30);
    expect(r.avisos).toEqual([]);
  });

  it('no se pueden usar dos del mismo tipo', () => {
    const r = calcularVodoun({ vinculos: ['Sangre', 'Sangre'] });
    expect(r.bonoRM).toBe(20);
    expect(r.avisos.join(' ')).toMatch(/mismo tipo/);
  });

  it('el objeto personal no se apila con el mayor', () => {
    const r = calcularVodoun({ vinculos: ['Objeto personal', 'Objeto personal mayor'] });
    expect(r.bonoRM).toBe(20);
    expect(r.avisos.join(' ')).toMatch(/no se apilan/);
  });

  it('el familiar directo no se apila con sus restos', () => {
    const r = calcularVodoun({ vinculos: ['Un familiar directo', 'Restos de un familiar directo'] });
    expect(r.bonoRM).toBe(30);
  });

  it('el Ritual de Vinculación gasta un vínculo, que deja de dar bono', () => {
    const r = calcularVodoun({
      vinculos: ['Pelo', 'Sangre'],
      ritualDeVinculacion: true,
    });
    // Se gasta el Pelo (+10, el más barato) y queda la Sangre.
    expect(r.gastadoEnVincular).toBe('Pelo');
    expect(r.bonoRM).toBe(20);
    expect(r.automatico).toBe(true);
    // Y el objetivo gana +40 por no haberle fijado con Proyección Mágica.
    expect(r.bonoRMObjetivo).toBe(BONO_RM_VINCULACION);
    expect(r.neto).toBe(-20);
  });

  it('sin ningún vínculo no hay ritual que valga', () => {
    const r = calcularVodoun({ vinculos: [], ritualDeVinculacion: true });
    expect(r.automatico).toBe(false);
    expect(r.avisos.join(' ')).toMatch(/al menos un Vínculo/);
  });

  it('a gran distancia el objetivo gana +100 y el ritual dura una hora por 25 km', () => {
    const r = calcularVodoun({
      vinculos: ['Sangre'],
      ritualDeVinculacion: true,
      granDistancia: true,
      kilometros: 100,
    });
    expect(r.bonoRMObjetivo).toBe(BONO_RM_VINCULACION_LEJOS);
    expect(r.horasDeRitual).toBe(4);
    // Los kilómetros sueltos cuentan como una hora entera.
    expect(calcularVodoun({ ...{ vinculos: ['Sangre'], ritualDeVinculacion: true, granDistancia: true }, kilometros: 30 }).horasDeRitual).toBe(2);
  });

  it('la debilidad ofensiva parte el daño y redondea en grupos de 5 hacia arriba', () => {
    expect(danoVodoun(100)).toBe(50);
    expect(danoVodoun(90)).toBe(45);
    // 55/2 = 27,5 → el siguiente múltiplo de 5 es 30.
    expect(danoVodoun(55)).toBe(30);
    expect(danoVodoun(41)).toBe(25);
  });
});

describe('Shamanica: zonas espirituales', () => {
  it('en una Zona Vacía no se puede lanzar nada', () => {
    const r = calcularShamanica('Vacía', false, 'Base', 'Neutrales');
    expect(r.fracasa).toBe(true);
    expect(r.grado).toBeNull();
  });

  it('una Zona Débil sólo da para grado base', () => {
    const r = calcularShamanica('Débil', false, 'Avanzado', 'Neutrales');
    expect(r.grado).toBe('Base');
    expect(r.avisos.join(' ')).toMatch(/no da para grado Avanzado/);
  });

  it('una Zona Normal no llega al arcano', () => {
    expect(calcularShamanica('Normal', false, 'Arcano', 'Neutrales').grado).toBe('Avanzado');
  });

  it('en una Zona Poderosa se gasta la mitad del Zeon; la Excepcional suma +30 al ACT', () => {
    expect(calcularShamanica('Poderosa', false, 'Base', 'Neutrales').mitadDeZeon).toBe(true);
    const e = calcularShamanica('Excepcional', false, 'Base', 'Neutrales');
    expect(e.mitadDeZeon).toBe(true);
    expect(e.bonoACT).toBe(30);
  });

  it('los espíritus afines dejan saltarse el límite de la zona', () => {
    // El ejemplo del manual: grado base en una zona débil pero afín → grado intermedio.
    const r = calcularShamanica('Débil', false, 'Base', 'Afines');
    expect(r.grado).toBe('Intermedio');
  });

  it('los espíritus opuestos bajan un grado, y en base hacen fracasar el conjuro', () => {
    expect(calcularShamanica('Normal', false, 'Avanzado', 'Opuestos').grado).toBe('Intermedio');
    const r = calcularShamanica('Normal', false, 'Base', 'Opuestos');
    expect(r.fracasa).toBe(true);
    expect(r.avisos.join(' ')).toMatch(/fracasa automáticamente/);
  });

  it('llamar espíritus sube un grado, y avisa de que desde ahí ya no se puede subir más', () => {
    // El ejemplo del manual: de Débil a Intermedia por 200, y ahí se acaba.
    const r = calcularShamanica('Débil', true, 'Base', 'Neutrales');
    expect(r.zona).toBe('Normal');
    expect(r.zeonLlamada).toBe(200);
    expect(r.avisos.join(' ')).toMatch(/sigue siendo originalmente Débil/);
  });

  it('en una Zona Excepcional no hay nada que llamar', () => {
    const r = calcularShamanica('Excepcional', true, 'Base', 'Neutrales');
    expect(r.zeonLlamada).toBe(0);
    expect(r.avisos.join(' ')).toMatch(/grado máximo/);
  });

  it('llamar espíritus a una Zona Vacía cuesta 1.000 y la deja Débil', () => {
    const r = calcularShamanica('Vacía', true, 'Base', 'Neutrales');
    expect(r.zona).toBe('Débil');
    expect(r.zeonLlamada).toBe(1000);
    expect(r.fracasa).toBe(false);
  });
});

describe('Magia natural: el ejemplo de Alice', () => {
  // «Alice… quiere conseguir las llaves… El DM considera que es un efecto de nivel 2, por
  // lo que tiene dificultad 18 en el control, más 1 por estar a distancia de Alice y usar
  // esta el modificador Proyectado +0. Alice, que tiene Poder 8, acumula varios asaltos y
  // gasta 150 puntos de Zeon, lo que le confiere un +4 a su control, logrando un total de
  // 12. La joven hace su tirada y obtiene un 8 en el dado, lo que suma un total de 20: un
  // punto por encima de la dificultad requerida.» (Arcana Exxet, pág. 18)
  const alice = () =>
    calcularEfectoNatural({
      nivel: 2,
      distancia: 'Proyectado +0',
      duracion: 'Instantáneo',
      zeon: 150,
    });

  it('la dificultad final es 19: 18 del nivel más 1 de la distancia', () => {
    const e = alice();
    expect(e.dificultadBase).toBe(18);
    expect(e.porDistancia).toBe(1);
    expect(e.porDuracion).toBe(0);
    expect(e.dificultadFinal).toBe(19);
  });

  it('150 de Zeon dan +4 al control', () => {
    expect(alice().bonoZeon).toBe(4);
  });

  it('con Poder 8 y +4, el control es 12; con un 8 en el dado sale 20', () => {
    const e = alice();
    const control = 8 + e.bonoTotal;
    expect(control).toBe(12);
    const total = control + 8;
    expect(total).toBe(20);
    expect(total - e.dificultadFinal).toBe(1);
  });

  it('un punto por encima es «1+»: éxito, perdiendo cansancio igual al nivel', () => {
    const r = resultadoDe(1);
    expect(r.resultado).toBe('1+');
    expect(r.efecto).toMatch(/cansancio/);
  });
});

describe('Magia natural: las tablas', () => {
  it('el bono por Zeon es escalonado, no proporcional', () => {
    expect(bonoPorZeon(0)).toBe(-8);
    expect(bonoPorZeon(19)).toBe(-8);
    expect(bonoPorZeon(20)).toBe(-4);
    expect(bonoPorZeon(50)).toBe(0);
    expect(bonoPorZeon(999)).toBe(14);
    expect(bonoPorZeon(5000)).toBe(16);
  });

  it('cada margen cae en su fila de la Tabla 9', () => {
    expect(resultadoDe(10).resultado).toBe('3+');
    expect(resultadoDe(3).resultado).toBe('3+');
    expect(resultadoDe(2).resultado).toBe('1+');
    expect(resultadoDe(0).resultado).toBe('0+');
    expect(resultadoDe(-1).resultado).toBe('-1 a -4');
    expect(resultadoDe(-4).resultado).toBe('-1 a -4');
    expect(resultadoDe(-5).resultado).toBe('-5 a -8');
    expect(resultadoDe(-9).resultado).toBe('-9 o inferior');
    expect(resultadoDe(-100).resultado).toBe('-9 o inferior');
  });

  it('la especialidad da +2 en su campo y -2 fuera', () => {
    const base = { nivel: 1, distancia: 'Toque', duracion: 'Instantáneo', zeon: 50 };
    expect(calcularEfectoNatural({ ...base, dentroDeSuEspecialidad: true }).bonoEspecialidad).toBe(2);
    expect(calcularEfectoNatural({ ...base, dentroDeSuEspecialidad: false }).bonoEspecialidad).toBe(-2);
    // Sin especialidad elegida, ni bono ni penalización.
    expect(calcularEfectoNatural(base).bonoEspecialidad).toBe(0);
  });

  it('el elementalista puro gana +4 pero no penaliza fuera: simplemente no obtiene nada', () => {
    const base = { nivel: 1, distancia: 'Toque', duracion: 'Instantáneo', zeon: 50, elementalistaPuro: true };
    expect(calcularEfectoNatural({ ...base, dentroDeSuEspecialidad: true }).bonoEspecialidad).toBe(4);
    expect(calcularEfectoNatural({ ...base, dentroDeSuEspecialidad: false }).bonoEspecialidad).toBe(0);
  });

  it('«Un paso atrás» resta 4 al control', () => {
    const e = calcularEfectoNatural({
      nivel: 1, distancia: 'Toque', duracion: 'Instantáneo', zeon: 50, unPasoAtras: true,
    });
    expect(e.penalizacion).toBe(-4);
    expect(e.bonoTotal).toBe(-4);
  });

  it('la duración encarece el efecto', () => {
    const dia = calcularEfectoNatural({ nivel: 1, distancia: 'Toque', duracion: '1 día', zeon: 50 });
    expect(dia.porDuracion).toBe(5);
    expect(dia.dificultadFinal).toBe(19);
  });

  it('la Proyección Mágica natural es el doble de la presencia más Destreza y la X', () => {
    // El ejemplo del manual: tercer nivel con Destreza 5 y Proyectado +50 → 130.
    // Presencia de nivel 3 = 40, bono de Destreza 5 = 0, más 50 → 130.
    expect(proyeccionNatural(40, 0, 50)).toBe(130);
  });
});
