import { describe, it, expect } from 'vitest';
import { calcular, personajeVacio, type DatosCalculo, type Personaje } from './personaje';
import { REGLAMENTO_OFICIAL } from './reglamento';
import razas from '../../data/reglas/razas.json';
import categorias from '../../data/reglas/categorias.json';
import tablasBase from '../../data/reglas/tablasBase.json';
import type { Categoria, Raza, TablasBase } from '../datos/tipos';

const datos = (nombreRaza: string, nombreCategoria: string): DatosCalculo => ({
  raza: (razas as Raza[]).find((r) => r.raza === nombreRaza),
  categoria: (categorias as unknown as Categoria[]).find((c) => c.categoria === nombreCategoria),
  tablas: tablasBase as unknown as TablasBase,
});

/**
 * Reconstruye a Meirmeister tal y como está en la ficha original y comprueba que la
 * derivación completa reproduce sus valores.
 */
function meirmeister(): Personaje {
  const p = personajeVacio('meirmeister');
  p.nombre = 'Meirmeister';
  p.raza = 'Jayán';
  p.categoria = 'Paladín Oscuro (RD)';
  p.nivel = 1;
  // Valores comprados, antes de los modificadores raciales (+1 CON, +2 FUE, −1 POD).
  p.caracteristicas = { AGI: 10, CON: 8, DES: 10, FUE: 10, INT: 4, PER: 5, POD: 4, VOL: 6 };
  p.pdInvertidos = {
    HAtaque: 150, HParada: 110, LlevarArmadura: 40,
    Acrobacias: 30, Atletismo: 20, Intimidar: 50,
  };
  p.habilidadesNaturales = ['Acrobacias', 'Atletismo', 'Intimidar', 'Advertir', 'Frialdad'];
  return p;
}

describe('derivación de la ficha de Meirmeister', () => {
  const ficha = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'));

  it('aplica los modificadores raciales del Jayán', () => {
    expect(ficha.caracteristicas.CON.total).toBe(9); // 8 + 1
    expect(ficha.caracteristicas.FUE.total).toBe(12); // 10 + 2
    expect(ficha.caracteristicas.POD.total).toBe(3); // 4 − 1
    expect(ficha.caracteristicas.AGI.total).toBe(10); // sin modificador
  });

  it('calcula los bonos de característica', () => {
    expect(ficha.caracteristicas.AGI.bono).toBe(15);
    expect(ficha.caracteristicas.CON.bono).toBe(10);
    expect(ficha.caracteristicas.FUE.bono).toBe(20);
    expect(ficha.caracteristicas.POD.bono).toBe(-10);
  });

  it('el ajuste de nivel racial cuenta para el nivel total', () => {
    expect(ficha.nivelTotal).toBe(2); // nivel 1 + ajuste 1 del Jayán
    expect(ficha.pdTotales).toBe(600);
  });

  it('reproduce los derivados de la ficha original', () => {
    expect(ficha.puntosVida.valor).toBe(150); // 120 + 15×2 (nivel total)
    expect(ficha.cansancio.valor).toBe(12);
    expect(ficha.presencia.valor).toBe(30);
    expect(ficha.resistencias.RF.valor).toBe(60);
    expect(ficha.resistencias.RM.valor).toBe(0); // 30 − 10 (POD) − 20 (Jayán)
  });

  it('reproduce las habilidades secundarias', () => {
    expect(ficha.secundarias['Acrobacias'].valor).toBe(40);
    // La ficha da −35, que incluye −20 del penalizador de armadura. El equipo todavía no
    // está modelado, así que aquí sale −15.
    expect(ficha.secundarias['Trepar'].valor).toBe(-15);
    // La ficha da 90: 50 (PD) + 5 (VOL) + 10 (categoría) + 10 (natural) + 15 especial.
    // Los bonos especiales (raciales, ventajas, Elan) están pendientes de modelar.
    expect(ficha.secundarias['Intimidar'].valor).toBe(75);
  });

  it('reparte los PD por campo y respeta los límites de la categoría', () => {
    expect(ficha.pdGastados.combate).toBe(300);
    expect(ficha.limites.combate).toBe(360);
    expect(ficha.limites.misticas).toBe(300);
    expect(ficha.avisos.filter((a) => a.gravedad === 'error')).toEqual([]);
  });
});

describe('avisos', () => {
  it('avisa al superar el límite de combate sin bloquear el cálculo', () => {
    const p = meirmeister();
    p.pdInvertidos = { HAtaque: 400 };
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.avisos.some((a) => a.mensaje.includes('límite'))).toBe(true);
    expect(ficha.puntosVida.valor).toBeGreaterThan(0); // sigue calculando
  });

  it('avisa al repartir más PD de los disponibles', () => {
    const p = meirmeister();
    p.pdInvertidos = { HAtaque: 400, Acrobacias: 400 };
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.avisos.some((a) => a.gravedad === 'error' && a.mensaje.includes('600'))).toBe(true);
  });

  it('avisa si se eligen más de cinco Habilidades Naturales', () => {
    const p = meirmeister();
    p.habilidadesNaturales = ['Acrobacias', 'Atletismo', 'Intimidar', 'Advertir', 'Frialdad', 'Sigilo'];
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.avisos.some((a) => a.mensaje.includes('Naturales'))).toBe(true);
  });

  it('avisa de una raza desconocida en vez de romperse', () => {
    const p = meirmeister();
    p.raza = 'Inventada';
    const ficha = calcular(p, datos('Inventada', 'Paladín Oscuro (RD)'));
    expect(ficha.avisos.some((a) => a.gravedad === 'error')).toBe(true);
    expect(Number.isFinite(ficha.puntosVida.valor)).toBe(true);
  });
});

describe('sobrescritura manual', () => {
  it('el valor manual manda sobre el calculado, sin perderlo', () => {
    const p = meirmeister();
    p.manuales = { puntosVida: 999 };
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.puntosVida.valor).toBe(999);
    expect(ficha.puntosVida.manual).toBe(true);
    expect(ficha.puntosVida.calculado).toBe(150); // se conserva para poder restablecer
  });
});

describe('reglas caseras aplicadas a la ficha completa', () => {
  it('una mesa puede cambiar el penalizador de las secundarias sin desarrollar', () => {
    const sinPenalizador = REGLAMENTO_OFICIAL.conFormula(
      'habilidadSecundaria',
      'truncar(pd / coste) + bonoCaracteristica + bonoCategoria + mejoraNatural + penalizadorNatural',
    );
    const ficha = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'), sinPenalizador);
    expect(ficha.secundarias['Trepar'].valor).toBe(15); // en vez de −15
  });

  it('desactivar los límites de PD silencia sus avisos', () => {
    const p = meirmeister();
    p.pdInvertidos = { HAtaque: 400 };
    const sinLimites = REGLAMENTO_OFICIAL.activar('limitePrimarias', false);
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'), sinLimites);
    expect(ficha.avisos.some((a) => a.mensaje.includes('límite'))).toBe(false);
  });

  it('una fórmula rota se reporta como aviso en lugar de tumbar la ficha', () => {
    const rota = REGLAMENTO_OFICIAL.conFormula('cansancio', 'CON / 0');
    const ficha = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'), rota);
    expect(ficha.avisos.some((a) => a.mensaje.includes('ha fallado'))).toBe(true);
    expect(ficha.puntosVida.valor).toBe(150); // el resto sigue calculándose
  });
});
