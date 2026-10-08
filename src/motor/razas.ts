/**
 * Lo que de una raza depende del personaje.
 *
 * La tabla de razas de la hoja de la comunidad (v8.7.0, `Tablas!J109:AC129`) no es fija en
 * todas sus filas: las resistencias del Duk'zarist dependen del sexo, el Vetala gana
 * características con el Éxtasis sanguíneo, el Ebudan cambia al cumplir su Sue'Aman, el
 * Tuan Dalyr al transformarse y con la fase lunar, y el Turak con sus rasgos de Cercanía con
 * El Dragón. Lo que guarda el catálogo es la fila con las opciones por defecto (hombre,
 * nada activo); aquí se le aplican las del personaje, con las mismas fórmulas.
 */
import type { Raza } from '../datos/tipos';
import type { TipoDano } from './combate';

export const TRANSFORMACION_TUAN_DALYR = ['FUE', 'DES', 'AGI', 'PER'] as const;
export const CERCANIA_DRAGON = [
  'Descomunales', 'Alas de dragón', 'Ojos de cazador', 'Cola', 'Anfibios', 'Escamas de metal',
] as const;
export const EXTASIS_VETALA = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'] as const;

/** Las casillas de raza de la pestaña Personalización de la hoja. */
export interface OpcionesRaza {
  /** Vetala: característica del Éxtasis sanguíneo (`G45`) y si está en él ahora (`G46`). */
  extasis?: (typeof EXTASIS_VETALA)[number];
  extasisActivo?: boolean;
  /** Vetala (no Nephilim): bono nocturno, +1 FUE y +1 POD (`G47`). */
  nocturno?: boolean;
  /** Vetala: bien alimentado, Regeneración +4 (+1 el Nephilim) (`G48`). */
  bienAlimentado?: boolean;
  /** Ebudan: Sue'Aman cumplido (`E50`): ajuste de nivel 3, +2 POD y +2 VOL. */
  sueAman?: boolean;
  /** Ebudan con el Sue'Aman cumplido: trascendido (`E52`), Natura 30. */
  trascendido?: boolean;
  /** Tuan Dalyr: transformado (`L50`) y lo que gana en cada característica (`N49:Q49`). */
  transformado?: boolean;
  transformacion?: Partial<Record<(typeof TRANSFORMACION_TUAN_DALYR)[number], number>>;
  /** Tuan Dalyr: fase lunar (`P50`). En la opuesta pierde todo lo racial. */
  faseLunar?: 'Afín' | 'Neutra' | 'Opuesta';
  /** Turak: rasgos de Cercanía con El Dragón, hasta tres (`C40:C42`). */
  cercaniaDragon?: string[];
}

/** La fila de la raza con las opciones del personaje ya aplicadas. */
export function razaDelPersonaje(
  raza: Raza | undefined,
  sexo: string | undefined,
  o: OpcionesRaza = {},
): Raza | undefined {
  if (!raza) return raza;
  const r: Raza = { ...raza };
  const nombre = raza.raza;
  const sumar = (campo: keyof Raza, valor: number) => {
    (r as unknown as Record<string, number>)[campo as string] = Number(r[campo] ?? 0) + valor;
  };

  // `Tablas!K114`, `N124`: el Duk'zarist (y su Nephilim) resiste mejor lo físico si es
  // hombre y lo mágico si es mujer.
  if ((nombre === "Duk'zarist" || nombre === "Nephilim Duk'zarist") && sexo === 'Mujer') {
    const { RF, RM } = r;
    r.RF = RM;
    r.RM = RF;
  }

  // `Tablas!Q126:Z126` y la fila del Nephilim, `Q116:Z116`.
  if (nombre === 'Vetala' || nombre === 'Nephilim Vetala') {
    if (o.extasisActivo && o.extasis) sumar(o.extasis, 1);
    if (nombre === 'Vetala' && o.nocturno) {
      sumar('FUE', 1);
      sumar('POD', 1);
    }
    if (o.bienAlimentado) sumar('regeneracion', nombre === 'Vetala' ? 4 : 1);
  }

  // `Tablas!P122`, `W122`, `X122`, `AB122`. Lo cumplido sólo cuenta para el Ebudan.
  if (nombre === 'Ebudan' && o.sueAman) {
    r.ajusteNivel = 3;
    sumar('POD', 2);
    sumar('VOL', 2);
    if (o.trascendido) r.natura = 30;
  }

  // `Tablas!N127:AC127`. Con la fase lunar opuesta no queda nada racial; en la afín cada
  // bono de transformación da uno más.
  if (nombre === 'Tuan Dalyr') {
    if (o.faseLunar === 'Opuesta') {
      for (const c of ['RM', 'RP', 'AGI', 'DES', 'FUE', 'INT', 'PER', 'VOL', 'tamano'] as const) r[c] = 0;
      r.descripciones = 'Fase lunar opuesta: Sin ventajas raciales';
    } else if (o.transformado) {
      const afin = o.faseLunar === 'Afín' ? 1 : 0;
      const bono = (c: (typeof TRANSFORMACION_TUAN_DALYR)[number]) =>
        o.transformacion?.[c] ? o.transformacion[c]! + afin : 0;
      sumar('RM', -10);
      sumar('RP', -10);
      sumar('AGI', bono('AGI'));
      sumar('DES', bono('DES'));
      sumar('FUE', bono('FUE'));
      sumar('INT', -2);
      sumar('PER', bono('PER'));
      sumar('VOL', -2);
      // El tamaño crece con lo que gana de Fuerza (`Y127`).
      sumar('tamano', bono('FUE'));
    }
  }

  // `Tablas!P128:Y128`.
  if (nombre === 'Turak') {
    const rasgos = (o.cercaniaDragon ?? []).filter(Boolean);
    const descomunales = rasgos.includes('Descomunales');
    r.ajusteNivel = rasgos.length > 1 ? 2 : 1;
    r.AGI = descomunales ? -1 : 0;
    r.CON = descomunales ? 2 : 1;
    r.FUE = descomunales ? 2 : 1;
    r.INT = rasgos.length > 2 ? 0 : -1;
    r.tamano = descomunales ? 6 : 2;
  }
  return r;
}

/** Los Tuan Dalyr no pueden repartir más de 3 puntos de transformación (`Personalización!I51`). */
export function avisosRaza(raza: Raza | undefined, o: OpcionesRaza = {}): string[] {
  const avisos: string[] = [];
  if (raza?.raza === 'Tuan Dalyr' && o.transformado) {
    const total = Object.values(o.transformacion ?? {}).reduce((t, v) => t + (v ?? 0), 0);
    if (total > 3) avisos.push('Exceso de bonos de transformación: no pueden pasar de 3.');
  }
  if (raza?.raza === 'Tuan Dalyr' && o.faseLunar === 'Opuesta') {
    avisos.push('Fase lunar opuesta: sin poderes raciales.');
  }
  return avisos;
}

/**
 * Las escamas: el Turak tiene TA 2 contra Filo, Contundente, Penetrante y Calor (3 con
 * Escamas de metal), y el Nephilim Turak 1. Es una capa natural más (`Combate!AY26:BB26`).
 */
export function armaduraRacial(raza: Raza | undefined, o: OpcionesRaza = {}): Partial<Record<TipoDano, number>> {
  const ta =
    raza?.raza === 'Turak' ? ((o.cercaniaDragon ?? []).includes('Escamas de metal') ? 3 : 2)
      : raza?.raza === 'Nephilim Turak' ? 1
        : 0;
  return ta ? { FIL: ta, CON: ta, PEN: ta, CAL: ta } : {};
}
