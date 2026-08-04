import { useState } from 'react';
import {
  DIFICULTAD_BASE_NODO,
  GRADOS_SANCTUM,
  beneficiosDe,
  calcularNodo,
  consecuenciaDe,
  crearSanctum,
  type Dominio,
} from '../motor/nodos';
import type { Grimorio, RitualMistico } from '../datos/tipos';

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

const DOMINIOS: { id: Dominio; texto: string }[] = [
  { id: 'magia', texto: 'Magia' },
  { id: 'psiquico', texto: 'Poderes psíquicos' },
  { id: 'ki', texto: 'Ki' },
];

function Nodo() {
  const [dominio, setDominio] = useState<Dominio>('magia');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [estado, setEstado] = useState(0);
  const [primerEnlace, setPrimerEnlace] = useState(true);
  const [poder, setPoder] = useState(10);
  const [dado, setDado] = useState(50);

  const tabla = beneficiosDe(dominio);
  const r = calcularNodo({ dominio, beneficios: elegidos, estadoDelNodo: estado, primerEnlace });
  // El Control de Poder de un nodo se hace contra una dificultad pequeña, así que la
  // tirada del d100 no interviene: es un control de característica, no una habilidad.
  const margen = poder - r.dificultad;
  const consecuencia = consecuenciaDe(dominio, -margen);

  const marcar = (b: string) =>
    setElegidos((a) => (a.includes(b) ? a.filter((x) => x !== b) : [...a, b]));

  const cambiarDominio = (d: Dominio) => {
    setDominio(d);
    setElegidos([]);
  };

  return (
    <article className="panel" style={{ marginBottom: 14 }}>
      <h3 style={{ marginTop: 0 }}>Sincronizar con un Nodo</h3>
      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem', marginTop: 0 }}>
        Sólo hay siete Nodos en toda Gaïa. Se eligen los beneficios que se quieren y se hace
        un <strong>Control de Poder contra {DIFICULTAD_BASE_NODO}</strong> más sus
        modificadores. Si sale, duran cinco asaltos sin volver a tirar.
      </p>

      <div className="acciones-regla" style={{ marginTop: 0 }}>
        {DOMINIOS.map((d) => (
          <button
            key={d.id}
            className={`accion${dominio === d.id ? ' primaria' : ''}`}
            onClick={() => cambiarDominio(d.id)}
          >
            {d.texto}
          </button>
        ))}
      </div>

      <label style={etiqueta}>Beneficios</label>
      <div style={{ display: 'grid', gap: 2, margin: '6px 0 10px' }}>
        {tabla.map((b) => (
          <label className="opcion" key={b.beneficio}>
            <input
              type="checkbox"
              checked={elegidos.includes(b.beneficio)}
              onChange={() => marcar(b.beneficio)}
            />
            <span>
              {b.beneficio}{' '}
              <span style={{ color: 'var(--texto-debil)' }}>
                ({b.nota === 'NA' ? 'sin coste' : `+${b.modificador}`}
                {b.nota && b.nota !== 'NA' ? ` · ${b.nota}` : ''})
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="rejilla">
        <div className="campo">
          <label htmlFor="nodo-estado">Estado del Nodo</label>
          <select
            id="nodo-estado"
            value={estado}
            onChange={(e) => setEstado(Number(e.target.value))}
          >
            <option value={-3}>Controlado, muy avanzado (−3)</option>
            <option value={-2}>Controlado (−2)</option>
            <option value={-1}>Controlado, sistema básico (−1)</option>
            <option value={0}>Normal (0)</option>
            <option value={1}>Algo corrompido (+1)</option>
            <option value={3}>Corrompido (+3)</option>
            <option value={5}>Caótico (+5)</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nodo-poder">Poder del personaje</label>
          <input
            id="nodo-poder"
            type="number"
            min={1}
            value={poder}
            onChange={(e) => setPoder(Number(e.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="nodo-dado">Resultado del dado</label>
          <input
            id="nodo-dado"
            type="number"
            value={dado}
            onChange={(e) => setDado(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <label className="opcion" style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={primerEnlace}
          onChange={() => setPrimerEnlace((v) => !v)}
        />
        <span>
          Es la primera vez que se enlaza con este Nodo{' '}
          <span style={{ color: 'var(--texto-debil)' }}>(+1)</span>
        </span>
      </label>

      <div className="recursos tira">
        <Cuenta
          titulo="Dificultad"
          valor={r.dificultad}
          sufijo={`${DIFICULTAD_BASE_NODO} base +${r.porBeneficios} beneficios ${
            r.porEstado >= 0 ? '+' : '−'
          }${Math.abs(r.porEstado)} nodo +${r.porPrimerEnlace} enlace`}
        />
        <Cuenta titulo="Poder" valor={poder} sufijo="sin modificadores innaturales" />
        <Cuenta
          titulo="Margen"
          valor={`${margen >= 0 ? '+' : ''}${margen}`}
          sufijo={margen >= 0 ? 'lo consigue' : 'falla'}
        />
      </div>

      {consecuencia ? (
        <div className="aviso error" style={{ marginTop: 10 }}>
          <strong>{consecuencia.resultado}.</strong> {consecuencia.efecto}
        </div>
      ) : (
        <p style={{ marginBottom: 0 }}>
          Sale bien: los beneficios duran <strong>cinco asaltos</strong> sin necesidad de
          volver a tirar. Cambiar de ventajas exige un Control nuevo.
        </p>
      )}
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--texto-tenue)', fontSize: '0.85rem' }}>
        {r.avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
        El dado ({dado}) no entra en la cuenta: el Control de Poder de un Nodo se hace contra
        el atributo, como cualquier control de característica. Está aquí sólo para que lo
        anotes si tu mesa lo tira.
      </p>
    </article>
  );
}

function Sanctum() {
  const [grado, setGrado] = useState(2);
  const [menores, setMenores] = useState(5);
  const [mayores, setMayores] = useState(1);
  const [presencia, setPresencia] = useState(0);
  const s = crearSanctum(grado, menores, mayores, presencia);

  return (
    <article className="panel">
      <h3 style={{ marginTop: 0 }}>Crear un Sanctum Sanctorum</h3>
      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem', marginTop: 0 }}>
        Un Santuario no se tira: se paga. Cada Efecto Menor cuesta <strong>50 puntos de Zeon
        máximo</strong> y cada Efecto Mayor <strong>un punto de Poder</strong>, y ambos
        sacrificios son permanentes.
      </p>

      <div className="rejilla">
        <div className="campo">
          <label htmlFor="sanctum-grado">Grado</label>
          <select
            id="sanctum-grado"
            value={grado}
            onChange={(e) => setGrado(Number(e.target.value))}
          >
            {GRADOS_SANCTUM.map((g) => (
              <option key={g.grado} value={g.grado}>
                Grado {g.grado} — presencia {g.presencia}+, ritual {g.ritual}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sanctum-menores">Efectos Menores</label>
          <input
            id="sanctum-menores"
            type="number"
            min={0}
            value={menores}
            onChange={(e) => setMenores(Number(e.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="sanctum-mayores">Efectos Mayores</label>
          <input
            id="sanctum-mayores"
            type="number"
            min={0}
            value={mayores}
            onChange={(e) => setMayores(Number(e.target.value) || 0)}
          />
        </div>
        <div className="campo">
          <label htmlFor="sanctum-presencia">Presencia base del mago</label>
          <input
            id="sanctum-presencia"
            type="number"
            min={0}
            value={presencia}
            onChange={(e) => setPresencia(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="recursos tira">
        <Cuenta titulo="Zeon máximo" valor={`−${s.zeonMaximoSacrificado}`} sufijo="para siempre" />
        <Cuenta titulo="Poder" valor={`−${s.poderSacrificado}`} sufijo="puntos de atributo" />
        <Cuenta titulo="Ritual de Ocultismo" valor={s.ritual} />
        <Cuenta titulo="Presencia" valor={`${s.presenciaRequerida}+`} sufijo="requerida" />
      </div>

      {s.grado && (
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem' }}>
          <strong>Máximos del grado:</strong> {s.grado.menores} Efectos Menores y{' '}
          {s.grado.mayores} Mayores. <strong>Requisitos:</strong> {s.grado.requisitos}
        </p>
      )}
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--texto-tenue)', fontSize: '0.85rem' }}>
        {s.avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </article>
  );
}

function Rituales({ rituales }: { rituales: RitualMistico[] }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const lista = q
    ? rituales.filter(
        (r) =>
          r.ritual.toLowerCase().includes(q) ||
          (r.efecto ?? '').toLowerCase().includes(q) ||
          (r.requerimientos ?? '').toLowerCase().includes(q),
      )
    : rituales;

  return (
    <div>
      <section className="panel" style={{ marginBottom: 14 }}>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Fórmulas prehechas que producen efectos sobrenaturales <strong>sin necesidad del
          Don</strong>: basta con conocerlas y cumplir sus requisitos en habilidades
          secundarias. El coste en Zeon se puede repartir entre todos los ritualistas.
        </p>
        <div className="campo">
          <label htmlFor="busca-ritual">Buscar</label>
          <input
            id="busca-ritual"
            value={busca}
            placeholder="Guardián, hablar con los muertos, Ocultismo 200…"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
          {lista.length} de {rituales.length} rituales.
        </p>
      </section>

      {lista.map((r) => (
        <article className="panel" key={r.ritual} style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0, marginBottom: 4 }}>{r.ritual}</h4>
          {r.descripcion && (
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem' }}>{r.descripcion}</p>
          )}
          <div className="rejilla">
            <div className="campo">
              <label style={etiqueta}>Integrantes</label>
              <strong>{r.integrantes}</strong>
            </div>
            <div className="campo">
              <label style={etiqueta}>Tiempo</label>
              <strong>{r.tiempo}</strong>
            </div>
            <div className="campo">
              <label style={etiqueta}>Coste</label>
              <strong>{r.coste}</strong>
            </div>
          </div>
          <p style={{ margin: '2px 0' }}>
            <strong>Requerimientos:</strong> {r.requerimientos}
          </p>
          <p style={{ margin: '2px 0' }}>
            <strong>Realización:</strong> {r.realizacion}
          </p>
          <p style={{ margin: '2px 0' }}>
            <strong>Efecto:</strong> {r.efecto}
          </p>
          {r.inMomentum && r.inMomentum !== 'Ninguno' && (
            <p style={{ margin: '2px 0' }}>
              <strong>In Momentum:</strong> {r.inMomentum}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function Grimorios({ grimorios }: { grimorios: Grimorio[] }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const lista = q
    ? grimorios.filter((g) => JSON.stringify(g).toLowerCase().includes(q))
    : grimorios;

  const campos: [keyof Grimorio, string][] = [
    ['conjuros', 'Conjuros'],
    ['rituales', 'Rituales'],
    ['invocaciones', 'Invocaciones'],
    ['criaturas', 'Criaturas'],
    ['teoriaMagica', 'Teoría Mágica'],
    ['conocimiento', 'Conocimiento'],
    ['especial', 'Especial'],
  ];

  return (
    <div>
      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="campo">
          <label htmlFor="busca-grimorio">Buscar</label>
          <input
            id="busca-grimorio"
            value={busca}
            placeholder="Nigromancia, Devah, Vía de Tierra…"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
          {lista.length} de {grimorios.length} grimorios.
        </p>
      </section>

      {lista.map((g) => (
        <article className="panel" key={g.grimorio} style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0, marginBottom: 4 }}>{g.grimorio}</h4>
          <p style={{ ...etiqueta, margin: 0 }}>Idioma: {g.idioma}</p>
          {g.descripcion && (
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem' }}>{g.descripcion}</p>
          )}
          {campos.map(([clave, nombre]) =>
            g[clave] ? (
              <p key={clave} style={{ margin: '2px 0' }}>
                <strong>{nombre}:</strong> {String(g[clave])}
              </p>
            ) : null,
          )}
        </article>
      ))}
    </div>
  );
}

export function Nodos({
  rituales,
  grimorios,
}: {
  rituales: RitualMistico[];
  grimorios: Grimorio[];
}) {
  const [pestana, setPestana] = useState<'nodos' | 'rituales' | 'grimorios'>('nodos');

  return (
    <div>
      <div className="acciones-regla" style={{ marginTop: 0, marginBottom: 14 }}>
        <button
          className={`accion${pestana === 'nodos' ? ' primaria' : ''}`}
          onClick={() => setPestana('nodos')}
        >
          Nodos y Santuarios
        </button>
        <button
          className={`accion${pestana === 'rituales' ? ' primaria' : ''}`}
          onClick={() => setPestana('rituales')}
        >
          Rituales ({rituales.length})
        </button>
        <button
          className={`accion${pestana === 'grimorios' ? ' primaria' : ''}`}
          onClick={() => setPestana('grimorios')}
        >
          Grimorios ({grimorios.length})
        </button>
      </div>

      {pestana === 'nodos' && (
        <>
          <Nodo />
          <Sanctum />
        </>
      )}
      {pestana === 'rituales' && <Rituales rituales={rituales} />}
      {pestana === 'grimorios' && <Grimorios grimorios={grimorios} />}
    </div>
  );
}
