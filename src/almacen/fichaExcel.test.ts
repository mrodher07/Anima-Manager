import { describe, it, expect } from 'vitest';
import { deFichaComunidad, esFichaDeLaComunidad, exportarAExcel, importarDeExcel } from './fichaExcel';
import { leerLibro } from './xlsx';
import { personajeVacio, type Personaje } from '../motor/personaje';

/** Una ficha con algo en cada rincón, para que el ida y vuelta signifique algo. */
function fichaDePrueba(): Personaje {
  const p = personajeVacio('ficha-1');
  p.nombre = 'Meirmeister';
  p.jugador = 'Miguel';
  p.sexo = 'Hombre';
  p.raza = 'Jayán';
  p.categorias = [
    { categoria: 'Paladín Oscuro (RD)', nivel: 1 },
    { categoria: 'Tecnicista', nivel: 2 },
  ];
  p.caracteristicas = { AGI: 10, CON: 8, DES: 10, FUE: 10, INT: 4, PER: 5, POD: 4, VOL: 6 };
  p.pdInvertidos = { HAtaque: 60, Atletismo: 25, KiFUE: 10 };
  p.bonosEspeciales = { Atletismo: 15 };
  p.habilidadesNaturales = ['Atletismo', 'Intimidar'];
  p.bonificadorNatural = { fisica: 'Atletismo', animica: 'Estilo' };
  p.ventajas = ['Poder innato', 'Sin cansancio'];
  p.desventajas = ['Mala suerte'];
  p.legados = ['Sangre Eterna'];
  p.conjuros = ['Bola de Fuego'];
  p.poderesPsiquicos = ['Telepatía'];
  p.ki = { ...p.ki, habilidades: ['Control del Ki'], tecnicas: [{ nombre: 'Golpe', CM: 40, nivel: 1 }] };
  p.equipo = {
    armas: [{ arma: 'Espada larga', calidad: 5 }],
    armadura: [{ armadura: 'Cota de malla', calidad: 0 }],
    objetos: [
      { objeto: 'Mochila' },
      { objeto: 'Antorcha', cantidad: 4, nota: 'En el cinto' },
    ],
    dinero: { MO: 2, MP: 5, MC: 0 },
  };
  p.manuales = { puntosVida: 999 };
  p.estado = { pvActuales: 40, zeonActual: 10 };
  p.trasfondo = {
    apariencia: 'Enorme, con cicatrices',
    personalidad: 'Callado',
    historia: 'Una historia con «comillas», acentos y un & suelto',
    dinero: '120 monedas de oro',
  };
  p.notas = 'Dos\nlíneas';
  return p;
}

const abrir = (b: Uint8Array) =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('exportar a Excel', () => {
  it('produce un libro con las hojas legibles y la técnica', async () => {
    const hojas = await leerLibro(abrir(exportarAExcel(fichaDePrueba())));
    expect(hojas.map((h) => h.nombre)).toEqual([
      'Ficha',
      'Características',
      'Combate',
      'Habilidades',
      'Ventajas y poderes',
      'Equipo',
      'Trasfondo',
      'anima-manager',
    ]);
  });

  it('la hoja legible se entiende sin saber nada del formato', async () => {
    const hojas = await leerLibro(abrir(exportarAExcel(fichaDePrueba())));
    const ficha = hojas[0];
    const plano = ficha.filas.map((f) => f.map((c) => String(c ?? '')).join('|'));
    expect(plano).toContain('Nombre|Meirmeister');
    expect(plano).toContain('Raza|Jayán');
    // Multiclase: el nivel que se muestra es la suma.
    expect(plano).toContain('Nivel|3');
    expect(plano).toContain('Paladín Oscuro (RD)|1');
    expect(plano).toContain('Tecnicista|2');
  });

  it('sin ficha calculada lo dice en vez de inventarse los derivados', async () => {
    const hojas = await leerLibro(abrir(exportarAExcel(fichaDePrueba())));
    const combate = hojas.find((h) => h.nombre === 'Combate')!;
    expect(String(combate.filas[0][0])).toBe('Sin calcular');
  });
});

