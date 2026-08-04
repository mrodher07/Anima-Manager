import { describe, it, expect } from 'vitest';
import { evaluar, validar, analizar, ErrorDeFormula } from './expresiones';
import { REGLAMENTO_OFICIAL, REGLAS, definicion } from './reglamento';
import tablasBase from '../../data/reglas/tablasBase.json';
import armas from '../../data/reglas/armas.json';
import razas from '../../data/reglas/razas.json';
import categorias from '../../data/reglas/categorias.json';

interface Categoria {
  categoria: string;
  limiteCombate: number;
  limiteMagia: number;
  limitePsi: number;
}

const pvPorValor = (v: number) =>
  (tablasBase.valoresBase as { valor: number; PV: number; ACT: number }[]).find((x) => x.valor === v)!;
const bonoPorValor = (v: number) =>
  (tablasBase.bonoCaracteristica as { valor: number; bono: number }[]).find((x) => x.valor === v)!.bono;

describe('evaluador de expresiones', () => {
  it('resuelve aritmética con la precedencia correcta', () => {
    expect(evaluar('2 + 3 * 4', {})).toBe(14);
    expect(evaluar('(2 + 3) * 4', {})).toBe(20);
    expect(evaluar('-5 + 10', {})).toBe(5);
  });

  it('resuelve condicionales y comparaciones', () => {
    expect(evaluar('x > 10 ? 1 : 0', { x: 20 })).toBe(1);
    expect(evaluar('x > 10 ? 1 : 0', { x: 5 })).toBe(0);
    expect(evaluar('a && b', { a: 1, b: 0 })).toBe(0);
  });

  it('aplica las funciones de tabla', () => {
    expect(evaluar('multiploInferior(150, 5)', {})).toBe(150);
    expect(evaluar('multiploInferior(153, 5)', {})).toBe(150);
    expect(evaluar('truncar(-7 / 2)', {})).toBe(-3); // hacia cero, como Excel
    expect(evaluar('suelo(-7 / 2)', {})).toBe(-4); // hacia abajo
    expect(evaluar('min(3, 9, 1)', {})).toBe(1);
  });

  it('acepta booleanos del contexto como 1/0', () => {
    expect(evaluar('aDosManos ? 2 : 1', { aDosManos: true })).toBe(2);
    expect(evaluar('aDosManos ? 2 : 1', { aDosManos: false })).toBe(1);
  });

  it('rechaza cualquier cosa que no sea una expresión aritmética', () => {
    // Lo importante: nada de esto llega nunca a ejecutarse como JavaScript.
    expect(() => analizar('process.exit(1)')).not.toThrow(); // se analiza como variable+llamada…
    expect(() => evaluar('process.exit(1)', {})).toThrow(ErrorDeFormula); // …pero no existe
    expect(() => analizar('a[0]')).toThrow(ErrorDeFormula);
    expect(() => analizar('`x`')).toThrow(ErrorDeFormula);
    expect(() => analizar('a => a')).toThrow(ErrorDeFormula);
    expect(() => evaluar('desconocida + 1', {})).toThrow(/Variable desconocida/);
  });

  it('informa de errores de sintaxis en lugar de fallar en silencio', () => {
    const r = validar('2 +');
    expect(r.ok).toBe(false);
    expect(evaluar('10 / 2', {})).toBe(5);
    expect(() => evaluar('10 / 0', {})).toThrow(/División por cero/);
  });

  it('lista las variables que necesita una fórmula', () => {
    const r = validar('a + b * truncar(c)');
    expect(r.ok && r.variables.sort()).toEqual(['a', 'b', 'c']);
  });
});

/**
 * Los valores esperados son los que muestra la ficha Meirmeister.xlsm:
 * Jayán, Paladín Oscuro (RD), nivel 1 + 1, CON 9, FUE 12, AGI 10, POD 3, VOL 6.
 */
