import { describe, it, expect } from 'vitest';
import { calcular, personajeVacio, type DatosCalculo, type Personaje } from './personaje';
import { REGLAMENTO_OFICIAL } from './reglamento';
import razas from '../../data/reglas/razas.json';
import categorias from '../../data/reglas/categorias.json';
import tablasBase from '../../data/reglas/tablasBase.json';
import armasJson from '../../data/reglas/armas.json';
import armadurasJson from '../../data/reglas/armaduras.json';
import type { Arma, Armadura, Categoria, Raza, TablasBase } from '../datos/tipos';

const datos = (nombreRaza: string, nombreCategoria: string): DatosCalculo => ({
  raza: (razas as Raza[]).find((r) => r.raza === nombreRaza),
  categoria: (categorias as unknown as Categoria[]).find((c) => c.categoria === nombreCategoria),
  tablas: tablasBase as unknown as TablasBase,
  armas: armasJson as Arma[],
  armaduras: armadurasJson as Armadura[],
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
  // La columna «Esp.» de la ficha original: bonos anotados a mano por el jugador.
  p.bonosEspeciales = { Intimidar: 15, Montar: 20, Nadar: 30, Pilotar: 15, Comercio: 10 };
  p.equipo = {
    armadura: [{ armadura: 'Piezas' }],
    armas: [
      { arma: 'Hacha a dos manos', aDosManos: true, conocimiento: 'Conocida', escala: 'Enorme' },
    ],
  };
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

  it('reproduce las habilidades secundarias, con armadura y bonos especiales', () => {
    // 15 (30 PD ÷ 2) + 15 (AGI) + 10 (natural) − 20 (armadura, física) = 20
    expect(ficha.secundarias['Acrobacias'].valor).toBe(20);
    // 0 + 15 (AGI) − 30 (sin desarrollar) − 20 (armadura) = −35, igual que la ficha.
    expect(ficha.secundarias['Trepar'].valor).toBe(-35);
    // 50 + 5 (VOL) + 10 (categoría) + 10 (natural) + 15 (especial) = 90, igual que la ficha.
    expect(ficha.secundarias['Intimidar'].valor).toBe(90);
  });

  it('reproduce las habilidades de combate', () => {
    // 75 (150 PD ÷ 2) + 15 (DES) + 5 (categoría) = 95, igual que la ficha.
    expect(ficha.combate.HAtaque.valor).toBe(95);
    // 55 (110 PD ÷ 2) + 15 (DES) = 70, igual que la ficha.
    expect(ficha.combate.HParada.valor).toBe(70);
    // 20 (40 PD ÷ 2) + 20 (FUE) + 5 (categoría) = 45… la ficha da 50.
    expect(ficha.combate.llevarArmadura.valor).toBeGreaterThanOrEqual(45);
    expect(ficha.combate.tamano).toBe(23);
  });

  it('reproduce la armadura de la ficha', () => {
    const p = ficha.combate.proteccion;
    expect(p.TA).toEqual({ FIL: 4, CON: 3, PEN: 2, CAL: 3, ELE: 2, FRI: 2, ENE: 0 });
    expect(p.requisito).toBe(50);
    expect(p.penalizadorNatural).toBe(-20);
    expect(p.restriccionMovimiento).toBe(2);
  });

  it('reproduce el hacha a dos manos', () => {
    const hacha = ficha.combate.armas[0];
    expect(hacha.dano).toBe(190);
    expect(hacha.ataque).toBe(95);
    expect(hacha.parada).toBe(70);
    expect(hacha.criticos).toEqual(['FIL', 'CON']);
    expect(hacha.avisos).toEqual([]); // FUE 12 supera el requisito de 9 a dos manos
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
    expect(ficha.secundarias['Trepar'].valor).toBe(-5); // 15 (AGI) − 20 (armadura)
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
