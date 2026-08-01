import { useMemo, useState } from 'react';
import type { Catalogo } from '../datos/paquetes';
import { useColeccion } from './estado';
import { CARACTERISTICAS_KI, type CaracteristicaKi } from '../motor/ki';
import {
  ASALTOS_SOSTENIDA,
  CM_POR_DESCUENTO,
  MAX_DESCUENTO_CM,
  MAX_REDUCCION_KI,
  NIVELES,
  calcularTecnica,
  disenoVacio,
  leerCaracteristicas,
  puedeCrearNivel,
  repartoPorDefecto,
  resumirCoste,
  type CatalogoTecnicas,
  type DisenoTecnica,
  type EfectoElegido,
  type NivelTecnica,
} from '../motor/tecnicas';
import type { EfectoTecnica, TipoEfectoTecnica } from '../datos/tipos';

interface Props {
  /** Técnicas propias que ya tiene el personaje, para la regla de árbol. */
  propias: DisenoTecnica[];
  /** Niveles de todas sus Técnicas, incluidas las del compendio. */
  nivelesConocidos: number[];
  tecnicasDesvinculadas: boolean;
  catalogo: Catalogo;
  onCambiar: (t: DisenoTecnica[]) => void;
}

const NIVEL_NOMBRE: Record<NivelTecnica, string> = {
  1: 'Básica (nivel 1)',
  2: 'Mayor (nivel 2)',
  3: 'Arcana (nivel 3)',
};

