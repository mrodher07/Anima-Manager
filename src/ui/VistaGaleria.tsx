import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ErrorImagen,
  actualizarImagen,
  borrarImagen,
  espacioUsado,
  formatearBytes,
  guardarImagen,
  listarImagenes,
  type ImagenInfo,
  type TipoImagen,
} from '../almacen/imagenes';
import { Imagen, VisorImagen } from './Imagen';

const TIPOS: { id: TipoImagen; texto: string }[] = [
  { id: 'mapa', texto: 'Mapas' },
  { id: 'pnj', texto: 'PNJs' },
  { id: 'enemigo', texto: 'Enemigos' },
  { id: 'objeto', texto: 'Objetos' },
  { id: 'otro', texto: 'Otros' },
];

export function VistaGaleria({ campanaId }: { campanaId: string | null }) {
  const [imagenes, setImagenes] = useState<ImagenInfo[]>([]);
  const [filtro, setFiltro] = useState<TipoImagen | ''>('');
  const [tipoSubida, setTipoSubida] = useState<TipoImagen>('mapa');
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'aviso'; texto: string } | null>(null);
  const [espacio, setEspacio] = useState({ imagenes: 0, bytes: 0 });
  const [viendo, setViendo] = useState<ImagenInfo | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const recargar = useCallback(async () => {
    setImagenes(await listarImagenes(campanaId));
    setEspacio(await espacioUsado());
  }, [campanaId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const subir = async (archivos: FileList) => {
    setSubiendo(true);
    let subidas = 0;
    const fallos: string[] = [];
    for (const f of Array.from(archivos)) {
      try {
        await guardarImagen(f, { tipo: tipoSubida, nombre: '', campanaId });
        subidas++;
      } catch (e) {
        fallos.push(`${f.name}: ${e instanceof ErrorImagen ? e.message : 'error inesperado'}`);
      }
    }
    await recargar();
    setSubiendo(false);
    setMensaje(
      fallos.length > 0
        ? { tipo: 'error', texto: `Subidas ${subidas}. Han fallado: ${fallos.join(' · ')}` }
        : { tipo: 'aviso', texto: `${subidas} ${subidas === 1 ? 'imagen subida' : 'imágenes subidas'}.` },
    );
  };

  const visibles = filtro ? imagenes.filter((i) => i.tipo === filtro) : imagenes.filter((i) => i.tipo !== 'retrato');

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Galería</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Mapas, retratos de PNJ, enemigos, objetos… lo que necesites tener a mano en la mesa.
          Las imágenes se reescalan al subirlas y se guardan en este dispositivo.
        </p>

        <div className="rejilla" style={{ marginBottom: 12 }}>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label htmlFor="tipo-subida">Subir como</label>
            <select
              id="tipo-subida"
              value={tipoSubida}
              onChange={(e) => setTipoSubida(e.target.value as TipoImagen)}
            >
              {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
            </select>
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label htmlFor="filtro">Ver</label>
            <select id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as TipoImagen | '')}>
              <option value="">Todo</option>
              {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
            </select>
          </div>
        </div>

        <div className="acciones-regla" style={{ marginTop: 0 }}>
          <button className="accion primaria" onClick={() => archivo.current?.click()} disabled={subiendo}>
            {subiendo ? 'Subiendo…' : 'Subir imágenes'}
          </button>
          <input
            ref={archivo}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) void subir(e.target.files);
              e.target.value = '';
            }}
          />
          <span style={{ color: 'var(--texto-debil)', fontSize: '0.82rem', alignSelf: 'center' }}>
            {espacio.imagenes} imágenes · {formatearBytes(espacio.bytes)}
          </span>
        </div>

        {mensaje && <div className={`aviso ${mensaje.tipo}`} style={{ marginTop: 12 }}>{mensaje.texto}</div>}
      </section>

      {visibles.length === 0 ? (
        <div className="vacio panel">
          <h2>Todavía no hay imágenes</h2>
          <p>Sube el mapa de la primera mazmorra, o el retrato del villano.</p>
        </div>
      ) : (
        <div className="galeria">
          {visibles.map((img) => (
            <figure key={img.id} className="panel tarjeta-imagen">
              <Imagen id={img.id} alt={img.nombre} className="miniatura" onClick={() => setViendo(img)} />
              <figcaption>
                <input
                  value={img.nombre}
                  aria-label={`Nombre de ${img.nombre}`}
                  onChange={(e) => {
                    const nombre = e.target.value;
                    setImagenes((antes) => antes.map((i) => (i.id === img.id ? { ...i, nombre } : i)));
                  }}
                  onBlur={(e) => void actualizarImagen(img.id, { nombre: e.target.value })}
                />
                <p className="meta">
                  {TIPOS.find((t) => t.id === img.tipo)?.texto ?? img.tipo} · {img.anchura}×{img.altura} ·{' '}
                  {formatearBytes(img.bytes)}
                </p>
                <div className="acciones-regla" style={{ marginTop: 6 }}>
                  <button className="accion" onClick={() => setViendo(img)}>Ver</button>
                  <button
                    className="accion peligro"
                    onClick={async () => {
                      await borrarImagen(img.id);
                      await recargar();
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {viendo && <VisorImagen id={viendo.id} alt={viendo.nombre} onCerrar={() => setViendo(null)} />}
    </div>
  );
}
