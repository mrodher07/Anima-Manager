/**
 * Evaluador de expresiones acotado.
 *
 * Permite que una mesa reescriba las fórmulas del reglamento sin abrir la puerta a
 * ejecutar JavaScript arbitrario: una fórmula editada por un jugador acaba corriendo en
 * el navegador del máster cuando este abre su ficha, así que `eval` no es una opción.
 *
 * Soporta: números, variables, + - * / %, paréntesis, comparaciones, `? :`,
 * y las funciones registradas en `FUNCIONES`. Nada más.
 */

export type Contexto = Record<string, number | boolean>;

export class ErrorDeFormula extends Error {
  constructor(mensaje: string, readonly posicion?: number) {
    super(mensaje);
    this.name = 'ErrorDeFormula';
  }
}

type Fn = (...args: number[]) => number;

/** Funciones disponibles dentro de una fórmula. */
export const FUNCIONES: Record<string, Fn> = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  abs: (a) => Math.abs(a),
  redondear: (a) => Math.round(a),
  techo: (a) => Math.ceil(a),
  suelo: (a) => Math.floor(a),
  /** Trunca hacia cero, como TRUNC de Excel. Ojo: difiere de `suelo` en negativos. */
  truncar: (a) => Math.trunc(a),
  /** Redondea a la baja al múltiplo indicado. FLOOR(x; m) de Excel. */
  multiploInferior: (a, m) => (m === 0 ? 0 : Math.floor(a / m) * m),
  signo: (a) => Math.sign(a),
};

// ─────────────────────────── Analizador léxico ───────────────────────────

type Tipo = 'num' | 'id' | 'op' | '(' | ')' | ',' | 'fin';
interface Token {
  tipo: Tipo;
  valor: string;
  pos: number;
}

const OPERADORES = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '<', '>', '?', ':'];

