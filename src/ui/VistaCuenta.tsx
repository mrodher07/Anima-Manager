import { useEffect, useState } from 'react';
import type { Cuenta } from '../nube/cuenta';
import { NOMBRE_COLECCION } from '../nube/sincronizacion';
import { cliente, SIN_NUBE } from '../nube/supabase';
import { unirseACampana } from '../nube/mesa';

/**
 * La pantalla de la cuenta.
 *
 * Tiene un trabajo poco lucido pero importante: que en todo momento se entienda **dónde
 * están los datos**. Sin cuenta, en este dispositivo. Con cuenta, aquí y en el servidor. La
 * gente confía en una herramienta cuando sabe qué pasa con lo suyo, y en una campaña de rol
 * lo que hay dentro son años de partidas.
 */
export function VistaCuenta({ cuenta, onRecargar }: { cuenta: Cuenta; onRecargar?: () => void }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [modo, setModo] = useState<'entrar' | 'registrar'>('entrar');
  const [ocupado, setOcupado] = useState(false);
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [codigo, setCodigo] = useState('');
  const [avisoMesa, setAvisoMesa] = useState('');

  // El nombre llega del servidor después de pintar. Se copia al campo cuando llega, no
  // antes: si no, el campo saldría vacío y parecería que no hay nombre puesto.
  useEffect(() => setNombre(cuenta.nombre), [cuenta.nombre]);

  if (cuenta.estado === 'sin-configurar') {
    return (
      <section className="panel">
        <h2>Cuenta</h2>
        <div className="aviso" style={{ marginBottom: 14 }}>{SIN_NUBE}</div>
        <p style={{ color: 'var(--texto-tenue)' }}>
          Mientras tanto no se pierde nada: todo se guarda en este navegador y puedes
          llevártelo con la <strong>Copia de seguridad</strong>. La nube sólo añade poder
          entrar desde otro dispositivo y que tu máster vea tu ficha.
        </p>
      </section>
    );
  }

  if (cuenta.estado === 'comprobando') {
    return (
      <section className="panel">
        <h2>Cuenta</h2>
        <p style={{ color: 'var(--texto-tenue)' }}>Comprobando la sesión…</p>
      </section>
    );
  }

  const enviar = async (accion: () => Promise<void>) => {
    setOcupado(true);
    try {
      await accion();
    } finally {
      setOcupado(false);
    }
  };

  if (cuenta.estado === 'dentro' && cuenta.usuario) {
    return (
      <section className="panel">
        <h2>Cuenta</h2>
        <p style={{ marginTop: 0 }}>
          Has entrado como <strong>{cuenta.usuario.correo}</strong>.
        </p>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem' }}>
          Tus fichas se guardan en este dispositivo y se copian al servidor. Se sincroniza
          sola cada pocos minutos, al volver la conexión y al volver a esta pestaña; el botón
          es por si tienes prisa.
        </p>

        <div className="campo" style={{ maxWidth: 380 }}>
          <label htmlFor="cuenta-nombre">Cómo te ve el resto de la mesa</label>
          <input
            id="cuenta-nombre"
            value={nombre}
            maxLength={60}
            placeholder="Tu nombre"
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => {
              if (nombre.trim() !== cuenta.nombre) void cuenta.ponerNombre(nombre);
            }}
          />
          <small style={{ color: 'var(--texto-debil)' }}>
            Tu correo no lo ve nadie más. Esto es lo único que aparece junto a tus fichas.
          </small>
        </div>

        <div className="acciones-regla" style={{ marginTop: 0 }}>
          <button
            className="accion primaria"
            disabled={cuenta.sincronizando}
            onClick={() => void cuenta.sincronizarAhora()}
          >
            {cuenta.sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          <button className="accion" disabled={ocupado} onClick={() => void enviar(cuenta.salir)}>
            Salir de la cuenta
          </button>
        </div>

        {cuenta.mensaje && (
          <div
            className={cuenta.ultima && !cuenta.ultima.ok ? 'aviso error' : 'aviso'}
            style={{ marginTop: 14 }}
          >
            {cuenta.mensaje}
          </div>
        )}

        {cuenta.ultima && (
          <>
            <h3 style={{ marginTop: 20 }}>Última sincronización</h3>
            <p style={{ color: 'var(--texto-debil)', fontSize: '0.85rem', marginTop: 0 }}>
              {new Date(cuenta.ultima.cuando).toLocaleString('es-ES')}
            </p>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Enviados</th>
                  <th className="num">Recibidos</th>
                  <th className="num">Borrados aquí</th>
                </tr>
              </thead>
              <tbody>
                {cuenta.ultima.tiendas.map((t) => (
                  <tr key={t.tienda}>
                    <td>
                      {NOMBRE_COLECCION[t.tienda] ?? t.tienda}
                      {t.error && (
                        <small style={{ display: 'block', color: 'var(--peligro, #c33)' }}>
                          {t.error}
                        </small>
                      )}
                    </td>
                    <td className="num">{t.subidos + t.lapidasEnviadas}</td>
                    <td className="num">{t.bajados}</td>
                    <td className="num">{t.borradosAqui}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3 style={{ marginTop: 22 }}>Unirte a una mesa</h3>
        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
          Pídele el código a tu máster: lo genera en la pestaña Campañas. Al canjearlo verás
          las reglas caseras y los manuales de esa mesa, y tu máster podrá ver tus fichas de
          esa campaña.
        </p>
        <form
          className="acciones-regla"
          style={{ marginTop: 0, alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(async () => {
              const supa = cliente();
              if (!supa) return;
              const r = await unirseACampana(supa, codigo.trim().toUpperCase());
              if (!r.ok) {
                setAvisoMesa(r.error ?? 'No se ha podido canjear el código.');
                return;
              }
              setAvisoMesa(
                r.yaEstaba
                  ? `Ya jugabas en «${r.nombre}».`
                  : `Te has unido a «${r.nombre}».`,
              );
              setCodigo('');
              await cuenta.sincronizarAhora();
              onRecargar?.();
            });
          }}
        >
          <div className="campo" style={{ marginBottom: 0, maxWidth: 200 }}>
            <label htmlFor="codigo-mesa">Código de invitación</label>
            <input
              id="codigo-mesa"
              value={codigo}
              maxLength={6}
              placeholder="ABC234"
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          <button className="accion primaria" type="submit" disabled={!codigo.trim() || ocupado}>
            Unirme
          </button>
        </form>
        {avisoMesa && <div className="aviso" style={{ marginTop: 12 }}>{avisoMesa}</div>}

        {cuenta.campanasAjenas.length > 0 && (
          <>
            <h3 style={{ marginTop: 22 }}>Mesas en las que juegas</h3>
            <ul style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {cuenta.campanasAjenas.map((c) => (
                <li key={c.id}>
                  <strong>{c.nombre}</strong>
                  {c.descripcion ? ` — ${c.descripcion}` : ''}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 style={{ marginTop: 22 }}>Qué se sube y qué no</h3>
        <ul style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <li>
            Se suben tus <strong>fichas, campañas, bestiario e imágenes</strong>, y el tema
            que tengas puesto.
          </li>
          <li>
            El máster de tu campaña puede <strong>ver</strong> tus fichas, pero no
            cambiarlas. Tu ficha es tuya.
          </li>
          <li>
            Los <strong>mapas de una campaña</strong> los ve toda la mesa. Las imágenes sin
            campaña son sólo tuyas.
          </li>
          <li>
            Gana siempre <strong>la última versión guardada</strong>. Si editas la misma
            ficha en dos sitios sin conexión, la que sincronice después se queda.
          </li>
          <li>
            La nube <strong>no sustituye a la copia de seguridad</strong>: el borrado también
            se sincroniza, así que si borras algo por error se borra en todas partes.
          </li>
        </ul>
      </section>
    );
  }

  // ── Fuera: entrar o registrarse ────────────────────────────────────────────
  return (
    <section className="panel">
      <h2>{modo === 'entrar' ? 'Entrar' : 'Crear una cuenta'}</h2>
      <p style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', marginTop: 0 }}>
        Con una cuenta puedes abrir tus fichas desde el móvil y desde el ordenador, y tu
        máster ve las de su campaña. Sin ella la aplicación funciona igual, sólo que lo que
        hagas se queda en este navegador.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(() =>
            modo === 'entrar' ? cuenta.entrar(correo, clave) : cuenta.registrar(correo, clave),
          );
        }}
      >
        <div className="campo">
          <label htmlFor="cuenta-correo">Correo</label>
          <input
            id="cuenta-correo"
            type="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="cuenta-clave">Contraseña</label>
          <input
            id="cuenta-clave"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
        <div className="acciones-regla" style={{ marginTop: 0 }}>
          <button className="accion primaria" type="submit" disabled={ocupado}>
            {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <button
            className="accion"
            type="button"
            onClick={() => setModo(modo === 'entrar' ? 'registrar' : 'entrar')}
          >
            {modo === 'entrar' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
          </button>
          {modo === 'entrar' && (
            <button
              className="accion"
              type="button"
              disabled={!correo || ocupado}
              onClick={() => void enviar(() => cuenta.recuperar(correo))}
            >
              He olvidado la contraseña
            </button>
          )}
        </div>
      </form>

      {cuenta.mensaje && (
        <div className="aviso" style={{ marginTop: 14 }}>
          {cuenta.mensaje}
        </div>
      )}

      <p style={{ color: 'var(--texto-debil)', fontSize: '0.85rem', marginTop: 18 }}>
        Al entrar por primera vez, lo que ya tengas guardado en este navegador se sube a tu
        cuenta. No se borra nada.
      </p>
    </section>
  );
}
