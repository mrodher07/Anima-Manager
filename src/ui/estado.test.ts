import { describe, expect, it } from 'vitest';
import { fichasDe } from './estado';
import { personajeVacio, type Personaje } from '../motor/personaje';

const ficha = (id: string, propietario: string | null): Personaje => ({
  ...personajeVacio(id),
  nombre: id,
  propietario,
});

/**
 * El almacén local es del navegador, no de la cuenta: dos personas que entren en el mismo
 * ordenador acaban con sus fichas en la misma base de datos.
 */
describe('fichasDe', () => {
  const todas = [ficha('mia', 'ana'), ficha('ajena', 'bruno'), ficha('huerfana', null)];

  it('deja fuera las de otra cuenta', () => {
    expect(fichasDe(todas, 'ana').map((p) => p.id)).toEqual(['mia', 'huerfana']);
    expect(fichasDe(todas, 'bruno').map((p) => p.id)).toEqual(['ajena', 'huerfana']);
  });

  it('las que aún no tienen dueño son de quien esté dentro', () => {
    // Nacen así al crearlas sin haber entrado. Esconderlas sería perder trabajo hecho:
    // pasan a ser tuyas en la primera sincronización.
    expect(fichasDe(todas, 'ana').some((p) => p.id === 'huerfana')).toBe(true);
    expect(fichasDe(todas, 'bruno').some((p) => p.id === 'huerfana')).toBe(true);
  });

  it('sin sesión no se esconde nada', () => {
    // La aplicación funciona sin cuenta. Sin sesión no hay forma de saber de quién es cada
    // ficha, y filtrar dejaría a alguien sin las suyas por estar desconectado.
    expect(fichasDe(todas, null)).toEqual(todas);
  });

  it('no toca el orden ni copia de más', () => {
    expect(fichasDe(todas, null)).toBe(todas);
    expect(fichasDe([], 'ana')).toEqual([]);
  });
});
