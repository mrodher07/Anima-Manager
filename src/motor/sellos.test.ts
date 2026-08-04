import { describe, it, expect } from 'vitest';
import {
  CATALOGO_SELLOS,
  CM_SELLO,
  FICHAS_SELLO,
  GNOSIS_INMUNE,
  KI_SELLO,
  MENORES_POR_MAYOR,
  SELLOS,
  TURNO_INVOCAR,
  consecuenciaFracaso,
  controlDeInvocacion,
  costeDeRetrasar,
  costeEnKi,
  equivalenciaEnMenores,
  leerClave,
  mantenimiento,
  resumirSellos,
  type Ejecucion,
} from './sellos';

describe('los cinco Sellos', () => {
  it('son Aire, Agua, Fuego, Metal y Madera', () => {
    expect(SELLOS).toEqual(['Aire', 'Agua', 'Fuego', 'Metal', 'Madera']);
  });

  it('cada uno está atado a su elemento del Samsara', () => {
    expect(FICHAS_SELLO.Fuego.elemento).toBe('Fuego y Luz');
    expect(FICHAS_SELLO.Metal.elemento).toBe('Tierra');
    expect(FICHAS_SELLO.Madera.elemento).toBe('Oscuridad');
  });

  it('el catálogo son los cinco elementos por sus dos grados', () => {
    expect(CATALOGO_SELLOS).toHaveLength(10);
  });

  it('lee y escribe las claves', () => {
    expect(leerClave('Fuego Mayor')).toEqual({ sello: 'Fuego', grado: 'Mayor' });
    expect(leerClave('Madera Menor')).toEqual({ sello: 'Madera', grado: 'Menor' });
    expect(leerClave('Rayo Menor')).toBeNull();
    expect(leerClave('Fuego Supremo')).toBeNull();
  });
});

describe('costes', () => {
  it('dominar cuesta 30 CM el Menor y 60 el Mayor', () => {
    expect(CM_SELLO.Menor).toBe(30);
    expect(CM_SELLO.Mayor).toBe(60);
  });

  it('ejecutar cuesta 5 puntos de Ki el Menor y 15 el Mayor', () => {
    expect(KI_SELLO.Menor).toBe(5);
    expect(KI_SELLO.Mayor).toBe(15);
  });

  it('Takanosuke gasta 120 CM en Madera Menor, Madera Mayor y Fuego Menor', () => {
    const r = resumirSellos(['Madera Menor', 'Madera Mayor', 'Fuego Menor']);
    expect(r.cm).toBe(120);
    expect(r.avisos).toEqual([]);
  });

  it('el Mayor de un elemento pide antes el Menor de ese mismo elemento', () => {
    const r = resumirSellos(['Madera Mayor']);
    expect(r.avisos.join(' ')).toContain('hace falta antes el de Madera Menor');
    // Se cobra igual: la ficha avisa, no bloquea.
    expect(r.cm).toBe(60);
  });

  it('avisa de un Sello que no existe', () => {
    expect(resumirSellos(['Rayo Mayor']).avisos.join(' ')).toContain('Sello desconocido');
  });
});

describe('equivalencia entre grados', () => {
  it('un Sello Mayor vale por cinco Menores de su elemento', () => {
    expect(MENORES_POR_MAYOR).toBe(5);
    const uno: Ejecucion = [{ sello: 'Madera', grado: 'Mayor', cantidad: 1 }];
    expect(equivalenciaEnMenores(uno)).toEqual({ Madera: 5 });
  });

  it('la Asagiri sale igual con cinco Menores de Madera que con un Mayor', () => {
    const cinco: Ejecucion = [{ sello: 'Madera', grado: 'Menor', cantidad: 5 }];
    const uno: Ejecucion = [{ sello: 'Madera', grado: 'Mayor', cantidad: 1 }];
    expect(equivalenciaEnMenores(cinco)).toEqual(equivalenciaEnMenores(uno));
    // Pero en Ki no cuesta lo mismo: 25 frente a 15.
    expect(costeEnKi(cinco)).toBe(25);
    expect(costeEnKi(uno)).toBe(15);
  });

  it('suma los elementos por separado', () => {
    const mezcla: Ejecucion = [
      { sello: 'Fuego', grado: 'Mayor', cantidad: 1 },
      { sello: 'Metal', grado: 'Menor', cantidad: 1 },
    ];
    expect(equivalenciaEnMenores(mezcla)).toEqual({ Fuego: 5, Metal: 1 });
    // El Gandalfhon del manual: Fuego Mayor 1 y Metal Menor 1 → 20 de Ki.
    expect(costeEnKi(mezcla)).toBe(20);
  });
});

