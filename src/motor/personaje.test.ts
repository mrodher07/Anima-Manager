import { describe, it, expect } from 'vitest';
import { calcular, personajeVacio, type DatosCalculo, type Personaje } from './personaje';
import { REGLAMENTO_OFICIAL } from './reglamento';
import razas from '../../data/reglas/razas.json';
import categorias from '../../data/reglas/categorias.json';
import tablasBase from '../../data/reglas/tablasBase.json';
import armasJson from '../../data/reglas/armas.json';
import armadurasJson from '../../data/reglas/armaduras.json';
import ventajasJson from '../../data/reglas/ventajas.json';
import habilidadesKiJson from '../../data/reglas/habilidadesKi.json';
import artesMarcialesJson from '../../data/reglas/artesMarciales.json';
import arsMagnusJson from '../../data/reglas/arsMagnus.json';
import legadosJson from '../../data/reglas/legadosSangre.json';
import efectosTecnicaJson from '../../data/reglas/efectosTecnica.json';
import tiposEfectoJson from '../../data/reglas/tiposEfectoTecnica.json';
import type {
  Arma,
  Armadura,
  Categoria,
  EfectoTecnica,
  EntradaTabla,
  HabilidadKiCatalogo,
  LegadoSangre,
  Raza,
  TablasBase,
  TipoEfectoTecnica,
  Ventaja,
} from '../datos/tipos';

/**
 * Los PD de Ki y Acumulación se guardan por característica (`KiAGI`, `AcumKiPOD`…), así
 * que hay que comprobar que el reparto los cuenta dentro del límite de combate.
 */
const datos = (nombreRaza: string, nombreCategoria: string): DatosCalculo => ({
  raza: (razas as Raza[]).find((r) => r.raza === nombreRaza),
  categoria: (categorias as unknown as Categoria[]).find((c) => c.categoria === nombreCategoria),
  categorias: categorias as unknown as Categoria[],
  tablas: tablasBase as unknown as TablasBase,
  armas: armasJson as Arma[],
  armaduras: armadurasJson as Armadura[],
  ventajas: ventajasJson as Ventaja[],
  habilidadesKi: habilidadesKiJson as HabilidadKiCatalogo[],
  artesMarciales: artesMarcialesJson as EntradaTabla[],
  arsMagnus: arsMagnusJson as EntradaTabla[],
  legadosSangre: legadosJson as LegadoSangre[],
  efectosTecnica: efectosTecnicaJson as EfectoTecnica[],
  tiposEfectoTecnica: tiposEfectoJson as TipoEfectoTecnica[],
});

/**
 * Reconstruye a Meirmeister tal y como está en la ficha original y comprueba que la
 * derivación completa reproduce sus valores.
 */
