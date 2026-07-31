import { useRef, useState } from 'react';
import type { Catalogo } from '../datos/paquetes';
import { useColeccion } from './estado';
import {
  CARACTERISTICAS,
  GRUPOS_SECUNDARIAS,
  SECUNDARIAS,
  calcular,
  type Caracteristica,
  type DatosCalculo,
  type Personaje,
} from '../motor/personaje';
import type { Reglamento } from '../motor/reglamento';
import type { EscalaArma } from '../motor/combate';
import { Selector } from './Selector';
import { Imagen } from './Imagen';
import { ErrorImagen, borrarImagen, guardarImagen } from '../almacen/imagenes';

interface Props {
  personaje: Personaje;
  datos: DatosCalculo;
  catalogo: Catalogo;
  reglamento: Reglamento;
  onCambiar: (p: Personaje) => void;
}

type Pestana =
  | 'identidad' | 'trasfondo' | 'caracteristicas'
  | 'habilidades' | 'ventajas' | 'equipo' | 'poderes';

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'identidad', texto: 'Identidad' },
  { id: 'trasfondo', texto: 'Trasfondo' },
  { id: 'caracteristicas', texto: 'Características' },
  { id: 'ventajas', texto: 'Ventajas' },
  { id: 'habilidades', texto: 'Habilidades' },
  { id: 'equipo', texto: 'Equipo' },
  { id: 'poderes', texto: 'Poderes' },
];

const PRIMARIAS_COMBATE = [
  { clave: 'HAtaque', nombre: 'Habilidad de Ataque', coste: 'costeHA' },
  { clave: 'HParada', nombre: 'Habilidad de Parada', coste: 'costeHP' },
  { clave: 'HEsquiva', nombre: 'Habilidad de Esquiva', coste: 'costeHE' },
  { clave: 'LlevarArmadura', nombre: 'Llevar Armadura', coste: 'costeLlevarArmadura' },
];

const PRIMARIAS_MISTICAS = [
  { clave: 'Zeon', nombre: 'Zeón', coste: 'costeZeon' },
  { clave: 'ACT', nombre: 'ACT (Acumulación)', coste: 'costeACT' },
  { clave: 'ProyeccionMagica', nombre: 'Proyección Mágica', coste: 'costeProyeccionMagica' },
  { clave: 'NivelMagia', nombre: 'Nivel de Magia', coste: 'costeNivelMagia' },
];

