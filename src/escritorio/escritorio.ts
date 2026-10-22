/**
 * Lo que cambia cuando la aplicación corre en su programa de escritorio (Tauri) en vez de en
 * el navegador.
 *
 * Es la misma aplicación: los datos siguen en la propia ventana, como en el navegador. El
 * escritorio sólo añade dos cosas (ver `src-tauri/src/lib.rs`): guardar archivos con el
 * diálogo del sistema, en vez de dejarlos en Descargas, y una copia de seguridad diaria en
 * la carpeta de datos del programa. Fuera del escritorio estas funciones hacen lo de la web.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { crearCopia } from '../almacen/copiaSeguridad';

export function esEscritorio(): boolean {
  return isTauri();
}

export interface Guardado {
  /** Falso si el usuario ha cancelado el diálogo. */
  guardado: boolean;
  /** Dónde ha quedado. Sólo en el escritorio: el navegador no lo dice. */
  ruta?: string;
}

/**
 * Guarda un archivo. En el escritorio pregunta dónde con el diálogo del sistema; en el
 * navegador lo descarga, como siempre.
 */
export async function guardarArchivo(nombre: string, contenido: Blob): Promise<Guardado> {
  if (esEscritorio()) {
    const ruta = await invoke<string | null>(
      'guardar_archivo',
      new Uint8Array(await contenido.arrayBuffer()),
      { headers: { 'x-nombre': encodeURIComponent(nombre) } },
    );
    return ruta ? { guardado: true, ruta } : { guardado: false };
  }
  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
  return { guardado: true };
}

/** El día de hoy en la hora del equipo, que es el que se espera ver en el nombre. */
function hoy(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Deja la copia de hoy en la carpeta de datos del programa. Devuelve dónde. */
export async function hacerCopiaAutomatica(): Promise<string | null> {
  if (!esEscritorio()) return null;
  const copia = await crearCopia();
  return invoke<string>('guardar_copia_automatica', new TextEncoder().encode(JSON.stringify(copia)), {
    headers: { 'x-fecha': hoy() },
  });
}

/** La carpeta de las copias automáticas, o nada fuera del escritorio. */
export async function carpetaCopias(): Promise<string | null> {
  return esEscritorio() ? invoke<string>('carpeta_copias') : null;
}

export async function abrirCarpetaCopias(): Promise<void> {
  if (esEscritorio()) await invoke('abrir_carpeta_copias');
}

/** Cada hora, la copia del día se rehace: si el equipo se apaga de golpe, se pierde poco. */
const CADA = 60 * 60 * 1000;

/**
 * Arranca las copias automáticas: una al poco de abrir (sin estorbar al arranque) y luego
 * cada hora. Un fallo se apunta en la consola y se reintenta en la siguiente.
 */
export function iniciarCopiasAutomaticas(): void {
  if (!esEscritorio()) return;
  const copiar = () => {
    hacerCopiaAutomatica().catch((e) => console.error('Copia automática:', e));
  };
  setTimeout(copiar, 5000);
  setInterval(copiar, CADA);
}

/**
 * Adónde lleva el enlace del correo para cambiar la contraseña. En el navegador, a la misma
 * página. En el escritorio la ventana no tiene dirección que se pueda abrir desde un correo,
 * así que va a la web (`VITE_URL_WEB`), o a la que tenga configurada Supabase.
 */
export function direccionVuelta(): string | undefined {
  if (!esEscritorio()) return window.location.origin;
  const web = import.meta.env.VITE_URL_WEB as string | undefined;
  return web || undefined;
}
