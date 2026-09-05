import { describe, expect, it } from 'vitest';
import {
  actuando,
  combateVacio,
  conParticipante,
  conTirada,
  empezar,
  enJuego,
  orden,
  siguiente,
  terminar,
  type Participante,
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
