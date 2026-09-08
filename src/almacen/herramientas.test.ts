import { describe, expect, it } from 'vitest';
import { usaCombate, usaMapa, type Campana } from './almacen';

const mesa = (herramientas?: Campana['herramientas']): Campana => ({
  id: 'c',
  propietario: null,
  actualizadoEn: '2026-01-01T00:00:00.000Z',
  nombre: 'La Cruzada',
  paquetes: [],
  herramientas,
  ajustes: {},
  notasSesion: [],
});

/**
 * Nada de esto es una regla de Ánima: son ayudas, y una mesa tiene que poder no usarlas.
 */
describe('herramientas de la mesa', () => {
  it('sin decir nada, están activas', () => {
    // Es lo que había antes de existir el ajuste: apagarle a alguien algo que ya estaba
    // usando sería peor que ofrecerlo de más.
    expect(usaCombate(mesa())).toBe(true);
    expect(usaMapa(mesa())).toBe(true);
    expect(usaCombate(mesa({}))).toBe(true);
    expect(usaMapa(mesa({}))).toBe(true);
  });

  it('se pueden apagar por separado', () => {
    expect(usaCombate(mesa({ combate: false }))).toBe(false);
    expect(usaMapa(mesa({ mapa: false }))).toBe(false);
    // El mapa apagado no se lleva por delante el combate.
    expect(usaCombate(mesa({ mapa: false }))).toBe(true);
  });

  it('sin combate no hay mapa, aunque el mapa esté encendido', () => {
    expect(usaMapa(mesa({ combate: false, mapa: true }))).toBe(false);
  });

  it('sin campaña responde lo mismo que una recién creada', () => {
    // La pregunta es «¿esta mesa lo usa?», y una campaña que todavía no ha cargado no es
    // una mesa que haya dicho que no. Quien necesite exigir campaña lo comprueba aparte:
    // eso lo hace la pantalla, que sin campaña activa no enseña combate ninguno.
    expect(usaCombate(null)).toBe(true);
    expect(usaMapa(undefined)).toBe(true);
  });
});
