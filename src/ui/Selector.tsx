import { useMemo, useState } from 'react';

interface Props<T> {
  /** Todas las opciones disponibles. */
  opciones: T[];
  /** Nombre único de cada opción. */
  claveDe: (o: T) => string;
  /** Texto secundario que se muestra a la derecha. */
  detalleDe?: (o: T) => string;
  /** Agrupador opcional (vía de magia, disciplina, tipo de ventaja…). */
  grupoDe?: (o: T) => string;
  seleccionadas: string[];
  onCambiar: (seleccionadas: string[]) => void;
  etiquetaBusqueda: string;
  vacio?: string;
}

/**
 * Selector con búsqueda para listas largas: 292 ventajas, 640 conjuros, 125 poderes.
 * Muestra primero lo ya elegido para que no se pierda de vista al filtrar.
 */
export function Selector<T>({
  opciones,
  claveDe,
  detalleDe,
  grupoDe,
  seleccionadas,
  onCambiar,
  etiquetaBusqueda,
  vacio = 'No hay nada que elegir todavía.',
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('');
  const [grupo, setGrupo] = useState('');

  const grupos = useMemo(
    () => (grupoDe ? [...new Set(opciones.map(grupoDe).filter(Boolean))].sort() : []),
    [opciones, grupoDe],
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return opciones.filter((o) => {
      if (grupo && grupoDe && grupoDe(o) !== grupo) return false;
      if (!texto) return true;
      return claveDe(o).toLowerCase().includes(texto);
    });
  }, [opciones, busqueda, grupo, claveDe, grupoDe]);

  const alternar = (clave: string) =>
    onCambiar(
      seleccionadas.includes(clave)
        ? seleccionadas.filter((s) => s !== clave)
        : [...seleccionadas, clave],
    );

  if (opciones.length === 0) {
    return <p style={{ color: 'var(--texto-debil)' }}>{vacio}</p>;
  }

  return (
    <div>
      <div className="rejilla" style={{ marginBottom: 12 }}>
        <div className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor={`buscar-${etiquetaBusqueda}`}>{etiquetaBusqueda}</label>
          <input
            id={`buscar-${etiquetaBusqueda}`}
            type="search"
            placeholder="Escribe para filtrar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {grupos.length > 0 && (
          <div className="campo" style={{ marginBottom: 0 }}>
            <label htmlFor={`grupo-${etiquetaBusqueda}`}>Grupo</label>
            <select id={`grupo-${etiquetaBusqueda}`} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">Todos</option>
              {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}
      </div>

      {seleccionadas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {seleccionadas.map((s) => (
            <button key={s} className="accion" onClick={() => alternar(s)} title="Quitar">
              {s} ✕
            </button>
          ))}
        </div>
      )}

      <div className="lista-seleccion">
        {filtradas.slice(0, 120).map((o) => {
          const clave = claveDe(o);
          const elegida = seleccionadas.includes(clave);
          return (
            <label key={clave} className={elegida ? 'elegida' : undefined}>
              <input type="checkbox" checked={elegida} onChange={() => alternar(clave)} />
              <span>{clave}</span>
              {detalleDe && <em>{detalleDe(o)}</em>}
            </label>
          );
        })}
        {filtradas.length > 120 && (
          <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', padding: '6px 10px', margin: 0 }}>
            Se muestran 120 de {filtradas.length}. Afina la búsqueda para ver el resto.
          </p>
        )}
        {filtradas.length === 0 && (
          <p style={{ color: 'var(--texto-debil)', padding: '6px 10px', margin: 0 }}>
            Nada coincide con «{busqueda}».
          </p>
        )}
      </div>
    </div>
  );
}
