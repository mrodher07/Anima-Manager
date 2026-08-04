/**
 * Fusionar lo de aquí con lo de la nube.
 *
 * Este archivo es **funciones puras a propósito**: ni red, ni base de datos, ni React. La
 * parte de una sincronización que de verdad se puede equivocar es decidir qué versión
 * gana, y esa decisión merece probarse con casos concretos en vez de comprobarse a ojo
 * abriendo la aplicación en dos móviles.
 *
 * La regla es **gana el que se tocó más tarde**, comparando `actualizadoEn`. Es la
 * resolución de conflictos más simple que existe y tiene un fallo conocido: si dos
 * dispositivos editan la misma ficha sin conectarse, el que sincronice después pisa al
 * otro. Se elige igualmente porque:
 *
 *  - En una mesa de rol, cada ficha tiene **un** dueño que la edita. El caso de dos
 *    personas escribiendo la misma ficha a la vez es raro, y cuando pasa lo normal es que
 *    la última versión sea la buena.
 *  - Las alternativas —fusión por campos, CRDTs— multiplican por diez la complejidad para
 *    un problema que aquí casi no existe.
 *
 * Lo que sí se hace bien es **no perder borrados**: borrar es marcar `borrado`, nunca
 * quitar la fila. Sin esa lápida, una ficha borrada en el móvil reaparecería en la
 * siguiente sincronización desde el portátil, que todavía la tiene.
 */

/** Lo mínimo que necesita un registro para poder sincronizarse. */
export interface Sincronizable {
  id: string;
  actualizadoEn: string;
}

/** Cómo llega un registro desde la nube. */
export interface FilaRemota {
  id: string;
  datos: unknown;
  actualizado_en: string;
  borrado: boolean;
}

export type Decision = 'sube' | 'baja' | 'iguales' | 'borra-local';

/**
 * Qué hacer con un registro que está en los dos sitios.
 *
 * Las fechas se comparan como texto ISO, que ordena igual que cronológicamente y evita
 * construir un `Date` por cada registro. Si una fecha viniera mal formada, la comparación
 * de texto sigue siendo determinista, que es lo que importa: nunca dos dispositivos
 * decidirán cosas distintas con los mismos datos.
 */
export function decidir(local: Sincronizable | undefined, remoto: FilaRemota | undefined): Decision {
  if (!local && !remoto) return 'iguales';
  if (!remoto) return 'sube';
  if (remoto.borrado) {
    // Si aquí se tocó **después** del borrado, es que se ha resucitado a propósito.
    if (local && local.actualizadoEn > remoto.actualizado_en) return 'sube';
    return local ? 'borra-local' : 'iguales';
  }
  if (!local) return 'baja';
  if (local.actualizadoEn > remoto.actualizado_en) return 'sube';
  if (local.actualizadoEn < remoto.actualizado_en) return 'baja';
  return 'iguales';
}

export interface Plan<T extends Sincronizable> {
  /** Lo que hay que mandar a la nube. */
  subir: T[];
  /** Lo que hay que guardar aquí. */
  bajar: FilaRemota[];
  /** Lo que hay que borrar aquí porque se borró en otro sitio. */
  borrarLocal: string[];
  /** Lo que ya estaba igual en los dos lados. */
  sinCambios: number;
}

/**
 * El plan completo de una sincronización, antes de tocar nada.
 *
 * Se calcula entero primero y se ejecuta después, igual que en la copia de seguridad:
 * así se puede enseñar lo que va a pasar, y sobre todo se puede probar sin una base de
 * datos delante.
 *
 * `borradosLocales` son los ids que este dispositivo ha borrado y todavía no ha
 * comunicado. Hacen falta aparte porque un registro borrado en local ya no está en la
 * lista de locales, y sin esta lista el borrado se perdería en cuanto la nube lo devolviera.
 */
export function planificar<T extends Sincronizable>(
  locales: T[],
  remotos: FilaRemota[],
  borradosLocales: { id: string; actualizadoEn: string }[] = [],
): Plan<T> {
  const porIdRemoto = new Map(remotos.map((r) => [r.id, r]));
  const borrados = new Map(borradosLocales.map((b) => [b.id, b]));

  const plan: Plan<T> = { subir: [], bajar: [], borrarLocal: [], sinCambios: 0 };
  const vistos = new Set<string>();

  for (const local of locales) {
    vistos.add(local.id);
    switch (decidir(local, porIdRemoto.get(local.id))) {
      case 'sube':
        plan.subir.push(local);
        break;
      case 'baja':
        plan.bajar.push(porIdRemoto.get(local.id)!);
        break;
      case 'borra-local':
        plan.borrarLocal.push(local.id);
        break;
      default:
        plan.sinCambios++;
    }
  }

  for (const remoto of remotos) {
    if (vistos.has(remoto.id)) continue;
    vistos.add(remoto.id);

    // ¿Lo borramos nosotros y la nube aún no se ha enterado?
    const borradoAqui = borrados.get(remoto.id);
    if (borradoAqui) {
      if (borradoAqui.actualizadoEn > remoto.actualizado_en) continue; // se sube como lápida
      // La nube lo tocó después de que lo borráramos: gana la nube y vuelve.
      if (!remoto.borrado) plan.bajar.push(remoto);
      continue;
    }

    if (!remoto.borrado) plan.bajar.push(remoto);
  }

  return plan;
}

/**
 * Los borrados de este dispositivo que la nube todavía no conoce, listos para subirse
 * como lápidas.
 */
export function lapidasPendientes(
  borradosLocales: { id: string; actualizadoEn: string }[],
  remotos: FilaRemota[],
): { id: string; actualizadoEn: string }[] {
  const porId = new Map(remotos.map((r) => [r.id, r]));
  return borradosLocales.filter((b) => {
    const r = porId.get(b.id);
    if (!r) return true; // la nube ni lo conoce
    if (!r.borrado) return b.actualizadoEn > r.actualizado_en; // sólo si lo borramos después
    return false; // ya está marcado allí
  });
}

/** Resumen para enseñar en la interfaz. */
export function resumirPlan<T extends Sincronizable>(plan: Plan<T>): string {
  const partes: string[] = [];
  if (plan.subir.length) partes.push(`${plan.subir.length} subidos`);
  if (plan.bajar.length) partes.push(`${plan.bajar.length} bajados`);
  if (plan.borrarLocal.length) partes.push(`${plan.borrarLocal.length} borrados aquí`);
  return partes.length ? partes.join(', ') : 'ya estaba todo al día';
}
