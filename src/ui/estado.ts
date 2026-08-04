import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Catalogo } from '../datos/paquetes';
import type { Colecciones, NombreColeccion } from '../datos/tipos';
import { almacen, type Campana, type Tirada } from '../almacen/almacen';
import { PERSONALIZADOS_VACIOS } from '../datos/paquetes';
import { cargarDatosCalculo, personajeVacio, type DatosCalculo, type Personaje } from '../motor/personaje';
import { REGLAMENTO_OFICIAL, Reglamento } from '../motor/reglamento';

export function nuevoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Carga diferida de una colección del catálogo. */
export function useColeccion<K extends NombreColeccion>(
  catalogo: Catalogo,
  coleccion: K,
): Colecciones[K][] {
  const [datos, setDatos] = useState<Colecciones[K][]>([]);
  useEffect(() => {
    let vigente = true;
    catalogo.obtener(coleccion).then((d) => { if (vigente) setDatos(d); });
    return () => { vigente = false; };
  }, [catalogo, coleccion]);
  return datos;
}

/** Los datos que necesita el cálculo de una ficha concreta. */
export function useDatosCalculo(catalogo: Catalogo, personaje: Personaje | null): DatosCalculo | null {
  const [datos, setDatos] = useState<DatosCalculo | null>(null);
  const clave = personaje
    ? `${personaje.raza}|${personaje.categorias.map((c) => `${c.categoria}:${c.nivel}`).join(',')}`
    : '';
  useEffect(() => {
    if (!personaje) { setDatos(null); return; }
    let vigente = true;
    cargarDatosCalculo(personaje, catalogo).then((d) => { if (vigente) setDatos(d); });
    return () => { vigente = false; };
    // Sólo hace falta recargar si cambian la raza o la categoría.
  }, [catalogo, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return datos;
}

/**
 * Colección de personajes con persistencia.
 * Guarda con retardo para no escribir en IndexedDB en cada pulsación de tecla.
 */
export function usePersonajes() {
  const [personajes, setPersonajes] = useState<Personaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const pendientes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const recargar = useCallback(async () => {
    setPersonajes(await almacen.listarPersonajes());
    setCargando(false);
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  const guardar = useCallback((p: Personaje) => {
    setPersonajes((antes) => {
      const i = antes.findIndex((x) => x.id === p.id);
      return i >= 0 ? antes.map((x) => (x.id === p.id ? p : x)) : [...antes, p];
    });
    const previo = pendientes.current.get(p.id);
    if (previo) clearTimeout(previo);
    pendientes.current.set(p.id, setTimeout(() => { void almacen.guardarPersonaje(p); }, 400));
  }, []);

  /**
   * Ficha nueva. Si hay campaña activa nace dentro de ella y **con el nivel que la mesa ha
   * dicho**, que es lo que hace que ese ajuste sirva para algo: si no, el Director acuerda
   * empezar a nivel 3 y cada jugador tiene que acordarse de cambiarlo a mano.
   */
  const crear = useCallback((campanaId: string | null = null, nivelInicial = 1): Personaje => {
    const p = personajeVacio(nuevoId());
    p.nombre = 'Personaje sin nombre';
    p.campanaId = campanaId;
    // Nivel 0 es legítimo en Anima, así que se respeta el 0; sólo se descartan los negativos.
    p.categorias = [{ categoria: '', nivel: Math.max(0, nivelInicial) }];
    void almacen.guardarPersonaje(p);
    setPersonajes((antes) => [...antes, p]);
    return p;
  }, []);

  const borrar = useCallback(async (id: string) => {
    await almacen.borrarPersonaje(id);
    setPersonajes((antes) => antes.filter((p) => p.id !== id));
  }, []);

  return { personajes, cargando, guardar, crear, borrar, recargar };
}

/**
 * El registro de tiradas de una campaña.
 *
 * Se guarda de verdad, no en memoria: antes bastaba recargar la página para perder media
 * sesión de tiradas. Y como se guarda con el resto, se sincroniza con el resto — en una
 * mesa con cuentas, el Director ve lo que han sacado sus jugadores sin que se lo canten.
 */
export function useTiradas(campanaId: string | null) {
  const [tiradas, setTiradas] = useState<Tirada[]>([]);

  const recargar = useCallback(async () => {
    setTiradas(await almacen.listarTiradas(campanaId));
  }, [campanaId]);
  useEffect(() => { void recargar(); }, [recargar]);

  const anotar = useCallback(
    async (t: Omit<Tirada, 'id' | 'actualizadoEn' | 'campanaId'>) => {
      const tirada: Tirada = {
        ...t,
        id: nuevoId(),
        campanaId,
        actualizadoEn: new Date().toISOString(),
      };
      // Se pinta antes de guardar: una tirada tiene que aparecer en cuanto se pulsa, y
      // esperar a IndexedDB para enseñarla se nota en la mesa.
      setTiradas((antes) => [tirada, ...antes]);
      await almacen.guardarTirada(tirada);
      await recargar();
    },
    [campanaId, recargar],
  );

  const vaciar = useCallback(async () => {
    await almacen.vaciarTiradas(campanaId);
    await recargar();
  }, [campanaId, recargar]);

  return { tiradas, anotar, vaciar, recargar };
}

export function useCampanas() {
  const [campanas, setCampanas] = useState<Campana[]>([]);

  const recargar = useCallback(async () => setCampanas(await almacen.listarCampanas()), []);
  useEffect(() => { void recargar(); }, [recargar]);

  const guardar = useCallback(async (c: Campana) => {
    await almacen.guardarCampana(c);
    await recargar();
  }, [recargar]);

  /**
   * Crea una campaña con lo que traiga el formulario. Recibe la campaña entera menos lo
   * que pone la propia aplicación —id, dueño y fecha— en vez de sólo el nombre: las
   * decisiones de una sesión cero se toman juntas, y con un `nombre` suelto había que
   * guardar primero y editar después.
   */
  const crear = useCallback(async (datos: Omit<Campana, 'id' | 'propietario' | 'actualizadoEn'>) => {
    const c: Campana = {
      id: nuevoId(),
      propietario: null,
      actualizadoEn: new Date().toISOString(),
      personalizados: PERSONALIZADOS_VACIOS,
      ...datos,
    };
    await almacen.guardarCampana(c);
    await recargar();
    return c;
  }, [recargar]);

  const borrar = useCallback(async (id: string) => {
    await almacen.borrarCampana(id);
    await recargar();
  }, [recargar]);

  return { campanas, guardar, crear, borrar, recargar };
}

/** El reglamento de la campaña activa, o el oficial si no hay ninguna. */
export function useReglamento(campana: Campana | null, guardarCampana: (c: Campana) => void) {
  const reglamento = useMemo(
    () => (campana ? new Reglamento(campana.ajustes) : REGLAMENTO_OFICIAL),
    [campana],
  );

  const [suelto, setSuelto] = useState<Reglamento>(REGLAMENTO_OFICIAL);

  const cambiar = useCallback(
    (nuevo: Reglamento) => {
      if (campana) guardarCampana({ ...campana, ajustes: nuevo.serializar() });
      else setSuelto(nuevo);
    },
    [campana, guardarCampana],
  );

  return { reglamento: campana ? reglamento : suelto, cambiar };
}
