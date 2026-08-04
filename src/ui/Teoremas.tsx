import { useState } from 'react';
import type { TeoremaMagia } from '../datos/tipos';
import {
  DISTANCIA_EFECTO,
  DURACION_EFECTO,
  ESPECIALIDADES,
  TIEMPO_OFUDA,
  VINCULOS_FISICOS,
  ZONAS_ESPIRITUALES,
  calcularEfectoNatural,
  calcularShamanica,
  calcularVodoun,
  costeSinOfuda,
  crearOfuda,
  danoVodoun,
  resultadoDe,
  type Afinidad,
  type GradoConjuro,
  type ZonaEspiritual,
} from '../motor/teoremas';

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

function Avisos({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null;
  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--texto-tenue)', fontSize: '0.85rem' }}>
      {avisos.map((a) => (
        <li key={a}>{a}</li>
      ))}
    </ul>
  );
}

function Onmyodo() {
  const [nivel, setNivel] = useState(20);
  const [costeBase, setCosteBase] = useState(50);
  const [tiempo, setTiempo] = useState('Media hora');
  const o = crearOfuda(nivel, costeBase, tiempo);
  const sin = costeSinOfuda(costeBase);

  return (
    <article className="panel">
      <h3 style={{ marginTop: 0 }}>Crear un Ofuda</h3>
      <div className="rejilla">
        <div className="campo">
          <label htmlFor="ofuda-nivel">Nivel del conjuro</label>
          <input
            id="ofuda-nivel"
            type="number"
            min={2}
            max={90}
            value={nivel}
            onChange={(e) => setNivel(Number(e.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="ofuda-coste">Coste en Grado Base</label>
          <input
            id="ofuda-coste"
            type="number"
            min={0}
            value={costeBase}
            onChange={(e) => setCosteBase(Number(e.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="ofuda-tiempo">Tiempo dedicado</label>
          <select id="ofuda-tiempo" value={tiempo} onChange={(e) => setTiempo(e.target.value)}>
            {TIEMPO_OFUDA.map((t) => (
              <option key={t.tiempo} value={t.tiempo}>
                {t.tiempo} ({t.modificador >= 0 ? '+' : ''}
                {t.modificador})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="recursos tira">
        <Cuenta
          titulo="Caligrafía Ritual"
          valor={o.dificultad}
          sufijo={`${o.dificultadBase} base ${o.porTiempo >= 0 ? '+' : '−'}${Math.abs(o.porTiempo)} tiempo`}
        />
        <Cuenta titulo="Zeon dentro" valor={o.zeonInvertido} sufijo="la mitad del Grado Base" />
        <Cuenta titulo="Zeon Máximo" valor={`−${o.reduccionZeonMaximo}`} sufijo="mientras el Ofuda exista" />
        <Cuenta titulo="Sin Ofuda" valor={sin.coste} sufijo="Zeon, y sólo en Grado Base" />
      </div>
      {o.fueraDeTabla && (
        <p className="error-formula">
          El manual sólo da dificultades hasta nivel 90; por encima de ahí decide la mesa.
        </p>
      )}
      <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
        No se puede meter más de la mitad: pasarse quema el Ofuda de inmediato. Al consumirse
        o al ser destruido, el creador recupera ese Zeon Máximo (no el Zeon gastado).
      </p>
    </article>
  );
}

function Vodoun() {
  const [vinculos, setVinculos] = useState<string[]>([]);
  const [ritual, setRitual] = useState(false);
  const [lejos, setLejos] = useState(false);
  const [km, setKm] = useState(100);
  const [dano, setDano] = useState(100);
  const r = calcularVodoun({
    vinculos,
    ritualDeVinculacion: ritual,
    granDistancia: lejos,
    kilometros: km,
  });

  const marcar = (v: string) =>
    setVinculos((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  return (
    <>
      <article className="panel" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Vínculos físicos</h3>
        <label style={etiqueta}>Lo que el brujo tiene de su víctima</label>
        <div style={{ display: 'grid', gap: 2, margin: '6px 0 10px' }}>
          {VINCULOS_FISICOS.map((v) => (
            <label className="opcion" key={v.vinculo}>
              <input
                type="checkbox"
                checked={vinculos.includes(v.vinculo)}
                onChange={() => marcar(v.vinculo)}
              />
              <span>
                {v.vinculo} <span style={{ color: 'var(--texto-debil)' }}>(+{v.bono})</span>
              </span>
            </label>
          ))}
          <label className="opcion">
            <input type="checkbox" checked={ritual} onChange={() => setRitual((x) => !x)} />
            <span>
              Ritual de Vinculación{' '}
              <span style={{ color: 'var(--texto-debil)' }}>
                (alcanza sin Proyección Mágica, gastando un vínculo)
              </span>
            </span>
          </label>
          {ritual && (
            <label className="opcion">
              <input type="checkbox" checked={lejos} onChange={() => setLejos((x) => !x)} />
              <span>
                A gran distancia, sin verle{' '}
                <span style={{ color: 'var(--texto-debil)' }}>(hay que saber su nombre y su aspecto)</span>
              </span>
            </label>
          )}
        </div>

        {ritual && lejos && (
          <div className="campo" style={{ maxWidth: 220 }}>
            <label htmlFor="vodoun-km">Kilómetros de distancia</label>
            <input
              id="vodoun-km"
              type="number"
              min={0}
              value={km}
              onChange={(e) => setKm(Number(e.target.value) || 0)}
            />
          </div>
        )}

        <div className="recursos tira">
          <Cuenta titulo="Bono a la RM" valor={`+${r.bonoRM}`} sufijo="que ha de superar el blanco" />
          {r.automatico && (
            <Cuenta
              titulo="El blanco suma"
              valor={`+${r.bonoRMObjetivo}`}
              sufijo="por no fijarlo con Proyección Mágica"
            />
          )}
          {r.automatico && (
            <Cuenta
              titulo="Neto"
              valor={`${r.neto >= 0 ? '+' : ''}${r.neto}`}
              sufijo="a favor del brujo"
            />
          )}
          {r.horasDeRitual > 0 && (
            <Cuenta titulo="Ritual" valor={`${r.horasDeRitual} h`} sufijo="una hora por 25 km" />
          )}
        </div>
        {r.gastadoEnVincular && (
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.85rem' }}>
            Se consume <strong>{r.gastadoEnVincular}</strong> para enlazar el hechizo, así que
            ese no aporta su bono.
          </p>
        )}
        <Avisos avisos={r.avisos} />
      </article>

      <article className="panel">
        <h3 style={{ marginTop: 0 }}>Debilidad ofensiva</h3>
        <div className="rejilla">
          <div className="campo">
            <label htmlFor="vodoun-dano">Daño final del conjuro de Ataque</label>
            <input
              id="vodoun-dano"
              type="number"
              min={0}
              value={dano}
              onChange={(e) => setDano(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="recursos tira">
          <Cuenta titulo="Daño real" valor={danoVodoun(dano)} sufijo="la mitad, redondeando a 5 arriba" />
        </div>
      </article>
    </>
  );
}

const GRADOS: GradoConjuro[] = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];
const AFINIDADES: Afinidad[] = ['Afines', 'Neutrales', 'Opuestos'];

function Shamanica() {
  const [zona, setZona] = useState<ZonaEspiritual>('Normal');
  const [llamar, setLlamar] = useState(false);
  const [grado, setGrado] = useState<GradoConjuro>('Base');
  const [afinidad, setAfinidad] = useState<Afinidad>('Neutrales');
  const r = calcularShamanica(zona, llamar, grado, afinidad);

  return (
    <article className="panel">
      <h3 style={{ marginTop: 0 }}>Lanzar en una zona espiritual</h3>
      <div className="rejilla">
        <div className="campo">
          <label htmlFor="sham-zona">Zona (su grado natural)</label>
          <select
            id="sham-zona"
            value={zona}
            onChange={(e) => setZona(e.target.value as ZonaEspiritual)}
          >
            {ZONAS_ESPIRITUALES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sham-grado">Grado que pretende</label>
          <select
            id="sham-grado"
            value={grado}
            onChange={(e) => setGrado(e.target.value as GradoConjuro)}
          >
            {GRADOS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sham-afinidad">Los espíritus del sitio son…</label>
          <select
            id="sham-afinidad"
            value={afinidad}
            onChange={(e) => setAfinidad(e.target.value as Afinidad)}
          >
            {AFINIDADES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="opcion">
        <input type="checkbox" checked={llamar} onChange={() => setLlamar((x) => !x)} />
        <span>Llamar Espíritus para subir la zona un grado</span>
      </label>

      <div className="recursos tira">
        <Cuenta titulo="Zona al lanzar" valor={r.zona} />
        <Cuenta titulo="Grado final" valor={r.fracasa ? 'Fracasa' : (r.grado ?? '—')} />
        {r.zeonLlamada > 0 && <Cuenta titulo="Llamada" valor={r.zeonLlamada} sufijo="Zeon" />}
        {r.mitadDeZeon && <Cuenta titulo="Zeon" valor="½" sufijo="del coste normal" />}
        {r.bonoACT > 0 && <Cuenta titulo="ACT y Proy." valor={`+${r.bonoACT}`} />}
      </div>
      <Avisos avisos={r.avisos} />
      <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem' }}>
        Si los espíritus de un sitio son afines a tu personaje lo decide la mesa: depende de
        quién es y qué ha hecho, no de ningún número.
      </p>
    </article>
  );
}

function MagiaNatural() {
  const [nivel, setNivel] = useState(2);
  const [distancia, setDistancia] = useState('Proyectado +0');
  const [duracion, setDuracion] = useState('Instantáneo');
  const [zeon, setZeon] = useState(150);
  const [poder, setPoder] = useState(8);
  const [especialidad, setEspecialidad] = useState('');
  const [dentro, setDentro] = useState(true);
  const [puro, setPuro] = useState(false);
  const [pasoAtras, setPasoAtras] = useState(false);
  const [dado, setDado] = useState(8);

  const e = calcularEfectoNatural({
    nivel,
    distancia,
    duracion,
    zeon,
    dentroDeSuEspecialidad: especialidad ? dentro : null,
    elementalistaPuro: especialidad === 'Elementalista' && puro,
    unPasoAtras: pasoAtras,
  });
  const control = poder + e.bonoTotal;
  const total = control + dado;
  const margen = total - e.dificultadFinal;
  const resultado = resultadoDe(margen);

  return (
    <article className="panel">
      <h3 style={{ marginTop: 0 }}>Efecto místico natural</h3>
      <div className="rejilla">
        <div className="campo">
          <label htmlFor="nat-nivel">Nivel del efecto (lo pone el Director)</label>
          <select id="nat-nivel" value={nivel} onChange={(ev) => setNivel(Number(ev.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nat-dist">Distancia</label>
          <select id="nat-dist" value={distancia} onChange={(ev) => setDistancia(ev.target.value)}>
            {DISTANCIA_EFECTO.map((d) => (
              <option key={d.distancia} value={d.distancia}>
                {d.distancia} (+{d.modificador})
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nat-dur">Duración</label>
          <select id="nat-dur" value={duracion} onChange={(ev) => setDuracion(ev.target.value)}>
            {DURACION_EFECTO.map((d) => (
              <option key={d.duracion} value={d.duracion}>
                {d.duracion} (+{d.modificador})
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nat-zeon">Zeon acumulado</label>
          <input
            id="nat-zeon"
            type="number"
            min={0}
            value={zeon}
            onChange={(ev) => setZeon(Number(ev.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="nat-poder">Poder</label>
          <input
            id="nat-poder"
            type="number"
            min={1}
            value={poder}
            onChange={(ev) => setPoder(Number(ev.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="nat-dado">Resultado del dado</label>
          <input
            id="nat-dado"
            type="number"
            value={dado}
            onChange={(ev) => setDado(Number(ev.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="nat-esp">Especialidad</label>
          <select id="nat-esp" value={especialidad} onChange={(ev) => setEspecialidad(ev.target.value)}>
            <option value="">Ninguna</option>
            {ESPECIALIDADES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>

      {especialidad && (
        <div style={{ display: 'grid', gap: 2, marginBottom: 10 }}>
          <label className="opcion">
            <input type="checkbox" checked={dentro} onChange={() => setDentro((x) => !x)} />
            <span>El efecto cae dentro de su campo</span>
          </label>
          {especialidad === 'Elementalista' && (
            <label className="opcion">
              <input type="checkbox" checked={puro} onChange={() => setPuro((x) => !x)} />
              <span>
                Se ciñe a un solo elemento{' '}
                <span style={{ color: 'var(--texto-debil)' }}>(+4, pero nada con el resto)</span>
              </span>
            </label>
          )}
        </div>
      )}
      <label className="opcion" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={pasoAtras} onChange={() => setPasoAtras((x) => !x)} />
        <span>
          Es un mago acostumbrado a conjuros{' '}
          <span style={{ color: 'var(--texto-debil)' }}>(regla opcional «Un paso atrás»: −4)</span>
        </span>
      </label>

      <div className="recursos tira">
        <Cuenta
          titulo="Dificultad"
          valor={e.dificultadFinal}
          sufijo={`${e.dificultadBase} nivel +${e.porDistancia} distancia +${e.porDuracion} duración`}
        />
        <Cuenta
          titulo="Control de Poder"
          valor={control}
          sufijo={`${poder} Poder ${e.bonoTotal >= 0 ? '+' : '−'}${Math.abs(e.bonoTotal)}`}
        />
        <Cuenta titulo="Con el dado" valor={total} sufijo={`margen ${margen >= 0 ? '+' : ''}${margen}`} />
      </div>
      <p style={{ marginBottom: 0 }}>
        <strong>{resultado.resultado}:</strong> {resultado.efecto}
      </p>
    </article>
  );
}

export function Teoremas({ teoremas }: { teoremas: TeoremaMagia[] }) {
  const [elegido, setElegido] = useState('Onmyodo');
  const t = teoremas.find((x) => x.teorema === elegido);

  return (
    <div>
      <div className="campo">
        <label htmlFor="elige-teorema">Teorema</label>
        <select id="elige-teorema" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          {teoremas.map((x) => (
            <option key={x.teorema} value={x.teorema}>
              {x.teorema} — {x.resumen}
            </option>
          ))}
        </select>
      </div>

      {t && (
        <article className="panel" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{t.teorema}</h3>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem' }}>{t.descripcion}</p>
          {t.ventajas && (
            <>
              <label style={etiqueta}>Ventajas</label>
              <p style={{ marginTop: 2 }}>{t.ventajas}</p>
            </>
          )}
          {t.desventajas && (
            <>
              <label style={etiqueta}>Desventajas</label>
              <p style={{ marginTop: 2 }}>{t.desventajas}</p>
            </>
          )}
          {t.reglas && (
            <>
              <label style={etiqueta}>Otras reglas</label>
              <p style={{ marginTop: 2, marginBottom: 0 }}>{t.reglas}</p>
            </>
          )}
        </article>
      )}

      {elegido === 'Onmyodo' && <Onmyodo />}
      {elegido === 'Vodoun' && <Vodoun />}
      {elegido === 'Shamanica' && <Shamanica />}
      {elegido === 'Magia natural' && <MagiaNatural />}
      {elegido === 'General' && (
        <div className="vacio panel">
          <h2>El sistema del manual básico</h2>
          <p>
            No tiene reglas especiales que calcular: es el Teorema que usa el resto de la
            aplicación. Los otros cuatro sí traen sus propias cuentas.
          </p>
        </div>
      )}
    </div>
  );
}
