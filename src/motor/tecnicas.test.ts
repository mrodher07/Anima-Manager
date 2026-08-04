import { describe, it, expect } from 'vitest';
import {
  CM_MANTENIDA,
  NIVELES,
  calcularTecnica,
  disenoVacio,
  leerCaracteristicas,
  puedeCrearNivel,
  repartoPorDefecto,
  resumirCoste,
  type CatalogoTecnicas,
  type DisenoTecnica,
} from './tecnicas';
import opcionesJson from '../../data/reglas/efectosTecnica.json';
import fichasJson from '../../data/reglas/tiposEfectoTecnica.json';
import type { EfectoTecnica, TipoEfectoTecnica } from '../datos/tipos';

const catalogo: CatalogoTecnicas = {
  opciones: opcionesJson as EfectoTecnica[],
  fichas: fichasJson as TipoEfectoTecnica[],
};

const opcion = (ref: string) => catalogo.opciones.find((o) => o.referencia === ref)!;

function diseno(cambios: Partial<DisenoTecnica>): DisenoTecnica {
  return { ...disenoVacio('Prueba'), ...cambios };
}

describe('leer las características de un efecto', () => {
  it('separa la principal de las opcionales con su recargo', () => {
    const c = leerCaracteristicas('DES (AGI+2, FUE+2, POD+2, VOL+3)');
    expect(c.principal).toBe('DES');
    expect(c.alternativas).toEqual([
      { caracteristica: 'AGI', recargo: 2 },
      { caracteristica: 'FUE', recargo: 2 },
      { caracteristica: 'POD', recargo: 2 },
      { caracteristica: 'VOL', recargo: 3 },
    ]);
  });

  it('admite efectos sin opcionales', () => {
    expect(leerCaracteristicas('POD')).toEqual({ principal: 'POD', alternativas: [] });
  });

  it('no se inventa nada si el texto falta o no vale', () => {
    expect(leerCaracteristicas(undefined).principal).toBeNull();
    expect(leerCaracteristicas('INT (PER+2)').principal).toBeNull();
  });
});

describe('los datos extraídos del Excel', () => {
  it('toda opción tiene coste primario, secundario, CM y nivel', () => {
    const incompletas = catalogo.opciones.filter(
      (o) => o.kiPrincipal === undefined || o.kiSecundaria === undefined || o.CM === undefined,
    );
    expect(incompletas.map((o) => o.referencia)).toEqual([]);
  });

  it('el coste como Secundario nunca es menor que como Primario', () => {
    // El manual dice que el Primario «siempre tiene un coste menor en puntos de Ki».
    const raras = catalogo.opciones.filter((o) => (o.kiSecundaria ?? 0) < (o.kiPrincipal ?? 0));
    expect(raras.map((o) => o.referencia)).toEqual([]);
  });

  it('los niveles de efecto van de 1 a 3', () => {
    const fuera = catalogo.opciones.filter((o) => (o.nivel ?? 1) < 1 || (o.nivel ?? 1) > 3);
    expect(fuera).toEqual([]);
  });

  it('cada ficha de efecto declara una característica del Ki', () => {
    const sinCaracteristica = catalogo.fichas.filter(
      (f) => leerCaracteristicas(f.caracteristicas).principal === null,
    );
    expect(sinCaracteristica.map((f) => f.efecto)).toEqual([]);
  });
});

