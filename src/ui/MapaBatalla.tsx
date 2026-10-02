import { useEffect, useRef, useState } from 'react';
import {
  COLORES_MARCA,
  COLUMNAS_MAXIMAS,
  COLUMNAS_MINIMAS,
  ELEMENTOS_DE_SIEMPRE,
  MAPA_VACIO,
  camino,
  casillaDesde,
  clave,
  colocacionInicial,
  columnasValidas,
  dentroDelMapa,
  describeDistancia,
  distancia,
  elementoEn,
  filasDe,
  alDiaConPlantillas,
  cambiarElemento,
  fichaParaElMapa,
  moverElemento,
  nuevaCosa,
  quitarElemento,
  type Casilla,
  type CosaParaPoner,
  type ElementoMapa,
  type FichaDeCosa,
  type Mapa,
} from '../motor/mapaBatalla';
import type { CosaMapa } from '../datos/tipos';
import type { Combate } from '../motor/combatePorTurnos';
import { actuando } from '../motor/combatePorTurnos';
import { listarImagenes, obtenerImagen, type ImagenInfo } from '../almacen/imagenes';
import { nuevoId } from './estado';
import { cliente } from '../nube/supabase';
import { imagenRemota } from '../nube/imagenesNube';

/**
 * Una imagen para enseñar: la de este aparato si está, y si no, la del servidor.
 *
 * Lo segundo es lo normal en la pantalla de un jugador: el mapa lo subió el máster y los
 * retratos, cada uno el suyo.
 */
async function buscarImagen(
  id: string,
): Promise<{ url: string; local: boolean; anchura: number; altura: number } | null> {
  const img = await obtenerImagen(id);
  if (img) return { url: URL.createObjectURL(img.datos), local: true, anchura: img.anchura, altura: img.altura };
  const supa = cliente();
  const remota = supa ? await imagenRemota(supa, id) : null;
  return remota ? { ...remota, local: false } : null;
}

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
  /** Las cosas propias de la mesa, de su contenido propio, para ponerlas y enseñar su ficha. */
  cosasPropias?: CosaMapa[];
}

/** Qué hace el ratón sobre el tablero. Sólo el máster tiene más de uno. */
type Modo = 'mover' | 'niebla' | 'marcar' | 'cosas';

/** Lo que se está poniendo en el suelo: de los de siempre, de la mesa o una imagen suelta. */
type CosaElegida = CosaParaPoner;