const PRIMARIAS_PSIQUICAS = [
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
  const categorias = useColeccion(catalogo, 'categorias');
  const armas = useColeccion(catalogo, 'armas');
  const armaduras = useColeccion(catalogo, 'armaduras');
  const ventajas = useColeccion(catalogo, 'ventajas');
  const conjuros = useColeccion(catalogo, 'conjuros');
  const poderes = useColeccion(catalogo, 'poderesPsiquicos');
  const ficha = calcular(personaje, datos, reglamento);

  const set = (cambios: Partial<Personaje>) => onCambiar({ ...personaje, ...cambios });
  const setPD = (clave: string, pd: number) =>
    set({ pdInvertidos: { ...personaje.pdInvertidos, [clave]: Math.max(0, pd || 0) } });
  const setEspecial = (clave: string, valor: number) =>
    set({ bonosEspeciales: { ...personaje.bonosEspeciales, [clave]: valor || 0 } });
  const setTrasfondo = (clave: keyof Personaje['trasfondo'], texto: string) =>
    set({ trasfondo: { ...personaje.trasfondo, [clave]: texto } });

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
                  {razas.map((r) => (
                    <option key={r.raza} value={r.raza}>{r.raza}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="categoria">Categoría</label>
                <select id="categoria" value={personaje.categoria} onChange={(e) => set({ categoria: e.target.value })}>
                  {categorias.map((c) => (
                    <option key={c.categoria} value={c.categoria}>{c.categoria}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="nivel">Nivel</label>
                <input
                  id="nivel"
                  type="number"
                  min={1}
                  value={personaje.nivel}
                  onChange={(e) => set({ nivel: Math.max(1, Number(e.target.value) || 1) })}
                />
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
          <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
            Escribe el valor <strong>comprado</strong>. Los modificadores raciales se aplican solos.
          </p>
          <div className="rejilla">
            {CARACTERISTICAS.map((c) => {
              const v = ficha.caracteristicas[c as Caracteristica];
              return (
                <div className="campo" key={c}>
                  <label htmlFor={`car-${c}`}>
                    {c} — total {v.total}, bono {v.bono >= 0 ? `+${v.bono}` : v.bono}
                    {v.raza !== 0 && ` (${v.raza > 0 ? '+' : ''}${v.raza} raza)`}
                  </label>
                  <input
                    id={`car-${c}`}
                    type="number"
                    min={1}
                    max={20}
                    value={personaje.caracteristicas[c]}
                    onChange={(e) =>
                      set({
                        caracteristicas: {
                          ...personaje.caracteristicas,
                          [c]: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                        },
                      })
                    }
                  />
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
                    const coste = Number(datos.categoria?.[h.coste] ?? 0);
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
                          {!['HAtaque', 'HParada', 'HEsquiva', 'LlevarArmadura', 'Zeon', 'ACT'].includes(h.clave) &&
                            (disponible ? Math.trunc((personaje.pdInvertidos[h.clave] ?? 0) / coste) : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Habilidades secundarias</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              «Nat.» marca las cinco Habilidades Naturales (+10). «Esp.» es el bono especial que te
              den raza, ventajas o poderes: se escribe a mano, igual que en la ficha original.
            </p>
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
                      {SECUNDARIAS.filter((s) => s.grupo === grupo).map((s) => {
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
          </section>
        </>
      )}

      {pestana === 'ventajas' && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Puntos de Creación</h2>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              Gastados <strong className={ficha.puntosCreacion.gastados > ficha.puntosCreacion.disponibles ? 'peligro-texto' : 'destacado'}>
                {ficha.puntosCreacion.gastados}
              </strong>{' '}
              de <strong className="destacado">{ficha.puntosCreacion.disponibles}</strong>
              {ficha.puntosCreacion.ganados > 0 && ` (3 de partida + ${ficha.puntosCreacion.ganados} por desventajas)`}
            </p>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Ventajas</h2>
            <Selector
              opciones={ventajas.filter((v) => !v.esDesventaja)}
              claveDe={(v) => v.nombre}
              detalleDe={(v) => `${v.coste} PC`}
              grupoDe={(v) => v.tipo}
              seleccionadas={personaje.ventajas}
              onCambiar={(v) => set({ ventajas: v })}
              etiquetaBusqueda="Buscar ventaja"
            />
          </section>

          <section className="panel">
            <h2>Desventajas</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Dan Puntos de Creación, con un tope de 3.
            </p>
            <Selector
              opciones={ventajas.filter((v) => v.esDesventaja)}
              claveDe={(v) => v.nombre}
              detalleDe={(v) => `+${Math.abs(v.coste)} PC`}
              grupoDe={(v) => v.tipo}
              seleccionadas={personaje.desventajas}
              onCambiar={(v) => set({ desventajas: v })}
              etiquetaBusqueda="Buscar desventaja"
            />
          </section>
        </>
      )}

      {pestana === 'poderes' && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Conjuros</h2>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.86rem', marginTop: 0 }}>
              Zeón {ficha.zeon.valor} · ACT {ficha.act.valor}. Sin el Don y sin Nivel de Magia
              no podrás lanzarlos, pero puedes anotarlos igualmente.
            </p>
            <Selector
              opciones={conjuros}
              claveDe={(c) => c.conjuro}
              detalleDe={(c) => `Nv ${c.nivel} · ${c.zeonBase ?? '—'} Zeón`}
              grupoDe={(c) => c.via}
              seleccionadas={personaje.conjuros}
              onCambiar={(v) => set({ conjuros: v })}
              etiquetaBusqueda="Buscar conjuro"
            />
          </section>

          <section className="panel">
            <h2>Poderes psíquicos</h2>
            <Selector
              opciones={poderes}
              claveDe={(p) => p.poder}
              detalleDe={(p) => `Nivel ${p.nivel}`}
              grupoDe={(p) => p.disciplina}
              seleccionadas={personaje.poderesPsiquicos}
              onCambiar={(v) => set({ poderesPsiquicos: v })}
              etiquetaBusqueda="Buscar poder"
            />
          </section>
        </>
      )}

      {pestana === 'equipo' && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Armadura</h2>
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
                  {armaduras.map((a) => (
                    <option key={a.armadura} value={a.armadura}>
                      {a.armadura} · req. {a.requerimiento ?? 0}
                    </option>
                  ))}
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
                    armadura: [
                      ...personaje.equipo.armadura,
                      { armadura: armaduras[0]?.armadura ?? '' },
                    ],
                  },
                })
              }
              disabled={armaduras.length === 0}
            >
              Añadir pieza
            </button>

            <table style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>TA</th>
                  {Object.keys(ficha.combate.proteccion.TA).map((t) => <th key={t} className="num">{t}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total</td>
                  {Object.values(ficha.combate.proteccion.TA).map((v, i) => (
                    <td key={i} className="num destacado">{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p style={{ color: 'var(--texto-tenue)', fontSize: '0.84rem', marginBottom: 0 }}>
              Requerimiento {ficha.combate.proteccion.requisito} · Penalizador natural{' '}
              {ficha.combate.proteccion.penalizadorNatural} · Restricción de movimiento{' '}
              {ficha.combate.proteccion.restriccionMovimiento}
              {ficha.combate.proteccion.penalizadorAccionFisica < 0 &&
                ` · ${ficha.combate.proteccion.penalizadorAccionFisica} a toda acción física`}
            </p>
          </section>

          <section className="panel">
            <h2>Armas</h2>
            {personaje.equipo.armas.map((a, i) => {
              const cambiar = (cambios: Partial<typeof a>) => {
                const nuevas = [...personaje.equipo.armas];
                nuevas[i] = { ...a, ...cambios };
                set({ equipo: { ...personaje.equipo, armas: nuevas } });
              };
              const calc = ficha.combate.armas[i];
              return (
                <div key={i} className="regla">
                  <div className="rejilla">
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
          </section>
        </>
      )}
    </div>
  );
}
