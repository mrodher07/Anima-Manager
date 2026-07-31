import { useMemo } from 'react';
import type { Catalogo } from '../datos/paquetes';
import { useColeccion } from './estado';
import type { DatosCalculo, FichaCalculada, Personaje } from '../motor/personaje';
import {
  CARACTERISTICAS_KI,
  dependientesDe,
  type CaracteristicaKi,
  type EleccionesKi,
  type HabilidadKi,
} from '../motor/ki';
import { Selector } from './Selector';

interface Props {
  personaje: Personaje;
  ficha: FichaCalculada;
  datos: DatosCalculo;
  catalogo: Catalogo;
  onCambiar: (p: Personaje) => void;
}

/** Cuánto sangra un nivel del árbol al dibujarlo. */
const SANGRIA = 18;

/** Profundidad de una habilidad: cuántos requisitos hay que subir hasta la raíz. */
function profundidad(h: HabilidadKi, porNombre: Map<string, HabilidadKi>): number {
  let n = 0;
  let actual = h;
  // Cortamos a la décima por si alguien se monta un ciclo con contenido propio.
  while (actual.requisito && n < 10) {
    const padre = porNombre.get(actual.requisito);
    if (!padre) break;
    actual = padre;
    n++;
  }
  return n;
}

/** Ordena el árbol para que cada habilidad salga justo debajo de su requisito. */
function ordenarArbol(habilidades: HabilidadKi[]): HabilidadKi[] {
  const hijos = new Map<string, HabilidadKi[]>();
  const raices: HabilidadKi[] = [];
  for (const h of habilidades) {
    if (!h.requisito) raices.push(h);
    else hijos.set(h.requisito, [...(hijos.get(h.requisito) ?? []), h]);
  }
  const salida: HabilidadKi[] = [];
  const visitar = (h: HabilidadKi) => {
    salida.push(h);
    for (const c of hijos.get(h.habilidad) ?? []) visitar(c);
  };
  for (const r of raices) visitar(r);
  // Lo que quede suelto (contenido propio con un requisito inventado) va al final.
  for (const h of habilidades) if (!salida.includes(h)) salida.push(h);
  return salida;
}

