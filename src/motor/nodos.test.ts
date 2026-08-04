import { describe, it, expect } from 'vitest';
import {
  BENEFICIOS_KI,
  BENEFICIOS_MAGIA,
  BENEFICIOS_PSIQUICO,
  DIFICULTAD_BASE_NODO,
  GRADOS_SANCTUM,
  ZEON_POR_EFECTO_MENOR,
  beneficiosDe,
  calcularNodo,
  consecuenciaDe,
  crearSanctum,
} from './nodos';
import ritualesJson from '../../data/arcana/rituales.json';
import grimoriosJson from '../../data/arcana/grimorios.json';

describe('el ejemplo del propio manual', () => {
  // «Por ejemplo, quien quisiera doblar su ACT (+5 a la Dificultad) y reducir el gasto de
  // Zeon a la mitad (+2 a la Dificultad), debería hacer un control de contra dificultad 17
  // a su atributo de Poder.» (Arcana Exxet, pág. 122)
  it('doblar el ACT y gastar la mitad de Zeon da dificultad 17', () => {
    const r = calcularNodo({
      dominio: 'magia',
      beneficios: ['ACT Doble', 'Gasto de Zeon a Mitad'],
    });
    expect(r.porBeneficios).toBe(7);
    expect(r.dificultad).toBe(17);
  });
});

describe('la dificultad de sincronizar con un Nodo', () => {
  it('parte de 10 aunque no se pida nada', () => {
    expect(calcularNodo({ dominio: 'magia', beneficios: [] }).dificultad).toBe(
      DIFICULTAD_BASE_NODO,
    );
  });

  it('no se puede elegir dos veces el mismo tipo de ventaja', () => {
    const r = calcularNodo({
      dominio: 'magia',
      beneficios: ['Proyección Mágica +25', 'Proyección Mágica +100'],
    });
    // Se queda el mayor: +4, no 1+4.
    expect(r.porBeneficios).toBe(4);
    expect(r.avisos.join(' ')).toMatch(/no se\s+pueden combinar/);
  });

  it('el bono al ACT no se combina con el que lo multiplica', () => {
    const r = calcularNodo({ dominio: 'magia', beneficios: ['ACT +50', 'ACT Quíntuple'] });
    expect(r.porBeneficios).toBe(8);
    expect(r.avisos.join(' ')).toMatch(/multiplica/);
  });

  it('un nodo corrompido sube la dificultad y uno controlado la baja', () => {
    expect(calcularNodo({ dominio: 'magia', beneficios: [], estadoDelNodo: 5 }).dificultad).toBe(15);
    expect(calcularNodo({ dominio: 'magia', beneficios: [], estadoDelNodo: -3 }).dificultad).toBe(7);
  });

  it('el primer enlace cuesta +1', () => {
    const r = calcularNodo({ dominio: 'magia', beneficios: [], primerEnlace: true });
    expect(r.porPrimerEnlace).toBe(1);
    expect(r.dificultad).toBe(11);
  });

  it('avisa de que el Nodo ignora los modificadores innaturales al Poder', () => {
    expect(calcularNodo({ dominio: 'magia', beneficios: [] }).avisos.join(' ')).toMatch(
      /atributo desnudo/,
    );
  });

  it('cada dominio tiene su propia tabla', () => {
    expect(beneficiosDe('magia')).toBe(BENEFICIOS_MAGIA);
    expect(beneficiosDe('psiquico')).toBe(BENEFICIOS_PSIQUICO);
    expect(beneficiosDe('ki')).toBe(BENEFICIOS_KI);
    // Acumulaciones +3 vale 4, no 3: la tabla de Ki no es lineal.
    expect(calcularNodo({ dominio: 'ki', beneficios: ['Acumulaciones +3'] }).dificultad).toBe(14);
  });

  it('un beneficio que no existe en ese dominio se ignora', () => {
    const r = calcularNodo({ dominio: 'ki', beneficios: ['Magia Divina'] });
    expect(r.porBeneficios).toBe(0);
  });
});

