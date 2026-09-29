import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { isChunkError, reloadOnce } from '../lib/update';

/** Si algo falla al dibujar una pantalla, muestra un aviso en vez de dejarla en negro. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    // versión vieja en una pestaña abierta: se recarga para traer la nueva
    if (isChunkError(error)) reloadOnce();
    else console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const updating = isChunkError(this.state.error);
    return (
      <div className="splash">
        <img src="/brand/hat.png" alt="" className="splash-hat" />
        <h2 className="display" style={{ margin: 0, fontSize: 30 }}>
          {updating ? 'Actualizando el sistema…' : 'Algo salió mal en esta pantalla'}
        </h2>
        <p style={{ maxWidth: 420, textAlign: 'center' }}>
          {updating ? 'Hay una versión nueva. Si no se recarga sola en unos segundos, toca el botón.' : 'Recarga la página. Los pedidos y la información no se pierden.'}
        </p>
        <button className="btn primary lg" onClick={() => window.location.reload()}>
          <RefreshCw /> Recargar
        </button>
      </div>
    );
  }
}
