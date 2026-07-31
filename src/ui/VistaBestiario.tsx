import { useCallback, useEffect, useRef, useState } from 'react';
import { almacen, enemigoVacio, type Enemigo } from '../almacen/almacen';
import { TIPOS_DANO, type TipoDano } from '../motor/combate';
import { ErrorImagen, borrarImagen, guardarImagen } from '../almacen/imagenes';
import { Imagen } from './Imagen';
import { nuevoId } from './estado';

export function useEnemigos(campanaId: string | null) {
  const [enemigos, setEnemigos] = useState<Enemigo[]>([]);

  const recargar = useCallback(async () => {
    setEnemigos(await almacen.listarEnemigos(campanaId));
  }, [campanaId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const guardar = useCallback(async (e: Enemigo) => {
    setEnemigos((antes) => antes.map((x) => (x.id === e.id ? e : x)));
    await almacen.guardarEnemigo(e);
  }, []);

  const crear = useCallback(async () => {
    const e = enemigoVacio(nuevoId(), campanaId);
    await almacen.guardarEnemigo(e);
    await recargar();
    return e;
  }, [campanaId, recargar]);

  const borrar = useCallback(async (id: string) => {
    await almacen.borrarEnemigo(id);
    await recargar();
  }, [recargar]);

  return { enemigos, guardar, crear, borrar, recargar };
}

function FichaEnemigo({
  enemigo,
  onCambiar,
  onBorrar,
}: {
  enemigo: Enemigo;
  onCambiar: (e: Enemigo) => void;
  onBorrar: () => void;
}) {
  const archivo = useRef<HTMLInputElement>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const set = (cambios: Partial<Enemigo>) => onCambiar({ ...enemigo, ...cambios });
  const id = (campo: string) => `enemigo-${enemigo.id}-${campo}`;
  const num = (campo: keyof Enemigo) => (v: string) => set({ [campo]: Number(v) || 0 } as Partial<Enemigo>);

  const subirImagen = async (f: File) => {
    try {
      const anterior = enemigo.imagenId;
      const img = await guardarImagen(f, {
        tipo: 'enemigo',
        nombre: enemigo.nombre,
        campanaId: enemigo.campanaId,
      });
      set({ imagenId: img.id });
      if (anterior) await borrarImagen(anterior);
      setFallo(null);
    } catch (e) {
      setFallo(e instanceof ErrorImagen ? e.message : 'No se ha podido subir la imagen.');
    }
  };

  return (
    <article className="panel" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 130px' }}>
          {enemigo.imagenId ? (
            <Imagen id={enemigo.imagenId} alt={enemigo.nombre} className="retrato" />
          ) : (
            <div className="imagen-fallo" style={{ height: 130 }}>sin imagen</div>
          )}
          <button className="accion" style={{ marginTop: 6, width: '100%' }} onClick={() => archivo.current?.click()}>
            {enemigo.imagenId ? 'Cambiar' : 'Subir imagen'}
          </button>
          <input
            ref={archivo}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subirImagen(f);
              e.target.value = '';
            }}
          />
        </div>

        <div style={{ flex: '1 1 300px' }}>
          <div className="rejilla">
            <div className="campo">
              <label htmlFor={id('nombre')}>Nombre</label>
              <input id={id('nombre')} value={enemigo.nombre} onChange={(e) => set({ nombre: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor={id('tipo')}>Tipo</label>
              <input
                id={id('tipo')}
                value={enemigo.tipo ?? ''}
                placeholder="Bestia, no muerto, humano…"
                onChange={(e) => set({ tipo: e.target.value })}
              />
            </div>
          </div>

          <div className="rejilla">
            <div className="campo">
              <label htmlFor={id('pv')}>Puntos de Vida</label>
              <input id={id('pv')} type="number" value={enemigo.puntosVida} onChange={(e) => num('puntosVida')(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={id('turno')}>Turno</label>
              <input id={id('turno')} type="number" value={enemigo.turno} onChange={(e) => num('turno')(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={id('ataque')}>Ataque</label>
              <input id={id('ataque')} type="number" value={enemigo.ataque} onChange={(e) => num('ataque')(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={id('defensa')}>Defensa</label>
              <input id={id('defensa')} type="number" value={enemigo.defensa} onChange={(e) => num('defensa')(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={id('tipodef')}>Tipo de defensa</label>
              <select
                id={id('tipodef')}
                value={enemigo.tipoDefensa}
                onChange={(e) => set({ tipoDefensa: e.target.value as 'Parada' | 'Esquiva' })}
              >
                <option>Parada</option>
                <option>Esquiva</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor={id('dano')}>Daño</label>
              <input id={id('dano')} type="number" value={enemigo.dano} onChange={(e) => num('dano')(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={id('tipodano')}>Tipo de daño</label>
              <select
                id={id('tipodano')}
                value={enemigo.tipoDano}
                onChange={(e) => set({ tipoDano: e.target.value as TipoDano })}
              >
                {TIPOS_DANO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <label style={{ fontSize: '0.68rem', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--texto-debil)' }}>
            Tipo de Armadura
          </label>
          <div className="desplazable">
            <table>
              <thead>
                <tr>{TIPOS_DANO.map((t) => <th key={t} className="num">{t}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  {TIPOS_DANO.map((t) => (
                    <td key={t} className="num" style={{ minWidth: 56 }}>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        value={enemigo.TA[t] ?? 0}
                        aria-label={`TA ${t} de ${enemigo.nombre}`}
                        onChange={(e) => set({ TA: { ...enemigo.TA, [t]: Number(e.target.value) || 0 } })}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="campo" style={{ marginTop: 10 }}>
            <label htmlFor={id('notas')}>Notas</label>
            <textarea
              id={id('notas')}
              rows={2}
              value={enemigo.notas ?? ''}
              placeholder="Tácticas, debilidades, cómo se comporta…"
              onChange={(e) => set({ notas: e.target.value })}
            />
          </div>

          {fallo && <p className="error-formula">{fallo}</p>}

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
        </div>
      </div>
    </article>
  );
}

export function VistaBestiario({ campanaId }: { campanaId: string | null }) {
  const { enemigos, guardar, crear, borrar } = useEnemigos(campanaId);

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Bestiario</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Fichas reducidas de enemigos y PNJ: sólo lo que hace falta para resolver un combate.
          Desde la pestaña Mesa puedes atacarlos y llevarles la cuenta de PV.
        </p>
        <button className="accion primaria" onClick={() => void crear()}>Nuevo enemigo</button>
      </section>

      {enemigos.length === 0 ? (
        <div className="vacio panel">
          <h2>El bestiario está vacío</h2>
          <p>Crea el primer enemigo para poder enfrentarlo desde el modo mesa.</p>
        </div>
      ) : (
        enemigos.map((e) => (
          <FichaEnemigo
            key={e.id}
            enemigo={e}
            onCambiar={(x) => void guardar(x)}
            onBorrar={() => void borrar(e.id)}
          />
        ))
      )}
    </div>
  );
}
