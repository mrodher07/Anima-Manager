import { useCallback, useEffect, useState } from 'react';
import { cliente } from '../nube/supabase';
import { almacen } from '../almacen/almacen';
import { fichasDeCampana, subirRegistros } from '../nube/sincronizacion';
import type { Personaje } from '../motor/personaje';
import type { Catalogo } from '../datos/paquetes';
import type { Reglamento } from '../motor/reglamento';
import { useDatosCalculo } from './estado';
import { VistaFicha } from './VistaFicha';
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
/** La ficha de un jugador, de sólo lectura, calculada con las reglas de esta mesa. */
function FichaDeJugador({
  personaje, catalogo, reglamento,
}: { personaje: Personaje; catalogo: Catalogo; reglamento: Reglamento }) {
  const datos = useDatosCalculo(catalogo, personaje);
  if (!datos) return <p style={{ color: 'var(--texto-debil)' }}>Calculando…</p>;
  return <VistaFicha personaje={personaje} datos={datos} reglamento={reglamento} />;
}

/**
 * Cada cuánto se vuelven a pedir las fichas de los jugadores mientras el máster mira la
 * mesa: lo bastante seguido para ver aparecer al que acaba de traer la suya.
 */
const CADA_FICHAS = 15 * 1000;

export function PanelMesa({
  campanaId,
  soyElMaster,
  catalogo,
  reglamento,
}: {
  campanaId: string;
  soyElMaster: boolean;
  catalogo?: Catalogo;
  reglamento?: Reglamento;
}) {
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

  /*
   * Quién juega se vuelve a pedir cada poco, no sólo al abrir la pestaña. El máster abre
   * Jugadores para generar el código y se queda ahí mientras los demás se unen; antes la
   * lista se quedaba en «Todavía no se ha unido nadie» hasta que salía y volvía a entrar.
   */
  useEffect(() => {
    void recargar();
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') void recargar();
    }, CADA_FICHAS);
    return () => clearInterval(reloj);
  }, [recargar]);

  /*
   * Los personajes de la mesa. Antes el máster no los veía en ninguna parte salvo al
   * montar un combate: aquí salían las personas y nada más.
   */
  const [fichas, setFichas] = useState<Personaje[]>([]);
  const [yo, setYo] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  useEffect(() => {
    const supa = cliente();
    if (!supa || !soyElMaster) return;
    let vigente = true;
    void supa.auth.getSession().then(({ data }) => { if (vigente) setYo(data.session?.user.id ?? null); });
    const mirar = async () => {
      if (document.visibilityState !== 'visible') return;
      const { personajes, error } = await fichasDeCampana(supa, campanaId);
      if (vigente && !error) setFichas(personajes.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    };
    void mirar();
    const reloj = setInterval(() => void mirar(), CADA_FICHAS);
    return () => { vigente = false; clearInterval(reloj); };
  }, [campanaId, soyElMaster]);
  const nombreDe = (usuario: string | null | undefined) =>
    !usuario ? '—' : usuario === yo ? 'Tú' : miembros.find((m) => m.usuario === usuario)?.nombre ?? 'Sin nombre';

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
          <h2 style={{ marginTop: 22 }}>Sus personajes</h2>
          {fichas.length === 0 ? (
            <p style={{ color: 'var(--texto-debil)', marginTop: 0 }}>
              Ningún jugador ha traído todavía su personaje a esta campaña. Al unirse con el
              código se les ofrece traer las fichas que ya tenían, y también pueden elegir la
              campaña en su ficha, en Editar → Identidad.
            </p>
          ) : (
            <div className="desplazable">
              <table className="personajes-mesa">
                <thead>
                  <tr><th>Personaje</th><th>Jugador</th><th>Raza y categoría</th><th></th></tr>
                </thead>
                <tbody>
                  {fichas.map((p) => (
                    <tr key={p.id}>
                      <td className="destacado">{p.nombre || 'Sin nombre'}</td>
                      <td>{nombreDe(p.propietario)}</td>
                      <td>
                        {[p.raza, p.categorias.filter((c) => c.categoria).map((c) => `${c.categoria} ${c.nivel}`).join(' / ')]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {catalogo && reglamento && (
                          <button
                            className="accion"
                            aria-expanded={abierta === p.id}
                            onClick={() => setAbierta(abierta === p.id ? null : p.id)}
                          >
                            {abierta === p.id ? 'Cerrar' : 'Ver ficha'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(() => {
            const p = fichas.find((x) => x.id === abierta);
            if (!p || !catalogo || !reglamento) return null;
            return (
              <div className="ficha-de-jugador" style={{ marginTop: 12 }}>
                <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', margin: '0 0 8px' }}>
                  La ficha de {nombreDe(p.propietario)}, calculada con las reglas de esta mesa.
                  Es de sólo lectura: la edita su jugador.
                </p>
                <FichaDeJugador personaje={p} catalogo={catalogo} reglamento={reglamento} />
              </div>
            );
          })()}

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
                /*
                 * La campaña tiene que estar en el servidor para poder invitar a ella: es él
                 * quien comprueba que eres su máster. Recién creada podía no haber subido
                 * todavía, y entonces el servidor le contestaba al propio máster «sólo el
                 * máster puede invitar». Se sube antes de pedir el código.
                 */
                const { data: sesion } = await supa.auth.getSession();
                const propia = (await almacen.listarCampanas()).find((c) => c.id === campanaId);
                if (propia && sesion.session) {
                  await subirRegistros(supa, sesion.session.user.id, 'campanas', [propia]);
                }
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
