import { useRef, useState } from 'react';
import type { Catalogo } from '../datos/paquetes';
import { useColeccion } from './estado';
import { EditorSheele } from './EditorSheele';
import { SHEELE_VACIA, type TipoSheele } from '../motor/sheele';
import {
  CARACTERISTICAS,
  GRUPOS_SECUNDARIAS,
  SECUNDARIAS,
  calcular,
  type Caracteristica,
  type DatosCalculo,
  type Personaje,
  COSTE_NIVEL_MAGIA,
  INVOCACION,
  enMonedas,
  type ClaveInvocacion,
  type ObjetoLlevado,
} from '../motor/personaje';
import type { Reglamento } from '../motor/reglamento';
import type { EscalaArma } from '../motor/combate';
import { Selector } from './Selector';
import { Ayuda, Seccion, cuenta } from './Seccion';
import { Imagen } from './Imagen';
import { ErrorImagen, borrarImagen, guardarImagen } from '../almacen/imagenes';
import { EFECTOS } from '../motor/efectos';
import { MAX_CATEGORIAS } from '../motor/multiclase';
import { EditorKi } from './EditorKi';

interface Props {
  personaje: Personaje;
  datos: DatosCalculo;
  catalogo: Catalogo;
  reglamento: Reglamento;
  onCambiar: (p: Personaje) => void;
}

type Pestana =
  | 'identidad' | 'trasfondo' | 'caracteristicas'
  | 'habilidades' | 'ventajas' | 'equipo' | 'ki' | 'poderes';

/*
 * En el orden en que se hace un personaje, que es el del manual y el de la ficha de Excel:
 * quién es, cuánto tiene de cada característica, qué ventajas compra, en qué se gasta los
 * PD, con qué va equipado y qué poderes tiene.
 *
 * «Trasfondo» estaba la segunda y pasa al final: es texto libre que no afecta a ningún
 * número, y de segunda obligaba a saltársela cada vez para llegar a las características.
 */
const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'identidad', texto: 'Identidad' },
  { id: 'caracteristicas', texto: 'Características' },
  { id: 'ventajas', texto: 'Ventajas' },
  { id: 'habilidades', texto: 'Habilidades' },
  { id: 'equipo', texto: 'Equipo' },
  { id: 'ki', texto: 'Ki' },
  { id: 'poderes', texto: 'Poderes' },
  { id: 'trasfondo', texto: 'Trasfondo' },
];

/** Una habilidad primaria: su clave, cómo se llama y de dónde sale su coste en PD. */
interface Primaria {
  clave: string;
  nombre: string;
  /** Columna de la categoría con el coste. */
  coste: string;
  /** Coste igual para todas las categorías, cuando la tabla no trae columna. */
  costeFijo?: number;
}

const PRIMARIAS_COMBATE: Primaria[] = [
  { clave: 'HAtaque', nombre: 'Habilidad de Ataque', coste: 'costeHA' },
  { clave: 'HParada', nombre: 'Habilidad de Parada', coste: 'costeHP' },
  { clave: 'HEsquiva', nombre: 'Habilidad de Esquiva', coste: 'costeHE' },
  { clave: 'LlevarArmadura', nombre: 'Llevar Armadura', coste: 'costeLlevarArmadura' },
];

const PRIMARIAS_MISTICAS: Primaria[] = [
  { clave: 'Zeon', nombre: 'Zeón', coste: 'costeZeon' },
  { clave: 'ACT', nombre: 'ACT (Acumulación)', coste: 'costeACT' },
  { clave: 'ProyeccionMagica', nombre: 'Proyección Mágica', coste: 'costeProyeccionMagica' },
  // El Nivel de Magia cuesta 5 PD en todas las categorías: la tabla no trae columna
  // propia para él, así que se pasa fijo.
  { clave: 'NivelMagia', nombre: 'Nivel de Magia', coste: 'costeNivelMagia', costeFijo: COSTE_NIVEL_MAGIA },
  // Las cuatro de invocación. No son secundarias: no llevan el −30 de no desarrollada,
  // así que ya salen con el bono de POD (o de VOL en Controlar) aunque no gastes nada.
  ...INVOCACION.map((i) => ({ clave: i.clave, nombre: i.nombre, coste: i.coste })),
];

/**
 * Las tres monedas del manual, con nombre corto para la etiqueta y largo para quien lo lee
 * en voz alta. Puestas en fila hacen falta las dos: «Oro» cabe donde no cabe «Monedas de
 * oro (MO)», pero «Oro» a secas no dice nada fuera de contexto.
 */
const MONEDAS = [
  { clave: 'MO', corto: 'Oro', largo: 'Monedas de oro (MO)' },
  { clave: 'MP', corto: 'Plata', largo: 'Monedas de plata (MP)' },
  { clave: 'MC', corto: 'Cobre', largo: 'Monedas de cobre (MC)' },
] as const;

/** Habilidades cuyo valor sale ya calculado de la ficha, sin dividir PD entre coste. */
const VALOR_PROPIO = new Set<string>([
  'HAtaque', 'HParada', 'HEsquiva', 'LlevarArmadura', 'Zeon', 'ACT', 'NivelMagia',
  ...INVOCACION.map((i) => i.clave),
]);

const PRIMARIAS_PSIQUICAS: Primaria[] = [
  { clave: 'CV', nombre: 'Cargas Vitales (CV)', coste: 'costeCV' },
  { clave: 'ProyeccionPsiquica', nombre: 'Proyección Psíquica', coste: 'costeProyeccionPsiquica' },
];

