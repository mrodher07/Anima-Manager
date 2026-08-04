/**
 * Leer y escribir .xlsx sin dependencias.
 *
 * Un .xlsx es un ZIP con XML dentro. Hacerlo a mano en vez de traer una librería no es
 * cabezonería: la aplicación entera tiene dos dependencias (React y React-DOM), y meter un
 * paquete de miles de líneas para escribir cuatro ficheros XML significa que el navegador
 * del máster ejecuta código de terceros cada vez que alguien abre una ficha. Es el mismo
 * criterio que llevó a escribir el evaluador de fórmulas en lugar de usar `eval`.
 *
 * Lo que hace falta es poco:
 *  - Escribir: ZIP sin comprimir (sólo hay que calcular el CRC32) y XML con cadenas en
 *    línea, que evita la tabla de textos compartidos.
 *  - Leer: descomprimir con `DecompressionStream`, que es una API del navegador y de Node,
 *    y recorrer el XML con un escáner pequeño. El XML de una hoja lo genera siempre un
 *    programa, así que es regular y no hace falta un parser completo.
 *
 * No pretende cubrir el formato entero: ni estilos, ni gráficos, ni fórmulas. Al leer una
 * hoja ajena se toma el **valor cacheado** de cada celda, que es lo que Excel guarda junto
 * a la fórmula, y por eso se pueden leer las fichas de la comunidad.
 */

export type Celda = string | number | null | undefined;

export interface Hoja {
  nombre: string;
  filas: Celda[][];
}

// ─────────────────────────── ZIP ───────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface EntradaZip {
  nombre: string;
  datos: Uint8Array;
}

/** ZIP con entradas sin comprimir. Basta: los XML de una ficha ocupan unos kilobytes. */
export function escribirZip(entradas: EntradaZip[]): Uint8Array {
  const cabeceras: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const e of entradas) {
    const nombre = new TextEncoder().encode(e.nombre);
    const suma = crc32(e.datos);

    const local = new Uint8Array(30 + nombre.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true); // versión necesaria
    vl.setUint16(6, 0, true); // banderas
    vl.setUint16(8, 0, true); // método: 0 = almacenado
    vl.setUint16(10, 0, true); // hora
    vl.setUint16(12, 0x21, true); // fecha: 1 de enero de 1980, la mínima válida
    vl.setUint32(14, suma, true);
    vl.setUint32(18, e.datos.length, true);
    vl.setUint32(22, e.datos.length, true);
    vl.setUint16(26, nombre.length, true);
    vl.setUint16(28, 0, true);
    local.set(nombre, 30);

    const dir = new Uint8Array(46 + nombre.length);
    const vd = new DataView(dir.buffer);
    vd.setUint32(0, 0x02014b50, true);
    vd.setUint16(4, 20, true);
    vd.setUint16(6, 20, true);
    vd.setUint16(8, 0, true);
    vd.setUint16(10, 0, true);
    vd.setUint16(12, 0, true);
    vd.setUint16(14, 0x21, true);
    vd.setUint32(16, suma, true);
    vd.setUint32(20, e.datos.length, true);
    vd.setUint32(24, e.datos.length, true);
    vd.setUint16(28, nombre.length, true);
    vd.setUint32(42, desplazamiento, true);
    dir.set(nombre, 46);

    cabeceras.push(local, e.datos);
    central.push(dir);
    desplazamiento += local.length + e.datos.length;
  }

  const tamanoCentral = central.reduce((t, c) => t + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, entradas.length, true);
  vf.setUint16(10, entradas.length, true);
  vf.setUint32(12, tamanoCentral, true);
  vf.setUint32(16, desplazamiento, true);

  const trozos = [...cabeceras, ...central, fin];
  const total = trozos.reduce((t, c) => t + c.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) {
    salida.set(t, i);
    i += t.length;
  }
  return salida;
}

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

export async function leerZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const datos = new Uint8Array(buffer);
  const v = new DataView(buffer);

  // El final del directorio central lleva un comentario opcional al final, así que hay
  // que buscar su firma hacia atrás en vez de asumir que está en los últimos 22 bytes.
  let fin = -1;
  for (let i = datos.length - 22; i >= 0 && i >= datos.length - 22 - 65535; i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new ErrorExcel('El archivo no es un ZIP válido, así que tampoco un .xlsx.');

  const cuantas = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const salida = new Map<string, Uint8Array>();

  for (let n = 0; n < cuantas; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComentario = v.getUint16(p + 32, true);
    const inicioLocal = v.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(datos.subarray(p + 46, p + 46 + largoNombre));

    // La cabecera local repite el nombre y los extras, y sus longitudes pueden no coincidir
    // con las del directorio, así que hay que releerlas ahí.
    const nombreLocal = v.getUint16(inicioLocal + 26, true);
    const extraLocal = v.getUint16(inicioLocal + 28, true);
    const inicio = inicioLocal + 30 + nombreLocal + extraLocal;
    const crudo = datos.subarray(inicio, inicio + comprimido);

    if (metodo === 0) salida.set(nombre, crudo);
    else if (metodo === 8) salida.set(nombre, await inflar(crudo));
    // Cualquier otro método (bzip2, lzma…) no lo usa Excel; se ignora la entrada.

    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return salida;
}

export class ErrorExcel extends Error {}

// ─────────────────────────── XML ───────────────────────────

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel rechaza los caracteres de control; se quitan en vez de romper el archivo.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

/** «C7» → columna 2 (base 0). Las columnas van A…Z, AA…AZ, BA… */
export function columnaDe(referencia: string): number {
  const letras = /^([A-Z]+)/.exec(referencia)?.[1] ?? 'A';
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 → «A», 26 → «AA». */
export function letraDe(columna: number): string {
  let n = columna + 1;
  let s = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - resto) / 26);
  }
  return s;
}

