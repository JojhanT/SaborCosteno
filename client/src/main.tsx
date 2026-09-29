import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './shared/styles/base.css';
import './shared/styles/components.css';
import { App } from './app/App';
import { reloadOnce } from './shared/lib/update';

// una pestaña con una versión anterior pidió un archivo que ya no existe
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnce();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
