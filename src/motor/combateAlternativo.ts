/**
 * Sistemas de combate alternativos. *Los que Caminaron con Nosotros*, cap. 4.
 *
 * Son dos cosas muy distintas y por eso se tratan distinto:
 *
 *  - El **Combate Dramático** no cambia ninguna regla: sólo estira el tiempo que dura cada
 *    asalto para que un duelo entre leyendas se sienta épico. Se decide **por campaña**,
 *    porque el manual pide que todos lo sepan desde el principio del combate.
 *  - El **Combate de Masas** sí es un subsistema: convierte a un ejército entero en un solo
 *    contrincante con acumulación de daño. No hace falta activarlo en ningún sitio; se usa
 *    cuando hace falta, como cualquier otra herramienta de la mesa.
 *
 * El manual insiste en que ambos son **opcionales** y que sólo deben usarse cuando al
 * Director le convenga. Aquí eso se respeta: el dramático se elige, el de masas se ofrece.
 */

// ─────────────────────── Combate Dramático ───────────────────────

export type SistemaCombate = 'normal' | 'dramatico';

/** Lo que dura un asalto normal, en segundos. */
export const ASALTO_NORMAL = 3;
/** A partir de este asalto la duración se estabiliza en un minuto. */
export const ASALTO_ESTABLE = 5;

/**
 * Cuánto dura el asalto número `n` de un Combate Dramático.
 *
 * El primero dura lo normal —es la toma de contacto— y a partir de ahí se va **doblando**:
 * 3, 6, 12, 24… hasta que en el quinto se queda en un minuto para siempre.
 */
export function duracionAsalto(asalto: number, sistema: SistemaCombate = 'dramatico'): number {
  if (sistema === 'normal' || asalto <= 1) return ASALTO_NORMAL;
  if (asalto >= ASALTO_ESTABLE) return 60;
  return ASALTO_NORMAL * 2 ** (asalto - 1);
}

