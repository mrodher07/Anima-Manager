import { describe, it, expect } from 'vitest';
import {
  CARACTERISTICAS_KI,
  CONSECUENCIAS_ACUMULACION,
  acumulacionBase,
  calcularKi,
  consecuenciaDe,
  dependientesDe,
  desgasteporKiBajo,
  habilidadesDisponibles,
  recuperacionPorHora,
  type CaracteristicaKi,
  type ContextoKi,
  type DatosKi,
  type EleccionesKi,
  type HabilidadKi,
  type LimiteKi,
} from './ki';
import { REGLAMENTO_OFICIAL } from './reglamento';
import habilidadesKiJson from '../../data/reglas/habilidadesKi.json';
import tablasBase from '../../data/reglas/tablasBase.json';
import artesMarcialesJson from '../../data/reglas/artesMarciales.json';

const habilidades = habilidadesKiJson as HabilidadKi[];
const tablaAcumulacion = tablasBase.acumulacionKi;
const limites = tablasBase.limitesKi as LimiteKi[];

const cmPorArteMarcial: Record<string, number> = {};
for (const a of artesMarcialesJson as { arte: string; CM?: number }[]) {
  cmPorArteMarcial[a.arte] = a.CM ?? 0;
}

const datos: DatosKi = { tablaAcumulacion, habilidades, limites, cmPorArteMarcial };

const cars = (v: Partial<Record<CaracteristicaKi, number>>) =>
  Object.fromEntries(CARACTERISTICAS_KI.map((c) => [c, v[c] ?? 0])) as Record<
    CaracteristicaKi,
    number
  >;

function ctx(parcial: Partial<ContextoKi> = {}): ContextoKi {
  return {
    caracteristicas: cars({}),
    pdKi: {},
    pdAcumulacion: {},
    pdCM: 0,
    especialKi: {},
    especialAcumulacion: {},
    costeKi: 2,
    costeAcumulacion: 20,
    cmCategoria: 0,
    cmVentajas: 0,
    nivel: 1,
    pdTotales: 600,
    penalizadorArmadura: 0,
    advertir: 0,
    ocultarse: 0,
    especialDeteccion: 0,
    especialOcultacion: 0,
    bonoDeteccionPorNivel: 0,
    bonoOcultacionPorNivel: 0,
    bonoOcultacionRaza: 0,
    natura: 10,
    poderInnato: false,
    limiteDual: false,
    ...parcial,
  };
}

const vacias = (p: Partial<EleccionesKi> = {}): EleccionesKi => ({
  habilidades: [],
  limites: [],
  tecnicas: [],
  artesMarciales: [],
  ...p,
});

const calcula = (e: Partial<EleccionesKi>, c: Partial<ContextoKi> = {}) =>
  calcularKi(vacias(e), datos, ctx(c), REGLAMENTO_OFICIAL);

describe('Tabla 53: Acumulación de Ki', () => {
  it('da 1 hasta 9, 2 hasta 12, 3 hasta 15 y 4 de 16 en adelante', () => {
    expect(acumulacionBase(1, tablaAcumulacion)).toBe(1);
    expect(acumulacionBase(9, tablaAcumulacion)).toBe(1);
    expect(acumulacionBase(10, tablaAcumulacion)).toBe(2);
    expect(acumulacionBase(12, tablaAcumulacion)).toBe(2);
    expect(acumulacionBase(13, tablaAcumulacion)).toBe(3);
    expect(acumulacionBase(15, tablaAcumulacion)).toBe(3);
    expect(acumulacionBase(16, tablaAcumulacion)).toBe(4);
    expect(acumulacionBase(20, tablaAcumulacion)).toBe(4);
  });

  it('una característica a 0 no da Acumulación', () => {
    // La ficha lo escribe como IF(AGI=0, 0, VLOOKUP(...)): sin característica no hay nada.
    expect(acumulacionBase(0, tablaAcumulacion)).toBe(0);
  });
});

