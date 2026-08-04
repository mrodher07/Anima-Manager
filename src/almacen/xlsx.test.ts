import { describe, it, expect } from 'vitest';
import { columnaDe, crc32, crearLibro, escaparXml, escribirZip, leerLibro, letraDe } from './xlsx';

const utf8 = (s: string) => new TextEncoder().encode(s);

describe('las piezas del formato', () => {
  it('el CRC32 coincide con los valores conocidos', () => {
    const b = (s: string) => new TextEncoder().encode(s);
    expect(crc32(b(''))).toBe(0);
    expect(crc32(b('a'))).toBe(0xe8b7be43);
    // El caso de prueba clásico del estándar.
    expect(crc32(b('123456789'))).toBe(0xcbf43926);
  });

  it('traduce referencias de columna en los dos sentidos', () => {
    expect(columnaDe('A1')).toBe(0);
    expect(columnaDe('B2')).toBe(1);
    expect(columnaDe('Z10')).toBe(25);
    expect(columnaDe('AA1')).toBe(26);
    expect(columnaDe('AZ1')).toBe(51);
    expect(columnaDe('BA1')).toBe(52);
    for (const n of [0, 1, 25, 26, 27, 51, 52, 701, 702, 16383]) {
      expect(columnaDe(`${letraDe(n)}1`)).toBe(n);
    }
  });

  it('escapa lo que rompería el XML', () => {
    expect(escaparXml('a < b & c > d "e"')).toBe('a &lt; b &amp; c &gt; d &quot;e&quot;');
    // Excel rechaza los caracteres de control, así que se quitan.
    expect(escaparXml('holamundo')).toBe('holamundo');
    // El salto de línea sí es válido dentro de una celda.
    expect(escaparXml('dos\nlíneas')).toBe('dos\nlíneas');
  });
});