export function EditorKi({ personaje, ficha, datos, catalogo, onCambiar }: Props) {
  const habilidadesKi = useColeccion(catalogo, 'habilidadesKi');
  const artesMarciales = useColeccion(catalogo, 'artesMarciales');
  const compendio = useColeccion(catalogo, 'tecnicasCompendio');
  const limites = datos.tablas.limitesKi ?? [];
  const ki = ficha.ki;
  const elecciones: EleccionesKi = personaje.ki;

  const porNombre = useMemo(
    () => new Map(habilidadesKi.map((h) => [h.habilidad, h as HabilidadKi])),
    [habilidadesKi],
  );
  const ordenadas = useMemo(
    () => ordenarArbol(habilidadesKi as unknown as HabilidadKi[]),
    [habilidadesKi],
  );

  const set = (cambios: Partial<Personaje>) => onCambiar({ ...personaje, ...cambios });
  const setKi = (cambios: Partial<EleccionesKi>) => set({ ki: { ...elecciones, ...cambios } });
  const setPD = (clave: string, pd: number) =>
    set({ pdInvertidos: { ...personaje.pdInvertidos, [clave]: Math.max(0, pd || 0) } });

  const alternarHabilidad = (nombre: string) => {
    const tiene = elecciones.habilidades.includes(nombre);
    if (!tiene) {
      setKi({ habilidades: [...elecciones.habilidades, nombre] });
      return;
    }
    // Al quitar una habilidad se quitan también las que colgaban de ella: dejarlas
    // sueltas sólo genera avisos que el jugador no ha pedido.
    const aQuitar = new Set([nombre]);
    let creciendo = true;
    while (creciendo) {
      creciendo = false;
      for (const n of [...aQuitar]) {
        for (const dep of dependientesDe(habilidadesKi as unknown as HabilidadKi[], n)) {
          if (!aQuitar.has(dep)) {
            aQuitar.add(dep);
            creciendo = true;
          }
        }
      }
    }
    setKi({ habilidades: elecciones.habilidades.filter((h) => !aQuitar.has(h)) });
  };

  const costeKi = Number(datos.categoria?.costeKi ?? 0);
  const costeAcum = Number(datos.categoria?.costeAcumKi ?? 0);
  const cm = ki.conocimientoMarcial;

  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Dominios del Ki</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
          El Ki sale de las seis características físicas y anímicas: cada punto hasta 10 da uno
          de Ki y cada punto por encima da dos. La <strong>Acumulación</strong> es lo que puedes
          reunir en un asalto; se reduce a la mitad (redondeando hacia arriba) si además haces
          cualquier otra cosa. Cuándo acumular y cuándo descargar lo decides tú en la mesa, no
          la aplicación.
        </p>

        <div className="recursos tira">
          <div className="recurso ki">
            <div className="etiqueta">Reserva de Ki</div>
            <div className="cifra">{ki.reserva}</div>
          </div>
          <div className="recurso">
            <div className="etiqueta">Acumulación</div>
            <div className="cifra">{ki.acumulacionTotal}</div>
            <div className="sufijo">{ki.acumulacionReducida} si haces algo más</div>
          </div>
          <div className="recurso">
            <div className="etiqueta">CM disponible</div>
            <div className="cifra">{cm.disponible}</div>
            <div className="sufijo">de {cm.total}</div>
          </div>
          {ki.deteccion !== null && (
            <div className="recurso">
              <div className="etiqueta">Detección</div>
              <div className="cifra">{ki.deteccion}</div>
            </div>
          )}
          {ki.ocultacion !== null && (
            <div className="recurso">
              <div className="etiqueta">Ocultación</div>
              <div className="cifra">{ki.ocultacion}</div>
            </div>
          )}
        </div>

        <label className="opcion" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={elecciones.unificado ?? false}
            onChange={(e) => setKi({ unificado: e.target.checked })}
          />
          <span>
            Unificación de puntos de Ki
            <em>
              Regla opcional del Dominus Exxet: una sola Reserva en lugar de seis montones.
              Sigues usando las Acumulaciones, pero el gasto sale del total.
            </em>
          </span>
        </label>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Puntos de Ki y Acumulación</h2>
        {costeKi === 0 && costeAcum === 0 && (
          <p className="aviso">
            Tu categoría no permite comprar Ki ni Acumulación con PD. Lo que tengas viene de tus
            características.
          </p>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Característica</th>
                <th>Ki base</th>
                <th>PD en Ki</th>
                <th>Ki total</th>
                <th>Acum. base</th>
                <th>PD en Acum.</th>
                <th>Acum. total</th>
                <th>Mitad</th>
              </tr>
            </thead>
            <tbody>
              {CARACTERISTICAS_KI.map((c: CaracteristicaKi) => {
                const p = ki.puntos[c];
                const a = ki.acumulacion[c];
                return (
                  <tr key={c}>
                    <th scope="row">{c}</th>
                    <td>{p.base}</td>
                    <td>
                      <input
                        aria-label={`PD en Ki de ${c}`}
                        type="number"
                        min={0}
                        style={{ width: 70 }}
                        disabled={costeKi === 0}
                        value={personaje.pdInvertidos[`Ki${c}`] ?? 0}
                        onChange={(e) => setPD(`Ki${c}`, Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <strong className="destacado">{p.total}</strong>
                    </td>
                    <td>{a.base}</td>
                    <td>
                      <input
                        aria-label={`PD en Acumulación de ${c}`}
                        type="number"
                        min={0}
                        style={{ width: 70 }}
                        disabled={costeAcum === 0}
                        value={personaje.pdInvertidos[`AcumKi${c}`] ?? 0}
                        onChange={(e) => setPD(`AcumKi${c}`, Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <strong className="destacado">{a.total}</strong>
                      {a.penalizadorArmadura < 0 && (
                        <em
                          style={{ color: 'var(--texto-debil)', fontSize: '0.75rem' }}
                          title="La armadura resta 1 por cada 20 de penalizador"
                        >
                          {' '}
                          {a.penalizadorArmadura} armadura
                        </em>
                      )}
                    </td>
                    <td>{a.mitad}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
          Coste de la categoría: {costeKi || '—'} PD por punto de Ki, {costeAcum || '—'} PD por
          punto de Acumulación.
        </p>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Conocimiento Marcial</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
          El CM sólo sirve para los Dominios del Ki: habilidades, Límites y Técnicas. No se puede
          usar para comprar puntos de Ki ni Acumulaciones.
        </p>
        <div className="rejilla">
          <div className="campo">
            <label htmlFor="pd-cm">PD invertidos en CM</label>
            <input
              id="pd-cm"
              type="number"
              min={0}
              value={personaje.pdInvertidos['CM'] ?? 0}
              onChange={(e) => setPD('CM', Number(e.target.value))}
            />
          </div>
        </div>
        <p style={{ fontSize: '0.9rem' }}>
          Categoría <strong className="destacado">{cm.categoria}</strong> · Artes marciales{' '}
          <strong className="destacado">{cm.artesMarciales}</strong> · Ventajas{' '}
          <strong className="destacado">{cm.ventajas}</strong> · Comprado{' '}
          <strong className="destacado">{cm.comprado}</strong> = total{' '}
          <strong className="destacado">{cm.total}</strong>, de los que llevas gastados{' '}
          <strong className="destacado">{cm.gastado}</strong>.
        </p>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
          Cada 5 PD dan 5 CM, sea cual sea tu categoría, y el tope son{' '}
          {Number.isFinite(cm.limitePD) ? cm.limitePD : '—'} PD (una décima parte de los tuyos).
          Ese gasto entra además dentro del límite de habilidades de combate.
        </p>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Habilidades del Ki y del Némesis</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
          Cada una cuelga de otra. Puedes marcar la que quieras aunque te falte el requisito —el
          manual deja el aprendizaje en manos del Director—, pero la ficha te avisará. Al
          desmarcar una se quitan también las que dependían de ella.
        </p>
        {(['Ki', 'Némesis'] as const).map((dominio) => (
          <div key={dominio} style={{ marginBottom: 14 }}>
            <p
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--oro)',
                margin: '8px 0 4px',
              }}
            >
              {dominio === 'Ki' ? 'Dominios del Ki' : 'El Némesis'}
            </p>
            <div className="lista-seleccion">
              {ordenadas
                .filter((h) => h.dominio === dominio)
                .map((h) => {
                  const elegida = elecciones.habilidades.includes(h.habilidad);
                  const faltaRequisito =
                    (h.requisito && !elecciones.habilidades.includes(h.requisito)) ||
                    (h.requisitoExtra && !elecciones.habilidades.includes(h.requisitoExtra));
                  return (
                    <label
                      key={`${dominio}-${h.habilidad}`}
                      className={elegida ? 'elegida' : undefined}
                      style={{ paddingLeft: 10 + profundidad(h, porNombre) * SANGRIA }}
                    >
                      <input
                        type="checkbox"
                        checked={elegida}
                        onChange={() => alternarHabilidad(h.habilidad)}
                      />
                      <span>
                        {h.habilidad}
                        {elegida && faltaRequisito && (
                          <em style={{ color: 'var(--sangre-claro)' }}> · te falta {h.requisito}</em>
                        )}
                      </span>
                      <em>{h.CM} CM</em>
                    </label>
                  );
                })}
            </div>
          </div>
        ))}
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Límite</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
          Un Límite devuelve Ki en una circunstancia concreta. Se elige uno solo y no se puede
          cambiar después; con la ventaja Límite dual, dos. Piden Natura 10 o más, así que las
          entidades Entre Mundos y los Espíritus se quedan sin.
        </p>
        <div className="lista-seleccion">
          {limites.map((l) => {
            const elegido = elecciones.limites.includes(l.limite);
            return (
              <label key={l.limite} className={elegido ? 'elegida' : undefined}>
                <input
                  type="checkbox"
                  checked={elegido}
                  onChange={() =>
                    setKi({
                      limites: elegido
                        ? elecciones.limites.filter((x) => x !== l.limite)
                        : [...elecciones.limites, l.limite],
                    })
                  }
                />
                <span>
                  {l.limite}
                  {/* `small`, no `em`: la regla de la lista deja los `em` sin partir línea. */}
                  <small style={{ display: 'block', color: 'var(--texto-debil)' }}>{l.efecto}</small>
                </span>
                <em>{l.coste} CM</em>
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Artes marciales</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
          Dominar un grado de arte marcial <strong>da</strong> CM, no lo gasta. Las básicas tienen
          tres grados (Base, Avanzado y Supremo) y las avanzadas dos (Base y Arcano); siempre hace
          falta el grado anterior. El coste en PD se paga aparte, en Habilidades.
        </p>
        <Selector
          opciones={artesMarciales}
          claveDe={(a) => String(a.arte ?? '')}
          detalleDe={(a) => (Number(a.CM ?? 0) > 0 ? `+${a.CM} CM` : String(a.especial ?? ''))}
          grupoDe={(a) => String(a._seccion ?? '')}
          seleccionadas={elecciones.artesMarciales}
          onCambiar={(v) => setKi({ artesMarciales: v })}
          etiquetaBusqueda="Buscar arte marcial"
        />
      </section>

      <section className="panel">
        <h2>Técnicas de Dominio</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
          Las Técnicas del compendio del Dominus Exxet, con su coste en CM ya calculado. Cada
          árbol va por niveles: normalmente hace falta una del nivel anterior para aprender la
          siguiente, salvo con la ventaja Técnicas desvinculadas.
        </p>
        <Selector
          opciones={compendio}
          claveDe={(t) => t.tecnica}
          detalleDe={(t) => `Nv ${t.nivel ?? '?'} · ${t.CM ?? 0} CM`}
          grupoDe={(t) => String(t.arbol ?? '')}
          seleccionadas={elecciones.tecnicas.map((t) => t.nombre)}
          onCambiar={(nombres) =>
            setKi({
              tecnicas: nombres.map((n) => ({
                nombre: n,
                CM: Number(compendio.find((t) => t.tecnica === n)?.CM ?? 0),
              })),
            })
          }
          etiquetaBusqueda="Buscar Técnica"
        />
        {elecciones.tecnicas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {elecciones.tecnicas.map((t) => {
              const ficha = compendio.find((x) => x.tecnica === t.nombre);
              if (!ficha) return null;
              return (
                <p key={t.nombre} style={{ fontSize: '0.86rem', margin: '6px 0' }}>
                  <strong className="destacado">{ficha.tecnica}</strong>{' '}
                  <span style={{ color: 'var(--texto-debil)' }}>
                    ({ficha.arbol}, nivel {ficha.nivel})
                  </span>
                  <br />
                  Coste en Ki: {ficha.coste || '—'}. Efectos: {ficha.efectos || '—'}
                  {ficha.desventajas ? `. ${ficha.desventajas}` : ''}
                </p>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
