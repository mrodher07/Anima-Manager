import { useState } from 'react';
import {
  BONOS_POR_NIVEL,
  SHEELE_VACIA,
  TIPO_POR_TIRADA,
  calcularSheele,
  cederACT,
  potenciacionMistica,
  type EleccionesSheele,
  type SenorDeLaSheele,
  type TipoSheele,
} from '../motor/sheele';
import type { EntradaTabla } from '../datos/tipos';
import { Seccion } from './Seccion';

const etiqueta = {
  fontSize: '0.68rem',
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  color: 'var(--texto-debil)',
} as const;

function Cuenta({ titulo, valor, sufijo }: { titulo: string; valor: string | number; sufijo?: string }) {
  return (
    <div className="recurso">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {sufijo && <span className="sufijo">{sufijo}</span>}
    </div>
  );
}

interface Props {
  elecciones: EleccionesSheele;
  senor: SenorDeLaSheele;
  tipos: TipoSheele[];
  /** Las secundarias del señor, para avisar si la Sheele le pasa en conocimiento. */
  habilidadesDelSenor?: Record<string, number>;
  /** Las 95 mejoras del catálogo. */
  mejoras: EntradaTabla[];
  actDelSenor: number;
  onCambiar: (e: EleccionesSheele) => void;
}

export function EditorSheele({
  elecciones,
  senor,
  tipos,
  habilidadesDelSenor = {},
  mejoras,
  actDelSenor,
  onCambiar,
}: Props) {
  const [zeonPotenciacion, setZeonPotenciacion] = useState(40);
  const [actCedido, setActCedido] = useState(0);

  const e = elecciones ?? SHEELE_VACIA;
  const tipo = tipos.find((t) => t.tipo === e.tipo);
  const ficha = calcularSheele(e, tipo, senor, habilidadesDelSenor);
  const pot = potenciacionMistica(zeonPotenciacion, senor.controlar, e.formaDeAlma);
  const act = cederACT(actDelSenor, actCedido);

  const set = (cambios: Partial<EleccionesSheele>) => onCambiar({ ...e, ...cambios });

  const subir = (c: string, delta: number) =>
    set({
      subidasCaracteristica: {
        ...e.subidasCaracteristica,
        [c]: Math.max((e.subidasCaracteristica[c] ?? 0) + delta, 0),
      },
    });

  const bonificar = (h: string, delta: number) =>
    set({
      bonosHabilidad: {
        ...e.bonosHabilidad,
        [h]: Math.max((e.bonosHabilidad[h] ?? 0) + delta, 0),
      },
    });

  // Las mejoras que sirven para cualquier Sheele, más las de su propio elemento.
  const GENERALES = ['ESOTÉRICAS', 'FORMA DE ALMA', 'MAGIA', 'POTENCIACIÓN'];
  const suGrupo = (e.tipo || '').toUpperCase();
  const disponibles = mejoras.filter((m) => {
    const g = String(m.grupo ?? '').toUpperCase();
    return GENERALES.includes(g) || g === suGrupo;
  });

  const marcarMejora = (nombre: string) => {
    const actuales = e.mejoras ?? [];
    set({
      mejoras: actuales.includes(nombre)
        ? actuales.filter((x) => x !== nombre)
        : [...actuales, nombre],
    });
  };

  return (
    <>
      <Seccion
        titulo="Sheele · Espíritu del Alma"
        resumen={e.tipo || 'sin Sheele'}
        abierta={Boolean(e.tipo)}
        ayuda={
          <>
            Una Sheele <strong>no se calcula como una criatura normal</strong>: no tiene PD ni
            desarrolla habilidades, y casi todos sus valores salen de su señor. Sus PV son el
            doble de tu presencia, su turno el tuyo desarmado, y comparte tus resistencias.
          </>
        }
      >

        <div className="rejilla">
          <div className="campo">
            <label htmlFor="sheele-tipo">Tipo</label>
            <select id="sheele-tipo" value={e.tipo} onChange={(ev) => set({ tipo: ev.target.value })}>
              <option value="">Sin Sheele</option>
              {tipos.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.tipo} — {t.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!e.tipo ? (
          <div className="desplazable">
            <table>
              <thead>
                <tr>
                  <th>Tirada</th>
                  <th>Sheele</th>
                </tr>
              </thead>
              <tbody>
                {TIPO_POR_TIRADA.map((f) => (
                  <tr key={f.tipo}>
                    <td className="num">
                      {f.desde}-{f.hasta}
                    </td>
                    <td>{f.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="recursos tira">
              <Cuenta titulo="Puntos de Vida" valor={ficha.puntosVida} sufijo="doble de tu presencia" />
              <Cuenta titulo="Turno" valor={ficha.turno} sufijo="el tuyo desarmado" />
              <Cuenta
                titulo="Proyección Mágica"
                valor={ficha.proyeccionMagica}
                sufijo="doble de tu presencia base, sin DES"
              />
              <Cuenta
                titulo="Bonos de +10"
                valor={`${ficha.bonosRepartidos} / ${ficha.bonosDisponibles}`}
                sufijo={`${BONOS_POR_NIVEL} por nivel tuyo`}
              />
            </div>

            <label style={etiqueta}>Resistencias · las mismas que las tuyas</label>
            <p style={{ marginTop: 2 }}>
              {Object.entries(ficha.resistencias)
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ')}
            </p>

            {ficha.avisos.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {ficha.avisos.map((a) => (
                  <li key={a} className="aviso">
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Seccion>

      {e.tipo && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Características</h3>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Las de su elemento. Cada vez que <em>tú</em> subes de nivel puedes sumarle +1 a
              una: una por nivel, no una cada dos.
            </p>
            <div className="desplazable">
              <table>
                <tbody>
                  {Object.entries(ficha.caracteristicas).map(([c, v]) => (
                    <tr key={c}>
                      <td>{c}</td>
                      <td className="num">
                        <strong>{v}</strong>
                      </td>
                      <td className="num">
                        <small style={{ color: 'var(--texto-debil)' }}>
                          {e.subidasCaracteristica[c] ? `+${e.subidasCaracteristica[c]}` : ''}
                        </small>
                      </td>
                      <td>
                        <button className="accion" onClick={() => subir(c, 1)}>
                          +1
                        </button>{' '}
                        <button className="accion" onClick={() => subir(c, -1)}>
                          −1
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Habilidades secundarias</h3>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Nunca suman el bono de característica, y ninguna basada en el conocimiento puede
              pasar de lo que tú sepas en esa misma habilidad.
            </p>
            <div className="desplazable">
              <table>
                <tbody>
                  {Object.entries(ficha.habilidades).map(([h, v]) => (
                    <tr key={h}>
                      <td>{h}</td>
                      <td className="num">
                        <strong>{v}</strong>
                      </td>
                      <td className="num">
                        <small style={{ color: 'var(--texto-debil)' }}>
                          {e.bonosHabilidad[h] ? `${e.bonosHabilidad[h]} × +10` : ''}
                        </small>
                      </td>
                      <td>
                        <button className="accion" onClick={() => bonificar(h, 1)}>
                          +10
                        </button>{' '}
                        <button className="accion" onClick={() => bonificar(h, -1)}>
                          −10
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Mejoras</h3>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Las de Esotéricas, Forma de Alma, Magia y Potenciación valen para cualquier
              Sheele; las demás sólo para las de su elemento. {disponibles.length} disponibles
              para una de {e.tipo}.
            </p>
            <div style={{ display: 'grid', gap: 2 }}>
              {disponibles.map((m) => {
                const nombre = String(m.mejora ?? '');
                const elegida = (e.mejoras ?? []).includes(nombre);
                return (
                  <label className="opcion" key={`${m.grupo}-${nombre}`}>
                    <input type="checkbox" checked={elegida} onChange={() => marcarMejora(nombre)} />
                    <span>
                      {nombre}
                      <small style={{ display: 'block', color: 'var(--texto-debil)' }}>
                        {String(m.grupo ?? '')}
                        {m.zeon && m.zeon !== '-' ? ` · Zeon ${m.zeon}` : ''}
                        {m.dano && m.dano !== '-' ? ` · Daño ${m.dano}` : ''}
                        {m.efecto ? ` · ${m.efecto}` : ''}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>En la mesa</h3>
            <label className="opcion" style={{ marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={Boolean(e.formaDeAlma)}
                onChange={() => set({ formaDeAlma: !e.formaDeAlma })}
              />
              <span>
                Está en Forma de Alma{' '}
                <span style={{ color: 'var(--texto-debil)' }}>
                  (la Potenciación Mística le rinde la mitad)
                </span>
              </span>
            </label>

            <div className="rejilla">
              <div className="campo">
                <label htmlFor="sheele-zeon">Zeon en Potenciación Mística</label>
                <input
                  id="sheele-zeon"
                  type="number"
                  min={0}
                  value={zeonPotenciacion}
                  onChange={(ev) => setZeonPotenciacion(Number(ev.target.value) || 0)}
                />
              </div>
              <div className="campo">
                <label htmlFor="sheele-act">ACT que le cedes</label>
                <input
                  id="sheele-act"
                  type="number"
                  min={0}
                  value={actCedido}
                  onChange={(ev) => setActCedido(Number(ev.target.value) || 0)}
                />
              </div>
            </div>

            <div className="recursos tira">
              <Cuenta
                titulo="Bono a su acción"
                valor={`+${pot.bono}`}
                sufijo={`tope ${pot.tope} por Controlar ${senor.controlar}`}
              />
              <Cuenta titulo="Tu ACT" valor={act.senor} sufijo={`de ${actDelSenor}`} />
              <Cuenta titulo="ACT de la Sheele" valor={act.sheele} sufijo="acumula por su cuenta" />
            </div>
            {pot.avisos.map((a) => (
              <p key={a} style={{ color: 'var(--texto-debil)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                {a}
              </p>
            ))}
            <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
              Es la Sheele quien lanza el conjuro, así que usa su propia Proyección Mágica y
              sólo puede lanzar lo que ella conozca, aunque tú sepas más.
            </p>
          </section>
        </>
      )}
    </>
  );
}