/** Un efecto dentro del diseño: elegir opción, marcarlo Primario y repartir su Ki. */
function FilaEfecto({
  elegido,
  indice,
  opciones,
  fichas,
  onCambiar,
  onBorrar,
  onPrimario,
}: {
  elegido: EfectoElegido;
  indice: number;
  opciones: EfectoTecnica[];
  fichas: TipoEfectoTecnica[];
  onCambiar: (e: EfectoElegido) => void;
  onBorrar: () => void;
  onPrimario: () => void;
}) {
  const opcion = opciones.find((o) => o.referencia === elegido.referencia);
  const ficha = fichas.find((f) => f.efecto.toLowerCase() === (opcion?.efecto ?? '').toLowerCase());
  const cars = leerCaracteristicas(ficha?.caracteristicas);
  const kiBase = elegido.primario ? (opcion?.kiPrincipal ?? 0) : (opcion?.kiSecundaria ?? 0);

  const usadas = CARACTERISTICAS_KI.filter((c) => (elegido.reparto[c] ?? 0) > 0);
  const recargo = usadas
    .filter((c) => c !== cars.principal)
    .reduce((t, c) => t + (cars.alternativas.find((a) => a.caracteristica === c)?.recargo ?? 0), 0);
  const necesario = kiBase + recargo;
  const repartido = CARACTERISTICAS_KI.reduce((t, c) => t + (elegido.reparto[c] ?? 0), 0);

  const disponibles = cars.principal
    ? [cars.principal, ...cars.alternativas.map((a) => a.caracteristica)]
    : [];

  return (
    <article className="panel" style={{ marginBottom: 10 }}>
      <div className="rejilla">
        <div className="campo">
          <label htmlFor={`efecto-${indice}`}>Efecto</label>
          <select
            id={`efecto-${indice}`}
            value={elegido.referencia}
            onChange={(e) => {
              const nueva = opciones.find((o) => o.referencia === e.target.value);
              const fichaNueva = fichas.find(
                (f) => f.efecto.toLowerCase() === (nueva?.efecto ?? '').toLowerCase(),
              );
              onCambiar({
                ...elegido,
                referencia: e.target.value,
                reparto: nueva ? repartoPorDefecto(nueva, fichaNueva, elegido.primario) : {},
              });
            }}
          >
            {opciones.map((o) => (
              <option key={o.referencia} value={o.referencia}>
                {o.efecto} · {o.opcion} ({o.CM} CM, nv {o.nivel ?? 1})
              </option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ fontSize: '0.86rem', margin: '2px 0 8px', color: 'var(--texto-tenue)' }}>
        {ficha?.tipo} · {ficha?.clase} · característica natural{' '}
        <strong className="destacado">{cars.principal ?? '—'}</strong>
        {cars.alternativas.length > 0 && (
          <>
            {'. Alternativas: '}
            {cars.alternativas.map((a) => `${a.caracteristica} +${a.recargo}`).join(', ')}
          </>
        )}
      </p>

      <label className="opcion" style={{ marginBottom: 8 }}>
        <input type="radio" name="primario" checked={elegido.primario} onChange={onPrimario} />
        <span>
          Efecto Primario
          <em>Sale más barato en Ki, y toda Técnica tiene uno y sólo uno.</em>
        </span>
      </label>

      <div className="rejilla">
        {disponibles.map((c: CaracteristicaKi) => (
          <div key={c} style={{ display: 'inline-block', marginRight: 8 }}>
            <label
              htmlFor={`reparto-${indice}-${c}`}
              style={{
                display: 'block',
                fontSize: '0.62rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: c === cars.principal ? 'var(--oro)' : 'var(--texto-debil)',
              }}
            >
              {c}
              {c !== cars.principal &&
                ` +${cars.alternativas.find((a) => a.caracteristica === c)?.recargo ?? 0}`}
            </label>
            <input
              id={`reparto-${indice}-${c}`}
              type="number"
              min={0}
              style={{ width: 70 }}
              value={elegido.reparto[c] ?? 0}
              onChange={(e) =>
                onCambiar({
                  ...elegido,
                  reparto: { ...elegido.reparto, [c]: Math.max(0, Number(e.target.value) || 0) },
                })
              }
            />
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.84rem', margin: '6px 0 0' }}>
        Cuesta <strong className="destacado">{kiBase}</strong> de Ki
        {recargo > 0 && (
          <>
            {' '}
            + <strong className="destacado">{recargo}</strong> de recargo ={' '}
            <strong className="destacado">{necesario}</strong>
          </>
        )}
        {' · '}
        has repartido{' '}
        <strong className={repartido === necesario ? 'destacado' : 'peligro-texto'}>
          {repartido}
        </strong>
        {' · '}
        {opcion?.CM ?? 0} CM
      </p>

      <div className="acciones-regla">
        <button
          className="accion"
          onClick={() => {
            const nueva = opciones.find((o) => o.referencia === elegido.referencia);
            const f = fichas.find((x) => x.efecto.toLowerCase() === (nueva?.efecto ?? '').toLowerCase());
            if (nueva) onCambiar({ ...elegido, reparto: repartoPorDefecto(nueva, f, elegido.primario) });
          }}
        >
          Todo a {cars.principal ?? 'su característica'}
        </button>
        <button className="accion" onClick={onBorrar}>
          Quitar Efecto
        </button>
      </div>
    </article>
  );
}

export function CreadorTecnicas({
  propias,
  nivelesConocidos,
  tecnicasDesvinculadas,
  catalogo,
  onCambiar,
}: Props) {
  const opcionesJson = useColeccion(catalogo, 'efectosTecnica');
  const fichasJson = useColeccion(catalogo, 'tiposEfectoTecnica');
  const [abierta, setAbierta] = useState<number | null>(null);

  const cat: CatalogoTecnicas = useMemo(
    () => ({ opciones: opcionesJson as EfectoTecnica[], fichas: fichasJson as TipoEfectoTecnica[] }),
    [opcionesJson, fichasJson],
  );

  const guardar = (i: number, d: DisenoTecnica) =>
    onCambiar(propias.map((x, j) => (j === i ? d : x)));

  if (cat.opciones.length === 0) {
    return <p style={{ color: 'var(--texto-debil)' }}>Cargando la tabla de Efectos…</p>;
  }

  return (
    <section className="panel">
      <h2>Técnicas propias</h2>
      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
        Una Técnica es un Efecto Primario más los Secundarios que quepan. El nivel decide
        cuánto CM puede costar y cuántas desventajas admite. El reparto del coste en Ki entre
        características es el paso 6 del manual: mover puntos a una característica alternativa
        suma su recargo al coste del Efecto.
      </p>

      {propias.map((diseno, i) => {
        const calc = calcularTecnica(diseno, cat);
        const limites = NIVELES[diseno.nivel];
        const arbol = puedeCrearNivel(
          diseno.nivel,
          // Para la regla de árbol no cuenta ella misma.
          nivelesConocidos.filter((_, j) => j !== i),
          tecnicasDesvinculadas,
        );
        const desplegada = abierta === i;

        return (
          <article
            key={i}
            className="panel"
            style={{ marginBottom: 12, background: 'var(--fondo-2)' }}
          >
            <div className="rejilla">
              <div className="campo">
                <label htmlFor={`nombre-tecnica-${i}`}>Nombre</label>
                <input
                  id={`nombre-tecnica-${i}`}
                  value={diseno.nombre}
                  placeholder="Excisum Aeris"
                  onChange={(e) => guardar(i, { ...diseno, nombre: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor={`arbol-tecnica-${i}`}>Árbol</label>
                <input
                  id={`arbol-tecnica-${i}`}
                  value={diseno.arbol ?? ''}
                  placeholder="Celéritas, Ignis…"
                  onChange={(e) => guardar(i, { ...diseno, arbol: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor={`nivel-tecnica-${i}`}>Nivel</label>
                <select
                  id={`nivel-tecnica-${i}`}
                  value={diseno.nivel}
                  onChange={(e) =>
                    guardar(i, { ...diseno, nivel: Number(e.target.value) as NivelTecnica })
                  }
                >
                  {([1, 2, 3] as NivelTecnica[]).map((n) => (
                    <option key={n} value={n}>
                      {NIVEL_NOMBRE[n]} · {NIVELES[n].cmMinimo}–{NIVELES[n].cmMaximo} CM
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p style={{ fontSize: '0.95rem', margin: '4px 0 8px' }}>
              <strong className="destacado">{calc.CM} CM</strong>
              {' · '}
              Ki: <strong className="destacado">{resumirCoste(calc.ki) || '—'}</strong>
              {calc.kiMantenimiento > 0 && ` · ${calc.kiMantenimiento} de Ki por asalto mantenido`}
              <span style={{ color: 'var(--texto-debil)' }}>
                {' '}
                (límite {limites.cmMinimo}–{limites.cmMaximo}, hasta {limites.maxDesventajas}{' '}
                desventaja{limites.maxDesventajas > 1 ? 's' : ''})
              </span>
            </p>

            {!arbol.puede && <p className="aviso">{arbol.motivo}</p>}
            {calc.avisos.map((a, j) => (
              <p key={j} className="aviso">
                {a}
              </p>
            ))}

            <div className="acciones-regla">
              <button className="accion" onClick={() => setAbierta(desplegada ? null : i)}>
                {desplegada ? 'Plegar' : `Editar Efectos (${diseno.efectos.length})`}
              </button>
              <button
                className="accion peligro"
                onClick={() => onCambiar(propias.filter((_, j) => j !== i))}
              >
                Borrar Técnica
              </button>
            </div>

            {desplegada && (
              <div style={{ marginTop: 12 }}>
                {diseno.efectos.map((efecto, k) => (
                  <FilaEfecto
                    key={k}
                    elegido={efecto}
                    indice={k}
                    opciones={cat.opciones}
                    fichas={cat.fichas}
                    onCambiar={(e) =>
                      guardar(i, {
                        ...diseno,
                        efectos: diseno.efectos.map((x, j) => (j === k ? e : x)),
                      })
                    }
                    onPrimario={() =>
                      guardar(i, {
                        ...diseno,
                        // El Primario es exclusivo: marcar uno desmarca el anterior.
                        efectos: diseno.efectos.map((x, j) => ({ ...x, primario: j === k })),
                      })
                    }
                    onBorrar={() =>
                      guardar(i, { ...diseno, efectos: diseno.efectos.filter((_, j) => j !== k) })
                    }
                  />
                ))}

                <button
                  className="accion primaria"
                  onClick={() => {
                    const primera = cat.opciones[0];
                    const f = cat.fichas.find(
                      (x) => x.efecto.toLowerCase() === primera.efecto.toLowerCase(),
                    );
                    const esPrimario = diseno.efectos.length === 0;
                    guardar(i, {
                      ...diseno,
                      efectos: [
                        ...diseno.efectos,
                        {
                          referencia: primera.referencia,
                          primario: esPrimario,
                          reparto: repartoPorDefecto(primera, f, esPrimario),
                        },
                      ],
                    });
                  }}
                >
                  Añadir Efecto
                </button>

                <div style={{ marginTop: 14 }}>
                  <label className="opcion" style={{ marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={diseno.mantenida}
                      onChange={(e) =>
                        guardar(i, {
                          ...diseno,
                          mantenida: e.target.checked,
                          sostenida: e.target.checked ? null : diseno.sostenida,
                        })
                      }
                    />
                    <span>
                      Mantenida
                      <em>
                        Dura mientras pagues Ki cada asalto. Cuesta {NIVELES[diseno.nivel] && ''}
                        {diseno.nivel === 1 ? 10 : diseno.nivel === 2 ? 20 : 30} CM más.
                      </em>
                    </span>
                  </label>

                  <div className="campo">
                    <label htmlFor={`sostenida-${i}`}>Sostenimiento</label>
                    <select
                      id={`sostenida-${i}`}
                      value={diseno.sostenida ?? ''}
                      onChange={(e) =>
                        guardar(i, {
                          ...diseno,
                          sostenida: (e.target.value || null) as DisenoTecnica['sostenida'],
                          mantenida: e.target.value ? false : diseno.mantenida,
                        })
                      }
                    >
                      <option value="">Ninguno (instantánea)</option>
                      <option value="menor">Menor · {ASALTOS_SOSTENIDA.menor} asaltos</option>
                      <option value="mayor">Mayor · {ASALTOS_SOSTENIDA.mayor} asaltos</option>
                    </select>
                  </div>

                  <p
                    style={{
                      fontSize: '0.66rem',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--oro)',
                      margin: '10px 0 4px',
                    }}
                  >
                    Alterar el coste
                  </p>
                  <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginTop: 0 }}>
                    Cada punto de Ki que rebajes cuesta 10 CM (máximo {MAX_REDUCCION_KI}, y nunca
                    por debajo de la mitad del coste base). Al revés, puedes descontar hasta{' '}
                    {MAX_DESCUENTO_CM} CM a razón de 2 puntos de Ki por cada {CM_POR_DESCUENTO}.
                  </p>
                  <div className="rejilla">
                    {CARACTERISTICAS_KI.filter((c) => (calc.ki[c] ?? 0) > 0 || (diseno.reduccionKi[c] ?? 0) > 0).map(
                      (c) => (
                        <div key={c} style={{ display: 'inline-block', marginRight: 8 }}>
                          <label
                            htmlFor={`rebaja-${i}-${c}`}
                            style={{
                              display: 'block',
                              fontSize: '0.62rem',
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'var(--texto-debil)',
                            }}
                          >
                            Rebajar {c}
                          </label>
                          <input
                            id={`rebaja-${i}-${c}`}
                            type="number"
                            min={0}
                            style={{ width: 70 }}
                            value={diseno.reduccionKi[c] ?? 0}
                            onChange={(e) =>
                              guardar(i, {
                                ...diseno,
                                reduccionKi: {
                                  ...diseno.reduccionKi,
                                  [c]: Math.max(0, Number(e.target.value) || 0),
                                },
                              })
                            }
                          />
                        </div>
                      ),
                    )}
                    <div className="campo">
                      <label htmlFor={`descuento-${i}`}>Descontar CM</label>
                      <select
                        id={`descuento-${i}`}
                        value={diseno.descuentoCM}
                        onChange={(e) =>
                          guardar(i, { ...diseno, descuentoCM: Number(e.target.value) })
                        }
                      >
                        {[0, 5, 10, 15, 20].map((v) => (
                          <option key={v} value={v}>
                            {v === 0 ? 'No' : `−${v} CM (+${(v / 5) * 2} Ki)`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="campo">
                    <label htmlFor={`descripcion-${i}`}>Cómo se ve</label>
                    <textarea
                      id={`descripcion-${i}`}
                      rows={2}
                      placeholder="Un tajo en el aire que corta el viento y alcanza al enemigo a cincuenta metros."
                      value={diseno.descripcion ?? ''}
                      onChange={(e) => guardar(i, { ...diseno, descripcion: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}

      <button
        className="accion primaria"
        onClick={() => onCambiar([...propias, disenoVacio(`Técnica ${propias.length + 1}`)])}
      >
        Crear Técnica
      </button>
    </section>
  );
}
