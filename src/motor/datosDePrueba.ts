/**
 * Los datos del Core Exxet tal cual, para las pruebas que calculan fichas enteras.
 *
 * Es lo mismo que monta `cargarDatosCalculo` con el catálogo, pero sin pasar por él: las
 * pruebas que comparan con la hoja de cálculo necesitan el manual a pelo, sin paquetes.
 */
import { secundariaDeCatalogo, type DatosCalculo } from './personaje';
import razas from '../../data/reglas/razas.json';
import categorias from '../../data/reglas/categorias.json';
import tablasBase from '../../data/reglas/tablasBase.json';
import armasJson from '../../data/reglas/armas.json';
import armadurasJson from '../../data/reglas/armaduras.json';
import objetosJson from '../../data/reglas/objetos.json';
import secundariasJson from '../../data/reglas/secundarias.json';
import yelmosJson from '../../data/reglas/yelmos.json';
import ventajasJson from '../../data/reglas/ventajas.json';
import habilidadesKiJson from '../../data/reglas/habilidadesKi.json';
import artesMarcialesJson from '../../data/reglas/artesMarciales.json';
import arsMagnusJson from '../../data/reglas/arsMagnus.json';
import legadosJson from '../../data/reglas/legadosSangre.json';
import metamagiaJson from '../../data/reglas/metamagia.json';
import efectosTecnicaJson from '../../data/reglas/efectosTecnica.json';
import tiposEfectoJson from '../../data/reglas/tiposEfectoTecnica.json';
import type {
  Arma, Armadura, Categoria, EfectoTecnica, EntradaTabla, EsferaMetamagica, HabilidadKiCatalogo,
  LegadoSangre, Objeto, Raza, Secundaria, TablasBase, TipoEfectoTecnica, Ventaja, Yelmo,
} from '../datos/tipos';

export function datosDelManual(raza: string, categoria: string): DatosCalculo {
  return {
    raza: (razas as Raza[]).find((r) => r.raza === raza),
    categoria: (categorias as unknown as Categoria[]).find((c) => c.categoria === categoria),
    categorias: categorias as unknown as Categoria[],
    tablas: tablasBase as unknown as TablasBase,
    armas: armasJson as Arma[],
    // Como `cargarDatosCalculo`: los yelmos son piezas de armadura con otra columna de nombre.
    armaduras: [
      ...(armadurasJson as Armadura[]),
      ...(yelmosJson as Yelmo[]).map(({ yelmo, ...resto }) => ({ ...resto, armadura: yelmo, esYelmo: true }) as Armadura),
    ],
    objetos: objetosJson as Objeto[],
    secundarias: (secundariasJson as Secundaria[]).map(secundariaDeCatalogo),
    ventajas: ventajasJson as Ventaja[],
    habilidadesKi: habilidadesKiJson as HabilidadKiCatalogo[],
    artesMarciales: artesMarcialesJson as EntradaTabla[],
    arsMagnus: arsMagnusJson as EntradaTabla[],
    legadosSangre: legadosJson as LegadoSangre[],
    metamagia: metamagiaJson as EsferaMetamagica[],
    efectosTecnica: efectosTecnicaJson as EfectoTecnica[],
    tiposEfectoTecnica: tiposEfectoJson as TipoEfectoTecnica[],
  };
}
