/**
 * Las seis características acumulables.
 *
 * Viven en su propio módulo porque las necesitan tanto `ki.ts` como `tecnicas.ts`, y
 * `ki.ts` ya usa `tecnicas.ts` para cobrar las Técnicas propias. Tenerlas aquí evita el
 * ciclo de importación, que en el paquete minificado se manifiesta como un
 * «Cannot access … before initialization» al arrancar.
 *
 * INT y PER se quedan fuera: el Ki es energía física y espiritual, no intelectual
 * (Core Exxet, cap. 10).
 */

export const CARACTERISTICAS_KI = ['AGI', 'CON', 'DES', 'FUE', 'POD', 'VOL'] as const;
export type CaracteristicaKi = (typeof CARACTERISTICAS_KI)[number];
