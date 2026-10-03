import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Copy, Globe, Wifi } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Clock, LivePill, Logo, toast } from '../../shared/components/ui';
import { navigate } from '../../shared/lib/router';
import { useLive } from '../../shared/lib/live';
import { useMe } from '../../shared/lib/session';
import { homeScreens } from '../../app/routes';
import { UserMenu } from '../auth/UserMenu';
import './home.css';

/** Cómo se ve cada pantalla en el inicio. */
const TILES: Record<string, { art: string; title: string; text: string; tone: string }> = {
  '/caja': { art: 'caja', title: 'Caja', text: 'Toma pedidos, cobra, despacha y lleva la contabilidad.', tone: 'orange' },
  '/cocina': { art: 'cocina', title: 'Cocina', text: 'Pantalla para los cocineros: ven los pedidos y los marcan listos.', tone: 'gold' },
  '/reparto': { art: 'domicilio', title: 'Reparto', text: 'Los domicilios en camino de cada repartidor.', tone: 'sea' },
  '/turnos': { art: 'turnos', title: 'Turnos', text: 'TV para clientes con voz y llamados.', tone: 'sea' },
  '/admin': { art: 'menu', title: 'Menú y ajustes', text: 'Productos, fotos, precios, ajustes y usuarios.', tone: 'terra' },
};

export function Home() {
  const { bootstrap, orders, nextTurn } = useLive();
  const me = useMe()!;
  // la misma pantalla sirve para tomar pedidos y para cobrar: se anuncia según el rol
  const cashier = me.permissions.includes('orders.charge');
  const screens = homeScreens(me, bootstrap?.settings).map((s, i) => ({
    ...s,
    ...TILES[s.path],
    ...(s.path === '/caja' && !cashier ? { title: 'Pedidos', text: 'Toma los pedidos, los manda a cocina y los entrega.' } : {}),
    key: String(i + 1),
  }));
  const lan = bootstrap?.lan ?? [];
  const inKitchen = orders.filter((o) => o.status === 'recibido').length;
  const ready = orders.filter((o) => o.status === 'listo').length;
  const onTheWay = orders.filter((o) => o.status === 'en_camino').length;
  const links = ['/cocina', '/reparto', '/caja', ...(bootstrap?.settings.turnsScreenEnabled ? ['/turnos'] : [])];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = screens.find((x) => x.key === e.key);
      if (s && !(e.target instanceof HTMLInputElement) && !document.querySelector('.modal')) navigate(s.path);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screens]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado', { text: url, art: 'turnos' });
    } catch {
      toast(url, { kind: 'info', text: 'Escríbelo en el navegador del TV o del celular' });
    }
  };

  return (
    <div className="home">
      <div className="home-glow" />
      <header className="home-top">
        <LivePill />
        <div className="spacer" />
        <Clock />
        <UserMenu />
      </header>

      <main className="home-main">
        <motion.section className="home-hero" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <Logo kind="sabor" tone="cream" className="home-logo" />
          <p className="home-tag">Hola, {me.user!.name.split(' ')[0]} · pedidos, cocina y domicilios</p>
          <div className="home-stats">
            <div>
              <b className="num display">{Math.max(0, nextTurn - 1)}</b>
              <span>pedidos hoy</span>
            </div>
            <div>
              <b className="num display">{inKitchen}</b>
              <span>en cocina</span>
            </div>
            <div>
              <b className="num display">{ready}</b>
              <span>listos</span>
            </div>
            {onTheWay > 0 && (
              <div>
                <b className="num display">{onTheWay}</b>
                <span>en camino</span>
              </div>
            )}
          </div>
        </motion.section>

        <section className="home-tiles">
          {screens.map((s, i) => (
            <motion.button
              key={s.path}
              className={`home-tile tone-${s.tone}`}
              onClick={() => navigate(s.path)}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.12 + i * 0.08, type: 'spring', damping: 20, stiffness: 180 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="home-tile-art">
                <Art name={s.art} />
              </div>
              <div className="home-tile-text">
                <h2 className="display">{s.title}</h2>
                <p>{s.text}</p>
              </div>
              <span className="home-tile-key">{s.key}</span>
              <ArrowUpRight className="home-tile-arrow" />
              <div className="band thin home-tile-band" />
            </motion.button>
          ))}
        </section>
      </main>

      {me.user!.role === 'admin' && (
        <footer className="home-foot">
          <div className="home-lan">
            {bootstrap?.online ? <Globe /> : <Wifi />}
            <span>Abre las pantallas desde los TV, tablets o celulares{bootstrap?.online ? ' con internet' : ' conectados al mismo wifi'}:</span>
            {lan.length === 0 && <span className="muted">no se detectó red local</span>}
            {lan.slice(0, 1).flatMap((base) =>
              links.map((p) => (
                <button key={base + p} className="chip lan-chip" onClick={() => copy(base + p)}>
                  {base.replace(/^https?:\/\//, '')}
                  {p}
                  <Copy />
                </button>
              )),
            )}
          </div>
        </footer>
      )}
      <div className="band home-band" />
    </div>
  );
}
