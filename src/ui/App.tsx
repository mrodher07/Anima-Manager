import { useEffect, useState } from 'react';
import { Catalogo } from '../datos/paquetes';
import {
  cargarDatosCalculo,
  personajeVacio,
  type DatosCalculo,
  type Personaje,
} from '../motor/personaje';
import { REGLAMENTO_OFICIAL, Reglamento } from '../motor/reglamento';
import { VistaFicha } from './VistaFicha';
import { VistaReglas } from './VistaReglas';
import './estilos.css';

type Seccion = 'ficha' | 'reglas' | 'catalogo';

/** Personaje de muestra mientras no haya fichas guardadas. */
function personajeDeMuestra(): Personaje {
  const p = personajeVacio('muestra');
  p.nombre = 'Meirmeister';
  p.raza = 'Jayán';
  p.categoria = 'Paladín Oscuro (RD)';
  p.caracteristicas = { AGI: 10, CON: 8, DES: 10, FUE: 10, INT: 4, PER: 5, POD: 4, VOL: 6 };
  p.pdInvertidos = {
    HAtaque: 150, HParada: 110, LlevarArmadura: 40,
    Acrobacias: 30, Atletismo: 20, Intimidar: 50,
  };
  p.habilidadesNaturales = ['Acrobacias', 'Atletismo', 'Intimidar', 'Advertir', 'Frialdad'];
  return p;
}

export function App() {
  const [seccion, setSeccion] = useState<Seccion>('ficha');
  const [tema, setTema] = useState<'oscuro' | 'claro'>('oscuro');
  const [reglamento, setReglamento] = useState<Reglamento>(REGLAMENTO_OFICIAL);
  const [catalogo] = useState(() => new Catalogo());
  const [personaje] = useState<Personaje>(personajeDeMuestra);
  const [datos, setDatos] = useState<DatosCalculo | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);

  useEffect(() => {
    let vigente = true;
    cargarDatosCalculo(personaje, catalogo)
      .then((d) => { if (vigente) setDatos(d); })
      .catch((e) => { if (vigente) setFallo(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, [personaje, catalogo]);

  const secciones: { id: Seccion; texto: string }[] = [
    { id: 'ficha', texto: 'Ficha' },
    { id: 'reglas', texto: 'Reglas' },
    { id: 'catalogo', texto: 'Catálogo' },
  ];

  return (
    <div className="app">
      <header className="cabecera">
        <div className="marca">
          Anima Manager
          <span>Beyond Fantasy</span>
        </div>
        <nav className="nav">
          {secciones.map((s) => (
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
        {fallo && <div className="aviso error">No se ha podido cargar el catálogo: {fallo}</div>}

        {seccion === 'ficha' &&
          (datos ? (
            <>
              <h1 style={{ marginBottom: 4 }}>{personaje.nombre}</h1>
              <p style={{ color: 'var(--texto-tenue)', marginTop: 0, marginBottom: 18 }}>
                {personaje.raza} · {personaje.categoria} · Nivel {personaje.nivel}
              </p>
              <VistaFicha personaje={personaje} datos={datos} reglamento={reglamento} />
            </>
          ) : (
            <p style={{ color: 'var(--texto-tenue)' }}>Cargando el catálogo…</p>
          ))}

        {seccion === 'reglas' && <VistaReglas reglamento={reglamento} onCambiar={setReglamento} />}

        {seccion === 'catalogo' && (
          <section className="panel">
            <h2>Paquetes de contenido</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem' }}>
              El catálogo se compone de manuales. Al añadir un suplemento, sus entradas se suman
              a las del básico y pueden corregirlas.
            </p>
            <table>
              <thead>
                <tr><th>Manual</th><th>Sigla</th><th>Contenido</th></tr>
              </thead>
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