/** Campos de trasfondo: texto libre, nada de esto lo decide la aplicación. */
const CAMPOS_TRASFONDO: { clave: keyof Personaje['trasfondo']; etiqueta: string; ayuda: string }[] = [
  { clave: 'apariencia', etiqueta: 'Apariencia', ayuda: 'Cómo se le ve: rasgos, ropa, cicatrices…' },
  { clave: 'personalidad', etiqueta: 'Personalidad', ayuda: 'Carácter, manías, cómo trata a los demás.' },
  { clave: 'motivacion', etiqueta: 'Sueños y motivación', ayuda: 'Qué persigue y por qué se levanta cada mañana.' },
  { clave: 'particularidades', etiqueta: 'Aprecia y detesta', ayuda: 'Lo que le mueve y lo que no soporta.' },
  { clave: 'historia', etiqueta: 'Historia', ayuda: 'De dónde viene y qué le trajo hasta aquí.' },
  { clave: 'contactos', etiqueta: 'Contactos y allegados', ayuda: 'Aliados, familia, deudas, enemigos.' },
  { clave: 'equipoLibre', etiqueta: 'Equipo y posesiones', ayuda: 'Lo que lleva encima y no afecta a las reglas.' },
  { clave: 'dinero', etiqueta: 'Dinero', ayuda: 'Monedas, joyas, propiedades…' },
];

