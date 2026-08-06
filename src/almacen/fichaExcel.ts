/**
 * Exportar e importar una ficha en Excel.
 *
 * El libro que sale tiene dos naturalezas a la vez, y es a propósito:
 *
 *  - Unas hojas **para leer**: identidad, características, combate, habilidades, equipo,
 *    poderes y trasfondo, con los valores ya calculados. Es lo que un jugador imprime o
 *    manda por correo, y se puede editar a mano sin conocer nada del formato.
 *  - Una hoja **para la aplicación**, llamada `anima-manager`, con la ficha entera en JSON.
 *    Al reimportar se lee esa y no se pierde absolutamente nada: ni los PD invertidos, ni
 *    los bonos especiales, ni las sobrescrituras manuales.
 *
 * Si el libro no trae esa hoja —porque viene de otro sitio, o porque alguien lo rehízo—
 * se leen las hojas legibles y se reconstruye lo que se pueda, avisando de lo que no.
 * Es el mismo criterio de siempre: la aplicación avisa, no bloquea.
 */

import { crearLibro, leerLibro, ErrorExcel, type Celda, type Hoja } from './xlsx';
import {
  bolsaDe,
  eleccionesDe,
  fichaCivilDe,
  trasfondoDe,
} from './fichaComunidad';
import type { Catalogo } from '../datos/paquetes';
import {
  CARACTERISTICAS,
  SECUNDARIAS,
  personajeVacio,
  migrarPersonaje,
  type Caracteristica,
  type FichaCalculada,
  type Personaje,
} from '../motor/personaje';

export const HOJA_DATOS = 'anima-manager';
/** Excel no admite más de 32.767 caracteres por celda, así que el JSON se parte. */
const TROZO = 30000;

