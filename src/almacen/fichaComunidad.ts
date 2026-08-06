/**
 * Lectura de **la hoja de cálculo que usa la comunidad** (Meirmeister y sus derivadas).
 *
 * No es un formato: es una hoja de cálculo viva que cada mesa retoca. Por eso aquí no se
 * escribe ni una dirección de celda —serían distintas en cada versión—, sino que se busca
 * por etiqueta y, cuando ni eso vale, **por el catálogo**: si una celda dice exactamente
 * «Obligación somática» y eso es una desventaja del manual, es una desventaja del manual.
 *
 * Ese emparejamiento funciona porque el catálogo salió de esta misma hoja, así que los
 * nombres coinciden carácter a carácter. Y es seguro por un detalle que la propia hoja
 * regala: cada pestaña marca en la fila 1 dónde empieza su «Zona de tablas auxiliares»,
 * que es donde viven las listas de consulta con *todos* los conjuros, *todas* las ventajas
 * y demás. Sin ese corte, buscar por catálogo importaría el manual entero.
 */

import type { Celda, Hoja } from './xlsx';
import type { Catalogo } from '../datos/paquetes';
import type { Bolsa, Personaje } from '../motor/personaje';
import type { EscalaArma } from '../motor/combate';

const texto = (c: Celda): string => (c === null || c === undefined ? '' : String(c).trim());
const numero = (c: Celda): number => {
  if (typeof c === 'number') return c;
  const n = Number(String(c ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza para comparar: sin tildes, sin dobles espacios y en minúsculas. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Columna en la que empieza la zona de tablas auxiliares de una pestaña. Todo lo que hay
 * de ahí a la derecha es maquinaria de la hoja, no el personaje.
 *
 * En las cuatro fichas reales que hay para probar la marca está siempre en la fila 1, y
 * siempre en la misma columna para una misma pestaña. Si algún día no estuviera, se
 * devuelve `Infinity` y se lee la hoja entera: peor, pero no roto.
 */
export function inicioZonaAuxiliar(hoja: Hoja): number {
  for (const fila of hoja.filas.slice(0, 3)) {
    if (!fila) continue;
    const j = fila.findIndex(
      (v) => typeof v === 'string' && /zona de tablas auxiliares/i.test(v),
    );
    if (j >= 0) return j;
  }
  return Infinity;
}

export function buscarHoja(hojas: Hoja[], nombre: string): Hoja | undefined {
  const n = normalizar(nombre);
  return hojas.find((h) => normalizar(h.nombre) === n);
}

/** Primera celda no vacía a la derecha de una etiqueta, en cualquier pestaña. */
export function trasEtiqueta(hojas: Hoja[], etiqueta: string): Celda {
  const e = normalizar(etiqueta.replace(/:$/, ''));
  for (const h of hojas) {
    for (const fila of h.filas) {
      if (!fila) continue;
      const j = fila.findIndex(
        (v) => typeof v === 'string' && normalizar(v.replace(/:$/, '')) === e,
      );
      if (j < 0) continue;
      const valor = fila.slice(j + 1).find((v) => v !== null && v !== undefined && v !== '');
      if (valor !== undefined) return valor;
    }
  }
  return undefined;
}

/**
 * Texto largo que la hoja escribe **debajo** de su rótulo, no al lado: la historia, la
 * personalidad y los sueños ocupan una celda combinada en la fila siguiente.
 */
function bajoRotulo(hoja: Hoja | undefined, rotulo: string): string {
  if (!hoja) return '';
  const r = normalizar(rotulo);
  for (let i = 0; i < hoja.filas.length; i++) {
    const fila = hoja.filas[i];
    if (!fila) continue;
    const j = fila.findIndex((v) => typeof v === 'string' && normalizar(v) === r);
    if (j < 0) continue;
    // El texto está justo debajo, en la misma columna o en la primera no vacía a partir
    // de ella: según la versión la celda combinada empieza en una o en otra.
    // Sólo la propia columna del rótulo y la de al lado: la hoja pone bloques distintos
    // en paralelo, y barrer hacia la derecha traía el texto del bloque vecino.
    for (let k = i + 1; k < Math.min(i + 3, hoja.filas.length); k++) {
      const valor = (hoja.filas[k] ?? []).slice(j, j + 2).find((v) => typeof v === 'string' && v.trim());
      if (valor) return String(valor).trim();
    }
  }
  return '';
}

// ───────────────────────────── Trasfondo y bolsa ─────────────────────────────

/**
 * Lo que la pestaña «General» guarda del personaje como persona. Todo esto es texto libre
 * que no toca ningún número, así que traerlo no puede estropear el cálculo: o está bien
 * copiado o está vacío.
 */
export function trasfondoDe(hojas: Hoja[]): Partial<Personaje['trasfondo']> {
  const general = buscarHoja(hojas, 'General');
  const t: Partial<Personaje['trasfondo']> = {};

  const historia = bajoRotulo(general, 'Resumen de su historia');
  if (historia) t.historia = historia;
  const personalidad = bajoRotulo(general, 'Personalidad y motivación');
  if (personalidad) t.personalidad = personalidad;
  const suenos = bajoRotulo(general, 'Sueños y objetivos');
  if (suenos) t.motivacion = suenos;
  const particularidades = bajoRotulo(general, 'Particularidades. Cosas que aprecia o detesta');
  if (particularidades) t.particularidades = particularidades;

  // La apariencia va desmenuzada en etiquetas sueltas; se junta en una frase.
  const piezas: string[] = [];
  for (const [etiqueta, prefijo] of [
    ['Tez', 'Tez'],
    ['Ojos', 'ojos'],
    ['Cabello', 'cabello'],
  ] as const) {
    const v = texto(trasEtiqueta(hojas, etiqueta));
    if (v) piezas.push(`${prefijo} ${v}`);
  }
  const altura = numero(trasEtiqueta(hojas, 'Altura'));
  const peso = numero(trasEtiqueta(hojas, 'Peso'));
  if (altura > 0) piezas.push(`${altura} m`);
  if (peso > 0) piezas.push(`${peso} kg`);
  if (piezas.length > 0) t.apariencia = piezas.join(', ');

  const contactos = bajoRotulo(general, 'Contactos');
  if (contactos) t.contactos = contactos;
  const posesiones = bajoRotulo(general, 'Títulos y Posesiones');
  if (posesiones) t.equipoLibre = posesiones;

  return t;
}

/**
 * Edad, región y clase social. No caben en el trasfondo tal como está montado, así que
 * se devuelven aparte para que quien llame decida dónde ponerlos.
 */
export function fichaCivilDe(hojas: Hoja[]): string {
  const partes: string[] = [];
  const edad = numero(trasEtiqueta(hojas, 'Edad'));
  if (edad > 0) partes.push(`${edad} años`);
  const general = buscarHoja(hojas, 'General');
  for (const etiqueta of ['Región', 'Clase social'] as const) {
    const v = texto(trasEtiqueta(general ? [general] : [], etiqueta));
    // «Personalizadas» es el valor que pone la hoja cuando la mesa usa su propia tabla, y
    // un valor acabado en dos puntos es el rótulo de al lado, no un dato.
    if (v && v !== 'Personalizadas' && !v.endsWith(':')) partes.push(v);
  }
  return partes.join(' · ');
}

/** El dinero, que la hoja anota en tres filas seguidas bajo el rótulo «Monedas». */
export function bolsaDe(hojas: Hoja[]): Bolsa | undefined {
  const bolsa: Bolsa = {
    MO: numero(trasEtiqueta(hojas, 'Oro')),
    MP: numero(trasEtiqueta(hojas, 'Plata')),
    MC: numero(trasEtiqueta(hojas, 'Cobre')),
  };
  return bolsa.MO || bolsa.MP || bolsa.MC ? bolsa : undefined;
}

// ───────────────────────────── Equipo de combate ─────────────────────────────

/** Cómo escribe la hoja la empuñadura de cada arma. */
const A_DOS_MANOS = new Set(['a dos manos']);
const CONOCIMIENTOS = ['Conocida', 'Similar', 'Mixta', 'Distinta'] as const;
const ESCALAS: EscalaArma[] = ['Normal', 'Enorme', 'Gigante'];

/**
 * La armadura, de la tabla que la pestaña «Combate» encabeza con «Armadura ·
 * Localización · Calidad». Se leen las filas de debajo hasta que se acaban los nombres.
 */
export function armaduraDe(hojas: Hoja[], conocidas: Set<string>): Personaje['equipo']['armadura'] {
  const hoja = buscarHoja(hojas, 'Combate');
  if (!hoja) return [];
  const corte = inicioZonaAuxiliar(hoja);
  const piezas: Personaje['equipo']['armadura'] = [];

  for (let i = 0; i < hoja.filas.length; i++) {
    const fila = hoja.filas[i];
    if (!fila) continue;
    const colNombre = fila.findIndex(
      (v, j) => j < corte && typeof v === 'string' && normalizar(v) === 'armadura',
    );
    const colCalidad = fila.findIndex(
      (v, j) => j < corte && typeof v === 'string' && normalizar(v) === 'calidad',
    );
    if (colNombre < 0 || colCalidad < 0) continue;

    for (let k = i + 1; k < hoja.filas.length; k++) {
      const f = hoja.filas[k] ?? [];
      const nombre = texto(f[colNombre]);
      // La tabla termina en la fila de totales, que empieza por «Restricción Movimiento».
      if (normalizar(nombre).startsWith('restriccion')) break;
      if (!nombre || !conocidas.has(normalizar(nombre))) continue;
      piezas.push({ armadura: nombre, calidad: numero(f[colCalidad]) || undefined });
    }
    break;
  }
  return piezas;
}

/**
 * Las armas. La pestaña «Combate» las pone en bloques numerados «1.», «2.»…, y dentro de
 * cada bloque el nombre va a la derecha del número; la empuñadura, el conocimiento y el
 * tamaño, en las dos filas siguientes.
 */
export function armasDe(hojas: Hoja[], conocidas: Set<string>): Personaje['equipo']['armas'] {
  const hoja = buscarHoja(hojas, 'Combate');
  if (!hoja) return [];
  const corte = inicioZonaAuxiliar(hoja);
  const armas: Personaje['equipo']['armas'] = [];
  const vistas = new Set<string>();

  for (let i = 0; i < hoja.filas.length; i++) {
    const fila = hoja.filas[i];
    if (!fila) continue;
    for (let j = 0; j < Math.min(fila.length, corte); j++) {
      if (!/^\d+\.$/.test(texto(fila[j]))) continue;
      // El nombre es la primera celda a la derecha del número que esté en el catálogo.
      const nombre = fila
        .slice(j + 1, corte)
        .map(texto)
        .find((v) => v && conocidas.has(normalizar(v)));
      if (!nombre || vistas.has(nombre)) continue;
      vistas.add(nombre);

      // La empuñadura y el conocimiento van sueltos en las dos filas de debajo; el
      // tamaño va detrás de un rótulo «Tam:», así que ése se busca aparte.
      const debajo: string[] = [];
      let escala: EscalaArma | undefined;
      // Los bloques de arma van en paralelo en las mismas filas, así que sólo cuenta lo
      // que hay de esta columna hacia la derecha: si no, el «Tam:» del arma de al lado
      // pisaba al propio.
      for (const k of [i + 1, i + 2]) {
        const f = hoja.filas[k] ?? [];
        for (let c = j; c < Math.min(f.length, corte); c++) {
          const v = texto(f[c]);
          if (!v) continue;
          if (normalizar(v) === 'tam:') {
            const puesto = texto(f[c + 1]);
            escala ??= ESCALAS.find((e) => normalizar(e) === normalizar(puesto));
            continue;
          }
          debajo.push(v);
        }
      }
      const conocimiento = CONOCIMIENTOS.find((c) =>
        debajo.some((v) => normalizar(v) === normalizar(c)),
      );

      armas.push({
        arma: nombre,
        aDosManos: debajo.some((v) => A_DOS_MANOS.has(normalizar(v))) || undefined,
        conocimiento,
        escala,
      });
    }
  }
  return armas;
}

/**
 * Columna de una tabla de selección: se busca su encabezado y se leen las filas de debajo,
 * quedándose sólo con lo que esté en el catálogo.
 *
 * Es la forma buena de leer los conjuros y los poderes psíquicos. El resumen impreso los
 * lista separados por comas, pero **lo corta**: la ficha de Christopher tiene 27 poderes y
 * su resumen enseña 20 y un «+ …». La tabla de selección los tiene todos.
 */
function columnaSeleccion(
  hoja: Hoja | undefined,
  encabezado: string,
  conocidos: Set<string>,
): string[] {
  if (!hoja) return [];
  const corte = inicioZonaAuxiliar(hoja);
  const e = normalizar(encabezado);
  const salida: string[] = [];

  for (let i = 0; i < hoja.filas.length; i++) {
    const fila = hoja.filas[i];
    if (!fila) continue;
    const col = fila.findIndex(
      (v, j) => j < corte && typeof v === 'string' && normalizar(v) === e,
    );
    if (col < 0) continue;
    for (let k = i + 1; k < hoja.filas.length; k++) {
      const nombre = texto((hoja.filas[k] ?? [])[col]);
      if (!nombre || !conocidos.has(normalizar(nombre))) continue;
      if (!salida.includes(nombre)) salida.push(nombre);
    }
    break;
  }
  return salida;
}

/** Une dos listas del personaje sin repetir y conservando el orden de la primera. */
function unir(a: string[], b: string[]): string[] {
  const salida = [...a];
  for (const x of b) if (!salida.some((y) => normalizar(y) === normalizar(x))) salida.push(x);
  return salida;
}

// ───────────────────────────── Todo lo que se elige de una lista ────────────

/**
 * Lista separada por comas que la pestaña «Resumen» escribe debajo de una etiqueta.
 *
 * Esa pestaña es el resumen impreso del personaje, y por eso es la buena para leer: las
 * demás **dibujan el catálogo entero** —el árbol de Habilidades del Ki sale completo, con
 * o sin ellas, y el Grimorio de Vía lista todos los conjuros de la vía— así que buscar
 * ahí devolvía el manual en vez del personaje.
 */
function listaResumen(hojas: Hoja[], etiqueta: string): string[] {
  const hoja = buscarHoja(hojas, 'Resumen');
  if (!hoja) return [];
  const corte = inicioZonaAuxiliar(hoja);
  const e = normalizar(etiqueta.replace(/:$/, ''));

  /** Primer texto de una fila a partir de una columna, sin salirse de la zona útil. */
  const textoDesde = (i: number, desde: number): string => {
    const fila = hoja.filas[i] ?? [];
    for (let j = desde; j < Math.min(fila.length, corte); j++) {
      const v = fila[j];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  for (let i = 0; i < hoja.filas.length; i++) {
    const fila = hoja.filas[i] ?? [];
    const col = fila.findIndex(
      (v, j) => j < corte && typeof v === 'string' && normalizar(v.replace(/:$/, '')) === e,
    );
    if (col < 0) continue;

    // Según la versión de la hoja el valor va en la misma fila, a la derecha del rótulo,
    // o en una de las tres siguientes. Se prueba en ese orden y se para en el rótulo
    // siguiente, que se reconoce porque acaba en dos puntos.
    const partes: string[] = [];
    const mismaFila = textoDesde(i, col + 1);
    if (mismaFila && !mismaFila.endsWith(':')) partes.push(mismaFila);
    if (partes.length === 0) {
      for (let k = i + 1; k < Math.min(i + 4, hoja.filas.length); k++) {
        const t = textoDesde(k, 0);
        if (!t) continue;
        if (t.endsWith(':')) break;
        partes.push(t);
      }
    }
    return partes
      .join(', ')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Empareja lo que dice el resumen con el catálogo. Lo que no case se devuelve aparte para
 * poder decirlo: una mesa puede tener ventajas de su cosecha, y callárselo sería peor que
 * no traerlas.
 */
function emparejar(escritos: string[], nombresCatalogo: string[]): {
  encontrados: string[];
  sinCasar: string[];
} {
  const porNombre = new Map(nombresCatalogo.map((n) => [normalizar(n), n]));
  const encontrados: string[] = [];
  const sinCasar: string[] = [];

  for (const escrito of escritos) {
    // La hoja corta sus propias listas con un «+ …» cuando no le caben: no es un nombre.
    if (/^\+\s*\.*$/.test(escrito) || escrito === '...' || escrito === '…') continue;

    // Se prueba tal cual y, si no casa, quitando lo que la hoja le añade al nombre: la
    // especialidad detrás de dos puntos («Apto en una materia (1): Medicina») y el valor
    // al final («Ocultación del Ki 70»).
    const variantes = [
      escrito,
      escrito.split(':')[0],
      escrito.replace(/\s+-?\d+$/, ''),
    ];
    const nombre = variantes.map((v) => porNombre.get(normalizar(v))).find(Boolean);

    if (nombre) {
      if (!encontrados.includes(nombre)) encontrados.push(nombre);
    } else {
      sinCasar.push(escrito);
    }
  }
  return { encontrados, sinCasar };
}

export interface EleccionesLeidas {
  ventajas: string[];
  desventajas: string[];
  legados: string[];
  habilidadesEsenciales: string[];
  conjuros: string[];
  poderesPsiquicos: string[];
  habilidadesKi: string[];
  armas: Personaje['equipo']['armas'];
  armadura: Personaje['equipo']['armadura'];
  /** Lo que la hoja nombraba pero no está en el catálogo cargado. */
  sinCasar: string[];
}

/**
 * Lee de la hoja todo lo que en ella se elige de una lista. Necesita el catálogo porque el
 * emparejamiento es contra él: sin catálogo no se inventa nada, simplemente no se trae.
 */
export async function eleccionesDe(
  hojas: Hoja[],
  catalogo: Catalogo,
): Promise<EleccionesLeidas> {
  const [ventajasCat, legadosCat, esencialesCat, conjurosCat, psiCat, kiCat, armasCat, armadurasCat, yelmosCat] =
    await Promise.all([
      catalogo.obtener('ventajas'),
      catalogo.obtener('legadosSangre'),
      catalogo.obtener('habilidadesEsenciales'),
      catalogo.obtener('conjuros'),
      catalogo.obtener('poderesPsiquicos'),
      catalogo.obtener('habilidadesKi'),
      catalogo.obtener('armas'),
      catalogo.obtener('armaduras'),
      catalogo.obtener('yelmos'),
    ]);

  const sinCasar: string[] = [];
  const recoge = (escritos: string[], nombres: string[]): string[] => {
    const r = emparejar(escritos, nombres);
    sinCasar.push(...r.sinCasar);
    return r.encontrados;
  };

  // Ventajas, desventajas y Legados comparten la misma línea del resumen.
  const escritas = listaResumen(hojas, 'Ventajas y desventajas');
  const legados = emparejar(escritas, legadosCat.map((l) => l.legado)).encontrados;
  const restantes = escritas.filter((x) => !legados.some((l) => normalizar(l) === normalizar(x)));
  const ventajasYDesventajas = recoge(restantes, ventajasCat.map((v) => v.nombre));
  const esDesventaja = new Map(ventajasCat.map((v) => [v.nombre, v.esDesventaja]));

  const esenciales = recoge(
    listaResumen(hojas, 'Habilidades esenciales'),
    esencialesCat.map((h) => h.nombre),
  );
  const psiquicos = recoge(
    listaResumen(hojas, 'Poderes Psíquicos'),
    psiCat.map((p) => p.poder),
  );
  const ki = recoge(
    listaResumen(hojas, 'Habilidades de Ki'),
    kiCat.map((h) => h.habilidad),
  );

  // Las armas naturales y el combate desarmado son filas fijas de la hoja, no equipo que
  // el personaje lleve: si se colasen, todo el mundo acabaría con un arma que no tiene.
  const conocidasArmas = new Set(
    armasCat
      .map((a) => a.arma)
      .filter((a) => !['Desarmado', 'Armas naturales'].includes(a))
      .map(normalizar),
  );
  const conocidasArmadura = new Set(
    [...armadurasCat.map((a) => a.armadura), ...yelmosCat.map((y) => y.yelmo)].map(normalizar),
  );

  return {
    ventajas: ventajasYDesventajas.filter((n) => !esDesventaja.get(n)),
    desventajas: ventajasYDesventajas.filter((n) => esDesventaja.get(n)),
    legados,
    habilidadesEsenciales: esenciales,
    conjuros: columnaSeleccion(
      buscarHoja(hojas, 'Místicos'),
      'Conjuro',
      new Set(conjurosCat.map((c) => normalizar(c.conjuro))),
    ),
    // El resumen y la tabla de selección son las dos cosas del personaje, así que se unen:
    // el resumen corta a partir de veinte y la tabla no siempre está rellena.
    poderesPsiquicos: unir(
      columnaSeleccion(
        buscarHoja(hojas, 'Psíquicos'),
        'Poderes',
        new Set(psiCat.map((p) => normalizar(p.poder))),
      ),
      psiquicos,
    ),
    habilidadesKi: ki,
    armas: armasDe(hojas, conocidasArmas),
    armadura: armaduraDe(hojas, conocidasArmadura),
    sinCasar,
  };
}
