import { useEffect, useMemo, useState } from 'react';
import { Catalogo } from '../datos/paquetes';
import { EditorPersonaje } from './EditorPersonaje';
import { VistaFicha } from './VistaFicha';
import { VistaMesa } from './VistaMesa';
import { VistaPersonajes } from './VistaPersonajes';
import { VistaReglas } from './VistaReglas';
import { useCampanas, useDatosCalculo, usePersonajes, useReglamento } from './estado';
import './estilos.css';

type Seccion = 'personajes' | 'ficha' | 'editor' | 'mesa' | 'reglas' | 'campanas';

export function App() {
  const [seccion, setSeccion] = useState<Seccion>('personajes');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [tema, setTema] = useState<'oscuro' | 'claro'>('oscuro');
  const [campanaId, setCampanaId] = useState<string | null>(null);

  const { personajes, cargando, guardar, crear, borrar, recargar } = usePersonajes();
  const { campanas, guardar: guardarCampana, crear: crearCampana, borrar: borrarCampana } = useCampanas();

  const campana = campanas.find((c) => c.id === campanaId) ?? null;
  const { reglamento, cambiar: cambiarReglamento } = useReglamento(campana, (c) => void guardarCampana(c));

  const paquetes = campana?.paquetes ?? ['core-exxet'];
  const clavePaquetes = paquetes.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogo = useMemo(() => new Catalogo(paquetes), [clavePaquetes]);

  const personaje = personajes.find((p) => p.id === abiertoId) ?? null;
  const datos = useDatosCalculo(catalogo, personaje);

  useEffect(() => { document.documentElement.dataset.tema = tema; }, [tema]);

  const abrir = (id: string) => { setAbiertoId(id); setSeccion('ficha'); };

  const secciones: { id: Seccion; texto: string; requierePersonaje?: boolean }[] = [
    { id: 'personajes', texto: 'Personajes' },
    { id: 'ficha', texto: 'Ficha', requierePersonaje: true },
    { id: 'editor', texto: 'Editar', requierePersonaje: true },
    { id: 'mesa', texto: 'Mesa', requierePersonaje: true },
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
          <button
            onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')}
            title="Cambiar entre tema claro y oscuro"
            aria-label="Cambiar tema"
          >
            {tema === 'oscuro' ? '☾' : '☀'}
          </button>
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
            <h1 style={{ marginBottom: 2 }}>{personaje.nombre || 'Sin nombre'}</h1>
            <p style={{ color: 'var(--texto-tenue)', marginTop: 0, marginBottom: 18 }}>
              {personaje.raza} · {personaje.categoria} · Nivel {personaje.nivel}
            </p>
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
                reglamento={reglamento}
                onCambiar={guardar}
              />
            )}
          </>
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

            <h2 style={{ marginTop: 22 }}>Manuales activos</h2>
            <table>
              <thead><tr><th>Manual</th><th>Sigla</th><th>Contenido</th></tr></thead>
              <tbody>
                {catalogo.paquetesActivos.map((p) => (
                  <tr key={p.id}>
                    <td className="destacado">{p.nombre}</td>
                    <td>{p.sigla}</td>
                    <td style={{ color: 'var(--texto-tenue)' }}>{p.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      <footer className="pie">
        Anima Manager · Herramienta no oficial para Anima Beyond Fantasy
      </footer>
    </div>
  );
}
