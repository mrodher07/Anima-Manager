import { useState } from 'react';
import { CORE_EXXET, PAQUETES } from '../datos/paquetes';
import { CREACION_POR_DEFECTO, type AjustesCreacion } from '../motor/reglamento';
import { pdPorNivel } from '../motor/multiclase';
import type { Campana } from '../almacen/almacen';
import type { Cuenta } from '../nube/cuenta';
import { PanelMesa } from './PanelMesa';
import { VistaReglas } from './VistaReglas';
import { VistaPersonalizado } from './VistaPersonalizado';
import { Ayuda, Seccion, cuenta as contar } from './Seccion';
import { nuevoId } from './estado';
import type { Reglamento } from '../motor/reglamento';
import { PERSONALIZADOS_VACIOS, type Personalizados } from '../datos/paquetes';

interface Props {
  /** Las mías, las que puedo editar y borrar. */
  campanas: Campana[];
  /** Las de otros másters en las que juego. Sólo lectura. */
  ajenas: Campana[];
  campanaId: string | null;
  cuenta: Cuenta;
  onActivar: (id: string | null) => void;
  onGuardar: (c: Campana) => void;
  onCrear: (c: Omit<Campana, 'id' | 'propietario' | 'actualizadoEn'>) => Promise<Campana>;
  onBorrar: (id: string) => void;
  /** El reglamento vigente y cómo cambiarlo: las reglas caseras son de la campaña. */
  reglamento: Reglamento;
  onCambiarReglamento: (r: Reglamento) => void;
}

/**
 * Las secciones de una campaña activa. Reglas y Contenido propio estaban sueltas en la
 * barra de arriba, y las dos son **de una campaña**: sin campaña, Contenido propio no
 * podía hacer nada y sólo enseñaba un aviso. Aquí dentro se explican solas.
 */
type Panel = 'jugadores' | 'ajustes' | 'reglas' | 'propio' | 'diario';

const PANELES: { id: Panel; texto: string }[] = [
  { id: 'jugadores', texto: 'Jugadores' },
  { id: 'ajustes', texto: 'Ajustes' },
  { id: 'reglas', texto: 'Reglas' },
  { id: 'propio', texto: 'Contenido propio' },
  { id: 'diario', texto: 'Diario' },
];

interface Borrador {
  nombre: string;
  descripcion: string;
  paquetes: string[];
  sistemaCombate: 'normal' | 'dramatico';
  creacion: Required<AjustesCreacion>;
}

/** Lo que trae una campaña recién creada si no se toca nada. */
const NUEVA: Borrador = {
  nombre: '',
  descripcion: '',
  paquetes: [CORE_EXXET.id],
  sistemaCombate: 'normal',
  creacion: { ...CREACION_POR_DEFECTO },
};

/**
 * Campañas: la lista, crear una nueva y la mesa de la que está activa.
 *
 * Antes crear una campaña era un `window.prompt` pidiendo el nombre, y todo lo demás
 * —manuales, sistema de combate, con qué nivel se empieza— había que ir descubriéndolo
 * después, repartido por la pantalla. Pero eso es justo lo que se decide en una sesión
 * cero, de una sentada y antes de que nadie escriba una ficha, así que ahora se pregunta
 * junto y de una vez. Todo lleva su valor del manual puesto: se puede crear una campaña
 * dándole a Crear y ya.
 */
