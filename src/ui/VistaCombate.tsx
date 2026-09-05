import { useCallback, useEffect, useMemo, useState } from 'react';
import { almacen, type Combate, type Enemigo } from '../almacen/almacen';
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
  type Participante,
} from '../motor/combatePorTurnos';
import { calcular, cargarDatosCalculo, type Personaje } from '../motor/personaje';
import type { Catalogo } from '../datos/paquetes';
import type { Reglamento } from '../motor/reglamento';
import { tirarD100 } from '../motor/dados';
import { Seccion, cuenta as contar } from './Seccion';

interface Props {
  campanaId: string;
  soyElMaster: boolean;
  /** Las fichas que pueden entrar: las de esta campaña. */
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
function useTurnos(
  personajes: Personaje[],
  catalogo: Catalogo,
  reglamento: Reglamento,
): Map<string, number> {
  const [turnos, setTurnos] = useState(new Map<string, number>());
  // La lista se recalcula sola en cada repintado; lo que importa es qué fichas hay y con
  // qué equipo, no la identidad del array.
  const clave = personajes
    .map((p) => `${p.id}:${p.actualizadoEn}`)
    .join('|');

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const pares = await Promise.all(
        personajes.map(async (p): Promise<[string, number]> => {
          const datos = await cargarDatosCalculo(p, catalogo);
          const ficha = calcular(p, datos, reglamento);
          return [p.id, ficha.combate.armas[0]?.turno ?? ficha.combate.turnoSinArma];
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

export function VistaCombate({
  campanaId,
  soyElMaster,
  personajes,
  catalogo,
  reglamento,
  nuevoId,
  onAnotar,
}: Props) {
  const { combates, guardar, borrar } = useCombates(campanaId);
  const turnos = useTurnos(personajes, catalogo, reglamento);
  const [enemigos, setEnemigos] = useState<Enemigo[]>([]);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  useEffect(() => {
    void almacen.listarEnemigos(campanaId).then(setEnemigos);
  }, [campanaId]);

  // El que se esté jugando ahora mismo se abre solo: es lo que se viene a mirar.
  useEffect(() => {
    if (!abiertoId) setAbiertoId(combates.find((c) => c.estado === 'enCurso')?.id ?? null);
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
            personajes={personajes}
            enemigos={enemigos}
            turnos={turnos}
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
  personajes,
  enemigos,
  turnos,
  nuevoId,
  onCambiar,
  onBorrar,
  onAnotar,
}: {
  combate: Combate;
  personajes: Personaje[];
  enemigos: Enemigo[];
  turnos: Map<string, number>;
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
  const leToca = actuando(combate);
  const preparando = combate.estado === 'preparando';

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

  /** Tira por todos los que aún no tienen número. Los escritos a mano no se pisan. */
  const tirarPorTodos = () => {
    let c = combate;
    for (const p of combate.participantes) {
      if (p.iniciativa !== undefined) continue;
      const t = tirarD100(p.turnoBase);
      c = conTirada(c, p.id, t.total);
      onAnotar(
        `Iniciativa de ${p.nombre}: ${p.turnoBase + t.total}`,
        `${p.turnoBase} de turno + ${t.dados.join(' + ')}${t.abierta ? ' (abierta)' : ''}${t.pifia ? ` − ${t.nivelPifia} de pifia` : ''}`,
      );
    }
    onCambiar(c);
  };

  const tirarPorUno = (p: Participante) => {
    const t = tirarD100(p.turnoBase);
    onAnotar(
      `Iniciativa de ${p.nombre}: ${p.turnoBase + t.total}`,
      `${p.turnoBase} de turno + ${t.dados.join(' + ')}${t.abierta ? ' (abierta)' : ''}`,
    );
    onCambiar(conTirada(combate, p.id, t.total));
  };

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

      {preparando && (
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
                <p className="nada">No hay fichas en esta campaña.</p>
              ) : (
                personajes.map((p) => {
                  const ya = dentro.has(`personaje:${p.id}`);
                  const turno = turnos.get(p.id);
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
                      <span className="nombre">{p.nombre || 'Sin nombre'}</span>
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
                    {/* Un enemigo entra tantas veces como haga falta: tres bandidos son
                        tres participantes con su propia iniciativa. */}
                    <button
                      className="accion"
                      onClick={() => {
                        const cuantos =
                          combate.participantes.filter((x) => x.refId === e.id).length;
                        anadir(
                          'enemigo',
                          e.id,
                          cuantos > 0 ? `${e.nombre} ${cuantos + 1}` : e.nombre,
                          e.turno,
                        );
                      }}
                    >
                      Añadir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
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
                <th>En pie</th>
                {preparando && <th />}
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
                  <td className="num">{p.tirada ?? '—'}</td>
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
                  {preparando && (
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
        {combate.participantes.length > 0 && combate.estado !== 'terminado' && (
          <button className="accion" onClick={tirarPorTodos}>Tirar iniciativa</button>
        )}
        {combate.estado !== 'terminado' && combate.participantes.some((p) => p.iniciativa === undefined) && (
          <button
            className="accion"
            onClick={() => {
              const p = combate.participantes.find((x) => x.iniciativa === undefined);
              if (p) tirarPorUno(p);
            }}
          >
            Tirar por el siguiente
          </button>
        )}
        {preparando && combate.participantes.length > 0 && (
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
