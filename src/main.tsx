import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { iniciarCopiasAutomaticas } from './escritorio/escritorio';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// En el programa de escritorio, una copia de seguridad diaria en su carpeta de datos.
iniciarCopiasAutomaticas();
