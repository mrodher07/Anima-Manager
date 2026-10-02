import { useRef, useState } from 'react';
import { PERSONALIZADOS_VACIOS, cuentaPersonalizados, type Personalizados } from '../datos/paquetes';
import { ESQUEMAS, type Campo, type EsquemaColeccion } from '../datos/esquemas';
import type { NombreColeccion } from '../datos/tipos';
import { ErrorImagen, guardarImagen } from '../almacen/imagenes';
import { Imagen } from './Imagen';

interface Props {
  personalizados: Personalizados;
  onCambiar: (p: Personalizados) => void;
  /** La campaña dueña: las imágenes que se suban aquí son suyas, y así la mesa las ve. */
  campanaId?: string | null;
}

/**
 * Una imagen propia, subida desde aquí mismo.
 *
 * Se guarda en la Galería como «objeto» y **con la campaña puesta**: es lo que permite que
 * los jugadores la vean en el mapa, porque las políticas de la nube dejan a la mesa ver
 * las imágenes de su campaña y nada más. Quitarla no la borra de la Galería: puede estar
 * usada en un mapa.
 */
function EditorImagen({
  id, valor, onCambiar, etiqueta, nombre, campanaId,
}: {
  id: string;
  valor: unknown;
  onCambiar: (v: unknown) => void;
  etiqueta: React.ReactNode;
  nombre: string;
  campanaId: string | null;
}) {
  const archivo = useRef<HTMLInputElement>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const actual = typeof valor === 'string' && valor ? valor : null;
  return (
    <div className="campo editor-imagen">
      {etiqueta}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {actual && <Imagen id={actual} alt={nombre} className="miniatura-propia" />}
        <button id={id} type="button" className="accion" onClick={() => archivo.current?.click()}>
          {actual ? 'Cambiar imagen' : 'Subir imagen'}
        </button>
        {actual && (
          <button type="button" className="accion" onClick={() => onCambiar(null)}>
            Quitar
          </button>
        )}
      </div>
      {fallo && <small style={{ color: 'var(--peligro, #c33)' }}>{fallo}</small>}
      <input
        ref={archivo}
        type="file"
        accept="image/*"
        aria-label={`Archivo de imagen para ${nombre || 'esta entrada'}`}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const img = await guardarImagen(f, { tipo: 'objeto', nombre: nombre || f.name, campanaId });
            setFallo(null);
            onCambiar(img.id);
          } catch (err) {
            setFallo(err instanceof ErrorImagen ? err.message : 'No se ha podido subir la imagen.');
          }
        }}
      />
    </div>
  );
}

type Par = { nombre: string; valor: string };

/** Características con el nombre que la mesa quiera. Una fila por cada una. */
function EditorLista({
  id, valor, onCambiar, etiqueta, pista,
}: {
  id: string;
  valor: unknown;
  onCambiar: (v: unknown) => void;
  etiqueta: React.ReactNode;
  pista?: string;
}) {
  const filas: Par[] = Array.isArray(valor) ? (valor as Par[]) : [];
  const cambiar = (i: number, cambio: Partial<Par>) =>
    onCambiar(filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  return (
    <div className="campo editor-lista">
      {etiqueta}
      {filas.map((f, i) => (
        <div key={i} className="par">
          <input
            aria-label={`Característica ${i + 1}`}
            placeholder={i === 0 ? pista?.split('…')[0].split(',')[0] : 'Nombre'}
            value={f.nombre}
            onChange={(e) => cambiar(i, { nombre: e.target.value })}
          />
          <input
            aria-label={`Valor de la característica ${i + 1}`}
            placeholder="Valor"
            value={f.valor}
            onChange={(e) => cambiar(i, { valor: e.target.value })}
          />
          <button type="button" className="accion" onClick={() => onCambiar(filas.filter((_, j) => j !== i))}>
            Quitar
          </button>
        </div>
      ))}
      <button id={id} type="button" className="accion" onClick={() => onCambiar([...filas, { nombre: '', valor: '' }])}>
        Añadir característica
      </button>
    </div>
  );
}

type Entrada = Record<string, unknown>;

function EditorCampo({
  campo, valor, onCambiar, id, nombre = '', campanaId = null,
}: {
  campo: Campo;
  valor: unknown;
  onCambiar: (v: unknown) => void;
  id: string;
  /** El nombre de la entrada, para ponérselo a la imagen que se suba. */
  nombre?: string;
  campanaId?: string | null;
}) {
  const etiqueta = (
    <label htmlFor={id} style={{ display: 'block', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--texto-debil)' }}>
      {campo.etiqueta}
    </label>
  );

  if (campo.tipo === 'imagen') {
    return (
      <EditorImagen id={id} valor={valor} onCambiar={onCambiar} etiqueta={etiqueta} nombre={nombre} campanaId={campanaId} />
    );
  }

  if (campo.tipo === 'lista') {
    return <EditorLista id={id} valor={valor} onCambiar={onCambiar} etiqueta={etiqueta} pista={campo.pista} />;
  }

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
  esquema, entrada, indice, onCambiar, onBorrar, campanaId,
}: {
  esquema: EsquemaColeccion;
  entrada: Entrada;
  indice: number;
  onCambiar: (e: Entrada) => void;
  onBorrar: () => void;
  campanaId: string | null;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const sueltos = esquema.campos.filter((c) => !c.grupo);
  const grupos = [...new Set(esquema.campos.filter((c) => c.grupo).map((c) => c.grupo!))];
  const id = (clave: string) => `${esquema.coleccion}-${indice}-${clave}`;
  const set = (clave: string, valor: unknown) => onCambiar({ ...entrada, [clave]: valor });

  const nombre = String(entrada[esquema.clave] ?? '');
  // Los campos que ocupan una fila entera van aparte, debajo de los cortos.
  const ancho = (c: Campo) => c.tipo === 'parrafo' || c.tipo === 'lista' || c.tipo === 'imagen';

  return (
    <article className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>
        {nombre || <span style={{ color: 'var(--texto-debil)' }}>Sin nombre</span>}
      </h3>

      <div className="rejilla">
        {sueltos
          .filter((c) => !ancho(c))
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
        .filter(ancho)
        .map((c) => (
          <EditorCampo
            key={c.clave}
            campo={c}
            id={id(c.clave)}
            valor={entrada[c.clave]}
            onCambiar={(v) => set(c.clave, v)}
            nombre={nombre}
            campanaId={campanaId}
          />
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

export function VistaPersonalizado({ personalizados, onCambiar, campanaId = null }: Props) {
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
          campanaId={campanaId}
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