describe('reglamento oficial contra la ficha de Meirmeister', () => {
  const jayan = (razas as { raza: string; cansancio?: number; RF?: number }[]).find(
    (r) => r.raza === 'Jayán',
  )!;

  it('Puntos de Vida = 135', () => {
    // La ficha usa la fórmula aritmética (PDs!U188), no la tabla.
    const pv = REGLAMENTO_OFICIAL.aplicar('puntosVida', {
      CONx10: 9 * 10,
      bonoCON: bonoPorValor(9),
      pvCategoria: 15, // Paladín Oscuro (RD)
      nivelTotal: 1,
      pvBasePorCON: pvPorValor(9).PV,
      CON: 9,
    });
    expect(pv).toBe(135);
    // Coincide con la Tabla 4 del manual: 120 + 15.
    expect(pvPorValor(9).PV + 15).toBe(135);
  });

  it('Cansancio = 12', () => {
    expect(jayan.cansancio).toBe(3);
    const c = REGLAMENTO_OFICIAL.aplicar('cansancio', { CON: 9, cansancioRaza: jayan.cansancio! });
    expect(c).toBe(12);
  });

  it('Presencia = 30 con 600 PD', () => {
    expect(REGLAMENTO_OFICIAL.aplicar('presencia', { pdTotales: 600 })).toBe(30);
  });

  it('Resistencia Física = 60', () => {
    expect(jayan.RF).toBe(20);
    const rf = REGLAMENTO_OFICIAL.aplicar('resistencia', {
      presencia: 30,
      bonoCaracteristica: bonoPorValor(9), // CON 9 → +10
      modRaza: jayan.RF!,
      especial: 0,
      factor: 1,
    });
    expect(rf).toBe(60);
  });

  it('Zeón base con POD 3 = 40', () => {
    const zeon = REGLAMENTO_OFICIAL.aplicar('zeon', {
      zeonBasePorPOD: pvPorValor(3).PV,
      zeonComprado: 0,
      zeonCategoria: 0,
      nivelTotal: 1,
    });
    expect(zeon).toBe(40);
  });

  it('Potencial Psíquico con VOL 6 = +20', () => {
    const tabla = tablasBase.potencialPsiquico as { VOL: number; potencial: number }[];
    expect(tabla.find((x) => x.VOL === 6)!.potencial).toBe(20);
  });

  it('Daño del hacha a dos manos = 190', () => {
    const hacha = (armas as { arma: string; dano: number }[]).find(
      (a) => a.arma === 'Hacha a dos manos',
    )!;
    expect(hacha.dano).toBe(100);
    const enorme = (tablasBase.armasEnormes as { tamano: string; multDano: number }[]).find(
      (t) => t.tamano === 'Enorme',
    )!;
    expect(enorme.multDano).toBe(1.5);

    const dano = REGLAMENTO_OFICIAL.aplicar('danoArma', {
      danoBase: hacha.dano,
      danoMunicion: 0,
      multTamano: enorme.multDano,
      bonoFUE: bonoPorValor(12), // FUE 12 → +20
      aDosManos: true,
      calidad: 0,
      extras: 0,
    });
    expect(dano).toBe(190);
  });

  it('Trepar sin desarrollar = −35', () => {
    const trepar = REGLAMENTO_OFICIAL.aplicar('habilidadSecundaria', {
      pd: 0,
      coste: 2,
      bonoCaracteristica: bonoPorValor(10), // AGI 10 → +15
      bonoCategoria: 0,
      mejoraNatural: 0,
      penalizadorNoDesarrollada: -30,
      penalizadorNatural: -20,
    });
    expect(trepar).toBe(-35);
  });

  it('Acrobacias con 30 PD = 40', () => {
    const acrobacias = REGLAMENTO_OFICIAL.aplicar('habilidadSecundaria', {
      pd: 30,
      coste: 2,
      bonoCaracteristica: bonoPorValor(10),
      bonoCategoria: 0,
      mejoraNatural: 10, // una de las cinco Habilidades Naturales
      penalizadorNoDesarrollada: -30,
      penalizadorNatural: 0,
    });
    expect(acrobacias).toBe(40);
  });

  it('límites de PD de Meirmeister: 360 en combate, 300 en mística y psíquica', () => {
    const paladin = (categorias as Categoria[]).find((c) => c.categoria === 'Paladín Oscuro (RD)')!;
    expect(paladin.limiteCombate).toBeCloseTo(0.6);
    expect(paladin.limiteMagia).toBe(0.5);

    const limite = (fraccion: number) =>
      REGLAMENTO_OFICIAL.aplicar('limitePrimarias', { pdTotales: 600, limiteCategoria: fraccion });
    expect(limite(paladin.limiteCombate)).toBe(360);
    expect(limite(paladin.limiteMagia)).toBe(300);
    expect(limite(paladin.limitePsi)).toBe(300);
  });

  it('el hechicero puede gastar 180 PD en Proyección Mágica en nivel 1', () => {
    // El manual da 180 como ejemplo. Sale de 0.6 (su límite mágico), no de 0.5:
    // 600 × 0.6 = 360, y la mitad son 180.
    const hechicero = (categorias as Categoria[]).find((c) => c.categoria === 'Hechicero')!;
    expect(hechicero.limiteMagia).toBeCloseTo(0.6);

    const limiteMagia = REGLAMENTO_OFICIAL.aplicar('limitePrimarias', {
      pdTotales: 600,
      limiteCategoria: hechicero.limiteMagia,
    });
    expect(limiteMagia).toBe(360);
    expect(REGLAMENTO_OFICIAL.aplicar('limiteProyeccion', { limitePrimarias: limiteMagia })).toBe(180);
  });
});

