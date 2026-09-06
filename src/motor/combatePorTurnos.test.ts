import { describe, expect, it } from 'vitest';
import {
  actuando,
  combateVacio,
  migrarCombate,
  conParticipante,
  conTirada,
  empezar,
  enJuego,
  orden,
  siguiente,
  terminar,
  ultimaIniciativaPorPersonaje,
  type Participante,
  type TiradaDeIniciativa,
} from './combatePorTurnos';

const p = (
  id: string,
  turnoBase: number,
  iniciativa?: number,
  activo = true,
): Participante => ({
  id,
  tipo: 'personaje',
  refId: id,
  nombre: id,
  turnoBase,
  iniciativa,
  activo,
});

describe('orden de iniciativa', () => {
  it('ordena de más a menos', () => {
    const lista = [p('a', 20, 90), p('b', 20, 150), p('c', 20, 120)];
    expect(orden(lista).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('rompe el empate por turno de partida, como el manual', () => {
    // Mismo total, pero quien tiene mejores reflejos actúa antes.
    const lista = [p('lento', 40, 100), p('rapido', 90, 100)];
    expect(orden(lista).map((x) => x.id)).toEqual(['rapido', 'lento']);
  });

  it('con todo empatado ordena por nombre, para que la lista no baile', () => {
    const lista = [p('zoe', 20, 100), p('ana', 20, 100)];
    expect(orden(lista).map((x) => x.id)).toEqual(['ana', 'zoe']);
    // Y el mismo orden en un segundo repintado.
    expect(orden(orden(lista)).map((x) => x.id)).toEqual(['ana', 'zoe']);
  });

  it('quien no ha tirado va al final: no tiene cero, no tiene número', () => {
    const lista = [p('sinTirar', 90), p('conPoco', 20, 30)];
    expect(orden(lista).map((x) => x.id)).toEqual(['conPoco', 'sinTirar']);
  });

  it('no toca la lista que recibe', () => {
    const lista = [p('a', 20, 10), p('b', 20, 50)];
    orden(lista);
    expect(lista.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('combates guardados con el modelo viejo', () => {
  /** Como lo escribía el código viejo: con `turno` y **sin** `turnoDe`. */
  const guardadoViejo = (participantes: Participante[], turno: number) =>
    ({
      id: 'c', campanaId: null, actualizadoEn: '2026-01-01T00:00:00.000Z',
      nombre: 'Viejo', estado: 'enCurso', asalto: 1, participantes, turno,
    }) as never;

  it('la posición guardada se traduce a quién le tocaba', () => {
    const c = migrarCombate(guardadoViejo([p('a', 20, 150), p('b', 20, 120), p('c', 20, 90)], 1));
    expect(c.turnoDe).toBe('b');
    expect(actuando(c)?.id).toBe('b');
  });

  it('salta a los caídos al traducir, porque la posición era sobre los que seguían en pie', () => {
    const c = migrarCombate(
      guardadoViejo([p('a', 20, 150, false), p('b', 20, 120), p('c', 20, 90)], 1),
    );
    expect(c.turnoDe).toBe('c');
  });

  it('un combate del modelo nuevo pasa sin tocarse', () => {
    const nuevo = { ...combateVacio('c', null), turnoDe: 'x' };
    expect(migrarCombate(nuevo)).toBe(nuevo);
  });
});

describe('llevar el combate', () => {
  const conTres = () => {
    const c = combateVacio('c1', 'camp', 'Emboscada');
    return {
      ...c,
      participantes: [p('a', 20, 150), p('b', 20, 120), p('c', 20, 90)],
    };
  };

  it('no hay nadie actuando hasta que empieza', () => {
    const c = conTres();
    expect(c.estado).toBe('preparando');
    expect(actuando(c)).toBeUndefined();
    expect(empezar(c).asalto).toBe(1);
    expect(actuando(empezar(c))?.id).toBe('a');
    expect(empezar(c).turnoDe).toBe('a');
  });

  it('el turno avanza por el orden y al cerrar la vuelta sube el asalto', () => {
    let c = empezar(conTres());
    expect([actuando(c)?.id, c.asalto]).toEqual(['a', 1]);
    c = siguiente(c);
    expect([actuando(c)?.id, c.asalto]).toEqual(['b', 1]);
    c = siguiente(c);
    expect([actuando(c)?.id, c.asalto]).toEqual(['c', 1]);
    c = siguiente(c);
    // Vuelta cerrada: otra vez el primero, asalto 2.
    expect([actuando(c)?.id, c.asalto]).toEqual(['a', 2]);
  });

  it('la iniciativa no se vuelve a tirar entre asaltos', () => {
    let c = empezar(conTres());
    const antes = c.participantes.map((x) => x.iniciativa);
    for (let i = 0; i < 7; i++) c = siguiente(c);
    expect(c.participantes.map((x) => x.iniciativa)).toEqual(antes);
    expect(c.asalto).toBe(3);
  });

  it('quien cae sale del orden pero no de la lista', () => {
    let c = empezar(conTres());
    c = conParticipante(c, 'b', { activo: false });
    expect(c.participantes).toHaveLength(3); // sigue ahí: el registro importa
    expect(enJuego(c).map((x) => x.id)).toEqual(['a', 'c']);
    c = siguiente(c);
    expect(actuando(c)?.id).toBe('c');
    c = siguiente(c);
    expect([actuando(c)?.id, c.asalto]).toEqual(['a', 2]);
  });

  /*
   * El fallo que se lleva por delante una partida: se guardaba la posición dentro del
   * orden, así que si caía alguien que iba **antes** del que estaba actuando, la lista se
   * acortaba por delante, la posición pasaba a señalar al siguiente y a uno le robaban su
   * turno sin que nadie se diera cuenta.
   */
  it('si cae alguien de más arriba, al que actúa no le roban el turno', () => {
    let c = empezar(conTres()); // orden a(150), b(120), c(90)
    c = siguiente(c);
    expect(actuando(c)?.id).toBe('b');
    // Cae «a», que iba por delante de «b».
    c = conParticipante(c, 'a', { activo: false });
    expect(actuando(c)?.id).toBe('b'); // sigue siendo su turno
    c = siguiente(c);
    expect(actuando(c)?.id).toBe('c');
  });

  it('si cae el que estaba actuando, sigue la pelea en vez de quedarse en blanco', () => {
    let c = empezar(conTres());
    expect(actuando(c)?.id).toBe('a');
    c = conParticipante(c, 'a', { activo: false });
    // Alguien puede morir en su propio turno: le toca al primero que quede en pie.
    expect(actuando(c)?.id).toBe('b');
    c = siguiente(c);
    expect(actuando(c)?.id).toBe('c');
  });

  it('quien entra a mitad de pelea no descoloca a quien está actuando', () => {
    let c = empezar(conTres());
    c = siguiente(c);
    expect(actuando(c)?.id).toBe('b');
    // Refuerzos: entra alguien con más iniciativa que todos.
    c = { ...c, participantes: [...c.participantes, p('refuerzo', 20, 999)] };
    expect(actuando(c)?.id).toBe('b');
    c = siguiente(c);
    expect(actuando(c)?.id).toBe('c');
    // Y el recién llegado actúa en la vuelta siguiente, en su sitio del orden.
    c = siguiente(c);
    expect([actuando(c)?.id, c.asalto]).toEqual(['refuerzo', 2]);
  });

  it('sin nadie en pie el turno no avanza en vez de romperse', () => {
    let c = empezar(conTres());
    for (const id of ['a', 'b', 'c']) c = conParticipante(c, id, { activo: false });
    expect(enJuego(c)).toEqual([]);
    expect(actuando(c)).toBeUndefined();
    expect(siguiente(c)).toEqual(c);
  });

  it('la tirada se suma al turno de partida', () => {
    const c = conTirada(
      { ...combateVacio('c', null), participantes: [p('a', 70)] },
      'a',
      45,
    );
    expect(c.participantes[0].tirada).toBe(45);
    expect(c.participantes[0].iniciativa).toBe(115);
  });

  it('la mesa manda sobre el dado: la iniciativa se puede escribir a mano', () => {
    let c = conTirada({ ...combateVacio('c', null), participantes: [p('a', 70)] }, 'a', 45);
    c = conParticipante(c, 'a', { iniciativa: 200 });
    expect(c.participantes[0].iniciativa).toBe(200);
  });

  it('terminado deja de haber turno pero se conserva todo', () => {
    const c = terminar(empezar(conTres()));
    expect(c.estado).toBe('terminado');
    expect(c.terminadoEn).toBeTruthy();
    expect(c.participantes).toHaveLength(3);
    expect(actuando(c)).toBeUndefined();
  });

  it('avanzar un combate que no está en curso no hace nada', () => {
    const c = conTres();
    expect(siguiente(c)).toEqual(c);
    // `terminar` sella la hora, así que se termina una sola vez: llamarlo dos veces daría
    // marcas distintas y la prueba fallaría según en qué milisegundo cayera.
    const acabado = terminar(c);
    expect(siguiente(acabado)).toEqual(acabado);
  });
});

/**
 * Un jugador tira su iniciativa desde su pantalla y la apunta en el registro, que es donde
 * puede escribir. El máster la recoge de ahí.
 */
describe('recoger las iniciativas que tiran los jugadores', () => {
  const t = (
    personajeId: string | null,
    iniciativa: number | undefined,
    actualizadoEn: string,
    combateId = 'cb1',
  ): TiradaDeIniciativa => ({ personajeId, iniciativa, actualizadoEn, combateId });

  it('coge la de cada jugador', () => {
    const m = ultimaIniciativaPorPersonaje(
      [t('ana', 120, '2026-01-01T10:00:00Z'), t('bruno', 95, '2026-01-01T10:00:01Z')],
      'cb1',
    );
    expect([...m]).toEqual([
      ['bruno', 95],
      ['ana', 120],
    ]);
  });

  it('si alguien repite manda la última', () => {
    const m = ultimaIniciativaPorPersonaje(
      [t('ana', 120, '2026-01-01T10:00:00Z'), t('ana', 60, '2026-01-01T10:05:00Z')],
      'cb1',
    );
    expect(m.get('ana')).toBe(60);
  });

  it('no se cuela la de otro combate', () => {
    // En el registro conviven la pelea de hoy y la de la semana pasada.
    const m = ultimaIniciativaPorPersonaje([t('ana', 120, '2026-01-01T10:00:00Z', 'otro')], 'cb1');
    expect(m.size).toBe(0);
  });

  it('las tiradas normales no cuentan como iniciativa', () => {
    // Una tirada de Trepar no lleva número de iniciativa, y no debe colarse como uno.
    const m = ultimaIniciativaPorPersonaje(
      [t('ana', undefined, '2026-01-01T10:00:00Z'), t(null, 50, '2026-01-01T10:00:00Z')],
      'cb1',
    );
    expect(m.size).toBe(0);
  });

  it('no toca la lista que recibe', () => {
    const lista = [t('ana', 1, '2026-01-01T10:00:00Z'), t('bruno', 2, '2026-01-01T09:00:00Z')];
    ultimaIniciativaPorPersonaje(lista, 'cb1');
    expect(lista.map((x) => x.personajeId)).toEqual(['ana', 'bruno']);
  });
});