describe('el ejemplo paso a paso del capítulo 5', () => {
  // Técnica de nivel 2: Habilidad de Ataque +125 (Primario), Ataque a Distancia 100 m
  // y Maniobras/Apuntar -100 como Secundarios. El manual da 70 CM.
  const ATAQUE = 'Habilidad De Ataque +125';
  const DISTANCIA = 'Ataque A Distancia 100 metros';
  const APUNTAR = 'Maniobras De Combate Y Apuntar -100';

  it('las tres opciones existen con los costes que da el manual', () => {
    expect(opcion(ATAQUE).kiPrincipal).toBe(18);
    expect(opcion(ATAQUE).CM).toBe(35);
    expect(opcion(DISTANCIA).kiSecundaria).toBe(8);
    expect(opcion(DISTANCIA).CM).toBe(20);
    expect(opcion(APUNTAR).kiSecundaria).toBe(9);
    expect(opcion(APUNTAR).CM).toBe(15);
  });

  it('suma 70 CM y cabe en una Técnica de nivel 2', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [
          { referencia: ATAQUE, primario: true, reparto: {} },
          { referencia: DISTANCIA, primario: false, reparto: {} },
          { referencia: APUNTAR, primario: false, reparto: {} },
        ],
      }),
      catalogo,
    );
    expect(t.CM).toBe(70);
    expect(t.avisos).toEqual([]);
  });

  it('sin repartir, el coste es 27 de Destreza y 8 de Poder', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [
          { referencia: ATAQUE, primario: true, reparto: {} },
          { referencia: DISTANCIA, primario: false, reparto: {} },
          { referencia: APUNTAR, primario: false, reparto: {} },
        ],
      }),
      catalogo,
    );
    expect(t.ki.DES).toBe(27);
    expect(t.ki.POD).toBe(8);
  });

  it('al pasar el bono al ataque a Fuerza y Agilidad, 18 se convierten en 22', () => {
    // Ambas tienen recargo +2, así que 18 + 2 + 2 = 22, repartidos 10 y 12.
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [
          { referencia: ATAQUE, primario: true, reparto: { FUE: 10, AGI: 12 } },
          { referencia: DISTANCIA, primario: false, reparto: {} },
          { referencia: APUNTAR, primario: false, reparto: {} },
        ],
      }),
      catalogo,
    );
    // El resultado del manual: Agilidad 12, Fuerza 10, Destreza 9 y Poder 8.
    expect(t.ki).toEqual({ AGI: 12, FUE: 10, DES: 9, POD: 8 });
    expect(resumirCoste(t.ki)).toBe('AGI 12 CON 0 DES 9 FUE 10 POD 8 VOL 0'.replace(/ \w{3} 0/g, ''));
    expect(t.avisos).toEqual([]);
  });

  it('avisa si el reparto no cuadra con el coste más el recargo', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [{ referencia: ATAQUE, primario: true, reparto: { FUE: 10, AGI: 8 } }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('has repartido 18 puntos de Ki y hacen falta 22');
  });

  it('avisa si se usa una característica que el efecto no admite', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [{ referencia: ATAQUE, primario: true, reparto: { CON: 18 } }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('CON no es una característica válida');
  });
});

describe('el ejemplo de la Técnica Mantenida', () => {
  /*
   * ERRATA DEL MANUAL. El ejemplo de «Mantener las Técnicas» dice que un +50 al Daño
   * cuesta «5 puntos de Ki y 15 de CM», y de ahí saca 7 tras sumar el mantenimiento.
   * Pero la tabla de Aumento de Daño del propio capítulo 5 da Primario 4, Secundario 6,
   * CM 15 y Mant. 2. Se sigue la tabla, que es lo que además implementa la ficha; con
   * ella el coste final es 6, no 7. El CM sí coincide: 15 + 10 = 25.
   */
  const DANO = 'Aumento De Daño +50';

  it('cuesta 4 de Ki y 15 de CM como Primario, según la tabla', () => {
    expect(opcion(DANO).kiPrincipal).toBe(4);
    expect(opcion(DANO).kiSecundaria).toBe(6);
    expect(opcion(DANO).CM).toBe(15);
    expect(opcion(DANO).mantenimiento).toBe(2);
  });

  it('mantenerla sube el CM a 25, como dice el ejemplo', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        mantenida: true,
        efectos: [{ referencia: DANO, primario: true, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.cmMantenida).toBe(CM_MANTENIDA[1]);
    expect(t.CM).toBe(25);
    expect(t.kiTotal).toBe(6);
    // En los asaltos siguientes, mantenerla cuesta 2.
    expect(t.kiMantenimiento).toBe(2);
  });
});

