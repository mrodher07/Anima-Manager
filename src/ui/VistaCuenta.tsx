import { useState } from 'react';
import type { Cuenta } from '../nube/cuenta';
import { SIN_NUBE } from '../nube/supabase';

const NOMBRES: Record<string, string> = {
  campanas: 'Campañas',
  personajes: 'Fichas',
  enemigos: 'Bestiario',
};

/**
 * La pantalla de la cuenta.
 *
 * Tiene un trabajo poco lucido pero importante: que en todo momento se entienda **dónde
 * están los datos**. Sin cuenta, en este dispositivo. Con cuenta, aquí y en el servidor. La
 * gente confía en una herramienta cuando sabe qué pasa con lo suyo, y en una campaña de rol
 * lo que hay dentro son años de partidas.
 */
export function VistaCuenta({ cuenta }: { cuenta: Cuenta }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [modo, setModo] = useState<'entrar' | 'registrar'>('entrar');
  const [ocupado, setOcupado] = useState(false);

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
                      {NOMBRES[t.tienda] ?? t.tienda}
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

        <h3 style={{ marginTop: 22 }}>Qué se sube y qué no</h3>
        <ul style={{ color: 'var(--texto-tenue)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <li>Se suben tus <strong>fichas, campañas y bestiario</strong>.</li>
          <li>
            <strong>Las imágenes todavía no.</strong> Ocupan mucho y van por otro camino;
            hasta que se haga, los retratos y mapas viven sólo en este dispositivo — sácalos
            con la Copia de seguridad si vas a cambiar de equipo.
          </li>
          <li>
            El máster de tu campaña puede <strong>ver</strong> tus fichas, pero no
            cambiarlas. Tu ficha es tuya.
          </li>
          <li>
            Gana siempre <strong>la última versión guardada</strong>. Si editas la misma
            ficha en dos sitios sin conexión, la que sincronice después se queda.
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
