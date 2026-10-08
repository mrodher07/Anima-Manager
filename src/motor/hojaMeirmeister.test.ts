/**
 * La hoja de Meirmeister, número a número.
 *
 * `personaje.test.ts` ya comprueba los valores gordos. Esto recorre **toda** la hoja tal y
 * como está transcrita en `data/personajes/meirmeister.json` y la compara con lo que
 * calcula la aplicación, para que ningún número de la ficha original se quede sin mirar.
 */
import { describe, expect, it } from 'vitest';
import hoja from '../../data/personajes/meirmeister.json';
import { calcular, personajeVacio, secundariaDeCatalogo, type DatosCalculo, type Personaje } from './personaje';
import razas from '../../data/reglas/razas.json';
import categorias from '../../data/reglas/categorias.json';
import tablasBase from '../../data/reglas/tablasBase.json';
import armasJson from '../../data/reglas/armas.json';
import armadurasJson from '../../data/reglas/armaduras.json';
import objetosJson from '../../data/reglas/objetos.json';
import secundariasJson from '../../data/reglas/secundarias.json';
import yelmosJson from '../../data/reglas/yelmos.json';
import ventajasJson from '../../data/reglas/ventajas.json';
import habilidadesKiJson from '../../data/reglas/habilidadesKi.json';
import artesMarcialesJson from '../../data/reglas/artesMarciales.json';
import arsMagnusJson from '../../data/reglas/arsMagnus.json';
import legadosJson from '../../data/reglas/legadosSangre.json';
import metamagiaJson from '../../data/reglas/metamagia.json';
import efectosTecnicaJson from '../../data/reglas/efectosTecnica.json';
import tiposEfectoJson from '../../data/reglas/tiposEfectoTecnica.json';
import type {
  Arma, Armadura, Categoria, EfectoTecnica, EntradaTabla, EsferaMetamagica, HabilidadKiCatalogo,
  LegadoSangre, Objeto, Raza, Secundaria, TablasBase, TipoEfectoTecnica, Ventaja, Yelmo,
} from '../datos/tipos';

const datos: DatosCalculo = {
  raza: (razas as Raza[]).find((r) => r.raza === 'Jayán'),
  categoria: (categorias as unknown as Categoria[]).find((c) => c.categoria === 'Paladín Oscuro (RD)'),
  categorias: categorias as unknown as Categoria[],
  tablas: tablasBase as unknown as TablasBase,
  armas: armasJson as Arma[],
  // Como `cargarDatosCalculo`: los yelmos son piezas de armadura con otra columna de nombre.
  armaduras: [
    ...(armadurasJson as Armadura[]),
    ...(yelmosJson as Yelmo[]).map(({ yelmo, ...resto }) => ({ ...resto, armadura: yelmo, esYelmo: true }) as Armadura),
  ],
  objetos: objetosJson as Objeto[],
  secundarias: (secundariasJson as Secundaria[]).map(secundariaDeCatalogo),
  ventajas: ventajasJson as Ventaja[],
  habilidadesKi: habilidadesKiJson as HabilidadKiCatalogo[],
  artesMarciales: artesMarcialesJson as EntradaTabla[],
  arsMagnus: arsMagnusJson as EntradaTabla[],
  legadosSangre: legadosJson as LegadoSangre[],
  metamagia: metamagiaJson as EsferaMetamagica[],
  efectosTecnica: efectosTecnicaJson as EfectoTecnica[],
  tiposEfectoTecnica: tiposEfectoJson as TipoEfectoTecnica[],
};

/** Meirmeister con lo que se rellena en la hoja, no con lo que la hoja calcula. */
export function meirmeisterDeLaHoja(): Personaje {
  const p = personajeVacio('meirmeister');
  p.nombre = 'Meirmeister';
  p.raza = 'Jayán';
  p.sexo = 'Hombre';
  p.categorias = [{ categoria: 'Paladín Oscuro (RD)', nivel: 1 }];
  p.caracteristicas = { AGI: 10, CON: 8, DES: 10, FUE: 10, INT: 4, PER: 5, POD: 4, VOL: 6 };
  p.pdInvertidos = { HAtaque: 150, HParada: 110, LlevarArmadura: 40, Acrobacias: 30, Atletismo: 20, Intimidar: 50 };
  p.habilidadesNaturales = ['Acrobacias', 'Atletismo', 'Intimidar', 'Advertir', 'Frialdad'];
  p.bonosEspeciales = { Intimidar: 15, Montar: 20, Nadar: 30, Pilotar: 15, Comercio: 10, LlevarArmadura: 5 };
  p.ventajas = ['Reflejos rápidos (2)'];
  p.desventajas = [...hoja.desventajas];
  p.experiencia = hoja.experiencia.actual;
  p.ki = { ...p.ki, arsMagnus: ['Berserker'] };
  p.equipo = {
    ...p.equipo,
    armadura: [{ armadura: 'Piezas' }, { armadura: 'Capucha de Malla' }],
    armas: [{ arma: 'Hacha a dos manos', aDosManos: true, conocimiento: 'Conocida', escala: 'Enorme' }],
    dinero: { MO: 0, MP: 12, MC: 36 },
  };
  return p;
}

