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
import { VistaPersonalizado } from './VistaPersonalizado';
import { VistaGaleria } from './VistaGaleria';
import { VistaReglas } from './VistaReglas';
import { Imagen } from './Imagen';
import { nuevoId } from './estado';
import { SelectorTema } from './SelectorTema';
import { aplicarTema, guardarTema, temaGuardado } from './temas';
import { useCampanas, useDatosCalculo, usePersonajes, useReglamento } from './estado';
import { nivelTotalDe } from '../motor/personaje';
import './estilos.css';

type Seccion =
  | 'personajes' | 'ficha' | 'editor' | 'mesa'
  | 'bestiario' | 'galeria' | 'propio' | 'reglas' | 'campanas';

export function App() {
  const [seccion, setSeccion] = useState<Seccion>('personajes');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [tema, setTema] = useState<string>(temaGuardado);
  const [campanaId, setCampanaId] = useState<string | null>(null);
  const [tituloNota, setTituloNota] = useState('');
  const [textoNota, setTextoNota] = useState('');

  const { personajes, cargando, guardar, crear, borrar, recargar } = usePersonajes();
  const { campanas, guardar: guardarCampana, crear: crearCampana, borrar: borrarCampana } = useCampanas();

  const campana = campanas.find((c) => c.id === campanaId) ?? null;
  const { reglamento, cambiar: cambiarReglamento } = useReglamento(campana, (c) => void guardarCampana(c));

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

  const secciones: { id: Seccion; texto: string; requierePersonaje?: boolean }[] = [
    { id: 'personajes', texto: 'Personajes' },
    { id: 'ficha', texto: 'Ficha', requierePersonaje: true },
    { id: 'editor', texto: 'Editar', requierePersonaje: true },
    { id: 'mesa', texto: 'Mesa', requierePersonaje: true },
    { id: 'bestiario', texto: 'Bestiario' },
    { id: 'galeria', texto: 'Galería' },
    { id: 'propio', texto: 'Contenido propio' },
    { id: 'campanas', texto: 'Campañas' },
    { id: 'reglas', texto: 'Reglas' },
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
          <SelectorTema tema={tema} onCambiar={setTema} />
        </nav>
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
                onCambiar={guardar}
              />
            )}
          </>
        )}

        {seccion === 'bestiario' && <VistaBestiario campanaId={campanaId} />}

        {seccion === 'galeria' && <VistaGaleria campanaId={campanaId} />}

        {seccion === 'propio' && (
          campana ? (
            <VistaPersonalizado
              personalizados={propio}
              onCambiar={(p) => void guardarCampana({ ...campana, personalizados: p })}
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

            {campanas.length === 0 ? (
              <p style={{ color: 'var(--texto-debil)', margin: 0 }}>Todavía no hay campañas.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Campaña</th><th className="num">Reglas caseras</th><th></th></tr>
                </thead>
                <tbody>
                  {campanas.map((c) => (
                    <tr key={c.id}>
                      <td className={c.id === campanaId ? 'destacado' : undefined}>{c.nombre}</td>
                      <td className="num">
                        {Object.keys(c.ajustes.formulas ?? {}).length + (c.ajustes.desactivadas?.length ?? 0)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="accion" onClick={() => setCampanaId(c.id)}>Activar</button>{' '}
                        <button
                          className="accion"
                          onClick={() => {
                            void borrarCampana(c.id);
                            if (campanaId === c.id) setCampanaId(null);
                          }}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {campana && (
              <>
                <h2 style={{ marginTop: 22 }}>Diario de «{campana.nombre}»</h2>
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
                      ...campana,
                      notasSesion: [
                        {
                          id: nuevoId(),
                          fecha: new Date().toISOString(),
                          titulo: tituloNota.trim() || `Sesión ${campana.notasSesion.length + 1}`,
                          texto: textoNota.trim(),
                        },
                        ...campana.notasSesion,
                      ],
                    });
                    setTituloNota('');
                    setTextoNota('');
                  }}
                >
                  Guardar sesión
                </button>

                {campana.notasSesion.length > 0 && (
                  <div className="diario" style={{ marginTop: 18 }}>
                    {campana.notasSesion.map((n) => (
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
                              ...campana,
                              notasSesion: campana.notasSesion.filter((x) => x.id !== n.id),
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

            <h2 style={{ marginTop: 22 }}>Manuales</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Cada manual es un paquete de contenido. Se combinan por orden, y una entrada
              con el mismo nombre sustituye a la anterior: así un suplemento puede además
              corregir el básico. Lo que active cada campaña es cosa suya.
            </p>
            {campana ? (
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
                            ...campana,
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
                Elige o crea una campaña para decidir qué manuales usa.
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