const texto = (c: Celda): string => (c === null || c === undefined ? '' : String(c));
const numero = (c: Celda): number => {
  if (typeof c === 'number') return c;
  const n = Number(String(c ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Las hojas legibles. `ficha` es opcional: sin ella se exportan sólo los valores crudos. */
function hojasLegibles(p: Personaje, ficha?: FichaCalculada | null): Hoja[] {
  const identidad: Celda[][] = [
    ['Anima Beyond Fantasy — Ficha de personaje'],
    [],
    ['Nombre', p.nombre],
    ['Jugador', p.jugador ?? ''],
    ['Sexo', p.sexo ?? ''],
    ['Raza', p.raza],
    ['Nivel', p.categorias.reduce((t, c) => t + c.nivel, 0)],
    [],
    ['Categorías'],
    ['Categoría', 'Niveles'],
    ...p.categorias.map((c): Celda[] => [c.categoria, c.nivel]),
  ];

  const caracteristicas: Celda[][] = [
    ['Característica', 'Comprada', 'Final'],
    ...CARACTERISTICAS.map((c): Celda[] => [
      c,
      p.caracteristicas[c] ?? 0,
      ficha?.caracteristicas?.[c]?.total ?? '',
    ]),
  ];

  const combate: Celda[][] = ficha
    ? [
        ['Valor', 'Final'],
        ['Puntos de Vida', ficha.puntosVida.valor],
        ['Cansancio', ficha.cansancio.valor],
        ['Turno natural', ficha.combate.turnoNatural.valor],
        ['Habilidad de Ataque', ficha.combate.HAtaque.valor],
        ['Habilidad de Parada', ficha.combate.HParada.valor],
        ['Habilidad de Esquiva', ficha.combate.HEsquiva.valor],
        ['Llevar Armadura', ficha.combate.llevarArmadura.valor],
        ['Presencia', ficha.presencia.valor],
        ['Zeon', ficha.zeon.valor],
        ['ACT', ficha.act.valor],
        [],
        ['Resistencia', 'Final'],
        ...Object.entries(ficha.resistencias).map(([k, v]): Celda[] => [k, v.valor]),
      ]
    : [['Sin calcular'], ['La ficha se exportó sin sus valores derivados.']];

  const habilidades: Celda[][] = [
    ['Habilidad', 'PD invertidos', 'Bono especial'],
    ...Object.keys({ ...p.pdInvertidos, ...p.bonosEspeciales })
      .sort()
      .map((k): Celda[] => [k, p.pdInvertidos[k] ?? 0, p.bonosEspeciales[k] ?? 0]),
    [],
    ['Habilidades Naturales'],
    ...p.habilidadesNaturales.map((h): Celda[] => [h]),
    [],
    ['Bonificador Natural'],
    ['Física', p.bonificadorNatural?.fisica ?? ''],
    ['Anímica', p.bonificadorNatural?.animica ?? ''],
  ];

  const listas: Celda[][] = [
    ['Ventajas'],
    ...p.ventajas.map((v): Celda[] => [v]),
    [],
    ['Desventajas'],
    ...p.desventajas.map((v): Celda[] => [v]),
    [],
    ['Legados de Sangre'],
    ...(p.legados ?? []).map((v): Celda[] => [v]),
    [],
    ['Conjuros'],
    ...p.conjuros.map((v): Celda[] => [v]),
    [],
    ['Poderes psíquicos'],
    ...p.poderesPsiquicos.map((v): Celda[] => [v]),
    [],
    ['Habilidades del Ki'],
    ...(p.ki?.habilidades ?? []).map((v): Celda[] => [v]),
    [],
    ['Técnicas'],
    ['Técnica', 'CM', 'Nivel'],
    ...(p.ki?.tecnicas ?? []).map((t): Celda[] => [t.nombre, t.CM, t.nivel ?? '']),
  ];

  const equipo: Celda[][] = [
    ['Armas'],
    ['Arma', 'Calidad'],
    ...p.equipo.armas.map((a): Celda[] => [a.arma, a.calidad ?? 0]),
    [],
    ['Armadura'],
    ['Pieza', 'Calidad'],
    ...p.equipo.armadura.map((a): Celda[] => [a.armadura, a.calidad ?? 0]),
    [],
    ['Inventario'],
    ['Objeto', 'Cantidad', 'Peso', 'Coste', 'Nota'],
    ...(p.equipo.objetos ?? []).map((o, i): Celda[] => {
      const linea = ficha?.inventario?.lineas?.[i];
      return [o.objeto, o.cantidad ?? 1, linea?.peso ?? '', linea?.coste ?? '', o.nota ?? ''];
    }),
    [],
    ['Bolsa'],
    ['Monedas de oro', p.equipo.dinero?.MO ?? 0],
    ['Monedas de plata', p.equipo.dinero?.MP ?? 0],
    ['Monedas de cobre', p.equipo.dinero?.MC ?? 0],
    [],
    ['Dinero', p.trasfondo?.dinero ?? ''],
    ['Otro equipo', p.trasfondo?.equipoLibre ?? ''],
  ];

  const trasfondo: Celda[][] = [
    ['Apartado', 'Texto'],
    ['Apariencia', p.trasfondo?.apariencia ?? ''],
    ['Personalidad', p.trasfondo?.personalidad ?? ''],
    ['Motivación', p.trasfondo?.motivacion ?? ''],
    ['Historia', p.trasfondo?.historia ?? ''],
    ['Particularidades', p.trasfondo?.particularidades ?? ''],
    ['Contactos', p.trasfondo?.contactos ?? ''],
    ['Notas', p.notas ?? ''],
  ];

  return [
    { nombre: 'Ficha', filas: identidad },
    { nombre: 'Características', filas: caracteristicas },
    { nombre: 'Combate', filas: combate },
    { nombre: 'Habilidades', filas: habilidades },
    { nombre: 'Ventajas y poderes', filas: listas },
    { nombre: 'Equipo', filas: equipo },
    { nombre: 'Trasfondo', filas: trasfondo },
  ];
}

/** La hoja técnica: la ficha entera en JSON, partida en trozos que quepan en una celda. */
function hojaDatos(p: Personaje): Hoja {
  const json = JSON.stringify(p);
  const trozos: Celda[][] = [];
  for (let i = 0; i < json.length; i += TROZO) trozos.push([json.slice(i, i + TROZO)]);
  return {
    nombre: HOJA_DATOS,
    filas: [
      ['No toques esta hoja: es la ficha completa que lee Anima Manager al reimportar.'],
      ['formato', 'anima-manager'],
      ['version', 1],
      ['json'],
      ...trozos,
    ],
  };
}

export function exportarAExcel(p: Personaje, ficha?: FichaCalculada | null): Uint8Array {
  return crearLibro([...hojasLegibles(p, ficha), hojaDatos(p)]);
}

export interface ResultadoImportacion {
  personaje: Personaje;
  /** De dónde salió: la hoja técnica es fiel; las legibles son una reconstrucción. */
  origen: 'datos' | 'hojas' | 'comunidad';
  /** Lo que no se ha podido recuperar. Vacío cuando viene de la hoja técnica. */
  avisos: string[];
}

function buscarHoja(hojas: Hoja[], nombre: string): Hoja | undefined {
  const n = nombre.toLowerCase();
  return hojas.find((h) => h.nombre.toLowerCase() === n);
}

/** Busca una fila cuya primera celda sea la etiqueta y devuelve la segunda. */
function valorDe(hoja: Hoja | undefined, etiqueta: string): string {
  if (!hoja) return '';
  const e = etiqueta.toLowerCase();
  const fila = hoja.filas.find((f) => texto(f?.[0]).toLowerCase() === e);
  return texto(fila?.[1]);
}

/** Filas bajo un encabezado, hasta la primera fila vacía. */
function bloque(hoja: Hoja | undefined, encabezado: string, columna = 0): Celda[][] {
  if (!hoja) return [];
  const e = encabezado.toLowerCase();
  const i = hoja.filas.findIndex((f) => texto(f?.[0]).toLowerCase() === e);
  if (i < 0) return [];
  const salida: Celda[][] = [];
  for (let j = i + 1; j < hoja.filas.length; j++) {
    const fila = hoja.filas[j] ?? [];
    if (texto(fila[columna]).trim() === '') break;
    salida.push(fila);
  }
  return salida;
}

/**
 * Reconstruye lo que se pueda de las hojas legibles.
 *
 * No intenta adivinar: recupera lo que está escrito con una etiqueta clara y deja el resto
 * en los valores por defecto, anotando en los avisos qué se ha quedado fuera. Los valores
 * derivados —PV, turno, resistencias— no se leen a propósito: los recalcula la aplicación,
 * y copiarlos de la hoja daría una ficha que no cuadra con sus propios datos.
 */
function deHojasLegibles(hojas: Hoja[], id: string): ResultadoImportacion {
  const avisos: string[] = [];
  const p = personajeVacio(id);

  const ficha = buscarHoja(hojas, 'Ficha');
  if (!ficha) {
    throw new ErrorExcel(
      'El libro no trae ni la hoja «anima-manager» ni una hoja «Ficha», así que no hay ' +
        'nada que importar. Si es una ficha de otro programa, exporta primero a JSON.',
    );
  }

  p.nombre = valorDe(ficha, 'Nombre') || 'Sin nombre';
  p.jugador = valorDe(ficha, 'Jugador') || undefined;
  const sexo = valorDe(ficha, 'Sexo');
  if (sexo === 'Hombre' || sexo === 'Mujer') p.sexo = sexo;
  p.raza = valorDe(ficha, 'Raza') || p.raza;

  const categorias = bloque(ficha, 'Categoría')
    .map((f) => ({ categoria: texto(f[0]), nivel: numero(f[1]) }))
    .filter((c) => c.categoria);
  if (categorias.length > 0) p.categorias = categorias;
  else avisos.push('No he encontrado la tabla de categorías; se queda la de por defecto.');

  const hojaCar = buscarHoja(hojas, 'Características');
  if (hojaCar) {
    for (const fila of hojaCar.filas) {
      const nombre = texto(fila?.[0]) as Caracteristica;
      if (CARACTERISTICAS.includes(nombre)) p.caracteristicas[nombre] = numero(fila[1]);
    }
  } else {
    avisos.push('No hay hoja de características; se quedan todas en su valor por defecto.');
  }

  const hojaHab = buscarHoja(hojas, 'Habilidades');
  if (hojaHab) {
    for (const fila of bloque(hojaHab, 'Habilidad')) {
      const clave = texto(fila[0]);
      if (!clave) continue;
      const pd = numero(fila[1]);
      const esp = numero(fila[2]);
      if (pd) p.pdInvertidos[clave] = pd;
      if (esp) p.bonosEspeciales[clave] = esp;
    }
    p.habilidadesNaturales = bloque(hojaHab, 'Habilidades Naturales')
      .map((f) => texto(f[0]))
      .filter(Boolean);
    p.bonificadorNatural = {
      fisica: valorDe(hojaHab, 'Física') || undefined,
      animica: valorDe(hojaHab, 'Anímica') || undefined,
    };
  }

  const hojaListas = buscarHoja(hojas, 'Ventajas y poderes');
  const lista = (encabezado: string) =>
    bloque(hojaListas, encabezado)
      .map((f) => texto(f[0]))
      .filter(Boolean);
  if (hojaListas) {
    p.ventajas = lista('Ventajas');
    p.desventajas = lista('Desventajas');
    p.legados = lista('Legados de Sangre');
    p.conjuros = lista('Conjuros');
    p.poderesPsiquicos = lista('Poderes psíquicos');
    p.ki = {
      ...p.ki,
      habilidades: lista('Habilidades del Ki'),
      tecnicas: bloque(hojaListas, 'Técnica')
        .map((f) => ({ nombre: texto(f[0]), CM: numero(f[1]), nivel: numero(f[2]) || undefined }))
        .filter((t) => t.nombre),
    };
  }

  const hojaEquipo = buscarHoja(hojas, 'Equipo');
  if (hojaEquipo) {
    p.equipo.armas = bloque(hojaEquipo, 'Arma')
      .map((f) => ({ arma: texto(f[0]), calidad: numero(f[1]) }))
      .filter((a) => a.arma);
    p.equipo.armadura = bloque(hojaEquipo, 'Pieza')
      .map((f) => ({ armadura: texto(f[0]), calidad: numero(f[1]) }))
      .filter((a) => a.armadura);
    // El peso y el coste no se leen: salen del catálogo, así que traerlos de la hoja sólo
    // serviría para que se contradijeran si alguien los tocó a mano.
    const objetos = bloque(hojaEquipo, 'Objeto')
      .map((f) => ({
        objeto: texto(f[0]),
        cantidad: numero(f[1]) || 1,
        nota: texto(f[4]) || undefined,
      }))
      .filter((o) => o.objeto);
    if (objetos.length > 0) p.equipo.objetos = objetos;
    const bolsa = {
      MO: numero(valorDe(hojaEquipo, 'Monedas de oro')),
      MP: numero(valorDe(hojaEquipo, 'Monedas de plata')),
      MC: numero(valorDe(hojaEquipo, 'Monedas de cobre')),
    };
    if (bolsa.MO || bolsa.MP || bolsa.MC) p.equipo.dinero = bolsa;
  }

  const hojaTras = buscarHoja(hojas, 'Trasfondo');
  if (hojaTras) {
    p.trasfondo = {
      apariencia: valorDe(hojaTras, 'Apariencia') || undefined,
      personalidad: valorDe(hojaTras, 'Personalidad') || undefined,
      motivacion: valorDe(hojaTras, 'Motivación') || undefined,
      historia: valorDe(hojaTras, 'Historia') || undefined,
      particularidades: valorDe(hojaTras, 'Particularidades') || undefined,
      contactos: valorDe(hojaTras, 'Contactos') || undefined,
      dinero: valorDe(hojaEquipo, 'Dinero') || undefined,
      equipoLibre: valorDe(hojaEquipo, 'Otro equipo') || undefined,
    };
    p.notas = valorDe(hojaTras, 'Notas') || undefined;
  }

  avisos.push(
    'El libro no traía la hoja «anima-manager», así que se ha reconstruido de las hojas ' +
      'legibles: los valores derivados se recalculan y las sobrescrituras manuales se pierden.',
  );

  return { personaje: p, origen: 'hojas', avisos };
}

/**
 * Lee un libro y devuelve la ficha.
 *
 * `nuevoId` sirve para decidir la identidad al importar: si se pasa, la ficha entra como
 * copia nueva; si no, conserva su id y sobrescribe a la original.
 */
export async function importarDeExcel(
  buffer: ArrayBuffer,
  nuevoId?: string,
  /**
   * Catálogo con el que emparejar lo que la hoja de la comunidad elige de un desplegable:
   * ventajas, conjuros, poderes, equipo… Sin él la importación sigue funcionando, pero
   * esas listas se quedan vacías, porque adivinarlas sería inventárselas.
   */
  catalogo?: Catalogo,
): Promise<ResultadoImportacion> {
  const hojas = await leerLibro(buffer);
  const datos = buscarHoja(hojas, HOJA_DATOS);

  if (datos) {
    const i = datos.filas.findIndex((f) => texto(f?.[0]).toLowerCase() === 'json');
    const json = datos.filas
      .slice(i + 1)
      .map((f) => texto(f?.[0]))
      .join('');
    try {
      const p = migrarPersonaje(JSON.parse(json) as Personaje);
      return {
        personaje: nuevoId ? { ...p, id: nuevoId } : p,
        origen: 'datos',
        avisos: [],
      };
    } catch {
      // La hoja está pero el JSON no se puede leer: mejor reconstruir que fallar.
      const r = deHojasLegibles(hojas, nuevoId ?? crypto.randomUUID());
      r.avisos.unshift('La hoja «anima-manager» está dañada; se ha usado el resto del libro.');
      return r;
    }
  }

  if (esFichaDeLaComunidad(hojas)) {
    return deFichaComunidad(hojas, nuevoId ?? crypto.randomUUID(), catalogo);
  }
  return deHojasLegibles(hojas, nuevoId ?? crypto.randomUUID());
}

// ───────────────── Fichas de la comunidad (Meirmeister y derivadas) ─────────────────

/**
 * Importar una ficha de la hoja de cálculo que ya usa la comunidad.
 *
 * Esa hoja no es un formato: es un Excel de veintiuna pestañas lleno de fórmulas, y cada
 * mesa la retoca. Así que aquí **no se hardcodean direcciones de celda** —serían distintas
 * en cada versión—, sino que se busca por etiqueta: se localiza la celda que pone «Raza:»
 * y se toma la primera celda no vacía a su derecha. Eso aguanta que muevan las columnas,
 * que es exactamente lo que pasa entre versiones.
 *
 * Se recupera lo que se puede identificar sin ambigüedad —identidad, categoría, nivel y
 * las ocho características compradas— y el resto se deja para rellenar a mano. Es una
 * ayuda para no empezar de cero, no una conversión completa: buena parte de la ficha vive
 * en fórmulas cuyo significado no es deducible sin conocer la versión exacta.
 */
function primerNumeroDe(v: Celda): number {
  // El nivel se escribe «1 + 1»: el primero es el nivel y el segundo el ajuste racial.
  const m = /-?\d+/.exec(String(v ?? ''));
  return m ? Number(m[0]) : 0;
}

/** Primera celda no vacía a la derecha de una etiqueta, en cualquier hoja del libro. */
function trasEtiqueta(hojas: Hoja[], etiqueta: string): Celda {
  const e = etiqueta.toLowerCase();
  for (const h of hojas) {
    for (const fila of h.filas) {
      if (!fila) continue;
      const j = fila.findIndex(
        (v) => typeof v === 'string' && v.trim().replace(/:$/, '').toLowerCase() === e,
      );
      if (j < 0) continue;
      const valor = fila.slice(j + 1).find((v) => v !== null && v !== undefined && v !== '');
      if (valor !== undefined) return valor;
    }
  }
  return undefined;
}

const ABREVIATURAS = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'] as const;

/**
 * Las ocho características. En la hoja de la comunidad están en una columna de etiquetas
 * con el valor **comprado** justo a la derecha y el final unas columnas más allá. Se toma
 * la primera aparición de cada una, que es la del bloque de compra; los bloques de más a
 * la derecha son los valores ya modificados por la raza, y esos los recalcula la aplicación.
 */
function caracteristicasDe(hojas: Hoja[]): Partial<Record<Caracteristica, number>> {
  const salida: Partial<Record<Caracteristica, number>> = {};
  for (const h of hojas) {
    for (const fila of h.filas) {
      if (!fila) continue;
      fila.forEach((v, j) => {
        if (typeof v !== 'string') return;
        const nombre = v.trim() as Caracteristica;
        if (!ABREVIATURAS.includes(nombre as (typeof ABREVIATURAS)[number])) return;
        if (nombre in salida) return;
        if (typeof fila[j + 1] === 'number') salida[nombre] = fila[j + 1] as number;
      });
    }
  }
  return salida;
}

/**
 * Los PD que la hoja de la comunidad tiene invertidos en cada habilidad.
 *
 * Durante mucho tiempo esto se dio por imposible —«viven dentro de fórmulas»— y sólo se
 * traían identidad y características. No era cierto: la pestaña **PDs** tiene dos tablas,
 * una de combate y otra de secundarias, y las dos están montadas igual. Una fila de
 * cabecera con «Habilidad» y varias columnas «PDs», y debajo una fila por habilidad con su
 * nombre escrito en claro. Los PD se reparten en varias columnas porque la hoja los anota
 * por tramos de nivel; el total es la suma.
 *
 * Se busca **por etiqueta, nunca por dirección de celda**, igual que el resto del
 * importador: las cuatro fichas reales que hay para probar no colocan las tablas en las
 * mismas filas, y una de ellas ni siquiera tiene las mismas pestañas.
 */
export function pdInvertidosDe(hojas: Hoja[]): { pd: Record<string, number>; sinReconocer: string[] } {
  const pd: Record<string, number> = {};
  const sinReconocer: string[] = [];
  const hoja = buscarHoja(hojas, 'PDs');
  if (!hoja) return { pd, sinReconocer };

  const secundarias = new Set(SECUNDARIAS.map((s) => s.nombre.toLowerCase()));
  const porNombre = new Map(SECUNDARIAS.map((s) => [s.nombre.toLowerCase(), s.nombre]));

  for (let i = 0; i < hoja.filas.length; i++) {
    const fila = hoja.filas[i];
    if (!fila) continue;

    // ¿Es la cabecera de una de las dos tablas?
    const colNombre = fila.findIndex(
      (v) => typeof v === 'string' && v.trim().toLowerCase() === 'habilidad',
    );
    if (colNombre < 0) continue;
    const colsPD = fila
      .map((v, j) => (typeof v === 'string' && v.trim().toLowerCase() === 'pds' ? j : -1))
      .filter((j) => j >= 0);
    if (colsPD.length === 0) continue;

    // El Ki tiene dos bloques con las **mismas** etiquetas —AGI, CON, DES…— uno de Puntos
    // y otro de Acumulación. Lo que los distingue es el rótulo del grupo, que la hoja pone
    // en la columna anterior y sólo en la primera fila de cada bloque.
    let grupo = '';

    for (let k = i + 1; k < hoja.filas.length; k++) {
      const f = hoja.filas[k];
      if (!f) continue;
      const rotulo = texto(f[colNombre - 1]).trim();
      if (rotulo) grupo = rotulo.toLowerCase();

      const nombre = texto(f[colNombre]).trim();
      // Un hueco no corta la tabla —la hoja deja filas en blanco entre grupos— pero tres
      // seguidos sí: a partir de ahí ya es otra cosa.
      if (!nombre) {
        const siguientes = [1, 2].every((d) => !texto(hoja.filas[k + d]?.[colNombre]).trim());
        if (siguientes) break;
        continue;
      }
      const puntos = colsPD.reduce(
        (t, j) => t + (typeof f[j] === 'number' ? (f[j] as number) : 0),
        0,
      );
      if (puntos <= 0) continue;

      const clave = claveDe(nombre, grupo, secundarias, porNombre);
      if (clave) pd[clave] = (pd[clave] ?? 0) + puntos;
      else if (!sinReconocer.includes(nombre)) sinReconocer.push(nombre);
    }
  }
  return { pd, sinReconocer };
}

/**
 * De cómo se llama una fila en la hoja a la clave que usa la aplicación, o `null` si esa
 * fila no le corresponde a nada. Devolver `null` en vez de guardar el nombre tal cual es
 * deliberado: una clave que el motor no lee no haría nada, pero sí saldría en la cuenta de
 * «se han traído N habilidades» y daría por importado algo que no lo está.
 */
function claveDe(
  nombre: string,
  grupo: string,
  secundarias: Set<string>,
  porNombre: Map<string, string>,
): string | null {
  const n = nombre.toLowerCase();
  if (secundarias.has(n)) return porNombre.get(n) ?? nombre;

  const directa = CLAVE_DESDE_HOJA[n];
  if (directa) return directa;

  // Las seis características del Ki, que sólo se distinguen por el rótulo de su bloque.
  if (ABREVIATURAS.includes(nombre.toUpperCase() as (typeof ABREVIATURAS)[number])) {
    if (grupo.includes('acumulaci')) return `AcumKi${nombre.toUpperCase()}`;
    if (grupo.includes('ki')) return `Ki${nombre.toUpperCase()}`;
    return null;
  }
  return null;
}

/**
 * Traduce los nombres de la hoja a las claves que usa la aplicación. Sólo hacen falta para
 * las de combate: las secundarias se llaman igual en los dos sitios.
 */
const CLAVE_DESDE_HOJA: Record<string, string> = {
  // Secundarias que la hoja abrevia o escribe sin tilde. Todas son inequívocas: no hay
  // ninguna otra habilidad del manual que empiece igual.
  'p. fuerza': 'Proezas de Fuerza',
  'res. dolor': 'Resistencia al Dolor',
  'v. mágica': 'Valoración Mágica',
  't. manos': 'Trucos de Manos',
  tactica: 'Táctica',
  // Combate, Ki y místicas.
  'h. ataque': 'HAtaque',
  'h. parada': 'HParada',
  'h. esquiva': 'HEsquiva',
  'llevar armadura': 'LlevarArmadura',
  'conocimiento marcial': 'CM',
  zeón: 'Zeon',
  zeon: 'Zeon',
  act: 'ACT',
  'proyección mágica': 'ProyeccionMagica',
  'nivel de magia': 'NivelMagia',
  'proyección psíquica': 'ProyeccionPsiquica',
  cv: 'CV',
  // Las cuatro de invocación. La hoja llama «Controlar» a lo que el manual llama Dominar.
  convocar: 'Convocar',
  controlar: 'Controlar',
  dominar: 'Controlar',
  atar: 'Atar',
  desconvocar: 'Desconvocar',
};

export function esFichaDeLaComunidad(hojas: Hoja[]): boolean {
  const nombres = hojas.map((h) => h.nombre.toLowerCase());
  // La combinación de estas tres pestañas es característica de esa hoja de cálculo.
  return ['principal', 'pds', 'combate'].every((n) => nombres.includes(n));
}

export async function deFichaComunidad(
  hojas: Hoja[],
  id: string,
  catalogo?: Catalogo,
): Promise<ResultadoImportacion> {
  const avisos: string[] = [];
  const p = personajeVacio(id);

  const nombre = texto(trasEtiqueta(hojas, 'nombre')).trim();
  if (nombre) p.nombre = nombre;
  else avisos.push('No he encontrado el nombre.');

  const raza = texto(trasEtiqueta(hojas, 'raza')).trim();
  if (raza) p.raza = raza;

  const sexo = texto(trasEtiqueta(hojas, 'sexo')).trim();
  if (sexo === 'Hombre' || sexo === 'Mujer') p.sexo = sexo;

  const categoria = texto(trasEtiqueta(hojas, 'categoría')).trim();
  const nivel = primerNumeroDe(trasEtiqueta(hojas, 'nivel'));
  if (categoria) p.categorias = [{ categoria, nivel: Math.max(nivel, 0) }];
  else avisos.push('No he encontrado la categoría; se queda la de por defecto.');

  const car = caracteristicasDe(hojas);
  const faltan = ABREVIATURAS.filter((c) => car[c] === undefined);
  for (const [k, v] of Object.entries(car)) p.caracteristicas[k as Caracteristica] = v;
  if (faltan.length > 0) avisos.push(`No he podido leer estas características: ${faltan.join(', ')}.`);

  // Los PD invertidos, de las tablas de la pestaña PDs.
  const { pd, sinReconocer } = pdInvertidosDe(hojas);
  const claves = Object.keys(pd);
  if (claves.length > 0) {
    p.pdInvertidos = { ...p.pdInvertidos, ...pd };
    const total = Object.values(pd).reduce((t, n) => t + n, 0);
    avisos.push(
      `Se han traído los PD de ${claves.length} habilidades, ${total} PD en total. ` +
        'Los valores finales no van a coincidir todavía con los de tu hoja, y no es un ' +
        'error: en esa columna la hoja suma además la armadura que llevas, las ventajas, ' +
        'las Habilidades Naturales y los bonos de tu raza. Nada de eso se puede leer de ahí, ' +
        'así que hay que ponerlo a mano; en cuanto esté, los números cuadran.',
    );
  }
  if (sinReconocer.length > 0) {
    avisos.push(
      `Estas filas de la pestaña PDs tenían puntos pero no corresponden a nada que la ` +
        `aplicación calcule, así que se han dejado fuera: ${sinReconocer.join(', ')}.`,
    );
  }

  // Trasfondo y bolsa: texto libre y tres números, nada que pueda estropear el cálculo.
  const trasfondo = trasfondoDe(hojas);
  const civil = fichaCivilDe(hojas);
  if (civil) trasfondo.apariencia = [civil, trasfondo.apariencia].filter(Boolean).join(' · ');
  if (Object.keys(trasfondo).length > 0) p.trasfondo = { ...p.trasfondo, ...trasfondo };

  const bolsa = bolsaDe(hojas);
  if (bolsa) p.equipo.dinero = bolsa;

  // Y todo lo que en la hoja se elige de un desplegable, que se empareja con el catálogo.
  if (catalogo) {
    const e = await eleccionesDe(hojas, catalogo);
    p.ventajas = e.ventajas;
    p.desventajas = e.desventajas;
    if (e.legados.length > 0) p.legados = e.legados;
    if (e.habilidadesEsenciales.length > 0) p.habilidadesEsenciales = e.habilidadesEsenciales;
    p.conjuros = e.conjuros;
    p.poderesPsiquicos = e.poderesPsiquicos;
    if (e.habilidadesKi.length > 0) p.ki = { ...p.ki, habilidades: e.habilidadesKi };
    p.equipo.armas = e.armas;
    p.equipo.armadura = e.armadura;

    const traido = [
      [e.ventajas.length, 'ventaja', 'ventajas'],
      [e.desventajas.length, 'desventaja', 'desventajas'],
      [e.legados.length, 'Legado de Sangre', 'Legados de Sangre'],
      [e.habilidadesEsenciales.length, 'Habilidad Esencial', 'Habilidades Esenciales'],
      [e.conjuros.length, 'conjuro', 'conjuros'],
      [e.poderesPsiquicos.length, 'poder psíquico', 'poderes psíquicos'],
      [e.habilidadesKi.length, 'Habilidad del Ki', 'Habilidades del Ki'],
      [e.armas.length, 'arma', 'armas'],
      [e.armadura.length, 'pieza de armadura', 'piezas de armadura'],
    ] as const;
    const resumen = traido
      .filter(([n]) => n > 0)
      .map(([n, singular, plural]) => `${n} ${n === 1 ? singular : plural}`);
    if (resumen.length > 0) {
      avisos.push(`Elegido del catálogo: ${resumen.join(', ')}.`);
    }
    if (e.sinCasar.length > 0) {
      avisos.push(
        'Tu hoja nombra esto, pero no está en el catálogo que tienes cargado, así que no ' +
          `se ha traído: ${e.sinCasar.join(', ')}. Si es de tu mesa, añádelo en «Contenido ` +
          'propio» y vuelve a importar.',
      );
    }
  } else {
    avisos.push(
      'Las ventajas, los poderes y el equipo no se han traído porque no había catálogo ' +
        'cargado. Vuelve a importar desde la lista de personajes y sí saldrán.',
    );
  }

  avisos.push(
    'Lo que la hoja calcula por su cuenta no se copia: la aplicación lo recalcula. Y hay ' +
      'cosas que esa hoja no guarda de forma que se puedan leer —las Técnicas de Ki, la ' +
      'Metamagia y el Sheele—, así que ésas sí hay que rehacerlas a mano.',
  );

  return { personaje: p, origen: 'comunidad', avisos };
}
