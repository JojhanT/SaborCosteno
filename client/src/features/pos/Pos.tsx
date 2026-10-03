import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Calculator, ClipboardList, PlusCircle } from 'lucide-react';
import { Clock, LivePill, Logo, toast } from '../../shared/components/ui';
import { useLive, useLiveEvents } from '../../shared/lib/live';
import { chime } from '../../shared/lib/voice';
import { useCan, useMe } from '../../shared/lib/session';
import { navigate } from '../../shared/lib/router';
import { money } from '../../shared/lib/format';
import { flyToCart } from '../../shared/lib/fly';
import { needsCustomizing } from '../../shared/lib/pricing';
import { Menu } from './Menu';
import { Cart } from './Cart';
import { Board } from '../orders/Board';
import { OrderDetail } from '../orders/OrderDetail';
import { payOrder } from '../orders/actions';
import { History } from '../accounting/History';
import { DispatchModal } from '../delivery/DispatchModal';
import { UserMenu } from '../auth/UserMenu';
import { PaymentModal } from './PaymentModal';
import { ProductModal } from './ProductModal';
import { draftActions, newKey, useDraft } from './draft';
import type { CartLine, Order, Product } from '../../shared/types';
import './pos.css';

type Tab = 'nuevo' | 'pedidos' | 'historial';

