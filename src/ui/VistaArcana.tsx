import { useMemo, useState } from 'react';
import type { Catalogo } from '../datos/paquetes';
import type { Encarnacion, Invocacion } from '../datos/tipos';
import {
  GRADOS,
  TIEMPOS_SINCRONIZACION,
  agruparPoderes,
  sincronizar,
  type Grado,
} from '../motor/encarnaciones';
import { useColeccion } from './estado';

const etiqueta = {
  fontSize: '0.68rem',
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  color: 'var(--texto-debil)',
} as const;

function Dato({ nombre, valor }: { nombre: string; valor?: string }) {
  if (!valor || valor === '—') return null;
  return (
    <p style={{ margin: '2px 0' }}>
      <strong>{nombre}:</strong> {valor}
    </p>
  );
}

function FichaInvocacion({ i, sangrada }: { i: Invocacion; sangrada?: boolean }) {
  return (
    <div style={{ marginLeft: sangrada ? 18 : 0, marginTop: sangrada ? 12 : 0 }}>
      <h4 style={{ margin: '0 0 4px' }}>{i.invocacion}</h4>
      {i.descripcion && (
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem', margin: '0 0 8px' }}>
          {i.descripcion}
        </p>
      )}
      <div className="rejilla">
        <div className="campo">
          <label style={etiqueta}>Dificultad</label>
          <strong>{i.dificultad}</strong>
        </div>
        <div className="campo">
          <label style={etiqueta}>Coste</label>
          <strong>{i.coste}</strong>
        </div>
        <div className="campo">
          <label style={etiqueta}>H. Ataque</label>
          <strong>{i.hAtaque}</strong>
        </div>
        <div className="campo">
          <label style={etiqueta}>H. Defensa</label>
          <strong>{i.hDefensa}</strong>
        </div>
        <div className="campo">
          <label style={etiqueta}>Acción</label>
          <strong>{i.accion}</strong>
        </div>
      </div>
      <Dato nombre="Pacto" valor={i.pacto} />
      <Dato nombre="Efecto" valor={i.efecto} />
      <Dato nombre="Duración" valor={i.duracion} />
      <Dato nombre="Apariencia habitual" valor={i.apariencia} />
      {i.notas && <p className="aviso">{i.notas}</p>}
    </div>
  );
}

function Invocaciones({ invocaciones }: { invocaciones: Invocacion[] }) {
  const [busca, setBusca] = useState('');
  const grupos = useMemo(() => agruparPoderes(invocaciones), [invocaciones]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter(
      (g) =>
        g.madre.invocacion.toLowerCase().includes(q) ||
        g.madre.grupo.toLowerCase().includes(q) ||
        g.poderes.some((p) => p.invocacion.toLowerCase().includes(q)),
    );
  }, [grupos, busca]);

  return (
    <div>
      <div className="campo">
        <label htmlFor="busca-invocacion">Buscar</label>
        <input
          id="busca-invocacion"
          value={busca}
          placeholder="Behemoth, Bestias Cardinales, Thanathos…"
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
        {filtrados.length} de {grupos.length} invocaciones.
      </p>
      {filtrados.map((g) => (
        <article className="panel" key={g.madre.invocacion} style={{ marginBottom: 14 }}>
          <p style={{ ...etiqueta, margin: 0 }}>{g.madre.grupo}</p>
          <FichaInvocacion i={g.madre} />
          {g.poderes.map((p) => (
            <FichaInvocacion key={p.invocacion} i={p} sangrada />
          ))}
        </article>
      ))}
    </div>
  );
}

