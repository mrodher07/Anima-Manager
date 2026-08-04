import { useEffect, useRef, useState } from 'react';
import {
  analizarCopia,
  crearCopia,
  restaurarCopia,
  resumirCopia,
  type CopiaSeguridad,
  type ModoRestauracion,
  type ResumenCopia,
} from '../almacen/copiaSeguridad';
import { formatearBytes } from '../almacen/imagenes';
import { aplicarTema, temaGuardado } from './temas';

function Cuenta({ titulo, valor, sufijo }: { titulo: string; valor: string | number; sufijo?: string }) {
  return (
    <div className="recurso">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {sufijo && <span className="sufijo">{sufijo}</span>}
    </div>
  );
}

function Resumen({ r }: { r: ResumenCopia }) {
  return (
    <div className="recursos tira">
      <Cuenta titulo="Fichas" valor={r.personajes} />
      <Cuenta titulo="Campañas" valor={r.campanas} />
      <Cuenta titulo="Enemigos" valor={r.enemigos} />
      <Cuenta titulo="Imágenes" valor={r.imagenes} />
      <Cuenta titulo="Preferencias" valor={r.preferencias} />
      <Cuenta titulo="Tamaño" valor={formatearBytes(r.bytes)} sufijo="aproximado" />
    </div>
  );
}