describe('Control de Invocación', () => {
  it('la dificultad sube 10 por cada nivel de diferencia', () => {
    // El ejemplo del manual: nivel 2 contra criatura de nivel 5 → 30.
    expect(controlDeInvocacion({ nivelInvocador: 2, nivelCriatura: 5 }).dificultad).toBe(30);
    // Y contra una de nivel 10 → 80.
    expect(controlDeInvocacion({ nivelInvocador: 2, nivelCriatura: 10 }).dificultad).toBe(80);
  });

  it('las criaturas de nivel igual o inferior vienen solas', () => {
    const r = controlDeInvocacion({ nivelInvocador: 5, nivelCriatura: 3 });
    expect(r.dificultad).toBe(0);
    expect(r.automatica).toBe(true);
  });

  it('el ejemplo de Takanosuke y el elemental oscuro', () => {
    // Sombra de nivel 3 contra un elemental de nivel 7: dificultad 40. Refuerza con un
    // Sello Menor y uno Mayor, que suman +30, así que le basta con sacar 10.
    const r = controlDeInvocacion({
      nivelInvocador: 3,
      nivelCriatura: 7,
      refuerzo: [
        { sello: 'Madera', grado: 'Menor', cantidad: 1 },
        { sello: 'Madera', grado: 'Mayor', cantidad: 1 },
      ],
    });
    expect(r.dificultad).toBe(40);
    expect(r.bonoRefuerzo).toBe(30);
    expect(r.objetivo).toBe(10);
  });

  it('el Pacto de Sangre sube 30 la dificultad', () => {
    // El otro ejemplo: nivel 2 contra un demonio de nivel 6 → 40 + 30 = 70.
    const r = controlDeInvocacion({ nivelInvocador: 2, nivelCriatura: 6, esPacto: true });
    expect(r.dificultad).toBe(70);
  });

  it('el Pacto de Sangre dobla el coste en Ki', () => {
    const e: Ejecucion = [{ sello: 'Fuego', grado: 'Mayor', cantidad: 1 }];
    expect(costeEnKi(e)).toBe(15);
    expect(costeEnKi(e, true)).toBe(30);
  });

  it('un Pacto nunca es automático, aunque la criatura sea de nivel inferior', () => {
    const r = controlDeInvocacion({ nivelInvocador: 9, nivelCriatura: 2, esPacto: true });
    expect(r.dificultad).toBe(30);
    expect(r.automatica).toBe(false);
  });

  it('avisa con criaturas de Gnosis 35 o más', () => {
    const r = controlDeInvocacion({
      nivelInvocador: 10,
      nivelCriatura: 12,
      gnosisCriatura: GNOSIS_INMUNE,
    });
    expect(r.avisos.join(' ')).toContain('ignora los Sellos');
  });

  it('con más Gnosis que la criatura no avisa', () => {
    const r = controlDeInvocacion({
      nivelInvocador: 10,
      nivelCriatura: 12,
      gnosisCriatura: 35,
      gnosisInvocador: 40,
    });
    expect(r.avisos).toEqual([]);
  });
});

describe('Tabla 25: fracaso al invocar', () => {
  it('un fallo leve sólo cuesta el Ki invertido', () => {
    expect(consecuenciaFracaso(0).efecto).toContain('pierdes el Ki invertido');
    expect(consecuenciaFracaso(-20).efecto).toContain('pierdes el Ki invertido');
  });

  it('a partir de -21 se rompe el Pacto de Sangre', () => {
    expect(consecuenciaFracaso(-21).efecto).toContain('se rompe');
    expect(consecuenciaFracaso(-50).efecto).toContain('se rompe');
  });

  it('a partir de -51 pierde además Cansancio', () => {
    expect(consecuenciaFracaso(-51).efecto).toContain('Cansancio');
    expect(consecuenciaFracaso(-100).efecto).toContain('Cansancio');
  });

  it('por debajo de -101 pierde la consciencia', () => {
    expect(consecuenciaFracaso(-101).efecto).toContain('consciencia');
    expect(consecuenciaFracaso(-500).efecto).toContain('consciencia');
  });
});

describe('mantener a la criatura', () => {
  it('cuesta 1 de Ki por asalto, y 2 desde nivel 10', () => {
    expect(mantenimiento(9)).toBe(1);
    expect(mantenimiento(10)).toBe(2);
    expect(mantenimiento(25)).toBe(2);
  });

  it('retrasar una invocación cuesta tantos puntos como Sellos lleve', () => {
    // El Gandalfhon del manual: dos Sellos, así que dos puntos por asalto.
    const e: Ejecucion = [
      { sello: 'Fuego', grado: 'Mayor', cantidad: 1 },
      { sello: 'Metal', grado: 'Menor', cantidad: 1 },
    ];
    expect(costeDeRetrasar(e)).toBe(2);
  });

  it('invocar tiene el mismo Turno que atacar desarmado', () => {
    expect(TURNO_INVOCAR).toBe(20);
  });
});
