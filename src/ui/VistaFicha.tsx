import { useMemo } from 'react';
import {
  CARACTERISTICAS,
  GRUPOS_SECUNDARIAS,
  RESISTENCIAS,
  SECUNDARIAS,
  calcular,
  type DatosCalculo,
  type Personaje,
} from '../motor/personaje';
import type { Reglamento } from '../motor/reglamento';
import { CARACTERISTICAS_KI } from '../motor/ki';
import { calcularTecnica, resumirCoste } from '../motor/tecnicas';

interface Props {
  personaje: Personaje;
  datos: DatosCalculo;
  reglamento: Reglamento;
}

function Recurso({ etiqueta, valor, maximo, clase }: {
  etiqueta: string;
  valor: number;
  maximo?: number;
  clase?: string;
}) {
  return (
    <div className={`recurso ${clase ?? ''}`}>
      <div className="etiqueta">{etiqueta}</div>
      <div className="cifra">
        {valor}
        {maximo !== undefined && <span style={{ fontSize: '0.7rem', color: 'var(--texto-debil)' }}> / {maximo}</span>}
      </div>
    </div>
  );
}

export function VistaFicha({ personaje, datos, reglamento }: Props) {
  const ficha = useMemo(
    () => calcular(personaje, datos, reglamento),
    [personaje, datos, reglamento],
  );

  const estado = personaje.estado;

  return (
    <div>
      <div className="recursos">
        <Recurso etiqueta="Vida" clase="vida" valor={estado.pvActuales ?? ficha.puntosVida.valor} maximo={ficha.puntosVida.valor} />
        <Recurso etiqueta="Cansancio" valor={estado.cansancioActual ?? ficha.cansancio.valor} maximo={ficha.cansancio.valor} />
        <Recurso etiqueta="Zeón" clase="zeon" valor={estado.zeonActual ?? ficha.zeon.valor} maximo={ficha.zeon.valor} />
        <Recurso etiqueta="ACT" clase="zeon" valor={ficha.act.valor} />
        {ficha.ki.reserva > 0 && (
          <Recurso
            etiqueta="Ki"
            clase="ki"
            valor={estado.kiActual ?? ficha.ki.reserva}
            maximo={ficha.ki.reserva}
          />
        )}
        <Recurso etiqueta="Presencia" valor={ficha.presencia.valor} />
        <Recurso etiqueta="Nivel" valor={ficha.nivel} />
      </div>

      {ficha.ajusteNivel > 0 && (
        <p className="cinta-campana" style={{ marginBottom: 14 }}>
          Ajuste de nivel <strong>+{ficha.ajusteNivel}</strong>{' '}
          {(personaje.legados ?? []).length > 0
            ? ficha.ajusteNivel > 1
              ? 'por la raza y por ser Legado de Sangre'
              : 'por ser Legado de Sangre'
            : 'por la raza'}
          : no da bonos, sólo encarece la experiencia (subes como si fueras de nivel{' '}
          {ficha.nivelParaExperiencia}).
        </p>
      )}

      {ficha.avisos.length > 0 && (
        <div className="avisos">
          {ficha.avisos.map((a, i) => (
            <div key={i} className={`aviso ${a.gravedad}`}>{a.mensaje}</div>
          ))}
        </div>
      )}

      <div className="rejilla">
        <section className="panel">
          <h2>Características</h2>
          <div className="caracteristicas">
            {CARACTERISTICAS.map((c) => {
              const v = ficha.caracteristicas[c];
              return (
                <div className="caracteristica" key={c}>
                  <div className="nombre">{c}</div>
                  <div className="valor">{v.total}</div>
                  <div className="bono">{v.bono >= 0 ? `+${v.bono}` : v.bono}</div>
                  {v.raza !== 0 && (
                    <div className="mod-raza">{v.raza > 0 ? `+${v.raza}` : v.raza} raza</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2>Resistencias</h2>
          <table>
            <tbody>
              {RESISTENCIAS.map((r) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="num destacado">{ficha.resistencias[r].valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Puntos de Desarrollo</h2>
          <table>
            <thead>
              <tr>
                <th>Campo</th>
                <th className="num">Gastado</th>
                <th className="num">Límite</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Combate</td>
                <td className="num">{ficha.pdGastados.combate}</td>
                <td className="num">{Number.isFinite(ficha.limites.combate) ? ficha.limites.combate : '—'}</td>
              </tr>
              <tr>
                <td>Místicas</td>
                <td className="num">{ficha.pdGastados.misticas}</td>
                <td className="num">{Number.isFinite(ficha.limites.misticas) ? ficha.limites.misticas : '—'}</td>
              </tr>
              <tr>
                <td>Psíquicas</td>
                <td className="num">{ficha.pdGastados.psiquicas}</td>
                <td className="num">{Number.isFinite(ficha.limites.psiquicas) ? ficha.limites.psiquicas : '—'}</td>
              </tr>
              <tr>
                <td>Secundarias</td>
                <td className="num">{ficha.pdGastados.secundarias}</td>
                <td className="num">—</td>
              </tr>
              <tr>
                <td className="destacado">Total</td>
                <td className="num destacado">{ficha.pdGastados.total}</td>
                <td className="num destacado">{ficha.pdTotales}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      {(ficha.ki.reserva > 0 || ficha.ki.conocimientoMarcial.total > 0) && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Dominios del Ki</h2>
          <div className="rejilla">
            <div>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Car.</th>
                    <th>Ki</th>
                    <th>Acum.</th>
                    <th>Mitad</th>
                  </tr>
                </thead>
                <tbody>
                  {CARACTERISTICAS_KI.map((c) => (
                    <tr key={c}>
                      <th scope="row">{c}</th>
                      <td>{ficha.ki.puntos[c].total}</td>
                      <td>{ficha.ki.acumulacion[c].total}</td>
                      <td>{ficha.ki.acumulacion[c].mitad}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Total</th>
                    <td>
                      <strong className="destacado">{ficha.ki.reserva}</strong>
                    </td>
                    <td>
                      <strong className="destacado">{ficha.ki.acumulacionTotal}</strong>
                    </td>
                    <td>{ficha.ki.acumulacionReducida}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
                Conocimiento Marcial <strong>{ficha.ki.conocimientoMarcial.total}</strong>
                {ficha.ki.conocimientoMarcial.disponible >= 0
                  ? `, de los que quedan libres ${ficha.ki.conocimientoMarcial.disponible}.`
                  : `, y te faltan ${-ficha.ki.conocimientoMarcial.disponible} para lo que has cogido.`}
                {ficha.ki.unificado && ' Se juega con la Reserva unificada.'}
              </p>
            </div>

            <div>
              {(ficha.ki.deteccion !== null || ficha.ki.ocultacion !== null) && (
                <p style={{ margin: '0 0 8px' }}>
                  {ficha.ki.deteccion !== null && (
                    <>
                      Detección del Ki <strong className="destacado">{ficha.ki.deteccion}</strong>
                      {ficha.ki.ocultacion !== null && ' · '}
                    </>
                  )}
                  {ficha.ki.ocultacion !== null && (
                    <>
                      Ocultación del Ki{' '}
                      <strong className="destacado">{ficha.ki.ocultacion}</strong>
                    </>
                  )}
                </p>
              )}
              {personaje.ki.limites.length > 0 && (
                <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
                  <strong>Límite:</strong> {personaje.ki.limites.join(', ')}
                </p>
              )}
              {personaje.ki.habilidades.length > 0 && (
                <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
                  <strong>Habilidades:</strong> {personaje.ki.habilidades.join(', ')}
                </p>
              )}
              {personaje.ki.artesMarciales.length > 0 && (
                <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
                  <strong>Artes marciales:</strong> {personaje.ki.artesMarciales.join(', ')}
                </p>
              )}
              {personaje.ki.tecnicas.length > 0 && (
                <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
                  <strong>Técnicas:</strong>{' '}
                  {personaje.ki.tecnicas.map((t) => `${t.nombre} (${t.CM} CM)`).join(', ')}
                </p>
              )}
              {(personaje.ki.propias ?? []).length > 0 && (
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>Técnicas propias:</strong>
                  {(personaje.ki.propias ?? []).map((diseno, i) => {
                    const calc = calcularTecnica(diseno, {
                      opciones: datos.efectosTecnica,
                      fichas: datos.tiposEfectoTecnica,
                    });
                    return (
                      <p key={i} style={{ margin: '4px 0' }}>
                        <strong className="destacado">{diseno.nombre || 'Sin nombre'}</strong>{' '}
                        <span style={{ color: 'var(--texto-debil)' }}>
                          (nivel {diseno.nivel}
                          {diseno.arbol ? `, ${diseno.arbol}` : ''})
                        </span>
                        <br />
                        {calc.CM} CM · Ki: {resumirCoste(calc.ki) || '—'}
                        {calc.kiMantenimiento > 0 &&
                          ` · mantenerla cuesta ${calc.kiMantenimiento} por asalto`}
                        <br />
                        <span style={{ color: 'var(--texto-tenue)' }}>
                          {calc.detalles
                            .map((d) => `${d.efecto} (${d.opcion})${d.primario ? ' — primario' : ''}`)
                            .join(', ') || 'Sin Efectos todavía.'}
                        </span>
                        {diseno.descripcion && (
                          <>
                            <br />
                            <em style={{ color: 'var(--texto-tenue)' }}>{diseno.descripcion}</em>
                          </>
                        )}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {(personaje.ventajas.length > 0 ||
        personaje.desventajas.length > 0 ||
        (personaje.legados ?? []).length > 0) && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Ventajas, desventajas y Legados</h2>
          <div className="rejilla">
            {(personaje.legados ?? []).length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--texto-tenue)', marginBottom: 6 }}>
                  Legados de Sangre
                </h3>
                <ul className="lista-simple">
                  {(personaje.legados ?? []).map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            )}
            {personaje.ventajas.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--texto-tenue)', marginBottom: 6 }}>Ventajas</h3>
                <ul className="lista-simple">
                  {personaje.ventajas.map((v) => <li key={v}>{v}</li>)}
                </ul>
              </div>
            )}
            {personaje.desventajas.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--texto-tenue)', marginBottom: 6 }}>Desventajas</h3>
                <ul className="lista-simple">
                  {personaje.desventajas.map((v) => <li key={v}>{v}</li>)}
                </ul>
              </div>
            )}
          </div>

          {ficha.efectos.notas.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.82rem', color: 'var(--oro)', margin: '14px 0 6px' }}>
                Recordatorios para la mesa
              </h3>
              <ul className="lista-simple">
                {ficha.efectos.notas.map((n, i) => (
                  <li key={i}>
                    <strong>{n.origen}:</strong> {n.texto}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Combate</h2>
        <div className="rejilla">
          <div>
            <table>
              <tbody>
                <tr><td>Habilidad de Ataque</td><td className="num destacado">{ficha.combate.HAtaque.valor}</td></tr>
                <tr><td>Habilidad de Parada</td><td className="num destacado">{ficha.combate.HParada.valor}</td></tr>
                <tr><td>Habilidad de Esquiva</td><td className="num destacado">{ficha.combate.HEsquiva.valor}</td></tr>
                <tr><td>Llevar Armadura</td><td className="num">{ficha.combate.llevarArmadura.valor}</td></tr>
                <tr><td>Turno natural</td><td className="num">{ficha.combate.turnoNatural.valor}</td></tr>
                <tr><td>Tamaño</td><td className="num">{ficha.combate.tamano}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ fontSize: '0.82rem', color: 'var(--texto-tenue)', marginBottom: 6 }}>
              Tipo de Armadura
            </h3>
            <table>
              <thead>
                <tr>{Object.keys(ficha.combate.proteccion.TA).map((t) => <th key={t} className="num">{t}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  {Object.values(ficha.combate.proteccion.TA).map((v, i) => (
                    <td key={i} className="num destacado">{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p style={{ color: 'var(--texto-debil)', fontSize: '0.78rem', marginBottom: 0 }}>
              Absorción = 20 + 10 × TA del tipo de daño recibido.
            </p>
          </div>
        </div>

        {ficha.combate.armas.length > 0 && (
          <div className="desplazable" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Arma</th><th className="num">Turno</th><th className="num">Ataque</th>
                  <th className="num">Parada</th><th className="num">Daño</th><th>Críticos</th>
                </tr>
              </thead>
              <tbody>
                {ficha.combate.armas.map((a, i) => (
                  <tr key={i}>
                    <td className="destacado">{a.arma}</td>
                    <td className="num">{a.turno}</td>
                    <td className="num">{a.ataque}</td>
                    <td className="num">{a.parada}</td>
                    <td className="num">{a.dano}</td>
                    <td>{a.criticos.join(' / ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Habilidades secundarias</h2>
        <div className="rejilla">
          {GRUPOS_SECUNDARIAS.map((grupo) => (
            <div key={grupo}>
              <h3 style={{ fontSize: '0.82rem', color: 'var(--texto-tenue)', marginBottom: 6 }}>{grupo}</h3>
              <table>
                <tbody>
                  {SECUNDARIAS.filter((s) => s.grupo === grupo).map((s) => {
                    const v = ficha.secundarias[s.nombre];
                    return (
                      <tr key={s.nombre}>
                        <td>
                          {s.nombre}{' '}
                          <span style={{ color: 'var(--texto-debil)', fontSize: '0.72rem' }}>{s.caracteristica}</span>
                        </td>
                        <td className={`num ${v.valor < 0 ? 'negativo' : ''}`}>
                          {v.valor > 0 ? `+${v.valor}` : v.valor}
                          {v.manual && <span title="Valor puesto a mano" style={{ color: 'var(--oro)' }}> ✎</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
