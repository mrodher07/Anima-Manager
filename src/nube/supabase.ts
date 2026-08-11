/**
 * Cliente de Supabase.
 *
 * **La aplicación tiene que seguir funcionando sin esto.** Es la regla que ordena todo el
 * módulo: si no hay variables de entorno configuradas, `cliente()` devuelve `null` y la
 * aplicación se comporta exactamente igual que antes de que existiera la nube — en local,
 * sin cuenta y sin conexión. Eso no es una concesión: es lo que hace que la promesa de
 * «local-first» sea cierta y no un eslogan.
 *
 * Configurarlo es poner dos variables en un `.env.local` (o en Vercel):
 *
 *     VITE_SUPABASE_URL=https://xxxxx.supabase.co
 *     VITE_SUPABASE_ANON_KEY=eyJhbGci...
 *
 * La clave `anon` es **pública por diseño**: viaja dentro del JavaScript que se descarga
 * cualquiera. Lo único que impide que un usuario lea los datos de otro son las políticas
 * de `supabase/esquema.sql`. Si esas políticas no están puestas, la base de datos está
 * abierta, por muy escondida que se crea que está la clave.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let instancia: SupabaseClient | null = null;

/** true si esta copia de la aplicación tiene nube configurada. */
export function hayNube(): boolean {
  return Boolean(URL && CLAVE);
}

/**
 * El cliente, o `null` si no hay nube. Devolver `null` en vez de lanzar es deliberado:
 * quien llama tiene que poder seguir adelante sin nube, no capturar una excepción.
 */
export function cliente(): SupabaseClient | null {
  if (!hayNube()) return null;
  if (!instancia) {
    instancia = createClient(URL!, CLAVE!, {
      auth: {
        // La sesión se guarda en el navegador para no tener que entrar en cada visita.
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return instancia;
}

/**
 * Mensaje para la interfaz cuando alguien intenta usar la nube sin haberla configurado.
 *
 * Antes sólo nombraba las dos variables, lo cual está bien en tu propio ordenador y no
 * sirve de nada en un sitio ya publicado: quien lo lee ahí no sabe dónde se ponen. Y hay
 * un detalle que despista a todo el mundo la primera vez —Vite incrusta las variables al
 * compilar, no las lee al abrir la página—, así que guardarlas no basta: hay que volver a
 * desplegar. Por eso el mensaje lo dice.
 */
export const SIN_NUBE =
  'Esta copia de Anima Manager no tiene nube configurada, así que funciona sólo en este ' +
  'dispositivo. Para activarla hay que definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY ' +
  '—en el archivo .env.local si es tu ordenador, o en las variables de entorno de tu ' +
  'proveedor si está publicada— y volver a desplegar: esos valores se incrustan al ' +
  'compilar, así que guardarlos no basta.';
