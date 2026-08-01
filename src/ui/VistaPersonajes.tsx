import { useRef, useState } from 'react';
import { nivelTotalDe, type Personaje } from '../motor/personaje';
import { almacen, analizarImportacion, exportarPersonaje, exportarTodo, importar } from '../almacen/almacen';
import { exportarAExcel, importarDeExcel } from '../almacen/fichaExcel';
import { ErrorExcel } from '../almacen/xlsx';

interface Props {
  personajes: Personaje[];
  /** Para poder generar un id nuevo al importar una ficha como copia. */
  nuevoId: () => string;
  cargando: boolean;
  onAbrir: (id: string) => void;
  onCrear: () => void;
  onBorrar: (id: string) => void;
  onRecargar: () => void;
}

function bajar(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function descargar(nombre: string, contenido: unknown) {
  bajar(nombre, new Blob([JSON.stringify(contenido, null, 2)], { type: 'application/json' }));
}

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Nombre de archivo sin caracteres que molesten a ningún sistema. */
function nombreArchivo(p: Personaje, extension: string): string {
  const base = (p.nombre || 'ficha').replace(/[\\/:*?"<>|]/g, '-').trim();
  return `${base || 'ficha'}.${extension}`;
}

export function VistaPersonajes({
  personajes,
  cargando,
  nuevoId,
  onAbrir,
  onCrear,
  onBorrar,
  onRecargar,
}: Props) {
  const archivo = useRef<HTMLInputElement>(null);
  const excel = useRef<HTMLInputElement>(null);
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

  const importarExcel = async (f: File) => {
    try {
      const r = await importarDeExcel(await f.arrayBuffer(), nuevoId());
      await almacen.guardarPersonaje(r.personaje);
      onRecargar();
      // Cuando viene de la hoja técnica no hay nada que explicar; en los otros casos los
      // avisos ya dicen de dónde sale y qué se ha quedado fuera, así que no se repite.
      const cabecera =
        r.origen === 'datos'
          ? `Importada «${r.personaje.nombre}»: ficha completa, tal cual se exportó.`
          : `Importada «${r.personaje.nombre}».`;
      setMensaje({ tipo: 'aviso', texto: [cabecera, ...r.avisos].join(' ') });
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto:
          e instanceof ErrorExcel
            ? e.message
            : 'No he podido leer el archivo. ¿Seguro que es un .xlsx o un .xlsm?',
      });
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
          <button className="accion" onClick={() => archivo.current?.click()}>Importar JSON</button>
          <button
            className="accion"
            onClick={() => excel.current?.click()}
            title="Un .xlsx exportado desde aquí, o la hoja de cálculo de la comunidad"
          >
            Importar Excel
          </button>
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
          <input
            ref={excel}
            type="file"
            accept=".xlsx,.xlsm"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importarExcel(f);
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
                  onClick={async () => descargar(nombreArchivo(p, 'json'), await exportarPersonaje(p))}
                  title="Formato propio: incluye el retrato"
                >
                  JSON
                </button>
                <button
                  className="accion"
                  onClick={() =>
                    bajar(nombreArchivo(p, 'xlsx'), new Blob([exportarAExcel(p) as BlobPart], { type: TIPO_XLSX }))
                  }
                  title="Hoja de cálculo legible; al reimportarla no se pierde nada"
                >
                  Excel
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