describe('puntos de Ki', () => {
  it('reproduce el ejemplo de Celia del Core Exxet', () => {
    // FUE 5, DES 9, AGI 10, CON 5, POD 6, VOL 4 → reserva 39.
    const r = calcula(
      {},
      { caracteristicas: cars({ FUE: 5, DES: 9, AGI: 10, CON: 5, POD: 6, VOL: 4 }) },
    );
    expect(r.puntos.FUE.total).toBe(5);
    expect(r.puntos.DES.total).toBe(9);
    expect(r.puntos.AGI.total).toBe(10);
    expect(r.reserva).toBe(39);
    // Acumulación inicial: sólo AGI llega a 10, así que es la única con 2.
    expect(r.acumulacion.AGI.total).toBe(2);
    expect(r.acumulacion.FUE.total).toBe(1);
    expect(r.acumulacionTotal).toBe(7);
  });

  it('cada punto por encima de 10 vale doble', () => {
    // El manual usa DES 13 → 16 como ejemplo.
    const r = calcula({}, { caracteristicas: cars({ DES: 13 }) });
    expect(r.puntos.DES.base).toBe(16);
  });

  it('una característica a 0 no aporta Ki', () => {
    expect(calcula({}, {}).reserva).toBe(0);
  });

  it('el Ki comprado con PD usa el coste de la categoría', () => {
    const r = calcula({}, { caracteristicas: cars({ FUE: 8 }), pdKi: { FUE: 10 }, costeKi: 2 });
    expect(r.puntos.FUE.comprado).toBe(5);
    expect(r.puntos.FUE.total).toBe(13);
  });
});

describe('Ryo, el Tecnicista de la ficha original', () => {
  // Ki!F24 = 60, Ki!D24 = 9, Ki!C29 = 60 (50 de Tecnicista + 10 de artes marciales).
  // Ryo tiene la ventaja **Poder innato**, así que su Reserva no es la suma de las seis
  // características (que daría 51) sino seis veces el Ki de su Poder.
  const ryo = () =>
    calcula(
      { artesMarciales: ['Kung Fu (Avanzado)'], unificado: true },
      {
        caracteristicas: cars({ AGI: 9, CON: 8, DES: 9, FUE: 8, POD: 10, VOL: 7 }),
        cmCategoria: 50,
        costeKi: 1,
        costeAcumulacion: 10,
        pdAcumulacion: { AGI: 20 },
        poderInnato: true,
      },
    );

  it('con Poder innato tiene 60 puntos de Ki, no los 51 de la suma', () => {
    expect(ryo().reserva).toBe(60);
    const sinVentaja = calcula(
      {},
      { caracteristicas: cars({ AGI: 9, CON: 8, DES: 9, FUE: 8, POD: 10, VOL: 7 }) },
    );
    expect(sinVentaja.reserva).toBe(51);
  });

  it('tiene 9 de Acumulación total', () => {
    // AGI 3 (1 base + 2 compradas), CON 1, DES 1, FUE 1, POD 2, VOL 1.
    const r = ryo();
    expect(r.acumulacion.AGI.total).toBe(3);
    expect(r.acumulacion.POD.total).toBe(2);
    expect(r.acumulacionTotal).toBe(9);
  });

  it('llega a 60 de CM sumando categoría y arte marcial', () => {
    expect(ryo().conocimientoMarcial.total).toBe(60);
  });
});

describe('Conocimiento Marcial', () => {
  it('Christopher, Mentalista de nivel 11, tiene 110 de CM', () => {
    // El CM de la categoría se multiplica por los niveles hechos en ella: 10 × 11.
    const r = calcula({}, { cmCategoria: 110, nivel: 11, pdTotales: 1600 });
    expect(r.conocimientoMarcial.total).toBe(110);
  });

  it('cada 5 PD dan 5 CM', () => {
    expect(calcula({}, { pdCM: 25 }).conocimientoMarcial.comprado).toBe(25);
    // 27 PD no llegan a la sexta compra: siguen siendo 25 CM.
    expect(calcula({}, { pdCM: 27 }).conocimientoMarcial.comprado).toBe(25);
  });

  it('Maestro marcial se suma como CM de ventaja', () => {
    expect(calcula({}, { cmVentajas: 80 }).conocimientoMarcial.total).toBe(80);
  });

  it('avisa al pasarse del tope de PD en CM', () => {
    const r = calcula({}, { pdCM: 100, pdTotales: 600 });
    expect(r.conocimientoMarcial.limitePD).toBe(60);
    expect(r.avisos.join(' ')).toContain('tope es 60');
  });

  it('avisa si se compromete más CM del que hay', () => {
    const r = calcula({ habilidades: ['Uso del Ki'] }, { cmCategoria: 10 });
    expect(r.conocimientoMarcial.gastado).toBe(40);
    expect(r.avisos.join(' ')).toContain('Has comprometido 40 CM y sólo tienes 10');
  });
});

