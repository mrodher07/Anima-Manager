import { describe, it, expect } from 'vitest';
import {
  ASALTO_NORMAL,
  aguanteDeMasa,
  bonoPorCantidad,
  componentesRestantes,
  construirMasa,
  duracionAsalto,
  duracionLegible,
  efectoSobreMasa,
  multiplicadorDano,
  topeRecomendado,
} from './combateAlternativo';

describe('Combate Dramático', () => {
  it('el primer asalto dura lo normal y a partir de ahí se dobla', () => {
    // «el segundo sean ya seis segundos, doce en el tercero y veinticuatro en el cuarto.
    // Finalmente, a partir del quinto la duración de todos los turnos es ya de un minuto».
    expect([1, 2, 3, 4, 5, 6, 20].map((n) => duracionAsalto(n))).toEqual([3, 6, 12, 24, 60, 60, 60]);
  });

  it('con el sistema normal todos los asaltos duran tres segundos', () => {
    expect([1, 2, 5, 99].map((n) => duracionAsalto(n, 'normal'))).toEqual([3, 3, 3, 3]);
    expect(ASALTO_NORMAL).toBe(3);
  });

  it('se lee en segundos o en minutos, según toque', () => {
    expect(duracionLegible(3)).toBe('3 s');
    expect(duracionLegible(24)).toBe('24 s');
    expect(duracionLegible(60)).toBe('1 min');
    // Lo acumulado de un combate largo no es un número redondo de minutos.
    expect(duracionLegible(105)).toBe('1 min 45 s');
    expect(duracionLegible(120)).toBe('2 min');
  });

  it('el tope recomendado depende de la habilidad media', () => {
    expect(topeRecomendado(140)?.segundos).toBe(12);
    expect(topeRecomendado(150)?.segundos).toBe(12);
    expect(topeRecomendado(180)?.segundos).toBe(60);
    expect(topeRecomendado(200)?.segundos).toBe(60);
    // Por encima de 200 el manual ya no pone reparos.
    expect(topeRecomendado(250)).toBeNull();
  });
});

describe('Combate de Masas: los ejemplos del manual', () => {
  it('diez soldados de 140 PV aguantan 1.000', () => {
    // «Una decena de soldados profesionales poseedores individualmente de 140 PV tendrían
    // en su conjunto un aguante al daño de 1.000 puntos».
    expect(aguanteDeMasa({ cantidad: 10, puntosVida: 140 } as never).total).toBe(1000);
  });

  it('veinticinco pretorianos de 210 PV aguantan 5.000', () => {
    expect(aguanteDeMasa({ cantidad: 25, puntosVida: 210 } as never).total).toBe(5000);
  });

  it('mil doscientos soldados de 120 PV aguantan 21.000', () => {
    // «10.000 por los cien primeros componentes más 11.000 por los restantes».
    expect(aguanteDeMasa({ cantidad: 1200, puntosVida: 120 } as never).total).toBe(21000);
  });

  it('diez cadáveres animados de 345 PV con acumulación aguantan 1.650', () => {
    // «300 del primero más los 1350 puntos de los otros nueve».
    expect(
      aguanteDeMasa({ cantidad: 10, puntosVida: 345, acumulacion: true } as never).total,
    ).toBe(1650);
  });

  it('quince drones de 100 PV aguantan 1.500, y a 900 han caído seis', () => {
    const masa = construirMasa({
      cantidad: 15, puntosVida: 100, ataque: 100, defensa: 100, dano: 50, TA: 2, iniciativa: 50,
    });
    expect(masa.puntosVida).toBe(1500);
    expect(masa.porComponente).toBe(100);
    expect(componentesRestantes(masa, 900)).toBe(9);
    expect(masa.cantidad - componentesRestantes(masa, 900)).toBe(6);
  });

  it('veinte guardias contra cuatro personajes atacan con +50, no con +90', () => {
    const solos = construirMasa({
      cantidad: 20, puntosVida: 100, ataque: 100, defensa: 100, dano: 40, TA: 2, iniciativa: 50,
    });
    expect(solos.bonoAtaque).toBe(90);

    const repartidos = construirMasa(
      { cantidad: 20, puntosVida: 100, ataque: 100, defensa: 100, dano: 40, TA: 2, iniciativa: 50 },
      4,
    );
    expect(repartidos.bonoAtaque).toBe(50);
    expect(repartidos.ataque).toBe(150);
    expect(repartidos.avisos.join(' ')).toMatch(/5 enemigos por cada uno/);
  });

  it('quinientos soldados contra cuatro siguen dando +150', () => {
    const m = construirMasa(
      { cantidad: 500, puntosVida: 100, ataque: 100, defensa: 100, dano: 40, TA: 2, iniciativa: 50 },
      4,
    );
    expect(m.bonoAtaque).toBe(150);
  });

  it('el daño físico sube un 50 % y el sobrenatural se dobla', () => {
    // «Un grupo formado por enemigos cuyo Daño Base sea 50 tendrían un Daño Base de 75».
    const fisico = construirMasa({
      cantidad: 10, puntosVida: 100, ataque: 100, defensa: 100, dano: 50, TA: 0, iniciativa: 50,
    });
    expect(fisico.dano).toBe(75);
    // «De ser una cábala de hechiceros con Descargas de Luz (daño 60), hasta 120».
    const magico = construirMasa({
      cantidad: 10, puntosVida: 100, ataque: 100, defensa: 100, dano: 60, TA: 0,
      iniciativa: 50, sobrenatural: true,
    });
    expect(magico.dano).toBe(120);
  });

  it('un arma de daño 60 que alcanza a cinco multiplica por 4', () => {
    // «multiplicará por 4 su Daño Base, incrementándolo hasta 240».
    expect(multiplicadorDano(5, 100)).toBe(4);
    expect(60 * multiplicadorDano(5, 100)).toBe(240);
  });

  it('una bola de fuego de daño 50 sobre quince enemigos multiplica por 5', () => {
    expect(multiplicadorDano(15, 100)).toBe(5);
    expect(50 * multiplicadorDano(15, 100)).toBe(250);
  });

  it('el multiplicador nunca pasa de lo que permite el tamaño de la masa', () => {
    // «incluso un conjuro con medio kilómetro de radio contra 8 adversarios no podría
    // jamás obtener un multiplicador superior a 4».
    expect(multiplicadorDano(5000, 8)).toBe(4);
    expect(multiplicadorDano(5000, 5000)).toBe(25);
  });
});

