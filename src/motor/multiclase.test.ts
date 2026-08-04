import { describe, it, expect } from 'vitest';
import { costeCambio, pdPorNivel, resumirMulticlase } from './multiclase';
import categoriasJson from '../../data/reglas/categorias.json';
import type { Categoria } from '../datos/tipos';

const categorias = categoriasJson as unknown as Categoria[];
const buscar = (n: string) => categorias.find((c) => c.categoria === n);

describe('puntos de desarrollo por nivel', () => {
  it('da 600 al crear el personaje y +100 por nivel', () => {
    // `PDs!T7` de la ficha: 500 + 100 × nivel. No son 600 por nivel.
    expect(pdPorNivel(1)).toBe(600);
    expect(pdPorNivel(2)).toBe(700);
    expect(pdPorNivel(5)).toBe(1000);
  });

  it('encaja con el ejemplo del manual: 30 PD de Proyección por nivel', () => {
    // Un hechicero tiene 0.6 de límite mágico. Nivel 1: 600×0.6/2 = 180.
    // Al subir a nivel 2 gana 100 PD: 700×0.6/2 = 210, es decir +30.
    const limite = (n: number) => Math.trunc((pdPorNivel(n) * 0.6) / 2);
    expect(limite(1)).toBe(180);
    expect(limite(2) - limite(1)).toBe(30);
  });
});

describe('coste de cambiar de categoría', () => {
  it('cuesta 20 si alguna es Novel', () => {
    expect(costeCambio(buscar('Novel'), buscar('Hechicero'))).toBe(20);
  });

  it('cuesta 20 entre categorías del mismo arquetipo combinado', () => {
    // Guerrero y Maestro en Armas son ambos Luchador/Sin.
    expect(costeCambio(buscar('Guerrero'), buscar('Maestro en Armas'))).toBe(20);
  });

  it('cuesta 40 si comparten uno de sus arquetipos', () => {
    // Guerrero (Luchador/Sin) y Warlock (Luchador/Místico) comparten Luchador.
    expect(costeCambio(buscar('Guerrero'), buscar('Warlock'))).toBe(40);
  });

  it('cuesta 60 si no tienen nada en común', () => {
    // Guerrero (Luchador/Sin) y Mentalista (Psíquico/Sin): dos «Sin» no cuentan.
    expect(costeCambio(buscar('Guerrero'), buscar('Mentalista'))).toBe(60);
  });

  it('la ventaja Versátil deja el coste a la mitad', () => {
    expect(costeCambio(buscar('Guerrero'), buscar('Mentalista'), true)).toBe(30);
  });
});

describe('resumen de multiclase', () => {
  it('un personaje de una sola categoría no paga cambios', () => {
    const r = resumirMulticlase([{ categoria: 'Guerrero', nivel: 3 }], categorias);
    expect(r.nivelTotal).toBe(3);
    expect(r.pdTotales).toBe(800);
    expect(r.pdEnCambios).toBe(0);
    expect(r.pdDisponibles).toBe(800);
    expect(r.categoriaActual).toBe('Guerrero');
  });

  it('descuenta el coste de cada cambio de los PD disponibles', () => {
    const r = resumirMulticlase(
      [{ categoria: 'Guerrero', nivel: 3 }, { categoria: 'Mentalista', nivel: 2 }],
      categorias,
    );
    expect(r.nivelTotal).toBe(5);
    expect(r.pdTotales).toBe(1000);
    expect(r.pdEnCambios).toBe(60);
    expect(r.pdDisponibles).toBe(940);
    expect(r.categoriaActual).toBe('Mentalista');
  });

  it('la categoría actual es la última con niveles', () => {
    const r = resumirMulticlase(
      [
        { categoria: 'Guerrero', nivel: 2 },
        { categoria: 'Warlock', nivel: 2 },
        { categoria: 'Hechicero', nivel: 0 },
      ],
      categorias,
    );
    expect(r.categoriaActual).toBe('Warlock');
  });

  it('avisa si se cambia de categoría con un solo nivel hecho', () => {
    const r = resumirMulticlase(
      [
        { categoria: 'Guerrero', nivel: 2 },
        { categoria: 'Warlock', nivel: 1 },
        { categoria: 'Hechicero', nivel: 2 },
      ],
      categorias,
    );
    expect(r.avisos.some((a) => a.includes('al menos 2'))).toBe(true);
  });

  it('avisa si una categoría aparece repetida', () => {
    const r = resumirMulticlase(
      [{ categoria: 'Guerrero', nivel: 2 }, { categoria: 'Guerrero', nivel: 2 }],
      categorias,
    );
    expect(r.avisos.some((a) => a.includes('más de una vez'))).toBe(true);
  });
});

describe('ficha en blanco', () => {
  it('el nivel cuenta aunque no se haya elegido categoría', () => {
    // En la ficha, Nivel_Total es SUM(S7:S16): suma los niveles sin mirar la categoría.
    const r = resumirMulticlase([{ categoria: '', nivel: 1 }], categorias);
    expect(r.nivelTotal).toBe(1);
    expect(r.pdTotales).toBe(600);
    expect(r.pdEnCambios).toBe(0);
    expect(r.categoriaActual).toBe('');
  });
});
