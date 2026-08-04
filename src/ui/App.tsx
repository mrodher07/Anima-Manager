import { useEffect, useMemo, useState } from 'react';
import {
  CORE_EXXET,
  Catalogo,
  PAQUETES,
  PERSONALIZADOS_VACIOS,
  paquetePersonalizado,
} from '../datos/paquetes';
import { EditorPersonaje } from './EditorPersonaje';
import { VistaFicha } from './VistaFicha';
import { VistaMesa } from './VistaMesa';
import { VistaPersonajes } from './VistaPersonajes';
import { VistaBestiario } from './VistaBestiario';
import { VistaArcana } from './VistaArcana';
import { VistaPersonalizado } from './VistaPersonalizado';
import { VistaGaleria } from './VistaGaleria';
import { VistaReglas } from './VistaReglas';
import { VistaCopia } from './VistaCopia';
import { VistaCuenta } from './VistaCuenta';
import { PanelMesa } from './PanelMesa';
import { useCuenta } from '../nube/cuenta';
import { Imagen } from './Imagen';
import { nuevoId } from './estado';
import { SelectorTema } from './SelectorTema';
import { aplicarTema, guardarTema, temaGuardado } from './temas';
import { useCampanas, useDatosCalculo, usePersonajes, useReglamento } from './estado';
import { nivelTotalDe } from '../motor/personaje';
import './estilos.css';

type Seccion =
  | 'personajes' | 'ficha' | 'editor' | 'mesa'
  | 'bestiario' | 'arcana' | 'galeria' | 'propio' | 'reglas' | 'campanas' | 'copia' | 'cuenta';