describe('árbol de habilidades', () => {
  it('sólo Uso del Ki y Uso del Némesis no dependen de nada', () => {
    const raices = habilidades.filter((h) => !h.requisito).map((h) => h.habilidad);
    expect(raices).toEqual(['Uso del Ki', 'Uso del Némesis']);
  });

  it('todos los requisitos apuntan a habilidades que existen', () => {
    const nombres = new Set(habilidades.map((h) => h.habilidad));
    const huerfanas = habilidades.filter(
      (h) =>
        (h.requisito && !nombres.has(h.requisito)) ||
        (h.requisitoExtra && !nombres.has(h.requisitoExtra)),
    );
    expect(huerfanas).toEqual([]);
  });

  it('avisa cuando falta un requisito, pero no impide elegirla', () => {
    const r = calcula({ habilidades: ['Zen'] }, { cmCategoria: 200 });
    expect(r.avisos.join(' ')).toContain('Zen necesita Inhumanidad');
    // Se cobra igual: la aplicación avisa, no bloquea.
    expect(r.conocimientoMarcial.gastado).toBe(50);
  });

  it('no avisa cuando la cadena está completa', () => {
    const r = calcula(
      { habilidades: ['Uso del Ki', 'Inhumanidad', 'Zen'] },
      { cmCategoria: 200 },
    );
    expect(r.avisos).toEqual([]);
    expect(r.conocimientoMarcial.gastado).toBe(120);
  });

  it('Forma de Vacío pide los dos requisitos', () => {
    const r = calcula(
      { habilidades: ['Uso del Némesis', 'Extrusión de Vacío', 'Forma de Vacío'] },
      { cmCategoria: 500 },
    );
    expect(r.avisos.join(' ')).toContain('Forma de Vacío necesita Cuerpo de Vacío');
  });

  it('habilidadesDisponibles sólo ofrece lo que ya puedes aprender', () => {
    const sinNada = habilidadesDisponibles(habilidades, []).map((h) => h.habilidad);
    expect(sinNada).toEqual(['Uso del Ki', 'Uso del Némesis']);

    const conUso = habilidadesDisponibles(habilidades, ['Uso del Ki']).map((h) => h.habilidad);
    expect(conUso).toContain('Control del Ki');
    expect(conUso).toContain('Extrusión de presencia');
    expect(conUso).not.toContain('Uso del Ki');
    expect(conUso).not.toContain('Detección del Ki');
  });

  it('dependientesDe encuentra lo que colgaría en el aire', () => {
    expect(dependientesDe(habilidades, 'Extrusión de presencia')).toContain('Armadura de energía');
    expect(dependientesDe(habilidades, 'Zen')).toEqual([]);
  });
});

describe('Detección y Ocultación del Ki', () => {
  it('sólo existen si se tiene la habilidad', () => {
    const sin = calcula({ habilidades: ['Uso del Ki'] }, { cmCategoria: 100, advertir: 60 });
    expect(sin.deteccion).toBeNull();
    expect(sin.ocultacion).toBeNull();
  });

  it('reproduce el ejemplo de Celia: CM 120 y Advertir 60 dan 90', () => {
    const r = calcula(
      { habilidades: ['Uso del Ki', 'Control del Ki', 'Detección del Ki'] },
      { cmCategoria: 120, advertir: 60 },
    );
    expect(r.deteccion).toBe(90);
  });

  it('Percepción del Ki suma 10 por nivel', () => {
    const r = calcula(
      { habilidades: ['Uso del Ki', 'Control del Ki', 'Detección del Ki'] },
      { cmCategoria: 120, advertir: 60, bonoDeteccionPorNivel: 10, nivel: 3 },
    );
    expect(r.deteccion).toBe(120);
  });

  it('los D’Anjayni suman 50 a la Ocultación', () => {
    const r = calcula(
      { habilidades: ['Uso del Ki', 'Uso de la energía necesaria', 'Ocultación del Ki'] },
      { cmCategoria: 100, ocultarse: 40, bonoOcultacionRaza: 50 },
    );
    expect(r.ocultacion).toBe(120);
  });
});

