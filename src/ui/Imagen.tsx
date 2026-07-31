import { useEffect, useState } from 'react';
import { obtenerImagen } from '../almacen/imagenes';

/**
 * Muestra una imagen guardada en IndexedDB.
 * Crea una URL de objeto y la revoca al desmontar para no filtrar memoria.
 */
export function Imagen({
  id,
  alt,
  className,
  onClick,
}: {
  id: string | null | undefined;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!id) { setUrl(null); return; }
    let vigente = true;
    let creada: string | null = null;

    obtenerImagen(id)
      .then((img) => {
        if (!vigente) return;
        if (!img) { setFallo(true); return; }
        creada = URL.createObjectURL(img.datos);
        setUrl(creada);
      })
      .catch(() => vigente && setFallo(true));

    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [id]);

  if (!id) return null;
  if (fallo) {
    return <div className={`imagen-fallo ${className ?? ''}`} title="La imagen ya no está guardada">?</div>;
  }
  if (!url) return <div className={`imagen-cargando ${className ?? ''}`} />;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onClick={onClick}
      style={onClick ? { cursor: 'zoom-in' } : undefined}
    />
  );
}

/** Visor a pantalla completa, para mirar un mapa con detalle. */
export function VisorImagen({ id, alt, onCerrar }: { id: string; alt: string; onCerrar: () => void }) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  return (
    <div className="visor" role="dialog" aria-modal="true" aria-label={alt} onClick={onCerrar}>
      <button className="accion visor-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
      <Imagen id={id} alt={alt} className="visor-imagen" />
    </div>
  );
}