export function App() {
  const [seccion, setSeccion] = useState<Seccion>('personajes');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [tema, setTema] = useState<string>(temaGuardado);
  const [campanaId, setCampanaId] = useState<string | null>(null);
  const [tituloNota, setTituloNota] = useState('');
  const [textoNota, setTextoNota] = useState('');

  const { personajes, cargando, guardar, crear, borrar, recargar } = usePersonajes();
  const {
    campanas,
    guardar: guardarCampana,
    crear: crearCampana,
    borrar: borrarCampana,
    recargar: recargarCampanas,
  } = useCampanas();

  // Cuando la nube trae cambios de otro dispositivo, las listas tienen que releerse: si no,
  // la ficha que acabas de editar en el móvil no aparecería aquí hasta recargar la página.
  const cuenta = useCuenta(
    () => {
      void recargar();
      void recargarCampanas();
    },
    (preferencias) => {
      // El tema elegido en el ordenador aparece también en el móvil.
      if (typeof preferencias.tema === 'string') setTema(preferencias.tema);
    },
  );

  // Las campañas propias y aquellas en las que juego sin ser el máster. Las segundas son de
  // sólo lectura, pero hacen falta igual: llevan las reglas caseras y los manuales activos
  // con los que hay que calcular la ficha.
  const todasLasCampanas = [...campanas, ...cuenta.campanasAjenas];
  const campana = todasLasCampanas.find((c) => c.id === campanaId) ?? null;
  const soyElMaster = campanas.some((c) => c.id === campanaId);
  /**
   * La campaña sólo si puedo escribirla. Todo lo que edita la mesa —reglas, manuales,
   * diario, contenido propio— cuelga de esto, para que un jugador que ha activado la
   * campaña de su máster la vea entera pero no pueda tocarla.
   */
  const campanaEditable = soyElMaster ? campana : null;
  // Sólo se guardan los cambios de reglas si la campaña es mía. La de un máster se lee
  // para calcular con sus reglas, pero un jugador no la edita: intentarlo escribiría en
  // local una campaña que el servidor luego rechazaría.
  const { reglamento, cambiar: cambiarReglamento } = useReglamento(campana, (c) => {
    if (soyElMaster) void guardarCampana(c);
  });

  const paquetes = campana?.paquetes ?? ['core-exxet'];
  const propio = campana?.personalizados ?? PERSONALIZADOS_VACIOS;
  // Se recrea el catálogo cuando cambian los manuales activos o el contenido propio.
  const clavePaquetes = paquetes.join(',') + '|' + JSON.stringify(propio);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogo = useMemo(
    () => new Catalogo(paquetes, [paquetePersonalizado(propio)]),
    [clavePaquetes],
  );

  const personaje = personajes.find((p) => p.id === abiertoId) ?? null;
  const datos = useDatosCalculo(catalogo, personaje);

  useEffect(() => {
    aplicarTema(tema);
    guardarTema(tema);
  }, [tema]);

  const abrir = (id: string) => { setAbiertoId(id); setSeccion('ficha'); };

  /*
   * El orden va de dentro afuera, y en el móvil eso importa: la tira se arrastra, así que
   * lo primero es lo que está al alcance sin mover el dedo.
   *
   *   1. Tu personaje: la lista y sus tres vistas.
   *   2. La partida: la campaña, lo que os ataca, los mapas y las tablas de consulta.
   *   3. Los ajustes: lo que se toca una vez y ya.
   *
   * «Campañas» estaba la novena, detrás de Galería y Contenido propio, cuando es de lo que
   * más se abre; «Lo sobrenatural» iba la sexta siendo una tabla de consulta.
   */
  const secciones: { id: Seccion; texto: string; requierePersonaje?: boolean }[] = [
    { id: 'personajes', texto: 'Personajes' },
    { id: 'ficha', texto: 'Ficha', requierePersonaje: true },
    { id: 'editor', texto: 'Editar', requierePersonaje: true },
    { id: 'mesa', texto: 'Mesa', requierePersonaje: true },
    { id: 'campanas', texto: 'Campañas' },
    { id: 'bestiario', texto: 'Bestiario' },
    { id: 'galeria', texto: 'Galería' },
    { id: 'arcana', texto: 'Lo sobrenatural' },
    { id: 'propio', texto: 'Contenido propio' },
    { id: 'reglas', texto: 'Reglas' },
    { id: 'copia', texto: 'Copia de seguridad' },
    { id: 'cuenta', texto: 'Cuenta' },
  ];

  const necesitaFicha = seccion === 'ficha' || seccion === 'editor' || seccion === 'mesa';

  return (
    <div className="app">
      <header className="cabecera">
        <button className="marca" onClick={() => setSeccion('personajes')} title="Volver a la lista">
          Anima Manager
          <span>Beyond Fantasy</span>
        </button>
        <nav className="nav">
          {secciones
            .filter((s) => !s.requierePersonaje || personaje)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                aria-current={seccion === s.id ? 'page' : undefined}
              >
                {s.texto}
              </button>
            ))}
        </nav>

        {/*
          El tema y el estado de la nube van fuera de la tira de secciones. En el móvil esa
          tira se arrastra de lado, y meter aquí cosas que no son secciones obligaría a
          buscarlas arrastrando: se quedan arriba, siempre en el mismo sitio.
        */}
        <div className="acciones-cabecera">
          {cuenta.estado === 'dentro' && (
            <button
              className="estado-nube"
              onClick={() => setSeccion('cuenta')}
              title={cuenta.usuario?.correo}
            >
              {cuenta.sincronizando
                ? 'Sincronizando…'
                : cuenta.ultima && !cuenta.ultima.ok
                  ? 'Sin sincronizar'
                  : 'Al día'}
            </button>
          )}
          <SelectorTema
            tema={tema}
            onCambiar={(t) => {
              setTema(t);
              // Se sube aquí y no en el efecto del tema: así el tema que **llega** de la
              // nube no rebota inmediatamente de vuelta al servidor.
              void cuenta.guardarPreferencia('tema', t);
            }}
          />
        </div>
      </header>

      <main className="contenido">
        {campana && (
          <p className="cinta-campana">
            Campaña activa: <strong>{campana.nombre}</strong>
            {reglamento.cambios().length > 0 &&
              ` · ${reglamento.cambios().length} reglas caseras`}
          </p>
        )}

        {seccion === 'personajes' && (
          <VistaPersonajes
            personajes={personajes}
            cargando={cargando}
            nuevoId={nuevoId}
            onAbrir={abrir}
            onCrear={() => abrir(crear().id)}
            onBorrar={(id) => {
              void borrar(id);
              if (abiertoId === id) { setAbiertoId(null); setSeccion('personajes'); }
            }}
            onRecargar={() => void recargar()}
          />
        )}

        {necesitaFicha && personaje && !datos && (
          <p style={{ color: 'var(--texto-tenue)' }}>Cargando el catálogo…</p>
        )}

        {necesitaFicha && personaje && datos && (
          <>
            <div className="cabecera-ficha">
              {personaje.retratoId && (
                <Imagen
                  id={personaje.retratoId}
                  alt={`Retrato de ${personaje.nombre}`}
                  className="retrato-mini"
                />
              )}
              <div>
                <h1 style={{ marginBottom: 2 }}>{personaje.nombre || 'Sin nombre'}</h1>
                <p style={{ color: 'var(--texto-tenue)', margin: 0 }}>
                  {personaje.raza} ·{' '}
                  {personaje.categorias
                    .filter((c) => c.nivel > 0)
                    .map((c) => `${c.categoria} ${c.nivel}`)
                    .join(' / ')}{' '}
                  · Nivel {nivelTotalDe(personaje)}
                </p>
              </div>
            </div>
            {seccion === 'ficha' && (
              <VistaFicha personaje={personaje} datos={datos} reglamento={reglamento} />
            )}
            {seccion === 'editor' && (
              <EditorPersonaje
                personaje={personaje}
                datos={datos}
                catalogo={catalogo}
                reglamento={reglamento}
                onCambiar={guardar}
              />
            )}
            {seccion === 'mesa' && (
              <VistaMesa
                personaje={personaje}
                datos={datos}
                catalogo={catalogo}
                reglamento={reglamento}
                campanaId={campanaId}
                sistemaCombate={campana?.sistemaCombate ?? 'normal'}
                onCambiar={guardar}
              />
            )}
          </>
        )}

        {seccion === 'bestiario' && (
          <VistaBestiario campanaId={campanaId} catalogo={catalogo} />
        )}

        {seccion === 'arcana' && <VistaArcana catalogo={catalogo} />}

        {seccion === 'copia' && (
          <VistaCopia
            onRecargar={() => {
              void recargar();
              void recargarCampanas();
              // Tras restaurar, la campaña abierta puede haber dejado de existir.
              setAbiertoId(null);
              setCampanaId(null);
            }}
          />
        )}

        {seccion === 'cuenta' && (
          <VistaCuenta
            cuenta={cuenta}
            onRecargar={() => {
              void recargar();
              void recargarCampanas();
            }}
          />
        )}

        {seccion === 'galeria' && <VistaGaleria campanaId={campanaId} />}

        {seccion === 'propio' && (
          campanaEditable ? (
            <VistaPersonalizado
              personalizados={propio}
              onCambiar={(p) => void guardarCampana({ ...campanaEditable, personalizados: p })}
            />
          ) : (
            <div className="vacio panel">
              <h2>Hace falta una campaña</h2>
              <p>
                El contenido propio se guarda dentro de una campaña, para que viaje con ella
                al exportarla. Crea una en la pestaña Campañas.
              </p>
            </div>
          )
        )}

        {seccion === 'reglas' && (
          <>
            {!campana && (
              <div className="aviso aviso" style={{ marginBottom: 16 }}>
                No hay campaña activa, así que estos cambios no se guardan. Crea una campaña
                en la pestaña Campañas para conservar las reglas de tu mesa.
              </div>
            )}
            <VistaReglas reglamento={reglamento} onCambiar={cambiarReglamento} />
          </>
        )}

        {seccion === 'campanas' && (
          <section className="panel">
            <h2>Campañas</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
              Una campaña guarda las reglas caseras de tu mesa y qué manuales están activos.
            </p>
            <div className="acciones-regla" style={{ marginTop: 0, marginBottom: 14 }}>
              <button
                className="accion primaria"
                onClick={async () => {
                  const nombre = window.prompt('Nombre de la campaña');
                  if (nombre) setCampanaId((await crearCampana(nombre)).id);
                }}
              >
                Nueva campaña
              </button>
              {campana && (
                <button className="accion" onClick={() => setCampanaId(null)}>
                  Salir de la campaña
                </button>
              )}
            </div>

            {todasLasCampanas.length === 0 ? (
              <p style={{ color: 'var(--texto-debil)', margin: 0 }}>Todavía no hay campañas.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Campaña</th><th className="num">Reglas caseras</th><th></th></tr>
                </thead>
                <tbody>
                  {todasLasCampanas.map((c) => {
                    // Las campañas donde juego sin ser el máster se pueden activar —hacen
                    // falta para calcular la ficha con sus reglas— pero no borrar: no son
                    // mías. Salir de ellas se hace desde la pestaña Cuenta.
                    const mia = campanas.some((p) => p.id === c.id);
                    return (
                      <tr key={c.id}>
                        <td className={c.id === campanaId ? 'destacado' : undefined}>
                          {c.nombre}
                          {!mia && (
                            <small style={{ display: 'block', color: 'var(--texto-debil)' }}>
                              juegas en ella · sólo lectura
                            </small>
                          )}
                        </td>
                        <td className="num">
                          {Object.keys(c.ajustes.formulas ?? {}).length + (c.ajustes.desactivadas?.length ?? 0)}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="accion" onClick={() => setCampanaId(c.id)}>Activar</button>{' '}
                          {mia && (
                            <button
                              className="accion"
                              onClick={() => {
                                void borrarCampana(c.id);
                                if (campanaId === c.id) setCampanaId(null);
                              }}
                            >
                              Borrar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {campana && cuenta.estado === 'dentro' && (
              <PanelMesa campanaId={campana.id} soyElMaster={soyElMaster} />
            )}

            {campanaEditable && (
              <>
                <h2 style={{ marginTop: 22 }}>Diario de «{campanaEditable.nombre}»</h2>
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
                    void guardarCampana({
                      ...campanaEditable,
                      notasSesion: [
                        {
                          id: nuevoId(),
                          fecha: new Date().toISOString(),
                          titulo: tituloNota.trim() || `Sesión ${campanaEditable.notasSesion.length + 1}`,
                          texto: textoNota.trim(),
                        },
                        ...campanaEditable.notasSesion,
                      ],
                    });
                    setTituloNota('');
                    setTextoNota('');
                  }}
                >
                  Guardar sesión
                </button>

                {campanaEditable.notasSesion.length > 0 && (
                  <div className="diario" style={{ marginTop: 18 }}>
                    {campanaEditable.notasSesion.map((n) => (
                      <article key={n.id}>
                        <h3>{n.titulo}</h3>
                        <time>{new Date(n.fecha).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}</time>
                        <p>{n.texto}</p>
                        <button
                          className="accion"
                          style={{ marginTop: 6 }}
                          onClick={() =>
                            void guardarCampana({
                              ...campanaEditable,
                              notasSesion: campanaEditable.notasSesion.filter((x) => x.id !== n.id),
                            })
                          }
                        >
                          Borrar
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            <h2 style={{ marginTop: 22 }}>Sistema de combate</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              El <strong>Combate Dramático</strong> no cambia ninguna regla: sólo estira la
              duración de cada asalto para que un duelo entre leyendas se sienta épico. Se
              elige aquí y no en mitad de la partida porque el manual pide que todos lo sepan
              desde el principio del combate. El <strong>Combate de Masas</strong> no hace
              falta activarlo: está siempre disponible en la pestaña Mesa.
            </p>
            {campanaEditable ? (
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
                ).map(([id, texto, ayuda]) => {
                  const elegido = (campanaEditable.sistemaCombate ?? 'normal') === id;
                  return (
                    <label key={id} className={elegido ? 'elegida' : undefined}>
                      <input
                        type="radio"
                        name="sistema-combate"
                        checked={elegido}
                        onChange={() =>
                          void guardarCampana({ ...campanaEditable, sistemaCombate: id })
                        }
                      />
                      <span>
                        {texto}
                        <small style={{ display: 'block', color: 'var(--texto-debil)' }}>
                          {ayuda}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--texto-debil)' }}>
                {campana
                  ? `Esto lo decide el máster de «${campana.nombre}». Ahora mismo la mesa usa ${
                      (campana.sistemaCombate ?? 'normal') === 'dramatico' ? 'Combate Dramático' : 'el sistema normal'
                    }.`
                  : 'Elige o crea una campaña para decidir su sistema de combate.'}
              </p>
            )}

            <h2 style={{ marginTop: 22 }}>Manuales</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Cada manual es un paquete de contenido. Se combinan por orden, y una entrada
              con el mismo nombre sustituye a la anterior: así un suplemento puede además
              corregir el básico. Lo que active cada campaña es cosa suya.
            </p>
            {campanaEditable ? (
              <div className="lista-seleccion">
                {PAQUETES.map((p) => {
                  const activo = paquetes.includes(p.id);
                  const esBasico = p.id === CORE_EXXET.id;
                  return (
                    <label key={p.id} className={activo ? 'elegida' : undefined}>
                      <input
                        type="checkbox"
                        checked={activo}
                        // El básico no se puede quitar: una campaña necesita al menos uno.
                        disabled={esBasico}
                        onChange={() =>
                          void guardarCampana({
                            ...campanaEditable,
                            paquetes: activo
                              ? paquetes.filter((x) => x !== p.id)
                              : [...paquetes, p.id],
                          })
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
            ) : (
              <p style={{ color: 'var(--texto-debil)' }}>
                {campana
                  ? `Los manuales los decide el máster de «${campana.nombre}».`
                  : 'Elige o crea una campaña para decidir qué manuales usa.'}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="pie">
        Anima Manager · Herramienta no oficial para Anima Beyond Fantasy
      </footer>
    </div>
  );
}
