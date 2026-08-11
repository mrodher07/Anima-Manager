import { useState } from 'react';
import {
  TIPOS_DANO,
  resolverAsalto,
  type ResultadoAsalto,
  type TipoDano,
} from '../motor/combate';
import { tirarD100, type Tirada } from '../motor/dados';
import {
  consecuenciaFracaso,
  controlDeInvocacion,
  costeEnKi,
  mantenimiento,
} from '../motor/sellos';
import { calcular, type DatosCalculo, type Personaje } from '../motor/personaje';
import type { Reglamento } from '../motor/reglamento';
import { useEnemigos } from './VistaBestiario';
import { useTiradas } from './estado';
import { Imagen } from './Imagen';
import { useColeccion } from './estado';
import type { Catalogo } from '../datos/paquetes';
import { CombateAlternativo } from './CombateAlternativo';
import type { SistemaCombate } from '../motor/combateAlternativo';

interface Props {
  personaje: Personaje;
  datos: DatosCalculo;
  catalogo: Catalogo;
  reglamento: Reglamento;
  campanaId: string | null;
  /** El de la campaña activa. Sólo cambia cuánto dura cada asalto. */
  sistemaCombate: SistemaCombate;
  onCambiar: (p: Personaje) => void;
}

function describeTirada(t: Tirada): string {
  const dados = t.dados.join(' + ');
  if (t.pifia) return `${dados} → pifia (−${t.nivelPifia}) = ${t.total}`;
  if (t.abierta) return `${dados} → abierta = ${t.total}`;
  return `${t.total}`;
}

