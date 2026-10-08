/**
 * Importar una hoja de la comunidad **de verdad**: la v8.7.0, rellenada en LibreOffice con
 * un personaje que usa contenido propio de su mesa (`data/pruebas/hoja-v870-aldric.json`).
 *
 * Lo que se comprueba es lo que antes se perdía al importar: la pestaña Personalización
 * (ventajas, armas, armaduras… de la casa, y a qué habilidad va cada Apto en una materia)
 * y las columnas Hab., Bon. y Esp. de la pestaña PDs.
 */
import { describe, expect, it } from 'vitest';
import libro from '../../data/pruebas/hoja-v870-aldric.json';
import { deFichaComunidad } from './fichaExcel';
import { Catalogo, CORE_EXXET, mezclarPersonalizados, paquetePersonalizado, type Personalizados } from '../datos/paquetes';
import { calcular, cargarDatosCalculo } from '../motor/personaje';
import type { Hoja } from './xlsx';

const hojas = (libro as unknown as { hojas: Hoja[] }).hojas;

describe('una hoja v8.7.0 real, con contenido propio', () => {
  it('trae la pestaña Personalización al contenido propio', async () => {
    const r = await deFichaComunidad(hojas, 'aldric', new Catalogo([CORE_EXXET.id]));
    expect(r.personalizados?.ventajas).toEqual([
      { nombre: 'Ojo de halcón', coste: 1, tipo: 'Comunes', esDesventaja: false },
      { nombre: 'Manía rara', coste: -1, tipo: 'Comunes', esDesventaja: true },
    ]);
    expect(r.personalizados?.armas?.[0]).toMatchObject({
      arma: 'Espada de la casa', dano: 55, turno: 5, fueRequerida: 6, critico1: 'FIL', critico2: 'CON',
    });
    // Su «Atrib.» está vacío, así que suma el bono de FUE; el «CON» de al lado es su crítico.
    expect(r.personalizados?.armas?.[0].atributoDano).toBeUndefined();
    expect(r.personalizados?.armaduras?.[0]).toMatchObject({
      armadura: 'Cota de la casa', requerimiento: 10, penNatural: -5, clase: 'Blanda', CON: 3, PEN: 2,
    });
    expect(r.personalizados?.habilidadesEsenciales).toEqual([{ nombre: 'Instinto de la casa', gnosis: 0, coste: 10 }]);
    // Los huecos sin usar de la hoja («Arma #2», «Ventaja personalizada #3»…) no se traen.
    expect(JSON.stringify(r.personalizados)).not.toMatch(/#\d/);
  });

  it('el personaje elige lo propio igual que lo del manual', async () => {
    const { personaje: p } = await deFichaComunidad(hojas, 'aldric', new Catalogo([CORE_EXXET.id]));
    expect(p.nombre).toBe('Aldric de la Casa');
    expect(p.ventajas).toEqual(['Apto en una materia (1)', 'Ojo de halcón']);
    expect(p.desventajas).toEqual(['Manía rara']);
    expect(p.equipo.armadura).toEqual([{ armadura: 'Cota de la casa' }]);
  });

  it('trae a qué habilidad va cada ventaja y las columnas Hab., Bon. y Esp.', async () => {
    const { personaje: p } = await deFichaComunidad(hojas, 'aldric', new Catalogo([CORE_EXXET.id]));
    expect(p.eleccionesVentajas).toEqual({ 'Apto en una materia (1)': ['Medicina'] });
    expect(p.habilidadesNaturales).toEqual(['Advertir']);
    expect(p.bonosNaturales).toEqual({ Acrobacias: 1 });
    expect(p.bonosEspeciales).toMatchObject({ Intimidar: 15 });
    expect(p.pdInvertidos).toMatchObject({ HAtaque: 100, HParada: 80, Advertir: 10, Medicina: 20 });
  });

  it('con lo propio en la campaña, la ficha calcula lo mismo que la hoja', async () => {
    const r = await deFichaComunidad(hojas, 'aldric', new Catalogo([CORE_EXXET.id]));
    const { personalizados } = mezclarPersonalizados({}, r.personalizados as Personalizados);
    const catalogo = new Catalogo([CORE_EXXET.id], [paquetePersonalizado(personalizados)]);
    const ficha = calcular(r.personaje, await cargarDatosCalculo(r.personaje, catalogo));
    // La hoja, con Apto en una materia (1) en Medicina: 20 PD a coste 2 = 10, +5 de INT 7.
    expect(ficha.secundarias['Medicina'].valor).toBe(15);
    expect(ficha.secundariasSinUso).not.toContain('Medicina');
    // Ojo de halcón (1 PC) y Apto en una materia (1) (1 PC), contra Manía rara (+1 PC).
    expect(ficha.puntosCreacion.gastados).toBe(2);
    expect(ficha.puntosCreacion.ganados).toBe(1);
    expect(ficha.combate.proteccion.requisito).toBe(10);
  });
});

describe('mezclar contenido propio', () => {
  it('añade lo nuevo y no pisa lo que ya había con el mismo nombre', () => {
    const actual: Personalizados = { ventajas: [{ nombre: 'Ojo de halcón', coste: 2, tipo: 'Comunes' }] as never };
    const nuevo: Personalizados = {
      ventajas: [
        { nombre: 'Ojo de halcón', coste: 1, tipo: 'Comunes' },
        { nombre: 'Manía rara', coste: -1, tipo: 'Comunes' },
      ] as never,
      armas: [{ arma: 'Espada de la casa', dano: 55 }] as never,
    };
    const { personalizados, anadidos } = mezclarPersonalizados(actual, nuevo);
    expect(anadidos).toBe(2);
    expect(personalizados.ventajas?.map((v) => [v.nombre, v.coste])).toEqual([['Ojo de halcón', 2], ['Manía rara', -1]]);
    expect(personalizados.armas?.[0].arma).toBe('Espada de la casa');
  });
});
