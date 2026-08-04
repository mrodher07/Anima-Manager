/**
 * La cuenta: registrarse, entrar, salir, y mantener la sincronización al día.
 *
 * Todo lo que hay aquí es **opcional**. Sin nube configurada el estado se queda en
 * `sin-configurar` y la aplicación va exactamente igual que siempre, en local. Con nube
 * configurada pero sin haber entrado, tampoco pasa nada: se sigue trabajando en este
 * dispositivo y lo que se haga se subirá el día que se entre.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cliente, hayNube } from './supabase';
import { sincronizar, resumir, type Resultado } from './sincronizacion';
import {
  cambiarNombre,
  campanasDondeJuego,
  guardarPreferencias,
  leerPreferencias,
  miPerfil,
} from './mesa';
import type { Campana } from '../almacen/almacen';

export type EstadoCuenta = 'sin-configurar' | 'comprobando' | 'fuera' | 'dentro';

export interface Usuario {
  id: string;
  correo: string;
}

/**
 * Cada cuánto se sincroniza sola.
 *
 * Tres minutos es un equilibrio, no un número mágico: lo bastante seguido para que en una
 * partida el máster vea las fichas casi al día, y lo bastante espaciado para no castigar la
 * batería del móvil ni el plan gratuito de Supabase. Además se sincroniza al entrar, al
 * volver la conexión y al volver a la pestaña, que es cuando de verdad suele hacer falta.
 */
const CADA = 3 * 60 * 1000;