/** La imagen del mapa, como URL de objeto. Se revoca al cambiar para no filtrar memoria. */
function useUrlImagen(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<{ anchura: number; altura: number } | null>(null);

  useEffect(() => {
    if (!id) { setUrl(null); setMedidas(null); return; }
    let vigente = true;
    let creada: string | null = null;
    void buscarImagen(id).then((img) => {
      if (!img) return;
      if (img.local) creada = img.url;
      if (!vigente) { if (creada) URL.revokeObjectURL(creada); return; }
      setUrl(img.url);
      setMedidas({ anchura: img.anchura, altura: img.altura });
    });
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [id]);

  return { url, medidas };
}

/**
 * Varias imágenes a la vez —los retratos de las fichas y los dibujos del suelo—, cada una
 * como URL de objeto.
 *
 * Se guardan en un `ref` y no en el estado porque lo caro es crearlas: si se rehicieran
 * cada vez que entra alguien en el combate, todos los retratos parpadearían por uno nuevo.
 * Sólo se pide lo que falta, y se sueltan todas al desmontar para no dejar memoria colgada.
 */
function useUrlesImagenes(ids: (string | null | undefined)[]): Map<string, string> {
  const guardadas = useRef(new Map<string, string>());
  const [, repintar] = useState(0);
  /*
   * Lo que no se encuentra se vuelve a pedir un rato después, unas pocas veces: el
   * retrato de un jugador que acaba de unirse puede no haber llegado al servidor todavía
   * cuando el máster abre el mapa, y sin esto se quedaba con dos letras toda la noche.
   */
  const [intento, setIntento] = useState(0);
  // Una clave de texto: así el efecto no se dispara porque el array sea otro array.
  const pedidas = [...new Set(ids.filter(Boolean) as string[])].sort();
  const clave = pedidas.join('|');

  useEffect(() => {
    const faltan = (clave ? clave.split('|') : []).filter((id) => !guardadas.current.has(id));
    if (faltan.length === 0) return;
    let vigente = true;
    void Promise.all(faltan.map(async (id) => [id, await buscarImagen(id)] as const)).then((pares) => {
      if (!vigente) {
        for (const [, img] of pares) if (img?.local) URL.revokeObjectURL(img.url);
        return;
      }
      let alguna = false;
      for (const [id, img] of pares) {
        if (!img || guardadas.current.has(id)) continue;
        guardadas.current.set(id, img.url);
        alguna = true;
      }
      if (alguna) repintar((n) => n + 1);
      if (pares.some(([, img]) => !img) && intento < 6) {
        reintento = setTimeout(() => setIntento((n) => n + 1), 10000);
      }
    });
    let reintento: ReturnType<typeof setTimeout> | undefined;
    return () => { vigente = false; clearTimeout(reintento); };
  }, [clave, intento]);

  useEffect(() => {
    const mapa = guardadas.current;
    return () => {
      for (const url of mapa.values()) URL.revokeObjectURL(url);
      mapa.clear();
    };
  }, []);

  return guardadas.current;
}

export function MapaBatalla({
  combate,
  campanaId,
  editable,
  personajeId,
  onCambiar,
  onMoverMiFicha,
  cosasPropias = [],
}: Props) {
  const mapa: Mapa = combate.mapa ?? MAPA_VACIO;
  const { url, medidas } = useUrlImagen(mapa.imagenId);
  const [mapas, setMapas] = useState<ImagenInfo[]>([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  /** Por dónde va el dedo mientras arrastra, para poder enseñar cuánto lleva recorrido. */
  const [encima, setEncima] = useState<Casilla | null>(null);
  const [modo, setModo] = useState<Modo>('mover');
  const [color, setColor] = useState<string>(COLORES_MARCA[0].id);
  /** Lo que se pone al pulsar en el suelo, y de qué tamaño. */
  const [cosa, setCosa] = useState<CosaElegida>(ELEMENTOS_DE_SIEMPRE[0]);
  const [tamano, setTamano] = useState({ ancho: 1, alto: 1 });
  /** El barril que se está arrastrando, si hay alguno. */
  const [cogiendoCosa, setCogiendoCosa] = useState<string | null>(null);
  /** La cosa del suelo cuya ficha se está mirando. */
  const [mirando, setMirando] = useState<string | null>(null);
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
  const elementos = mapa.elementos ?? [];

  /*
   * Los retratos de las fichas y los dibujos del suelo, todos de una vez.
   *
   * Los retratos salen del combate y no de las fichas a propósito: la pantalla de un
   * jugador no tiene las fichas de los demás, así que si se miraran ahí sólo su propia
   * ficha tendría cara. Quien no tenga retrato se queda con sus dos letras de siempre.
   */
  const urles = useUrlesImagenes([
    ...combate.participantes.map((p) => p.retratoId),
    ...elementos.map((e) => e.imagenId),
    // Las de la paleta, sólo para quien la ve: un jugador no tiene paleta.
    ...(editable ? cosasPropias.map((c) => c.imagenId) : []),
  ]);

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

  /* Y lo mismo con los barriles: al encoger el mapa se meten dentro en vez de perderse. */
  useEffect(() => {
    if (!editable || !onCambiar) return;
    const metidos = dentroDelMapa(mapa.elementos, columnas, filas);
    if (metidos === mapa.elementos) return;
    onCambiar({
      ...combate,
      mapa: { ...mapa, elementos: metidos },
      actualizadoEn: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa.elementos, columnas, filas, editable]);

  /*
   * Si el máster corrige una cosa en Contenido propio —otra imagen, otra Entereza—, las
   * que ya están puestas se corrigen solas. Lo hace su pantalla porque es la que puede
   * escribir el combate, y así a los jugadores les llega con él, en segundos.
   */
  useEffect(() => {
    if (!editable || !onCambiar || cosasPropias.length === 0) return;
    const alDia = alDiaConPlantillas(mapa.elementos, cosasPropias);
    if (alDia === mapa.elementos) return;
    onCambiar({ ...combate, mapa: { ...mapa, elementos: alDia }, actualizadoEn: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa.elementos, cosasPropias, editable]);

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
   * Pone una cosa en el suelo, o la quita si ya había una ahí.
   *
   * Poner y quitar con el mismo gesto porque es lo que espera cualquiera al mirar un
   * tablero: pulsas donde quieres el barril, y vuelves a pulsar encima cuando ya no lo
   * quieres. Nada de esto tiene reglas: un barril no tapa el paso ni da cobertura, lo que
   * signifique lo decide la mesa.
   */
  const ponerCosa = (clienteX: number, clienteY: number) => {
    if (!editable || !onCambiar) return;
    const c = casillaDelPuntero(clienteX, clienteY);
    if (!c) return;
    const ya = elementoEn(elementos, c.x, c.y);
    if (ya) {
      cambiarMapa({ elementos: quitarElemento(elementos, ya.id) });
      return;
    }
    cambiarMapa({ elementos: [...elementos, nuevaCosa(nuevoId(), cosa, c, tamano, columnas, filas)] });
  };

  /**
   * Suelta una cosa que se estaba arrastrando. Si se suelta en la misma casilla es que no
   * se quería mover sino **mirarla**: se abre su ficha. Es el mismo gesto que en una mesa de
   * verdad, coger la ficha para moverla o señalarla para preguntar qué es.
   */
  const moverCosa = (id: string, clienteX: number, clienteY: number) => {
    const sitio = casillaDelPuntero(clienteX, clienteY);
    const antes = elementos.find((e) => e.id === id);
    if (!sitio || !editable || !antes) return;
    if (sitio.x === antes.x && sitio.y === antes.y) { setMirando(id); return; }
    cambiarMapa({ elementos: dentroDelMapa(moverElemento(elementos, id, sitio), columnas, filas) });
  };

  /** Elegir en la paleta una cosa propia: trae su tamaño, que es parte de lo que es. */
  const elegirPropia = (c: CosaMapa) => {
    setCosa({
      nombre: c.cosa,
      icono: c.icono || undefined,
      imagenId: c.imagenId ?? null,
      plantilla: c.cosa,
      ficha: fichaParaElMapa(c),
    });
    setTamano({ ancho: Math.max(1, c.ancho || 1), alto: Math.max(1, c.alto || 1) });
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
    if (cogiendoCosa) {
      moverCosa(cogiendoCosa, e.clientX, e.clientY);
      setCogiendoCosa(null);
      return;
    }
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
              ['cosas', 'Cosas'],
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
            {modo === 'cosas' && elementos.length > 0 && (
              <button className="accion" onClick={() => cambiarMapa({ elementos: [] })}>
                Vaciar el suelo
              </button>
            )}
          </div>

          {/*
            * La caja de las cosas. Sale sólo en su modo: son dieciséis dibujos y un par de
            * mandos, y tenerlos siempre delante le quita sitio al mapa, que es lo que hay
            * que mirar.
            */}
          {modo === 'cosas' && (
            <div className="paleta-cosas">
              {/*
                * Las de la mesa primero: si el máster se ha tomado la molestia de hacer su
                * barril, es ése el que quiere poner. Se crean en Contenido propio.
                */}
              {cosasPropias.length > 0 && (
                <>
                  <p className="titulo-paleta">De tu mesa</p>
                  <div className="cacharros propias" role="group" aria-label="Cosas de tu mesa">
                    {cosasPropias.map((c) => {
                      const dibujo = c.imagenId ? urles.get(c.imagenId) : null;
                      const elegida = cosa.plantilla === c.cosa;
                      return (
                        <button
                          key={c.cosa}
                          type="button"
                          className={`cacharro${elegida ? ' elegido' : ''}`}
                          aria-pressed={elegida}
                          title={c.cosa}
                          onClick={() => elegirPropia(c)}
                        >
                          {dibujo ? (
                            <img src={dibujo} alt="" draggable={false} />
                          ) : (
                            <span aria-hidden>{c.icono || '⬛'}</span>
                          )}
                          <span className="como-se-llama">{c.cosa}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="titulo-paleta">Las de siempre</p>
                </>
              )}
              <div className="cacharros" role="group" aria-label="Qué poner en el suelo">
                {ELEMENTOS_DE_SIEMPRE.map((c) => (
                  <button
                    key={c.nombre}
                    type="button"
                    className={`cacharro${!cosa.imagenId && !cosa.plantilla && cosa.nombre === c.nombre ? ' elegido' : ''}`}
                    aria-pressed={!cosa.imagenId && !cosa.plantilla && cosa.nombre === c.nombre}
                    title={c.nombre}
                    onClick={() => setCosa({ nombre: c.nombre, icono: c.icono })}
                  >
                    <span aria-hidden>{c.icono}</span>
                    <span className="como-se-llama">{c.nombre}</span>
                  </button>
                ))}
              </div>

              <div className="mandos-cosas">
                <div className="campo">
                  <label htmlFor={`cosa-img-${combate.id}`}>O una imagen tuya</label>
                  <select
                    id={`cosa-img-${combate.id}`}
                    value={cosa.plantilla ? '' : (cosa.imagenId ?? '')}
                    onChange={(e) => {
                      const elegida = mapas.find((m) => m.id === e.target.value);
                      setCosa(
                        elegida
                          ? { nombre: elegida.nombre, imagenId: elegida.id }
                          : ELEMENTOS_DE_SIEMPRE[0],
                      );
                    }}
                  >
                    <option value="">— de los de siempre —</option>
                    {/* Aquí los objetos primero, que es lo que se busca cuando se pone algo
                        en el suelo; en el desplegable del fondo van los mapas primero. */}
                    {[...mapas]
                      .sort((a, b) => (a.tipo === 'objeto' ? -1 : 0) - (b.tipo === 'objeto' ? -1 : 0))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}{m.tipo !== 'objeto' ? ` · ${m.tipo}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="campo estrecho">
                  <label htmlFor={`cosa-ancho-${combate.id}`}>Ancho</label>
                  <input
                    id={`cosa-ancho-${combate.id}`}
                    type="number"
                    min={1}
                    max={8}
                    value={tamano.ancho}
                    onChange={(e) =>
                      setTamano((t) => ({ ...t, ancho: Math.max(1, Math.min(8, Number(e.target.value) || 1)) }))
                    }
                  />
                </div>
                <div className="campo estrecho">
                  <label htmlFor={`cosa-alto-${combate.id}`}>Alto</label>
                  <input
                    id={`cosa-alto-${combate.id}`}
                    type="number"
                    min={1}
                    max={8}
                    value={tamano.alto}
                    onChange={(e) =>
                      setTamano((t) => ({ ...t, alto: Math.max(1, Math.min(8, Number(e.target.value) || 1)) }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <p className="mapa-nota">
            {mapas.length === 0 && !mapa.imagenId
              ? 'Sube mapas en Galería y aparecerán aquí.'
              : modo === 'mover'
                ? `${columnas} × ${filas} casillas. Arrastra las fichas.`
                : modo === 'niebla'
                  ? 'Arrastra para tapar lo que los jugadores no deben ver.'
                  : modo === 'marcar'
                    ? 'Arrastra para marcar casillas. Lo que signifiquen, lo decidís vosotros.'
                    : 'Pulsa en una casilla para poner lo elegido, y encima de algo para quitarlo. En «Mover» se arrastran como las fichas.'}
          </p>
        </div>
      )}

      <div
        ref={tablero}
        className={[
          'tablero',
          puedeMover ? 'editable' : '',
          editable && (modo === 'niebla' || modo === 'marcar') ? 'pintando' : '',
          editable && modo === 'cosas' ? 'poniendo' : '',
        ].filter(Boolean).join(' ')}
        style={{ aspectRatio: proporcion, ['--columnas' as string]: columnas, ['--filas' as string]: filas }}
        onPointerDown={(e) => {
          if (!editable || modo === 'mover') return;
          // Las cosas del suelo se ponen de una en una: no hay trazo que arrastrar.
          if (modo === 'cosas') { ponerCosa(e.clientX, e.clientY); return; }
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
          setCogiendoCosa(null);
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

        {/*
          * Lo que hay en el suelo, debajo de las fichas: si un barril tapara a quien está
          * detrás, habría que moverlo para ver de quién es el turno.
          *
          * Bajo la niebla tampoco se ve, igual que las fichas: si el máster ha tapado media
          * sala, enseñar los barriles de dentro sería decir lo que hay ahí.
          */}
        {elementos.map((e) => {
          if (!editable && tapada(e.x, e.y)) return null;
          const dibujo = e.imagenId ? urles.get(e.imagenId) : null;
          const seMueve = editable && modo === 'mover';
          const seQuita = editable && modo === 'cosas';
          // Un jugador no la mueve, pero sí puede pulsarla para ver qué es.
          const seMira = !editable;
          return (
            <button
              key={e.id}
              type="button"
              className={[
                'cosa-mapa',
                cogiendoCosa === e.id ? 'cogida' : '',
                editable && tapada(e.x, e.y) ? 'bajo-niebla' : '',
                e.roto ? 'rota' : '',
                mirando === e.id ? 'mirada' : '',
                seMira ? 'se-mira' : '',
              ].filter(Boolean).join(' ')}
              style={{
                left: `${(e.x * 100) / columnas}%`,
                top: `${(e.y * 100) / filas}%`,
                width: `calc(${Math.max(1, e.ancho ?? 1)} * 100% / ${columnas})`,
                height: `calc(${Math.max(1, e.alto ?? 1)} * 100% / ${filas})`,
              }}
              title={
                seQuita ? `${e.nombre} · pulsa para quitarlo`
                  : `${e.nombre}${e.roto ? ' · rota' : ''} · pulsa para ver su ficha`
              }
              aria-label={`${e.nombre}${e.roto ? ', rota' : ''}`}
              disabled={!seMueve && !seQuita && !seMira}
              onClick={() => { if (seMira) setMirando(mirando === e.id ? null : e.id); }}
              onPointerDown={(ev) => {
                if (seQuita) {
                  ev.stopPropagation();
                  cambiarMapa({ elementos: quitarElemento(elementos, e.id) });
                  return;
                }
                if (!seMueve) return;
                ev.stopPropagation();
                (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
                setCogiendoCosa(e.id);
              }}
              onPointerUp={(ev) => {
                if (!cogiendoCosa) return;
                ev.stopPropagation();
                moverCosa(cogiendoCosa, ev.clientX, ev.clientY);
                setCogiendoCosa(null);
              }}
            >
              {dibujo ? (
                <img src={dibujo} alt="" className="dibujo" draggable={false} />
              ) : (
                <span className="dibujo emoji" aria-hidden>{e.icono ?? '⬛'}</span>
              )}
              <span className="nombre-ficha">{e.nombre}</span>
            </button>
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
          // Si el retrato no está en este aparato se cae en las dos letras de siempre.
          const retrato = p.retratoId ? urles.get(p.retratoId) : null;
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
              {retrato ? (
                <img src={retrato} alt="" className="inicial retrato" draggable={false} />
              ) : (
                <span className="inicial">{p.nombre.slice(0, 2)}</span>
              )}
              <span className="nombre-ficha">{p.nombre}</span>
            </button>
          );
        })}
      </div>

      {(() => {
        const e = elementos.find((x) => x.id === mirando);
        // Bajo la niebla tampoco se puede leer: sería decir qué hay ahí.
        if (!e || (!editable && tapada(e.x, e.y))) return null;
        return (
          <FichaDeCosa
            elemento={e}
            plantilla={e.plantilla ? cosasPropias.find((c) => c.cosa === e.plantilla) : undefined}
            dibujo={e.imagenId ? urles.get(e.imagenId) ?? null : null}
            editable={editable}
            onCambiar={(cambios) => cambiarMapa({ elementos: cambiarElemento(elementos, e.id, cambios) })}
            onQuitar={() => { cambiarMapa({ elementos: quitarElemento(elementos, e.id) }); setMirando(null); }}
            onCerrar={() => setMirando(null)}
          />
        );
      })()}
    </div>
  );
}

/**
 * La ficha de una cosa del suelo: lo que es y cómo está.
 *
 * Arriba lo de su tipo —Entereza, Presencia y lo que la mesa le haya puesto, que viene de
 * Contenido propio—; abajo lo de **ésta**: si está rota y lo que el máster le haya apuntado.
 * Nada se calcula: un golpe no la rompe sola, la rompe el máster cuando la mesa lo decide.
 *
 * Si la cosa es secreta, el jugador ve que está ahí y cómo se llama, pero no sus datos: una
 * trampa que enseña su ficha deja de ser una trampa.
 */
function FichaDeCosa({
  elemento: e,
  plantilla,
  dibujo,
  editable,
  onCambiar,
  onQuitar,
  onCerrar,
}: {
  elemento: ElementoMapa;
  plantilla: CosaMapa | undefined;
  dibujo: string | null;
  editable: boolean;
  onCambiar: (c: Partial<Pick<ElementoMapa, 'roto' | 'notas'>>) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  // El máster lee la plantilla viva y entera —también la de las secretas—; el jugador, la
  // copia que viaja en el combate, que de una secreta no trae nada.
  const ficha: FichaDeCosa | undefined = editable && plantilla
    ? fichaParaElMapa({ ...plantilla, oculta: 'No' })
    : e.ficha;
  const secreta = plantilla ? plantilla.oculta === 'Sí' : Boolean(e.ficha?.secreta);
  const veDatos = editable || !secreta;
  const [notas, setNotas] = useState(e.notas ?? '');
  // Si llega una nota nueva desde otra pantalla, se enseña la nueva.
  useEffect(() => { setNotas(e.notas ?? ''); }, [e.id, e.notas]);
  const caracteristicas = ficha?.caracteristicas ?? [];

  return (
    <section className={`ficha-cosa${e.roto ? ' rota' : ''}`} aria-label={`Ficha de ${e.nombre}`}>
      <div className="cabecera-cosa">
        {dibujo ? <img src={dibujo} alt="" /> : <span className="emoji" aria-hidden>{e.icono ?? '⬛'}</span>}
        <div>
          <h3>
            {e.nombre}
            {e.roto && <span className="marca-rota">rota</span>}
          </h3>
          <p className="tamano-cosa">
            {Math.max(1, e.ancho ?? 1)} × {Math.max(1, e.alto ?? 1)} casillas
            {editable && secreta && ' · sus datos no los ven los jugadores'}
          </p>
        </div>
        <button type="button" className="accion" onClick={onCerrar} aria-label="Cerrar la ficha">
          Cerrar
        </button>
      </div>

      {!veDatos ? (
        <p className="sin-datos">Sus características las lleva el máster.</p>
      ) : !ficha ? (
        <p className="sin-datos">
          {editable
            ? e.plantilla
              ? `«${e.plantilla}» ya no está en el contenido propio de la mesa.`
              : 'Es de las de siempre: no tiene ficha. Para darle características, créala en Campañas → Contenido propio → Cosas del mapa.'
            : 'No tiene ficha.'}
        </p>
      ) : (
        <>
          {(ficha.entereza || ficha.presencia || caracteristicas.length > 0) && (
            <dl className="datos-cosa">
              {ficha.entereza ? <div><dt>Entereza</dt><dd>{ficha.entereza}</dd></div> : null}
              {ficha.presencia ? <div><dt>Presencia</dt><dd>{ficha.presencia}</dd></div> : null}
              {caracteristicas.map((c, i) => (
                <div key={i}><dt>{c.nombre}</dt><dd>{c.valor}</dd></div>
              ))}
            </dl>
          )}
          {ficha.descripcion && <p className="descripcion-cosa">{ficha.descripcion}</p>}
        </>
      )}

      {editable ? (
        <div className="estado-cosa">
          <label className="casilla">
            <input type="checkbox" checked={Boolean(e.roto)} onChange={(ev) => onCambiar({ roto: ev.target.checked })} />
            Rota
          </label>
          <div className="campo">
            <label htmlFor={`notas-${e.id}`}>
              Notas de ésta{secreta ? '' : ' · las ven los jugadores'}
            </label>
            <textarea
              id={`notas-${e.id}`}
              rows={2}
              value={notas}
              placeholder="Ya está vacía, la abrió Zhaira…"
              onChange={(ev) => setNotas(ev.target.value)}
              onBlur={() => { if (notas !== (e.notas ?? '')) onCambiar({ notas }); }}
            />
          </div>
          <button type="button" className="accion peligro" onClick={onQuitar}>Quitar del mapa</button>
        </div>
      ) : (
        veDatos && e.notas && <p className="notas-cosa">{e.notas}</p>
      )}
    </section>
  );
}
