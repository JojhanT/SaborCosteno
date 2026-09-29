import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Home, KeyRound, LogOut, Monitor } from 'lucide-react';
import { ask } from '../../shared/components/ui';
import { initials, logout, ROLE_INFO, ROLE_LABEL, useMe } from '../../shared/lib/session';
import { navigate, usePath } from '../../shared/lib/router';
import { ChangePasswordModal } from './ChangePassword';
import './access.css';

/** Quién está usando este equipo, con accesos a su contraseña y a cerrar sesión. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const me = useMe();
  const path = usePath();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me?.user) return null;
  const { user } = me;

  const signOut = async () => {
    setOpen(false);
    const ok = await ask({ title: '¿Cerrar sesión?', text: 'Este equipo quedará listo para que entre otra persona.', confirm: 'Cerrar sesión', art: ROLE_INFO[user.role].art });
    if (ok) await logout();
  };

  return (
    <div className="umenu" ref={ref}>
      <button className={`umenu-btn tone-${ROLE_INFO[user.role].tone}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="uavatar">{initials(user.name)}</span>
        {!compact && (
          <span className="umenu-who">
            <b>{user.name}</b>
            <small>{ROLE_LABEL[user.role]}</small>
          </span>
        )}
        <ChevronDown className="umenu-caret" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="umenu-pop" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }}>
            <div className="umenu-head">
              <b>{user.name}</b>
              <small className="muted">
                @{user.username} · {ROLE_LABEL[user.role]}
              </small>
              {me.session?.device && (
                <small className="muted">
                  <Monitor size={12} /> {me.session.device}
                </small>
              )}
            </div>
            {path !== '/' && (
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/');
                }}
              >
                <Home /> Inicio
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                setChanging(true);
              }}
            >
              <KeyRound /> Cambiar mi contraseña
            </button>
            <button className="danger" onClick={signOut}>
              <LogOut /> Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
    </div>
  );
}