export interface Cuenta {
  estado: EstadoCuenta;
  usuario: Usuario | null;
  /** El nombre que ve el resto de la mesa. */
  nombre: string;
  /** Lo que hay que enseñar: errores de entrada, avisos de correo, resumen de sincronización. */
  mensaje: string;
  sincronizando: boolean;
  ultima: Resultado | null;
  /**
   * Campañas en las que juego sin ser el máster. Son de **sólo lectura** y no entran en el
   * almacén local: si entraran, la siguiente sincronización intentaría subirlas y el
   * servidor la rechazaría, porque no son mías.
   */
  campanasAjenas: Campana[];
  registrar: (correo: string, clave: string) => Promise<void>;
  entrar: (correo: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
  recuperar: (correo: string) => Promise<void>;
  sincronizarAhora: () => Promise<void>;
  ponerNombre: (nombre: string) => Promise<void>;
  /** Guarda una preferencia en la nube para que viaje entre dispositivos. */
  guardarPreferencia: (clave: string, valor: unknown) => Promise<void>;
}

/**
 * `alCambiarDatos` se llama cuando una sincronización ha traído algo de fuera, para que las
 * pantallas vuelvan a leer del almacén. Sólo cuando ha traído algo: recargar la lista de
 * fichas cada tres minutos sin motivo haría parpadear la interfaz en mitad de una partida.
 */
export function useCuenta(
  alCambiarDatos?: () => void,
  /**
   * Se llama con las preferencias que había guardadas en la nube, al entrar. Sirve para
   * que el tema que elegiste en el ordenador aparezca también en el móvil.
   */
  alLlegarPreferencias?: (datos: Record<string, unknown>) => void,
): Cuenta {
  const [estado, setEstado] = useState<EstadoCuenta>(
    hayNube() ? 'comprobando' : 'sin-configurar',
  );
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [ultima, setUltima] = useState<Resultado | null>(null);
  const [campanasAjenas, setCampanasAjenas] = useState<Campana[]>([]);

  // En una ref para que el temporizador no se recree cada vez que cambia el callback.
  const avisar = useRef(alCambiarDatos);
  avisar.current = alCambiarDatos;
  const avisarPreferencias = useRef(alLlegarPreferencias);
  avisarPreferencias.current = alLlegarPreferencias;
  // Evita que dos sincronizaciones se pisen: la periódica y la del botón, por ejemplo.
  const enCurso = useRef(false);

  const deSesion = (sesion: Session | null): Usuario | null =>
    sesion?.user ? { id: sesion.user.id, correo: sesion.user.email ?? '' } : null;

  useEffect(() => {
    const supa = cliente();
    if (!supa) return;

    void supa.auth.getSession().then(({ data }) => {
      const u = deSesion(data.session);
      setUsuario(u);
      setEstado(u ? 'dentro' : 'fuera');
    });

    const { data } = supa.auth.onAuthStateChange((_evento, sesion) => {
      const u = deSesion(sesion);
      setUsuario(u);
      setEstado(u ? 'dentro' : 'fuera');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sincronizarAhora = useCallback(async () => {
    const supa = cliente();
    if (!supa || !usuario || enCurso.current) return;
    enCurso.current = true;
    setSincronizando(true);
    try {
      const resultado = await sincronizar(supa, usuario.id);
      setUltima(resultado);
      setMensaje(resumir(resultado));
      const trajoAlgo = resultado.tiendas.some((t) => t.bajados > 0 || t.borradosAqui > 0);
      if (trajoAlgo) avisar.current?.();

      // Las campañas donde juego sin ser el máster se refrescan aquí y no se guardan: son
      // de otro y no se pueden editar, pero llevan las reglas caseras con las que hay que
      // calcular mi ficha.
      const { campanas } = await campanasDondeJuego(supa, usuario.id);
      setCampanasAjenas(campanas);
    } catch (e) {
      // No debería llegar aquí —`sincronizar` no lanza— pero un fallo de sincronización
      // nunca puede tumbar la aplicación: lo importante ya está guardado en local.
      setMensaje(e instanceof Error ? e.message : String(e));
    } finally {
      enCurso.current = false;
      setSincronizando(false);
    }
  }, [usuario]);

  // El perfil y las preferencias se piden una vez al entrar, no en cada sincronización:
  // cambian de higos a brevas y no merecen dos consultas cada tres minutos.
  useEffect(() => {
    const supa = cliente();
    if (!supa || estado !== 'dentro' || !usuario) return;
    let vivo = true;

    void (async () => {
      const perfil = await miPerfil(supa, usuario.id);
      if (vivo && perfil) setNombre(perfil.nombre);

      const prefs = await leerPreferencias(supa, usuario.id);
      if (vivo && prefs) avisarPreferencias.current?.(prefs.datos);
    })();

    return () => {
      vivo = false;
    };
  }, [estado, usuario]);

  // Al entrar, cada tanto, al volver la conexión y al volver a la pestaña.
  useEffect(() => {
    if (estado !== 'dentro' || !usuario) return;
    void sincronizarAhora();

    const reloj = setInterval(() => void sincronizarAhora(), CADA);
    // Con nombre, no en línea: `removeEventListener` compara por referencia y un callback
    // recreado al vuelo no quitaría nada, dejando un oyente por cada vez que se entra.
    const alVolverLaRed = () => void sincronizarAhora();
    const alVolverALaPestana = () => {
      if (document.visibilityState === 'visible') void sincronizarAhora();
    };
    window.addEventListener('online', alVolverLaRed);
    document.addEventListener('visibilitychange', alVolverALaPestana);
    return () => {
      clearInterval(reloj);
      window.removeEventListener('online', alVolverLaRed);
      document.removeEventListener('visibilitychange', alVolverALaPestana);
    };
  }, [estado, usuario, sincronizarAhora]);

  const registrar = useCallback(async (correo: string, clave: string) => {
    const supa = cliente();
    if (!supa) return;
    setMensaje('');
    const { data, error } = await supa.auth.signUp({ email: correo, password: clave });
    if (error) {
      setMensaje(traducir(error.message));
      return;
    }
    // Si el proyecto pide confirmar el correo, no hay sesión todavía y hay que decirlo:
    // si no, parece que el registro ha fallado.
    if (!data.session) {
      setMensaje(
        `Cuenta creada. Te hemos mandado un correo a ${correo}: confírmalo y ya podrás entrar.`,
      );
    }
  }, []);

  const entrar = useCallback(async (correo: string, clave: string) => {
    const supa = cliente();
    if (!supa) return;
    setMensaje('');
    const { error } = await supa.auth.signInWithPassword({ email: correo, password: clave });
    if (error) setMensaje(traducir(error.message));
  }, []);

  const salir = useCallback(async () => {
    const supa = cliente();
    if (!supa) return;
    await supa.auth.signOut();
    setUltima(null);
    setCampanasAjenas([]);
    setNombre('');
    // Lo que hay en este dispositivo **se queda**. Salir de la cuenta no es borrar tus
    // fichas: la aplicación vuelve a ser lo que era antes de registrarse.
    setMensaje('Has salido. Tus fichas siguen guardadas en este dispositivo.');
  }, []);

  const recuperar = useCallback(async (correo: string) => {
    const supa = cliente();
    if (!supa) return;
    const { error } = await supa.auth.resetPasswordForEmail(correo, {
      redirectTo: window.location.origin,
    });
    setMensaje(
      error
        ? traducir(error.message)
        : `Si hay una cuenta con ${correo}, le llegará un correo para cambiar la contraseña.`,
    );
  }, []);

  const ponerNombre = useCallback(
    async (nuevo: string) => {
      const supa = cliente();
      if (!supa || !usuario) return;
      const fallo = await cambiarNombre(supa, usuario.id, nuevo);
      if (fallo) setMensaje(traducir(fallo));
      else {
        setNombre(nuevo.trim().slice(0, 60));
        setMensaje('Nombre guardado.');
      }
    },
    [usuario],
  );

  const guardarPreferencia = useCallback(
    async (clave: string, valor: unknown) => {
      const supa = cliente();
      if (!supa || !usuario) return;
      // Se lee antes de escribir para no borrar las preferencias que puso otro dispositivo:
      // el jsonb se reemplaza entero, no se fusiona por campos.
      const actuales = (await leerPreferencias(supa, usuario.id))?.datos ?? {};
      await guardarPreferencias(supa, usuario.id, { ...actuales, [clave]: valor });
    },
    [usuario],
  );

  return {
    estado,
    usuario,
    nombre,
    mensaje,
    sincronizando,
    ultima,
    campanasAjenas,
    registrar,
    entrar,
    salir,
    recuperar,
    sincronizarAhora,
    ponerNombre,
    guardarPreferencia,
  };
}

/**
 * Los errores de Supabase vienen en inglés y algunos son crípticos. Se traducen los que se
 * ven a diario; el resto se deja tal cual, que es mejor que un «ha habido un error» que no
 * dice nada.
 */
export function traducir(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (m.includes('email not confirmed')) {
    return 'Todavía no has confirmado el correo. Mira tu bandeja de entrada.';
  }
  if (m.includes('user already registered')) {
    return 'Ya hay una cuenta con ese correo. Prueba a entrar en vez de registrarte.';
  }
  if (m.includes('password should be at least')) {
    const minimo = /at least (\d+)/.exec(m)?.[1] ?? '6';
    return `La contraseña tiene que tener al menos ${minimo} caracteres.`;
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Ese correo no parece válido.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'No se ha podido contactar con el servidor. ¿Hay conexión?';
  }
  return mensaje;
}
