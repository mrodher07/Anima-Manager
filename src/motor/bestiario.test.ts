import { describe, it, expect } from 'vitest';
import {
  acumulaDano,
  armaduraDe,
  criticoDe,
  desdeManual,
  notasDe,
  primerNumero,
  tipoDefensaDe,
} from './bestiario';
import bestiarioJson from '../../data/los-que-caminaron/bestiario.json';
import type { CriaturaManual } from '../datos/tipos';

const bestiario = bestiarioJson as CriaturaManual[];
const buscar = (n: string) => bestiario.find((c) => c.criatura === n)!;

describe('leer los campos del manual', () => {
  it('toma el primer número, que es el valor principal', () => {
    expect(primerNumero('175 Tentáculos (Especial), 200 Vaciar mente')).toBe(175);
    expect(primerNumero('60 Natural')).toBe(60);
    expect(primerNumero(undefined)).toBe(0);
    expect(primerNumero('Acumulación')).toBe(0);
  });

  it('entiende los miles con punto que usa el manual', () => {
    expect(primerNumero('3.000 (Especial)')).toBe(3000);
    expect(primerNumero('1.250')).toBe(1250);
  });

  it('saca el crítico de entre paréntesis', () => {
    expect(criticoDe('130 Tentáculos (Con)')).toBe('CON');
    expect(criticoDe('90 Garras (Fil)')).toBe('FIL');
    // Sin crítico reconocible se queda en CON, que es el genérico.
    expect(criticoDe('50 Golpe')).toBe('CON');
    expect(criticoDe(undefined)).toBe('CON');
  });

  it('«Natural N» es el mismo TA contra todo, incluida Energía', () => {
    expect(armaduraDe('Natural 6')).toEqual({
      FIL: 6, CON: 6, PEN: 6, CAL: 6, ELE: 6, FRI: 6, ENE: 6,
    });
  });

  it('si no es Natural, lee valor por valor y deja el resto a 0', () => {
    expect(armaduraDe('FIL 4 CON 3 ENE 2')).toEqual({
      FIL: 4, CON: 3, PEN: 0, CAL: 0, ELE: 0, FRI: 0, ENE: 2,
    });
  });

  it('reconoce a quien se defiende acumulando daño', () => {
    expect(acumulaDano('Acumulación')).toBe(true);
    expect(acumulaDano('180 Parada')).toBe(false);
  });

  it('respeta si la criatura para o esquiva', () => {
    expect(tipoDefensaDe('115 Esquiva')).toBe('Esquiva');
    expect(tipoDefensaDe('180 Parada')).toBe('Parada');
    // Cuando la defensa es un poder con nombre propio, se queda en Parada.
    expect(tipoDefensaDe('160 Defensa Fantasmal')).toBe('Parada');
    expect(tipoDefensaDe(undefined)).toBe('Parada');
  });
});

describe('la Semilla Primigenia, tal como la trae el manual', () => {
  const semilla = () => buscar('Semilla Primigenia');

  it('está en el bestiario extraído', () => {
    expect(semilla()).toBeDefined();
  });

  it('reproduce sus características y resistencias', () => {
    const c = semilla();
    expect(c.caracteristicas).toEqual({
      Fue: 15, Des: 6, Agi: 4, Con: 15, Pod: 12, Int: 4, Vol: 10, Per: 10,
    });
    expect(c.resistencias).toEqual({ RF: 95, RM: 85, RP: 80, RV: 95, RE: 95 });
  });

  it('se traduce a la ficha reducida de la mesa', () => {
    const e = desdeManual(semilla());
    expect(e.nombre).toBe('Semilla Primigenia');
    expect(e.puntosVida).toBe(3000);
    expect(e.turno).toBe(60);
    expect(e.ataque).toBe(175);
    expect(e.dano).toBe(130);
    expect(e.tipoDano).toBe('CON');
    expect(e.TA.ENE).toBe(6);
    // Se defiende acumulando daño, así que no hay defensa que tirar.
    expect(e.defensa).toBe(0);
  });

  it('no pierde nada: lo que no cabe en la ficha va a las notas', () => {
    const notas = notasDe(semilla());
    expect(notas).toContain('Fue 15');
    expect(notas).toContain('RF 95');
    // El ataque completo, con los dos valores que el número suelto no recoge.
    expect(notas).toContain('200 Vaciar mente');
    expect(notas).toContain('Regeneración 16');
    expect(notas).toContain('Zen');
  });
});

describe('los datos extraídos del bestiario', () => {
  it('trae casi un centenar de criaturas, como promete el manual', () => {
    expect(bestiario.length).toBeGreaterThan(80);
  });

  it('ninguna se queda sin nombre ni sin nivel', () => {
    const cojas = bestiario.filter((c) => !c.criatura?.trim() || !c.nivel);
    expect(cojas).toEqual([]);
  });

  it('no hay nombres repetidos', () => {
    const nombres = bestiario.map((c) => c.criatura);
    expect(nombres.length).toBe(new Set(nombres).size);
  });

  it('ningún nombre es en realidad una línea de estadísticas', () => {
    const sospechosos = bestiario.filter((c) =>
      /^(RF|RM|RP|AGI|DES|POD|Fue|Cansancio|Tamaño)\b/.test(c.criatura),
    );
    expect(sospechosos.map((c) => c.criatura)).toEqual([]);
  });

  it('la gran mayoría trae características y resistencias completas', () => {
    const completas = bestiario.filter((c) => c.caracteristicas && c.resistencias);
    expect(completas.length / bestiario.length).toBeGreaterThan(0.75);
  });

  it('todas se pueden traducir a la ficha de mesa sin romperse', () => {
    for (const c of bestiario) {
      const e = desdeManual(c);
      expect(Number.isFinite(e.puntosVida)).toBe(true);
      expect(Number.isFinite(e.ataque)).toBe(true);
      expect(e.nombre).toBeTruthy();
    }
  });
});