describe('la ida y vuelta no pierde nada', () => {
  it('devuelve exactamente la misma ficha', async () => {
    const original = fichaDePrueba();
    const r = await importarDeExcel(abrir(exportarAExcel(original)));
    expect(r.origen).toBe('datos');
    expect(r.avisos).toEqual([]);
    expect(r.personaje).toEqual(original);
  });

  it('conserva lo que las hojas legibles no muestran', async () => {
    const original = fichaDePrueba();
    const { personaje } = await importarDeExcel(abrir(exportarAExcel(original)));
    // Sobrescrituras manuales, estado de juego y PD sueltos: nada de esto está en las
    // hojas para leer, y sin embargo tiene que volver.
    expect(personaje.manuales).toEqual({ puntosVida: 999 });
    expect(personaje.estado).toEqual({ pvActuales: 40, zeonActual: 10 });
    expect(personaje.pdInvertidos).toEqual({ HAtaque: 60, Atletismo: 25, KiFUE: 10 });
    expect(personaje.bonosEspeciales).toEqual({ Atletismo: 15 });
    expect(personaje.ki.tecnicas).toEqual([{ nombre: 'Golpe', CM: 40, nivel: 1 }]);
  });

  it('aguanta acentos, comillas y saltos de línea', async () => {
    const { personaje } = await importarDeExcel(abrir(exportarAExcel(fichaDePrueba())));
    expect(personaje.trasfondo.historia).toBe('Una historia con «comillas», acentos y un & suelto');
    expect(personaje.notas).toBe('Dos\nlíneas');
  });

  it('al pedir id nuevo entra como copia y no pisa la original', async () => {
    const original = fichaDePrueba();
    const r = await importarDeExcel(abrir(exportarAExcel(original)), 'otro-id');
    expect(r.personaje.id).toBe('otro-id');
    expect(r.personaje.nombre).toBe(original.nombre);
  });
});

describe('reconstruir desde las hojas legibles', () => {
  /** Quita la hoja técnica, como si alguien hubiera rehecho el libro a mano. */
  async function sinHojaTecnica(p: Personaje) {
    const { crearLibro } = await import('./xlsx');
    const hojas = (await leerLibro(abrir(exportarAExcel(p)))).filter(
      (h) => h.nombre !== 'anima-manager',
    );
    return importarDeExcel(abrir(crearLibro(hojas)), 'reconstruida');
  }

  it('recupera la identidad, las categorías y las características', async () => {
    const r = await sinHojaTecnica(fichaDePrueba());
    expect(r.origen).toBe('hojas');
    expect(r.personaje.nombre).toBe('Meirmeister');
    expect(r.personaje.raza).toBe('Jayán');
    expect(r.personaje.sexo).toBe('Hombre');
    expect(r.personaje.categorias).toEqual([
      { categoria: 'Paladín Oscuro (RD)', nivel: 1 },
      { categoria: 'Tecnicista', nivel: 2 },
    ]);
    expect(r.personaje.caracteristicas.FUE).toBe(10);
    expect(r.personaje.caracteristicas.CON).toBe(8);
  });

  it('recupera las listas y el equipo', async () => {
    const { personaje } = await sinHojaTecnica(fichaDePrueba());
    expect(personaje.ventajas).toEqual(['Poder innato', 'Sin cansancio']);
    expect(personaje.desventajas).toEqual(['Mala suerte']);
    expect(personaje.conjuros).toEqual(['Bola de Fuego']);
    expect(personaje.equipo.armas).toEqual([{ arma: 'Espada larga', calidad: 5 }]);
    expect(personaje.pdInvertidos.HAtaque).toBe(60);
    // El inventario y la bolsa también sobreviven a la reconstrucción.
    expect(personaje.equipo.objetos).toEqual([
      { objeto: 'Mochila', cantidad: 1, nota: undefined },
      { objeto: 'Antorcha', cantidad: 4, nota: 'En el cinto' },
    ]);
    expect(personaje.equipo.dinero).toEqual({ MO: 2, MP: 5, MC: 0 });
  });

  it('avisa de que es una reconstrucción, no una copia fiel', async () => {
    const r = await sinHojaTecnica(fichaDePrueba());
    expect(r.avisos.join(' ')).toMatch(/reconstruido/);
    // Y efectivamente lo que no está en las hojas se ha perdido.
    expect(r.personaje.manuales).toEqual({});
  });

  it('un libro que no es una ficha se rechaza con un mensaje útil', async () => {
    const { crearLibro } = await import('./xlsx');
    const libro = crearLibro([{ nombre: 'Presupuesto', filas: [['Concepto', 'Euros']] }]);
    await expect(importarDeExcel(abrir(libro))).rejects.toThrow(/no hay\s+nada que importar/);
  });
});

