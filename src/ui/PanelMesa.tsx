import { useCallback, useEffect, useState } from 'react';
import { cliente } from '../nube/supabase';
import {
  borrarInvitacion,
  crearInvitacion,
  invitacionesDe,
  miembrosDe,
  type Invitacion,
  type Miembro,
} from '../nube/mesa';

/**
 * Quién juega en esta campaña y cómo invitar a alguien más.
 *
 * Sólo aparece con nube configurada y sesión abierta: sin cuenta no hay a quién invitar,
 * y anunciar un botón que no puede funcionar es peor que no tenerlo.
 */
export function PanelMesa({ campanaId, soyElMaster }: { campanaId: string; soyElMaster: boolean }) {
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const recargar = useCallback(async () => {
    const supa = cliente();
    if (!supa) return;
    setMiembros(await miembrosDe(supa, campanaId));
    if (soyElMaster) setInvitaciones(await invitacionesDe(supa, campanaId));
  }, [campanaId, soyElMaster]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const supa = cliente();
  if (!supa) return null;

  return (
    <>
      <h2 style={{ marginTop: 22 }}>Quién juega</h2>
      {miembros.length === 0 ? (
        <p style={{ color: 'var(--texto-debil)', marginTop: 0 }}>
          Todavía no se ha unido nadie.{' '}
          {soyElMaster
            ? 'Genera un código y pásaselo a tus jugadores.'
            : 'Esta campaña aún no está compartida.'}
        </p>
      ) : (
        <table>
          <thead>
            <tr><th>Jugador</th><th>Papel</th><th className="num">Desde</th></tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr key={m.usuario}>
                <td>{m.nombre}</td>
                <td>{m.papel === 'master' ? 'Máster' : 'Jugador'}</td>
                <td className="num">{new Date(m.unidoEn).toLocaleDateString('es-ES')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {soyElMaster && (
        <>
          <h2 style={{ marginTop: 22 }}>Invitaciones</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
            Un código deja entrar a quien lo tenga, así que caduca a los 30 días y admite un
            número limitado de usos. Si uno se te escapa por un chat, bórralo y genera otro:
            los que ya estén dentro se quedan.
          </p>
          <div className="acciones-regla" style={{ marginTop: 0 }}>
            <button
              className="accion primaria"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                setAviso('');
                const r = await crearInvitacion(supa, campanaId);
                setAviso(r.codigo ? `Código nuevo: ${r.codigo}` : (r.error ?? 'No se ha podido crear.'));
                await recargar();
                setOcupado(false);
              }}
            >
              Generar código
            </button>
          </div>
          {aviso && <div className="aviso" style={{ marginTop: 12 }}>{aviso}</div>}

          {invitaciones.length > 0 && (
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th className="num">Usos</th>
                  <th className="num">Caduca</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invitaciones.map((i) => {
                  const caducada = i.caducaEn ? new Date(i.caducaEn) < new Date() : false;
                  const agotada = i.usos >= i.usosMaximos;
                  return (
                    <tr key={i.codigo}>
                      <td>
                        <code style={{ letterSpacing: '0.15em', fontSize: '1.05rem' }}>{i.codigo}</code>
                        {(caducada || agotada) && (
                          <small style={{ display: 'block', color: 'var(--texto-debil)' }}>
                            {caducada ? 'caducado' : 'sin usos'}
                          </small>
                        )}
                      </td>
                      <td className="num">{i.usos} / {i.usosMaximos}</td>
                      <td className="num">
                        {i.caducaEn ? new Date(i.caducaEn).toLocaleDateString('es-ES') : 'nunca'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="accion"
                          onClick={async () => {
                            await borrarInvitacion(supa, i.codigo);
                            await recargar();
                          }}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
