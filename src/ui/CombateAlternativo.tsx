import { useState } from 'react';
import {
  NEUTRALIZAN_LA_DURACION,
  bonoPorCantidad,
  componentesRestantes,
  construirMasa,
  duracionAsalto,
  duracionLegible,
  efectoSobreMasa,
  multiplicadorDano,
  topeRecomendado,
  type SistemaCombate,
} from '../motor/combateAlternativo';

function Cuenta({ titulo, valor, sufijo }: { titulo: string; valor: string | number; sufijo?: string }) {
  return (
    <div className="recurso">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {sufijo && <span className="sufijo">{sufijo}</span>}
    </div>
  );
}

/**
 * Contador de asaltos del Combate Dramático.
 *
 * No hay nada que calcular salvo la duración; el resto del combate va con las reglas de
 * siempre. Por eso esto es un contador y no otra pantalla de combate.
 */
export function ContadorDramatico({ habilidadMedia }: { habilidadMedia?: number }) {
  const [asalto, setAsalto] = useState(1);
  const duracion = duracionAsalto(asalto);
  const tope = habilidadMedia ? topeRecomendado(habilidadMedia) : null;
  const pasado = tope ? duracion > tope.segundos : false;

  // Cuánto tiempo lleva el combate contando todos los asaltos anteriores.
  let acumulado = 0;
  for (let i = 1; i <= asalto; i++) acumulado += duracionAsalto(i);

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>Combate Dramático</h2>
      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
        Todo se juega igual que siempre: cada ataque y cada defensa representan una larga
        cadena de golpes en un escenario amplio. Lo único que cambia es <strong>cuánto dura
        cada asalto</strong>.
      </p>

      <div className="recursos tira">
        <Cuenta titulo="Asalto" valor={asalto} />
        <Cuenta
          titulo="Duración"
          valor={duracionLegible(duracion)}
          sufijo={asalto === 1 ? 'la toma de contacto' : asalto >= 5 ? 'ya no sube más' : 'se dobla cada asalto'}
        />
        <Cuenta titulo="Lleva luchando" valor={duracionLegible(acumulado)} sufijo="en total" />
      </div>

      <div className="acciones-regla">
        <button className="accion primaria" onClick={() => setAsalto((n) => n + 1)}>
          Asalto siguiente
        </button>
        <button className="accion" onClick={() => setAsalto((n) => Math.max(n - 1, 1))}>
          Atrás
        </button>
        <button className="accion" onClick={() => setAsalto(1)}>
          Reiniciar
        </button>
      </div>

      {pasado && tope && <p className="aviso">{tope.aviso}</p>}
      <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
        {NEUTRALIZAN_LA_DURACION}
      </p>
    </section>
  );
}

/**
 * Combate de Masas. Está siempre disponible: no depende del sistema que use la campaña,
 * porque es una herramienta para resolver una escena concreta, no una forma de jugar.
 */
