import { describe, expect, it } from 'vitest';
import {
  alternar,
  camino,
  casillasDe,
  cambiarElemento,
  clave,
  describeDistancia,
  distancia,
  COLUMNAS_MAXIMAS,
  COLUMNAS_MINIMAS,
  COLUMNAS_POR_DEFECTO,
  casillaDesde,
  colocacionInicial,
  columnasValidas,
  alDiaConPlantillas,
  dentroDelMapa,
  elementoEn,
  fichaParaElMapa,
  filasDe,
  moverElemento,
  nuevaCosa,
  quitarElemento,
  type ElementoMapa,
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

describe('contar casillas', () => {
  it('las diagonales cuentan como una, que es como cuenta cualquiera', () => {
    expect(distancia({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
    expect(distancia({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
    expect(distancia({ x: 2, y: 5 }, { x: 2, y: 5 })).toBe(0);
  });

  it('da igual el orden', () => {
    expect(distancia({ x: 7, y: 1 }, { x: 2, y: 4 })).toBe(distancia({ x: 2, y: 4 }, { x: 7, y: 1 }));
  });

  it('se lee en casillas, y en metros sólo si la mesa ha dicho cuánto mide una', () => {
    // Sin valor no se inventa: Ánima no usa cuadrícula y no hay metro oficial.
    expect(describeDistancia(3)).toBe('3 casillas');
    expect(describeDistancia(1)).toBe('1 casilla');
    expect(describeDistancia(3, 1.5)).toBe('3 casillas · 4,5 m');
    expect(describeDistancia(3, 2)).toBe('3 casillas · 6 m');
    expect(describeDistancia(3, 0)).toBe('3 casillas');
  });
});

describe('el camino de una ficha', () => {
  it('va en diagonal mientras puede y luego recto', () => {
    expect(camino({ x: 0, y: 0 }, { x: 3, y: 1 })).toEqual([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    ]);
  });

  it('sin moverse no hay camino', () => {
    expect(camino({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([]);
  });

  it('tiene tantos pasos como casillas de distancia', () => {
    const a = { x: 1, y: 6 };
    const b = { x: 8, y: 2 };
    expect(camino(a, b)).toHaveLength(distancia(a, b));
  });
});

describe('pintar casillas', () => {
  it('alternar añade y quita', () => {
    expect(alternar(undefined, 2, 3)).toEqual(['2,3']);
    expect(alternar(['2,3'], 2, 3)).toEqual([]);
    expect(alternar(['1,1'], 2, 3)).toEqual(['1,1', '2,3']);
  });

  it('no toca la lista que recibe', () => {
    const antes = ['1,1'];
    alternar(antes, 2, 2);
    expect(antes).toEqual(['1,1']);
  });

  it('la clave es la misma la escriba quien la escriba', () => {
    expect(clave(2, 3)).toBe('2,3');
    expect(alternar([clave(2, 3)], 2, 3)).toEqual([]);
  });
});

describe('las cosas que hay en el suelo', () => {
  const barril = (extra: Partial<ElementoMapa> = {}): ElementoMapa => ({
    id: 'b', x: 2, y: 3, nombre: 'Barril', icono: '🛢️', ...extra,
  });

  it('uno normal ocupa una casilla', () => {
    expect(casillasDe(barril())).toEqual([{ x: 2, y: 3 }]);
  });

  it('una mesa larga ocupa las casillas que diga', () => {
    expect(casillasDe(barril({ nombre: 'Mesa', ancho: 3, alto: 2 }))).toEqual([
      { x: 2, y: 3 }, { x: 2, y: 4 },
      { x: 3, y: 3 }, { x: 3, y: 4 },
      { x: 4, y: 3 }, { x: 4, y: 4 },
    ]);
  });

  it('un tamaño de cero o de menos sigue ocupando su casilla', () => {
    expect(casillasDe(barril({ ancho: 0, alto: -2 }))).toEqual([{ x: 2, y: 3 }]);
  });

  it('se sabe qué hay en una casilla, y también en las que ocupa algo grande', () => {
    const mesa = barril({ id: 'm', x: 5, y: 5, nombre: 'Mesa', ancho: 2 });
    const cosas = [barril(), mesa];
    expect(elementoEn(cosas, 2, 3)?.id).toBe('b');
    expect(elementoEn(cosas, 6, 5)?.id).toBe('m');
    expect(elementoEn(cosas, 9, 9)).toBeUndefined();
    expect(elementoEn(undefined, 0, 0)).toBeUndefined();
  });

  it('si hay dos encima gana el último puesto, que es el que se ve', () => {
    const abajo = barril({ id: 'abajo' });
    const arriba = barril({ id: 'arriba' });
    expect(elementoEn([abajo, arriba], 2, 3)?.id).toBe('arriba');
  });

  it('quitar y mover no tocan la lista que reciben', () => {
    const cosas = [barril(), barril({ id: 'c2', x: 8, y: 1 })];
    expect(quitarElemento(cosas, 'b').map((e) => e.id)).toEqual(['c2']);
    expect(quitarElemento(cosas, 'no-existe')).toHaveLength(2);
    expect(moverElemento(cosas, 'b', { x: 7, y: 7 })[0]).toMatchObject({ x: 7, y: 7 });
    expect(cosas[0]).toMatchObject({ x: 2, y: 3 });
  });

  it('al encoger el mapa las cosas se meten dentro, con su tamaño', () => {
    const cosas = [barril({ x: 18, y: 9 }), barril({ id: 'm', x: 8, y: 2, ancho: 3, alto: 2 })];
    const metidas = dentroDelMapa(cosas, 10, 6);
    expect(metidas[0]).toMatchObject({ x: 9, y: 5 });
    // A la mesa de 3×2 se la deja entera dentro, no sólo su esquina.
    expect(metidas[1]).toMatchObject({ x: 7, y: 2 });
    expect(casillasDe(metidas[1]).every((c) => c.x < 10 && c.y < 6)).toBe(true);
  });

  it('si no hay nada que recolocar devuelve la misma lista, para no repintar por gusto', () => {
    const cosas = [barril()];
    expect(dentroDelMapa(cosas, 20, 12)).toBe(cosas);
    expect(dentroDelMapa(undefined, 20, 12)).toEqual([]);
  });
});

describe('poner cosas propias en el mapa', () => {
  const barril = { nombre: 'Barril de aceite', imagenId: 'img-1', plantilla: 'Barril de aceite' };

  it('queda donde se pulsa, con su imagen y sabiendo de qué cosa sale', () => {
    expect(nuevaCosa('a', barril, { x: 3, y: 2 }, { ancho: 1, alto: 1 }, 16, 9)).toEqual({
      id: 'a', x: 3, y: 2, nombre: 'Barril de aceite', imagenId: 'img-1', ancho: 1, alto: 1,
      plantilla: 'Barril de aceite',
    });
  });

  it('una grande pulsada junto al borde se mete entera', () => {
    const e = nuevaCosa('m', { nombre: 'Mesa' }, { x: 15, y: 8 }, { ancho: 3, alto: 2 }, 16, 9);
    expect(e).toMatchObject({ x: 13, y: 7, ancho: 3, alto: 2 });
    expect(casillasDe(e).every((c) => c.x < 16 && c.y < 9)).toBe(true);
  });

  it('un tamaño sin poner o de cero cuenta como una casilla, y nunca más que el mapa', () => {
    expect(nuevaCosa('z', { nombre: 'X' }, { x: 0, y: 0 }, { ancho: 0, alto: NaN }, 8, 4))
      .toMatchObject({ ancho: 1, alto: 1 });
    expect(nuevaCosa('g', { nombre: 'Muralla' }, { x: 2, y: 1 }, { ancho: 40, alto: 2 }, 8, 4))
      .toMatchObject({ x: 0, ancho: 8 });
  });

  it('sin emoji ni plantilla no se inventa esos campos', () => {
    const e = nuevaCosa('s', { nombre: 'Suelta' }, { x: 1, y: 1 }, { ancho: 1, alto: 1 }, 8, 4);
    expect('icono' in e).toBe(false);
    expect('plantilla' in e).toBe(false);
  });

  it('romper una no rompe las demás, y no toca la lista que recibe', () => {
    const antes = [
      nuevaCosa('a', barril, { x: 1, y: 1 }, { ancho: 1, alto: 1 }, 8, 4),
      nuevaCosa('b', barril, { x: 2, y: 1 }, { ancho: 1, alto: 1 }, 8, 4),
    ];
    const despues = cambiarElemento(antes, 'a', { roto: true, notas: 'Lo partió Meirmeister' });
    expect(despues[0]).toMatchObject({ roto: true, notas: 'Lo partió Meirmeister' });
    expect(despues[1].roto).toBeUndefined();
    expect(antes[0].roto).toBeUndefined();
  });
});

describe('la ficha de una cosa en el mapa', () => {
  const barril = {
    cosa: 'Barril de aceite',
    imagenId: 'img-barril',
    entereza: 10,
    presencia: 15,
    caracteristicas: [{ nombre: 'Explota', valor: '60 CAL' }, { nombre: '', valor: '' }],
    descripcion: 'Lleno de aceite de lámpara.',
  };

  it('copia lo que la mesa ha escrito y deja fuera los huecos', () => {
    expect(fichaParaElMapa(barril)).toEqual({
      entereza: 10,
      presencia: 15,
      caracteristicas: [{ nombre: 'Explota', valor: '60 CAL' }],
      descripcion: 'Lleno de aceite de lámpara.',
    });
    expect(fichaParaElMapa({ entereza: 0, descripcion: '  ' })).toEqual({});
  });

  it('si es secreta no viaja ningún dato, sólo la marca', () => {
    expect(fichaParaElMapa({ ...barril, oculta: 'Sí' })).toEqual({ secreta: true });
    expect(fichaParaElMapa({ ...barril, oculta: 'No' }).entereza).toBe(10);
  });

  it('al corregir la plantilla se corrigen las que ya están puestas', () => {
    const puesto = nuevaCosa('a', { nombre: 'Barril de aceite', plantilla: 'Barril de aceite', ficha: fichaParaElMapa(barril), imagenId: 'img-barril' },
      { x: 1, y: 1 }, { ancho: 1, alto: 1 }, 8, 4);
    const suelto = nuevaCosa('b', { nombre: 'Roca', icono: '🪨' }, { x: 3, y: 1 }, { ancho: 1, alto: 1 }, 8, 4);
    const roto = { ...puesto, id: 'c', roto: true, notas: 'Partido' };
    const antes = [puesto, suelto, roto];

    expect(alDiaConPlantillas(antes, [barril])).toBe(antes);

    const corregida = { ...barril, entereza: 12, imagenId: 'img-nueva' };
    const despues = alDiaConPlantillas(antes, [corregida]);
    expect(despues[0].ficha?.entereza).toBe(12);
    expect(despues[0].imagenId).toBe('img-nueva');
    expect(despues[1]).toBe(suelto);
    // Lo de ésta en concreto no se pisa al corregir la plantilla.
    expect(despues[2]).toMatchObject({ roto: true, notas: 'Partido', ficha: { entereza: 12 } });
  });

  it('si la plantilla ya no existe, la cosa se queda como se vio', () => {
    const puesto = nuevaCosa('a', { nombre: 'Barril', plantilla: 'Barril', ficha: { entereza: 3 } },
      { x: 0, y: 0 }, { ancho: 1, alto: 1 }, 8, 4);
    const lista = [puesto];
    expect(alDiaConPlantillas(lista, [])).toBe(lista);
  });

  it('volverla secreta borra los datos que ya viajaban', () => {
    const puesto = nuevaCosa('a', { nombre: 'Barril de aceite', plantilla: 'Barril de aceite', ficha: fichaParaElMapa(barril), imagenId: 'img-barril' },
      { x: 0, y: 0 }, { ancho: 1, alto: 1 }, 8, 4);
    const [despues] = alDiaConPlantillas([puesto], [{ ...barril, oculta: 'Sí' }]);
    expect(despues.ficha).toEqual({ secreta: true });
  });
});
