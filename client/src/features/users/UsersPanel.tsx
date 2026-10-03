import { useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, Monitor, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, Wifi } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { ask, toast, toastError } from '../../shared/components/ui';
import { useNow } from '../../shared/lib/live';
import { minutesText } from '../../shared/lib/format';
import { initials, logout, ROLE_INFO, ROLE_LABEL, useMe } from '../../shared/lib/session';
import { usersApi, type OpenSession, type StaffUser } from './api';
import { PasswordReset, UserEditor } from './UserEditor';
import type { Role } from '../../shared/types';
import './users.css';

const FILTERS: { key: Role | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'admin', label: 'Administradores' },
  { key: 'mesero', label: 'Meseros' },
  { key: 'cajero', label: 'Cajeros' },
  { key: 'cocinero', label: 'Cocineros' },
  { key: 'repartidor', label: 'Repartidores' },
];

const ago = (now: number, ts: number | null) => (!ts ? 'nunca' : now - ts < 90_000 ? 'ahora' : `hace ${minutesText(now - ts)}`);

export function UsersPanel() {
  const myId = useMe()?.user?.id;
  const [data, setData] = useState<{ users: StaffUser[]; sessions: OpenSession[] } | null>(null);
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null);
  const [resetting, setResetting] = useState<StaffUser | null>(null);
  const now = useNow(30000);

  const load = useCallback(async () => {
    try {
      setData(await usersApi.list());
    } catch (err) {
      toastError(err);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const users = data?.users ?? [];
  const list = users.filter((u) => filter === 'all' || u.role === filter);
  const count = (r: Role | 'all') => users.filter((u) => u.active && (r === 'all' || u.role === r)).length;

  const toggleActive = async (u: StaffUser) => {
    if (u.active) {
      const ok = await ask({
        title: `¿Desactivar a ${u.name}?`,
        text: 'No podrá entrar y se cerrará su sesión en todos los equipos. Sus pedidos y registros se conservan.',
        confirm: 'Desactivar',
        danger: true,
        art: ROLE_INFO[u.role].art,
      });
      if (!ok) return;
    }
    try {
      await usersApi.update(u.id, { active: !u.active });
      toast(u.active ? `${u.name} desactivado` : `${u.name} puede entrar de nuevo`, { kind: 'info', art: ROLE_INFO[u.role].art });
      void load();
    } catch (err) {
      toastError(err);
    }
  };

  const logoutUser = async (u: StaffUser) => {
    const ok = await ask({ title: `¿Cerrar la sesión de ${u.name}?`, text: 'Tendrá que volver a entrar con su contraseña en todos sus equipos.', confirm: 'Cerrar sesiones', danger: true, art: ROLE_INFO[u.role].art });
    if (!ok) return;
    try {
      const { closed } = await usersApi.logoutEverywhere(u.id);
      toast(`${closed} sesión${closed === 1 ? '' : 'es'} cerrada${closed === 1 ? '' : 's'}`, { kind: 'info' });
      void load();
    } catch (err) {
      toastError(err);
    }
  };

  const closeSession = async (s: OpenSession) => {
    if (s.current) {
      const ok = await ask({ title: '¿Cerrar la sesión de este equipo?', text: 'Tendrás que entrar de nuevo con tu contraseña.', confirm: 'Cerrar sesión', danger: true, art: ROLE_INFO[s.role].art });
      if (ok) await logout();
      return;
    }
    const ok = await ask({ title: `¿Desconectar “${s.device}”?`, text: `Es la sesión de ${s.userName}. Ese equipo saldrá de inmediato.`, confirm: 'Desconectar', danger: true, art: ROLE_INFO[s.role].art });
    if (!ok) return;
    try {
      await usersApi.closeSession(s.id);
      toast(`${s.device} desconectado`, { kind: 'info' });
      void load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="apanel">
      <header className="apanel-head">
        <div>
          <h2 className="display">Usuarios</h2>
          <p className="muted">Cada persona entra con su usuario y contraseña, y solo ve lo que su rol le permite.</p>
        </div>
        <div className="row">
          <button className="btn sm ghost" onClick={load}>
            <RefreshCw /> Actualizar
          </button>
          <button className="btn primary" onClick={() => setEditing('new')}>
            <UserPlus /> Nuevo usuario
          </button>
        </div>
      </header>

      <div className="role-filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`role-filter ${f.key !== 'all' ? `tone-${ROLE_INFO[f.key].tone}` : ''} ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
            <span className="role-filter-art">{f.key === 'all' ? <ShieldCheck /> : <Art name={ROLE_INFO[f.key].art} />}</span>
            <span className="grow">
              <b>{f.label}</b>
              <small>{f.key === 'all' ? 'Todo el personal' : ROLE_INFO[f.key].text}</small>
            </span>
            <b className="role-filter-count num">{count(f.key)}</b>
          </button>
        ))}
      </div>

      {!data ? (
        <div className="spinner" />
      ) : (
        <div className="users-grid">
          {list.map((u) => {
            const self = u.id === myId;
            return (
              <article key={u.id} className={`ucard tone-${ROLE_INFO[u.role].tone} ${u.active ? '' : 'off'}`}>
                <header>
                  <span className="uavatar lg">
                    {initials(u.name)}
                    {u.online && <i className="ucard-online" title="Conectado ahora" />}
                  </span>
                  <div className="grow">
                    <b className="ucard-name">
                      {u.name} {self && <span className="chip orange">Tú</span>}
                    </b>
                    <small className="muted">@{u.username}</small>
                  </div>
                  <span className={`chip role-chip tone-${ROLE_INFO[u.role].tone}`}>{ROLE_LABEL[u.role]}</span>
                </header>
                <div className="ucard-meta">
                  {!u.active && <span className="chip red">Desactivado</span>}
                  {u.mustChange && <span className="chip gold">Contraseña temporal</span>}
                  <span>
                    Último ingreso: <b>{ago(now, u.lastLoginAt)}</b>
                  </span>
                  <span>
                    <Monitor size={13} /> {u.sessions} equipo{u.sessions === 1 ? '' : 's'}
                    {u.sessions > 0 && u.lastSeen ? ` · activo ${ago(now, u.lastSeen)}` : ''}
                  </span>
                  {u.phone && <span>☎ {u.phone}</span>}
                </div>
                <footer>
                  <button className="btn sm outline" onClick={() => setEditing(u)}>
                    <Pencil /> Editar
                  </button>
                  {!self && (
                    <button className="btn sm ghost" onClick={() => setResetting(u)} title="Asignar una contraseña nueva">
                      <KeyRound /> Contraseña
                    </button>
                  )}
                  {!self && u.sessions > 0 && (
                    <button className="btn sm icon ghost" onClick={() => logoutUser(u)} title="Cerrar su sesión en todos los equipos">
                      <LogOut />
                    </button>
                  )}
                  <div className="spacer" />
                  {!self && (
                    <label className="switch" title={u.active ? 'Puede entrar' : 'No puede entrar'}>
                      <input type="checkbox" checked={u.active} onChange={() => toggleActive(u)} />
                    </label>
                  )}
                </footer>
              </article>
            );
          })}
          <button className="ucard ucard-new" onClick={() => setEditing('new')}>
            <Plus />
            <b>Nuevo usuario</b>
            <small>Mesero, cajero, cocinero, repartidor o administrador</small>
          </button>
        </div>
      )}

      <section className="scard">
        <header>
          <span className="scard-art">
            <ShieldCheck />
          </span>
          <div className="grow">
            <h3 className="display">Equipos con sesión abierta</h3>
            <small className="muted">Si ves un equipo que no reconoces, desconéctalo y cámbiale la contraseña a ese usuario.</small>
          </div>
        </header>
        {!data ? (
          <div className="spinner" />
        ) : data.sessions.length === 0 ? (
          <p className="muted">No hay sesiones abiertas.</p>
        ) : (
          <div className="sec-devices">
            {data.sessions.map((s) => (
              <div key={s.id} className={`sec-device ${s.current ? 'current' : ''}`}>
                <span className={`uavatar tone-${ROLE_INFO[s.role].tone}`}>
                  {initials(s.userName)}
                  {s.online && <i className="ucard-online" />}
                </span>
                <div className="grow">
                  <b>
                    {s.device} {s.current && <span className="chip orange">Este equipo</span>}
                  </b>
                  <small className="muted">
                    {s.userName} · {ROLE_LABEL[s.role]} · {s.browser} · {s.ip || 'sin IP'} · {s.online ? 'conectado ahora' : `activo ${ago(now, s.lastSeen)}`}
                  </small>
                </div>
                <button className="btn sm danger" onClick={() => closeSession(s)}>
                  {s.current ? <LogOut /> : <Trash2 />} {s.current ? 'Cerrar sesión' : 'Desconectar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sec-tip">
        <Wifi />
        <div>
          <b>Recomendado: una red wifi aparte para los clientes</b>
          <p className="muted">
            En el router activa la <b>red de invitados</b> y dásela a los clientes. Deja la caja, los TV y los celulares del personal en la red principal.
          </p>
        </div>
      </section>

      {editing && (
        <UserEditor
          user={editing}
          isSelf={editing !== 'new' && editing.id === myId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {resetting && (
        <PasswordReset
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => {
            setResetting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
