import { useEffect, useRef, useState } from 'react';
import {
  COLORES_MARCA,
  COLUMNAS_MAXIMAS,
  COLUMNAS_MINIMAS,
  MAPA_VACIO,
  camino,
  casillaDesde,
  clave,
  colocacionInicial,
  columnasValidas,
  describeDistancia,
  distancia,
  filasDe,
  type Casilla,
  type Mapa,
} from '../motor/mapaBatalla';
import type { Combate } from '../motor/combatePorTurnos';
import { actuando } from '../motor/combatePorTurnos';
import { listarImagenes, obtenerImagen, type ImagenInfo } from '../almacen/imagenes';

interface Props {
  combate: Combate;
  campanaId: string | null;
  /** El máster: mueve todo, pinta niebla y marcas. */
  editable: boolean;
  /** Para marcar cuál es la tuya cuando lo mira un jugador. */
  personajeId?: string;
  onCambiar?: (c: Combate) => void;
  /**
   * Un jugador moviendo su propia ficha. No escribe el combate —no puede— sino que apunta
   * a dónde se ha ido y el máster lo recoge.
   */
  onMoverMiFicha?: (destino: Casilla, desde: Casilla | undefined) => void;
}

/** Qué hace el ratón sobre el tablero. Sólo el máster tiene más de uno. */
type Modo = 'mover' | 'niebla' | 'marcar';

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

