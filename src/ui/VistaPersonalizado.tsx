import { useState } from 'react';
import { PERSONALIZADOS_VACIOS, cuentaPersonalizados, type Personalizados } from '../datos/paquetes';
import { ESQUEMAS, type Campo, type EsquemaColeccion } from '../datos/esquemas';
import type { NombreColeccion } from '../datos/tipos';

interface Props {
  personalizados: Personalizados;
  onCambiar: (p: Personalizados) => void;
}

type Entrada = Record<string, unknown>;

function EditorCampo({
  campo, valor, onCambiar, id,
}: { campo: Campo; valor: unknown; onCambiar: (v: unknown) => void; id: string }) {
  const etiqueta = (
    <label htmlFor={id} style={{ display: 'block', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--texto-debil)' }}>
      {campo.etiqueta}
    </label>
  );

  if (campo.tipo === 'numero') {
    return (
      <div style={{ display: 'inline-block', marginRight: 8, marginBottom: 6 }}>
        {etiqueta}
        <input
          id={id}
          type="number"
          style={{ width: campo.ancho ?? 70 }}
          value={typeof valor === 'number' ? valor : 0}
          onChange={(e) => onCambiar(Number(e.target.value) || 0)}
        />
      </div>
    );
  }

  if (campo.tipo === 'opcion') {
    return (
      <div className="campo">
        {etiqueta}
        <select id={id} value={String(valor ?? '')} onChange={(e) => onCambiar(e.target.value)}>
          <option value="">—</option>
          {campo.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (campo.tipo === 'parrafo') {
    return (
      <div className="campo">
        {etiqueta}
        <textarea
          id={id}
          rows={2}
          value={String(valor ?? '')}
          placeholder={campo.pista}
          onChange={(e) => onCambiar(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="campo">
      {etiqueta}
      <input
        id={id}
        value={String(valor ?? '')}
        placeholder={campo.pista}
        onChange={(e) => onCambiar(e.target.value)}
      />
    </div>
  );
}

function EditorEntrada({
  esquema, entrada, indice, onCambiar, onBorrar,
}: {
  esquema: EsquemaColeccion;
  entrada: Entrada;
  indice: number;
  onCambiar: (e: Entrada) => void;
  onBorrar: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const sueltos = esquema.campos.filter((c) => !c.grupo);
  const grupos = [...new Set(esquema.campos.filter((c) => c.grupo).map((c) => c.grupo!))];
  const id = (clave: string) => `${esquema.coleccion}-${indice}-${clave}`;
  const set = (clave: string, valor: unknown) => onCambiar({ ...entrada, [clave]: valor });

  const nombre = String(entrada[esquema.clave] ?? '');

  return (
    <article className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>
        {nombre || <span style={{ color: 'var(--texto-debil)' }}>Sin nombre</span>}
      </h3>

      <div className="rejilla">
        {sueltos
          .filter((c) => c.tipo !== 'parrafo')
          .map((c) => (
            <EditorCampo key={c.clave} campo={c} id={id(c.clave)} valor={entrada[c.clave]} onCambiar={(v) => set(c.clave, v)} />
          ))}
      </div>

      {grupos.map((g) => (
        <div key={g} style={{ marginBottom: 8 }}>
          <p style={{ fontSize: '0.66rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oro)', margin: '8px 0 4px' }}>
            {g}
          </p>
          {esquema.campos
            .filter((c) => c.grupo === g)
            .map((c) => (
              <EditorCampo key={c.clave} campo={c} id={id(c.clave)} valor={entrada[c.clave]} onCambiar={(v) => set(c.clave, v)} />
            ))}
        </div>
      ))}

      {sueltos
        .filter((c) => c.tipo === 'parrafo')
        .map((c) => (
          <EditorCampo key={c.clave} campo={c} id={id(c.clave)} valor={entrada[c.clave]} onCambiar={(v) => set(c.clave, v)} />
        ))}

      <div className="acciones-regla">
        {confirmar ? (
          <>
            <button className="accion peligro" onClick={onBorrar}>Confirmar borrado</button>
            <button className="accion" onClick={() => setConfirmar(false)}>Cancelar</button>
          </>
        ) : (
          <button className="accion" onClick={() => setConfirmar(true)}>Borrar</button>
        )}
      </div>
    </article>
  );
}

export function VistaPersonalizado({ personalizados, onCambiar }: Props) {
  const [coleccion, setColeccion] = useState<NombreColeccion>('razas');
  const propio: Personalizados = { ...PERSONALIZADOS_VACIOS, ...personalizados };
  const esquema = ESQUEMAS.find((e) => e.coleccion === coleccion)!;
  const entradas = (propio[coleccion] ?? []) as unknown as Entrada[];

  const guardar = (nuevas: Entrada[]) =>
    onCambiar({ ...propio, [coleccion]: nuevas as never });

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Contenido propio</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Todo lo que tu mesa se invente. En el Excel esto ocupa una hoja entera de
          personalización, y las razas se añaden editando la tabla oculta. Aquí vive dentro
          de la campaña y se exporta con ella. Si repites el nombre de una entrada oficial,
          la tuya la sustituye.
        </p>

        <div className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor="coleccion">Qué quieres crear</label>
          <select
            id="coleccion"
            value={coleccion}
            onChange={(e) => setColeccion(e.target.value as NombreColeccion)}
          >
            {ESQUEMAS.map((e) => {
              const n = (propio[e.coleccion] ?? []).length;
              return (
                <option key={e.coleccion} value={e.coleccion}>
                  {e.plural}{n > 0 ? ` (${n})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {cuentaPersonalizados(propio) > 0 && (
          <p style={{ color: 'var(--texto-debil)', fontSize: '0.82rem', margin: '10px 0 0' }}>
            {cuentaPersonalizados(propio)} entradas propias en esta campaña.
          </p>
        )}
      </section>

      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem' }}>{esquema.ayuda}</p>

      {entradas.map((entrada, i) => (
        <EditorEntrada
          key={i}
          esquema={esquema}
          entrada={entrada}
          indice={i}
          onCambiar={(e) => guardar(entradas.map((x, j) => (j === i ? e : x)))}
          onBorrar={() => guardar(entradas.filter((_, j) => j !== i))}
        />
      ))}

      <button
        className="accion primaria"
        onClick={() => guardar([...entradas, { [esquema.clave]: '' }])}
      >
        Añadir {esquema.singular}
      </button>
    </div>
  );
}
