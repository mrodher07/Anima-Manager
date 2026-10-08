/**
 * Las casillas de raza que la hoja tiene en su pestaña Personalización: sólo salen para las
 * razas que las usan.
 */
import {
  CERCANIA_DRAGON, EXTASIS_VETALA, TRANSFORMACION_TUAN_DALYR, type OpcionesRaza,
} from '../motor/razas';

interface Props {
  raza: string;
  opciones: OpcionesRaza;
  onCambiar: (o: OpcionesRaza) => void;
}

const nota = { color: 'var(--texto-debil)', fontSize: '0.78rem', margin: '0 0 6px' } as const;

function Marca({ etiqueta, valor, onCambiar }: { etiqueta: string; valor?: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <label style={{ fontSize: '0.86rem', display: 'block', marginBottom: 4 }}>
      <input
        type="checkbox" style={{ width: 'auto', marginRight: 6 }}
        checked={valor ?? false}
        onChange={(e) => onCambiar(e.target.checked)}
      />
      {etiqueta}
    </label>
  );
}

export function tieneOpcionesRaza(raza: string): boolean {
  return ['Vetala', 'Nephilim Vetala', 'Ebudan', 'Tuan Dalyr', 'Turak'].includes(raza);
}

export function OpcionesRazaEditor({ raza, opciones: o, onCambiar }: Props) {
  const cambiar = (c: Partial<OpcionesRaza>) => onCambiar({ ...o, ...c });

  if (raza === 'Vetala' || raza === 'Nephilim Vetala') {
    return (
      <div className="campo">
        <label htmlFor="extasis">Éxtasis sanguíneo</label>
        <select
          id="extasis"
          value={o.extasis ?? ''}
          onChange={(e) => cambiar({ extasis: (e.target.value || undefined) as OpcionesRaza['extasis'] })}
        >
          <option value="">—</option>
          {EXTASIS_VETALA.map((c) => <option key={c} value={c}>+1 {c}</option>)}
        </select>
        <Marca etiqueta="En éxtasis ahora" valor={o.extasisActivo} onCambiar={(v) => cambiar({ extasisActivo: v })} />
        {raza === 'Vetala' && (
          <Marca etiqueta="De noche: +1 FUE y +1 POD" valor={o.nocturno} onCambiar={(v) => cambiar({ nocturno: v })} />
        )}
        <Marca
          etiqueta={`Bien alimentado: Regeneración +${raza === 'Vetala' ? 4 : 1}`}
          valor={o.bienAlimentado}
          onCambiar={(v) => cambiar({ bienAlimentado: v })}
        />
      </div>
    );
  }

  if (raza === 'Ebudan') {
    return (
      <div className="campo">
        <label>Sue'Aman</label>
        <Marca
          etiqueta="Cumplido: ajuste de nivel 3, +2 POD y +2 VOL"
          valor={o.sueAman}
          onCambiar={(v) => cambiar({ sueAman: v, trascendido: v ? o.trascendido : false })}
        />
        {o.sueAman && (
          <Marca etiqueta="Trascendido: Natura 30" valor={o.trascendido} onCambiar={(v) => cambiar({ trascendido: v })} />
        )}
      </div>
    );
  }

  if (raza === 'Tuan Dalyr') {
    return (
      <div className="campo">
        <label htmlFor="fase">Fase lunar</label>
        <select
          id="fase"
          value={o.faseLunar ?? 'Neutra'}
          onChange={(e) => cambiar({ faseLunar: e.target.value as OpcionesRaza['faseLunar'] })}
        >
          <option>Afín</option><option>Neutra</option><option>Opuesta</option>
        </select>
        <Marca etiqueta="Transformado" valor={o.transformado} onCambiar={(v) => cambiar({ transformado: v })} />
        {o.transformado && (
          <>
            <p style={nota}>Bonos de transformación: hasta 3 puntos en total; la fase afín da uno más a cada uno.</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TRANSFORMACION_TUAN_DALYR.map((c) => (
                <select
                  key={c}
                  aria-label={`Transformación ${c}`}
                  value={o.transformacion?.[c] ?? 0}
                  onChange={(e) =>
                    cambiar({ transformacion: { ...o.transformacion, [c]: Number(e.target.value) || undefined } })
                  }
                  style={{ width: 'auto' }}
                >
                  <option value={0}>{c} —</option>
                  <option value={1}>+1 {c}</option>
                  <option value={2}>+2 {c}</option>
                </select>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (raza === 'Turak') {
    const rasgos = o.cercaniaDragon ?? [];
    return (
      <div className="campo">
        <label>Cercanía con El Dragón</label>
        <p style={nota}>Hasta tres rasgos. Con más de uno, el ajuste de nivel pasa a 2.</p>
        {CERCANIA_DRAGON.map((r) => (
          <Marca
            key={r}
            etiqueta={r}
            valor={rasgos.includes(r)}
            onCambiar={(v) =>
              cambiar({ cercaniaDragon: v ? [...rasgos, r].slice(0, 3) : rasgos.filter((x) => x !== r) })
            }
          />
        ))}
      </div>
    );
  }
  return null;
}
