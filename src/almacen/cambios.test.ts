import { describe, expect, it } from 'vitest';
import { alCambiar, avisarCambio, type Cambio } from './cambios';

describe('el aviso de que algo ha cambiado', () => {
  const guardado: Cambio = { tipo: 'guardado', tienda: 'combates', registro: { id: 'k', actualizadoEn: 'x' } };

  it('llega a quien escucha, y deja de llegar al dejar de escuchar', () => {
    const recibidos: Cambio[] = [];
    const dejar = alCambiar((c) => recibidos.push(c));
    avisarCambio(guardado);
    dejar();
    avisarCambio(guardado);
    expect(recibidos).toEqual([guardado]);
  });

  it('un oyente que falla no impide que les llegue a los demás', () => {
    const recibidos: Cambio[] = [];
    const dejarA = alCambiar(() => { throw new Error('roto'); });
    const dejarB = alCambiar((c) => recibidos.push(c));
    expect(() => avisarCambio({ tipo: 'otro', tienda: 'imagenes' })).not.toThrow();
    expect(recibidos).toHaveLength(1);
    dejarA(); dejarB();
  });

  it('sin nadie escuchando no pasa nada, que es la aplicación sin nube', () => {
    expect(() => avisarCambio(guardado)).not.toThrow();
  });
});
