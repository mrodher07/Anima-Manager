import { describe, it, expect } from 'vitest';
import { traducir } from './cuenta';

/**
 * Los mensajes de error de Supabase llegan en inglés y en jerga. Se prueban porque son lo
 * único que verá alguien que no consiga entrar, y un «Invalid login credentials» en mitad
 * de una aplicación en castellano no ayuda a nadie.
 */
describe('traducir', () => {
  it('explica una contraseña equivocada sin decir cuál de los dos campos falla', () => {
    // A propósito: decir «ese correo no existe» le confirmaría a cualquiera qué correos
    // están registrados.
    expect(traducir('Invalid login credentials')).toBe('El correo o la contraseña no son correctos.');
  });

  it('avisa de que falta confirmar el correo', () => {
    expect(traducir('Email not confirmed')).toContain('confirmado el correo');
  });

  it('sugiere entrar cuando la cuenta ya existe', () => {
    expect(traducir('User already registered')).toContain('Ya hay una cuenta');
  });

  it('saca el mínimo real de la contraseña del mensaje', () => {
    expect(traducir('Password should be at least 8 characters')).toBe(
      'La contraseña tiene que tener al menos 8 caracteres.',
    );
  });

  it('cae a 6 si el servidor no dice el mínimo', () => {
    expect(traducir('Password should be at least X characters')).toContain('al menos 6');
  });

  it('reconoce un fallo de red', () => {
    expect(traducir('TypeError: Failed to fetch')).toContain('¿Hay conexión?');
  });

  it('deja pasar lo que no sabe traducir en vez de tragárselo', () => {
    // Un «ha habido un error» genérico no deja investigar nada.
    expect(traducir('unexpected_failure: something odd')).toBe('unexpected_failure: something odd');
  });
});
