import { useEffect, useMemo, useState } from 'react';
import { Catalogo, PERSONALIZADOS_VACIOS, paquetePersonalizado } from '../datos/paquetes';
import { VistaPersonajes } from './VistaPersonajes';
import { VistaBestiario } from './VistaBestiario';
import { VistaArcana } from './VistaArcana';
import { VistaGaleria } from './VistaGaleria';
import { VistaCampanas } from './VistaCampanas';
import { VistaPersonaje } from './VistaPersonaje';
import { VistaAjustes } from './VistaAjustes';
import { useCuenta } from '../nube/cuenta';
import { nuevoId } from './estado';
import { SelectorTema } from './SelectorTema';
import { aplicarTema, guardarTema, temaGuardado } from './temas';
import { useCampanas, useDatosCalculo, usePersonajes, useReglamento } from './estado';
import './estilos.css';

/**
 * Las seis secciones de la aplicación. **No cambian nunca**, ni según haya ficha abierta
 * ni según haya campaña activa: una barra que aparece y desaparece obliga a mirarla cada
 * vez en lugar de aprendérsela.
 *
 * Lo que antes eran doce pestañas ha bajado a seis porque tres de ellas —Ficha, Editar y
 * Mesa— no eran secciones sino vistas del personaje abierto, y otras cuatro colgaban de
 * algo: Reglas y Contenido propio son de una campaña, y Cuenta y Copia de seguridad van
 * las dos de dónde están tus datos.
 */
type Seccion = 'personajes' | 'campanas' | 'bestiario' | 'galeria' | 'arcana' | 'ajustes';

export function App() {
  const [seccion, setSeccion] = useState<Seccion>('personajes');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [tema, setTema] = useState<string>(temaGuardado);
  const [campanaId, setCampanaId] = useState<string | null>(null);

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

  // Abrir un personaje ya no cambia de sección: el personaje **es** la pantalla, y al
  // cerrarlo se vuelve a la lista de donde salió.
  const abrir = (id: string) => setAbiertoId(id);

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
  const secciones: { id: Seccion; texto: string }[] = [
    { id: 'personajes', texto: 'Personajes' },
    { id: 'campanas', texto: 'Campañas' },
    { id: 'bestiario', texto: 'Bestiario' },
    { id: 'galeria', texto: 'Galería' },
    { id: 'arcana', texto: 'Lo sobrenatural' },
    { id: 'ajustes', texto: 'Ajustes' },
  ];

  return (
    <div className="app">
      <header className="cabecera">
        <button className="marca" onClick={() => setSeccion('personajes')} title="Volver a la lista">
          Anima Manager
          <span>Beyond Fantasy</span>
        </button>
        <nav className="nav">
          {secciones.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSeccion(s.id); setAbiertoId(null); }}
              aria-current={seccion === s.id && !personaje ? 'page' : undefined}
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
              onClick={() => { setSeccion('ajustes'); setAbiertoId(null); }}
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

        {/*
          Un personaje abierto manda sobre la sección: estás dentro de él hasta que salgas.
          Antes se elegía «Ficha» en la barra de arriba y la barra cambiaba de contenido
          según hubiera ficha o no; ahora la barra no se mueve y esto es una pantalla más.
        */}
        {personaje ? (
          <VistaPersonaje
            personaje={personaje}
            datos={datos}
            catalogo={catalogo}
            reglamento={reglamento}
            campanaId={campanaId}
            sistemaCombate={campana?.sistemaCombate ?? 'normal'}
            onCambiar={guardar}
            onCerrar={() => { setAbiertoId(null); setSeccion('personajes'); }}
          />
        ) : (
          <>
            {seccion === 'personajes' && (
              <VistaPersonajes
                personajes={personajes}
                catalogo={catalogo}
                cargando={cargando}
                nuevoId={nuevoId}
                onAbrir={abrir}
                // La ficha nace dentro de la campaña activa y con el nivel que la mesa ha
                // acordado, para no tener que decírselo a cada jugador de viva voz.
                onCrear={() => abrir(crear(campanaId, reglamento.creacion().nivelInicial).id)}
                onBorrar={(id) => {
                  void borrar(id);
                  if (abiertoId === id) setAbiertoId(null);
                }}
                onRecargar={() => void recargar()}
              />
            )}

            {seccion === 'campanas' && (
              <VistaCampanas
                campanas={campanas}
                ajenas={cuenta.campanasAjenas}
                campanaId={campanaId}
                cuenta={cuenta}
                onActivar={setCampanaId}
                onGuardar={(c) => void guardarCampana(c)}
                onCrear={crearCampana}
                onBorrar={(id) => void borrarCampana(id)}
                reglamento={reglamento}
                onCambiarReglamento={cambiarReglamento}
              />
            )}

            {seccion === 'bestiario' && (
              <VistaBestiario campanaId={campanaId} catalogo={catalogo} />
            )}

            {seccion === 'galeria' && <VistaGaleria campanaId={campanaId} />}

            {seccion === 'arcana' && <VistaArcana catalogo={catalogo} />}

            {seccion === 'ajustes' && (
              <VistaAjustes
                cuenta={cuenta}
                onRecargar={() => {
                  void recargar();
                  void recargarCampanas();
                  // Tras restaurar, lo que estuviera abierto puede haber dejado de existir.
                  setAbiertoId(null);
                  setCampanaId(null);
                }}
              />
            )}
          </>
        )}

      </main>

      <footer className="pie">
        Anima Manager · Herramienta no oficial para Anima Beyond Fantasy
      </footer>
    </div>
  );
}
