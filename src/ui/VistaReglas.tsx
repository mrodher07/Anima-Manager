import { useState } from 'react';
import { REGLAS, Reglamento, definicion, type ClaveRegla, type DefinicionRegla } from '../motor/reglamento';
import { validar } from '../motor/expresiones';

interface Props {
  reglamento: Reglamento;
  onCambiar: (nuevo: Reglamento) => void;
}

function EditorRegla({
  def,
  reglamento,
  onCambiar,
}: {
  def: DefinicionRegla;
  reglamento: Reglamento;
  onCambiar: (nuevo: Reglamento) => void;
}) {
  const vigente = reglamento.formula(def.clave);
  const [borrador, setBorrador] = useState(vigente);
  const [error, setError] = useState<string | null>(null);
  const activa = reglamento.estaActiva(def.clave);
  const modificada = reglamento.estaPersonalizada(def.clave);
  const sucio = borrador !== vigente;

  const guardar = () => {
    try {
      onCambiar(reglamento.conFormula(def.clave, borrador));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const restablecer = () => {
    const nuevo = reglamento.restablecer(def.clave);
    setBorrador(nuevo.formula(def.clave));
    setError(null);
    onCambiar(nuevo);
  };

  const comprobacion = validar(borrador);

  return (
    <article className="regla">
      <header>
        <h3>{def.nombre}</h3>
        {modificada && <span className="etiqueta-pill modificada">Regla casera</span>}
        {!activa && <span className="etiqueta-pill desactivada">Desactivada</span>}
        {!def.desactivable && <span className="etiqueta-pill">Estructural</span>}
      </header>

      <textarea
        className="formula"
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        spellCheck={false}
        disabled={!activa}
        aria-label={`Fórmula de ${def.nombre}`}
      />

      {!comprobacion.ok && <p className="error-formula">Sintaxis: {comprobacion.error}</p>}
      {error && <p className="error-formula">{error}</p>}

      <div className="variables">
        Variables:{' '}
        {Object.entries(def.variables).map(([nombre, desc], i) => (
          <span key={nombre}>
            {i > 0 && ' · '}
            <code title={desc}>{nombre}</code>
          </span>
        ))}
      </div>

      <p className="referencia">{def.referencia}</p>

      <div className="acciones-regla">
        <button className="accion primaria" onClick={guardar} disabled={!sucio || !comprobacion.ok || !activa}>
          Guardar fórmula
        </button>
        <button className="accion" onClick={restablecer} disabled={!modificada && activa}>
          Restablecer
        </button>
        {def.desactivable && (
          <button className="accion" onClick={() => onCambiar(reglamento.activar(def.clave, !activa))}>
            {activa ? 'Desactivar regla' : 'Activar regla'}
          </button>
        )}
      </div>
    </article>
  );
}

export function VistaReglas({ reglamento, onCambiar }: Props) {
  const cambios = reglamento.cambios();
  const grupos = [...new Set(REGLAS.map((r) => r.grupo))];

  return (
    <div>
      <section className="panel" style={{ marginBottom: 18 }}>
        <h2>Reglas de la mesa</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', margin: '0 0 12px' }}>
          Cada mesa juega distinto. Aquí puedes reescribir cualquier fórmula o desactivar las
          reglas opcionales. Se guarda sólo lo que cambies, así que las reglas que no toques
          seguirán actualizándose con las correcciones del manual.
        </p>

        {cambios.length === 0 ? (
          <p style={{ color: 'var(--texto-debil)', fontSize: '0.88rem', margin: 0 }}>
            Ahora mismo juegas con las reglas oficiales del Core Exxet, sin modificaciones.
          </p>
        ) : (
          <>
            <p style={{ fontSize: '0.88rem', margin: '0 0 10px' }}>
              {cambios.length} {cambios.length === 1 ? 'regla modificada' : 'reglas modificadas'}:{' '}
              {cambios.map((c) => `${c.nombre} (${c.motivo})`).join(', ')}.
            </p>
            <button className="accion" onClick={() => onCambiar(reglamento.restablecerTodo())}>
              Restablecer todas las reglas
            </button>
          </>
        )}
      </section>

      {grupos.map((grupo) => (
        <section key={grupo} style={{ marginBottom: 22 }}>
          <h2
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--oro)',
              marginBottom: 10,
            }}
          >
            {grupo}
          </h2>
          {REGLAS.filter((r) => r.grupo === grupo).map((r) => (
            <EditorRegla
              key={r.clave}
              def={definicion(r.clave as ClaveRegla)}
              reglamento={reglamento}
              onCambiar={onCambiar}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