/** «3 s», «24 s», «1 min», «1 min 45 s». */
export function duracionLegible(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

/**
 * Tope de duración que el manual recomienda según la habilidad media de los contendientes.
 * No es una regla dura: es una recomendación, y por eso devuelve un aviso, no un límite.
 */
export function topeRecomendado(habilidadMedia: number): { segundos: number; aviso: string } | null {
  if (habilidadMedia > 200) return null;
  if (habilidadMedia > 150) {
    return {
      segundos: 60,
      aviso:
        'Con una habilidad media de 200 o menos, el manual no recomienda pasar de un minuto ' +
        'por asalto.',
    };
  }
  return {
    segundos: 12,
    aviso:
      'Con una habilidad media de 150 o menos, el manual no recomienda pasar de doce ' +
      'segundos por asalto.',
  };
}

/**
 * Un asalto de un Combate Dramático vuelve a durar tres segundos mientras alguien está
 * apresado o paralizado, y el Director puede acortarlo siempre que la escena lo pida.
 */
export const NEUTRALIZAN_LA_DURACION =
  'Si un personaje es apresado o queda paralizado, el asalto siguiente vuelve a durar tres ' +
  'segundos y sigue así hasta que se resuelva la situación. El Director puede acortar un ' +
  'turno siempre que la escena lo pida.';

// ─────────────────────── Combate de Masas ───────────────────────

/** Tabla 1: bono a la Habilidad de Ataque según cuántos enemigos hay. */
export const BONO_POR_CANTIDAD: { desde: number; bono: number }[] = [
  { desde: 100, bono: 150 },
  { desde: 50, bono: 130 },
  { desde: 25, bono: 110 },
  { desde: 15, bono: 90 },
  { desde: 10, bono: 70 },
  { desde: 5, bono: 50 },
  { desde: 3, bono: 30 },
];

export function bonoPorCantidad(cuantos: number): number {
  return BONO_POR_CANTIDAD.find((f) => cuantos >= f.desde)?.bono ?? 0;
}

/** Tabla 2: multiplicador al daño de un ataque en área, según a cuántos alcance. */
export const MULTIPLICADOR_DANO: { desde: number; multiplicador: number }[] = [
  { desde: 1000, multiplicador: 25 },
  { desde: 100, multiplicador: 15 },
  { desde: 25, multiplicador: 10 },
  { desde: 10, multiplicador: 5 },
  { desde: 5, multiplicador: 4 },
  { desde: 3, multiplicador: 3 },
  { desde: 2, multiplicador: 2 },
];

/**
 * Multiplicador al daño por alcanzar a `alcanzados` enemigos.
 *
 * `total` es cuántos componen la masa, y hace falta porque el manual lo dice expresamente:
 * *«no se puede aplicar un Multiplicador al Daño superior al número de enemigos que compone
 * una masa»*. Un conjuro de medio kilómetro contra 8 adversarios se queda en ×4.
 */
export function multiplicadorDano(alcanzados: number, total = Infinity): number {
  const tope = MULTIPLICADOR_DANO.find((f) => total >= f.desde)?.multiplicador ?? 1;
  const propio = MULTIPLICADOR_DANO.find((f) => alcanzados >= f.desde)?.multiplicador ?? 1;
  return Math.min(propio, tope);
}

export interface Componente {
  /** Cuántos enemigos forman la masa. */
  cantidad: number;
  /** PV de **cada uno**. */
  puntosVida: number;
  ataque: number;
  defensa: number;
  dano: number;
  /** Media del TA de sus componentes; si no llevan armadura, 0. */
  TA: number;
  iniciativa: number;
  /** true si sus componentes son criaturas con acumulación de daño. */
  acumulacion?: boolean;
  /** Los conjuros y poderes sobrenaturales doblan el daño en vez de sumarle la mitad. */
  sobrenatural?: boolean;
}

export interface Masa {
  cantidad: number;
  /** Aguante total del conjunto. */
  puntosVida: number;
  /** Lo que aporta cada componente, para saber cuántos caen al recibir daño. */
  porComponente: number;
  ataque: number;
  bonoAtaque: number;
  /** No se tira: es la Defensa Final directamente. */
  defensa: number;
  dano: number;
  TA: number;
  iniciativa: number;
  avisos: string[];
}

/**
 * Aguante de una masa de enemigos.
 *
 * Las dos reglas del manual, que son distintas y es fácil confundirlas:
 *
 *  - **Criaturas normales**: se suman los PV de cada uno **redondeados a la baja en grupos
 *    de 50**. Pasados los 100 adversarios, cada uno más suma sólo 10 (o 25 si tiene más de
 *    250 PV).
 *  - **Criaturas con acumulación**: el primero aporta sus PV redondeados a la baja en
 *    grupos de **100**, y cada uno más aporta **la mitad** de eso. Pasados los 50, cada uno
 *    más suma 100 (o 250 si tiene más de 1.000 PV).
 */
export function aguanteDeMasa(c: Componente): { total: number; porComponente: number } {
  const n = Math.max(Math.trunc(c.cantidad), 0);
  if (n === 0) return { total: 0, porComponente: 0 };

  if (c.acumulacion) {
    const base = Math.floor(c.puntosVida / 100) * 100;
    const porExtra = base / 2;
    const dentro = Math.min(n, 50);
    let total = base + Math.max(dentro - 1, 0) * porExtra;
    const fuera = Math.max(n - 50, 0);
    total += fuera * (c.puntosVida > 1000 ? 250 : 100);
    return { total, porComponente: porExtra || base };
  }

  const base = Math.floor(c.puntosVida / 50) * 50;
  const dentro = Math.min(n, 100);
  let total = dentro * base;
  const fuera = Math.max(n - 100, 0);
  total += fuera * (c.puntosVida > 250 ? 25 : 10);
  return { total, porComponente: base };
}

/**
 * Convierte un grupo de enemigos iguales en el contrincante único que exige el sistema.
 *
 * `adversarios` es contra cuántos personajes lucha la masa: el manual obliga a **repartir**
 * sus miembros entre ellos para el bono de la Tabla 1, porque no pueden luchar todos contra
 * el mismo. Veinte guardias contra cuatro personajes atacan con +50, no con +90.
 */
export function construirMasa(c: Componente, adversarios = 1): Masa {
  const avisos: string[] = [];
  const n = Math.max(Math.trunc(c.cantidad), 0);
  const { total, porComponente } = aguanteDeMasa(c);

  const porAdversario = Math.floor(n / Math.max(adversarios, 1));
  const bono = bonoPorCantidad(porAdversario);
  if (adversarios > 1) {
    avisos.push(
      `Repartida entre ${adversarios} adversarios tocan ${porAdversario} enemigos por cada ` +
        `uno, así que el bono es +${bono} y no +${bonoPorCantidad(n)}.`,
    );
  }

  // El daño físico sube un 50 %; el sobrenatural se dobla.
  const dano = c.sobrenatural ? c.dano * 2 : Math.floor(c.dano * 1.5);

  avisos.push(
    'La masa no tira defensa: ese valor es su Defensa Final. Es inmune a los críticos, y ' +
      'nunca sufre penalizadores por ataques adicionales.',
  );
  if (c.TA === 0) {
    avisos.push('Sin armadura no hay TA: sus componentes no protegen lo que no llevan.');
  }

  return {
    cantidad: n,
    puntosVida: total,
    porComponente,
    ataque: c.ataque + bono,
    bonoAtaque: bono,
    defensa: c.defensa,
    dano,
    TA: c.TA,
    iniciativa: c.iniciativa,
    avisos,
  };
}

/**
 * Cuántos enemigos quedan en pie. Una masa **pierde componentes** conforme recibe daño, y
 * eso puede bajarle el bono de la Tabla 1 a mitad del combate.
 */
export function componentesRestantes(masa: Masa, pvActuales: number): number {
  if (masa.porComponente <= 0) return 0;
  return Math.max(Math.ceil(Math.max(pvActuales, 0) / masa.porComponente), 0);
}

export interface ResultadoResistencia {
  resultado: string;
  negativos: string;
  otrosEfectos: string;
}

/**
 * Qué le pasa a una masa cuando la alcanza un conjuro o poder de área.
 *
 * `margen` es por cuánto **supera** la Resistencia media del grupo: positivo si la salva,
 * negativo si la falla. Los poderes que sólo afectan a un individuo no hacen nada a una masa.
 */
export function efectoSobreMasa(margen: number): ResultadoResistencia {
  if (margen > 40) {
    return {
      resultado: 'Supera la Resistencia por más de 40',
      negativos: 'Ninguno.',
      otrosEfectos:
        'La gran mayoría la supera. Habrá algún afectado suelto, pero tan pocos que el ' +
        'conjunto no sufre secuelas.',
    };
  }
  if (margen >= 0) {
    return {
      resultado: 'Supera la Resistencia por menos de 40',
      negativos: 'A la mitad, redondeando hacia abajo, dentro del área cubierta.',
      otrosEfectos: 'Afecta a una tercera parte de los blancos que hubiera en el área.',
    };
  }
  if (margen >= -40) {
    return {
      resultado: 'Falla la Resistencia por menos de 40',
      negativos: 'A la mitad, redondeando hacia arriba, dentro del área cubierta.',
      otrosEfectos: 'Afecta a dos terceras partes de los blancos que hubiera en el área.',
    };
  }
  return {
    resultado: 'Falla la Resistencia por más de 40',
    negativos: 'Enteros.',
    otrosEfectos:
      'Prácticamente todos los miembros de la masa son víctimas del efecto lanzado.',
  };
}