describe('lo que le pasa al que falla', () => {
  it('los tramos de la magia son más estrechos que los del Ki', () => {
    expect(consecuenciaDe('magia', 3)?.resultado).toBe('Shock Sobrenatural');
    expect(consecuenciaDe('magia', 7)?.resultado).toBe('Descreación');
    // Con Ki, un fallo de 7 aún no es Descreación.
    expect(consecuenciaDe('ki', 7)?.resultado).toBe('Consunción Espiritual');
    expect(consecuenciaDe('ki', 9)?.resultado).toBe('Descreación');
    expect(consecuenciaDe('psiquico', 4)?.resultado).toBe('Shock Psíquico');
    expect(consecuenciaDe('psiquico', 5)?.resultado).toBe('Consunción Espiritual');
  });

  it('la Consunción Espiritual con magia quita el Don para siempre', () => {
    expect(consecuenciaDe('magia', 5)?.efecto).toMatch(/deja de poseer el Don/);
  });

  it('no fallar no tiene consecuencia', () => {
    expect(consecuenciaDe('magia', 0)).toBeNull();
    expect(consecuenciaDe('magia', -5)).toBeNull();
  });

  it('por mucho que se falle, el peor resultado sigue existiendo', () => {
    expect(consecuenciaDe('magia', 500)?.resultado).toBe('Descreación');
  });
});

describe('crear un Sanctum Sanctorum', () => {
  // «Un mago que creara un Santuario de segundo nivel y eligiese cinco Efectos Menores y
  // un Mayor, debería sacrificar 250 Puntos de Zeon máximos y un punto de Poder.»
  // (Arcana Exxet, pág. 124)
  it('reproduce el ejemplo del manual', () => {
    const s = crearSanctum(2, 5, 1);
    expect(s.zeonMaximoSacrificado).toBe(250);
    expect(s.poderSacrificado).toBe(1);
    expect(s.ritual).toBe('Absurdo');
    expect(s.presenciaRequerida).toBe(50);
  });

  it('cada Efecto Menor cuesta 50 de Zeon máximo', () => {
    expect(crearSanctum(1, 3, 0).zeonMaximoSacrificado).toBe(3 * ZEON_POR_EFECTO_MENOR);
  });

  it('nada obliga a elegir el máximo de efectos', () => {
    // El manual pone justo este caso: grado 3 con ocho Menores y ningún Mayor.
    const s = crearSanctum(3, 8, 0);
    expect(s.zeonMaximoSacrificado).toBe(400);
    expect(s.poderSacrificado).toBe(0);
    expect(s.avisos.filter((a) => a.includes('máximo'))).toEqual([]);
  });

  it('avisa si se pide más de lo que el grado admite, pero calcula igual', () => {
    const s = crearSanctum(1, 5, 1);
    expect(s.avisos.join(' ')).toMatch(/máximo 3 Efectos Menores/);
    expect(s.avisos.join(' ')).toMatch(/no admite Efectos Mayores/);
    // Y aun así hace la cuenta: la aplicación avisa, no bloquea.
    expect(s.zeonMaximoSacrificado).toBe(250);
  });

  it('avisa si al mago le falta presencia', () => {
    expect(crearSanctum(5, 1, 0, 60).avisos.join(' ')).toMatch(/presencia base 85/);
    expect(crearSanctum(5, 1, 0, 90).avisos.join(' ')).not.toMatch(/presencia base/);
  });

  it('recuerda que el sacrificio no se recupera', () => {
    expect(crearSanctum(1, 1, 0).avisos.join(' ')).toMatch(/permanente/);
  });

  it('los cinco grados suben de forma monótona', () => {
    const p = GRADOS_SANCTUM.map((g) => g.presencia);
    expect(p).toEqual([...p].sort((a, b) => a - b));
    expect(GRADOS_SANCTUM.map((g) => g.menores)).toEqual([3, 6, 9, 12, 15]);
    expect(GRADOS_SANCTUM.map((g) => g.mayores)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('los datos de rituales y grimorios', () => {
  const rituales = ritualesJson as { ritual: string; coste: string; requerimientos: string }[];
  const grimorios = grimoriosJson as { grimorio: string; idioma: string }[];

  it('trae los diecisiete rituales del capítulo', () => {
    expect(rituales).toHaveLength(17);
  });

  it('ninguno se queda sin coste ni sin requerimientos', () => {
    const cojos = rituales.filter((r) => !r.coste?.trim() || !r.requerimientos?.trim());
    expect(cojos.map((r) => r.ritual)).toEqual([]);
  });

  it('trae los dieciocho grimorios, cada uno con su idioma', () => {
    expect(grimorios).toHaveLength(18);
    expect(grimorios.filter((g) => !g.idioma?.trim())).toEqual([]);
  });

  it('no hay nombres repetidos', () => {
    expect(new Set(rituales.map((r) => r.ritual)).size).toBe(rituales.length);
    expect(new Set(grimorios.map((g) => g.grimorio)).size).toBe(grimorios.length);
  });
});
