import { useCallback, useEffect, useMemo, useState } from 'react';
import { almacen, type Combate, type Enemigo } from '../almacen/almacen';
import { cliente } from '../nube/supabase';
import { combateDeCampana, fichasDeCampana, tiradasDeCampana } from '../nube/sincronizacion';
import {
  actuando,
  combateVacio,
  conParticipante,
  conTirada,
  empezar,
  enJuego,
  orden,
  siguiente,
  terminar,
  ultimaIniciativaPorPersonaje,
  ultimoMovimientoPorPersonaje,
  type Participante,
} from '../motor/combatePorTurnos';
import { calcular, cargarDatosCalculo, type Personaje } from '../motor/personaje';
import type { Catalogo } from '../datos/paquetes';
import type { Reglamento } from '../motor/reglamento';
import { tirarD100 } from '../motor/dados';
import { Seccion, cuenta as contar } from './Seccion';
import { MapaBatalla } from './MapaBatalla';

interface Props {
  campanaId: string;
  soyElMaster: boolean;
  /** Si esta mesa usa el campo de batalla. Se decide en los ajustes de la campaña. */
  conMapa: boolean;
  /** Todas las fichas del aparato. Las de esta campaña salen primero. */
  personajes: Personaje[];
  catalogo: Catalogo;
  reglamento: Reglamento;
  nuevoId: () => string;
  /** Para dejar constancia en el registro de la partida. */
  onAnotar: (texto: string, detalle: string) => void;
}

/**
 * El turno de partida de cada ficha.
 *
 * Se coge el del arma que lleve equipada, y si no lleva ninguna, el de las manos vacías.
 * No es un detalle: un mandoble resta 70 al turno, y empezar el combate con el número
 * equivocado descoloca el orden entero.
 *
 * Hace falta un `DatosCalculo` por ficha —cada una tiene su raza y su categoría— así que
 * se cargan todos de una vez al entrar y se quedan cacheados. Mientras llegan, el turno
 * se enseña como desconocido en vez de como un cero que nadie sabría distinguir de un
 * turno de verdad malísimo.
 */
export interface ResumenDeFicha {
  turno: number;
  pv: number;
  pvMax: number;
}

function useTurnos(
  personajes: Personaje[],
  catalogo: Catalogo,
  reglamento: Reglamento,
): Map<string, ResumenDeFicha> {
  const [turnos, setTurnos] = useState(new Map<string, ResumenDeFicha>());
  // La lista se recalcula sola en cada repintado; lo que importa es qué fichas hay y con
  // qué equipo, no la identidad del array.
  const clave = personajes
    .map((p) => `${p.id}:${p.actualizadoEn}:${p.estado.pvActuales ?? ''}`)
    .join('|');

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const pares = await Promise.all(
        personajes.map(async (p): Promise<[string, ResumenDeFicha]> => {
          const datos = await cargarDatosCalculo(p, catalogo);
          const ficha = calcular(p, datos, reglamento);
          return [
            p.id,
            {
              turno: ficha.combate.armas[0]?.turno ?? ficha.combate.turnoSinArma,
              pv: p.estado.pvActuales ?? ficha.puntosVida.valor,
              pvMax: ficha.puntosVida.valor,
            },
          ];
        }),
      );
      if (vigente) setTurnos(new Map(pares));
    })();
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, catalogo, reglamento]);

  return turnos;
}

