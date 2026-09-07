import { useEffect, useRef, useState } from 'react';
import {
  COLUMNAS_MAXIMAS,
  COLUMNAS_MINIMAS,
  MAPA_VACIO,
  casillaDesde,
  colocacionInicial,
  columnasValidas,
  filasDe,
  type Mapa,
} from '../motor/mapaBatalla';
import type { Combate } from '../motor/combatePorTurnos';
import { actuando } from '../motor/combatePorTurnos';
import { listarImagenes, obtenerImagen, type ImagenInfo } from '../almacen/imagenes';

interface Props {
  combate: Combate;
  campanaId: string | null;
  /** Sólo el máster mueve fichas. Los jugadores miran. */
  editable: boolean;
  /** Para marcar cuál es la tuya cuando lo mira un jugador. */
  personajeId?: string;
  onCambiar?: (c: Combate) => void;
}

/** La imagen del mapa, como URL de objeto. Se revoca al cambiar para no filtrar memoria. */
function useUrlImagen(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<{ anchura: number; altura: number } | null>(null);

  useEffect(() => {
    if (!id) { setUrl(null); setMedidas(null); return; }
    let vigente = true;
    let creada: string | null = null;
    void obtenerImagen(id).then((img) => {
      if (!vigente || !img) return;
      creada = URL.createObjectURL(img.datos);
      setUrl(creada);
      setMedidas({ anchura: img.anchura, altura: img.altura });
    });
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [id]);

  return { url, medidas };
}

export function MapaBatalla({ combate, campanaId, editable, personajeId, onCambiar }: Props) {
  const mapa: Mapa = combate.mapa ?? MAPA_VACIO;
  const { url, medidas } = useUrlImagen(mapa.imagenId);
  const [mapas, setMapas] = useState<ImagenInfo[]>([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const tablero = useRef<HTMLDivElement>(null);

  const columnas = columnasValidas(mapa.columnas);
  const filas = filasDe(columnas, medidas?.anchura, medidas?.altura);

  useEffect(() => {
    if (!editable) return;
    void listarImagenes(campanaId).then((todas) =>
      // Los mapas primero, pero no sólo: un máster puede querer usar de tablero un dibujo
      // que subió como «otro», y obligarle a reetiquetarlo sería por gusto.
      setMapas([...todas].sort((a, b) => (a.tipo === 'mapa' ? -1 : 0) - (b.tipo === 'mapa' ? -1 : 0))),
    );
  }, [campanaId, editable]);

  const enPie = combate.participantes.filter((p) => p.activo);
  const leToca = actuando(combate);

  /*
   * A quien todavía no tiene sitio se le coloca solo: jugadores a la izquierda, enemigos a
   * la derecha. Sólo lo hace el máster —es quien puede escribir el combate— y sólo una vez,
   * porque después se respeta donde estén.
   */
  useEffect(() => {
    if (!editable || !onCambiar) return;
    const sinSitio = enPie.filter((p) => p.x === undefined || p.y === undefined);
    if (sinSitio.length === 0) return;
    const puestas = colocacionInicial(enPie, columnas, filas);
    if (puestas.size === 0) return;
    onCambiar({
      ...combate,
      participantes: combate.participantes.map((p) => {
        const sitio = puestas.get(p.id);
        return sitio ? { ...p, ...sitio } : p;
      }),
      actualizadoEn: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combate.participantes.length, columnas, filas, editable]);

  const cambiarMapa = (cambios: Partial<Mapa>) =>
    onCambiar?.({ ...combate, mapa: { ...mapa, ...cambios }, actualizadoEn: new Date().toISOString() });

  const mover = (id: string, clienteX: number, clienteY: number) => {
    const caja = tablero.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    const sitio = casillaDesde(
      (clienteX - caja.left) / caja.width,
      (clienteY - caja.top) / caja.height,
      columnas,
      filas,
    );
    onCambiar?.({
      ...combate,
      participantes: combate.participantes.map((p) => (p.id === id ? { ...p, ...sitio } : p)),
      actualizadoEn: new Date().toISOString(),
    });
  };

  // Un solo manejador en el tablero en vez de uno por ficha: con `setPointerCapture` el
  // dedo puede salirse de la ficha —y se sale siempre— sin que se pierda el arrastre.
  const alSoltar = (e: React.PointerEvent) => {
    if (!arrastrando) return;
    mover(arrastrando, e.clientX, e.clientY);
    setArrastrando(null);
  };

  const proporcion = `${columnas} / ${filas}`;

  return (
    <div className="mapa-batalla">
      {editable && (
        <div className="mapa-mandos">
          <div className="campo">
            <label htmlFor={`mapa-img-${combate.id}`}>Imagen</label>
            <select
              id={`mapa-img-${combate.id}`}
              value={mapa.imagenId ?? ''}
              onChange={(e) => cambiarMapa({ imagenId: e.target.value || null })}
            >
              <option value="">Sólo cuadrícula</option>
              {mapas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}{m.tipo !== 'mapa' ? ` · ${m.tipo}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor={`mapa-col-${combate.id}`}>Casillas de ancho</label>
            <input
              id={`mapa-col-${combate.id}`}
              type="number"
              min={COLUMNAS_MINIMAS}
              max={COLUMNAS_MAXIMAS}
              value={mapa.columnas}
              onChange={(e) => cambiarMapa({ columnas: columnasValidas(Number(e.target.value)) })}
            />
          </div>
          <p className="mapa-nota">
            {mapas.length === 0
              ? 'Sube mapas en Galería y aparecerán aquí.'
              : `${columnas} × ${filas} casillas. Arrastra las fichas.`}
          </p>
        </div>
      )}

      <div
        ref={tablero}
        className={`tablero${editable ? ' editable' : ''}`}
        style={{ aspectRatio: proporcion, ['--columnas' as string]: columnas, ['--filas' as string]: filas }}
        onPointerUp={alSoltar}
        onPointerCancel={() => setArrastrando(null)}
      >
        {url && <img src={url} alt="" className="mapa-fondo" />}
        <div className="rejilla-mapa" aria-hidden />

        {enPie.map((p) => {
          if (p.x === undefined || p.y === undefined) return null;
          const mia = p.tipo === 'personaje' && p.refId === personajeId;
          return (
            <button
              key={p.id}
              type="button"
              className={[
                'ficha-mapa',
                p.tipo === 'enemigo' ? 'enemigo' : 'jugador',
                leToca?.id === p.id ? 'actua' : '',
                mia ? 'mia' : '',
                arrastrando === p.id ? 'cogida' : '',
              ].filter(Boolean).join(' ')}
              style={{ left: `${(p.x * 100) / columnas}%`, top: `${(p.y * 100) / filas}%` }}
              title={`${p.nombre}${p.iniciativa !== undefined ? ` · iniciativa ${p.iniciativa}` : ''}`}
              disabled={!editable}
              onPointerDown={(e) => {
                if (!editable) return;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setArrastrando(p.id);
              }}
              onPointerUp={(e) => {
                if (!editable || !arrastrando) return;
                e.stopPropagation();
                mover(arrastrando, e.clientX, e.clientY);
                setArrastrando(null);
              }}
            >
              <span className="inicial">{p.nombre.slice(0, 2)}</span>
              <span className="nombre-ficha">{p.nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
