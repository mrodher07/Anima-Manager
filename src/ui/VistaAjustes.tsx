import { useState } from 'react';
import type { Cuenta } from '../nube/cuenta';
import { VistaCuenta } from './VistaCuenta';
import { VistaCopia } from './VistaCopia';

type Panel = 'cuenta' | 'copia';

interface Props {
  cuenta: Cuenta;
  onRecargar: () => void;
}

/**
 * Ajustes: la cuenta y la copia de seguridad.
 *
 * Las dos van de lo mismo —**dónde están tus datos y cómo no perderlos**— y las dos se
 * tocan una vez y se olvidan. Cada una ocupaba un sitio en la barra de arriba, que ya iba
 * cargada; juntas dejan la barra en seis secciones y se explican mejor la una al lado de la
 * otra: la nube te salva de perder el dispositivo, la copia de equivocarte.
 */
export function VistaAjustes({ cuenta, onRecargar }: Props) {
  const [panel, setPanel] = useState<Panel>('cuenta');

  return (
    <>
      <nav className="pestanas">
        <button
          onClick={() => setPanel('cuenta')}
          aria-current={panel === 'cuenta' ? 'page' : undefined}
        >
          Cuenta
        </button>
        <button
          onClick={() => setPanel('copia')}
          aria-current={panel === 'copia' ? 'page' : undefined}
        >
          Copia de seguridad
        </button>
      </nav>

      {panel === 'cuenta' && <VistaCuenta cuenta={cuenta} onRecargar={onRecargar} />}
      {panel === 'copia' && <VistaCopia onRecargar={onRecargar} />}
    </>
  );
}