describe('Combate de Masas: las tablas', () => {
  it('el bono por cantidad es el de la Tabla 1', () => {
    expect([2, 3, 5, 10, 15, 25, 50, 100, 999].map(bonoPorCantidad)).toEqual([
      0, 30, 50, 70, 90, 110, 130, 150, 150,
    ]);
  });

  it('la masa no tira defensa y avisa de ello', () => {
    const m = construirMasa({
      cantidad: 5, puntosVida: 100, ataque: 100, defensa: 120, dano: 40, TA: 0, iniciativa: 50,
    });
    expect(m.defensa).toBe(120);
    expect(m.avisos.join(' ')).toMatch(/no tira defensa/);
    expect(m.avisos.join(' ')).toMatch(/Sin armadura no hay TA/);
  });

  it('una masa vacía no rompe nada', () => {
    const m = construirMasa({
      cantidad: 0, puntosVida: 100, ataque: 100, defensa: 100, dano: 40, TA: 0, iniciativa: 50,
    });
    expect(m.puntosVida).toBe(0);
    expect(componentesRestantes(m, 500)).toBe(0);
  });
});

describe('efectos de área sobre una masa', () => {
  it('los cuatro tramos de la Resistencia', () => {
    expect(efectoSobreMasa(50).resultado).toMatch(/Supera.*más de 40/);
    expect(efectoSobreMasa(30).resultado).toMatch(/Supera.*menos de 40/);
    expect(efectoSobreMasa(0).resultado).toMatch(/Supera.*menos de 40/);
    expect(efectoSobreMasa(-10).resultado).toMatch(/Falla.*menos de 40/);
    expect(efectoSobreMasa(-50).resultado).toMatch(/Falla.*más de 40/);
  });

  it('superar por poco reduce los negativos a la mitad hacia abajo', () => {
    // El ejemplo del manual: superan la RF por 30 y muere una tercera parte.
    expect(efectoSobreMasa(30).otrosEfectos).toMatch(/tercera parte/);
    expect(efectoSobreMasa(30).negativos).toMatch(/hacia abajo/);
  });

  it('fallar por poco reduce los negativos a la mitad hacia arriba', () => {
    // El ejemplo del manual: fallan la RM por 10 y sufren -20 de un conjuro de -40.
    expect(efectoSobreMasa(-10).negativos).toMatch(/hacia arriba/);
    expect(efectoSobreMasa(-10).otrosEfectos).toMatch(/dos terceras partes/);
  });

  it('fallar por mucho aplica los negativos enteros', () => {
    expect(efectoSobreMasa(-100).negativos).toBe('Enteros.');
  });
});