describe('Límites', () => {
  it('cobra su coste en CM', () => {
    const r = calcula({ limites: ['Mors: Límite de la Muerte'] }, { cmCategoria: 100 });
    expect(r.conocimientoMarcial.gastado).toBe(20);
  });

  it('sólo se puede tener uno', () => {
    const r = calcula(
      { limites: ['Mors: Límite de la Muerte', 'Cruor: Límite de la Sangre'] },
      { cmCategoria: 100 },
    );
    expect(r.avisos.join(' ')).toContain('Sólo puedes tener 1 Límite');
  });

  it('con Límite Dual se pueden tener dos', () => {
    const r = calcula(
      { limites: ['Mors: Límite de la Muerte', 'Cruor: Límite de la Sangre'] },
      { cmCategoria: 100, limiteDual: true },
    );
    expect(r.avisos).toEqual([]);
  });

  it('piden Natura 10 o más', () => {
    const r = calcula({ limites: ['Cruor: Límite de la Sangre'] }, { cmCategoria: 100, natura: 5 });
    expect(r.avisos.join(' ')).toContain('Natura 10 o más');
  });
});

describe('armadura y acumulación', () => {
  it('resta 1 de Acumulación por cada 20 de penalizador', () => {
    const base = { caracteristicas: cars({ AGI: 16 }) };
    expect(calcula({}, base).acumulacion.AGI.total).toBe(4);
    expect(calcula({}, { ...base, penalizadorArmadura: -25 }).acumulacion.AGI.total).toBe(3);
    expect(calcula({}, { ...base, penalizadorArmadura: -60 }).acumulacion.AGI.total).toBe(1);
  });

  it('nunca baja de 0', () => {
    const r = calcula({}, { caracteristicas: cars({ AGI: 5 }), penalizadorArmadura: -100 });
    expect(r.acumulacion.AGI.total).toBe(0);
  });
});

describe('la mitad de la Acumulación', () => {
  it('redondea hacia arriba, como dice el Core', () => {
    const r = calcula({}, { caracteristicas: cars({ AGI: 13, POD: 16 }) });
    expect(r.acumulacion.AGI.total).toBe(3);
    expect(r.acumulacion.AGI.mitad).toBe(2);
    expect(r.acumulacion.POD.mitad).toBe(2);
  });
});

describe('Poder Innato', () => {
  it('multiplica por seis el Ki del Poder', () => {
    // El ejemplo del manual: POD 11 → 12 de Ki → Reserva 72.
    const r = calcula(
      { unificado: true },
      { caracteristicas: cars({ POD: 11, FUE: 8, AGI: 9 }), poderInnato: true },
    );
    expect(r.reserva).toBe(72);
  });

  it('avisa si la mesa no juega con Unificación', () => {
    const r = calcula({}, { caracteristicas: cars({ POD: 11 }), poderInnato: true });
    expect(r.avisos.join(' ')).toContain('Unificación');
  });
});

describe('consecuencias de acumular', () => {
  it('por debajo de 20 no pasa nada', () => {
    expect(consecuenciaDe(19)).toBeUndefined();
  });

  it('los umbrales son 20, 40, 80 y 120', () => {
    expect(CONSECUENCIAS_ACUMULACION.map((c) => c.desde)).toEqual([20, 40, 80, 120]);
    expect(consecuenciaDe(20)?.perdidaSiNoSeUsa).toBe(1);
    expect(consecuenciaDe(45)?.perdidaSiNoSeUsa).toBe(5);
    expect(consecuenciaDe(80)?.perdidaSiNoSeUsa).toBe(10);
    expect(consecuenciaDe(300)?.perdidaSiNoSeUsa).toBe('mitad');
  });
});

describe('recuperación y desgaste', () => {
  it('sin ventaja son 6 puntos por hora, y meditar lo dobla', () => {
    expect(recuperacionPorHora()).toBe(6);
    expect(recuperacionPorHora(0, true)).toBe(12);
  });

  it('la ventaja Recuperación de Ki acelera por niveles', () => {
    expect(recuperacionPorHora(1)).toBe(60);
    expect(recuperacionPorHora(2)).toBe(120);
    expect(recuperacionPorHora(3)).toBe(600);
  });

  it('con 10 o menos de Ki se empieza a perder Cansancio', () => {
    expect(desgasteporKiBajo(11)).toBeNull();
    expect(desgasteporKiBajo(10)).toContain('cinco minutos');
    expect(desgasteporKiBajo(0)).toContain('cinco asaltos');
  });
});
