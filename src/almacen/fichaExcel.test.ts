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
      { nombre: 'Resumen', filas: [[]] },
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
      { nombre: 'PDs', filas: [[]] },
      { nombre: 'Combate', filas: [[]] },
    ];
  }

  it('se reconoce por sus pestañas', () => {
    expect(esFichaDeLaComunidad(libroComunidad())).toBe(true);
    expect(esFichaDeLaComunidad([{ nombre: 'Hoja1', filas: [] }])).toBe(false);
  });

  it('lee la identidad buscando por etiqueta, no por dirección de celda', () => {
    const { personaje } = deFichaComunidad(libroComunidad(), 'x');
    expect(personaje.nombre).toBe('Meirmeister');
    expect(personaje.raza).toBe('Jayán');
    expect(personaje.sexo).toBe('Hombre');
  });

  it('del nivel «1 + 1» toma el 1: el otro es el ajuste racial', () => {
    const { personaje } = deFichaComunidad(libroComunidad(), 'x');
    expect(personaje.categorias).toEqual([{ categoria: 'Paladín Oscuro (RD)', nivel: 1 }]);
  });

  it('toma las características **compradas**, no las ya modificadas por la raza', () => {
    const { personaje } = deFichaComunidad(libroComunidad(), 'x');
    // FUE comprada 10; en la hoja el 12 de al lado es la de después del +2 de Jayán.
    expect(personaje.caracteristicas.FUE).toBe(10);
    expect(personaje.caracteristicas.CON).toBe(8);
    expect(personaje.caracteristicas.VOL).toBe(6);
  });

  it('deja claro que es una ayuda, no una conversión completa', () => {
    const { avisos, origen } = deFichaComunidad(libroComunidad(), 'x');
    expect(origen).toBe('comunidad');
    expect(avisos.join(' ')).toMatch(/a mano/);
  });

  it('si falta una etiqueta lo dice en vez de callarse', () => {
    const libro = libroComunidad().filter((h) => h.nombre !== 'General');
    libro.push({ nombre: 'General', filas: [[]] });
    const { avisos } = deFichaComunidad(libro, 'x');
    expect(avisos.join(' ')).toMatch(/nombre/i);
    expect(avisos.join(' ')).toMatch(/categoría/i);
  });
});