function meirmeister(): Personaje {
  const p = personajeVacio('meirmeister');
  p.nombre = 'Meirmeister';
  p.raza = 'Jayán';
  p.categorias = [{ categoria: 'Paladín Oscuro (RD)', nivel: 1 }];
  // Valores comprados, antes de los modificadores raciales (+1 CON, +2 FUE, −1 POD).
  p.caracteristicas = { AGI: 10, CON: 8, DES: 10, FUE: 10, INT: 4, PER: 5, POD: 4, VOL: 6 };
  p.pdInvertidos = {
    HAtaque: 150, HParada: 110, LlevarArmadura: 40,
    Acrobacias: 30, Atletismo: 20, Intimidar: 50,
  };
  p.habilidadesNaturales = ['Acrobacias', 'Atletismo', 'Intimidar', 'Advertir', 'Frialdad'];
  // La columna «Esp.» de la ficha original: bonos anotados a mano por el jugador.
  p.bonosEspeciales = {
    Intimidar: 15, Montar: 20, Nadar: 30, Pilotar: 15, Comercio: 10,
    // «Uso de armadura (1)»: +5 por nivel a Llevar Armadura.
    LlevarArmadura: 5,
  };
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

  it('el ajuste de nivel sólo encarece la experiencia, no da bonos', () => {
    expect(ficha.nivel).toBe(1);
    expect(ficha.ajusteNivel).toBe(1); // Jayán
    expect(ficha.nivelParaExperiencia).toBe(2);
    expect(ficha.pdTotales).toBe(600);
  });

  it('reproduce los derivados de la ficha original', () => {
    expect(ficha.puntosVida.valor).toBe(135); // 120 + 15×1, igual que la ficha
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
    // 20 (40 PD ÷ 2) + 20 (FUE) + 5 (categoría) + 5 (ventaja) = 50, igual que la ficha.
    expect(ficha.combate.llevarArmadura.valor).toBe(50);
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

  it('un Legado de Sangre gasta PC y suma +1 al ajuste de nivel', () => {
    const p = meirmeister();
    p.legados = ['Ojos del Alma'];
    const conLegado = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'), REGLAMENTO_OFICIAL);
    // El Jayán ya traía +1; ser Legado suma otro.
    expect(conLegado.ajusteNivel).toBe(2);
    expect(conLegado.nivelParaExperiencia).toBe(3);
    expect(conLegado.puntosCreacion.gastados).toBe(ficha.puntosCreacion.gastados + 1);
  });

  it('varios Legados sólo suman +1 al ajuste, no uno por cada uno', () => {
    const p = meirmeister();
    p.legados = ['Ojos del Alma', 'Sangre Latente', 'Sangre de Kami'];
    const conLegados = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'), REGLAMENTO_OFICIAL);
    expect(conLegados.ajusteNivel).toBe(2);
    // Pero sí se cobran los tres en Puntos de Creación.
    expect(conLegados.puntosCreacion.gastados).toBe(ficha.puntosCreacion.gastados + 3);
  });

  it('un Legado con coste en rango cobra el mínimo', () => {
    const p = meirmeister();
    p.legados = ['Sangre de las Grandes Bestias']; // «1, 2 o 3»
    const r = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'), REGLAMENTO_OFICIAL);
    expect(r.puntosCreacion.gastados).toBe(ficha.puntosCreacion.gastados + 1);
  });

  it('los PD de Ki y Acumulación cuentan como habilidades de combate', () => {
    // Se guardan por característica (KiAGI, AcumKiPOD…), no en una clave suelta.
    const p = meirmeister();
    p.pdInvertidos = { ...p.pdInvertidos, KiFUE: 10, AcumKiPOD: 20, CM: 15 };
    const conKi = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'), REGLAMENTO_OFICIAL);
    expect(conKi.pdGastados.combate).toBe(300 + 10 + 20 + 15);
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
    expect(ficha.puntosVida.calculado).toBe(135); // se conserva para poder restablecer
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
    expect(ficha.puntosVida.valor).toBe(135); // el resto sigue calculándose
  });
});


describe('Puntos de Creación', () => {
  it('empieza con 3 y las desventajas dan más', () => {
    const p = meirmeister();
    p.desventajas = ['Arma exclusiva', 'Adicción o vicio grave'];
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.puntosCreacion.ganados).toBe(2);
    expect(ficha.puntosCreacion.disponibles).toBe(5);
  });

  it('las desventajas no dan más de 3 PC', () => {
    const p = meirmeister();
    p.desventajas = ['Arma exclusiva', 'Adicción o vicio grave', 'Miopía', 'Salud enfermiza'];
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.puntosCreacion.ganados).toBe(3);
    expect(ficha.avisos.some((a) => a.mensaje.includes('como mucho 3'))).toBe(true);
  });

  it('avisa si se gastan más PC de los disponibles', () => {
    const p = meirmeister();
    p.ventajas = ['+1 a característica: AGI', '+1 a característica: CON',
                  '+1 a característica: DES', '+1 a característica: FUE'];
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.puntosCreacion.gastados).toBe(4);
    expect(ficha.avisos.some((a) => a.gravedad === 'error' && a.mensaje.includes('Puntos de Creación'))).toBe(true);
  });
});