export function VistaMesa({
  personaje,
  datos,
  catalogo,
  reglamento,
  campanaId,
  sistemaCombate,
  onCambiar,
}: Props) {
  const { enemigos, guardar: guardarEnemigo } = useEnemigos(campanaId);
  const [enemigoId, setEnemigoId] = useState<string>('');
  const ficha = calcular(personaje, datos, reglamento);
  // El registro se guarda en el almacén, no en un `useState`: antes bastaba recargar la
  // página para perder media sesión de tiradas.
  const { tiradas, anotar: guardarTirada, vaciar: vaciarRegistro } = useTiradas(campanaId);

  // Enemigo suelto, para cuando no está en el bestiario.
  const [defensa, setDefensa] = useState(60);
  const [taEnemigo, setTaEnemigo] = useState(2);
  const [pvEnemigo, setPvEnemigo] = useState(100);
  const [armaElegida, setArmaElegida] = useState(0);
  // Invocación por Ki: lo que se declara antes de tirar el Control.
  const [nivelCriatura, setNivelCriatura] = useState(1);
  const [refuerzoMenor, setRefuerzoMenor] = useState(0);
  const [refuerzoMayor, setRefuerzoMayor] = useState(0);
  const [esPacto, setEsPacto] = useState(false);
  const [criaturaElegida, setCriaturaElegida] = useState('');
  const sellosCriatura = useColeccion(catalogo, 'sellosCriatura');
  const criaturaFicha = sellosCriatura.find((c) => c.criatura === criaturaElegida);

  const enemigo = enemigos.find((e) => e.id === enemigoId) ?? null;

  const anotar = (texto: string, detalle: string, critico = false) => {
    void guardarTirada({
      personajeId: personaje.id,
      autor: personaje.nombre || 'Sin nombre',
      texto,
      detalle,
      critico,
    });
  };

  const estado = personaje.estado;
  const pv = estado.pvActuales ?? ficha.puntosVida.valor;
  const cansancio = estado.cansancioActual ?? ficha.cansancio.valor;
  const zeon = estado.zeonActual ?? ficha.zeon.valor;
  const ki = estado.kiActual ?? ficha.ki.reserva;

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
        kiActual: ficha.ki.reserva,
      },
    });

  const arma = ficha.combate.armas[armaElegida];

  const tirarIniciativa = () => {
    const base = arma?.turno ?? ficha.combate.turnoNatural.valor;
    const t = tirarD100(base);
    anotar(`Iniciativa: ${base + t.total}`, `${base} de turno + ${describeTirada(t)}`);
  };

  /**
   * Control de Invocación (Dominus Exxet, cap. 8). La dificultad sube 10 por cada nivel en
   * que la criatura te supere, y los Sellos de refuerzo la bajan. Admite Abiertos y Pifias.
   */
  const invocar = () => {
    const control = controlDeInvocacion({
      nivelInvocador: ficha.nivel,
      nivelCriatura: nivelCriatura,
      refuerzo: [
        { sello: 'Aire', grado: 'Menor', cantidad: refuerzoMenor },
        { sello: 'Aire', grado: 'Mayor', cantidad: refuerzoMayor },
      ],
      esPacto,
    });
    const kiSellos = costeEnKi(
      [
        { sello: 'Aire', grado: 'Menor', cantidad: refuerzoMenor },
        { sello: 'Aire', grado: 'Mayor', cantidad: refuerzoMayor },
      ],
      esPacto,
    );

    if (control.automatica) {
      anotar(
        `Invocación automática (criatura de nivel ${nivelCriatura})`,
        'Las criaturas de nivel igual o inferior vienen solas, salvo Pifia.',
      );
      return;
    }

    const t = tirarD100(0);
    const margen = t.total - control.objetivo;
    const exito = margen >= 0 && !t.pifia;
    const detalle =
      `${describeTirada(t)} contra ${control.objetivo}` +
      (control.bonoRefuerzo > 0
        ? ` (dificultad ${control.dificultad} − ${control.bonoRefuerzo} de refuerzo)`
        : '') +
      (kiSellos > 0 ? ` · ${kiSellos} de Ki en refuerzos` : '');

    if (exito) {
      anotar(
        `Invocación conseguida · mantenerla cuesta ${mantenimiento(nivelCriatura)} de Ki por asalto`,
        detalle,
      );
    } else {
      const nivelFracaso = t.pifia ? Math.min(margen, -21) : margen;
      anotar(
        `Invocación fallida por ${Math.abs(nivelFracaso)}`,
        `${detalle}. ${consecuenciaFracaso(nivelFracaso).efecto}`,
        true,
      );
    }
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

  // Para el aviso del tope recomendado del Combate Dramático: la media de lo que este
  // personaje sabe hacer en combate.
  const habilidadMedia = Math.round(
    (ficha.combate.HAtaque.valor +
      Math.max(ficha.combate.HParada.valor, ficha.combate.HEsquiva.valor)) /
      2,
  );

  return (
    <div>
      <CombateAlternativo sistema={sistemaCombate} habilidadMedia={habilidadMedia} />

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Recursos</h2>
        {/*
          Los medidores son lo que más se toca en mitad de una partida, y a menudo desde el
          móvil con una mano. Por eso llevan clase propia en lugar de estilos incrustados:
          así el CSS puede reordenarlos —cifra y botones en dos filas anchas en el móvil, en
          columna cuando hay sitio— sin tocar este archivo.
        */}
        <div className="medidores">
          {([
            ['Vida', 'pvActuales', pv, ficha.puntosVida.valor, 'vida'],
            ['Cansancio', 'cansancioActual', cansancio, ficha.cansancio.valor, ''],
            ['Zeón', 'zeonActual', zeon, ficha.zeon.valor, 'zeon'],
            ...(ficha.ki.reserva > 0
              ? ([['Ki', 'kiActual', ki, ficha.ki.reserva, 'ki']] as const)
              : []),
          ] as const).map(([etiqueta, campo, actual, maximo, clase]) => (
            <div key={campo} className={`medidor ${clase}`}>
              <div className="lectura">
                <span className="etiqueta">{etiqueta}</span>
                <span className="cifra">
                  {actual}
                  <span className="maximo"> / {maximo}</span>
                </span>
              </div>
              <div className="pasos">
                {[-10, -5, -1, 1, 5, 10].map((d) => (
                  <button
                    key={d}
                    className="paso"
                    aria-label={`${d > 0 ? 'Subir' : 'Bajar'} ${etiqueta} ${Math.abs(d)}`}
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

      {(personaje.ki?.sellos ?? []).length > 0 && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <h2>Invocación por Ki</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
            Sellos dominados: {(personaje.ki?.sellos ?? []).join(', ')}. Los de refuerzo suman
            +5 (Menor) y +25 (Mayor) al Control.
          </p>
          <div className="campo">
            <label htmlFor="criatura-catalogo">Criatura del catálogo</label>
            <select
              id="criatura-catalogo"
              value={criaturaElegida}
              onChange={(e) => {
                setCriaturaElegida(e.target.value);
                const c = sellosCriatura.find((x) => x.criatura === e.target.value);
                if (c) setNivelCriatura(c.nivel);
              }}
            >
              <option value="">A mano…</option>
              {sellosCriatura.map((c) => (
                <option key={c.criatura} value={c.criatura}>
                  {c.criatura} · nivel {c.nivel} · {c.sellos}
                </option>
              ))}
            </select>
          </div>
          {criaturaFicha && !criaturaFicha.invocable && (
            <p className="aviso">
              {criaturaFicha.criatura} no responde a los Sellos: es «{criaturaFicha.sellos}».
            </p>
          )}
          {criaturaFicha?.invocable && (
            <p style={{ fontSize: '0.9rem', margin: '0 0 10px' }}>
              Pide <strong className="destacado">{criaturaFicha.sellos}</strong> · Gnosis{' '}
              {criaturaFicha.gnosis}
            </p>
          )}

          <div className="rejilla">
            <div className="campo">
              <label htmlFor="nivel-criatura">Nivel de la criatura</label>
              <input
                id="nivel-criatura"
                type="number"
                min={0}
                value={nivelCriatura}
                onChange={(e) => setNivelCriatura(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="campo">
              <label htmlFor="ref-menor">Sellos Menores de refuerzo</label>
              <input
                id="ref-menor"
                type="number"
                min={0}
                value={refuerzoMenor}
                onChange={(e) => setRefuerzoMenor(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="campo">
              <label htmlFor="ref-mayor">Sellos Mayores de refuerzo</label>
              <input
                id="ref-mayor"
                type="number"
                min={0}
                value={refuerzoMayor}
                onChange={(e) => setRefuerzoMayor(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <label className="opcion" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={esPacto} onChange={(e) => setEsPacto(e.target.checked)} />
            <span>
              Invocación inicial (Pacto de Sangre)
              <em>Sube 30 la dificultad y dobla el coste en Ki de los Sellos.</em>
            </span>
          </label>
          <div className="acciones-regla">
            <button className="accion primaria" onClick={invocar}>
              Control de Invocación
            </button>
          </div>
        </section>
      )}

      {/*
        Dos columnas: a la izquierda se tira, a la derecha se ve lo que ha salido. Antes el
        registro estaba al final de la página, así que había que bajar después de cada
        tirada para leer el resultado y volver a subir para tirar otra vez. En el móvil se
        apilan solas.
      */}
      <div className="mesa-columnas">
        <div className="mesa-acciones">
          <section className="panel">
            <h2>Resolver un ataque</h2>
            {ficha.combate.armas.length === 0 ? (
              <p style={{ color: 'var(--texto-tenue)' }}>
                Este personaje no tiene armas equipadas. Añádelas en Editar → Equipo.
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

        <section className="panel registro-panel">
          <div className="titulo-con-accion">
            <h2>Registro de la partida</h2>
            {tiradas.length > 0 && (
              <button className="accion" onClick={() => void vaciarRegistro()}>Vaciar</button>
            )}
          </div>
          {tiradas.length === 0 ? (
            <p style={{ color: 'var(--texto-debil)', margin: 0 }}>Todavía no se ha tirado nada.</p>
          ) : (
            <ol className="registro">
              {tiradas.map((r) => (
                <li key={r.id} className={r.critico ? 'critico' : undefined}>
                  <div className="linea">
                    <strong>{r.texto}</strong>
                    <span className="quien">
                      {/*
                        Quién tiró se ve siempre, también cuando eres tú. Antes sólo salía
                        el nombre de los demás, y en una mesa con tres jugadores tirando a
                        la vez el registro se volvía ilegible: no sabías si esa pifia era
                        tuya o del de al lado.
                      */}
                      {r.autor}
                      {' · '}
                      {new Date(r.actualizadoEn).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="detalle">{r.detalle}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
