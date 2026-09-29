import { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, LogOut } from 'lucide-react';
import { Modal, ModalClose, toast } from '../../shared/components/ui';
import { PasswordChecks, PasswordInput, passwordProblems } from '../../shared/components/PasswordInput';
import { changePassword, logout, useMe } from '../../shared/lib/session';
import { AccessLayout } from './AccessLayout';

function usePasswordForm(onDone: (closed: number) => void) {
  const username = useMe()?.user?.username ?? '';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!current) return setError('Escribe tu contraseña actual');
    if (passwordProblems(next, username).some((p) => !p.ok)) return setError('La contraseña nueva todavía no cumple las reglas');
    if (next !== next2) return setError('Las dos contraseñas nuevas no coinciden');
    setBusy(true);
    try {
      onDone(await changePassword(current, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar');
    } finally {
      setBusy(false);
    }
  };

  const fields = (
    <>
      <label className="field">
        <span>Contraseña actual</span>
        <PasswordInput value={current} onChange={setCurrent} autoFocus />
      </label>
      <label className="field">
        <span>Contraseña nueva</span>
        <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
      </label>
      <label className="field">
        <span>Repite la nueva</span>
        <PasswordInput value={next2} onChange={setNext2} autoComplete="new-password" />
      </label>
      <PasswordChecks password={next} username={username} />
      {error && <p className="access-error">{error}</p>}
    </>
  );
  return { fields, busy, submit };
}

const doneToast = (closed: number) =>
  toast('Contraseña cambiada', { text: closed ? `Se cerró tu sesión en ${closed} equipo${closed === 1 ? '' : 's'} más` : 'Úsala la próxima vez que entres', art: 'menu' });

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const form = usePasswordForm((closed) => {
    doneToast(closed);
    onClose();
  });
  return (
    <Modal open onClose={onClose} className="confirm pass-modal">
      <ModalClose onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.submit();
        }}
      >
        <h2 className="display">
          <KeyRound /> Cambiar mi contraseña
        </h2>
        <p className="muted">Por seguridad se cerrará tu sesión en los demás equipos.</p>
        {form.fields}
        <div className="row confirm-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={form.busy}>
            {form.busy ? <span className="spinner" /> : <KeyRound />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** El administrador asignó una contraseña temporal: hay que cambiarla antes de seguir. */
export function ForcePasswordChange() {
  const name = useMe()?.user?.name ?? '';
  const form = usePasswordForm(doneToast);
  return (
    <AccessLayout title={`Hola, ${name.split(' ')[0]}`} text="Tu contraseña es temporal. Crea una propia para continuar.">
      <motion.form
        className="access-panel setup tone-orange"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          void form.submit();
        }}
      >
        {form.fields}
        <button className="btn primary lg block" disabled={form.busy}>
          {form.busy ? <span className="spinner" /> : <KeyRound />} Guardar y continuar
        </button>
        <button type="button" className="btn ghost" onClick={() => void logout()}>
          <LogOut /> Salir
        </button>
        <div className="band thin home-tile-band" />
      </motion.form>
    </AccessLayout>
  );
}