export default function Pos() {
  const { bootstrap, orders } = useLive();
  const catalog = bootstrap!.catalog;
  const draft = useDraft();
  const [picking, setPicking] = useState<{ product: Product; line: CartLine | null } | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [paying, setPaying] = useState<Order | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [dispatching, setDispatching] = useState<Order | null>(null);
  const canReports = useCan('reports.view');
  const canTake = useCan('orders.manage');
  const canCharge = useCan('orders.charge');
  const canDispatch = useCan('orders.dispatch');
  const myId = useMe()?.user?.id;
  // el cajero no arma pedidos: entra directo a la lista de lo que falta por cobrar
  const [tab, setTab] = useState<Tab>(canTake ? 'nuevo' : 'pedidos');

  /* ---- avisos: la cocina marcó listo, un repartidor entregó ---- */
  useLiveEvents((e, list) => {
    if (!e.turn || !e.by || e.by.id === myId || e.kind !== 'status') return;
    const order = list.find((o) => o.id === e.orderId);
    const place = e.type === 'mesa' ? `Mesa ${e.tableNumber}` : e.type === 'llevar' ? (e.customerName ? `Para llevar · ${e.customerName}` : 'Para llevar') : 'Domicilio';
    const who = e.by.name.split(' ')[0];
    if (e.status === 'listo' && e.prevStatus === 'recibido') {
      chime('ready', 0.7);
      toast(`¡Turno #${e.turn} listo!`, {
        text: `${place} · lo marcó ${who} en cocina`,
        art: 'campana',
        ms: 7000,
        action: order ? (e.type === 'domicilio' && canDispatch ? { label: 'Despachar', onClick: () => setDispatching(order) } : { label: 'Ver', onClick: () => setDetail(order) }) : undefined,
      });
    } else if (e.status === 'entregado' && e.prevStatus === 'en_camino' && e.by.role === 'repartidor') {
      chime('new', 0.7);
      toast(`${who} entregó el turno #${e.turn}`, { text: e.paid ? 'Pedido cerrado' : `Queda por cobrar ${money(e.total)} (lo tiene ${who})`, art: 'domicilio', ms: 7000 });
    }
  });

  const stats = useMemo(
    () => ({
      kitchen: orders.filter((o) => o.status === 'recibido').length,
      ready: orders.filter((o) => o.status === 'listo').length,
      due: orders.filter((o) => !o.paid).reduce((s, o) => s + o.total, 0),
    }),
    [orders],
  );

  const pick = useCallback((product: Product, source: Element | null) => {
    if (needsCustomizing(product)) {
      setPicking({ product, line: null });
      return;
    }
    draftActions.addLine({ key: newKey(), productId: product.id, qty: 1, option: null, removed: [], aparte: [], sauces: [], extras: [], note: '' });
    flyToCart(source);
  }, []);

  const editLine = useCallback(
    (line: CartLine) => {
      const product = catalog.products.find((p) => p.id === line.productId);
      if (product) setPicking({ product, line });
    },
    [catalog],
  );

  const editOrder = (order: Order) => {
    if (draft.lines.length && draft.editingId !== order.id) {
      toast('Termina o vacía el pedido actual primero', { kind: 'error', text: 'Hay productos sin enviar en “Nuevo pedido”.' });
      setTab('nuevo');
      return;
    }
    draftActions.loadOrder(order);
    setDetail(null);
    setTab('nuevo');
  };

  const tabs: { key: Tab; label: string; icon: ReactNode; badge?: number }[] = [
    ...(canTake ? [{ key: 'nuevo' as Tab, label: draft.editingId ? `Editando #${draft.editingTurn}` : 'Nuevo pedido', icon: <PlusCircle /> }] : []),
    { key: 'pedidos', label: canTake ? 'Pedidos' : 'Por cobrar', icon: <ClipboardList />, badge: orders.length },
    ...(canReports ? [{ key: 'historial' as Tab, label: 'Contabilidad', icon: <Calculator /> }] : []),
  ];

  return (
    <div className="pos">
      <header className="pos-top">
        <button className="pos-brand" onClick={() => navigate('/')} title="Inicio">
          <Logo kind="sc" tone="cream" className="pos-logo" />
          <span className="pos-brand-text">
            <b className="display">{canCharge ? 'Caja' : 'Pedidos'}</b>
            <small>{bootstrap!.settings.businessName}</small>
          </span>
        </button>

        <nav className="seg pos-tabs">
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              {tab === t.key && <motion.span layoutId="pos-tab" className="seg-pill" transition={{ type: 'spring', damping: 28, stiffness: 380 }} />}
              {t.icon}
              <span>{t.label}</span>
              {!!t.badge && <span className="badge num">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="pos-stats">
          <button className="pstat" onClick={() => setTab('pedidos')}>
            <span className="pstat-dot kitchen" />
            <b className="num">{stats.kitchen}</b> en cocina
          </button>
          <button className="pstat" onClick={() => setTab('pedidos')}>
            <span className="pstat-dot ready" />
            <b className="num">{stats.ready}</b> listos
          </button>
          <button className="pstat" onClick={() => setTab('pedidos')}>
            <span className="pstat-dot due" />
            <b className="num">{money(stats.due)}</b> por cobrar
          </button>
        </div>

        <div className="pos-right">
          <LivePill compact />
          <Clock />
          <UserMenu compact />
        </div>
      </header>

      <main className="pos-main">
        {tab === 'nuevo' && canTake && (
          <div className="pos-new">
            <Menu catalog={catalog} onPick={pick} />
            <Cart onEditLine={editLine} />
          </div>
        )}
        {tab === 'pedidos' && <Board onPay={setPaying} onEdit={editOrder} onDetail={setDetail} onDispatch={setDispatching} />}
        {tab === 'historial' && canReports && <History onOpen={setDetail} />}
      </main>

      {picking && (
        <ProductModal
          product={picking.product}
          catalog={catalog}
          initial={picking.line}
          onClose={() => setPicking(null)}
          onSave={(line, source) => {
            if (picking.line) draftActions.updateLine(picking.line.key, line);
            else {
              draftActions.addLine(line);
              flyToCart(source);
            }
            setPicking(null);
          }}
        />
      )}

      <OrderDetail order={detail} onClose={() => setDetail(null)} onPay={setPaying} onEdit={editOrder} onDispatch={setDispatching} />

      <DispatchModal order={dispatching} onClose={() => setDispatching(null)} onDone={(u) => detail?.id === u.id && setDetail(u)} />

      <PaymentModal
        open={!!paying}
        total={paying?.total ?? 0}
        title={`Cobrar turno #${paying?.turn ?? ''}`}
        subtitle={paying ? `${paying.items.reduce((s, i) => s + i.qty, 0)} productos` : undefined}
        busy={payBusy}
        onClose={() => setPaying(null)}
        onConfirm={async (p) => {
          if (!paying) return;
          setPayBusy(true);
          const updated = await payOrder(paying, p);
          setPayBusy(false);
          if (updated) {
            setPaying(null);
            if (detail?.id === updated.id) setDetail(updated);
          }
        }}
      />
    </div>
  );
}