function hojaXml(filas: Celda[][]): string {
  const cuerpo = filas
    .map((fila, f) => {
      const celdas = fila
        .map((valor, c) => {
          if (valor === null || valor === undefined || valor === '') return '';
          const ref = `${letraDe(c)}${f + 1}`;
          if (typeof valor === 'number' && Number.isFinite(valor)) {
            return `<c r="${ref}"><v>${valor}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(
            String(valor),
          )}</t></is></c>`;
        })
        .join('');
      return celdas ? `<row r="${f + 1}">${celdas}</row>` : '';
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${cuerpo}</sheetData></worksheet>`
  );
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Construye el .xlsx. El orden de las hojas es el de la lista. */
export function crearLibro(hojas: Hoja[]): Uint8Array {
  if (hojas.length === 0) throw new ErrorExcel('Un libro necesita al menos una hoja.');

  const entradas: EntradaZip[] = [
    {
      nombre: '[Content_Types].xml',
      datos: utf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          hojas
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join('') +
          '</Types>',
      ),
    },
    {
      nombre: '_rels/.rels',
      datos: utf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      ),
    },
    {
      nombre: 'xl/workbook.xml',
      datos: utf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          hojas
            .map(
              (h, i) =>
                `<sheet name="${escaparXml(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
            )
            .join('') +
          '</sheets></workbook>',
      ),
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      datos: utf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          hojas
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join('') +
          '</Relationships>',
      ),
    },
    ...hojas.map((h, i) => ({
      nombre: `xl/worksheets/sheet${i + 1}.xml`,
      datos: utf8(hojaXml(h.filas)),
    })),
  ];

  return escribirZip(entradas);
}

// ─────────────────────────── Lectura ───────────────────────────

/** Textos compartidos: es como Excel guarda las cadenas repetidas. */
function leerTextosCompartidos(xml: string): string[] {
  const textos: string[] = [];
  for (const si of xml.match(/<si\b[^>]*>[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? []) {
    // Un <si> puede partirse en varios <t> si el texto lleva formato mezclado.
    const trozos = [...si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1]));
    textos.push(trozos.join(''));
  }
  return textos;
}

function leerHoja(xml: string, compartidos: string[]): Celda[][] {
  const filas: Celda[][] = [];
  for (const fila of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const numero = Number(/\br="(\d+)"/.exec(fila)?.[1] ?? filas.length + 1);
    const celdas: Celda[] = [];
    // Una celda vacía se escribe autocerrada, `<c r="A3" s="9"/>`, y hay que reconocerla
    // **antes** de probar la forma con contenido: si no, `<c ...>` casa también con ella y
    // el `</c>` que encuentra es el de una celda muy posterior, que se traga por el camino
    // todas las de en medio y descoloca la fila entera.
    for (const m of fila.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = m[1] ?? '';
      const contenido = m[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(atributos)?.[1];
      const columna = ref ? columnaDe(ref) : celdas.length;
      const tipo = /\bt="([^"]+)"/.exec(atributos)?.[1];

      let valor: Celda = null;
      if (tipo === 'inlineStr') {
        valor = [...contenido.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((t) => desescapar(t[1]))
          .join('');
      } else {
        // <v> es el valor. En una celda con fórmula es el resultado cacheado que guardó
        // Excel la última vez que recalculó, y es justo lo que hace falta para leer las
        // fichas de la comunidad sin evaluar una sola fórmula.
        const bruto = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(contenido)?.[1];
        if (bruto === undefined) valor = null;
        else if (tipo === 's') valor = compartidos[Number(bruto)] ?? null;
        else if (tipo === 'str' || tipo === 'e') valor = desescapar(bruto);
        else if (tipo === 'b') valor = bruto === '1' ? 'VERDADERO' : 'FALSO';
        else {
          const n = Number(bruto);
          valor = Number.isFinite(n) ? n : desescapar(bruto);
        }
      }
      celdas[columna] = valor;
    }
    filas[numero - 1] = celdas;
  }
  // Las filas vacías quedan como huecos del array; se rellenan para poder recorrerlo.
  for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
  return filas;
}

/** Nombres de hoja en el orden del libro, emparejados con su fichero. */
function relacionarHojas(workbook: string, rels: string): { nombre: string; destino: string }[] {
  const porId = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const destino = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && destino) porId.set(id, destino);
  }
  const hojas: { nombre: string; destino: string }[] = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const nombre = desescapar(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? '');
    const id = /\br:id="([^"]+)"/.exec(m[1])?.[1];
    const destino = id ? porId.get(id) : undefined;
    if (destino) hojas.push({ nombre, destino });
  }
  return hojas;
}

/** Abre un .xlsx (o .xlsm: es el mismo formato con macros) y devuelve sus hojas. */
export async function leerLibro(buffer: ArrayBuffer): Promise<Hoja[]> {
  const ficheros = await leerZip(buffer);
  const texto = (ruta: string) => {
    const d = ficheros.get(ruta);
    return d ? new TextDecoder().decode(d) : '';
  };

  const workbook = texto('xl/workbook.xml');
  if (!workbook) throw new ErrorExcel('El archivo no parece un libro de Excel.');

  const compartidos = leerTextosCompartidos(texto('xl/sharedStrings.xml'));
  const relacionadas = relacionarHojas(workbook, texto('xl/_rels/workbook.xml.rels'));

  return relacionadas.map(({ nombre, destino }) => {
    const ruta = destino.startsWith('/')
      ? destino.slice(1)
      : `xl/${destino.replace(/^\.\//, '')}`;
    return { nombre, filas: leerHoja(texto(ruta), compartidos) };
  });
}
