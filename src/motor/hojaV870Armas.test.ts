/**
 * Las armas de la aplicación contra la hoja de la comunidad, versión 8.7.0.
 *
 * `data/pruebas/hoja-v870-armas.json` lo ha calculado la propia hoja (`tools/oraculo-hoja.py
 * --armas`): cada arma del catálogo en manos del mismo guerrero, a una y a dos manos, con y
 * sin calidad; las de proyectiles con cada una de sus municiones; las del Zodiaco con y sin
 * su Ars Magnus; las Armas naturales de cada raza; armas Enormes y Gigantes; y el Ki que
 * suma al arma. Aquí se empuña lo mismo en la aplicación y se compara casilla a casilla.
 */
import { describe, expect, it } from 'vitest';
import hoja from '../../data/pruebas/hoja-v870-armas.json';
import { calcular, personajeVacio, type Caracteristica, type Personaje } from './personaje';
import { datosDelManual } from './datosDePrueba';
import armasJson from '../../data/reglas/armas.json';
import type { Arma } from '../datos/tipos';

const DATOS_ARMAS = armasJson as Arma[];
import type { ArmaEquipada, EscalaArma, HabilidadesArma } from './combate';

interface PersonajeArmas {
  raza: string;
  categoria: string;
  nivel: number;
  caracteristicas: Record<Caracteristica, number>;
  pd: Record<string, number>;
  ventajas?: string[];
  arsMagnus?: string[];
  ki?: string[];
}

interface Caso {
  personaje?: Partial<PersonajeArmas>;
  arma: {
    hueco: number;
    arma: string;
    aDosManos: boolean;
    calidad: number;
    escala?: EscalaArma;
    municion?: string;
    calidadMunicion?: number;
  };
  hoja: Record<string, string | number | null>;
}

const datos = hoja as unknown as { personaje: PersonajeArmas; armas: Record<string, Caso> };

/** Los Legados de Sangre van en la hoja entre las ventajas, con su grado: «Armas Naturales (1)». */
const LEGADO = /^(.*) \(\d\)$/;

/**
 * Las armas del Zodiaco que además piden conocer otras armas (Leo, Taurus, Scorpio,
 * Ophiucos): el guerrero del oráculo no las conoce, así que la hoja las da por Distintas.
 * La aplicación no lleva la cuenta de qué armas conoce cada cual —lo marca el jugador en
 * cada una—, así que aquí el jugador la marca como Distinta y se mira que salga el aviso.
 */
const CATALOGO = DATOS_ARMAS;
const pideOtrasArmas = (arma: string) => !!CATALOGO.find((a) => a.arma === arma)?.requiereArmas;

function personajeDe(caso: Caso): Personaje {
  const e = { ...datos.personaje, ...(caso.personaje ?? {}) };
  const p = personajeVacio('armas');
  p.raza = e.raza;
  p.categorias = [{ categoria: e.categoria, nivel: e.nivel }];
  p.caracteristicas = { ...e.caracteristicas };
  p.pdInvertidos = { ...e.pd };
  p.legados = (e.ventajas ?? []).map((v) => v.match(LEGADO)?.[1] ?? v);
  p.ki = { ...p.ki, arsMagnus: e.arsMagnus ?? [], habilidades: e.ki ?? [] };
  const { hueco: _hueco, ...arma } = caso.arma;
  const equipada: ArmaEquipada = {
    ...arma,
    conocimiento: pideOtrasArmas(arma.arma) && e.arsMagnus?.length ? 'Distinta' : 'Conocida',
  };
  p.equipo = { ...p.equipo, armas: [equipada] };
  return p;
}

/** Lo mismo que lee el oráculo, del arma calculada por la aplicación. */
function lecturas(a: HabilidadesArma, hueco: number): Record<string, unknown> {
  const salida: Record<string, unknown> = {
    turno: a.turno,
    ataque: a.ataque,
    defensa: a.defensa,
    tipoDefensa: a.tipoDefensa === 'Parada' ? 'Par' : 'Esq',
    dano: a.dano,
    conocimiento: a.conocimiento,
    criticos: a.criticos.join('/'),
  };
  if (hueco === 1) Object.assign(salida, { entereza: a.entereza, rotura: a.rotura, presencia: a.presencia });
  return salida;
}

const CONOCIMIENTOS = ['Conocida', 'Similar', 'Mixta', 'Distinta'];

function enLaHoja(h: Caso['hoja']): Record<string, unknown> {
  const { critico1, critico2, ...resto } = h;
  const salida: Record<string, unknown> = {
    ...resto,
    // La hoja escribe «CON » con un espacio en el Bec de Corbin.
    criticos: [critico1, critico2].map((c) => String(c ?? '').trim()).filter((c) => c && c !== '-').join('/'),
  };
  // «-»: la hoja no ha podido decidir entre Parada y Esquiva (y deja la defensa a 0).
  if (salida.tipoDefensa === '-') delete salida.tipoDefensa;
  // Las filas de munición no tienen conocimiento: la hoja lee una casilla vacía.
  if (!CONOCIMIENTOS.includes(String(salida.conocimiento))) delete salida.conocimiento;
  // Una rotura que no es número (las armas de asedio): la hoja da error, la aplicación «-».
  if (salida.rotura === null) salida.rotura = '-';
  return salida;
}

const DATOS = datosDelManual('Humano', 'Guerrero');
const porRaza = new Map<string, ReturnType<typeof datosDelManual>>();
const datosDe = (raza: string) => {
  if (!porRaza.has(raza)) porRaza.set(raza, datosDelManual(raza, 'Guerrero'));
  return raza === 'Humano' ? DATOS : porRaza.get(raza)!;
};

export function compararArma(clave: string): [string, unknown, unknown][] {
  const caso = datos.armas[clave];
  const p = personajeDe(caso);
  const arma = calcular(p, datosDe(p.raza)).combate.armas[0];
  const app = lecturas(arma, caso.arma.hueco);
  return Object.entries(enLaHoja(caso.hoja))
    .filter(([k]) => k in app)
    .map(([k, v]) => [k, v, app[k]]);
}

describe('las armas de la aplicación frente a la hoja v8.7.0', () => {
  for (const clave of Object.keys(datos.armas)) {
    it(clave, () => {
      const distintos = compararArma(clave).filter(([, a, b]) => String(a) !== String(b));
      expect(distintos).toEqual([]);
    });
  }

  it('avisa de que Leo, Taurus, Scorpio y Ophiucos piden conocer otras armas', () => {
    const p = personajeDe(datos.armas['Leo (Espada-Pistola) · A una mano · con Ars Magnus']);
    p.equipo.armas[0].conocimiento = 'Conocida';
    const arma = calcular(p, DATOS).combate.armas[0];
    expect(arma.conocimiento).toBe('Conocida');
    expect(arma.avisos.join(' ')).toContain('Pistola');
  });

  it('sin su Ars Magnus, un arma del Zodiaco es Distinta aunque el jugador diga otra cosa', () => {
    const p = personajeDe(datos.armas['Aries · A una mano · +0']);
    const arma = calcular(p, DATOS).combate.armas[0];
    expect(arma.conocimiento).toBe('Distinta');
    expect(arma.avisos.join(' ')).toContain('Aries: Masificación armas y cadenas');
  });
});