export function EditorPersonaje({ personaje, datos, catalogo, reglamento, onCambiar }: Props) {
  const [pestana, setPestana] = useState<Pestana>('identidad');
  const [falloRetrato, setFalloRetrato] = useState<string | null>(null);
  const retrato = useRef<HTMLInputElement>(null);
  const razas = useColeccion(catalogo, 'razas');
  const teoremas = useColeccion(catalogo, 'teoremas');
  const mejorasSheele = useColeccion(catalogo, 'sheele');
  const categorias = useColeccion(catalogo, 'categorias');
  const armas = useColeccion(catalogo, 'armas');
  const armaduras = useColeccion(catalogo, 'armaduras');
  const yelmos = useColeccion(catalogo, 'yelmos');
  const objetos = useColeccion(catalogo, 'objetos');
  const esenciales = useColeccion(catalogo, 'habilidadesEsenciales');
  const ventajas = useColeccion(catalogo, 'ventajas');
  const legados = useColeccion(catalogo, 'legadosSangre');
  const metamagia = useColeccion(catalogo, 'metamagia');
  const conjuros = useColeccion(catalogo, 'conjuros');
  const poderes = useColeccion(catalogo, 'poderesPsiquicos');
  const ficha = calcular(personaje, datos, reglamento);
  // Las de la mesa, que pueden incluir las de la casa. Si el catálogo aún no ha cargado se
  // usan las del manual, para que la pestaña no salga vacía un instante.
  const secundarias = datos.secundarias.length > 0 ? datos.secundarias : SECUNDARIAS;

  const set = (cambios: Partial<Personaje>) => onCambiar({ ...personaje, ...cambios });
  const setPD = (clave: string, pd: number) =>
    set({ pdInvertidos: { ...personaje.pdInvertidos, [clave]: Math.max(0, pd || 0) } });
  const setEspecial = (clave: string, valor: number) =>
    set({ bonosEspeciales: { ...personaje.bonosEspeciales, [clave]: valor || 0 } });
  const setTrasfondo = (clave: keyof Personaje['trasfondo'], texto: string) =>
    set({ trasfondo: { ...personaje.trasfondo, [clave]: texto } });

  const inventario = personaje.equipo.objetos ?? [];
  /*
   * Si el catálogo se abriera con `open={inventario.length === 0}` a secas, React le
   * cambiaría el atributo en cuanto entrase el primer objeto y la lista se cerraría de
   * golpe justo mientras se está eligiendo. Con estado inicial se decide una sola vez, al
   * entrar en la pestaña, y a partir de ahí manda quien lo abre y lo cierra.
   */
  const [catalogoAbierto] = useState(inventario.length === 0);
  const cambiarObjeto = (i: number, cambios: Partial<ObjetoLlevado>) => {
    const nuevos = [...inventario];
    nuevos[i] = { ...nuevos[i], ...cambios };
    set({ equipo: { ...personaje.equipo, objetos: nuevos } });
  };

  const subirRetrato = async (f: File) => {
    try {
      const anterior = personaje.retratoId;
      const img = await guardarImagen(f, {
        tipo: 'retrato',
        nombre: personaje.nombre || 'Retrato',
        campanaId: personaje.campanaId,
        personajeId: personaje.id,
      });
      set({ retratoId: img.id });
      if (anterior) await borrarImagen(anterior);
      setFalloRetrato(null);
    } catch (e) {
      setFalloRetrato(e instanceof ErrorImagen ? e.message : 'No se ha podido subir la imagen.');
    }
  };

  return (
    <div>
      <nav className="pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            aria-current={pestana === p.id ? 'page' : undefined}
          >
            {p.texto}
          </button>
        ))}
      </nav>

      {pestana === 'identidad' && (
        <section className="panel">
          <h2>Identidad</h2>
          <div className="rejilla">
            <div>
              <div className="campo">
                <label htmlFor="nombre">Nombre</label>
                <input id="nombre" value={personaje.nombre} onChange={(e) => set({ nombre: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="jugador">Jugador</label>
                <input id="jugador" value={personaje.jugador ?? ''} onChange={(e) => set({ jugador: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="sexo">Sexo</label>
                <select
                  id="sexo"
                  value={personaje.sexo ?? 'Hombre'}
                  onChange={(e) => set({ sexo: e.target.value as 'Hombre' | 'Mujer' })}
                >
                  <option>Hombre</option>
                  <option>Mujer</option>
                </select>
              </div>
            </div>
            <div>
              <div className="campo">
                <label htmlFor="raza">Raza</label>
                <select id="raza" value={personaje.raza} onChange={(e) => set({ raza: e.target.value })}>
                  <option value="">—</option>
                  {razas.map((r) => (
                    <option key={r.raza} value={r.raza}>{r.raza}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label>Categorías y niveles</label>
                <p style={{ color: 'var(--texto-debil)', fontSize: '0.78rem', margin: '0 0 6px' }}>
                  Añade más de una para llevar un multiclase. Cada cambio de categoría
                  cuesta PD.
                </p>
                {personaje.categorias.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <select
                      value={c.categoria}
                      aria-label={`Categoría ${i + 1}`}
                      onChange={(e) => {
                        const nuevas = [...personaje.categorias];
                        nuevas[i] = { ...c, categoria: e.target.value };
                        set({ categorias: nuevas });
                      }}
                    >
                      <option value="">—</option>
                      {categorias.map((x) => (
                        <option key={x.categoria} value={x.categoria}>{x.categoria}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      style={{ width: 80 }}
                      value={c.nivel}
                      aria-label={`Niveles en categoría ${i + 1}`}
                      onChange={(e) => {
                        const nuevas = [...personaje.categorias];
                        nuevas[i] = { ...c, nivel: Math.max(0, Number(e.target.value) || 0) };
                        set({ categorias: nuevas });
                      }}
                    />
                    {personaje.categorias.length > 1 && (
                      <button
                        className="accion"
                        onClick={() => set({ categorias: personaje.categorias.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {personaje.categorias.length < MAX_CATEGORIAS && (
                  <button
                    className="accion"
                    onClick={() =>
                      set({
                        categorias: [
                          ...personaje.categorias,
                          { categoria: '', nivel: 1 },
                        ],
                      })
                    }
                  >
                    Añadir categoría
                  </button>
                )}

                {ficha.multiclase.cambios.length > 0 && (
                  <p style={{ fontSize: '0.84rem', marginTop: 10, marginBottom: 0 }}>
                    {ficha.multiclase.cambios.map((c, i) => (
                      <span key={i} style={{ display: 'block', color: 'var(--texto-tenue)' }}>
                        {c.desde} → {c.hacia}: <strong className="destacado">{c.coste} PD</strong>
                      </span>
                    ))}
                    <span style={{ display: 'block', marginTop: 4 }}>
                      Nivel <strong className="destacado">{ficha.multiclase.nivelTotal}</strong> ·{' '}
                      {ficha.multiclase.pdTotales} PD −{' '}
                      <span className="peligro-texto">{ficha.multiclase.pdEnCambios}</span> en cambios ={' '}
                      <strong className="destacado">{ficha.multiclase.pdDisponibles}</strong> disponibles
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="campo">
            <label>Retrato</label>
            {personaje.retratoId ? (
              <div>
                <Imagen id={personaje.retratoId} alt={`Retrato de ${personaje.nombre}`} className="retrato" />
                <div className="acciones-regla">
                  <button className="accion" onClick={() => retrato.current?.click()}>Cambiar</button>
                  <button
                    className="accion peligro"
                    onClick={async () => {
                      const id = personaje.retratoId;
                      set({ retratoId: null });
                      if (id) await borrarImagen(id);
                    }}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <button className="accion" onClick={() => retrato.current?.click()}>Subir retrato</button>
            )}
            <input
              ref={retrato}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirRetrato(f);
                e.target.value = '';
              }}
            />
            {falloRetrato && <p className="error-formula">{falloRetrato}</p>}
          </div>

          {datos.raza?.descripciones && (
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginBottom: 0 }}>
              <strong style={{ color: 'var(--oro)' }}>Capacidades raciales:</strong>{' '}
              {datos.raza.descripciones}
            </p>
          )}

          <div className="campo" style={{ marginTop: 14 }}>
            <label htmlFor="notas">Notas</label>
            <textarea
              id="notas"
              rows={4}
              value={personaje.notas ?? ''}
              onChange={(e) => set({ notas: e.target.value })}
            />
          </div>
        </section>
      )}

      {pestana === 'trasfondo' && (
        <section className="panel">
          <h2>Trasfondo</h2>
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.88rem', marginTop: 0 }}>
            Nada de esto lo calcula la aplicación, y así debe ser: el rol lo lleváis vosotros.
            Esto es sólo un sitio donde tenerlo escrito y a mano durante la partida.
          </p>
          {CAMPOS_TRASFONDO.map((c) => (
            <div className="campo" key={c.clave}>
              <label htmlFor={`tras-${c.clave}`}>{c.etiqueta}</label>
              <textarea
                id={`tras-${c.clave}`}
                rows={c.clave === 'historia' ? 6 : 3}
                placeholder={c.ayuda}
                value={personaje.trasfondo[c.clave] ?? ''}
                onChange={(e) => setTrasfondo(c.clave, e.target.value)}
              />
            </div>
          ))}
        </section>
      )}

      {pestana === 'caracteristicas' && (
        <section className="panel">
          <h2>Características</h2>
          <Ayuda>
            Escribe el valor <strong>comprado</strong>. Los modificadores raciales se aplican solos.
          </Ayuda>
          {/*
            Ocho campos apilados a lo ancho eran más de dos mil píxeles de recorrido para
            escribir ocho números —lo primero que se hace al crear un personaje—. En rejilla
            se ven los ocho a la vez, que además es como están en la ficha de Excel: puestos
            juntos se comparan entre sí, y de eso va repartir características.
          */}
          <div className="caracteristicas-editor">
            {CARACTERISTICAS.map((c) => {
              const v = ficha.caracteristicas[c as Caracteristica];
              const poner = (n: number) =>
                set({
                  caracteristicas: {
                    ...personaje.caracteristicas,
                    [c]: Math.min(20, Math.max(0, n || 0)),
                  },
                });
              return (
                <div className="car-editor" key={c}>
                  <label htmlFor={`car-${c}`}>{c}</label>
                  <div className="mando">
                    {/* Los botones son para el móvil: escribir en un campo numérico obliga
                        a sacar el teclado y apuntar, y aquí se sube de uno en uno. */}
                    <button
                      type="button"
                      className="paso"
                      aria-label={`Bajar ${c}`}
                      onClick={() => poner(personaje.caracteristicas[c] - 1)}
                    >
                      −
                    </button>
                    <input
                      id={`car-${c}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={20}
                      value={personaje.caracteristicas[c]}
                      onChange={(e) => poner(Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="paso"
                      aria-label={`Subir ${c}`}
                      onClick={() => poner(personaje.caracteristicas[c] + 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="derivado">
                    <span>
                      Total <strong>{v.total}</strong>
                    </span>
                    <span>
                      Bono <strong>{v.bono >= 0 ? `+${v.bono}` : v.bono}</strong>
                    </span>
                    {v.raza !== 0 && (
                      <span className="raza">
                        {v.raza > 0 ? '+' : ''}
                        {v.raza} raza
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pestana === 'habilidades' && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Habilidades primarias</h2>
            <div className="desplazable">
              <table>
                <thead>
                  <tr><th>Habilidad</th><th className="num">Coste</th><th className="num">PD</th><th className="num">Valor</th></tr>
                </thead>
                <tbody>
                  {[
                    ...PRIMARIAS_COMBATE,
                    ...PRIMARIAS_MISTICAS,
                    ...PRIMARIAS_PSIQUICAS,
                  ].map((h) => {
                    const coste = h.costeFijo ?? Number(datos.categoria?.[h.coste] ?? 0);
                    const disponible = coste > 0;
                    return (
                      <tr key={h.clave} style={disponible ? undefined : { opacity: 0.4 }}>
                        <td>{h.nombre}</td>
                        <td className="num">{disponible ? coste : '—'}</td>
                        <td className="num" style={{ width: 110 }}>
                          <input
                            type="number"
                            min={0}
                            step={coste || 1}
                            disabled={!disponible}
                            value={personaje.pdInvertidos[h.clave] ?? 0}
                            onChange={(e) => setPD(h.clave, Number(e.target.value))}
                            aria-label={`PD en ${h.nombre}`}
                          />
                        </td>
                        <td className="num destacado">
                          {h.clave === 'HAtaque' && ficha.combate.HAtaque.valor}
                          {h.clave === 'HParada' && ficha.combate.HParada.valor}
                          {h.clave === 'HEsquiva' && ficha.combate.HEsquiva.valor}
                          {h.clave === 'LlevarArmadura' && ficha.combate.llevarArmadura.valor}
                          {h.clave === 'Zeon' && ficha.zeon.valor}
                          {h.clave === 'ACT' && ficha.act.valor}
                          {h.clave === 'NivelMagia' && ficha.nivelMagia.valor}
                          {h.clave in ficha.invocacion &&
                            ficha.invocacion[h.clave as ClaveInvocacion].valor}
                          {!VALOR_PROPIO.has(h.clave) &&
                            (disponible ? Math.trunc((personaje.pdInvertidos[h.clave] ?? 0) / coste) : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <Seccion
            titulo="Habilidades secundarias"
            ayuda={
              <>
                «Nat.» marca las cinco Habilidades Naturales (+10). «Esp.» es el bono especial que te
                den raza, ventajas o poderes: se escribe a mano, igual que en la ficha original.
              </>
            }
          >
            {GRUPOS_SECUNDARIAS.map((grupo) => (
              <details key={grupo} open={grupo === 'Atléticas'}>
                <summary>{grupo}</summary>
                <div className="desplazable">
                  <table>
                    <thead>
                      <tr>
                        <th>Habilidad</th><th className="num">PD</th>
                        <th className="num">Nat.</th><th className="num">Esp.</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secundarias.filter((s) => s.grupo === grupo).map((s) => {
                        const v = ficha.secundarias[s.nombre];
                        const esNatural = personaje.habilidadesNaturales.includes(s.nombre);
                        return (
                          <tr key={s.nombre}>
                            <td>
                              {s.nombre}{' '}
                              <span style={{ color: 'var(--texto-debil)', fontSize: '0.72rem' }}>
                                {s.caracteristica}
                              </span>
                            </td>
                            <td className="num" style={{ width: 96 }}>
                              <input
                                type="number" min={0}
                                value={personaje.pdInvertidos[s.nombre] ?? 0}
                                onChange={(e) => setPD(s.nombre, Number(e.target.value))}
                                aria-label={`PD en ${s.nombre}`}
                              />
                            </td>
                            <td className="num">
                              <input
                                type="checkbox"
                                checked={esNatural}
                                style={{ width: 'auto' }}
                                aria-label={`${s.nombre} como Habilidad Natural`}
                                onChange={(e) =>
                                  set({
                                    habilidadesNaturales: e.target.checked
                                      ? [...personaje.habilidadesNaturales, s.nombre]
                                      : personaje.habilidadesNaturales.filter((n) => n !== s.nombre),
                                  })
                                }
                              />
                            </td>
                            <td className="num" style={{ width: 84 }}>
                              <input
                                type="number"
                                value={personaje.bonosEspeciales[s.nombre] ?? 0}
                                onChange={(e) => setEspecial(s.nombre, Number(e.target.value))}
                                aria-label={`Bono especial en ${s.nombre}`}
                              />
                            </td>
                            <td className={`num ${v.valor < 0 ? 'negativo' : 'destacado'}`}>
                              {v.valor > 0 ? `+${v.valor}` : v.valor}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </Seccion>
        </>
      )}

      {pestana === 'ventajas' && (
        <>
          {/*
            Los Puntos de Creación son la cuenta que hay que mirar mientras se eligen
            ventajas, así que van arriba y no se pliegan: un contador escondido no cuenta.
          */}
          <section className="panel marcador">
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              Puntos de Creación · gastados{' '}
              <strong className={ficha.puntosCreacion.gastados > ficha.puntosCreacion.disponibles ? 'peligro-texto' : 'destacado'}>
                {ficha.puntosCreacion.gastados}
              </strong>{' '}
              de <strong className="destacado">{ficha.puntosCreacion.disponibles}</strong>
              {ficha.puntosCreacion.ganados > 0 && ` (3 de partida + ${ficha.puntosCreacion.ganados} por desventajas)`}
            </p>
          </section>

          <Seccion
            titulo="Ventajas"
            resumen={cuenta(personaje.ventajas.length, 'elegida', 'elegidas', 'ninguna')}
            ayuda={
              <>
                Las marcadas «automática» modifican la ficha solas. El resto se eligen igual,
                pero su efecto lo aplicáis vosotros (o lo anotas en la columna «Esp.»).
              </>
            }
          >
            <Selector
              opciones={ventajas.filter((v) => !v.esDesventaja)}
              claveDe={(v) => v.nombre}
              detalleDe={(v) => `${v.coste} PC${EFECTOS[v.nombre] ? ' · automática' : ''}`}
              grupoDe={(v) => v.tipo}
              seleccionadas={personaje.ventajas}
              onCambiar={(v) => set({ ventajas: v })}
              etiquetaBusqueda="Buscar ventaja"
            />
          </Seccion>

          <Seccion
            titulo="Desventajas"
            resumen={
              personaje.desventajas.length
                ? `${personaje.desventajas.length} · +${ficha.puntosCreacion.ganados} PC`
                : 'ninguna'
            }
            abierta={personaje.desventajas.length > 0}
            ayuda="Dan Puntos de Creación, con un tope de 3."
          >
            <Selector
              opciones={ventajas.filter((v) => v.esDesventaja)}
              claveDe={(v) => v.nombre}
              detalleDe={(v) => `+${Math.abs(v.coste)} PC${EFECTOS[v.nombre] ? ' · automática' : ''}`}
              grupoDe={(v) => v.tipo}
              seleccionadas={personaje.desventajas}
              onCambiar={(v) => set({ desventajas: v })}
              etiquetaBusqueda="Buscar desventaja"
            />
          </Seccion>

          <Seccion
            titulo="Legados de Sangre"
            resumen={cuenta(personaje.legados?.length ?? 0, 'elegido', 'elegidos')}
            abierta={(personaje.legados ?? []).length > 0}
            ayuda={
              <>
                Poderes que se llevan en la sangre, del Dominus Exxet. Se pagan con los mismos
                Puntos de Creación que las ventajas, pero además dan{' '}
                <strong>+1 al ajuste de nivel</strong> por muchos que tengas: no suben tus bonos,
                sólo encarecen la experiencia. No se pueden coger al subir de nivel — o naces con
                ellos o no.
              </>
            }
          >
            <Selector
              opciones={legados}
              claveDe={(l) => l.legado}
              detalleDe={(l) => `${l.coste} PC`}
              seleccionadas={personaje.legados ?? []}
              onCambiar={(v) => set({ legados: v })}
              etiquetaBusqueda="Buscar Legado"
            />
            {(personaje.legados ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                {(personaje.legados ?? []).map((nombre) => {
                  const l = legados.find((x) => x.legado === nombre);
                  if (!l) return null;
                  return (
                    <p key={nombre} style={{ fontSize: '0.86rem', margin: '6px 0' }}>
                      <strong className="destacado">{l.legado}</strong>{' '}
                      <span style={{ color: 'var(--texto-debil)' }}>({l.coste} PC)</span>
                      <br />
                      {l.efecto}
                    </p>
                  );
                })}
              </div>
            )}
          </Seccion>
        </>
      )}

      {pestana === 'ki' && (
        <EditorKi
          personaje={personaje}
          ficha={ficha}
          datos={datos}
          catalogo={catalogo}
          onCambiar={onCambiar}
        />
      )}

      {pestana === 'poderes' && (
        <>
          {/*
            El orden es por cuántos personajes lo usan, no por el orden del manual: primero
            conjuros y poderes psíquicos, que son lo que tiene casi cualquiera que lance
            algo, y detrás lo de Arcana y los Espíritus del Alma, que son casos concretos.
            Antes estaba al revés y había que bajar tres pantallas para llegar a lo normal.
          */}
          <Seccion
            titulo="Conjuros"
            resumen={cuenta(personaje.conjuros.length, 'elegido', 'elegidos')}
            abierta={personaje.conjuros.length > 0 || ficha.zeon.valor > 0}
            ayuda={
              <>
                Zeón {ficha.zeon.valor} · ACT {ficha.act.valor}. Sin el Don y sin Nivel de Magia
                no podrás lanzarlos, pero puedes anotarlos igualmente.
              </>
            }
          >
            <Selector
              opciones={conjuros}
              claveDe={(c) => c.conjuro}
              detalleDe={(c) => `Nv ${c.nivel} · ${c.zeonBase ?? '—'} Zeón`}
              grupoDe={(c) => c.via}
              seleccionadas={personaje.conjuros}
              onCambiar={(v) => set({ conjuros: v })}
              etiquetaBusqueda="Buscar conjuro"
            />
          </Seccion>

          <Seccion
            titulo="Poderes psíquicos"
            resumen={cuenta(personaje.poderesPsiquicos.length, 'elegido', 'elegidos')}
            abierta={personaje.poderesPsiquicos.length > 0}
          >
            <Selector
              opciones={poderes}
              claveDe={(p) => p.poder}
              detalleDe={(p) => `Nivel ${p.nivel}`}
              grupoDe={(p) => p.disciplina}
              seleccionadas={personaje.poderesPsiquicos}
              onCambiar={(v) => set({ poderesPsiquicos: v })}
              etiquetaBusqueda="Buscar poder"
            />
          </Seccion>

          <Seccion
            titulo="Habilidades Esenciales"
            resumen={cuenta((personaje.habilidadesEsenciales ?? []).length, 'elegida', 'elegidas')}
            abierta={(personaje.habilidadesEsenciales ?? []).length > 0}
            ayuda={
              <>
                Se compran con PD y algunas piden un mínimo de Gnosis. Su efecto lo aplicáis
                vosotros: la aplicación las anota, no las calcula.
              </>
            }
          >
            <Selector
              opciones={esenciales}
              claveDe={(h) => h.nombre}
              detalleDe={(h) =>
                [h.coste ? `${h.coste} PD` : '', h.gnosis ? `Gnosis ${h.gnosis}` : '']
                  .filter(Boolean)
                  .join(' · ')
              }
              grupoDe={(h) => h._seccion ?? ''}
              seleccionadas={personaje.habilidadesEsenciales ?? []}
              onCambiar={(v) => set({ habilidadesEsenciales: v })}
              etiquetaBusqueda="Buscar habilidad esencial"
            />
          </Seccion>

          <Seccion
            titulo="Teorema de Magia"
            resumen={personaje.teorema ?? 'General'}
            abierta={false}
            ayuda={
              <>
                Cómo formula tu personaje la magia. Sólo se puede <strong>usar</strong> uno:
                puede conocer los demás, pero no beneficiarse de sus reglas especiales. Las
                cuentas de cada Teorema están en «Lo sobrenatural».
              </>
            }
          >
            <div className="campo" style={{ maxWidth: 420 }}>
              <label htmlFor="teorema">Teorema</label>
              <select
                id="teorema"
                value={personaje.teorema ?? 'General'}
                onChange={(e) => onCambiar({ ...personaje, teorema: e.target.value })}
              >
                {teoremas.length === 0 ? (
                  <option value="General">General (sistema del manual básico)</option>
                ) : (
                  teoremas.map((t) => (
                    <option key={t.teorema} value={t.teorema}>
                      {t.teorema} — {t.resumen}
                    </option>
                  ))
                )}
              </select>
            </div>
          </Seccion>

          <Seccion
            titulo="Metamagia · Arcana Shepirah"
            resumen={
              (personaje.metamagia ?? []).length
                ? `${cuenta(personaje.metamagia?.length ?? 0, 'esfera', 'esferas')} · ${ficha.metamagia.disponible} libre`
                : 'sin esferas'
            }
            abierta={(personaje.metamagia ?? []).length > 0}
            ayuda={
              <>
                Las esferas se pagan con puntos de <strong>Nivel de Magia</strong>, no con PD. Cada
                una pide además un nivel mínimo de personaje, y ese requisito no se salta ni
                teniendo puntos de sobra. Empiezas por una esfera sin requisito y te mueves sólo a
                las que estén unidas por una línea en el árbol del manual: <em>esa</em> parte la
                lleváis vosotros, porque el Excel no guarda las uniones.
              </>
            }
          >
            <p style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>
              Nivel de Magia <strong className="destacado">{ficha.nivelMagia.valor}</strong> ·
              gastado en esferas{' '}
              <strong
                className={ficha.metamagia.disponible < 0 ? 'peligro-texto' : 'destacado'}
              >
                {ficha.metamagia.gastado}
              </strong>{' '}
              · libre <strong className="destacado">{ficha.metamagia.disponible}</strong>
            </p>
            <Selector
              opciones={metamagia}
              claveDe={(m) => m.posicion}
              detalleDe={(m) =>
                `${m.habilidad} · ${m.coste} Nv. Magia` +
                (m.nivelRequerido > 0 ? ` · pide nivel ${m.nivelRequerido}` : ' · de partida')
              }
              grupoDe={(m) => (m.nivelRequerido > 0 ? `Nivel ${m.nivelRequerido}` : 'Sin requisito')}
              seleccionadas={personaje.metamagia ?? []}
              onCambiar={(v) => set({ metamagia: v })}
              etiquetaBusqueda="Buscar esfera"
            />
          </Seccion>

          <EditorSheele
            elecciones={personaje.sheele ?? SHEELE_VACIA}
            senor={{
              presencia: ficha.presencia.valor,
              // La presencia **base** es la que dobla la Proyección Mágica de la Sheele.
              presenciaBase: Math.floor(ficha.pdTotales / 20),
              turnoDesarmado: ficha.combate.turnoNatural.valor,
              resistencias: Object.fromEntries(
                Object.entries(ficha.resistencias).map(([k, v]) => [k, v.valor]),
              ),
              nivel: ficha.nivel,
              controlar: ficha.invocacion.Controlar.valor,
            }}
            tipos={(datos.tablas.tiposSheele ?? []) as unknown as TipoSheele[]}
            habilidadesDelSenor={Object.fromEntries(
              Object.entries(ficha.secundarias).map(([k, v]) => [k, v.valor]),
            )}
            mejoras={mejorasSheele}
            actDelSenor={ficha.act.valor}
            onCambiar={(sheele) => onCambiar({ ...personaje, sheele })}
          />
        </>
      )}

      {pestana === 'equipo' && (
        <>
          {/*
            * La bolsa arriba del todo y siempre a la vista.
            *
            * Estaba dentro de «Inventario», entre la explicación y el buscador de objetos, y
            * es justo el dato que se mira y se cambia más veces por partida: se compra algo,
            * se cobra un trabajo, se paga la posada. Aquí son tres campos en una fila y el
            * total al lado, sin abrir nada.
            */}
          <div className="panel bolsa">
            <div className="bolsa-monedas">
              {MONEDAS.map(({ clave, corto, largo }) => (
                <div className="campo" key={clave}>
                  <label htmlFor={`moneda-${clave}`}>
                    {corto} <span className="sigla">{clave}</span>
                  </label>
                  <input
                    id={`moneda-${clave}`}
                    type="number"
                    min={0}
                    aria-label={largo}
                    value={personaje.equipo.dinero?.[clave] ?? 0}
                    onChange={(e) =>
                      set({
                        equipo: {
                          ...personaje.equipo,
                          dinero: {
                            ...personaje.equipo.dinero,
                            [clave]: Math.max(0, Number(e.target.value) || 0),
                          },
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <dl className="bolsa-cuentas">
              <div>
                <dt>En la bolsa</dt>
                <dd className="destacado">{enMonedas(ficha.inventario.dinero) || '0 MC'}</dd>
              </div>
              <div>
                <dt>Carga</dt>
                <dd>{ficha.inventario.peso} kg</dd>
              </div>
              <div>
                <dt>Valor de lo que lleva</dt>
                <dd>{enMonedas(ficha.inventario.valor) || '0 MC'}</dd>
              </div>
            </dl>
          </div>

          {/* El equipo de combate a dos columnas y la mochila debajo, a todo el ancho:
              es la que necesita sitio para su tabla. */}
          <div className="equipo-combate">
            <Seccion
              titulo="Armadura"
              resumen={
                cuenta(personaje.equipo.armadura.length, 'pieza', 'piezas', 'sin armadura')
              }
              abierta={personaje.equipo.armadura.length > 0}
            >
              {personaje.equipo.armadura.map((pieza, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select
                    value={pieza.armadura}
                    aria-label={`Pieza de armadura ${i + 1}`}
                    onChange={(e) => {
                      const nuevas = [...personaje.equipo.armadura];
                      nuevas[i] = { ...pieza, armadura: e.target.value };
                      set({ equipo: { ...personaje.equipo, armadura: nuevas } });
                    }}
                  >
                    <option value="">—</option>
                    {armaduras.map((a) => (
                      <option key={a.armadura} value={a.armadura}>
                        {a.armadura} · req. {a.requerimiento ?? 0}
                      </option>
                    ))}
                    {/* Los yelmos son otra tabla del Excel, pero protegen igual. */}
                    <optgroup label="Yelmos">
                      {yelmos.map((y) => (
                        <option key={y.yelmo} value={y.yelmo}>
                          {y.yelmo} · req. {y.requerimiento ?? 0}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    className="accion"
                    onClick={() =>
                      set({
                        equipo: {
                          ...personaje.equipo,
                          armadura: personaje.equipo.armadura.filter((_, j) => j !== i),
                        },
                      })
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                className="accion"
                onClick={() =>
                  set({
                    equipo: {
                      ...personaje.equipo,
                      armadura: [...personaje.equipo.armadura, { armadura: '' }],
                    },
                  })
                }
                disabled={armaduras.length === 0}
              >
                Añadir pieza
              </button>

              {/*
                * El TA en fichas y no en tabla.
                *
                * Eran siete columnas de dos cifras estiradas a todo el ancho del panel: 140 px
                * por número, y la última —Energía— se salía. Como cada tipo de daño se consulta
                * suelto («¿cuánto me protege esto del fuego?»), la tabla no aportaba nada que no
                * aporte una rejilla que se reparte sola por el hueco que haya.
                */}
              <ul className="tabla-ta" aria-label="Tipo de armadura por tipo de daño">
                {Object.entries(ficha.combate.proteccion.TA).map(([tipo, valor]) => (
                  <li key={tipo}>
                    <span className="tipo">{tipo}</span>
                    <span className="valor">{valor}</span>
                  </li>
                ))}
              </ul>
              <p style={{ color: 'var(--texto-tenue)', fontSize: '0.84rem', marginBottom: 0 }}>
                Requerimiento {ficha.combate.proteccion.requisito} · Penalizador natural{' '}
                {ficha.combate.proteccion.penalizadorNatural} · Restricción de movimiento{' '}
                {ficha.combate.proteccion.restriccionMovimiento}
                {ficha.combate.proteccion.penalizadorAccionFisica < 0 &&
                  ` · ${ficha.combate.proteccion.penalizadorAccionFisica} a toda acción física`}
              </p>
            </Seccion>

            <Seccion
              titulo="Armas"
              resumen={cuenta(personaje.equipo.armas.length, 'equipada', 'equipadas', 'ninguna')}
              abierta={personaje.equipo.armas.length > 0}
            >
              {personaje.equipo.armas.map((a, i) => {
                const cambiar = (cambios: Partial<typeof a>) => {
                  const nuevas = [...personaje.equipo.armas];
                  nuevas[i] = { ...a, ...cambios };
                  set({ equipo: { ...personaje.equipo, armas: nuevas } });
                };
                const calc = ficha.combate.armas[i];
                return (
                  <div key={i} className="regla">
                    <div className="rejilla campos-arma">
                      <div className="campo">
                        <label>Arma</label>
                        <select value={a.arma} onChange={(e) => cambiar({ arma: e.target.value })}>
                          {armas.map((w) => <option key={w.arma} value={w.arma}>{w.arma}</option>)}
                        </select>
                      </div>
                      <div className="campo">
                        <label>Escala</label>
                        <select
                          value={a.escala ?? 'Normal'}
                          onChange={(e) => cambiar({ escala: e.target.value as EscalaArma })}
                        >
                          <option>Normal</option><option>Enorme</option><option>Gigante</option>
                        </select>
                      </div>
                      <div className="campo">
                        <label>Conocimiento</label>
                        <select
                          value={a.conocimiento ?? 'Conocida'}
                          onChange={(e) => cambiar({ conocimiento: e.target.value as typeof a.conocimiento })}
                        >
                          <option>Conocida</option><option>Similar</option>
                          <option>Mixta</option><option>Distinta</option>
                        </select>
                      </div>
                      <div className="campo">
                        <label>Calidad</label>
                        <input
                          type="number" min={-5} max={15} step={5}
                          value={a.calidad ?? 0}
                          onChange={(e) => cambiar({ calidad: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <label style={{ fontSize: '0.86rem', display: 'block', marginBottom: 10 }}>
                      <input
                        type="checkbox" style={{ width: 'auto', marginRight: 6 }}
                        checked={a.aDosManos ?? false}
                        onChange={(e) => cambiar({ aDosManos: e.target.checked })}
                      />
                      Empuñada a dos manos
                    </label>
                    {calc && (
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Turno <strong className="destacado">{calc.turno}</strong> · Ataque{' '}
                        <strong className="destacado">{calc.ataque}</strong> · Parada{' '}
                        <strong className="destacado">{calc.parada}</strong> · Daño{' '}
                        <strong className="destacado">{calc.dano}</strong>
                        {calc.criticos.length > 0 && ` · Críticos ${calc.criticos.join(' / ')}`}
                      </p>
                    )}
                    <div className="acciones-regla">
                      <button
                        className="accion"
                        onClick={() =>
                          set({
                            equipo: {
                              ...personaje.equipo,
                              armas: personaje.equipo.armas.filter((_, j) => j !== i),
                            },
                          })
                        }
                      >
                        Quitar arma
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                className="accion"
                disabled={armas.length === 0}
                onClick={() =>
                  set({
                    equipo: {
                      ...personaje.equipo,
                      armas: [...personaje.equipo.armas, { arma: armas[0]?.arma ?? '' }],
                    },
                  })
                }
              >
                Añadir arma
              </button>
            </Seccion>
          </div>

          <Seccion
            titulo="Inventario"
            resumen={cuenta(inventario.length, 'objeto', 'objetos', 'la mochila está vacía')}
            abierta={inventario.length > 0}
          >
            <Ayuda>
              <p>
                Es la lista de precios del manual (Core Exxet, cap. VIII). Se suma el peso y
                lo que vale todo, pero <strong>no impone nada</strong>: Ánima no pone tope de
                carga, así que llevar mucho o poco lo decidís en la mesa.
              </p>
              <p style={{ marginBottom: 0 }}>
                Una <strong>B</strong> quiere decir que el objeto es raro y sólo se encuentra
                en grandes capitales; una <strong>A</strong>, que es casi imposible de
                conseguir. 1 MO son 100 MP, y 1 MP son 10 MC.
              </p>
            </Ayuda>

            {/* Abierto sólo con la mochila vacía: es entonces cuando lo que toca es añadir. */}
            <details className="anadir-catalogo" open={catalogoAbierto}>
              <summary>Añadir objetos del catálogo</summary>
              <Selector
                opciones={objetos}
                claveDe={(o) => o.objeto}
                grupoDe={(o) => o.seccion ?? ''}
                detalleDe={(o) =>
                  [o.coste, o.peso ? `${o.peso} kg` : '', o.disponibilidad]
                    .filter(Boolean)
                    .join(' · ')
                }
                seleccionadas={inventario.map((o) => o.objeto)}
                onCambiar={(nombres) =>
                  set({
                    equipo: {
                      ...personaje.equipo,
                      // Se conservan cantidades y notas de lo que ya estaba en la mochila.
                      objetos: nombres.map(
                        (nombre) =>
                          inventario.find((o) => o.objeto === nombre) ?? { objeto: nombre, cantidad: 1 },
                      ),
                    },
                  })
                }
                etiquetaBusqueda="Buscar equipamiento"
                vacio="No hay ningún objeto en el catálogo."
              />
            </details>

            {inventario.length > 0 && (
              <div className="desplazable" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Objeto</th>
                      <th className="num">Cantidad</th>
                      <th className="num">Peso</th>
                      <th className="num">Coste</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.inventario.lineas.map((linea, i) => (
                      <tr key={linea.objeto}>
                        <td>
                          {linea.objeto}
                          {linea.disponibilidad && (
                            <span style={{ color: 'var(--texto-tenue)' }}> · {linea.disponibilidad}</span>
                          )}
                          {linea.desconocido && (
                            <span style={{ color: 'var(--aviso)' }}> · fuera del catálogo</span>
                          )}
                        </td>
                        <td className="num" style={{ width: 100 }}>
                          <input
                            type="number"
                            min={1}
                            value={linea.cantidad}
                            aria-label={`Cantidad de ${linea.objeto}`}
                            onChange={(e) => cambiarObjeto(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        </td>
                        <td className="num">{linea.peso ? `${linea.peso} kg` : '—'}</td>
                        <td className="num">{linea.cobre ? enMonedas(linea.cobre) : '—'}</td>
                        <td>
                          <input
                            type="text"
                            value={linea.nota ?? ''}
                            aria-label={`Nota de ${linea.objeto}`}
                            placeholder="Dónde lo lleva, para qué…"
                            onChange={(e) => cambiarObjeto(i, { nota: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Total</td>
                      <td className="num destacado">{ficha.inventario.peso} kg</td>
                      <td className="num destacado">{enMonedas(ficha.inventario.valor)}</td>
                      {/* El dinero ya está arriba, en la bolsa: repetirlo aquí sólo confunde
                          sobre cuál de los dos manda. */}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Seccion>
        </>
      )}
    </div>
  );
}
