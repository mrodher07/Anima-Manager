import { useEffect, useRef, useState } from 'react';
import { TEMAS, temaDe } from './temas';

/** Menú para elegir entre los temas disponibles. */
export function SelectorTema({ tema, onCambiar }: { tema: string; onCambiar: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const actual = temaDe(tema);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  return (
    <div className="selector-tema" ref={contenedor}>
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Tema: ${actual.nombre}. Cambiar tema`}
        title={`Tema: ${actual.nombre}`}
      >
        {actual.icono}
        <span className="nombre-tema">{actual.nombre}</span>
      </button>

      {abierto && (
        <menu>
          {TEMAS.map((t) => (
            <li key={t.id}>
              <button
                aria-current={t.id === tema}
                onClick={() => {
                  onCambiar(t.id);
                  setAbierto(false);
                }}
              >
                {t.icono} {t.nombre}
                <span>{t.descripcion}</span>
              </button>
            </li>
          ))}
        </menu>
      )}
    </div>
  );
}
