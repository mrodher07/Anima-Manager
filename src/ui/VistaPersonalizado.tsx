import { useState } from 'react';
import { PERSONALIZADOS_VACIOS, type Personalizados } from '../datos/paquetes';
import { CARACTERISTICAS, RESISTENCIAS } from '../motor/personaje';
import { TIPOS_DANO } from '../motor/combate';
import type { Arma, Armadura, Raza } from '../datos/tipos';

interface Props {
  personalizados: Personalizados;
  onCambiar: (p: Personalizados) => void;
}

type Seccion = 'razas' | 'armas' | 'armaduras';

const SECCIONES: { id: Seccion; texto: string; ayuda: string }[] = [
  {
    id: 'razas',
    texto: 'Razas',
    ayuda:
      'Razas que no vienen en ningún manual. Los modificadores funcionan igual que los de ' +
      'las oficiales, y si repites el nombre de una oficial la sustituyes.',
  },
  {
    id: 'armas',
    texto: 'Armas',
    ayuda: 'Los huecos «Arma #1, #2, #3» de la ficha original, sin límite de número.',
  },
  { id: 'armaduras', texto: 'Armaduras', ayuda: 'Protecciones propias, con su TA por tipo de daño.' },
];

function CampoNum({
  etiqueta, valor, onCambiar, ancho = 66,
}: { etiqueta: string; valor: number | undefined; onCambiar: (v: number) => void; ancho?: number }) {
  return (
    <label style={{ display: 'inline-block', marginRight: 8, marginBottom: 6 }}>
      <span style={{ display: 'block', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--texto-debil)' }}>
        {etiqueta}
      </span>
      <input
        type="number"
        style={{ width: ancho }}
        value={valor ?? 0}
        aria-label={etiqueta}
        onChange={(e) => onCambiar(Number(e.target.value) || 0)}
      />
    </label>
  );
}

export function VistaPersonalizado({ personalizados, onCambiar }: Props) {
  const [seccion, setSeccion] = useState<Seccion>('razas');
  const propio = { ...PERSONALIZADOS_VACIOS, ...personalizados };

  const set = <K extends keyof Personalizados>(clave: K, valor: Personalizados[K]) =>
    onCambiar({ ...propio, [clave]: valor });

  const actual = SECCIONES.find((s) => s.id === seccion)!;

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Contenido propio</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Lo que tu mesa se inventa. En el Excel esto se hace editando a mano la hoja oculta
          de tablas; aquí lo tienes como parte de la campaña, y se exporta con ella.
        </p>
        <nav className="pestanas" style={{ marginBottom: 0 }}>
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              aria-current={seccion === s.id ? 'page' : undefined}
            >
              {s.texto} ({propio[s.id].length})
            </button>
          ))}
        </nav>
      </section>

      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem' }}>{actual.ayuda}</p>

      {seccion === 'razas' && (
        <>
          {propio.razas.map((r, i) => {
            const cambiar = (cambios: Partial<Raza>) =>
              set('razas', propio.razas.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
            return (
              <article className="panel" key={i} style={{ marginBottom: 12 }}>
                <div className="campo">
                  <label htmlFor={`raza-${i}`}>Nombre</label>
                  <input
                    id={`raza-${i}`}
                    value={r.raza}
                    placeholder="Moguri, Bangaa, Viera…"
                    onChange={(e) => cambiar({ raza: e.target.value })}
                  />
                </div>
                <div>
                  {CARACTERISTICAS.map((c) => (
                    <CampoNum key={c} etiqueta={c} valor={r[c]} onCambiar={(v) => cambiar({ [c]: v })} />
                  ))}
                </div>
                <div>
                  {RESISTENCIAS.map((res) => (
                    <CampoNum key={res} etiqueta={res} valor={r[res]} onCambiar={(v) => cambiar({ [res]: v })} />
                  ))}
                </div>
                <div>
                  <CampoNum etiqueta="Tamaño" valor={r.tamano} onCambiar={(v) => cambiar({ tamano: v })} />
                  <CampoNum etiqueta="Regen." valor={r.regeneracion} onCambiar={(v) => cambiar({ regeneracion: v })} />
                  <CampoNum etiqueta="Cansancio" valor={r.cansancio} onCambiar={(v) => cambiar({ cansancio: v })} />
                  <CampoNum etiqueta="Ajuste nivel" valor={r.ajusteNivel} onCambiar={(v) => cambiar({ ajusteNivel: v })} ancho={78} />
                </div>
                <div className="campo">
                  <label htmlFor={`razadesc-${i}`}>Capacidades raciales</label>
                  <textarea
                    id={`razadesc-${i}`}
                    rows={2}
                    value={r.descripciones ?? ''}
                    placeholder="Se muestran como recordatorio; no modifican números."
                    onChange={(e) => cambiar({ descripciones: e.target.value })}
                  />
                </div>
                <button
                  className="accion peligro"
                  onClick={() => set('razas', propio.razas.filter((_, j) => j !== i))}
                >
                  Borrar raza
                </button>
              </article>
            );
          })}
          <button
            className="accion primaria"
            onClick={() => set('razas', [...propio.razas, { raza: '' }])}
          >
            Añadir raza
          </button>
        </>
      )}

      {seccion === 'armas' && (
        <>
          {propio.armas.map((a, i) => {
            const cambiar = (cambios: Partial<Arma>) =>
              set('armas', propio.armas.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
            return (
              <article className="panel" key={i} style={{ marginBottom: 12 }}>
                <div className="campo">
                  <label htmlFor={`arma-${i}`}>Nombre</label>
                  <input id={`arma-${i}`} value={a.arma} onChange={(e) => cambiar({ arma: e.target.value })} />
                </div>
                <div>
                  <CampoNum etiqueta="Daño" valor={a.dano} onCambiar={(v) => cambiar({ dano: v })} />
                  <CampoNum etiqueta="Turno" valor={a.turno} onCambiar={(v) => cambiar({ turno: v })} />
                  <CampoNum etiqueta="FUE 1M" valor={a.fueRequerida} onCambiar={(v) => cambiar({ fueRequerida: v })} />
                  <CampoNum etiqueta="FUE 2M" valor={a.fueReq2M} onCambiar={(v) => cambiar({ fueReq2M: v })} />
                  <CampoNum etiqueta="Entereza" valor={a.entereza} onCambiar={(v) => cambiar({ entereza: v })} />
                  <CampoNum etiqueta="Rotura" valor={a.rotura} onCambiar={(v) => cambiar({ rotura: v })} />
                  <CampoNum etiqueta="Presencia" valor={a.presencia} onCambiar={(v) => cambiar({ presencia: v })} />
                  <CampoNum etiqueta="Bon. Parada" valor={a.bonusParada} onCambiar={(v) => cambiar({ bonusParada: v })} ancho={78} />
                </div>
                <div className="rejilla">
                  <div className="campo">
                    <label htmlFor={`crit1-${i}`}>Crítico 1</label>
                    <select id={`crit1-${i}`} value={a.critico1 ?? '-'} onChange={(e) => cambiar({ critico1: e.target.value })}>
                      <option value="-">—</option>
                      {TIPOS_DANO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor={`crit2-${i}`}>Crítico 2</label>
                    <select id={`crit2-${i}`} value={a.critico2 ?? '-'} onChange={(e) => cambiar({ critico2: e.target.value })}>
                      <option value="-">—</option>
                      {TIPOS_DANO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor={`tipoarma-${i}`}>Tipo de arma</label>
                    <input id={`tipoarma-${i}`} value={a.tipoArma ?? ''} placeholder="Espada/Corta" onChange={(e) => cambiar({ tipoArma: e.target.value })} />
                  </div>
                  <div className="campo">
                    <label htmlFor={`especialarma-${i}`}>Especial</label>
                    <input id={`especialarma-${i}`} value={a.especial ?? ''} onChange={(e) => cambiar({ especial: e.target.value })} />
                  </div>
                </div>
                <button
                  className="accion peligro"
                  onClick={() => set('armas', propio.armas.filter((_, j) => j !== i))}
                >
                  Borrar arma
                </button>
              </article>
            );
          })}
          <button
            className="accion primaria"
            onClick={() => set('armas', [...propio.armas, { arma: '' }])}
          >
            Añadir arma
          </button>
        </>
      )}

      {seccion === 'armaduras' && (
        <>
          {propio.armaduras.map((a, i) => {
            const cambiar = (cambios: Partial<Armadura>) =>
              set('armaduras', propio.armaduras.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
            return (
              <article className="panel" key={i} style={{ marginBottom: 12 }}>
                <div className="campo">
                  <label htmlFor={`armadura-${i}`}>Nombre</label>
                  <input id={`armadura-${i}`} value={a.armadura} onChange={(e) => cambiar({ armadura: e.target.value })} />
                </div>
                <div>
                  <CampoNum etiqueta="Requerim." valor={a.requerimiento} onCambiar={(v) => cambiar({ requerimiento: v })} ancho={78} />
                  <CampoNum etiqueta="Pen. Nat." valor={a.penNatural} onCambiar={(v) => cambiar({ penNatural: v })} />
                  <CampoNum etiqueta="Rest. Mov." valor={a.restMovimiento} onCambiar={(v) => cambiar({ restMovimiento: v })} />
                  <CampoNum etiqueta="Entereza" valor={a.entereza} onCambiar={(v) => cambiar({ entereza: v })} />
                  <CampoNum etiqueta="Presencia" valor={a.presencia} onCambiar={(v) => cambiar({ presencia: v })} />
                </div>
                <div>
                  {TIPOS_DANO.map((t) => (
                    <CampoNum key={t} etiqueta={t} valor={a[t]} onCambiar={(v) => cambiar({ [t]: v })} ancho={56} />
                  ))}
                </div>
                <div className="rejilla">
                  <div className="campo">
                    <label htmlFor={`loc-${i}`}>Localización</label>
                    <input id={`loc-${i}`} value={a.localizacion ?? ''} placeholder="Completa, Camisola, Cabeza…" onChange={(e) => cambiar({ localizacion: e.target.value })} />
                  </div>
                  <div className="campo">
                    <label htmlFor={`clase-${i}`}>Clase</label>
                    <select id={`clase-${i}`} value={a.clase ?? ''} onChange={(e) => cambiar({ clase: e.target.value })}>
                      <option value="">—</option>
                      <option>Blanda</option>
                      <option>Dura</option>
                      <option>Natural</option>
                    </select>
                  </div>
                </div>
                <button
                  className="accion peligro"
                  onClick={() => set('armaduras', propio.armaduras.filter((_, j) => j !== i))}
                >
                  Borrar armadura
                </button>
              </article>
            );
          })}
          <button
            className="accion primaria"
            onClick={() => set('armaduras', [...propio.armaduras, { armadura: '' }])}
          >
            Añadir armadura
          </button>
        </>
      )}
    </div>
  );
}
