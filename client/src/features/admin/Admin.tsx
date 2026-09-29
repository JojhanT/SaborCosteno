import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Droplets, LayoutGrid, PlusSquare, Settings, Users, UtensilsCrossed } from 'lucide-react';
import { Logo } from '../../shared/components/ui';
import { navigate } from '../../shared/lib/router';
import { can, useMe, type Permission } from '../../shared/lib/session';
import { ProductsPanel } from '../catalog/ProductsPanel';
import { CategoriesPanel, ExtrasPanel, SaucesPanel } from '../catalog/CatalogPanels';
import { SettingsPanel } from '../settings/SettingsPanel';
import { UsersPanel } from '../users/UsersPanel';
import { UserMenu } from '../auth/UserMenu';
import './admin.css';

type Tab = 'productos' | 'categorias' | 'salsas' | 'adiciones' | 'ajustes' | 'usuarios';

const TABS: { key: Tab; label: string; icon: ReactNode; permission: Permission }[] = [
  { key: 'productos', label: 'Productos', icon: <UtensilsCrossed />, permission: 'catalog.manage' },
  { key: 'categorias', label: 'Categorías', icon: <LayoutGrid />, permission: 'catalog.manage' },
  { key: 'salsas', label: 'Salsas', icon: <Droplets />, permission: 'catalog.manage' },
  { key: 'adiciones', label: 'Adiciones', icon: <PlusSquare />, permission: 'catalog.manage' },
  { key: 'ajustes', label: 'Ajustes', icon: <Settings />, permission: 'settings.manage' },
  { key: 'usuarios', label: 'Usuarios', icon: <Users />, permission: 'users.manage' },
];

/** Menú y ajustes: catálogo, ajustes generales y usuarios (solo administradores). */
export default function Admin() {
  const [tab, setTab] = useState<Tab>('productos');
  const me = useMe();
  const tabs = TABS.filter((t) => can(me, t.permission));

  return (
    <div className="admin">
      <header className="admin-top">
        <button className="pos-brand" onClick={() => navigate('/')} title="Inicio">
          <Logo kind="sc" tone="cream" className="pos-logo" />
          <span className="pos-brand-text">
            <b className="display">Menú y ajustes</b>
            <small>Los cambios se ven al instante en la caja</small>
          </span>
        </button>
        <nav className="seg admin-tabs">
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              {tab === t.key && <motion.span layoutId="admin-tab" className="seg-pill" transition={{ type: 'spring', damping: 28, stiffness: 380 }} />}
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <UserMenu compact />
      </header>
      <main className="admin-main">
        {tab === 'productos' && <ProductsPanel />}
        {tab === 'categorias' && <CategoriesPanel />}
        {tab === 'salsas' && <SaucesPanel />}
        {tab === 'adiciones' && <ExtrasPanel />}
        {tab === 'ajustes' && <SettingsPanel />}
        {tab === 'usuarios' && <UsersPanel />}
      </main>
    </div>
  );
}