describe('límites de CM por nivel', () => {
  it('una Técnica barata cuesta como mínimo lo que marque su nivel', () => {
    // El manual: «aún puedes crearla, pero su coste será el mínimo para su nivel».
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        efectos: [{ referencia: 'Habilidad De Ataque +10', primario: true, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.cmEfectos).toBe(5);
    expect(t.CM).toBe(NIVELES[1].cmMinimo);
    expect(t.avisos).toEqual([]);
  });

  it('avisa al pasarse del máximo del nivel', () => {
    // Tres Efectos de nivel 1 que caben de sobra por nivel, pero suman 105 CM.
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        efectos: [
          { referencia: 'Habilidad De Ataque +100', primario: true, reparto: {} },
          { referencia: 'Aumento De Daño +100', primario: false, reparto: {} },
          { referencia: 'Ataque A Distancia 100 metros', primario: false, reparto: {} },
        ],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('no puede pasar de 50 CM');
  });

  it('un Efecto de nivel superior no cabe en una Técnica menor', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        efectos: [{ referencia: 'Habilidad De Ataque +150', primario: true, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('es un Efecto de nivel 2');
  });
});

describe('el Efecto Primario', () => {
  it('hace falta uno', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        efectos: [{ referencia: 'Habilidad De Ataque +10', primario: false, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('Falta el Efecto Primario');
  });

  it('sólo puede haber uno', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [
          { referencia: 'Habilidad De Ataque +10', primario: true, reparto: {} },
          { referencia: 'Aumento De Daño +50', primario: true, reparto: {} },
        ],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('sólo puede haber uno');
  });

  it('el Primario sale más barato en Ki que el mismo efecto como Secundario', () => {
    const comoPrimario = calcularTecnica(
      diseno({ nivel: 1, efectos: [{ referencia: 'Habilidad De Ataque +40', primario: true, reparto: {} }] }),
      catalogo,
    );
    const comoSecundario = calcularTecnica(
      diseno({
        nivel: 2,
        efectos: [
          { referencia: 'Aumento De Daño +50', primario: true, reparto: {} },
          { referencia: 'Habilidad De Ataque +40', primario: false, reparto: {} },
        ],
      }),
      catalogo,
    );
    expect(comoPrimario.ki.DES).toBe(4);
    expect(comoSecundario.ki.DES).toBe(6);
  });
});

describe('alterar el coste', () => {
  const base = () =>
    diseno({
      nivel: 2,
      efectos: [
        { referencia: 'Habilidad De Ataque +125', primario: true, reparto: { AGI: 12, FUE: 10 } },
        { referencia: 'Ataque A Distancia 100 metros', primario: false, reparto: {} },
        { referencia: 'Maniobras De Combate Y Apuntar -100', primario: false, reparto: {} },
      ],
    });

  it('cada punto de Ki rebajado cuesta 10 CM', () => {
    // El ejemplo del manual: 40 CM y AGI 7, DES 7, POD 3; gastando 50 CM en rebajar
    // 5 puntos se llega a AGI 5, DES 5, POD 2 y a 90 CM.
    const t = calcularTecnica(
      {
        ...diseno({
          nivel: 2,
          efectos: [
            { referencia: 'Ataque A Distancia 100 metros', primario: true, reparto: { AGI: 7, DES: 7, POD: 3 } },
          ],
        }),
        reduccionKi: { AGI: 2, DES: 2, POD: 1 },
      },
      catalogo,
    );
    expect(t.cmReduccionKi).toBe(50);
    expect(t.ki).toEqual({ AGI: 5, DES: 5, POD: 2 });
    expect(t.CM).toBe(70);
  });

  it('no se pueden rebajar más de 5 puntos', () => {
    const t = calcularTecnica({ ...base(), reduccionKi: { AGI: 4, FUE: 3 } }, catalogo);
    expect(t.avisos.join(' ')).toContain('Sólo se pueden rebajar 5 puntos');
  });

  it('no se puede bajar de la mitad del coste base, redondeando hacia arriba', () => {
    // El ejemplo del manual: AGI 7, DES 7, POD 3 → el suelo es AGI 5, DES 5, POD 2.
    const t = calcularTecnica(
      {
        ...diseno({
          nivel: 2,
          efectos: [
            { referencia: 'Habilidad De Ataque +125', primario: true, reparto: { AGI: 7, DES: 7, POD: 8 } },
          ],
        }),
        reduccionKi: { POD: 5 },
      },
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('POD: no puedes bajar de 4');
  });

  it('hacen falta tres características distintas para rebajar', () => {
    const t = calcularTecnica(
      {
        ...diseno({
          nivel: 2,
          efectos: [{ referencia: 'Habilidad De Ataque +125', primario: true, reparto: { AGI: 10, FUE: 12 } }],
        }),
        reduccionKi: { AGI: 1 },
      },
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('al menos 3 características distintas');
  });

  it('descontar CM cuesta 2 puntos de Ki por cada 5', () => {
    const t = calcularTecnica({ ...base(), descuentoCM: 20 }, catalogo);
    expect(t.cmDescuento).toBe(20);
    // 70 CM − 20 = 50, y el Ki sube 8.
    expect(t.CM).toBe(50);
    expect(t.kiTotal).toBe(39 + 8);
  });

  it('el descuento tiene tope y va de cinco en cinco', () => {
    expect(calcularTecnica({ ...base(), descuentoCM: 25 }, catalogo).avisos.join(' ')).toContain(
      'descuento máximo en CM es 20',
    );
    expect(calcularTecnica({ ...base(), descuentoCM: 7 }, catalogo).avisos.join(' ')).toContain(
      'va de 5 en 5',
    );
  });
});

describe('Técnicas Sostenidas', () => {
  it('el ejemplo del manual: nivel 2, sostenimiento menor, +100 al Daño', () => {
    // 30 CM del efecto + 40 por sostenerla 5 asaltos = 70 CM.
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        sostenida: 'menor',
        efectos: [{ referencia: 'Aumento De Daño +100', primario: true, reparto: { FUE: 6, POD: 6 } }],
      }),
      catalogo,
    );
    expect(t.cmSostenida).toBe(40);
    expect(t.CM).toBe(70);
  });

  it('sólo admite Efectos de nivel inferior al suyo', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        sostenida: 'menor',
        efectos: [{ referencia: 'Habilidad De Ataque +150', primario: true, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('sólo puede usar Efectos de nivel inferior');
  });

  it('no existen en primer nivel', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        sostenida: 'menor',
        efectos: [{ referencia: 'Habilidad De Ataque +10', primario: true, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('segundo o tercer nivel');
  });

  it('no se mezclan con las Mantenidas', () => {
    const t = calcularTecnica(
      diseno({
        nivel: 2,
        mantenida: true,
        sostenida: 'mayor',
        efectos: [{ referencia: 'Aumento De Daño +50', primario: true, reparto: {} }],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('Mantenidos y Sostenidos a la vez');
  });
});

describe('desventajas', () => {
  it('el nivel limita cuántas se pueden coger', () => {
    expect(NIVELES[1].maxDesventajas).toBe(1);
    expect(NIVELES[2].maxDesventajas).toBe(2);
    expect(NIVELES[3].maxDesventajas).toBe(3);
    const t = calcularTecnica(
      diseno({
        nivel: 1,
        efectos: [{ referencia: 'Habilidad De Ataque +100', primario: true, reparto: {} }],
        desventajas: ['a', 'b'],
      }),
      catalogo,
    );
    expect(t.avisos.join(' ')).toContain('admite 1 desventaja(s) y has elegido 2');
  });
});

describe('la regla de árbol', () => {
  it('el primer nivel no pide nada', () => {
    expect(puedeCrearNivel(1, []).puede).toBe(true);
  });

  it('el segundo pide dos de primero', () => {
    expect(puedeCrearNivel(2, [1]).puede).toBe(false);
    expect(puedeCrearNivel(2, [1, 1]).puede).toBe(true);
  });

  it('el tercero pide dos de segundo, no de primero', () => {
    expect(puedeCrearNivel(3, [1, 1, 1, 1]).puede).toBe(false);
    expect(puedeCrearNivel(3, [1, 1, 2, 2]).puede).toBe(true);
  });

  it('Técnicas desvinculadas se salta el árbol', () => {
    expect(puedeCrearNivel(3, [], true).puede).toBe(true);
  });

  it('explica qué falta', () => {
    expect(puedeCrearNivel(2, []).motivo).toContain('hacen falta 2 de nivel 1');
  });
});

describe('reparto por defecto', () => {
  it('pone todo el coste en la característica natural del efecto', () => {
    const o = opcion('Habilidad De Ataque +125');
    const f = catalogo.fichas.find((x) => x.efecto === 'Habilidad de Ataque');
    expect(repartoPorDefecto(o, f, true)).toEqual({ DES: 18 });
    expect(repartoPorDefecto(o, f, false)).toEqual({ DES: 22 });
  });
});