export function VistaCopia({ onRecargar }: { onRecargar: () => void }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [actual, setActual] = useState<ResumenCopia | null>(null);
  const [pendiente, setPendiente] = useState<{ copia: CopiaSeguridad; resumen: ResumenCopia } | null>(null);
  const [modo, setModo] = useState<ModoRestauracion>('fusionar');
  const [confirmar, setConfirmar] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'aviso'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Cuánto hay ahora mismo en este dispositivo, para poder comparar con lo que trae la copia.
  useEffect(() => {
    void crearCopia().then((c) => setActual(resumirCopia(c)));
  }, []);

  const descargar = async () => {
    setOcupado(true);
    try {
      const copia = await crearCopia();
      const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fecha = copia.creadaEn.slice(0, 10);
      a.href = url;
      a.download = `anima-manager-copia-${fecha}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActual(resumirCopia(copia));
      setMensaje({ tipo: 'aviso', texto: 'Copia descargada. Guárdala fuera de este equipo.' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No he podido crear la copia.' });
    } finally {
      setOcupado(false);
    }
  };

  const leerArchivo = async (f: File) => {
    setMensaje(null);
    setConfirmar(false);
    try {
      const r = analizarCopia(JSON.parse(await f.text()));
      if (!r.ok) {
        setPendiente(null);
        setMensaje({ tipo: 'error', texto: r.error });
        return;
      }
      setPendiente({ copia: r.copia, resumen: r.resumen });
    } catch {
      setPendiente(null);
      setMensaje({ tipo: 'error', texto: 'El archivo no es un JSON válido.' });
    }
  };

  const restaurar = async () => {
    if (!pendiente) return;
    setOcupado(true);
    try {
      const r = await restaurarCopia(pendiente.copia, modo);
      // El tema se guarda fuera de React, así que hay que reaplicarlo a mano.
      aplicarTema(temaGuardado());
      onRecargar();
      setActual(resumirCopia(await crearCopia()));
      setPendiente(null);
      setConfirmar(false);
      const plural = (n: number, uno: string, varios: string) =>
        `${n} ${n === 1 ? uno : varios}`;
      const partes = [
        `Restaurado: ${plural(r.personajes, 'ficha', 'fichas')}, ` +
          `${plural(r.campanas, 'campaña', 'campañas')}, ` +
          `${plural(r.enemigos, 'enemigo', 'enemigos')} y ` +
          `${plural(r.imagenes, 'imagen', 'imágenes')}.`,
      ];
      if (r.borrados > 0) partes.push(`Se han borrado ${r.borrados} registros anteriores.`);
      if (r.fallos.length > 0) partes.push(r.fallos.join(' '));
      setMensaje({ tipo: r.fallos.length > 0 ? 'error' : 'aviso', texto: partes.join(' ') });
    } catch {
      setMensaje({ tipo: 'error', texto: 'La restauración ha fallado a medias. Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Copia de seguridad</h2>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Todo lo tuyo vive <strong>en este navegador y en este dispositivo</strong>: si borras
          los datos de navegación, cambias de ordenador o le pasa algo al equipo, se va.
          Una copia se lleva <strong>todo</strong> —fichas, campañas con sus reglas caseras y
          su contenido propio, enemigos, la galería entera y hasta el tema que tengas puesto—
          y lo devuelve tal cual estaba.
        </p>

        {actual && (
          <>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--texto-debil)' }}>
              Lo que hay ahora en este dispositivo
            </p>
            <Resumen r={actual} />
          </>
        )}

        <div className="acciones-regla">
          <button className="accion primaria" disabled={ocupado} onClick={() => void descargar()}>
            {ocupado ? 'Preparando…' : 'Descargar copia de seguridad'}
          </button>
          <button className="accion" disabled={ocupado} onClick={() => archivo.current?.click()}>
            Restaurar desde un archivo
          </button>
          <input
            ref={archivo}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leerArchivo(f);
              e.target.value = '';
            }}
          />
        </div>

        {mensaje && <div className={`aviso ${mensaje.tipo}`} style={{ marginTop: 12 }}>{mensaje.texto}</div>}

        <p style={{ color: 'var(--texto-debil)', fontSize: '0.8rem', marginBottom: 0 }}>
          El archivo es un JSON con las imágenes dentro, así que pesa lo que pese tu galería.
          Guárdalo donde no dependa de este equipo: en la nube, en un pendrive o mandándotelo
          por correo.
        </p>
      </section>

      {pendiente && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Esto es lo que trae el archivo</h3>
          {pendiente.copia.creadaEn && (
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem', marginTop: 0 }}>
              Copia del <strong>{new Date(pendiente.copia.creadaEn).toLocaleString('es-ES')}</strong>.
            </p>
          )}
          <Resumen r={pendiente.resumen} />

          <p style={{ fontSize: '0.68rem', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--texto-debil)' }}>
            Cómo restaurarla
          </p>
          <div className="lista-seleccion">
            {(
              [
                [
                  'fusionar',
                  'Fusionar',
                  'Devuelve lo que trae la copia sin borrar nada de lo que ya tienes. Lo que ' +
                    'coincida se sustituye por lo de la copia.',
                ],
                [
                  'reemplazar',
                  'Reemplazar todo',
                  'Borra lo que hay ahora y deja el dispositivo exactamente como estaba el día ' +
                    'de la copia. Lo que hayas hecho después se pierde.',
                ],
              ] as const
            ).map(([id, texto, ayuda]) => (
              <label key={id} className={modo === id ? 'elegida' : undefined}>
                <input
                  type="radio"
                  name="modo-restauracion"
                  checked={modo === id}
                  onChange={() => {
                    setModo(id);
                    setConfirmar(false);
                  }}
                />
                <span>
                  {texto}
                  <small style={{ display: 'block', color: 'var(--texto-debil)' }}>{ayuda}</small>
                </span>
              </label>
            ))}
          </div>

          {modo === 'reemplazar' && actual && (
            <p className="aviso error" style={{ marginTop: 12 }}>
              Vas a borrar {actual.personajes} fichas, {actual.campanas} campañas,{' '}
              {actual.enemigos} enemigos y {actual.imagenes} imágenes de este dispositivo, y a
              dejar en su lugar lo de la copia. Esto no se puede deshacer.
            </p>
          )}

          <div className="acciones-regla">
            {confirmar || modo === 'fusionar' ? (
              <button
                className={`accion ${modo === 'reemplazar' ? 'peligro' : 'primaria'}`}
                disabled={ocupado}
                onClick={() => void restaurar()}
              >
                {ocupado
                  ? 'Restaurando…'
                  : modo === 'reemplazar'
                    ? 'Confirmar: borrar y restaurar'
                    : 'Restaurar'}
              </button>
            ) : (
              <button className="accion peligro" onClick={() => setConfirmar(true)}>
                Reemplazar todo
              </button>
            )}
            <button
              className="accion"
              disabled={ocupado}
              onClick={() => {
                setPendiente(null);
                setConfirmar(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