const ficha = calcular(meirmeisterDeLaHoja(), datos);
const N = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const secundaria = (nombre: string) =>
  Object.entries(ficha.secundarias).find(([k]) => N(k) === N(nombre))?.[1]?.valor;

/*
 * Lo que todavía no se puede comprobar, y por qué. No son fallos escondidos: cada uno dice
 * qué falta para poder cerrarlo. Si alguno empieza a cuadrar, esta prueba avisa para que se
 * quite de aquí.
 */
const SIN_DATOS = 'El JSON sólo guarda el total: faltan los PD y los bonos especiales del jugador.';
export const PENDIENTES: Record<string, string> = {
  '· Estilo': SIN_DATOS, '· Advertir': SIN_DATOS, '· Buscar': SIN_DATOS, '· Memorizar': SIN_DATOS,
  '· Frialdad': SIN_DATOS, '· Proezas de Fuerza': SIN_DATOS, '· Disfraz': SIN_DATOS, '· Arte': SIN_DATOS,
};

/** Cada número de la hoja frente al de la aplicación. */
export function comparacion(): [string, unknown, unknown][] {
  const filas: [string, unknown, unknown][] = [];
  const c = (nombre: string, enHoja: unknown, app: unknown) => filas.push([nombre, enHoja, app]);
  for (const [k, v] of Object.entries(hoja.caracteristicas)) {
    if (k.startsWith('_')) continue;
    const x = v as { total: number; bono: number };
    const f = ficha.caracteristicas[k as keyof typeof ficha.caracteristicas];
    c(`${k} total`, x.total, f.total);
    c(`${k} bono`, x.bono, f.bono);
  }
  c('PV', hoja.derivados.puntosVida, ficha.puntosVida.valor);
  c('Cansancio', hoja.derivados.cansancio, ficha.cansancio.valor);
  c('Penalizador natural', hoja.derivados.penalizadorNatural, ficha.combate.proteccion.penalizadorNatural);
  c('Turno (sin arma)', hoja.derivados.iniciativaTurno.total, ficha.combate.turnoSinArma);
  c('Presencia', hoja.resistencias.presenciaBase, ficha.presencia.valor);
  for (const r of ['RF', 'RE', 'RV', 'RM', 'RP'] as const) c(r, hoja.resistencias[r].total, ficha.resistencias[r].valor);
  c('PD del nivel', hoja.desarrollo.PDsTotalesNivel, ficha.pdTotales);
  c('Límite combate', hoja.desarrollo.limiteHabilidadesCombate, ficha.limites.combate);
  c('Límite místicas', hoja.desarrollo.limiteHabilidadesMisticas, ficha.limites.misticas);
  c('Límite psíquicas', hoja.desarrollo.limiteHabilidadesPsiquicas, ficha.limites.psiquicas);
  const hc = hoja.habilidadesPrimarias.combate;
  c('H. Ataque', hc.HAtaque.total, ficha.combate.HAtaque.valor);
  c('H. Parada', hc.HParada.total, ficha.combate.HParada.valor);
  c('H. Esquiva', hc.HEsquiva.total, ficha.combate.HEsquiva.valor);
  c('Llevar armadura', hc.LlevarArmadura.total, ficha.combate.llevarArmadura.valor);
  c('Conocimiento Marcial', hc.conocimientoMarcial.total, ficha.ki.conocimientoMarcial.total);
  c('CM usado', hc.conocimientoMarcial.usado, ficha.ki.conocimientoMarcial.gastado);
  const hk = hoja.habilidadesPrimarias.ki;
  for (const k of ['AGI', 'CON', 'DES', 'FUE', 'POD', 'VOL'] as const) {
    c(`Ki ${k}`, hk.puntos[k], ficha.ki.puntos[k].total);
    c(`Acumulación ${k}`, hk.acumulacion[k], ficha.ki.acumulacion[k].total);
  }
  c('Ki total', hk.puntos.total, ficha.ki.reserva);
  c('Acumulación total', hk.acumulacion.total, ficha.ki.acumulacionTotal);
  const hm = hoja.habilidadesPrimarias.misticas;
  c('Zeón', hm.zeon, ficha.zeon.valor);
  c('ACT', hm.ACT, ficha.act.valor);
  c('Proyección mágica', hm.proyeccionMagica, ficha.proyeccionMagica.valor);
  c('Nivel de magia', hm.nivelMagia, ficha.nivelMagia.valor);
  c('Convocar', hm.convocar, ficha.invocacion.Convocar.valor);
  c('Controlar', hm.controlar, ficha.invocacion.Controlar.valor);
  c('Atar', hm.atar, ficha.invocacion.Atar.valor);
  c('Desconvocar', hm.desconvocar, ficha.invocacion.Desconvocar.valor);
  const hp = hoja.habilidadesPrimarias.psiquicas;
  const f = ficha as unknown as Record<string, { valor?: number } | undefined>;
  c('CV', hp.CV, f.cv?.valor);
  c('Proyección psíquica', hp.proyeccionPsiquica, ficha.proyeccionPsiquica.valor);
  c('Potencial psíquico', hp.potencialPsiquico, ficha.potencialPsiquico.valor);
  c('Regeneración', hoja.derivados.regeneracion, f.regeneracion?.valor);
  c('Movimiento', hoja.derivados.movimiento, f.movimiento?.valor);
  for (const grupo of Object.values(hoja.habilidadesSecundarias)) {
    if (typeof grupo !== 'object') continue;
    for (const [nombre, v] of Object.entries(grupo as Record<string, number | null>)) {
      if (v !== null) c(`· ${nombre}`, v, secundaria(nombre));
    }
  }
  const hacha = ficha.combate.armas[0];
  const ha = hoja.combate.armas[0];
  c('Hacha turno', ha.turno, hacha?.turno);
  c('Hacha ataque', ha.ataque, hacha?.ataque);
  c('Hacha defensa', ha.defensa, hacha?.parada);
  c('Hacha daño', ha.dano, hacha?.dano);
  c('Hacha críticos', ha.criticos.join('/'), hacha?.criticos.join('/'));
  c('TA', JSON.stringify(hoja.combate.armadura.TATotal), JSON.stringify(ficha.combate.proteccion.TA));
  c('Restricción de movimiento', hoja.combate.armadura.restriccionMovimiento, ficha.combate.proteccion.restriccionMovimiento);
  c('Requerimiento de armadura', hoja.combate.armadura.requisitoLlevarArmadura, ficha.combate.proteccion.requisito);
  c('Índice de peso', hoja.equipo.indicePeso, ficha.carga.indice);
  c('Peso natural', hoja.equipo.pesoNaturalKg, ficha.carga.natural);
  c('Peso máximo', hoja.equipo.pesoMaximoKg, ficha.carga.maximo);
  c('Experiencia', hoja.experiencia.actual, ficha.experiencia.actual);
  c('Experiencia siguiente nivel', hoja.experiencia.siguienteNivel, ficha.experiencia.siguienteNivel);
  return filas;
}

