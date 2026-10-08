/**
 * Las casillas de raza de la pestaña Personalización, leídas como las escribe la hoja v8.7.0
 * (mismas filas y columnas relativas: `C39:C42`, `C45:G48`, `C50:E52`, `J49:Q50`).
 */
import { describe, expect, it } from 'vitest';
import { opcionesRazaDe } from './fichaComunidad';
import type { Celda, Hoja } from './xlsx';

function fila(celdas: Record<number, Celda>): Celda[] {
  const f: Celda[] = Array(20).fill(null);
  for (const [c, v] of Object.entries(celdas)) f[Number(c)] = v;
  return f;
}

/** Columnas como en la hoja: C=2, E=4, G=6, J=9, L=11, M=12, N..Q=13..16, P=15. */
function personalizacion(): Hoja {
  const filas: Celda[][] = [];
  // La zona auxiliar, con sus propios «Trascendido» y «Sue Aman conseguido» calculados.
  filas[0] = [...fila({}), ...Array(20).fill(null), 'Zona de tablas auxiliares'];
  filas[14] = [...fila({}), ...Array(20).fill(null), 'Trascendido', true];
  filas[38] = fila({ 2: 'Turak: Cercanía con El dragón' });
  filas[39] = fila({ 2: 'Descomunales' });
  filas[40] = fila({ 2: 'Escamas de metal' });
  filas[41] = fila({});
  filas[43] = fila({ 2: 'Vetala' });
  filas[44] = fila({ 2: 'Atributo éxtasis sanguíneo:', 6: '+1 FUE' });
  filas[45] = fila({ 2: 'Aplicar bono éxtasis:', 6: 'Sí' });
  filas[46] = fila({ 2: 'Aplicar bono nocturno:', 6: 'No' });
  filas[47] = fila({ 2: 'Aplicar bien alimentado:', 6: 'Sí' });
  filas[48] = fila({ 8: 'Tuan Dalyr', 9: 'Bonos de transformación:', 13: '+2 FUE', 15: '+1 AGI' });
  filas[49] = fila({ 2: "Ebudan:\nSue' Aman", 4: 'Cumplido', 9: 'Transformado:', 11: 'Sí', 12: 'Fase lunar actual:', 15: 'Afín' });
  filas[51] = fila({ 2: 'Trascendido', 4: 'No' });
  for (let i = 0; i < filas.length; i++) filas[i] ??= [];
  return { nombre: 'Personalización', filas };
}

describe('las opciones de raza de la hoja de la comunidad', () => {
  const hojas = [personalizacion()];

  it('Vetala: el Éxtasis sanguíneo y si está bien alimentado', () => {
    expect(opcionesRazaDe(hojas, 'Vetala')).toEqual({ extasis: 'FUE', extasisActivo: true, bienAlimentado: true });
  });

  it('Ebudan: el Sue’Aman, sin confundir «Trascendido» con el de la zona auxiliar', () => {
    expect(opcionesRazaDe(hojas, 'Ebudan')).toEqual({ sueAman: true });
  });

  it('Tuan Dalyr: transformado, sus bonos y la fase lunar', () => {
    expect(opcionesRazaDe(hojas, 'Tuan Dalyr')).toEqual({
      transformado: true, faseLunar: 'Afín', transformacion: { FUE: 2, AGI: 1 },
    });
  });

  it('Turak: los rasgos de Cercanía, debajo del rótulo', () => {
    expect(opcionesRazaDe(hojas, 'Turak')).toEqual({ cercaniaDragon: ['Descomunales', 'Escamas de metal'] });
  });

  it('una raza sin casillas no trae nada', () => {
    expect(opcionesRazaDe(hojas, 'Humano')).toBeUndefined();
  });
});
