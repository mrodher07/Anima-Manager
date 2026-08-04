/**
 * Temas visuales.
 *
 * Cada tema es un bloque de variables CSS en `estilos.css` bajo
 * `:root[data-tema='<id>']`. Aquí sólo vive el catálogo: qué temas hay, cómo se llaman y
 * en qué orden se ofrecen. Añadir uno nuevo es escribir su bloque de variables y una
 * entrada en esta lista.
 */

export interface Tema {
  id: string;
  nombre: string;
  descripcion: string;
  /** Emoji o símbolo para el selector. */
  icono: string;
  /** Le dice al navegador si los controles nativos van en claro u oscuro. */
  esquema: 'dark' | 'light';
}

export const TEMAS: readonly Tema[] = [
  {
    id: 'oscuro',
    nombre: 'Oscuro',
    descripcion: 'Fantasía oscura: violeta arcano y oro viejo. El de casa.',
    icono: '☾',
    esquema: 'dark',
  },
  {
    id: 'claro',
    nombre: 'Claro',
    descripcion: 'Pergamino claro, para jugar a plena luz.',
    icono: '☀',
    esquema: 'light',
  },
  {
    id: 'steampunk',
    nombre: 'Steampunk',
    descripcion: 'Latón, cobre y cardenillo sobre cuero oscuro.',
    icono: '⚙',
    esquema: 'dark',
  },
  {
    id: 'medieval',
    nombre: 'Medieval',
    descripcion: 'Pergamino, tinta ferrogálica y capitulares en bermellón.',
    icono: '⚔',
    esquema: 'light',
  },
];

export const TEMA_POR_DEFECTO = 'oscuro';

const CLAVE = 'anima-manager:tema';

export function temaGuardado(): string {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado && TEMAS.some((t) => t.id === guardado)) return guardado;
  } catch {
    // Navegar en privado puede bloquear localStorage; no es motivo para fallar.
  }
  return TEMA_POR_DEFECTO;
}

export function guardarTema(id: string): void {
  try {
    localStorage.setItem(CLAVE, id);
  } catch {
    // Si no se puede guardar, el tema sigue aplicándose en esta sesión.
  }
}

export function temaDe(id: string): Tema {
  return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
}

/** Aplica el tema al documento. */
export function aplicarTema(id: string): void {
  const tema = temaDe(id);
  document.documentElement.dataset.tema = tema.id;
  document.documentElement.style.colorScheme = tema.esquema;
}