const filas = comparacion();

/**
 * Donde la hoja de Meirmeister (una versión anterior) y la v8.7.0 no dan lo mismo, manda la
 * v8.7.0: es la buena. Con lo que hay anotado, Atletismo sale 15, como en la v8.7.0
 * rellenada igual (`data/pruebas/hoja-v870.json`, escenario «meirmeister»); la original
 * decía 5.
 */
export const SEGUN_V870: Record<string, number> = { '· Atletismo': 15 };

describe('la hoja de Meirmeister, número a número', () => {
  it.each(filas.filter(([n]) => !(n in PENDIENTES) && !(n in SEGUN_V870)))(
    '%s: la hoja dice %s',
    (_n, enHoja, app) => {
      expect(String(app)).toBe(String(enHoja));
    },
  );

  it.each(Object.entries(SEGUN_V870))('%s: vale lo de la v8.7.0, %s', (n, v870) => {
    expect(filas.find(([x]) => x === n)?.[2]).toBe(v870);
  });

  it('lo pendiente sigue sin cuadrar; si cuadra, que se quite de la lista', () => {
    const yaCuadran = filas.filter(([n, a, b]) => n in PENDIENTES && String(a) === String(b)).map(([n]) => n);
    expect(yaCuadran).toEqual([]);
  });

  it('no hay pendientes de más: cada uno corresponde a un valor de la hoja', () => {
    const nombres = new Set(filas.map(([n]) => n));
    expect(Object.keys(PENDIENTES).filter((n) => !nombres.has(n))).toEqual([]);
  });

  it('la ficha no da avisos de error: los PD y los límites cuadran', () => {
    expect(ficha.avisos.filter((a) => a.gravedad === 'error')).toEqual([]);
  });
});