export function CalculadoraMasas() {
  const [cantidad, setCantidad] = useState(20);
  const [puntosVida, setPuntosVida] = useState(140);
  const [ataque, setAtaque] = useState(100);
  const [defensa, setDefensa] = useState(90);
  const [dano, setDano] = useState(50);
  const [TA, setTA] = useState(2);
  const [iniciativa, setIniciativa] = useState(50);
  const [acumulacion, setAcumulacion] = useState(false);
  const [sobrenatural, setSobrenatural] = useState(false);
  const [adversarios, setAdversarios] = useState(1);

  const [pvActuales, setPvActuales] = useState<number | null>(null);
  const [alcanzados, setAlcanzados] = useState(5);
  const [danoArea, setDanoArea] = useState(60);
  const [margen, setMargen] = useState(0);

  const masa = construirMasa(
    { cantidad, puntosVida, ataque, defensa, dano, TA, iniciativa, acumulacion, sobrenatural },
    adversarios,
  );
  const pv = pvActuales ?? masa.puntosVida;
  const quedan = componentesRestantes(masa, pv);
  const multiplicador = multiplicadorDano(alcanzados, masa.cantidad);
  const efecto = efectoSobreMasa(margen);

  const num = (v: string) => Number(v) || 0;

  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Combate de Masas</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Un ejército entero se convierte en <strong>un solo contrincante</strong> con
          acumulación de daño. Rellena los valores de <em>uno</em> de sus componentes y
          cuántos son.
        </p>

        <div className="rejilla">
          <div className="campo">
            <label htmlFor="masa-cantidad">Cuántos enemigos</label>
            <input id="masa-cantidad" type="number" min={0} value={cantidad}
              onChange={(e) => { setCantidad(num(e.target.value)); setPvActuales(null); }} />
          </div>
          <div className="campo">
            <label htmlFor="masa-pv">PV de cada uno</label>
            <input id="masa-pv" type="number" min={0} value={puntosVida}
              onChange={(e) => { setPuntosVida(num(e.target.value)); setPvActuales(null); }} />
          </div>
          <div className="campo">
            <label htmlFor="masa-ataque">Ataque medio</label>
            <input id="masa-ataque" type="number" value={ataque}
              onChange={(e) => setAtaque(num(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="masa-defensa">Defensa media</label>
            <input id="masa-defensa" type="number" value={defensa}
              onChange={(e) => setDefensa(num(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="masa-dano">Daño base medio</label>
            <input id="masa-dano" type="number" value={dano}
              onChange={(e) => setDano(num(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="masa-ta">TA medio</label>
            <input id="masa-ta" type="number" min={0} value={TA}
              onChange={(e) => setTA(num(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="masa-ini">Iniciativa media</label>
            <input id="masa-ini" type="number" value={iniciativa}
              onChange={(e) => setIniciativa(num(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="masa-adversarios">Contra cuántos personajes</label>
            <input id="masa-adversarios" type="number" min={1} value={adversarios}
              onChange={(e) => setAdversarios(Math.max(num(e.target.value), 1))} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2, marginBottom: 10 }}>
          <label className="opcion">
            <input type="checkbox" checked={acumulacion}
              onChange={() => { setAcumulacion((v) => !v); setPvActuales(null); }} />
            <span>
              Sus componentes ya tienen acumulación de daño{' '}
              <span style={{ color: 'var(--texto-debil)' }}>(el aguante se calcula distinto)</span>
            </span>
          </label>
          <label className="opcion">
            <input type="checkbox" checked={sobrenatural}
              onChange={() => setSobrenatural((v) => !v)} />
            <span>
              Atacan con conjuros o poderes sobrenaturales{' '}
              <span style={{ color: 'var(--texto-debil)' }}>(doblan el daño en vez de +50 %)</span>
            </span>
          </label>
        </div>

        <div className="recursos tira">
          <Cuenta titulo="Aguante" valor={masa.puntosVida} sufijo={`${masa.porComponente} por cabeza`} />
          <Cuenta titulo="Ataque" valor={masa.ataque} sufijo={`${ataque} medio +${masa.bonoAtaque} por número`} />
          <Cuenta titulo="Defensa Final" valor={masa.defensa} sufijo="no tira" />
          <Cuenta titulo="Daño" valor={masa.dano} sufijo={sobrenatural ? 'doblado' : '+50 %'} />
          <Cuenta titulo="TA" valor={masa.TA} />
          <Cuenta titulo="Iniciativa" valor={masa.iniciativa} />
        </div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--texto-tenue)', fontSize: '0.85rem' }}>
          {masa.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Cómo va la masa</h3>
        <div className="rejilla">
          <div className="campo">
            <label htmlFor="masa-pvactual">Aguante que le queda</label>
            <input id="masa-pvactual" type="number" min={0} value={pv}
              onChange={(e) => setPvActuales(num(e.target.value))} />
          </div>
        </div>
        <div className="recursos tira">
          <Cuenta titulo="Siguen en pie" valor={quedan} sufijo={`de ${masa.cantidad}`} />
          <Cuenta titulo="Han caído" valor={Math.max(masa.cantidad - quedan, 0)} />
          <Cuenta
            titulo="Bono ahora"
            valor={`+${bonoPorCantidad(Math.floor(quedan / Math.max(adversarios, 1)))}`}
            sufijo="a su ataque"
          />
        </div>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
          Conforme cae gente el bono de la Tabla 1 baja, así que una masa se debilita sola.
        </p>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Atacar en área</h3>
        <div className="rejilla">
          <div className="campo">
            <label htmlFor="masa-alcanzados">A cuántos alcanza</label>
            <input id="masa-alcanzados" type="number" min={1} value={alcanzados}
              onChange={(e) => setAlcanzados(Math.max(num(e.target.value), 1))} />
          </div>
          <div className="campo">
            <label htmlFor="masa-danoarea">Daño base del ataque</label>
            <input id="masa-danoarea" type="number" min={0} value={danoArea}
              onChange={(e) => setDanoArea(num(e.target.value))} />
          </div>
        </div>
        <div className="recursos tira">
          <Cuenta titulo="Multiplicador" valor={`×${multiplicador}`} />
          <Cuenta titulo="Daño final" valor={danoArea * multiplicador} />
        </div>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
          Contra enemigos de tamaño humano, un arma Pequeña alcanza a dos o tres, una Media a
          tres o cuatro y una Grande a unos cinco. Un conjuro alcanza entre 5 y 10 por cada 10
          metros de radio, si no están en formación cerrada. El multiplicador nunca puede
          pasar de lo que permite el tamaño de la masa.
        </p>
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Un efecto de área sobre la masa</h3>
        <div className="rejilla">
          <div className="campo">
            <label htmlFor="masa-margen">Por cuánto supera la Resistencia media</label>
            <input id="masa-margen" type="number" value={margen}
              onChange={(e) => setMargen(num(e.target.value))} />
          </div>
        </div>
        <p style={{ margin: '4px 0' }}>
          <strong>{efecto.resultado}</strong>
        </p>
        <p style={{ margin: '2px 0' }}>
          <strong>Negativos:</strong> {efecto.negativos}
        </p>
        <p style={{ margin: '2px 0' }}>
          <strong>Otros efectos:</strong> {efecto.otrosEfectos}
        </p>
        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
          Un poder que sólo afecte a un individuo no le hace nada a una masa: hacen falta
          efectos que cubran terreno. Negativo si falla la Resistencia, positivo si la supera.
        </p>
      </section>
    </>
  );
}

export function CombateAlternativo({
  sistema,
  habilidadMedia,
}: {
  sistema: SistemaCombate;
  habilidadMedia?: number;
}) {
  const [abierto, setAbierto] = useState<'ninguno' | 'masas'>('ninguno');

  return (
    <>
      {sistema === 'dramatico' && <ContadorDramatico habilidadMedia={habilidadMedia} />}

      <div className="acciones-regla" style={{ marginBottom: 16 }}>
        <button
          className={`accion${abierto === 'masas' ? ' primaria' : ''}`}
          onClick={() => setAbierto((a) => (a === 'masas' ? 'ninguno' : 'masas'))}
        >
          {abierto === 'masas' ? 'Cerrar Combate de Masas' : 'Combate de Masas'}
        </button>
      </div>

      {abierto === 'masas' && <CalculadoraMasas />}
    </>
  );
}
