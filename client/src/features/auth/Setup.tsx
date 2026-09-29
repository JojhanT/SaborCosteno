import { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, ShieldCheck, Terminal, UserCog } from 'lucide-react';
import { PasswordChecks, PasswordInput, passwordProblems } from '../../shared/components/PasswordInput';
import { setup, type Me } from '../../shared/lib/session';
import { navigate } from '../../shared/lib/router';
import { AccessLayout } from './AccessLayout';

/**
 * Primera vez (o recuperación): se crea la cuenta del administrador. En el PC del sistema
 * basta con el formulario; desde otro equipo se pide el código que muestra la consola del servidor.
 */
export function Setup({ me }: { me: Me }) {
  const needsCode = !me.canSetup;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [device, setDevice] = useState('Caja principal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (needsCode && code.replace(/[^a-z0-9]/gi, '').length !== 8) return setError('Escribe el código de instalación (8 letras y números)');
    if (name.trim().length < 2) return setError('Escribe tu nombre');
    if (!/^[a-z0-9._-]{3,30}$/i.test(username.trim())) return setError('El usuario debe tener de 3 a 30 letras o números, sin espacios');
    if (passwordProblems(password, username.trim()).some((p) => !p.ok)) return setError('La contraseña todavía no cumple las reglas');
    if (password !== password2) return setError('Las dos contraseñas no coinciden');
    setBusy(true);
    try {
      await setup({ name: name.trim(), username: username.trim(), password, device: device.trim(), code: needsCode ? code.trim() : undefined });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccessLayout
      title={
        <>
          <ShieldCheck /> {me.recovery ? 'Recuperar el administrador' : 'Protejamos el sistema'}
        </>
      }
      text={
        me.recovery
          ? 'Crea una cuenta de administrador nueva o escribe un usuario que ya exista para darle una contraseña nueva.'
          : 'Crea la cuenta del dueño. Después, desde Menú y ajustes → Usuarios, creas las de cajeros, cocineros y repartidores.'
      }
    >
      <motion.form
        className="access-panel setup tone-orange"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {needsCode && (
          <div className="setup-block">
            <h3>
              <Terminal /> Código de instalación
            </h3>
            <input
              className="input setup-code"
              autoFocus
              value={code}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <small className="muted">
              Por seguridad solo lo ve quien administra el servidor: aparece en su consola (en Docker, con <code>docker compose logs app</code>).
            </small>
          </div>
        )}

        <div className="setup-block main">
          <h3>
            <UserCog /> Cuenta del administrador <small>(el dueño)</small>
          </h3>
          <div className="setup-row">
            <label className="field">
              <span>Tu nombre</span>
              <input className="input" autoFocus={!needsCode} value={name} maxLength={60} placeholder="Ej: María Pérez" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Usuario para entrar</span>
              <input className="input" value={username} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="Ej: maria" onChange={(e) => setUsername(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="setup-block">
          <h3>
            <KeyRound /> Contraseña
          </h3>
          <div className="setup-row">
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="Contraseña" />
            <PasswordInput value={password2} onChange={setPassword2} autoComplete="new-password" placeholder="Repítela" />
          </div>
          <PasswordChecks password={password} username={username.trim()} />
          <small className="muted">Abre todo: menú, precios, ajustes, usuarios y la caja. No la compartas.</small>
        </div>

        <label className="field">
          <span>Nombre de este equipo</span>
          <input className="input" value={device} maxLength={40} onChange={(e) => setDevice(e.target.value)} />
        </label>

        {error && <p className="access-error">{error}</p>}
        <button className="btn primary lg block" disabled={busy}>
          {busy ? <span className="spinner" /> : <ShieldCheck />} {me.recovery ? 'Guardar y entrar' : 'Crear cuenta y entrar'}
        </button>
        {me.recovery && needsCode && (
          <button type="button" className="btn ghost sm" onClick={() => navigate('/', { replace: true })}>
            Volver a iniciar sesión
          </button>
        )}
        <div className="band thin home-tile-band" />
      </motion.form>
    </AccessLayout>
  );
}