describe('efectos de ventajas y desventajas', () => {
  const conVentajas = (ventajas: string[], desventajas: string[] = []) => {
    const p = meirmeister();
    p.ventajas = ventajas;
    p.desventajas = desventajas;
    return calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
  };

  it('«+1 a característica» sube la característica y su bono', () => {
    const base = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'));
    const ficha = conVentajas(['+1 a característica: AGI']);
    expect(base.caracteristicas.AGI.total).toBe(10);
    expect(ficha.caracteristicas.AGI.total).toBe(11);
    expect(ficha.caracteristicas.AGI.bono).toBe(20); // 10 → +15, 11 → +20
  });

  it('«-2 a característica» la baja', () => {
    const ficha = conVentajas([], ['-2 a característica: FUE']);
    expect(ficha.caracteristicas.FUE.total).toBe(10); // 12 − 2
  });

  it('«Res. física excepcional» sube RF, RE y RV', () => {
    const ficha = conVentajas(['Res. física excepcional (2)']);
    expect(ficha.resistencias.RF.valor).toBe(110); // 60 + 50
    expect(ficha.resistencias.RE.valor).toBe(90); // 40 + 50
    expect(ficha.resistencias.RM.valor).toBe(0); // sin tocar
  });

  it('«Vulnerable a la magia» deja la RM a la mitad', () => {
    const conDon = conVentajas(['Don']); // Don da +10 RM
    expect(conDon.resistencias.RM.valor).toBe(10);
    const vulnerable = conVentajas(['Don'], ['Vulnerable a la magia']);
    expect(vulnerable.resistencias.RM.valor).toBe(5);
  });

  it('«Reflejos rápidos (2)» da +45 al turno, como en la ficha original', () => {
    const base = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'));
    const ficha = conVentajas(['Reflejos rápidos (2)']);
    expect(ficha.combate.turnoNatural.valor - base.combate.turnoNatural.valor).toBe(45);
  });

  it('«Reacción lenta» resta al turno', () => {
    const base = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'));
    const ficha = conVentajas([], ['Reacción lenta (1)']);
    expect(ficha.combate.turnoNatural.valor - base.combate.turnoNatural.valor).toBe(-30);
  });

  it('«Difícil de matar» suma PV por nivel', () => {
    expect(conVentajas(['Difícil de matar (2)']).puntosVida.valor).toBe(155); // 135 + 20×1
  });

  it('«Infatigable» sube el cansancio', () => {
    expect(conVentajas(['Infatigable (1)']).cansancio.valor).toBe(15); // 12 + 3
  });

  it('«Uso de armadura» sube Llevar Armadura por nivel', () => {
    const p = meirmeister();
    delete p.bonosEspeciales.LlevarArmadura; // el bono manual que compensaba la ventaja
    p.ventajas = ['Uso de armadura (1)'];
    const ficha = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(ficha.combate.llevarArmadura.valor).toBe(50); // 45 + 5×1
  });

  it('«Armadura natural» suma al TA de la armadura llevada', () => {
    const ficha = conVentajas(['Armadura natural']);
    expect(ficha.combate.proteccion.TA.FIL).toBe(6); // 4 de la armadura + 2
    expect(ficha.combate.proteccion.TA.ENE).toBe(0); // no la cubre
  });

  it('«Sentido del combate» sube el bono de categoría con tope de 50', () => {
    const base = calcular(meirmeister(), datos('Jayán', 'Paladín Oscuro (RD)'));
    const ficha = conVentajas(['Sentido del combate: Ataque']);
    expect(ficha.combate.HAtaque.valor - base.combate.HAtaque.valor).toBe(5);

    const p = meirmeister();
    p.ventajas = ['Sentido del combate: Ataque'];
    p.categorias = [{ categoria: 'Paladín Oscuro (RD)', nivel: 20 }]; // tope conjunto 50
    const alto = calcular(p, datos('Jayán', 'Paladín Oscuro (RD)'));
    const sinVentaja = { ...p, ventajas: [] };
    const altoBase = calcular(sinVentaja, datos('Jayán', 'Paladín Oscuro (RD)'));
    expect(alto.combate.HAtaque.valor - altoBase.combate.HAtaque.valor).toBe(45); // 5 → 50
  });

  it('«Sin bonificador natural» anula las Habilidades Naturales', () => {
    const ficha = conVentajas([], ['Sin bonificador natural']);
    expect(ficha.secundarias['Acrobacias'].valor).toBe(10); // 20 − los 10 de la natural
  });

  it('recoge notas de lo que no se automatiza', () => {
    const ficha = conVentajas([], ['Endeble']);
    expect(ficha.efectos.notas.some((n) => n.texto.includes('tercio'))).toBe(true);
  });

  it('avisa de las ventajas elegidas que todavía no se aplican solas', () => {
    const ficha = conVentajas(['Aliado poderoso (1)']);
    expect(ficha.efectos.sinEfecto).toContain('Aliado poderoso (1)');
    expect(ficha.avisos.some((a) => a.mensaje.includes('no se aplican solas'))).toBe(true);
  });
});