const abrir = async (bytes: Uint8Array) =>
  leerLibro(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

describe('escribir y volver a leer un libro', () => {

  it('conserva las hojas, su orden y sus nombres', async () => {
    const libro = crearLibro([
      { nombre: 'Primera', filas: [['a']] },
      { nombre: 'Segunda', filas: [['b']] },
      { nombre: 'Tercera', filas: [['c']] },
    ]);
    const leido = await abrir(libro);
    expect(leido.map((h) => h.nombre)).toEqual(['Primera', 'Segunda', 'Tercera']);
  });

  it('distingue números de texto', async () => {
    const libro = crearLibro([{ nombre: 'H', filas: [['texto', 42, -3.5, '007']] }]);
    const [h] = await abrir(libro);
    expect(h.filas[0][0]).toBe('texto');
    expect(h.filas[0][1]).toBe(42);
    expect(h.filas[0][2]).toBe(-3.5);
    // «007» se escribió como texto, así que vuelve como texto y no como el número 7.
    expect(h.filas[0][3]).toBe('007');
  });

  it('conserva acentos, comillas y saltos de línea', async () => {
    const raro = 'Señor de las Puertas «Tawil At-U\'mr»\ncon salto & ampersand <etiqueta>';
    const libro = crearLibro([{ nombre: 'H', filas: [[raro]] }]);
    const [h] = await abrir(libro);
    expect(h.filas[0][0]).toBe(raro);
  });

  it('respeta los huecos: una celda vacía no corre a las de al lado', async () => {
    const libro = crearLibro([{ nombre: 'H', filas: [['a', null, 'c', '', 'e']] }]);
    const [h] = await abrir(libro);
    expect(h.filas[0][0]).toBe('a');
    expect(h.filas[0][2]).toBe('c');
    expect(h.filas[0][4]).toBe('e');
  });

  it('respeta las filas vacías', async () => {
    const libro = crearLibro([{ nombre: 'H', filas: [['a'], [], [], ['d']] }]);
    const [h] = await abrir(libro);
    expect(h.filas).toHaveLength(4);
    expect(h.filas[0][0]).toBe('a');
    expect(h.filas[3][0]).toBe('d');
  });

  it('aguanta un texto largo sin partirse', async () => {
    const largo = 'á'.repeat(20000);
    const libro = crearLibro([{ nombre: 'H', filas: [[largo]] }]);
    const [h] = await abrir(libro);
    expect(h.filas[0][0]).toBe(largo);
  });

  it('recorta el nombre de hoja al máximo que admite Excel', async () => {
    const libro = crearLibro([{ nombre: 'x'.repeat(40), filas: [['a']] }]);
    const [h] = await abrir(libro);
    expect(h.nombre).toHaveLength(31);
  });

  it('un libro sin hojas no tiene sentido', () => {
    expect(() => crearLibro([])).toThrow();
  });

  it('una celda vacía autocerrada no descoloca la fila', async () => {
    // Excel escribe las celdas vacías como `<c r="A1" s="9"/>`. Esta aplicación no las
    // escribe nunca, así que hay que fabricar la hoja a mano para probar el caso: fue un
    // fallo real —la forma autocerrada casaba con `<c ...>` y el `</c>` que encontraba era
    // el de una celda muy posterior, tragándose todas las de en medio— y con él la ficha
    // de la comunidad se leía con las columnas corridas.
    const hoja =
      '<?xml version="1.0"?><worksheet><sheetData><row r="1">' +
      '<c r="A1" s="9"/><c r="B1" s="1"><v>7</v></c><c r="C1" s="2"/>' +
      '<c r="D1" t="s"><v>0</v></c><c r="E1" s="3"/>' +
      '<c r="F1" t="str"><f>IF(1,"x")</f><v>calculado</v></c>' +
      '</row></sheetData></worksheet>';
    const bytes = escribirZip([
      { nombre: 'xl/workbook.xml', datos: utf8('<workbook xmlns:r="x"><sheets><sheet name="H" r:id="rId1"/></sheets></workbook>') },
      { nombre: 'xl/_rels/workbook.xml.rels', datos: utf8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
      { nombre: 'xl/sharedStrings.xml', datos: utf8('<sst><si><t>compartido</t></si></sst>') },
      { nombre: 'xl/worksheets/sheet1.xml', datos: utf8(hoja) },
    ]);
    const [h] = await abrir(bytes);
    expect(h.filas[0][1]).toBe(7);
    expect(h.filas[0][3]).toBe('compartido');
    // El resultado cacheado de la fórmula, no la fórmula.
    expect(h.filas[0][5]).toBe('calculado');
  });

  it('lo que no es un ZIP se rechaza con un mensaje claro', async () => {
    const basura = new TextEncoder().encode('esto no es un xlsx');
    await expect(
      leerLibro(basura.buffer.slice(0, basura.byteLength) as ArrayBuffer),
    ).rejects.toThrow(/ZIP/);
  });
});

/**
 * Leer una ficha de Excel de verdad.
 *
 * El formato que escribe esta aplicación es el más sencillo posible; el que escribe Excel
 * no lo es: comprime con deflate, usa la tabla de textos compartidos y guarda el valor de
 * cada fórmula junto a la fórmula. Sin comprobarlo contra un archivo real, «lee .xlsx» no
 * significa gran cosa.
 *
 * Las fichas de la comunidad no viven en el repositorio —pesan megas y no son mías—, así
 * que la prueba se salta sola si no están. Apunta a una con:
 *
 *     FICHAS_XLSM=/ruta/a/Meirmeister.xlsm npm test
 */
const rutaFicha = process.env.FICHAS_XLSM;
describe.runIf(rutaFicha)('leer una ficha .xlsm hecha con Excel', () => {
  it('abre el libro y encuentra sus hojas', async () => {
    const { readFileSync } = await import('node:fs');
    const b = readFileSync(rutaFicha!);
    const hojas = await leerLibro(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
    );
    expect(hojas.length).toBeGreaterThan(1);
    // Una ficha de Anima tiene, como poco, una hoja con datos.
    const conDatos = hojas.filter((h) => h.filas.length > 5);
    expect(conDatos.length).toBeGreaterThan(0);
  });

  it('lee el resultado cacheado de las celdas con fórmula, no la fórmula', async () => {
    const { readFileSync } = await import('node:fs');
    const b = readFileSync(rutaFicha!);
    const hojas = await leerLibro(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
    );
    const celdas = hojas.flatMap((h) => h.filas.flat());
    // Si estuviéramos leyendo fórmulas en vez de valores, esto vendría lleno de «=…».
    const formulas = celdas.filter((c) => typeof c === 'string' && c.startsWith('='));
    expect(formulas).toEqual([]);
    expect(celdas.filter((c) => typeof c === 'number').length).toBeGreaterThan(50);
  });
});
