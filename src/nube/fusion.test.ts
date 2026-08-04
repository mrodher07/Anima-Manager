import { describe, it, expect } from 'vitest';
import { decidir, planificar, lapidasPendientes, resumirPlan, type FilaRemota } from './fusion';

/**
 * Las fechas se escriben a mano y ordenadas a propósito: lo que se está probando es
 * exactamente la comparación entre ellas, así que conviene poder leer de un vistazo cuál
 * es posterior sin hacer cuentas.
 */
const AYER = '2026-08-03T10:00:00.000Z';
const HOY = '2026-08-04T10:00:00.000Z';
const LUEGO = '2026-08-04T18:00:00.000Z';

function local(id: string, actualizadoEn: string, nombre = id) {
  return { id, actualizadoEn, nombre };
}

function remoto(id: string, actualizado_en: string, borrado = false): FilaRemota {
  return { id, datos: { id, actualizadoEn: actualizado_en }, actualizado_en, borrado };
}

describe('decidir', () => {
  it('sube lo que aquí existe y allí no', () => {
    expect(decidir(local('a', HOY), undefined)).toBe('sube');
  });

  it('baja lo que allí existe y aquí no', () => {
    expect(decidir(undefined, remoto('a', HOY))).toBe('baja');
  });

  it('no hace nada si no hay ni una cosa ni la otra', () => {
    expect(decidir(undefined, undefined)).toBe('iguales');
  });

  it('gana el que se tocó más tarde', () => {
    expect(decidir(local('a', LUEGO), remoto('a', HOY))).toBe('sube');
    expect(decidir(local('a', AYER), remoto('a', HOY))).toBe('baja');
  });

  it('deja en paz lo que tiene la misma fecha en los dos sitios', () => {
    expect(decidir(local('a', HOY), remoto('a', HOY))).toBe('iguales');
  });

  it('borra aquí lo que se borró en otro dispositivo', () => {
    expect(decidir(local('a', AYER), remoto('a', HOY, true))).toBe('borra-local');
  });

  it('no borra aquí lo que se ha vuelto a editar después del borrado', () => {
    // Alguien borró la ficha en el móvil y luego la recuperó y la editó en el portátil:
    // esa edición posterior es una decisión, no un despiste, y tiene que ganar.
    expect(decidir(local('a', LUEGO), remoto('a', HOY, true))).toBe('sube');
  });

  it('ignora una lápida de algo que aquí ya no está', () => {
    expect(decidir(undefined, remoto('a', HOY, true))).toBe('iguales');
  });

  it('respeta el borrado cuando las dos fechas coinciden', () => {
    // Empate con lápida: gana el borrado. Lo contrario resucitaría fichas por accidente
    // cada vez que dos relojes escribieran el mismo milisegundo.
    expect(decidir(local('a', HOY), remoto('a', HOY, true))).toBe('borra-local');
  });
});

describe('planificar', () => {
  it('reparte cada registro en su montón', () => {
    const plan = planificar(
      [local('nuevo', HOY), local('mio-mas-nuevo', LUEGO), local('viejo', AYER), local('igual', HOY)],
      [
        remoto('mio-mas-nuevo', HOY),
        remoto('viejo', HOY),
        remoto('igual', HOY),
        remoto('solo-alli', HOY),
      ],
    );

    expect(plan.subir.map((p) => p.id)).toEqual(['nuevo', 'mio-mas-nuevo']);
    expect(plan.bajar.map((r) => r.id)).toEqual(['viejo', 'solo-alli']);
    expect(plan.borrarLocal).toEqual([]);
    expect(plan.sinCambios).toBe(1);
  });

  it('no devuelve nada que hacer cuando los dos lados están al día', () => {
    const plan = planificar([local('a', HOY), local('b', AYER)], [remoto('a', HOY), remoto('b', AYER)]);
    expect(plan.subir).toEqual([]);
    expect(plan.bajar).toEqual([]);
    expect(plan.borrarLocal).toEqual([]);
    expect(plan.sinCambios).toBe(2);
  });

  it('propaga aquí un borrado hecho en otro sitio', () => {
    const plan = planificar([local('a', AYER)], [remoto('a', HOY, true)]);
    expect(plan.borrarLocal).toEqual(['a']);
    expect(plan.bajar).toEqual([]);
  });

  it('no se baja una ficha que allí está marcada como borrada', () => {
    const plan = planificar([], [remoto('a', HOY, true)]);
    expect(plan.bajar).toEqual([]);
    expect(plan.subir).toEqual([]);
  });

  it('no resucita lo que borramos aquí y la nube todavía no sabe', () => {
    // El caso que justifica que exista la lista de borrados locales: la ficha ya no está
    // en `locales` porque se borró, así que sin la lápida volvería con la primera bajada.
    const plan = planificar([], [remoto('a', AYER)], [{ id: 'a', actualizadoEn: HOY }]);
    expect(plan.bajar).toEqual([]);
  });

  it('devuelve lo que otro dispositivo editó después de que lo borráramos', () => {
    const plan = planificar([], [remoto('a', LUEGO)], [{ id: 'a', actualizadoEn: HOY }]);
    expect(plan.bajar.map((r) => r.id)).toEqual(['a']);
  });

  it('aguanta las dos listas vacías', () => {
    const plan = planificar([], []);
    expect(plan).toEqual({ subir: [], bajar: [], borrarLocal: [], sinCambios: 0 });
  });
});

describe('lapidasPendientes', () => {
  it('manda el borrado de lo que la nube ni conoce', () => {
    expect(lapidasPendientes([{ id: 'a', actualizadoEn: HOY }], [])).toHaveLength(1);
  });

  it('manda el borrado de lo que allí sigue vivo y es anterior', () => {
    const pendientes = lapidasPendientes([{ id: 'a', actualizadoEn: HOY }], [remoto('a', AYER)]);
    expect(pendientes.map((p) => p.id)).toEqual(['a']);
  });

  it('no manda un borrado más antiguo que la última edición de la nube', () => {
    expect(lapidasPendientes([{ id: 'a', actualizadoEn: AYER }], [remoto('a', HOY)])).toEqual([]);
  });

  it('no repite una lápida que allí ya está puesta', () => {
    expect(lapidasPendientes([{ id: 'a', actualizadoEn: HOY }], [remoto('a', AYER, true)])).toEqual([]);
  });
});

describe('resumirPlan', () => {
  it('lo dice claro cuando no hay nada que hacer', () => {
    expect(resumirPlan({ subir: [], bajar: [], borrarLocal: [], sinCambios: 7 })).toBe(
      'ya estaba todo al día',
    );
  });

  it('sólo menciona los montones que tienen algo', () => {
    const resumen = resumirPlan({
      subir: [local('a', HOY)],
      bajar: [remoto('b', HOY), remoto('c', HOY)],
      borrarLocal: [],
      sinCambios: 3,
    });
    expect(resumen).toBe('1 subidos, 2 bajados');
  });

  it('cuenta también lo que se borra aquí', () => {
    const resumen = resumirPlan({ subir: [], bajar: [], borrarLocal: ['a'], sinCambios: 0 });
    expect(resumen).toBe('1 borrados aquí');
  });
});