describe('una ficha nueva arranca en blanco, como el Excel', () => {
  it('no trae raza ni categoría elegidas, ni características puestas', () => {
    const p = personajeVacio('nueva');
    expect(p.raza).toBe('');
    expect(p.categorias).toEqual([{ categoria: '', nivel: 1 }]);
    expect(Object.values(p.caracteristicas)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(p.equipo).toEqual({ armadura: [], armas: [] });
    expect(p.bonosEspeciales).toEqual({});
  });

  it('con todo a 0 los derivados salen a 0, sin romperse', () => {
    const p = personajeVacio('nueva');
    const ficha = calcular(p, datos('', ''));
    expect(ficha.caracteristicas.CON.total).toBe(0);
    expect(ficha.caracteristicas.CON.bono).toBe(0); // los bonos son 0 por debajo de 1
    expect(ficha.puntosVida.valor).toBe(20); // 20 + 0 + 0, como PDs!U188
    expect(ficha.cansancio.valor).toBe(0);
    expect(ficha.zeon.valor).toBe(0); // IF(POD=0, 0, ...) de la ficha
    expect(ficha.act.valor).toBe(0);
    expect(Number.isFinite(ficha.presencia.valor)).toBe(true);
  });
});

/**
 * Contraste con tres fichas reales de arquetipos distintos: Ryo (Ki), Christopher
 * (psíquico) y Mogunbun (mago, con una raza que no está en ningún manual).
 */
describe('otras fichas reales', () => {
  it('Ryo, Tecnicista nivel 1: PV 115, cansancio 8, presencia 30, resistencias', () => {
    const p = personajeVacio('ryo');
    p.raza = 'Humano';
    p.categorias = [{ categoria: 'Tecnicista', nivel: 1 }];
    p.caracteristicas = { AGI: 9, CON: 8, DES: 9, FUE: 8, INT: 7, PER: 7, POD: 10, VOL: 7 };
    const f = calcular(p, datos('Humano', 'Tecnicista'));

    expect(f.puntosVida.valor).toBe(115); // 20 + 80 + 10 + 5 de categoría
    expect(f.cansancio.valor).toBe(8); // CON 8, humano sin modificador
    expect(f.presencia.valor).toBe(30);
    expect(f.resistencias.RF.valor).toBe(40); // 30 + 10 (CON)
    expect(f.resistencias.RM.valor).toBe(45); // 30 + 15 (POD)
    expect(f.resistencias.RP.valor).toBe(35); // 30 + 5 (VOL)
    expect(f.zeon.valor).toBe(135); // base por POD 10; el Tecnicista no da Zeón
  });

  it('Christopher, Mentalista nivel 11: 1600 PD y presencia 80', () => {
    const p = personajeVacio('christopher');
    p.raza = 'Humano';
    p.categorias = [{ categoria: 'Mentalista', nivel: 11 }];
    const f = calcular(p, datos('Humano', 'Mentalista'));

    // Confirma la fórmula de PD: 500 + 100 × 11, no 600 × 11.
    expect(f.pdTotales).toBe(1600);
    expect(f.presencia.valor).toBe(80); // 1600 / 20
    expect(f.nivel).toBe(11);
  });

  it('Mogunbun, Hechicero con la raza propia Moguri', () => {
    // «Moguri» no está en ningún manual: esa mesa la añadió a mano.
    const moguri: Raza = { raza: 'Moguri', RM: 20, ajusteNivel: 1, AGI: 1, FUE: -1, tamano: -3 };
    const conMoguri: DatosCalculo = {
      ...datos('', 'Hechicero'),
      raza: moguri,
    };

    const p = personajeVacio('mogunbun');
    p.raza = 'Moguri';
    p.categorias = [{ categoria: 'Hechicero', nivel: 1 }];
    p.caracteristicas = { AGI: 8, CON: 5, DES: 8, FUE: 5, INT: 10, PER: 8, POD: 10, VOL: 6 };
    const f = calcular(p, conMoguri);

    // Características con los modificadores de la raza propia, igual que la ficha.
    expect(f.caracteristicas.AGI.total).toBe(9);
    expect(f.caracteristicas.FUE.total).toBe(4);
    expect(f.caracteristicas.POD.total).toBe(10);
    expect(f.puntosVida.valor).toBe(75);
    expect(f.cansancio.valor).toBe(5);
    expect(f.ajusteNivel).toBe(1);
    // Zeón: 135 de base por POD 10 + 100 por nivel que da el Hechicero.
    expect(f.zeon.valor).toBe(235);
  });

  it('el nivel 0 es válido y no rompe nada', () => {
    const p = personajeVacio('nivel-cero');
    p.categorias = [{ categoria: 'Hechicero', nivel: 0 }];
    p.caracteristicas = { AGI: 8, CON: 5, DES: 8, FUE: 5, INT: 10, PER: 8, POD: 10, VOL: 6 };
    const f = calcular(p, datos('', 'Hechicero'));

    expect(f.nivel).toBe(0);
    expect(f.pdTotales).toBe(400); // PDs!T7: 400 cuando el nivel es 0
    expect(f.presencia.valor).toBe(20); // 400 / 20
    expect(f.puntosVida.valor).toBe(70); // 20 + 50 + 0, sin PV de categoría
    expect(f.zeon.valor).toBe(135); // sólo la base por POD
  });
});
