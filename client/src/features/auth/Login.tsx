import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogIn, Monitor, ShieldCheck, User } from 'lucide-react';
import { Logo } from '../../shared/components/ui';
import { PasswordInput } from '../../shared/components/PasswordInput';
import { login, rememberedDevice, useMe } from '../../shared/lib/session';
import { navigate } from '../../shared/lib/router';
import { landingPath } from '../../app/routes';
import { AccessLayout } from './AccessLayout';

export function Login() {
  const me = useMe();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [device, setDevice] = useState(rememberedDevice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ n: number; text: string } | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) return setError({ n: (error?.n ?? 0) + 1, text: 'Escribe tu usuario y tu contraseña' });
    setBusy(true);
    try {
      const me = await login(username.trim(), password, device.trim());
      if (me) navigate(landingPath(me), { replace: true });
    } catch (err) {
      setPassword('');
      setError({ n: (error?.n ?? 0) + 1, text: err instanceof Error ? err.message : 'No se pudo entrar' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccessLayout title="Inicia sesión" text="Con tu usuario y contraseña. Este equipo queda recordado.">
      <motion.form
        className="access-panel login-panel"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Logo kind="hat" className="login-hat" />
        <motion.div key={error?.n} className="login-fields" animate={error ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.4 }}>
          <label className="field">
            <span>
              <User size={13} /> Usuario
            </span>
            <input
              className="input"
              value={username}
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              placeholder="Ej: carla"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <PasswordInput value={password} onChange={setPassword} placeholder="Tu contraseña" />
          </label>
          <label className="field">
            <span>
              <Monitor size={13} /> Nombre de este equipo <small className="muted">(opcional)</small>
            </span>
            <input className="input" value={device} maxLength={40} placeholder="Ej: Caja principal, TV cocina, celular de Pedro" onChange={(e) => setDevice(e.target.value)} />
          </label>
        </motion.div>
        <AnimatePresence>
          {error && (
            <motion.p key={error.n} className="access-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              {error.text}
            </motion.p>
          )}
        </AnimatePresence>
        <button className="btn primary lg block" disabled={busy}>
          {busy ? <span className="spinner" /> : <LogIn />} Entrar
        </button>
        <p className="muted login-help">¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.</p>
        {me?.recovery && (
          <button type="button" className="btn ghost sm" onClick={() => navigate('/recuperar')}>
            <ShieldCheck /> Soy el administrador: recuperar con el código
          </button>
        )}
        <div className="band thin home-tile-band" />
      </motion.form>
    </AccessLayout>
  );
}
