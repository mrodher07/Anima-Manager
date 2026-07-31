import { useRef, useState } from 'react';
import { nivelTotalDe, type Personaje } from '../motor/personaje';
import { analizarImportacion, exportarPersonaje, exportarTodo, importar } from '../almacen/almacen';

interface Props {
  personajes: Personaje[];
  cargando: boolean;
  onAbrir: (id: string) => void;
  onCrear: () => void;
  onBorrar: (id: string) => void;
  onRecargar: () => void;
}

function descargar(nombre: string, contenido: unknown) {
  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function VistaPersonajes({ personajes, cargando, onAbrir, onCrear, onBorrar, onRecargar }: Props) {
  const archivo = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'aviso'; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const importarArchivo = async (f: File) => {
    try {
      const analisis = await analizarImportacion(JSON.parse(await f.text()));
      if (!analisis.ok) {
        setMensaje({ tipo: 'error', texto: analisis.error });
        return;
      }
      const { exportacion, conflictos } = analisis;
      let sobrescribir = false;
      if (conflictos.length > 0) {
        sobrescribir = window.confirm(
          `Ya tienes ${conflictos.length} de estas fichas: ${conflictos.join(', ')}.\n\n` +
            'Aceptar las sobrescribe. Cancelar importa sólo las nuevas.',
        );
      }
      const n = await importar(exportacion, sobrescribir);
      onRecargar();
      setMensaje({
        tipo: 'aviso',
        texto: `Importadas ${n} fichas${conflictos.length && !sobrescribir ? `, ${conflictos.length} omitidas por conflicto` : ''}.`,
      });
    } catch {
      setMensaje({ tipo: 'error', texto: 'El archivo no es un JSON válido.' });
    }
  };

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Personajes</h2>
        <div className="acciones-regla" style={{ marginTop: 0 }}>
          <button className="accion primaria" onClick={onCrear}>Nuevo personaje</button>
          <button
            className="accion"
            onClick={async () => descargar('anima-manager.json', await exportarTodo())}
            title="Incluye las fichas, las campañas y los retratos"
            disabled={personajes.length === 0}
          >
            Exportar todo
          </button>
          <button className="accion" onClick={() => archivo.current?.click()}>Importar</button>
          <input
            ref={archivo}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importarArchivo(f);
              e.target.value = '';
            }}
          />
        </div>
        {mensaje && (
          <div className={`aviso ${mensaje.tipo}`} style={{ marginTop: 12 }}>{mensaje.texto}</div>
        )}
      </section>

      {cargando ? (
        <p style={{ color: 'var(--texto-tenue)' }}>Cargando fichas…</p>
      ) : personajes.length === 0 ? (
        <div className="vacio panel">
          <h2>Aún no hay fichas</h2>
          <p>
            Crea tu primer personaje o importa un archivo que hayas exportado antes.
            Todo se guarda en este dispositivo. Al exportar se incluye el retrato, para que la
            ficha llegue completa a quien la reciba.
          </p>
        </div>
      ) : (
        <div className="rejilla">
          {personajes.map((p) => (
            <article key={p.id} className="panel tarjeta">
              <h3>{p.nombre || 'Sin nombre'}</h3>
              <p className="subtitulo">
                {p.raza} · {p.categorias.filter((c) => c.nivel > 0).map((c) => c.categoria).join(' / ')} ·
                Nivel {nivelTotalDe(p)}
                {p.jugador && ` · ${p.jugador}`}
              </p>
              <div className="acciones-regla">
                <button className="accion primaria" onClick={() => onAbrir(p.id)}>Abrir</button>
                <button
                  className="accion"
                  onClick={async () => descargar(`${p.nombre || 'ficha'}.json`, await exportarPersonaje(p))}
                >
                  Exportar
                </button>
                {confirmar === p.id ? (
                  <>
                    <button
                      className="accion peligro"
                      onClick={() => { onBorrar(p.id); setConfirmar(null); }}
                    >
                      Confirmar borrado
                    </button>
                    <button className="accion" onClick={() => setConfirmar(null)}>Cancelar</button>
                  </>
                ) : (
                  <button className="accion" onClick={() => setConfirmar(p.id)}>Borrar</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
