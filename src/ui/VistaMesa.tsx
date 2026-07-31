import { useState } from 'react';
import {
  TIPOS_DANO,
  resolverAsalto,
  type ResultadoAsalto,
  type TipoDano,
} from '../motor/combate';
import { tirarD100, type Tirada } from '../motor/dados';
import { calcular, type DatosCalculo, type Personaje } from '../motor/personaje';
import type { Reglamento } from '../motor/reglamento';
import { useEnemigos } from './VistaBestiario';
import { Imagen } from './Imagen';

interface Props {
  personaje: Personaje;
  datos: DatosCalculo;
  reglamento: Reglamento;
  campanaId: string | null;
  onCambiar: (p: Personaje) => void;
}

interface Registro {
  id: number;
  texto: string;
  detalle: string;
  critico?: boolean;
}

function describeTirada(t: Tirada): string {
  const dados = t.dados.join(' + ');
  if (t.pifia) return `${dados} → pifia (−${t.nivelPifia}) = ${t.total}`;
  if (t.abierta) return `${dados} → abierta = ${t.total}`;
  return `${t.total}`;
}

export function VistaMesa({ personaje, datos, reglamento, campanaId, onCambiar }: Props) {
  const { enemigos, guardar: guardarEnemigo } = useEnemigos(campanaId);
  const [enemigoId, setEnemigoId] = useState<string>('');
  const ficha = calcular(personaje, datos, reglamento);
  const [registro, setRegistro] = useState<Registro[]>([]);
  const [siguienteId, setSiguienteId] = useState(1);

  // Enemigo suelto, para cuando no está en el bestiario.
  const [defensa, setDefensa] = useState(60);
  const [taEnemigo, setTaEnemigo] = useState(2);
  const [pvEnemigo, setPvEnemigo] = useState(100);
  const [armaElegida, setArmaElegida] = useState(0);

  const enemigo = enemigos.find((e) => e.id === enemigoId) ?? null;

  const anotar = (texto: string, detalle: string, critico = false) => {
    setRegistro((antes) => [{ id: siguienteId, texto, detalle, critico }, ...antes].slice(0, 30));
    setSiguienteId((n) => n + 1);
  };

  const estado = personaje.estado;
  const pv = estado.pvActuales ?? ficha.puntosVida.valor;
  const cansancio = estado.cansancioActual ?? ficha.cansancio.valor;
  const zeon = estado.zeonActual ?? ficha.zeon.valor;

  const ajustar = (campo: keyof typeof estado, delta: number, maximo: number) => {
    const actual = estado[campo] ?? maximo;
    onCambiar({
      ...personaje,
      estado: { ...estado, [campo]: Math.max(0, Math.min(maximo, actual + delta)) },
    });
  };

  const restablecer = () =>
    onCambiar({
      ...personaje,
      estado: {
        ...estado,
        pvActuales: ficha.puntosVida.valor,
        cansancioActual: ficha.cansancio.valor,
        zeonActual: ficha.zeon.valor,
      },
    });

  const arma = ficha.combate.armas[armaElegida];

  const tirarIniciativa = () => {
    const base = arma?.turno ?? ficha.combate.turnoNatural.valor;
    const t = tirarD100(base);
    anotar(`Iniciativa: ${base + t.total}`, `${base} de turno + ${describeTirada(t)}`);
  };

  const atacar = () => {
    if (!arma) return;
    const TA = enemigo
      ? enemigo.TA
      : (Object.fromEntries(TIPOS_DANO.map((t) => [t, taEnemigo])) as Record<TipoDano, number>);
    const tipoDano = (arma.criticos[0] as TipoDano) ?? 'CON';
    const pv = enemigo ? enemigo.pvActuales ?? enemigo.puntosVida : pvEnemigo;
    const r: ResultadoAsalto = resolverAsalto(
      { nombre: personaje.nombre, habilidadAtaque: arma.ataque, dano: arma.dano, tipoDano },
      {
        nombre: enemigo?.nombre ?? 'Enemigo',
        habilidadDefensa: enemigo ? enemigo.defensa : defensa,
        tipoDefensa: enemigo?.tipoDefensa ?? 'Parada',
        TA,
        pvActuales: pv,
      },
      reglamento,
    );
    if (r.danoInfligido > 0) {
      if (enemigo) {
        void guardarEnemigo({ ...enemigo, pvActuales: Math.max(0, pv - r.danoInfligido) });
      } else {
        setPvEnemigo((n) => Math.max(0, n - r.danoInfligido));
      }
    }
    const defensaUsada = enemigo ? enemigo.defensa : defensa;
    const nombreEnemigo = enemigo?.nombre ?? 'Enemigo';
    const titulo = r.descripcion.startsWith(nombreEnemigo)
      ? r.descripcion
      : `${nombreEnemigo}: ${r.descripcion}`;
    anotar(
      titulo,
      `Ataque ${arma.ataque} + ${describeTirada(r.tiradaAtaque)} = ${r.totalAtaque} · ` +
        `Defensa ${defensaUsada} + ${describeTirada(r.tiradaDefensa)} = ${r.totalDefensa} · ` +
        `Resultado ${r.resultado} − absorción ${r.absorcion} = margen ${r.margen}`,
      r.critico,
    );
  };

  const tirarSecundaria = (nombre: string, valor: number) => {
    const t = tirarD100(valor);
    anotar(`${nombre}: ${valor + t.total}`, `${valor} + ${describeTirada(t)}`);
  };

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Recursos</h2>
        <div className="rejilla">
          {([
            ['Vida', 'pvActuales', pv, ficha.puntosVida.valor, 'vida'],
            ['Cansancio', 'cansancioActual', cansancio, ficha.cansancio.valor, ''],
            ['Zeón', 'zeonActual', zeon, ficha.zeon.valor, 'zeon'],
          ] as const).map(([etiqueta, campo, actual, maximo, clase]) => (
            <div key={campo} className={`recurso ${clase}`} style={{ border: '1px solid var(--borde)', borderRadius: 'var(--radio-s)', padding: 10 }}>
              <div className="etiqueta">{etiqueta}</div>
              <div className="cifra">
                {actual}<span style={{ fontSize: '0.7rem', color: 'var(--texto-debil)' }}> / {maximo}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                {[-10, -5, -1, 1, 5, 10].map((d) => (
                  <button
                    key={d}
                    className="accion"
                    style={{ padding: '3px 7px', fontSize: '0.76rem' }}
                    onClick={() => ajustar(campo, d, maximo)}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="acciones-regla">
          <button className="accion" onClick={restablecer}>Descanso completo</button>
          <button className="accion" onClick={tirarIniciativa}>Tirar iniciativa</button>
        </div>
      </section>

      <div className="rejilla">
        <section className="panel">
          <h2>Resolver un ataque</h2>
          {ficha.combate.armas.length === 0 ? (
            <p style={{ color: 'var(--texto-tenue)' }}>
              Este personaje no tiene armas equipadas. Añádelas en la pestaña Equipo.
            </p>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="arma">Arma</label>
                <select id="arma" value={armaElegida} onChange={(e) => setArmaElegida(Number(e.target.value))}>
                  {ficha.combate.armas.map((a, i) => (
                    <option key={i} value={i}>
                      {a.arma} — ataque {a.ataque}, daño {a.dano}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="enemigo">Enemigo</label>
                <select id="enemigo" value={enemigoId} onChange={(e) => setEnemigoId(e.target.value)}>
                  <option value="">Enemigo suelto (a mano)</option>
                  {enemigos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} — {e.pvActuales ?? e.puntosVida}/{e.puntosVida} PV
                    </option>
                  ))}
                </select>
              </div>

              {enemigo ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  {enemigo.imagenId && (
                    <Imagen id={enemigo.imagenId} alt={enemigo.nombre} className="retrato-mini" />
                  )}
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong className="destacado">{enemigo.nombre}</strong>
                    <br />
                    PV{' '}
                    <strong className={(enemigo.pvActuales ?? enemigo.puntosVida) <= 0 ? 'peligro-texto' : ''}>
                      {enemigo.pvActuales ?? enemigo.puntosVida}
                    </strong>{' '}
                    / {enemigo.puntosVida} · Defensa {enemigo.defensa} ({enemigo.tipoDefensa}) · Ataque{' '}
                    {enemigo.ataque} · Daño {enemigo.dano} {enemigo.tipoDano}
                    <br />
                    <button
                      className="accion"
                      style={{ marginTop: 6 }}
                      onClick={() => void guardarEnemigo({ ...enemigo, pvActuales: enemigo.puntosVida })}
                    >
                      Curar del todo
                    </button>
                  </div>
                </div>
              ) : (
              <div className="rejilla">
                <div className="campo">
                  <label htmlFor="def">Defensa del enemigo</label>
                  <input id="def" type="number" value={defensa} onChange={(e) => setDefensa(Number(e.target.value) || 0)} />
                </div>
                <div className="campo">
                  <label htmlFor="ta">TA del enemigo</label>
                  <input id="ta" type="number" min={0} max={12} value={taEnemigo} onChange={(e) => setTaEnemigo(Number(e.target.value) || 0)} />
                </div>
                <div className="campo">
                  <label htmlFor="pve">PV del enemigo</label>
                  <input id="pve" type="number" min={0} value={pvEnemigo} onChange={(e) => setPvEnemigo(Number(e.target.value) || 0)} />
                </div>
              </div>
              )}
              <button className="accion primaria" onClick={atacar}>Atacar</button>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Tiradas rápidas</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
            Las secundarias que tengas mejor desarrolladas.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(ficha.secundarias)
              .sort(([, a], [, b]) => b.valor - a.valor)
              .slice(0, 12)
              .map(([nombre, v]) => (
                <button key={nombre} className="accion" onClick={() => tirarSecundaria(nombre, v.valor)}>
                  {nombre} {v.valor > 0 ? `+${v.valor}` : v.valor}
                </button>
              ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Registro de la partida</h2>
        {registro.length === 0 ? (
          <p style={{ color: 'var(--texto-debil)', margin: 0 }}>Todavía no has tirado nada.</p>
        ) : (
          <ol className="registro">
            {registro.map((r) => (
              <li key={r.id} className={r.critico ? 'critico' : undefined}>
                <strong>{r.texto}</strong>
                <span>{r.detalle}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
