import { describe, it, expect } from 'vitest';
import { tirarD100, umbralApertura, type Aleatorio } from './dados';
import { combinarArmadura, resolverAsalto, TIPOS_DANO, type TipoDano } from './combate';
import armadurasJson from '../../data/reglas/armaduras.json';
import type { Armadura } from '../datos/tipos';

const armaduras = armadurasJson as Armadura[];

/** Azar determinista: devuelve las tiradas indicadas, en orden. */
function azarFijo(...tiradas: number[]): Aleatorio {
  let i = 0;
  return () => {
    const v = tiradas[Math.min(i++, tiradas.length - 1)];
    return (v - 0.5) / 100; // d(100) hace floor(azar*100)+1; el 0.5 evita errores de coma flotante
  };
}

describe('tiradas de dados', () => {
  it('el umbral de apertura baja conforme sube la habilidad', () => {
    expect(umbralApertura(50)).toBe(90);
    expect(umbralApertura(100)).toBe(80);
    expect(umbralApertura(200)).toBe(70);
    expect(umbralApertura(300)).toBe(60);
  });

  it('una tirada normal no se abre', () => {
    const t = tirarD100(50, azarFijo(45));
    expect(t.total).toBe(45);
    expect(t.abierta).toBe(false);
    expect(t.pifia).toBe(false);
  });

  it('una tirada alta se abre y suma', () => {
    const t = tirarD100(50, azarFijo(95, 92, 30));
    expect(t.dados).toEqual([95, 92, 30]);
    expect(t.total).toBe(217);
    expect(t.abierta).toBe(true);
  });

  it('con habilidad alta se abre antes', () => {
    const t = tirarD100(250, azarFijo(75, 20)); // umbral 70
    expect(t.abierta).toBe(true);
    expect(t.total).toBe(95);
  });

  it('un 1-3 con control bajo es pifia y resta', () => {
    const t = tirarD100(50, azarFijo(2, 10));
    expect(t.pifia).toBe(true);
    expect(t.nivelPifia).toBeGreaterThan(0);
    expect(t.total).toBeLessThan(2);
  });

  it('un 1-3 con control alto no llega a ser pifia', () => {
    const t = tirarD100(50, azarFijo(2, 80));
    expect(t.pifia).toBe(false);
    expect(t.total).toBe(2);
  });
});

describe('combinación de armaduras', () => {
  const sinTA = Object.fromEntries(TIPOS_DANO.map((t) => [t, 0])) as Record<TipoDano, number>;

  it('sin armadura no hay penalizadores', () => {
    expect(combinarArmadura([], armaduras, 50)).toEqual({
      TA: sinTA, requisito: 0, penalizadorNatural: 0, penalizadorAccionFisica: 0,
      restriccionMovimiento: 0, presencia: 0,
    });
  });

  it('toma el TA más alto de cada tipo en vez de sumarlos', () => {
    const combinada = combinarArmadura(
      [{ armadura: 'Piezas' }, { armadura: 'Cota de cuero' }],
      armaduras,
      100,
    );
    // Piezas da FIL 4; la cota de cuero da 1. Se queda el 4, no 5.
    expect(combinada.TA.FIL).toBe(4);
  });

  it('suma los requerimientos de las piezas combinadas', () => {
    const una = combinarArmadura([{ armadura: 'Piezas' }], armaduras, 0);
    const dos = combinarArmadura([{ armadura: 'Piezas' }, { armadura: 'Acolchada' }], armaduras, 0);
    expect(dos.requisito).toBe(una.requisito);
  });

  it('penaliza toda acción física si no se llega al requerimiento', () => {
    const p = combinarArmadura([{ armadura: 'Piezas' }], armaduras, 30); // requisito 50
    expect(p.penalizadorAccionFisica).toBe(-20);
  });

  it('el exceso de Llevar Armadura compensa el penalizador natural', () => {
    const justo = combinarArmadura([{ armadura: 'Piezas' }], armaduras, 50);
    expect(justo.penalizadorNatural).toBe(-20);

    const holgado = combinarArmadura([{ armadura: 'Piezas' }], armaduras, 70);
    expect(holgado.penalizadorNatural).toBe(0);
  });

  it('cada 50 puntos de exceso baja un punto la restricción de movimiento', () => {
    expect(combinarArmadura([{ armadura: 'Piezas' }], armaduras, 50).restriccionMovimiento).toBe(2);
    expect(combinarArmadura([{ armadura: 'Piezas' }], armaduras, 100).restriccionMovimiento).toBe(1);
  });
});

describe('resolución de un asalto', () => {
  const TA = { FIL: 4, CON: 3, PEN: 2, CAL: 3, ELE: 2, FRI: 2, ENE: 0 } as Record<TipoDano, number>;
  const atacante = { nombre: 'Meirmeister', habilidadAtaque: 95, dano: 190, tipoDano: 'FIL' as TipoDano };
  const defensor = {
    nombre: 'Guardia', habilidadDefensa: 60, tipoDefensa: 'Parada' as const, TA, pvActuales: 100,
  };

  it('si la defensa gana, el defensor contraataca', () => {
    const r = resolverAsalto(atacante, defensor, undefined, azarFijo(10, 80));
    expect(r.impacta).toBe(false);
    expect(r.contraataque).toBe(true);
    expect(r.descripcion).toContain('contraataque');
  });

  it('un impacto que no supera la absorción no hace daño', () => {
    // Ataque 95+20=115, defensa 60+40=100 → resultado 15. Absorción FIL 4 = 60.
    const r = resolverAsalto(atacante, defensor, undefined, azarFijo(20, 40));
    expect(r.impacta).toBe(true);
    expect(r.absorcion).toBe(60);
    expect(r.margen).toBeLessThan(10);
    expect(r.danoInfligido).toBe(0);
    expect(r.descripcion).toContain('armadura');
  });

  it('calcula el daño porcentual sobre el daño del arma', () => {
    // Ataque 95+85=180, defensa 60+10=70 → resultado 110. Margen 110−60=50 → 50 %.
    const r = resolverAsalto(atacante, defensor, undefined, azarFijo(85, 10));
    expect(r.resultado).toBe(110);
    expect(r.margen).toBe(50);
    expect(r.porcentajeDano).toBe(50);
    expect(r.danoInfligido).toBe(95); // 50 % de 190
  });

  it('marca crítico si el golpe quita la mitad de los PV actuales', () => {
    const r = resolverAsalto(atacante, defensor, undefined, azarFijo(85, 10));
    expect(r.danoInfligido).toBe(95); // el defensor tiene 100 PV
    expect(r.critico).toBe(true);
    expect(r.descripcion).toContain('CRÍTICO');
  });

  it('la absorción depende del tipo de daño empleado', () => {
    // Mismas tiradas: ataque 95+50=145, defensa 60+40=100 → resultado 45.
    const conFilo = resolverAsalto(atacante, defensor, undefined, azarFijo(50, 40));
    expect(conFilo.absorcion).toBe(60); // TA FIL 4 → 20 + 40
    expect(conFilo.danoInfligido).toBe(0); // la armadura lo para

    const conEnergia = { ...atacante, tipoDano: 'ENE' as TipoDano };
    const r = resolverAsalto(conEnergia, defensor, undefined, azarFijo(50, 40));
    expect(r.absorcion).toBe(20); // TA ENE 0 → la armadura no cubre la energía
    expect(r.danoInfligido).toBeGreaterThan(0);
  });
});