describe('la hoja de cálculo de la comunidad', () => {
  /** Un esqueleto con las pestañas y las etiquetas que usa esa hoja. */
  function libroComunidad() {
    return [
      {
        nombre: 'Resumen',
        filas: [
          // La marca de la zona auxiliar va lejos, para que nada útil quede fuera.
          Array(40).fill(null).concat(['Zona de tablas auxiliares']),
          [],
          [null, null, null, 'Ventajas y desventajas:'],
          [null, null, null, 'Sentido del peligro, Inquietante, Obligación somática'],
          [],
          // Aquí el valor va en la misma fila que el rótulo, como en algunas versiones.
          [null, null, null, 'Habilidades de Ki:', null, null, 'Uso del Ki, Control del Ki'],
          [],
          [null, null, null, 'Habilidades esenciales:'],
          [null, null, null, 'Don, Esto no existe en ningún manual, + ...'],
        ],
      },
      {
        nombre: 'General',
        filas: [
          [],
          [],
          [],
          [null, null, null, 'Nombre:', null, 'Meirmeister'],
          [null, null, null, 'Categoría:', null, 'Paladín Oscuro (RD)', 'Nivel:', '1 + 1'],
          [],
          [null, null, null, 'Raza:', 'Jayán', 'Nephilim:'],
          [null, null, null, 'Sexo:', 'Hombre', 'Altura:'],
        ],
      },
      {
        nombre: 'Principal',
        filas: [
          [null, null, null, 'AGI', 10, null, 10],
          [null, null, null, 'CON', 8, null, 9],
          [null, null, null, 'DES', 10, null, 10],
          [null, null, null, 'FUE', 10, null, 12],
          [null, null, null, 'INT', 4, null, 4],
          [null, null, null, 'PER', 5, null, 5],
          [null, null, null, 'POD', 4, null, 4],
          [null, null, null, 'VOL', 6, null, 6],
        ],
      },
      /*
       * La pestaña PDs, con las dos tablas que trae la hoja real: la de combate —donde el
       * Ki mete dos bloques con las **mismas** siglas, distinguidos sólo por el rótulo de
       * la columna anterior— y la de secundarias. Los PD se reparten en varias columnas
       * «PDs» porque la hoja los anota por tramos de nivel.
       */
      {
        nombre: 'PDs',
        filas: [
          [],
          [null, null, 'Habilidades de Combate', 'Tipo', 'Habilidad', null, null, null, null,
           null, null, 'Coste', 'PDs', 'Coste', 'PDs'],
          [null, null, null, 'Base', 'H. Ataque', null, null, null, null, null, null, 2, 100, 2, 50],
          [null, null, null, null, 'H. Parada', null, null, null, null, null, null, 2, 110],
          [],
          [null, null, null, 'Puntos de KI', 'AGI', null, null, null, null, null, null, 1, 15],
          [null, null, null, null, 'CON', null, null, null, null, null, null, 1, 5],
          [null, null, null, 'Acumulación de KI', 'AGI', null, null, null, null, null, null, 10, 20],
          [null, null, null, 'CM', 'Conocimiento Marcial', null, null, null, null, null, null, 5, 25],
          [],
          [],
          [],
          [null, null, 'Habilidades Secundarias', 'Tipo', 'Habilidad', null, null, null, null,
           'Coste', 'PDs', 'Coste', 'PDs'],
          [null, 'Atléticas', 'Atléticas', null, 'Acrobacias', null, null, null, null, 2, 30],
          [null, 'Atléticas', null, null, 'Atletismo', null, null, null, null, 2, 20],
          [null, 'Vigor', null, null, 'P. Fuerza', null, null, null, null, 2, 40],
          [null, 'Vigor', null, null, 'Res. Dolor', null, null, null, null, 2, 10],
          [null, null, null, null, 'Perspicacia', null, null, null, null, 2, 60],
          [null, null, null, null, 'Advertir', null, null, null, null, 2, 60, 2, 60],
        ],
      },
      {
        nombre: 'Combate',
        filas: [
          Array(40).fill(null).concat(['Zona de tablas auxiliares']),
          [],
          [null, null, 'Armadura'],
          [null, null, 'Armadura', null, 'Localización', null, 'Calidad', 'FIL'],
          [null, null, 'Piezas', null, 'Completa', null, 5, 4],
          [null, null, 'Capucha de Malla', null, 'Cabeza', null, 0, 4],
          [null, null, 'Restricción Movimiento', 2],
          [],
          [null, null, '1.', 'Hacha a dos manos', null, null, null, null, '2.', 'Daga'],
          [null, null, 'A dos manos', null, 'Hacha a dos manos', null, null, null, 'A una mano'],
          [null, null, 'Conocida', null, 'Tam:', 'Enorme', null, null, 'Distinta', null, 'Tam:', 'Normal'],
        ],
      },
    ];
  }

  it('se reconoce por sus pestañas', () => {
    expect(esFichaDeLaComunidad(libroComunidad())).toBe(true);
    expect(esFichaDeLaComunidad([{ nombre: 'Hoja1', filas: [] }])).toBe(false);
  });

  it('lee la identidad buscando por etiqueta, no por dirección de celda', async () => {
    const { personaje } = await deFichaComunidad(libroComunidad(), 'x');
    expect(personaje.nombre).toBe('Meirmeister');
    expect(personaje.raza).toBe('Jayán');
    expect(personaje.sexo).toBe('Hombre');
  });

  it('del nivel «1 + 1» toma el 1: el otro es el ajuste racial', async () => {
    const { personaje } = await deFichaComunidad(libroComunidad(), 'x');
    expect(personaje.categorias).toEqual([{ categoria: 'Paladín Oscuro (RD)', nivel: 1 }]);
  });

  it('toma las características **compradas**, no las ya modificadas por la raza', async () => {
    const { personaje } = await deFichaComunidad(libroComunidad(), 'x');
    // FUE comprada 10; en la hoja el 12 de al lado es la de después del +2 de Jayán.
    expect(personaje.caracteristicas.FUE).toBe(10);
    expect(personaje.caracteristicas.CON).toBe(8);
    expect(personaje.caracteristicas.VOL).toBe(6);
  });

  it('deja claro que es una ayuda, no una conversión completa', async () => {
    const { avisos, origen } = await deFichaComunidad(libroComunidad(), 'x');
    expect(origen).toBe('comunidad');
    expect(avisos.join(' ')).toMatch(/a mano/);
  });

  /*
   * Los PD se daban por imposibles —«viven dentro de fórmulas»— y sólo se traían identidad
   * y características. Sí se pueden leer: la pestaña PDs los tiene en claro, con el nombre
   * de la habilidad al lado. Verificado contra las cuatro fichas reales que hay: en dos de
   * ellas la suma cae exactamente en 600 PD, que es el presupuesto de nivel 1.
   */
  describe('PD invertidos', () => {
    it('suma las columnas de PD de cada habilidad', async () => {
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x');
      // H. Ataque tiene dos tramos anotados, 100 y 50.
      expect(personaje.pdInvertidos.HAtaque).toBe(150);
      expect(personaje.pdInvertidos.HParada).toBe(110);
      expect(personaje.pdInvertidos.Acrobacias).toBe(30);
      expect(personaje.pdInvertidos.Atletismo).toBe(20);
      expect(personaje.pdInvertidos.Advertir).toBe(120);
    });

    it('separa los dos bloques del Ki, que se llaman igual', async () => {
      // Sin mirar el rótulo del grupo, los dos «AGI» se sumarían en una sola clave y el
      // motor no leería ninguna de las dos.
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x');
      expect(personaje.pdInvertidos.KiAGI).toBe(15);
      expect(personaje.pdInvertidos.KiCON).toBe(5);
      expect(personaje.pdInvertidos.AcumKiAGI).toBe(20);
      expect(personaje.pdInvertidos.CM).toBe(25);
    });

    it('traduce las abreviaturas de la hoja al nombre del manual', async () => {
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x');
      expect(personaje.pdInvertidos['Proezas de Fuerza']).toBe(40);
      expect(personaje.pdInvertidos['Resistencia al Dolor']).toBe(10);
    });

    it('deja fuera lo que la aplicación no calcula, y lo dice', async () => {
      // «Perspicacia» no es una secundaria del manual: alguna mesa se la inventa. Guardarla
      // no haría nada —el motor no la lee— pero sí la daría por importada.
      const { personaje, avisos } = await deFichaComunidad(libroComunidad(), 'x');
      expect(personaje.pdInvertidos.Perspicacia).toBeUndefined();
      expect(avisos.join(' ')).toMatch(/Perspicacia/);
    });

    it('avisa de que los totales no van a cuadrar todavía', async () => {
      // Es la parte honesta: la hoja suma armadura, ventajas, Naturales y bonos de raza en
      // la misma columna, y nada de eso se puede leer de ahí.
      const { avisos } = await deFichaComunidad(libroComunidad(), 'x');
      expect(avisos.join(' ')).toMatch(/no van a coincidir/);
      expect(avisos.join(' ')).toMatch(/armadura/);
    });
  });

  describe('lo que se elige de una lista', () => {
    /** Un catálogo de mentira, con lo justo para que el emparejamiento tenga contra qué. */
    const catalogo = {
      async obtener(coleccion: string) {
        const tablas: Record<string, unknown[]> = {
          ventajas: [
            { nombre: 'Sentido del peligro', esDesventaja: false },
            { nombre: 'Inquietante', esDesventaja: false },
            { nombre: 'Obligación somática', esDesventaja: true },
            { nombre: 'Apto en una materia (1)', esDesventaja: false },
          ],
          legadosSangre: [{ legado: 'Ojos del Alma' }],
          habilidadesEsenciales: [{ nombre: 'Don' }],
          conjuros: [{ conjuro: 'Crear luz' }],
          poderesPsiquicos: [{ poder: 'Telequinesis' }],
          habilidadesKi: [{ habilidad: 'Uso del Ki' }, { habilidad: 'Control del Ki' }],
          armas: [{ arma: 'Hacha a dos manos' }, { arma: 'Daga' }, { arma: 'Desarmado' }],
          armaduras: [{ armadura: 'Piezas' }],
          yelmos: [{ yelmo: 'Capucha de Malla' }],
        };
        return tablas[coleccion] ?? [];
      },
    } as unknown as Parameters<typeof deFichaComunidad>[2];

    it('separa ventajas de desventajas usando el catálogo, no el orden', async () => {
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x', catalogo);
      expect(personaje.ventajas).toEqual(['Sentido del peligro', 'Inquietante']);
      expect(personaje.desventajas).toEqual(['Obligación somática']);
    });

    it('lee la lista aunque el valor esté en la misma fila que el rótulo', async () => {
      // Unas versiones la ponen debajo y otras a la derecha; las dos tienen que valer.
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x', catalogo);
      expect(personaje.ki?.habilidades).toEqual(['Uso del Ki', 'Control del Ki']);
    });

    it('ignora el «+ …» con el que la hoja corta sus propias listas', async () => {
      const { personaje, avisos } = await deFichaComunidad(libroComunidad(), 'x', catalogo);
      expect(personaje.habilidadesEsenciales).toEqual(['Don']);
      expect(avisos.join(' ')).not.toMatch(/\+ \.\.\./);
    });

    it('lo que no está en el catálogo se dice, no se descarta en silencio', async () => {
      const { avisos } = await deFichaComunidad(libroComunidad(), 'x', catalogo);
      expect(avisos.join(' ')).toMatch(/Esto no existe en ningún manual/);
    });

    it('trae la armadura con su calidad y el yelmo como una pieza más', async () => {
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x', catalogo);
      expect(personaje.equipo.armadura).toEqual([
        { armadura: 'Piezas', calidad: 5 },
        { armadura: 'Capucha de Malla', calidad: undefined },
      ]);
    });

    it('cada arma se queda con su propio tamaño, no con el de la de al lado', async () => {
      // Los bloques van en paralelo en las mismas filas: el «Tam:» de la segunda pisaba
      // al de la primera y todo salía Normal.
      const { personaje } = await deFichaComunidad(libroComunidad(), 'x', catalogo);
      expect(personaje.equipo.armas).toEqual([
        { arma: 'Hacha a dos manos', aDosManos: true, conocimiento: 'Conocida', escala: 'Enorme' },
        { arma: 'Daga', aDosManos: undefined, conocimiento: 'Distinta', escala: 'Normal' },
      ]);
    });

    it('sin catálogo no se inventa nada, y lo avisa', async () => {
      const { personaje, avisos } = await deFichaComunidad(libroComunidad(), 'x');
      expect(personaje.ventajas).toEqual([]);
      expect(personaje.equipo.armas).toEqual([]);
      expect(avisos.join(' ')).toMatch(/no había catálogo/);
    });
  });

  it('si falta una etiqueta lo dice en vez de callarse', async () => {
    const libro = libroComunidad().filter((h) => h.nombre !== 'General');
    libro.push({ nombre: 'General', filas: [[]] });
    const { avisos } = await deFichaComunidad(libro, 'x');
    expect(avisos.join(' ')).toMatch(/nombre/i);
    expect(avisos.join(' ')).toMatch(/categoría/i);
  });
});
