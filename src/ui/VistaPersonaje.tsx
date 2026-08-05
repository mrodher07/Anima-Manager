import { useState } from 'react';
import type { Catalogo } from '../datos/paquetes';
import { nivelTotalDe, type DatosCalculo, type Personaje } from '../motor/personaje';
import type { Reglamento } from '../motor/reglamento';
import type { SistemaCombate } from '../motor/combateAlternativo';
import { EditorPersonaje } from './EditorPersonaje';
import { VistaFicha } from './VistaFicha';
import { VistaMesa } from './VistaMesa';
import { Imagen } from './Imagen';

type Vista = 'ficha' | 'editor' | 'mesa';

const VISTAS: { id: Vista; texto: string }[] = [
  { id: 'ficha', texto: 'Ficha' },
  { id: 'editor', texto: 'Editar' },
  { id: 'mesa', texto: 'Mesa' },
];

interface Props {
  personaje: Personaje;
  datos: DatosCalculo | null;
  catalogo: Catalogo;
  reglamento: Reglamento;
  campanaId: string | null;
  sistemaCombate: SistemaCombate;
  onCambiar: (p: Personaje) => void;
  onCerrar: () => void;
}

/**
 * Un personaje abierto, con sus tres vistas dentro.
 *
 * Antes «Ficha», «Editar» y «Mesa» eran pestañas de la barra de arriba, al lado de
 * «Bestiario» o «Campañas», y aparecían y desaparecían según si había una ficha abierta.
 * Eso mezclaba dos cosas distintas: **dónde estás en la aplicación** y **qué haces con el
 * personaje que tienes delante**. Y una barra que cambia de contenido según el estado
 * obliga a mirarla cada vez en lugar de aprendérsela.
 *
 * Ahora abrir un personaje es entrar en él: la barra de arriba no se mueve, y aquí dentro
 * están sus tres vistas, con su nombre y un camino de vuelta.
 */
export function VistaPersonaje({
  personaje,
  datos,
  catalogo,
  reglamento,
  campanaId,
  sistemaCombate,
  onCambiar,
  onCerrar,
}: Props) {
  const [vista, setVista] = useState<Vista>('ficha');

  // Sólo las categorías que tienen nombre: una ficha recién creada las trae en blanco, y
  // sin este filtro la línea salía como «1 · Nivel 1», con un número suelto sin explicar.
  const categorias = personaje.categorias
    .filter((c) => c.nivel > 0 && c.categoria)
    .map((c) => `${c.categoria} ${c.nivel}`)
    .join(' / ');
  const contexto = [personaje.raza, categorias, `Nivel ${nivelTotalDe(personaje)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <nav className="migas">
        <button className="volver" onClick={onCerrar}>
          Personajes
        </button>
        <span aria-hidden="true">›</span>
        <strong>{personaje.nombre || 'Sin nombre'}</strong>
      </nav>

      <div className="cabecera-ficha">
        {personaje.retratoId && (
          <Imagen
            id={personaje.retratoId}
            alt={`Retrato de ${personaje.nombre}`}
            className="retrato-mini"
          />
        )}
        <div>
          <h1 style={{ marginBottom: 2 }}>{personaje.nombre || 'Sin nombre'}</h1>
          <p style={{ color: 'var(--texto-tenue)', margin: 0 }}>{contexto}</p>
        </div>
      </div>

      <nav className="pestanas">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            aria-current={vista === v.id ? 'page' : undefined}
          >
            {v.texto}
          </button>
        ))}
      </nav>

      {!datos ? (
        <p style={{ color: 'var(--texto-tenue)' }}>Cargando el catálogo…</p>
      ) : (
        <>
          {vista === 'ficha' && (
            <VistaFicha personaje={personaje} datos={datos} reglamento={reglamento} />
          )}
          {vista === 'editor' && (
            <EditorPersonaje
              personaje={personaje}
              datos={datos}
              catalogo={catalogo}
              reglamento={reglamento}
              onCambiar={onCambiar}
            />
          )}
          {vista === 'mesa' && (
            <VistaMesa
              personaje={personaje}
              datos={datos}
              catalogo={catalogo}
              reglamento={reglamento}
              campanaId={campanaId}
              sistemaCombate={sistemaCombate}
              onCambiar={onCambiar}
            />
          )}
        </>
      )}
    </>
  );
}