function tokenizar(entrada: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < entrada.length) {
    const c = entrada[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(entrada[i + 1] ?? ''))) {
      let j = i;
      while (j < entrada.length && /[0-9.]/.test(entrada[j])) j++;
      const texto = entrada.slice(i, j);
      if ((texto.match(/\./g) ?? []).length > 1) {
        throw new ErrorDeFormula(`Número mal formado: "${texto}"`, i);
      }
      tokens.push({ tipo: 'num', valor: texto, pos: i });
      i = j;
      continue;
    }
    if (/[A-Za-z_áéíóúüñÁÉÍÓÚÜÑ]/.test(c)) {
      let j = i;
      while (j < entrada.length && /[A-Za-z0-9_.áéíóúüñÁÉÍÓÚÜÑ]/.test(entrada[j])) j++;
      tokens.push({ tipo: 'id', valor: entrada.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (c === '(' || c === ')' || c === ',') {
      tokens.push({ tipo: c as Tipo, valor: c, pos: i });
      i++;
      continue;
    }
    const op = OPERADORES.find((o) => entrada.startsWith(o, i));
    if (op) {
      tokens.push({ tipo: 'op', valor: op, pos: i });
      i += op.length;
      continue;
    }
    throw new ErrorDeFormula(`Carácter no permitido: "${c}"`, i);
  }
  tokens.push({ tipo: 'fin', valor: '', pos: entrada.length });
  return tokens;
}

// ──────────────────────────── Árbol sintáctico ────────────────────────────

export type Nodo =
  | { t: 'num'; v: number }
  | { t: 'var'; nombre: string }
  | { t: 'bin'; op: string; izq: Nodo; der: Nodo }
  | { t: 'un'; op: string; arg: Nodo }
  | { t: 'cond'; test: Nodo; si: Nodo; no: Nodo }
  | { t: 'llamada'; nombre: string; args: Nodo[] };

/** Precedencia de operadores binarios; mayor number = liga más fuerte. */
const PRECEDENCIA: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

export function analizar(entrada: string): Nodo {
  const tokens = tokenizar(entrada);
  let p = 0;
  const actual = () => tokens[p];
  const consumir = (valor?: string): Token => {
    const t = tokens[p];
    if (valor !== undefined && t.valor !== valor) {
      throw new ErrorDeFormula(`Se esperaba "${valor}" y se encontró "${t.valor || 'el final'}"`, t.pos);
    }
    p++;
    return t;
  };

  function primario(): Nodo {
    const t = actual();
    if (t.tipo === 'num') {
      consumir();
      return { t: 'num', v: Number(t.valor) };
    }
    if (t.tipo === 'op' && (t.valor === '-' || t.valor === '+')) {
      consumir();
      return { t: 'un', op: t.valor, arg: primario() };
    }
    if (t.tipo === '(') {
      consumir('(');
      const n = ternario();
      consumir(')');
      return n;
    }
    if (t.tipo === 'id') {
      consumir();
      if (actual().tipo === '(') {
        consumir('(');
        const args: Nodo[] = [];
        if (actual().tipo !== ')') {
          args.push(ternario());
          while (actual().tipo === ',') {
            consumir(',');
            args.push(ternario());
          }
        }
        consumir(')');
        return { t: 'llamada', nombre: t.valor, args };
      }
      return { t: 'var', nombre: t.valor };
    }
    throw new ErrorDeFormula(`Expresión incompleta cerca de "${t.valor || 'el final'}"`, t.pos);
  }

  function binario(minPrec: number): Nodo {
    let izq = primario();
    for (;;) {
      const t = actual();
      if (t.tipo !== 'op') break;
      const prec = PRECEDENCIA[t.valor];
      if (prec === undefined || prec < minPrec) break;
      consumir();
      const der = binario(prec + 1);
      izq = { t: 'bin', op: t.valor, izq, der };
    }
    return izq;
  }

  function ternario(): Nodo {
    const test = binario(1);
    if (actual().tipo === 'op' && actual().valor === '?') {
      consumir('?');
      const si = ternario();
      consumir(':');
      const no = ternario();
      return { t: 'cond', test, si, no };
    }
    return test;
  }

  const arbol = ternario();
  if (actual().tipo !== 'fin') {
    throw new ErrorDeFormula(`Sobra "${actual().valor}" al final de la fórmula`, actual().pos);
  }
  return arbol;
}

// ───────────────────────────── Evaluación ─────────────────────────────

function aNumero(v: number | boolean): number {
  return typeof v === 'boolean' ? (v ? 1 : 0) : v;
}

function evaluarNodo(n: Nodo, ctx: Contexto): number {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var': {
      if (!(n.nombre in ctx)) {
        throw new ErrorDeFormula(`Variable desconocida: "${n.nombre}"`);
      }
      return aNumero(ctx[n.nombre]);
    }
    case 'un': {
      const v = evaluarNodo(n.arg, ctx);
      return n.op === '-' ? -v : v;
    }
    case 'cond':
      return evaluarNodo(n.test, ctx) !== 0 ? evaluarNodo(n.si, ctx) : evaluarNodo(n.no, ctx);
    case 'llamada': {
      const fn = FUNCIONES[n.nombre];
      if (!fn) throw new ErrorDeFormula(`Función desconocida: "${n.nombre}"`);
      return fn(...n.args.map((a) => evaluarNodo(a, ctx)));
    }
    case 'bin': {
      const a = evaluarNodo(n.izq, ctx);
      const b = evaluarNodo(n.der, ctx);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
          if (b === 0) throw new ErrorDeFormula('División por cero');
          return a / b;
        case '%':
          if (b === 0) throw new ErrorDeFormula('División por cero');
          return a % b;
        case '<': return a < b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
        case '&&': return a !== 0 && b !== 0 ? 1 : 0;
        case '||': return a !== 0 || b !== 0 ? 1 : 0;
        default:
          throw new ErrorDeFormula(`Operador no soportado: "${n.op}"`);
      }
    }
  }
}

const cacheArboles = new Map<string, Nodo>();

/** Compila (con caché) y evalúa una fórmula contra un contexto de variables. */
export function evaluar(formula: string, ctx: Contexto): number {
  let arbol = cacheArboles.get(formula);
  if (!arbol) {
    arbol = analizar(formula);
    cacheArboles.set(formula, arbol);
  }
  return evaluarNodo(arbol, ctx);
}

/** Valida una fórmula sin evaluarla. Devuelve las variables que necesita. */
export function validar(formula: string): { ok: true; variables: string[] } | { ok: false; error: string } {
  try {
    const arbol = analizar(formula);
    const vars = new Set<string>();
    const recorrer = (n: Nodo): void => {
      switch (n.t) {
        case 'var': vars.add(n.nombre); break;
        case 'bin': recorrer(n.izq); recorrer(n.der); break;
        case 'un': recorrer(n.arg); break;
        case 'cond': recorrer(n.test); recorrer(n.si); recorrer(n.no); break;
        case 'llamada': n.args.forEach(recorrer); break;
      }
    };
    recorrer(arbol);
    return { ok: true, variables: [...vars] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
