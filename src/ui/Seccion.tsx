import type { ReactNode } from 'react';

/**
 * «1 elegido», «3 elegidos», «ninguno». El plural se hace bien porque estos resúmenes se
 * leen constantemente mientras se crea un personaje, y un «1 elegidos» canta.
 */
export function cuenta(n: number, singular: string, plural: string, vacio = 'ninguno'): string {
  if (n === 0) return vacio;
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Un panel que se puede plegar.
 *
 * Nace de un problema concreto: al crear un personaje nuevo, la pestaña «Poderes» pintaba
 * cinco paneles seguidos —Teorema, Sheele, Metamagia, Conjuros, Psíquicos— cada uno con su
 * párrafo de explicación, y había que recorrer más de tres mil píxeles aunque el personaje
 * no tuviera ni una gota de magia. Lo mismo en Ventajas y en Equipo.
 *
 * La solución es la de siempre y no hace falta inventar nada: `<details>` y `<summary>`,
 * que el navegador ya sabe abrir, cerrar y leer en voz alta. Sin estado de React, sin
 * animaciones, sin recordar nada entre visitas.
 *
 * La regla para decidir qué se abre: **está abierto lo que el personaje usa**. Un mago ve
 * sus conjuros desplegados; alguien que no lanza magia ve una línea que dice «sin conjuros»
 * y sigue bajando. Nada se esconde —todo está a un toque— pero deja de estorbar.
 */
export function Seccion({
  titulo,
  resumen,
  abierta = true,
  ayuda,
  children,
}: {
  titulo: ReactNode;
  /** Lo que se lee sin abrir: «3 conjuros», «sin armadura». */
  resumen?: ReactNode;
  abierta?: boolean;
  /** La explicación larga. Se queda dentro, para que no compita con los controles. */
  ayuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="panel plegable" open={abierta}>
      <summary>
        <span className="titulo">{titulo}</span>
        {resumen !== undefined && <span className="resumen">{resumen}</span>}
      </summary>
      {ayuda && <p className="ayuda">{ayuda}</p>}
      {children}
    </details>
  );
}