export function VistaCampanas({
  campanas,
  ajenas,
  campanaId,
  cuenta,
  onActivar,
  onGuardar,
  onCrear,
  onBorrar,
  reglamento,
  onCambiarReglamento,
}: Props) {
  const [creando, setCreando] = useState(false);
  const [panel, setPanel] = useState<Panel>('jugadores');
  const [borrador, setBorrador] = useState({ ...NUEVA });
  const [tituloNota, setTituloNota] = useState('');
  const [textoNota, setTextoNota] = useState('');

  const todas = [...campanas, ...ajenas];
  const activa = todas.find((c) => c.id === campanaId) ?? null;
  const soyElMaster = campanas.some((c) => c.id === campanaId);
  const editable = soyElMaster ? activa : null;

  const crear = async () => {
    const c = await onCrear({
      nombre: borrador.nombre.trim() || 'Campaña sin nombre',
      descripcion: borrador.descripcion.trim() || undefined,
      paquetes: borrador.paquetes,
      sistemaCombate: borrador.sistemaCombate,
      ajustes: { creacion: borrador.creacion },
      notasSesion: [],
    });
    onActivar(c.id);
    setBorrador({ ...NUEVA });
    setCreando(false);
  };

  return (
    <>
      <section className="panel">
        <h2>Campañas</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Una campaña guarda lo que decide tu mesa: qué manuales usáis, con qué nivel se
          empieza, las reglas caseras y quién juega.
        </p>

        {!creando && (
          <div className="acciones-regla" style={{ marginTop: 0, marginBottom: 14 }}>
            <button className="accion primaria" onClick={() => setCreando(true)}>
              Nueva campaña
            </button>
            {activa && (
              <button className="accion" onClick={() => onActivar(null)}>
                Salir de la campaña
              </button>
            )}
          </div>
        )}

        {creando && (
          <form
            className="alta-campana"
            onSubmit={(e) => {
              e.preventDefault();
              void crear();
            }}
          >
            <h3>Nueva campaña</h3>
            <p className="pie-nota">
              Todo esto se puede cambiar después. Viene puesto lo que dice el manual básico,
              así que si tu mesa juega estándar sólo hace falta el nombre.
            </p>

            <div className="campo">
              <label htmlFor="nueva-nombre">Nombre</label>
              <input
                id="nueva-nombre"
                autoFocus
                value={borrador.nombre}
                placeholder="La Cruzada de Lucrecio"
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="nueva-desc">De qué va</label>
              <textarea
                id="nueva-desc"
                rows={2}
                value={borrador.descripcion}
                placeholder="El tono, la región, lo que vuestros personajes tienen en común…"
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
              />
            </div>

            <AjustesDeCreacion
              valores={borrador.creacion}
              onCambiar={(creacion) => setBorrador({ ...borrador, creacion })}
            />

            <SistemaDeCombate
              valor={borrador.sistemaCombate}
              onCambiar={(sistemaCombate) => setBorrador({ ...borrador, sistemaCombate })}
            />

            <Manuales
              activos={borrador.paquetes}
              onCambiar={(paquetes) => setBorrador({ ...borrador, paquetes })}
            />

            <div className="acciones-regla">
              <button className="accion primaria" type="submit">
                Crear campaña
              </button>
              <button
                className="accion"
                type="button"
                onClick={() => {
                  setBorrador({ ...NUEVA });
                  setCreando(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {todas.length === 0 && !creando ? (
          <p style={{ color: 'var(--texto-debil)', margin: 0 }}>Todavía no hay campañas.</p>
        ) : (
          todas.length > 0 && (
            <ul className="lista-campanas">
              {todas.map((c) => {
                // Las campañas donde juego sin ser el máster se pueden activar —hacen falta
                // para calcular la ficha con sus reglas— pero no borrar: no son mías.
                const mia = campanas.some((p) => p.id === c.id);
                const reglas =
                  Object.keys(c.ajustes.formulas ?? {}).length + (c.ajustes.desactivadas?.length ?? 0);
                const cr = { ...CREACION_POR_DEFECTO, ...(c.ajustes.creacion ?? {}) };
                return (
                  <li key={c.id} className={c.id === campanaId ? 'activa' : undefined}>
                    <div className="datos">
                      <strong>{c.nombre}</strong>
                      {c.descripcion && <p className="desc">{c.descripcion}</p>}
                      <p className="meta">
                        <span>Nivel {cr.nivelInicial}</span>
                        <span>{cr.puntosCreacion} PC</span>
                        <span>{contar(c.paquetes.length, 'manual', 'manuales', 'sin manuales')}</span>
                        {(c.sistemaCombate ?? 'normal') === 'dramatico' && <span>Combate Dramático</span>}
                        {reglas > 0 && <span>{contar(reglas, 'regla casera', 'reglas caseras')}</span>}
                        {!mia && <span className="ajena">juegas en ella · sólo lectura</span>}
                      </p>
                    </div>
                    <div className="acciones">
                      {c.id === campanaId ? (
                        <span className="marca-activa">Activa</span>
                      ) : (
                        <button className="accion" onClick={() => onActivar(c.id)}>
                          Activar
                        </button>
                      )}
                      {mia && (
                        <button
                          className="accion"
                          onClick={() => {
                            onBorrar(c.id);
                            if (campanaId === c.id) onActivar(null);
                          }}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>

      {activa && (
        <>
          {/*
            Las secciones de la campaña activa. Antes se pintaban todas seguidas —la mesa,
            los ajustes y el diario, una debajo de otra— y había que recorrer la pantalla
            entera para llegar al diario. Con pestañas se ve una cosa cada vez, y caben
            aquí dentro Reglas y Contenido propio, que estaban sueltas arriba.
          */}
          <nav className="pestanas" style={{ marginTop: 18 }}>
            {PANELES.map((s) => (
              <button
                key={s.id}
                onClick={() => setPanel(s.id)}
                aria-current={panel === s.id ? 'page' : undefined}
              >
                {s.texto}
              </button>
            ))}
          </nav>

      {panel === 'jugadores' && activa && cuenta.estado === 'dentro' && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>La mesa de «{activa.nombre}»</h2>
          <PanelMesa campanaId={activa.id} soyElMaster={soyElMaster} />
        </section>
      )}

      {panel === 'jugadores' && activa && cuenta.estado !== 'dentro' && (
        <div className="aviso" style={{ marginTop: 16 }}>
          Para invitar a tus jugadores hace falta una cuenta: es lo que permite que sus fichas
          lleguen a tu pantalla. Se crea en <strong>Ajustes → Cuenta</strong>. Sin ella la
          campaña funciona igual, sólo que en este dispositivo.
        </div>
      )}

      {panel === 'ajustes' && editable && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Ajustes de «{editable.nombre}»</h2>

          <Seccion titulo="Identidad" resumen={editable.descripcion ? 'con descripción' : 'sin descripción'} abierta={false}>
            <div className="campo">
              <label htmlFor="camp-nombre">Nombre</label>
              <input
                id="camp-nombre"
                value={editable.nombre}
                onChange={(e) => onGuardar({ ...editable, nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="camp-desc">De qué va</label>
              <textarea
                id="camp-desc"
                rows={3}
                value={editable.descripcion ?? ''}
                onChange={(e) => onGuardar({ ...editable, descripcion: e.target.value })}
              />
            </div>
          </Seccion>

          <Seccion
            titulo="Con qué se empieza"
            resumen={(() => {
              const c = { ...CREACION_POR_DEFECTO, ...(editable.ajustes.creacion ?? {}) };
              return `Nivel ${c.nivelInicial} · ${c.puntosCreacion} PC`;
            })()}
          >
            <AjustesDeCreacion
              valores={{ ...CREACION_POR_DEFECTO, ...(editable.ajustes.creacion ?? {}) }}
              onCambiar={(creacion) =>
                onGuardar({ ...editable, ajustes: { ...editable.ajustes, creacion } })
              }
            />
          </Seccion>

          <Seccion
            titulo="Sistema de combate"
            resumen={(editable.sistemaCombate ?? 'normal') === 'dramatico' ? 'Dramático' : 'Normal'}
            abierta={false}
          >
            <SistemaDeCombate
              valor={editable.sistemaCombate ?? 'normal'}
              onCambiar={(sistemaCombate) => onGuardar({ ...editable, sistemaCombate })}
            />
          </Seccion>

          <Seccion
            titulo="Manuales"
            resumen={contar(editable.paquetes.length, 'activo', 'activos', 'ninguno')}
            abierta={false}
          >
            <Manuales
              activos={editable.paquetes}
              onCambiar={(paquetes) => onGuardar({ ...editable, paquetes })}
            />
          </Seccion>
        </section>
      )}

      {panel === 'ajustes' && activa && !soyElMaster && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Cómo juega esta mesa</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
            Lo decide el máster de «{activa.nombre}». Tu ficha ya se calcula con estas reglas.
          </p>
          <ResumenDeMesa campana={activa} />
        </section>
      )}

      {panel === 'diario' && editable && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Diario de «{editable.nombre}»</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem', marginTop: 0 }}>
            Lo que pasó en cada sesión. Aquí no hay reglas: lo escribís vosotros.
          </p>
          <div className="campo">
            <label htmlFor="nota-titulo">Título de la sesión</label>
            <input id="nota-titulo" value={tituloNota} onChange={(e) => setTituloNota(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="nota-texto">Qué pasó</label>
            <textarea id="nota-texto" rows={4} value={textoNota} onChange={(e) => setTextoNota(e.target.value)} />
          </div>
          <button
            className="accion primaria"
            disabled={!textoNota.trim()}
            onClick={() => {
              onGuardar({
                ...editable,
                notasSesion: [
                  {
                    id: nuevoId(),
                    fecha: new Date().toISOString(),
                    titulo: tituloNota.trim() || `Sesión ${editable.notasSesion.length + 1}`,
                    texto: textoNota.trim(),
                  },
                  ...editable.notasSesion,
                ],
              });
              setTituloNota('');
              setTextoNota('');
            }}
          >
            Guardar sesión
          </button>

          {editable.notasSesion.length > 0 && (
            <div className="diario" style={{ marginTop: 18 }}>
              {editable.notasSesion.map((n) => (
                <article key={n.id}>
                  <h3>{n.titulo}</h3>
                  <time>
                    {new Date(n.fecha).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                  <p>{n.texto}</p>
                  <button
                    className="accion"
                    style={{ marginTop: 6 }}
                    onClick={() =>
                      onGuardar({
                        ...editable,
                        notasSesion: editable.notasSesion.filter((x) => x.id !== n.id),
                      })
                    }
                  >
                    Borrar
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

          {panel === 'reglas' && (
            <>
              {!editable && (
                <div className="aviso" style={{ marginBottom: 16 }}>
                  Las reglas caseras las decide el máster de «{activa.nombre}». Aquí las ves,
                  y tu ficha ya se calcula con ellas.
                </div>
              )}
              <VistaReglas reglamento={reglamento} onCambiar={onCambiarReglamento} />
            </>
          )}

          {panel === 'propio' && (
            editable ? (
              <VistaPersonalizado
                personalizados={editable.personalizados ?? PERSONALIZADOS_VACIOS}
                onCambiar={(pers: Personalizados) =>
                  onGuardar({ ...editable, personalizados: pers })
                }
              />
            ) : (
              <div className="aviso">
                El contenido propio de «{activa.nombre}» lo lleva su máster. Lo tienes
                disponible al crear tu ficha.
              </div>
            )
          )}
        </>
      )}
    </>
  );
}

// ── Piezas compartidas entre crear y editar ───────────────────────────────────
//
// Las mismas tres decisiones aparecen al crear una campaña y al configurarla después. Como
// componentes, se escriben una vez y no hay forma de que las dos pantallas se desincronicen
// —que es lo que pasaba cuando el formulario de creación era un `prompt` y la configuración
// vivía suelta más abajo.

function AjustesDeCreacion({
  valores,
  onCambiar,
}: {
  valores: Required<AjustesCreacion>;
  onCambiar: (v: Required<AjustesCreacion>) => void;
}) {
  const pd = pdPorNivel(valores.nivelInicial);
  const porDefecto =
    valores.nivelInicial === CREACION_POR_DEFECTO.nivelInicial &&
    valores.puntosCreacion === CREACION_POR_DEFECTO.puntosCreacion &&
    valores.maximoPorDesventajas === CREACION_POR_DEFECTO.maximoPorDesventajas;

  return (
    <>
      <Ayuda>
        Las tres cifras con las que arranca un personaje. Vienen puestas las del manual
        básico. Los <strong>PD</strong> salen del nivel y no se tocan aquí: son 400 a nivel 0
        y 100 más por cada nivel a partir del 1, que empieza en 600. Subir los{' '}
        <strong>Puntos de Creación</strong> es lo que hace una campaña más heroica; el tope
        de las desventajas evita que alguien se cargue de defectos para comprarlo todo.
      </Ayuda>

      <div className="ajustes-creacion">
        <div className="campo">
          <label htmlFor="cr-nivel">Nivel de inicio</label>
          <input
            id="cr-nivel"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={valores.nivelInicial}
            onChange={(e) =>
              onCambiar({ ...valores, nivelInicial: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
            }
          />
          <small>{pd} PD</small>
        </div>
        <div className="campo">
          <label htmlFor="cr-pc">Puntos de Creación</label>
          <input
            id="cr-pc"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={valores.puntosCreacion}
            onChange={(e) =>
              onCambiar({ ...valores, puntosCreacion: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
            }
          />
          <small>el manual da 3</small>
        </div>
        <div className="campo">
          <label htmlFor="cr-desv">Tope por desventajas</label>
          <input
            id="cr-desv"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={valores.maximoPorDesventajas}
            onChange={(e) =>
              onCambiar({
                ...valores,
                maximoPorDesventajas: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
              })
            }
          />
          <small>el manual pone 3</small>
        </div>
      </div>

      {!porDefecto && (
        <div className="acciones-regla" style={{ marginTop: 0 }}>
          <button className="accion" type="button" onClick={() => onCambiar({ ...CREACION_POR_DEFECTO })}>
            Volver a los valores del manual
          </button>
        </div>
      )}
    </>
  );
}

function SistemaDeCombate({
  valor,
  onCambiar,
}: {
  valor: 'normal' | 'dramatico';
  onCambiar: (v: 'normal' | 'dramatico') => void;
}) {
  return (
    <>
      <Ayuda>
        El <strong>Combate Dramático</strong> no cambia ninguna regla: sólo estira la duración
        de cada asalto para que un duelo entre leyendas se sienta épico. Se elige aquí y no en
        mitad de la partida porque el manual pide que todos lo sepan desde el principio del
        combate. El <strong>Combate de Masas</strong> no hace falta activarlo: está siempre
        disponible en la pestaña Mesa de cada personaje.
      </Ayuda>
      <div className="lista-seleccion">
        {(
          [
            ['normal', 'Normal', 'Cada asalto dura tres segundos, como siempre.'],
            [
              'dramatico',
              'Combate Dramático',
              'El primer asalto dura tres segundos y a partir de ahí se dobla: 6, 12, 24… ' +
                'y desde el quinto, un minuto.',
            ],
          ] as const
        ).map(([id, texto, ayuda]) => (
          <label key={id} className={valor === id ? 'elegida' : undefined}>
            <input
              type="radio"
              name="sistema-combate"
              checked={valor === id}
              onChange={() => onCambiar(id)}
            />
            <span>
              {texto}
              <small style={{ display: 'block', color: 'var(--texto-debil)' }}>{ayuda}</small>
            </span>
          </label>
        ))}
      </div>
    </>
  );
}

function Manuales({ activos, onCambiar }: { activos: string[]; onCambiar: (v: string[]) => void }) {
  return (
    <>
      <Ayuda>
        Cada manual es un paquete de contenido. Se combinan por orden, y una entrada con el
        mismo nombre sustituye a la anterior: así un suplemento puede además corregir el
        básico. Lo que active cada campaña es cosa suya.
      </Ayuda>
      <div className="lista-seleccion">
        {PAQUETES.map((p) => {
          const activo = activos.includes(p.id);
          const esBasico = p.id === CORE_EXXET.id;
          return (
            <label key={p.id} className={activo ? 'elegida' : undefined}>
              <input
                type="checkbox"
                checked={activo}
                // El básico no se puede quitar: una campaña necesita al menos uno.
                disabled={esBasico}
                onChange={() =>
                  onCambiar(activo ? activos.filter((x) => x !== p.id) : [...activos, p.id])
                }
              />
              <span>
                {p.nombre}
                <small style={{ display: 'block', color: 'var(--texto-debil)' }}>
                  {p.descripcion}
                  {esBasico && ' · siempre activo'}
                </small>
              </span>
              <em>{p.sigla}</em>
            </label>
          );
        })}
      </div>
    </>
  );
}

/** Lo que un jugador necesita saber de la mesa de su máster, sin poder tocarlo. */
function ResumenDeMesa({ campana }: { campana: Campana }) {
  const c = { ...CREACION_POR_DEFECTO, ...(campana.ajustes.creacion ?? {}) };
  const manuales = PAQUETES.filter((p) => campana.paquetes.includes(p.id));
  return (
    <table>
      <tbody>
        <tr>
          <td>Nivel de inicio</td>
          <td className="num">
            {c.nivelInicial} <span style={{ color: 'var(--texto-debil)' }}>({pdPorNivel(c.nivelInicial)} PD)</span>
          </td>
        </tr>
        <tr>
          <td>Puntos de Creación</td>
          <td className="num">{c.puntosCreacion}</td>
        </tr>
        <tr>
          <td>Tope por desventajas</td>
          <td className="num">{c.maximoPorDesventajas}</td>
        </tr>
        <tr>
          <td>Combate</td>
          <td className="num">
            {(campana.sistemaCombate ?? 'normal') === 'dramatico' ? 'Dramático' : 'Normal'}
          </td>
        </tr>
        <tr>
          <td>Manuales</td>
          <td className="num">{manuales.map((m) => m.sigla).join(' · ') || '—'}</td>
        </tr>
      </tbody>
    </table>
  );
}