describe('resolución de combate', () => {
  it('absorción = 20 + 10 × TA', () => {
    expect(REGLAMENTO_OFICIAL.aplicar('absorcion', { TA: 1 })).toBe(30);
    expect(REGLAMENTO_OFICIAL.aplicar('absorcion', { TA: 6 })).toBe(80);
  });

  it('porcentaje de daño según el margen', () => {
    const pct = (margen: number) => REGLAMENTO_OFICIAL.aplicar('porcentajeDano', { margen });
    expect(pct(27)).toBe(20); // ejemplo del manual
    expect(pct(185)).toBe(180); // ejemplo del manual
    expect(pct(9)).toBe(0); // por debajo de 10 no hay daño
    expect(pct(10)).toBe(10);
  });

  it('un crítico es un impacto que quita la mitad de los PV actuales', () => {
    expect(REGLAMENTO_OFICIAL.aplicar('umbralCritico', { pvActuales: 180, pvMaximos: 180 })).toBe(90);
    expect(REGLAMENTO_OFICIAL.aplicar('umbralCritico', { pvActuales: 90, pvMaximos: 180 })).toBe(45);
  });
});

describe('reglas caseras', () => {
  it('permite reescribir una fórmula y volver a la oficial', () => {
    const casera = REGLAMENTO_OFICIAL.conFormula('absorcion', '20 + 15 * TA');
    expect(casera.aplicar('absorcion', { TA: 4 })).toBe(80);
    expect(REGLAMENTO_OFICIAL.aplicar('absorcion', { TA: 4 })).toBe(60); // el oficial no se toca
    expect(casera.estaPersonalizada('absorcion')).toBe(true);

    const vuelta = casera.restablecer('absorcion');
    expect(vuelta.aplicar('absorcion', { TA: 4 })).toBe(60);
    expect(vuelta.estaPersonalizada('absorcion')).toBe(false);
  });

  it('cubre la errata del Zeón: cap. 1 (×5) frente a cap. 11 (×10)', () => {
    const oficial = REGLAMENTO_OFICIAL.aplicar('zeonPorPD', { pd: 10, coste: 1 });
    expect(oficial).toBe(50);

    const segunCap11 = REGLAMENTO_OFICIAL.conFormula('zeonPorPD', 'truncar(pd / coste) * 10');
    expect(segunCap11.aplicar('zeonPorPD', { pd: 10, coste: 1 })).toBe(100);
  });

  it('permite calcular el crítico sobre los PV máximos', () => {
    const sobreMaximos = REGLAMENTO_OFICIAL.conFormula('umbralCritico', 'pvMaximos / 2');
    expect(sobreMaximos.aplicar('umbralCritico', { pvActuales: 90, pvMaximos: 180 })).toBe(90);
  });

  it('desactiva reglas opcionales, pero no las estructurales', () => {
    const sinLimites = REGLAMENTO_OFICIAL.activar('limitePrimarias', false);
    expect(sinLimites.estaActiva('limitePrimarias')).toBe(false);
    expect(sinLimites.aplicar('limitePrimarias', { pdTotales: 600, limiteCategoria: 0.6 }, Infinity)).toBe(
      Infinity,
    );
    expect(() => REGLAMENTO_OFICIAL.activar('puntosVida', false)).toThrow(/estructural/);
  });

  it('rechaza fórmulas inválidas o con variables que no existen', () => {
    expect(() => REGLAMENTO_OFICIAL.conFormula('absorcion', '20 +')).toThrow(/inválida/);
    expect(() => REGLAMENTO_OFICIAL.conFormula('absorcion', '20 + inventada')).toThrow(/no disponibles/);
  });

  it('guarda sólo las desviaciones, no el reglamento entero', () => {
    const mesa = REGLAMENTO_OFICIAL.conFormula('absorcion', '20 + 15 * TA').activar('umbralCritico', false);
    expect(mesa.serializar()).toEqual({
      formulas: { absorcion: '20 + 15 * TA' },
      desactivadas: ['umbralCritico'],
    });
    expect(mesa.cambios()).toEqual([
      { clave: 'absorcion', nombre: 'Absorción', motivo: 'reescrita' },
      { clave: 'umbralCritico', nombre: 'Umbral de crítico', motivo: 'desactivada' },
    ]);
    expect(mesa.restablecerTodo().cambios()).toEqual([]);
  });

  it('toda regla del catálogo tiene una fórmula válida y documentada', () => {
    for (const r of REGLAS) {
      const v = validar(r.formula);
      expect(v.ok, `${r.clave}: ${v.ok ? '' : v.error}`).toBe(true);
      expect(r.referencia.length).toBeGreaterThan(0);
      // Toda variable usada por la fórmula debe estar documentada para la interfaz.
      if (v.ok) {
        const sinDocumentar = v.variables.filter((n) => !(n in definicion(r.clave).variables));
        expect(sinDocumentar, `${r.clave}`).toEqual([]);
      }
    }
  });
});
