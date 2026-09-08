/**
 * El campo de batalla: una imagen, una cuadrícula encima y una ficha por combatiente.
 *
 * Lo que hay aquí es sólo geometría —cuántas casillas caben, en cuál has soltado el dedo,
 * dónde empieza cada uno—. **No sabe nada de reglas**: ni cuánto se mueve alguien en un
 * asalto, ni si hay una pared en medio, ni si desde ahí llegas a atacar. Eso lo decide la
 * mesa mirando el mapa, igual que con una cuadrícula de papel y unas monedas encima.
 *
 * Las casillas se guardan en números de casilla, no en píxeles: así el mapa se ve igual en
 * un monitor de 27 pulgadas y en un móvil, y cambiar el tamaño de la ventana no descoloca
 * a nadie.
 */

/** Una posición en la cuadrícula. El origen es la esquina de arriba a la izquierda. */
export interface Casilla {
  x: number;
  y: number;
}

/** El mapa de un combate. Sin imagen es una cuadrícula pelada, que también sirve. */
export interface Mapa {
  /** Imagen de la galería. `null` = sólo la cuadrícula. */
  imagenId: string | null;
  /** Cuántas casillas de ancho. El alto sale de la proporción de la imagen. */
  columnas: number;
  /**
   * Cuánto mide una casilla, si la mesa lo ha decidido.
   *
   * Va sin valor por defecto **a propósito**: Ánima no usa cuadrícula, así que no hay un
   * número oficial que poner aquí. Sin él se cuenta en casillas, que no se lo inventa
   * nadie; con él se enseñan además los metros.
   */
  metrosPorCasilla?: number;
  /**
   * Casillas tapadas, como «x,y». Los jugadores no ven lo que hay debajo, ni las fichas
   * que estén dentro.
   */
  niebla?: string[];
  /** Casillas marcadas con un color: «x,y» → color. Lo que significa lo decide la mesa. */
  marcas?: Record<string, string>;
}

/** La clave con la que se guarda una casilla. */
export function clave(x: number, y: number): string {
  return `${x},${y}`;
}

/** Los colores con los que se puede marcar. Lo que quiera decir cada uno, lo dice la mesa. */
export const COLORES_MARCA = [
  { id: 'rojo', nombre: 'Rojo', css: '#c0392b' },
  { id: 'azul', nombre: 'Azul', css: '#2e6fb7' },
  { id: 'verde', nombre: 'Verde', css: '#3d8b52' },
  { id: 'ambar', nombre: 'Ámbar', css: '#c9922b' },
] as const;

/**
 * Cuántas casillas hay de una a otra.
 *
 * Se cuentan las diagonales como una, que es como cuenta cualquiera cuando mira un tablero
 * y va diciendo «una, dos, tres». **Ánima no tiene reglas de cuadrícula**, así que esto no
 * es una regla del manual sino una cuenta: la aplicación dice cuántas casillas hay y qué
 * significa eso —si llegas, si te cuesta un asalto— lo decide la mesa.
 */
export function distancia(a: Casilla, b: Casilla): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** «3 casillas», y los metros al lado si la mesa ha dicho cuánto mide una. */
export function describeDistancia(casillas: number, metrosPorCasilla?: number): string {
  const cuenta = `${casillas} ${casillas === 1 ? 'casilla' : 'casillas'}`;
  if (!metrosPorCasilla || metrosPorCasilla <= 0) return cuenta;
  const metros = casillas * metrosPorCasilla;
  // Sin decimales cuando son redondos: «6 m» se lee mejor que «6,0 m».
  const texto = Number.isInteger(metros) ? String(metros) : metros.toFixed(1).replace('.', ',');
  return `${cuenta} · ${texto} m`;
}

/**
 * Las casillas de una línea entre dos, para pintar el rastro de un movimiento.
 *
 * Va en diagonal mientras pueda y luego recto, que es el camino que hace cualquiera con el
 * dedo sobre un tablero.
 */
export function camino(a: Casilla, b: Casilla): Casilla[] {
  const pasos: Casilla[] = [];
  let { x, y } = a;
  while (x !== b.x || y !== b.y) {
    x += Math.sign(b.x - x);
    y += Math.sign(b.y - y);
    pasos.push({ x, y });
  }
  return pasos;
}

