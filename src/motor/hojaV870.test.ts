/**
 * La aplicación contra la hoja de cálculo de la comunidad, versión 8.7.0.
 *
 * Los números de `data/pruebas/hoja-v870.json` no los ha escrito nadie: los ha calculado la
 * propia hoja, abierta en LibreOffice con `tools/oraculo-hoja.py`, después de rellenar en
 * ella cada personaje de `data/pruebas/escenarios.json` como lo haría un jugador. Cada
 * escenario ejercita un grupo de ventajas o de reglas, y aquí se rellena el mismo personaje
 * en la aplicación y se compara casilla a casilla.
 */
import { describe, expect, it } from 'vitest';
import escenarios from '../../data/pruebas/escenarios.json';
import hoja from '../../data/pruebas/hoja-v870.json';
import { calcular, personajeVacio, type Caracteristica, type FichaCalculada, type Personaje } from './personaje';
import { datosDelManual } from './datosDePrueba';
import type { OpcionesRaza } from './razas';

interface Escenario {
  id: string;
  nota: string;
  raza: string;
  sexo?: string;
  categoria: string;
  nivel?: number;
  caracteristicas: Record<Caracteristica, number>;
  ventajas?: string[];
  desventajas?: string[];
  materias?: Record<string, string[]>;
  pd?: Record<string, number>;
  naturales?: string[];
  bonosNaturales?: Record<string, number>;
  especiales?: Record<string, number>;
  armadura?: { armadura: string; calidad?: number }[];
  yelmo?: { yelmo: string; calidad?: number };
  armas?: { arma: string; aDosManos?: boolean; escala?: 'Normal' | 'Enorme' | 'Gigante' }[];
  estado?: { cansancioActual?: number; pvActuales?: number };
  opcionesRaza?: OpcionesRaza;
}

export function personajeDe(e: Escenario): Personaje {
  const p = personajeVacio(e.id);
  p.nombre = e.id;
  p.raza = e.raza;
  p.sexo = e.sexo === 'Mujer' ? 'Mujer' : 'Hombre';
  p.categorias = [{ categoria: e.categoria, nivel: e.nivel ?? 1 }];
  p.caracteristicas = { ...e.caracteristicas };
  p.ventajas = [...(e.ventajas ?? [])];
  p.desventajas = [...(e.desventajas ?? [])];
  p.pdInvertidos = { ...(e.pd ?? {}) };
  p.habilidadesNaturales = [...(e.naturales ?? [])];
  p.bonosNaturales = { ...(e.bonosNaturales ?? {}) };
  p.bonosEspeciales = { ...(e.especiales ?? {}) };
  p.eleccionesVentajas = { ...(e.materias ?? {}) };
  p.estado = { ...p.estado, ...(e.estado ?? {}) };
  if (e.opcionesRaza) p.opcionesRaza = { ...e.opcionesRaza };
  p.equipo = {
    ...p.equipo,
    armadura: [
      ...(e.armadura ?? []).map((a) => ({ armadura: a.armadura, calidad: a.calidad })),
      ...(e.yelmo ? [{ armadura: e.yelmo.yelmo, calidad: e.yelmo.calidad }] : []),
    ],
    // El oráculo la pone como «arma desarrollada», que es lo que la hace conocida.
    armas: (e.armas ?? []).map((a) => ({ ...a, conocimiento: 'Conocida' as const })),
  };
  return p;
}

const N = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lo mismo que lee el oráculo, sacado de la ficha de la aplicación. */
export function lecturas(f: FichaCalculada): Record<string, unknown> {
  const salida: Record<string, unknown> = {
    PV: f.puntosVida.valor,
    Cansancio: f.cansancio.valor,
    Turno: f.combate.turnoSinArma,
    Presencia: f.presencia.valor,
    Tamaño: f.combate.tamano,
    Regeneración: f.regeneracion?.valor,
    Movimiento: f.movimiento?.valor,
    HAtaque: f.combate.HAtaque.valor,
    HParada: f.combate.HParada.valor,
    HEsquiva: f.combate.HEsquiva.valor,
    LlevarArmadura: f.combate.llevarArmadura.valor,
    CM: f.ki.conocimientoMarcial.total,
    Zeon: f.zeon.valor,
    ACT: f.act.valor,
    ProyeccionMagica: f.proyeccionMagica.valor,
    NivelMagia: f.nivelMagia.valor,
    Convocar: f.invocacion.Convocar.valor,
    Controlar: f.invocacion.Controlar.valor,
    Atar: f.invocacion.Atar.valor,
    Desconvocar: f.invocacion.Desconvocar.valor,
    CV: f.cv?.valor,
    ProyeccionPsiquica: f.proyeccionPsiquica.valor,
    PotencialPsiquico: f.potencialPsiquico.valor,
    Ki: f.ki.reserva,
    PenalizadorNatural: f.combate.proteccion.penalizadorNatural,
    PenalizadorAccionFisica: f.combate.proteccion.penalizadorAccionFisica,
    Requisito: f.combate.proteccion.requisito,
  };
  for (const r of ['RF', 'RE', 'RV', 'RM', 'RP'] as const) salida[r] = f.resistencias[r].valor;
  for (const [c, v] of Object.entries(f.ki.acumulacion)) salida[`Acumulación ${c}`] = v.total;
  salida['Regeneración zeónica'] = f.regeneracionZeonica?.valor;
  // Sin arma la hoja deja esas casillas a 0.
  const arma = f.combate.armas[0];
  salida['Arma turno'] = arma?.turno ?? 0;
  salida['Arma ataque'] = arma?.ataque ?? 0;
  salida['Arma defensa'] = arma?.parada ?? 0;
  salida['Arma daño'] = arma?.dano ?? 0;
  for (const [c, v] of Object.entries(f.caracteristicas)) {
    salida[`${c} total`] = v.total;
    salida[`${c} bono`] = v.bono;
  }
  for (const [t, v] of Object.entries(f.combate.proteccion.TA)) salida[`TA ${t}`] = v ?? 0;
  for (const [n, v] of Object.entries(f.secundarias)) {
    salida[`· ${n}`] = f.secundariasSinUso?.includes(n) ? '-' : v.valor;
  }
  return salida;
}

const resultados = (hoja as { escenarios: Record<string, Record<string, unknown>> }).escenarios;

export function comparar(e: Escenario): [string, unknown, unknown][] {
  const ficha = calcular(personajeDe(e), datosDelManual(e.raza, e.categoria));
  const app = lecturas(ficha);
  const appN = new Map(Object.entries(app).map(([k, v]) => [N(k), v]));
  return Object.entries(resultados[e.id]).map(([k, enHoja]) => [k, enHoja, appN.get(N(k))]);
}

describe('la aplicación frente a la hoja v8.7.0', () => {
  for (const e of escenarios as unknown as Escenario[]) {
    it(`${e.id}: ${e.nota}`, () => {
      const distintos = comparar(e).filter(([, a, b]) => String(a) !== String(b));
      expect(distintos).toEqual([]);
    });
  }
});