export function useCombates(campanaId: string | null) {
  const [combates, setCombates] = useState<Combate[]>([]);

  const recargar = useCallback(async () => {
    setCombates(await almacen.listarCombates(campanaId));
  }, [campanaId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const guardar = useCallback(async (c: Combate) => {
    setCombates((antes) => {
      const i = antes.findIndex((x) => x.id === c.id);
      return i >= 0 ? antes.map((x) => (x.id === c.id ? c : x)) : [c, ...antes];
    });
    await almacen.guardarCombate(c);
  }, []);

  const borrar = useCallback(async (id: string) => {
    setCombates((antes) => antes.filter((c) => c.id !== id));
    await almacen.borrarCombate(id);
  }, []);

  return { combates, guardar, borrar, recargar };
}

/*
 * Cada cuánto se pregunta si hay combate y por dónde va.
 *
 * Cuatro segundos mientras se pelea: es lo que tarda alguien en decir «te toca» en voz alta
 * desde el otro lado de la mesa, y llegar más tarde que eso convierte la pantalla en un
 * estorbo. Veinte cuando no hay nada, que es sólo para enterarse de que ha empezado uno.
 *
 * Con la pestaña de fondo no se pregunta nada: nadie está mirando, y son peticiones a un
 * plan gratuito.
 */
const CADA_EN_COMBATE = 4000;
const CADA_EN_CALMA = 20000;

/**
 * El combate que hay montado en esta campaña, mire quien mire.
 *
 * El máster lo tiene en su propio aparato, porque es suyo. Un jugador no: el suyo vive en
 * la nube y lo lee de ahí, que para eso las políticas dejan leer a la mesa entera.
 *
 * Cuenta también el que está **montándose**, no sólo el que ya ha empezado: la iniciativa
 * se tira justo antes de empezar, así que si sólo valiera el que está en curso el jugador
 * no podría tirar la suya desde su pantalla, que es para lo que sirve todo esto. Si
 * hubiera dos, manda el que se está jugando.
 */
export function useCombateActivo(campanaId: string | null): Combate | null {
  const [combate, setCombate] = useState<Combate | null>(null);

  useEffect(() => {
    if (!campanaId) { setCombate(null); return; }
    let vigente = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    const mirar = async () => {
      if (!vigente) return;
      let encontrado: Combate | null = null;

      // Lo propio primero: si el que mira es el máster, el combate es suyo y está aquí.
      const locales = await almacen.listarCombates(campanaId);
      encontrado =
        locales.find((c) => c.estado === 'enCurso') ??
        locales.find((c) => c.estado === 'preparando') ??
        null;

      // Y si no, el de la mesa. Un fallo de red no borra lo que ya se estaba enseñando:
      // en mitad de un combate, quedarse en blanco por un corte de wifi es peor que
      // enseñar el último orden conocido.
      if (!encontrado) {
        const supa = cliente();
        if (supa) {
          const { combate: remoto } = await combateDeCampana(supa, campanaId);
          if (remoto) encontrado = remoto;
        }
      }

      if (!vigente) return;
      setCombate((antes) => (encontrado ? encontrado : antes && antes.estado !== 'terminado' ? antes : null));
      reloj = setTimeout(
        () => void mirar(),
        encontrado ? CADA_EN_COMBATE : CADA_EN_CALMA,
      );
    };

    const alVolver = () => {
      if (document.visibilityState !== 'visible') { clearTimeout(reloj); return; }
      clearTimeout(reloj);
      void mirar();
    };
    document.addEventListener('visibilitychange', alVolver);
    void mirar();

    return () => {
      vigente = false;
      clearTimeout(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [campanaId]);

  return combate;
}

/**
 * Lo que ve un jugador durante un combate: si le toca y por dónde va el orden.
 *
 * Va arriba del todo de la Mesa y sin poder plegarse. Durante una pelea es lo único que se
 * mira de verdad, y esconderlo detrás de un desplegable obligaría a abrirlo cada asalto.
 */
/**
 * Las iniciativas que los jugadores han tirado desde su pantalla para este combate.
 *
 * Llegan por el registro de la partida, que es donde cada uno puede escribir lo suyo. Se
 * miran las locales y las de la mesa, igual que el combate: en el aparato del máster
 * estarán las suyas, y las de sus jugadores vienen de la nube.
 *
 * Devuelve, por personaje, la **última** que haya tirado: si alguien repite la tirada
 * porque se equivocó, manda la de después.
 */
function useIniciativasTiradas(campanaId: string | null, combateId: string | null) {
  const [porPersonaje, setPorPersonaje] = useState<Map<string, number>>(new Map());
  const [movimientos, setMovimientos] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!campanaId || !combateId) { setPorPersonaje(new Map()); setMovimientos(new Map()); return; }
    let vigente = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    const mirar = async () => {
      if (!vigente) return;
      const locales = await almacen.listarTiradas(campanaId);
      let todas = locales;
      const supa = cliente();
      if (supa) {
        const { tiradas } = await tiradasDeCampana(supa, campanaId);
        todas = [...locales, ...tiradas];
      }
      if (!vigente) return;
      setPorPersonaje(ultimaIniciativaPorPersonaje(todas, combateId));
      setMovimientos(ultimoMovimientoPorPersonaje(todas, combateId));
      reloj = setTimeout(() => void mirar(), CADA_EN_COMBATE);
    };

    const alVolver = () => {
      clearTimeout(reloj);
      if (document.visibilityState === 'visible') void mirar();
    };
    document.addEventListener('visibilitychange', alVolver);
    void mirar();
    return () => {
      vigente = false;
      clearTimeout(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [campanaId, combateId]);

  return { iniciativas: porPersonaje, movimientos };
}

/**
 * Las fichas que hay en esta mesa: las de este aparato más las de los jugadores.
 *
 * Sin esto, el máster sólo podía meter en un combate las fichas que tuviera él guardadas,
 * que en una mesa de verdad son las suyas y poco más. Las de los jugadores viven en la
 * nube y las políticas le dejan leerlas —pero no escribirlas, que la ficha de un jugador
 * es del jugador—, así que se consultan y se enseñan sin guardarlas en local.
 *
 * Si una ficha está en los dos sitios manda la local: es la que se está editando aquí.
 */
function useFichasDeLaMesa(campanaId: string | null, locales: Personaje[]): Personaje[] {
  const [ajenas, setAjenas] = useState<Personaje[]>([]);

  useEffect(() => {
    if (!campanaId) { setAjenas([]); return; }
    const supa = cliente();
    if (!supa) { setAjenas([]); return; }
    let vigente = true;
    void fichasDeCampana(supa, campanaId).then(({ personajes }) => {
      if (vigente) setAjenas(personajes);
    });
    return () => { vigente = false; };
  }, [campanaId]);

  return useMemo(() => {
    const mios = new Set(locales.map((p) => p.id));
    return [...locales, ...ajenas.filter((p) => !mios.has(p.id))];
  }, [locales, ajenas]);
}

export function PanelIniciativa({
  combate,
  personajeId,
  conMapa,
  onMoverMiFicha,
}: {
  combate: Combate;
  personajeId: string;
  /** Si la mesa usa el campo de batalla. */
  conMapa: boolean;
  /** Mover tu propia ficha. Se apunta en el registro y el máster lo recoge. */
  onMoverMiFicha?: (destino: { x: number; y: number }, desde?: { x: number; y: number }) => void;
}) {
  const lista = enJuego(combate);
  const leToca = actuando(combate);
  const soyYo = (p: Participante) => p.tipo === 'personaje' && p.refId === personajeId;
  const esMiTurno = leToca ? soyYo(leToca) : false;
  // Cuántos actúan antes que yo en lo que queda de asalto. Sirve para saber si te da
  // tiempo a ir a por agua o si más te vale ir pensando lo que haces.
  const miSitio = lista.findIndex(soyYo);
  const yo = lista[miSitio];
  const donde = leToca ? lista.findIndex((p) => p.id === leToca.id) : -1;
  const cuantosAntes = miSitio > donde ? miSitio - donde : -1;

  return (
    <section className={`panel iniciativa-mesa${esMiTurno ? ' es-mi-turno' : ''}`}>
      <div className="titulo-con-accion">
        <h2>{combate.nombre}</h2>
        <span className="asalto">asalto {combate.asalto}</span>
      </div>

      {esMiTurno ? (
        <p className="tu-turno" role="status">Es tu turno</p>
      ) : leToca ? (
        <p className="quien-va" role="status">
          Va <strong>{leToca.nombre}</strong>
          {cuantosAntes === 1 && ' · eres el siguiente'}
          {cuantosAntes > 1 && ` · te quedan ${cuantosAntes} por delante`}
          {miSitio < 0 && ' · no estás en este combate'}
        </p>
      ) : (
        /*
         * Antes de empezar. Es el momento en el que hay algo que hacer —tirar— así que se
         * dice, en vez de un «todavía no ha empezado» que no lleva a ninguna parte.
         */
        <p className="quien-va" role="status">
          {miSitio < 0 ? (
            'Se está montando un combate y no estás en él.'
          ) : yo?.iniciativa === undefined ? (
            <strong>Tira tu iniciativa, abajo en Recursos.</strong>
          ) : (
            <>
              Tu iniciativa: <strong>{yo.iniciativa}</strong> · esperando a los demás.
            </>
          )}
        </p>
      )}

      <ol className="orden-mesa">
        {lista.map((p) => (
          <li
            key={p.id}
            className={[leToca?.id === p.id ? 'actua' : '', soyYo(p) ? 'yo' : '']
              .filter(Boolean)
              .join(' ') || undefined}
          >
            <span className="nombre">{p.nombre}</span>
            <span className="ini">{p.iniciativa ?? '—'}</span>
          </li>
        ))}
      </ol>

      {/*
        * El mapa debajo de la lista, no encima: la lista es cuatro líneas y el mapa ocupa
        * media pantalla, así que puesto delante empujaría fuera de la vista justo lo que
        * hay que mirar cada turno. De sólo lectura: las fichas las mueve el máster.
        */}
      {conMapa && combate.mapa?.imagenId && (
        <MapaBatalla
          combate={combate}
          campanaId={combate.campanaId}
          editable={false}
          personajeId={personajeId}
          onMoverMiFicha={onMoverMiFicha}
        />
      )}
    </section>
  );
}

export function VistaCombate({
  campanaId,
  soyElMaster,
  conMapa,
  personajes,
  catalogo,
  reglamento,
  nuevoId,
  onAnotar,
}: Props) {
  const { combates, guardar, borrar } = useCombates(campanaId);
  const fichasDeLaMesa = useFichasDeLaMesa(campanaId, personajes);
  const turnos = useTurnos(fichasDeLaMesa, catalogo, reglamento);
  const [enemigos, setEnemigos] = useState<Enemigo[]>([]);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  useEffect(() => {
    void almacen.listarEnemigos(campanaId).then(setEnemigos);
  }, [campanaId]);

  // El que se esté jugando —o montando— se abre solo: es lo que se viene a mirar.
  useEffect(() => {
    if (abiertoId) return;
    const vivo =
      combates.find((c) => c.estado === 'enCurso') ?? combates.find((c) => c.estado === 'preparando');
    setAbiertoId(vivo?.id ?? null);
  }, [combates, abiertoId]);

  const crear = async () => {
    const c = combateVacio(nuevoId(), campanaId, `Combate ${combates.length + 1}`);
    await guardar(c);
    setAbiertoId(c.id);
  };

  if (!soyElMaster) {
    return (
      <p style={{ color: 'var(--texto-tenue)' }}>
        El combate lo monta el máster. Cuando empiece, lo verás en tu pantalla de Mesa.
      </p>
    );
  }

  return (
    <>
      <p style={{ color: 'var(--texto-tenue)', marginTop: 0 }}>
        Eliges quién entra, se tira la iniciativa y la lista queda ordenada. Lo que pase
        dentro del combate —quién ataca a quién, si alguien retrasa su turno— lo lleváis
        vosotros: esto sólo sostiene el orden para que nadie tenga que apuntarlo en un papel.
      </p>

      <div className="acciones-regla" style={{ marginBottom: 14 }}>
        <button className="accion primaria" onClick={() => void crear()}>Nuevo combate</button>
      </div>

      {combates.length === 0 && (
        <p style={{ color: 'var(--texto-debil)' }}>Todavía no hay ningún combate.</p>
      )}

      {combates.map((c) => (
        <Seccion
          key={c.id}
          titulo={c.nombre}
          resumen={
            c.estado === 'enCurso'
              ? `asalto ${c.asalto} · ${contar(enJuego(c).length, 'en pie', 'en pie')}`
              : c.estado === 'terminado'
                ? `terminado · ${contar(c.participantes.length, 'participante', 'participantes')}`
                : contar(c.participantes.length, 'apuntado', 'apuntados', 'sin nadie todavía')
          }
          abierta={c.id === abiertoId}
        >
          <Encuentro
            combate={c}
            campanaId={campanaId}
            conMapa={conMapa}
            personajes={fichasDeLaMesa}
            enemigos={enemigos}
            fichas={turnos}
            nuevoId={nuevoId}
            onCambiar={(x) => void guardar(x)}
            onBorrar={() => void borrar(c.id)}
            onAnotar={onAnotar}
          />
        </Seccion>
      ))}
    </>
  );
}

function Encuentro({
  combate,
  campanaId,
  conMapa,
  personajes,
  enemigos,
  fichas,
  nuevoId,
  onCambiar,
  onBorrar,
  onAnotar,
}: {
  combate: Combate;
  campanaId: string;
  /** Si la mesa usa el campo de batalla. */
  conMapa: boolean;
  personajes: Personaje[];
  enemigos: Enemigo[];
  fichas: Map<string, ResumenDeFicha>;
  nuevoId: () => string;
  onCambiar: (c: Combate) => void;
  onBorrar: () => void;
  onAnotar: (texto: string, detalle: string) => void;
}) {
  const dentro = useMemo(
    () => new Set(combate.participantes.map((p) => `${p.tipo}:${p.refId}`)),
    [combate.participantes],
  );
  const enOrden = orden(combate.participantes);
  /*
   * Primero las fichas de esta campaña, que son las que casi siempre entran; detrás las
   * demás del aparato, marcadas. No se esconden porque un máster mete de vez en cuando una
   * ficha que no está formalmente en la campaña —un PNJ con hoja, el personaje de alguien
   * que viene de visita— y esconderla obligaría a irse a otra pantalla a moverla de mesa.
   */
  const enOrdenDeMesa = useMemo(
    () =>
      [...personajes].sort((a, b) => {
        const ma = a.campanaId === campanaId ? 0 : 1;
        const mb = b.campanaId === campanaId ? 0 : 1;
        return ma !== mb ? ma - mb : (a.nombre || '').localeCompare(b.nombre || '');
      }),
    [personajes, campanaId],
  );
  const leToca = actuando(combate);
  /*
   * Elegir quién entra no se cierra al empezar.
   *
   * En una mesa llegan refuerzos a mitad de pelea, alguien aparece tarde y a veces se te
   * olvida meter a uno. Cerrar la lista al pulsar «Empezar» obligaría a terminar el
   * combate y montarlo otra vez por una tontería. Sólo se esconde cuando ya ha terminado,
   * que entonces es un registro y no se toca.
   */
  const sePuedeTocar = combate.estado !== 'terminado';

  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  /*
   * Las iniciativas que han tirado los jugadores desde su pantalla se recogen solas.
   *
   * Sólo rellenan huecos: si el máster ya tiene un número para alguien —lo tiró él o lo
   * escribió a mano— no se pisa. Recoger por sorpresa un número sobre uno que ya estaba
   * puesto sería cambiarle el orden a la mesa sin que nadie lo haya pedido.
   */
  const { iniciativas: tiradasDeJugadores, movimientos } = useIniciativasTiradas(campanaId, combate.id);
  useEffect(() => {
    const pendientes = combate.participantes.filter(
      (p) => p.tipo === 'personaje' && p.iniciativa === undefined && tiradasDeJugadores.has(p.refId),
    );
    if (pendientes.length === 0) return;
    onCambiar({
      ...combate,
      participantes: combate.participantes.map((p) =>
        pendientes.some((x) => x.id === p.id)
          ? { ...p, iniciativa: tiradasDeJugadores.get(p.refId) }
          : p,
      ),
      actualizadoEn: new Date().toISOString(),
    });
    // `onCambiar` y `combate` cambian en cada repintado; lo que dispara esto es que llegue
    // una tirada nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiradasDeJugadores]);

  /*
   * Y lo mismo con las fichas que los jugadores han movido en el mapa.
   *
   * Aquí sí se pisa lo que hubiera: un jugador moviendo su ficha **está diciendo dónde
   * está**, no rellenando un hueco. Sólo se escribe si de verdad ha cambiado de casilla,
   * para no estar guardando el combate cada cuatro segundos sin motivo.
   */
  useEffect(() => {
    const movidos = combate.participantes.filter((p) => {
      const m = p.tipo === 'personaje' ? movimientos.get(p.refId) : undefined;
      return m && (m.x !== p.x || m.y !== p.y);
    });
    if (movidos.length === 0) return;
    onCambiar({
      ...combate,
      participantes: combate.participantes.map((p) =>
        movidos.some((x) => x.id === p.id) ? { ...p, ...movimientos.get(p.refId)! } : p,
      ),
      actualizadoEn: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos]);

  /**
   * Mete N copias de un enemigo de una tacada.
   *
   * Se numeran sólo cuando hay más de uno: «Bandido» a secas si es el único, y «Bandido 1,
   * 2, 3» si son varios. Un «Jefe bandido 1» sin un 2 detrás se lee raro y encima ocupa
   * sitio en una fila que ya va justa.
   */
  const anadirEnemigos = (e: Enemigo) => {
    const cuantos = cantidades[e.id] ?? 1;
    const yaHabia = combate.participantes.filter((x) => x.refId === e.id).length;
    const total = yaHabia + cuantos;
    const nuevos: Participante[] = Array.from({ length: cuantos }, (_, i) => ({
      id: nuevoId(),
      tipo: 'enemigo' as const,
      refId: e.id,
      nombre: total > 1 ? `${e.nombre} ${yaHabia + i + 1}` : e.nombre,
      turnoBase: e.turno,
      activo: true,
    }));
    onCambiar({
      ...combate,
      participantes: [...combate.participantes, ...nuevos],
      actualizadoEn: new Date().toISOString(),
    });
  };

  const anadir = (tipo: Participante['tipo'], refId: string, nombre: string, turnoBase: number) =>
    onCambiar({
      ...combate,
      participantes: [
        ...combate.participantes,
        { id: nuevoId(), tipo, refId, nombre, turnoBase, activo: true },
      ],
      actualizadoEn: new Date().toISOString(),
    });

  const quitar = (id: string) =>
    onCambiar({
      ...combate,
      participantes: combate.participantes.filter((p) => p.id !== id),
      actualizadoEn: new Date().toISOString(),
    });

  const desglose = (p: Participante, t: ReturnType<typeof tirarD100>) =>
    `${p.turnoBase} de turno + ${t.dados.join(' + ')}` +
    (t.abierta ? ' (abierta)' : '') +
    (t.pifia ? ` − ${t.nivelPifia} de pifia` : '');

  /**
   * Tira por unos cuantos y lo apunta en el registro de la partida.
   *
   * Nunca pisa un número que ya esté: si un jugador ha cantado su tirada y el máster le da
   * al botón de tirar por los que falten, sería muy fácil borrarla sin enterarse.
   */
  const tirarPor = (quienes: Participante[]) => {
    let c = combate;
    for (const p of quienes) {
      if (p.iniciativa !== undefined) continue;
      const t = tirarD100(p.turnoBase);
      c = conTirada(c, p.id, t.total);
      onAnotar(`Iniciativa de ${p.nombre}: ${p.turnoBase + t.total}`, desglose(p, t));
    }
    onCambiar(c);
  };

  /** Uno suelto, y este sí repite: se pulsa a propósito, sobre esa fila. */
  const retirar = (p: Participante) => {
    const t = tirarD100(p.turnoBase);
    onAnotar(`Iniciativa de ${p.nombre}: ${p.turnoBase + t.total}`, desglose(p, t));
    onCambiar(conTirada(combate, p.id, t.total));
  };

  const sinTirar = combate.participantes.filter((p) => p.iniciativa === undefined);
  const enemigosSinTirar = sinTirar.filter((p) => p.tipo === 'enemigo');

  return (
    <>
      <div className="campo">
        <label htmlFor={`nombre-${combate.id}`}>Nombre del combate</label>
        <input
          id={`nombre-${combate.id}`}
          value={combate.nombre}
          onChange={(e) =>
            onCambiar({ ...combate, nombre: e.target.value, actualizadoEn: new Date().toISOString() })
          }
        />
      </div>

      {sePuedeTocar && (
        <>
          <h3 style={{ marginTop: 14 }}>Quién entra</h3>
          <p style={{ color: 'var(--texto-debil)', fontSize: '0.84rem', marginTop: 2 }}>
            No entra toda la mesa por defecto: hay escenas en las que la mitad del grupo está
            en otra parte, y apuntarlos a todos para luego irlos quitando es más trabajo.
          </p>

          <div className="elegir-combatientes">
            <div>
              <h4>Jugadores</h4>
              {personajes.length === 0 ? (
                <p className="nada">No hay ninguna ficha guardada en este aparato.</p>
              ) : (
                enOrdenDeMesa.map((p) => {
                  const ya = dentro.has(`personaje:${p.id}`);
                  const resumen = fichas.get(p.id);
                  const turno = resumen?.turno;
                  return (
                    <label key={p.id} className="fila-combatiente">
                      <input
                        type="checkbox"
                        checked={ya}
                        onChange={() => {
                          if (ya) {
                            const suyo = combate.participantes.find(
                              (x) => x.tipo === 'personaje' && x.refId === p.id,
                            );
                            if (suyo) quitar(suyo.id);
                          } else {
                            anadir('personaje', p.id, p.nombre || 'Sin nombre', turno ?? 0);
                          }
                        }}
                      />
                      <span className="nombre">
                        {p.nombre || 'Sin nombre'}
                        {p.campanaId !== campanaId && <span className="fuera-mesa"> · otra mesa</span>}
                      </span>
                      <span className="turno">
                        {turno === undefined ? 'calculando…' : `turno ${turno}`}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div>
              <h4>Bestiario</h4>
              {enemigos.length === 0 ? (
                <p className="nada">No hay enemigos en esta campaña.</p>
              ) : (
                enemigos.map((e) => (
                  <div key={e.id} className="fila-combatiente">
                    <span className="nombre">{e.nombre}</span>
                    <span className="turno">turno {e.turno}</span>
                    {/* Con cantidad, porque «hay tres bandidos» es una frase, no tres
                        clics. Cada uno entra como participante con su propia iniciativa:
                        en Ánima cada bandido actúa en su momento, no todos a la vez. */}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="cuantos"
                      aria-label={`Cuántos ${e.nombre}`}
                      value={cantidades[e.id] ?? 1}
                      onChange={(ev) =>
                        setCantidades((c) => ({
                          ...c,
                          [e.id]: Math.max(1, Math.min(20, Number(ev.target.value) || 1)),
                        }))
                      }
                    />
                    <button className="accion" onClick={() => anadirEnemigos(e)}>
                      Añadir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {conMapa && (
        <Seccion
          titulo="Campo de batalla"
          resumen={combate.mapa?.imagenId ? 'con mapa' : 'sin montar'}
          abierta={Boolean(combate.mapa)}
        >
          <MapaBatalla combate={combate} campanaId={campanaId} editable onCambiar={onCambiar} />
        </Seccion>
      )}

      <h3 style={{ marginTop: 18 }}>
        Orden de iniciativa
        {combate.estado === 'enCurso' && (
          <span className="asalto">asalto {combate.asalto}</span>
        )}
      </h3>

      {combate.participantes.length === 0 ? (
        <p style={{ color: 'var(--texto-debil)' }}>Nadie apuntado todavía.</p>
      ) : (
        <div className="desplazable">
          <table>
            <thead>
              <tr>
                <th>Quién</th>
                <th className="num">Turno</th>
                <th className="num">Dado</th>
                <th className="num">Iniciativa</th>
                <th className="num">Vida</th>
                <th>En pie</th>
                {sePuedeTocar && <th />}
              </tr>
            </thead>
            <tbody>
              {enOrden.map((p) => (
                <tr
                  key={p.id}
                  className={
                    [
                      leToca?.id === p.id ? 'le-toca' : '',
                      p.activo ? '' : 'fuera',
                    ].filter(Boolean).join(' ') || undefined
                  }
                >
                  <td>
                    {leToca?.id === p.id && <span className="marca-turno" aria-label="Le toca">▶</span>}
                    {p.nombre}
                    <span className="de-donde">{p.tipo === 'enemigo' ? ' · bestiario' : ''}</span>
                  </td>
                  <td className="num">{p.turnoBase}</td>
                  <td className="num">
                    {p.tirada ?? '—'}
                    {combate.estado !== 'terminado' && (
                      <button
                        className="accion dado"
                        title={`Tirar por ${p.nombre}`}
                        aria-label={`Tirar por ${p.nombre}`}
                        onClick={() => retirar(p)}
                      >
                        Tirar
                      </button>
                    )}
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      className="iniciativa"
                      aria-label={`Iniciativa de ${p.nombre}`}
                      value={p.iniciativa ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        onCambiar(
                          conParticipante(combate, p.id, {
                            iniciativa: e.target.value === '' ? undefined : Number(e.target.value),
                          }),
                        )
                      }
                    />
                  </td>
                  {/*
                    * Los PV de los jugadores, para no ir preguntando «¿cómo vas?» cada dos
                    * turnos. De los enemigos no se enseñan aquí: el máster los lleva en el
                    * bestiario y meterlos en esta tabla la volvería otra cosa.
                    */}
                  <td className="num">
                    {(() => {
                      if (p.tipo !== 'personaje') return <span className="sin-dato">—</span>;
                      const r = fichas.get(p.refId);
                      if (!r) return <span className="sin-dato">—</span>;
                      const caido = r.pv <= 0;
                      return (
                        <span className={caido ? 'pv-caido' : undefined}>
                          {r.pv}
                          <span className="de-tope"> / {r.pvMax}</span>
                          {caido && p.activo && (
                            <button
                              className="accion dado"
                              onClick={() => onCambiar(conParticipante(combate, p.id, { activo: false }))}
                            >
                              Cae
                            </button>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${p.nombre} sigue en pie`}
                      checked={p.activo}
                      onChange={(e) =>
                        onCambiar(conParticipante(combate, p.id, { activo: e.target.checked }))
                      }
                    />
                  </td>
                  {sePuedeTocar && (
                    <td>
                      <button className="accion" onClick={() => quitar(p.id)}>Quitar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="acciones-regla" style={{ marginTop: 14 }}>
        {/*
          * Dos botones, no uno, porque en una mesa los jugadores tiran su propio dado y
          * cantan el número: lo que el máster tira de verdad es lo de enfrente. El de
          * «los que falten» está para las mesas que lo tiran todo por aquí.
          */}
        {enemigosSinTirar.length > 0 && (
          <button className="accion" onClick={() => tirarPor(enemigosSinTirar)}>
            Tirar por los enemigos
          </button>
        )}
        {sinTirar.length > 0 && (
          <button className="accion" onClick={() => tirarPor(sinTirar)}>
            Tirar por los {sinTirar.length} que faltan
          </button>
        )}
        {combate.estado === 'preparando' && combate.participantes.length > 0 && (
          <button className="accion primaria" onClick={() => onCambiar(empezar(combate))}>
            Empezar
          </button>
        )}
        {combate.estado === 'enCurso' && (
          <>
            <button className="accion primaria" onClick={() => onCambiar(siguiente(combate))}>
              Siguiente turno
            </button>
            <button className="accion" onClick={() => onCambiar(terminar(combate))}>
              Terminar
            </button>
          </>
        )}
        <button className="accion peligro" onClick={onBorrar}>Borrar el combate</button>
      </div>

      {combate.estado === 'terminado' && (
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginBottom: 0 }}>
          Terminado el{' '}
          {combate.terminadoEn && new Date(combate.terminadoEn).toLocaleString('es-ES')}. Se
          queda aquí con lo que sacó cada uno.
        </p>
      )}
    </>
  );
}