function Encarnaciones({ encarnaciones }: { encarnaciones: Encarnacion[] }) {
  const [nombre, setNombre] = useState('');
  const [grado, setGrado] = useState<Grado>('Menor');
  const [rasgos, setRasgos] = useState<string[]>([]);
  const [tiempo, setTiempo] = useState('Un minuto');
  const [sinInformacion, setSinInformacion] = useState(false);

  const e = encarnaciones.find((x) => x.encarnacion === nombre);
  const calculo = e ? sincronizar(e, { grado, rasgos, tiempo, sinInformacion }) : null;

  const elegir = (n: string) => {
    setNombre(n);
    // Los rasgos son de cada encarnación, así que al cambiar no tienen sentido.
    setRasgos([]);
  };

  const marcar = (rasgo: string) =>
    setRasgos((antes) =>
      antes.includes(rasgo) ? antes.filter((r) => r !== rasgo) : [...antes, rasgo],
    );

  return (
    <div>
      <div className="campo">
        <label htmlFor="elige-encarnacion">Encarnación</label>
        <select id="elige-encarnacion" value={nombre} onChange={(ev) => elegir(ev.target.value)}>
          <option value="">Elige una…</option>
          {encarnaciones.map((x) => (
            <option key={x.encarnacion} value={x.encarnacion}>
              {x.encarnacion}
            </option>
          ))}
        </select>
      </div>

      {!e ? (
        <div className="vacio panel">
          <h2>Elige una encarnación</h2>
          <p>
            Verás sus tres grados de afinidad y podrás calcular la dificultad de
            sincronización marcando los rasgos que cumpla tu personaje.
          </p>
        </div>
      ) : (
        <>
          <article className="panel" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>{e.encarnacion}</h3>
            {e.descripcion && (
              <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem' }}>{e.descripcion}</p>
            )}
            {e.poderesGenericos && (
              <>
                <label style={etiqueta}>Poderes genéricos</label>
                <p style={{ whiteSpace: 'pre-line', margin: '4px 0 0' }}>{e.poderesGenericos}</p>
              </>
            )}
          </article>

          <article className="panel" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Control de Invocación</h3>
            <div className="rejilla">
              <div className="campo">
                <label htmlFor="grado-afinidad">Grado de afinidad</label>
                <select
                  id="grado-afinidad"
                  value={grado}
                  onChange={(ev) => setGrado(ev.target.value as Grado)}
                >
                  {GRADOS.map((g) => {
                    const a = e.afinidades.find((x) => x.grado === g);
                    return (
                      <option key={g} value={g}>
                        {g} — nivel {a?.nivel}, dificultad {a?.dificultad}, {a?.zeon} Zeon
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="tiempo-sincro">Tiempo de sincronización</label>
                <select id="tiempo-sincro" value={tiempo} onChange={(ev) => setTiempo(ev.target.value)}>
                  {TIEMPOS_SINCRONIZACION.map((t) => (
                    <option key={t.tiempo} value={t.tiempo}>
                      {t.tiempo} ({t.modificador >= 0 ? '+' : ''}
                      {t.modificador})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label style={etiqueta}>Rasgos del invocador</label>
            <div style={{ display: 'grid', gap: 2, margin: '6px 0 10px' }}>
              {e.modificadores.map((m) => (
                <label className="opcion" key={m.rasgo}>
                  <input
                    type="checkbox"
                    checked={rasgos.includes(m.rasgo)}
                    onChange={() => marcar(m.rasgo)}
                  />
                  <span>
                    {m.rasgo}{' '}
                    <span style={{ color: 'var(--texto-debil)' }}>
                      ({m.modificador >= 0 ? '+' : ''}
                      {m.modificador})
                    </span>
                  </span>
                </label>
              ))}
              <label className="opcion">
                <input
                  type="checkbox"
                  checked={sinInformacion}
                  onChange={() => setSinInformacion((v) => !v)}
                />
                <span>
                  No conoce bien su vida ni su personalidad{' '}
                  <span style={{ color: 'var(--texto-debil)' }}>(+50 a la dificultad)</span>
                </span>
              </label>
            </div>

            {calculo && (
              <div className="recursos tira">
                <div className="recurso">
                  <span>Dificultad</span>
                  <strong>{calculo.dificultad}</strong>
                  <span className="sufijo">
                    {calculo.base} base {calculo.porRasgos >= 0 ? '+' : '−'}
                    {Math.abs(calculo.porRasgos)} rasgos{' '}
                    {calculo.porTiempo >= 0 ? '+' : '−'}
                    {Math.abs(calculo.porTiempo)} tiempo
                    {calculo.porInformacion ? ` +${calculo.porInformacion} sin datos` : ''}
                  </span>
                </div>
                <div className="recurso">
                  <span>Coste</span>
                  <strong>{calculo.zeon}</strong>
                  <span className="sufijo">Zeon</span>
                </div>
                <div className="recurso">
                  <span>Nivel mínimo</span>
                  <strong>{calculo.nivelRequerido}</strong>
                  <span className="sufijo">para este grado</span>
                </div>
              </div>
            )}
            <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
              La tirada la haces tú: esto sólo dice contra qué. El requisito de nivel avisa,
              no bloquea, como el resto de límites de la aplicación.
            </p>
          </article>

          {e.afinidades.map((a) => (
            <article className="panel" key={a.grado} style={{ marginBottom: 14 }}>
              <h4 style={{ marginTop: 0 }}>Afinidad {a.grado}</h4>
              <div className="rejilla">
                <div className="campo">
                  <label style={etiqueta}>Nivel</label>
                  <strong>{a.nivel}</strong>
                </div>
                <div className="campo">
                  <label style={etiqueta}>Dificultad</label>
                  <strong>{a.dificultad}</strong>
                </div>
                <div className="campo">
                  <label style={etiqueta}>Zeon</label>
                  <strong>{a.zeon}</strong>
                </div>
                {a.hAtaque != null && (
                  <div className="campo">
                    <label style={etiqueta}>H. Ataque</label>
                    <strong>{a.hAtaque}</strong>
                  </div>
                )}
                {a.hDefensa != null && (
                  <div className="campo">
                    <label style={etiqueta}>H. {a.tipoDefensa ?? 'Defensa'}</label>
                    <strong>{a.hDefensa}</strong>
                  </div>
                )}
                {a.proyeccionMagica != null && (
                  <div className="campo">
                    <label style={etiqueta}>Proyección Mágica</label>
                    <strong>{a.proyeccionMagica}</strong>
                  </div>
                )}
                {a.turno != null && (
                  <div className="campo">
                    <label style={etiqueta}>Turno</label>
                    <strong>{a.turno}</strong>
                  </div>
                )}
              </div>
              {a.arma && <Dato nombre="Arma" valor={a.arma} />}
              <p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{a.poderes}</p>
            </article>
          ))}
        </>
      )}
    </div>
  );
}

export function VistaArcana({ catalogo }: { catalogo: Catalogo }) {
  const invocaciones = useColeccion(catalogo, 'invocaciones');
  const encarnaciones = useColeccion(catalogo, 'encarnaciones');
  const [pestana, setPestana] = useState<'invocaciones' | 'encarnaciones'>('invocaciones');

  if (invocaciones.length === 0 && encarnaciones.length === 0) {
    return (
      <div className="vacio panel">
        <h2>El Arcana Exxet no está activo</h2>
        <p>
          Las Invocaciones y las Encarnaciones vienen en el paquete <strong>Arcana Exxet</strong>.
          Actívalo en la pestaña Campañas para verlas aquí.
        </p>
      </div>
    );
  }

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Lo sobrenatural</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Aeones, Grandes Bestias y los «héroes de la existencia» del Arcana Exxet. Las
          invocaciones se consultan; de las encarnaciones se calcula además la dificultad de
          sincronización, que es lo único de todo el capítulo que de verdad sale de una suma.
        </p>
        <div className="acciones-regla">
          <button
            className={`accion${pestana === 'invocaciones' ? ' primaria' : ''}`}
            onClick={() => setPestana('invocaciones')}
          >
            Invocaciones ({invocaciones.filter((i) => !i.parteDe).length})
          </button>
          <button
            className={`accion${pestana === 'encarnaciones' ? ' primaria' : ''}`}
            onClick={() => setPestana('encarnaciones')}
          >
            Encarnaciones ({encarnaciones.length})
          </button>
        </div>
      </section>

      {pestana === 'invocaciones' ? (
        <Invocaciones invocaciones={invocaciones} />
      ) : (
        <Encarnaciones encarnaciones={encarnaciones} />
      )}
    </div>
  );
}
