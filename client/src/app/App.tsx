import { Suspense, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { navigate, usePath } from '../shared/lib/router';
import { startLive, stopLive, useLive } from '../shared/lib/live';
import { refreshMe, useMe } from '../shared/lib/session';
import { useUpdateAvailable } from '../shared/lib/update';
import { DialogHost, Toaster } from '../shared/components/ui';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { Splash } from '../shared/components/Splash';
import { Home } from '../features/home/Home';
import { Login } from '../features/auth/Login';
import { Setup } from '../features/auth/Setup';
import { NoAccess } from '../features/auth/NoAccess';
import { ForcePasswordChange } from '../features/auth/ChangePassword';
import { canOpen, findScreen, landingPath, skipsHome } from './routes';

export function App() {
  const path = usePath();
  const me = useMe();
  const { bootstrap, connected } = useLive();
  // la conexión en vivo solo se abre con un usuario que ya puede trabajar
  const liveKey = me?.user && !me.user.mustChange ? me.session?.id : undefined;
  const screen = findScreen(path);

  useEffect(() => void refreshMe(), []);
  useEffect(() => {
    if (liveKey) startLive();
    else stopLive();
  }, [liveKey]);
  useEffect(() => {
    const name = bootstrap?.settings.businessName ?? 'Sabor Costeño';
    document.title = screen ? `${screen.title} · ${name}` : `${name} · ¡ajá!`;
  }, [screen, bootstrap]);

  let content;
  if (!me) content = <Splash text="Conectando con el servidor…" />;
  // en recuperación, los demás equipos siguen entrando normalmente; el dueño va a /recuperar con el código
  else if (me.setupRequired && (me.canSetup || !me.recovery || path === '/recuperar')) content = <Setup me={me} />;
  else if (!me.user) content = <Login />;
  else if (me.user.mustChange) content = <ForcePasswordChange />;
  else if (!bootstrap) content = <Splash text={connected ? 'Cargando el menú…' : 'Conectando con el servidor…'} />;
  else if (screen) {
    const Page = screen.component;
    content = canOpen(screen, me, bootstrap.settings) ? <Page /> : <NoAccess screen={screen} />;
  } else if (path !== '/' || skipsHome(me, bootstrap.settings)) {
    content = <Redirect to={path === '/' ? landingPath(me) : '/'} />;
  } else content = <Home />;

  return (
    <>
      <ErrorBoundary key={path}>
        <Suspense fallback={<Splash />}>{content}</Suspense>
      </ErrorBoundary>
      <UpdateBanner />
      <Toaster />
      <DialogHost />
    </>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return <Splash />;
}

/** En la caja no se recarga sola (podría estar cobrando): se ofrece actualizar. */
function UpdateBanner() {
  const available = useUpdateAvailable();
  if (!available) return null;
  return (
    <button className="update-banner" onClick={() => window.location.reload()}>
      <RefreshCw />
      <span>
        <b>Hay una versión nueva del sistema</b>
        <small>Toca aquí para actualizar · el pedido que estás armando no se pierde</small>
      </span>
    </button>
  );
}