/** Añade o quita una casilla de un conjunto guardado como lista de claves. */
export function alternar(claves: string[] | undefined, x: number, y: number): string[] {
  const k = clave(x, y);
  const actuales = claves ?? [];
  return actuales.includes(k) ? actuales.filter((c) => c !== k) : [...actuales, k];
}

export const COLUMNAS_POR_DEFECTO = 20;
/** Menos de 4 no es una cuadrícula y más de 60 son casillas donde no cabe un dedo. */
export const COLUMNAS_MINIMAS = 4;
export const COLUMNAS_MAXIMAS = 60;

export const MAPA_VACIO: Mapa = { imagenId: null, columnas: COLUMNAS_POR_DEFECTO };

export function columnasValidas(n: number): number {
  if (!Number.isFinite(n)) return COLUMNAS_POR_DEFECTO;
  return Math.max(COLUMNAS_MINIMAS, Math.min(COLUMNAS_MAXIMAS, Math.round(n)));
}

/**
 * Cuántas filas caben, para que las casillas salgan cuadradas.
 *
 * Si no se sabe lo que mide la imagen —todavía no ha cargado, o no hay— se usa una
 * proporción de 16:9, que es la de la mayoría de los mapas y la de casi cualquier pantalla.
 */
export function filasDe(columnas: number, anchura?: number, altura?: number): number {
  const proporcion = anchura && altura ? altura / anchura : 9 / 16;
  return Math.max(1, Math.round(columnas * proporcion));
}

/**
 * En qué casilla cae un punto, dado como fracción del mapa (0 a 1).
 *
 * Se recorta a la cuadrícula en vez de dejar salirse: al arrastrar con el dedo es normal
 * pasarse del borde, y que la ficha desaparezca del mapa por eso sería una tontería.
 */
export function casillaDesde(
  fraccionX: number,
  fraccionY: number,
  columnas: number,
  filas: number,
): Casilla {
  const dentro = (v: number, tope: number) =>
    Math.max(0, Math.min(tope - 1, Math.floor((Number.isFinite(v) ? v : 0) * tope)));
  return { x: dentro(fraccionX, columnas), y: dentro(fraccionY, filas) };
}

/** Los combatientes tal y como los necesita el mapa. */
export interface EnElMapa {
  id: string;
  tipo: 'personaje' | 'enemigo';
  x?: number;
  y?: number;
}

/**
 * Coloca a quien todavía no tenga sitio: los jugadores pegados al borde izquierdo y los
 * enemigos al derecho, que es como se empieza una escaramuza en una mesa de verdad.
 *
 * A quien ya esté puesto no se le toca. Si no cabe todo en una columna se sigue por la de
 * al lado, hacia dentro: apilar dos fichas en la misma casilla al empezar sería empezar ya
 * con trabajo.
 */
export function colocacionInicial<T extends EnElMapa>(
  combatientes: T[],
  columnas: number,
  filas: number,
): Map<string, Casilla> {
  const puestas = new Map<string, Casilla>();
  const ocupadas = new Set<string>();
  for (const c of combatientes) {
    if (c.x !== undefined && c.y !== undefined) ocupadas.add(`${c.x},${c.y}`);
  }

  const libre = (x: number, y: number) => !ocupadas.has(`${x},${y}`);

  for (const c of combatientes) {
    if (c.x !== undefined && c.y !== undefined) continue;
    const haciaDentro = c.tipo === 'enemigo' ? -1 : 1;
    const desde = c.tipo === 'enemigo' ? columnas - 1 : 0;

    let puesta: Casilla | null = null;
    // Se recorre columna a columna hacia el centro, y dentro de cada una de arriba abajo.
    for (let paso = 0; paso < columnas && !puesta; paso++) {
      const x = desde + paso * haciaDentro;
      if (x < 0 || x >= columnas) break;
      for (let y = 0; y < filas; y++) {
        if (libre(x, y)) { puesta = { x, y }; break; }
      }
    }
    // Con el mapa lleno se apila en el origen antes que dejar a alguien fuera.
    const sitio = puesta ?? { x: desde, y: 0 };
    puestas.set(c.id, sitio);
    ocupadas.add(`${sitio.x},${sitio.y}`);
  }
  return puestas;
}
