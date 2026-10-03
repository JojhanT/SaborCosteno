import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, KeyRound, Save, UserPlus } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Modal, ModalClose, toast, toastError } from '../../shared/components/ui';
import { PasswordChecks, PasswordInput, passwordProblems } from '../../shared/components/PasswordInput';
import { ROLE_INFO, ROLE_LABEL } from '../../shared/lib/session';
import { usersApi, type StaffUser, type UserForm } from './api';
import type { Role } from '../../shared/types';

const ROLES: Role[] = ['mesero', 'cajero', 'cocinero', 'repartidor', 'admin'];

const cleanUsername = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30);

/** Sugiere un usuario a partir del nombre: "María Pérez" → "maria". */
const suggest = (name: string) => cleanUsername(name.trim().split(/\s+/)[0] ?? '');

export function UserEditor({ user, isSelf, onClose, onSaved }: { user: StaffUser | 'new'; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const isNew = user === 'new';
  const [f, setF] = useState<UserForm>(isNew ? { name: '', username: '', role: 'mesero', phone: '', active: true } : { name: user.name, username: user.username, role: user.role, phone: user.phone, active: user.active });
  const [touchedUsername, setTouchedUsername] = useState(!isNew);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [mustChange, setMustChange] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<UserForm>) => setF((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    if (f.name.trim().length < 2) return toast('Escribe el nombre de la persona', { kind: 'error' });
    if (!/^[a-z0-9._-]{3,30}$/.test(f.username)) return toast('El usuario debe tener de 3 a 30 letras o números, sin espacios', { kind: 'error' });
    if (isNew) {
      if (passwordProblems(password, f.username).some((p) => !p.ok)) return toast('La contraseña todavía no cumple las reglas', { kind: 'error' });
      if (password !== password2) return toast('Las dos contraseñas no coinciden', { kind: 'error' });
    }
    setBusy(true);
    try {
      if (isNew) await usersApi.create({ ...f, name: f.name.trim(), password, mustChange });
      else await usersApi.update(user.id, { ...f, name: f.name.trim() });
      toast(isNew ? `${f.name.trim()} ya puede entrar` : 'Usuario guardado', { text: isNew ? `Usuario: ${f.username}` : undefined, art: ROLE_INFO[f.role].art });
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="uedit">
      <ModalClose onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="uedit-body">
          <h2 className="display">{isNew ? 'Nuevo usuario' : `Editar a ${user.name.split(' ')[0]}`}</h2>

          <div className="uedit-row">
            <label className="field">
              <span>Nombre</span>
              <input
                className="input"
                autoFocus
                value={f.name}
                maxLength={60}
                placeholder="Ej: Carla Gómez"
                onChange={(e) => set({ name: e.target.value, ...(touchedUsername ? {} : { username: suggest(e.target.value) }) })}
              />
            </label>
            <label className="field">
              <span>Usuario para entrar</span>
              <input
                className="input"
                value={f.username}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Ej: carla"
                onChange={(e) => {
                  setTouchedUsername(true);
                  set({ username: cleanUsername(e.target.value) });
                }}
              />
            </label>
          </div>

          <div className="field">
            <span>Rol · qué puede hacer</span>
            <div className="role-pick">
              {ROLES.map((r) => (
                <button type="button" key={r} className={`role-opt tone-${ROLE_INFO[r].tone} ${f.role === r ? 'on' : ''}`} disabled={isSelf && r !== f.role} onClick={() => set({ role: r })}>
                  <span className="role-opt-art">
                    <Art name={ROLE_INFO[r].art} />
                  </span>
                  <span className="grow">
                    <b>{ROLE_LABEL[r]}</b>
                    <small>{ROLE_INFO[r].text}</small>
                  </span>
                  {f.role === r && (
                    <motion.span layoutId="role-check" className="role-check">
                      <Check />
                    </motion.span>
                  )}
                </button>
              ))}
            </div>
            {isSelf && <small className="muted">No puedes cambiar tu propio rol.</small>}
          </div>

          <label className="field">
            <span>Celular {f.role === 'repartidor' ? '(para llamarlo cuando salga un domicilio)' : '(opcional)'}</span>
            <input className="input" inputMode="tel" value={f.phone} maxLength={30} placeholder="300 000 0000" onChange={(e) => set({ phone: e.target.value })} />
          </label>

          {isNew ? (
            <div className="uedit-pass">
              <h3>
                <KeyRound /> Contraseña
              </h3>
              <div className="uedit-row">
                <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="Contraseña" />
                <PasswordInput value={password2} onChange={setPassword2} autoComplete="new-password" placeholder="Repítela" />
              </div>
              <PasswordChecks password={password} username={f.username} />
              <label className="switch">
                <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
                Pedir que la cambie la primera vez que entre
              </label>
            </div>
          ) : (
            !isSelf && (
              <label className="switch">
                <input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
                {f.active ? 'Activo: puede entrar al sistema' : 'Desactivado: no puede entrar'}
              </label>
            )
          )}
        </div>

        <footer className="pe-foot">
          <div className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? <span className="spinner" /> : isNew ? <UserPlus /> : <Save />} {isNew ? 'Crear usuario' : 'Guardar'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

/** El administrador le asigna una contraseña nueva a otra persona. */
export function PasswordReset({ user, onClose, onSaved }: { user: StaffUser; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (passwordProblems(password, user.username).some((p) => !p.ok)) return toast('La contraseña todavía no cumple las reglas', { kind: 'error' });
    if (password !== password2) return toast('Las dos contraseñas no coinciden', { kind: 'error' });
    setBusy(true);
    try {
      await usersApi.resetPassword(user.id, password, mustChange);
      toast(`Contraseña de ${user.name.split(' ')[0]} cambiada`, { text: 'Se cerró su sesión en todos los equipos', art: ROLE_INFO[user.role].art });
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="confirm pass-modal">
      <ModalClose onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 className="display">
          <KeyRound /> Nueva contraseña
        </h2>
        <p className="muted">
          Para <b>{user.name}</b> (@{user.username}). Se cerrará su sesión en todos los equipos.
        </p>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="Contraseña nueva" autoFocus />
        <PasswordInput value={password2} onChange={setPassword2} autoComplete="new-password" placeholder="Repítela" />
        <PasswordChecks password={password} username={user.username} />
        <label className="switch" style={{ fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
          Es temporal: pedir que la cambie al entrar
        </label>
        <div className="row confirm-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? <span className="spinner" /> : <KeyRound />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