export function MapaBatalla({
  combate,
  campanaId,
  editable,
  personajeId,
  onCambiar,
  onMoverMiFicha,
}: Props) {
  const mapa: Mapa = combate.mapa ?? MAPA_VACIO;
  const { url, medidas } = useUrlImagen(mapa.imagenId);
  const [mapas, setMapas] = useState<ImagenInfo[]>([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  /** Por dónde va el dedo mientras arrastra, para poder enseñar cuánto lleva recorrido. */
  const [encima, setEncima] = useState<Casilla | null>(null);
  const [modo, setModo] = useState<Modo>('mover');
  const [color, setColor] = useState<string>(COLORES_MARCA[0].id);
  /*
   * Si esto fuera estado de React, el `pointermove` que llega justo detrás del
   * `pointerdown` lo leería todavía en `false` y el arrastre no pintaría. No hace falta
   * que sea estado: no se usa para pintar la pantalla, sólo para saber si el botón sigue
   * apretado.
   */
  const pintando = useRef(false);
  /** El mismo dato en estado, sólo para que el efecto que engancha la ventana se entere. */
  const [pintandoAhora, setPintandoAhora] = useState(false);
  /** Lo pintado en este arrastre. Se enseña mientras dura y se guarda al soltar. */
  const [borrador, setBorrador] = useState<{ niebla: string[]; marcas: Record<string, string> } | null>(null);
  const tablero = useRef<HTMLDivElement>(null);

  const columnas = columnasValidas(mapa.columnas);
  /** Lo que se ve: el borrador mientras se pinta, y lo guardado el resto del tiempo. */
  const niebla = borrador?.niebla ?? mapa.niebla ?? [];
  const marcas = borrador?.marcas ?? mapa.marcas ?? {};
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
    /*
     * Y los que se han quedado fuera del tablero: al reducir las casillas de ancho, quien
     * estaba en la columna 19 de un mapa de 20 se sale de uno de 16. Se le mete dentro en
     * vez de dejarle pintado en el aire, que es lo que pasaba.
     */
    const fuera = enPie.filter(
      (p) => (p.x !== undefined && p.x >= columnas) || (p.y !== undefined && p.y >= filas),
    );
    if (sinSitio.length === 0 && fuera.length === 0) return;

    const recortados = combate.participantes.map((p) =>
      fuera.some((f) => f.id === p.id)
        ? { ...p, x: Math.min(p.x ?? 0, columnas - 1), y: Math.min(p.y ?? 0, filas - 1) }
        : p,
    );
    const puestas = colocacionInicial(
      recortados.filter((p) => p.activo),
      columnas,
      filas,
    );
    onCambiar({
      ...combate,
      participantes: recortados.map((p) => {
        const sitio = puestas.get(p.id);
        return sitio ? { ...p, ...sitio } : p;
      }),
      actualizadoEn: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combate.participantes.length, columnas, filas, editable]);

  const cambiarMapa = (cambios: Partial<Mapa>) =>
    onCambiar?.({ ...combate, mapa: { ...mapa, ...cambios }, actualizadoEn: new Date().toISOString() });

  const casillaDelPuntero = (clienteX: number, clienteY: number): Casilla | null => {
    const caja = tablero.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return null;
    return casillaDesde(
      (clienteX - caja.left) / caja.width,
      (clienteY - caja.top) / caja.height,
      columnas,
      filas,
    );
  };

  const mover = (id: string, clienteX: number, clienteY: number) => {
    const sitio = casillaDelPuntero(clienteX, clienteY);
    if (!sitio) return;
    const quien = combate.participantes.find((p) => p.id === id);

    // Un jugador no puede escribir el combate del máster: apunta a dónde se ha ido y él lo
    // recoge, igual que con la iniciativa.
    if (!editable) {
      const desde = quien && quien.x !== undefined && quien.y !== undefined
        ? { x: quien.x, y: quien.y }
        : undefined;
      onMoverMiFicha?.(sitio, desde);
      return;
    }
    onCambiar?.({
      ...combate,
      participantes: combate.participantes.map((p) => (p.id === id ? { ...p, ...sitio } : p)),
      actualizadoEn: new Date().toISOString(),
    });
  };

  /**
   * Pinta una casilla, según el modo. Sólo el máster.
   *
   * `poner` decide si se añade o se quita, y **se decide una sola vez al empezar el
   * arrastre**, mirando la primera casilla. Antes alternaba en cada casilla, con dos
   * consecuencias: arrastrar por encima de casillas mezcladas invertía cada una en vez de
   * pintarlas todas, y como el manejador saltaba en cada píxel, quedarse quieto dentro de
   * una casilla la encendía y la apagaba decenas de veces por segundo. El resultado era
   * que arrastrar no pintaba nada.
   */
  /**
   * Pinta el tramo recorrido desde la última casilla, sobre un **borrador local**.
   *
   * No se guarda el combate en cada movimiento, y ese fue el fallo gordo: guardar escribe
   * en IndexedDB y repinta, el hilo principal se atasca, y Chrome empieza a **fusionar los
   * `pointermove`** para no acumular retraso. Con el hilo atascado llegaban dos avisos de
   * veinte y el pincel se saltaba media línea. Ahora durante el arrastre sólo se toca el
   * borrador —barato, sin disco— y se guarda una vez al soltar.
   *
   * Aun así se rellena el tramo entre la última casilla y la de ahora: aunque el navegador
   * fusione avisos, la raya sale entera.
   *
   * `poner` decide si se añade o se quita, y **se decide una sola vez al empezar**: si
   * alternara casilla a casilla, arrastrar sobre casillas mezcladas invertiría cada una en
   * vez de pintarlas todas.
   */
  const pintar = (clienteX: number, clienteY: number, poner: boolean) => {
    if (!editable || !onCambiar) return;
    const c = casillaDelPuntero(clienteX, clienteY);
    if (!c) return;
    if (c.x === ultimaPintada.current?.x && c.y === ultimaPintada.current?.y) return;

    const desde = ultimaPintada.current;
    const tramo = desde ? camino(desde, c) : [c];
    ultimaPintada.current = c;

    setBorrador((antes) => {
      const b = antes ?? { niebla: [...(mapa.niebla ?? [])], marcas: { ...(mapa.marcas ?? {}) } };
      let niebla = b.niebla;
      const marcas = { ...b.marcas };
      for (const casilla of tramo) {
        const k = clave(casilla.x, casilla.y);
        if (modo === 'niebla') {
          const yaEsta = niebla.includes(k);
          if (yaEsta === poner) continue;
          niebla = poner ? [...niebla, k] : niebla.filter((x) => x !== k);
        } else if (poner) {
          marcas[k] = color;
        } else {
          delete marcas[k];
        }
      }
      return { niebla, marcas };
    });
  };

  /** Qué se decidió al empezar el arrastre: pintar o borrar. */
  const pintandoPone = useRef<boolean>(true);
  const ultimaPintada = useRef<Casilla | null>(null);

  // Un solo manejador en el tablero en vez de uno por ficha: con `setPointerCapture` el
  // dedo puede salirse de la ficha —y se sale siempre— sin que se pierda el arrastre.
  const alSoltar = (e: React.PointerEvent) => {
    // Lo de pintar lo cierra el escuchador de la ventana; aquí sólo se suelta la ficha.
    if (!arrastrando) return;
    mover(arrastrando, e.clientX, e.clientY);
    setArrastrando(null);
    setEncima(null);
  };

  const alMover = (e: React.PointerEvent) => {
    if (!arrastrando) return;
    const c = casillaDelPuntero(e.clientX, e.clientY);
    // Sólo se repinta cuando cambia de casilla, no en cada píxel.
    if (c && (c.x !== encima?.x || c.y !== encima?.y)) setEncima(c);
  };

  /*
   * El pincel escucha en la ventana, no en el tablero.
   *
   * Con `setPointerCapture` sobre el tablero funcionaba en un mapa vacío y no en uno con
   * imagen: en cuanto se pintaba la primera casilla, React repintaba, la captura se perdía
   * y no llegaba ni un `pointermove` más — ni siquiera el `pointerup`. Escuchando en la
   * ventana el arrastre no depende de que ningún nodo sobreviva al repintado, que es como
   * se hace cualquier herramienta de pintar.
   */
  useEffect(() => {
    if (!pintandoAhora) return;
    const alArrastrar = (e: PointerEvent) => pintar(e.clientX, e.clientY, pintandoPone.current);
    const alLevantar = () => {
      setPintandoAhora(false);
      pintando.current = false;
      ultimaPintada.current = null;
      // Una sola escritura por trazo, al levantar el dedo.
      if (borrador) cambiarMapa({ niebla: borrador.niebla, marcas: borrador.marcas });
      setBorrador(null);
    };
    window.addEventListener('pointermove', alArrastrar);
    window.addEventListener('pointerup', alLevantar);
    window.addEventListener('pointercancel', alLevantar);
    return () => {
      window.removeEventListener('pointermove', alArrastrar);
      window.removeEventListener('pointerup', alLevantar);
      window.removeEventListener('pointercancel', alLevantar);
    };
  });

  const proporcion = `${columnas} / ${filas}`;

  /** El máster mueve todo; un jugador, sólo la suya, y sólo si le han dado con qué. */
  const puedoMoverA = (p: (typeof enPie)[number]) =>
    editable || Boolean(onMoverMiFicha && p.tipo === 'personaje' && p.refId === personajeId);
  const puedeMover = enPie.some(puedoMoverA);

  // Mientras se arrastra, por dónde va y cuánto lleva.
  const cogida = arrastrando ? combate.participantes.find((p) => p.id === arrastrando) : undefined;
  const origen: Casilla | undefined =
    cogida && cogida.x !== undefined && cogida.y !== undefined ? { x: cogida.x, y: cogida.y } : undefined;
  const rastro = origen && encima ? camino(origen, encima) : [];
  const recorrido = origen && encima ? distancia(origen, encima) : null;

  /** Lo que los jugadores no ven: lo que está bajo la niebla. */
  const tapada = (x?: number, y?: number) =>
    x !== undefined && y !== undefined && niebla.includes(clave(x, y));

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
          <div className="campo">
            <label htmlFor={`mapa-metros-${combate.id}`}>Metros por casilla</label>
            <input
              id={`mapa-metros-${combate.id}`}
              type="number"
              min={0}
              step={0.5}
              placeholder="sin poner"
              value={mapa.metrosPorCasilla ?? ''}
              onChange={(e) =>
                cambiarMapa({
                  metrosPorCasilla: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                })
              }
            />
            <small style={{ color: 'var(--texto-debil)' }}>
              Ánima no usa cuadrícula, así que esto lo decidís vosotros. En blanco se cuenta
              en casillas y ya.
            </small>
          </div>

          <div className="mapa-modos" role="group" aria-label="Qué hace el ratón">
            {([
              ['mover', 'Mover'],
              ['niebla', 'Tapar'],
              ['marcar', 'Marcar'],
            ] as const).map(([id, texto]) => (
              <button
                key={id}
                className="accion"
                aria-pressed={modo === id}
                onClick={() => setModo(id)}
              >
                {texto}
              </button>
            ))}
            {modo === 'marcar' && (
              <span className="colores">
                {COLORES_MARCA.map((c) => (
                  <button
                    key={c.id}
                    className={`color${color === c.id ? ' elegido' : ''}`}
                    style={{ background: c.css }}
                    aria-label={c.nombre}
                    aria-pressed={color === c.id}
                    onClick={() => setColor(c.id)}
                  />
                ))}
              </span>
            )}
            {modo === 'niebla' && niebla.length > 0 && (
              <button className="accion" onClick={() => cambiarMapa({ niebla: [] })}>
                Destapar todo
              </button>
            )}
            {modo === 'marcar' && Object.keys(marcas).length > 0 && (
              <button className="accion" onClick={() => cambiarMapa({ marcas: {} })}>
                Quitar marcas
              </button>
            )}
          </div>

          <p className="mapa-nota">
            {mapas.length === 0 && !mapa.imagenId
              ? 'Sube mapas en Galería y aparecerán aquí.'
              : modo === 'mover'
                ? `${columnas} × ${filas} casillas. Arrastra las fichas.`
                : modo === 'niebla'
                  ? 'Arrastra para tapar lo que los jugadores no deben ver.'
                  : 'Arrastra para marcar casillas. Lo que signifiquen, lo decidís vosotros.'}
          </p>
        </div>
      )}

      <div
        ref={tablero}
        className={[
          'tablero',
          puedeMover ? 'editable' : '',
          editable && modo !== 'mover' ? 'pintando' : '',
        ].filter(Boolean).join(' ')}
        style={{ aspectRatio: proporcion, ['--columnas' as string]: columnas, ['--filas' as string]: filas }}
        onPointerDown={(e) => {
          if (!editable || modo === 'mover') return;
          // Lo que haga la primera casilla es lo que hará el arrastre entero.
          const c = casillaDelPuntero(e.clientX, e.clientY);
          pintandoPone.current = c
            ? modo === 'niebla'
              ? !niebla.includes(clave(c.x, c.y))
              : marcas[clave(c.x, c.y)] !== color
            : true;
          ultimaPintada.current = null;
          setBorrador(null);
          pintando.current = true;
          setPintandoAhora(true);
          pintar(e.clientX, e.clientY, pintandoPone.current);
        }}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={() => {
          setArrastrando(null);
          pintando.current = false;
          setEncima(null);
          ultimaPintada.current = null;
        }}
      >
        {/*
          * `draggable={false}` no es cosmético: sin él, al apretar sobre el mapa el
          * navegador arranca **su** gesto de arrastrar imágenes y manda un `pointercancel`
          * que corta el trazo en seco. Se pintaba una casilla y ahí se acababa.
          */}
        {url && <img src={url} alt="" className="mapa-fondo" draggable={false} />}
        <div className="rejilla-mapa" aria-hidden />

        {/* Las marcas debajo de todo lo demás: son el suelo, no un objeto. */}
        {Object.entries(marcas).map(([k, c]) => {
          const [x, y] = k.split(',').map(Number);
          const css = COLORES_MARCA.find((m) => m.id === c)?.css;
          if (!css || x >= columnas || y >= filas) return null;
          return (
            <div
              key={`m${k}`}
              className="marca-casilla"
              style={{ left: `${(x * 100) / columnas}%`, top: `${(y * 100) / filas}%`, background: css }}
              aria-hidden
            />
          );
        })}

        {/*
          * La niebla. Para el máster es un velo que deja adivinar lo que hay debajo —tiene
          * que saber qué está tapando—; para el jugador es opaca de verdad.
          */}
        {niebla.map((k) => {
          const [x, y] = k.split(',').map(Number);
          if (x >= columnas || y >= filas) return null;
          return (
            <div
              key={`n${k}`}
              className="niebla-casilla"
              style={{ left: `${(x * 100) / columnas}%`, top: `${(y * 100) / filas}%` }}
              aria-hidden
            />
          );
        })}

        {/* El rastro de lo que se está arrastrando, con la cuenta al final. */}
        {rastro.map((c, i) => (
          <div
            key={`r${i}`}
            className="paso-rastro"
            style={{ left: `${(c.x * 100) / columnas}%`, top: `${(c.y * 100) / filas}%` }}
            aria-hidden
          />
        ))}
        {encima && recorrido !== null && (
          <div
            className="cuenta-casillas"
            style={{ left: `${(encima.x * 100) / columnas}%`, top: `${(encima.y * 100) / filas}%` }}
            role="status"
          >
            <span>{describeDistancia(recorrido, mapa.metrosPorCasilla)}</span>
          </div>
        )}

        {enPie.map((p) => {
          if (p.x === undefined || p.y === undefined) return null;
          const mia = p.tipo === 'personaje' && p.refId === personajeId;
          // Bajo la niebla no hay nadie, para quien no la levanta. Tu propia ficha sí se
          // ve: saber dónde estás tú no es información que el máster esté escondiendo.
          if (!editable && !mia && tapada(p.x, p.y)) return null;
          const mueve = puedoMoverA(p) && (!editable || modo === 'mover');
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
                editable && tapada(p.x, p.y) ? 'bajo-niebla' : '',
              ].filter(Boolean).join(' ')}
              style={{ left: `${(p.x * 100) / columnas}%`, top: `${(p.y * 100) / filas}%` }}
              title={`${p.nombre}${p.iniciativa !== undefined ? ` · iniciativa ${p.iniciativa}` : ''}`}
              disabled={!mueve}
              onPointerDown={(e) => {
                if (!mueve) return;
                e.stopPropagation();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setArrastrando(p.id);
                setEncima({ x: p.x!, y: p.y! });
              }}
              onPointerUp={(e) => {
                if (!mueve || !arrastrando) return;
                e.stopPropagation();
                mover(arrastrando, e.clientX, e.clientY);
                setArrastrando(null);
                setEncima(null);
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
