import { useState, type KeyboardEvent } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';

/** Campo de contraseña con botón para verla y aviso de Bloq Mayús. */
export function PasswordInput({
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: 'current-password' | 'new-password';
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const onKey = (e: KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div className="pass-input">
      <input
        id={id}
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={128}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onKeyUp={onKey}
        onBlur={() => setCaps(false)}
      />
      <button type="button" className="pass-eye" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'} tabIndex={-1}>
        {show ? <EyeOff /> : <Eye />}
      </button>
      {caps && <small className="pass-caps">Bloq Mayús está activado</small>}
    </div>
  );
}

/** Las mismas reglas que revisa el servidor, para que se vean mientras se escribe. */
export function passwordProblems(password: string, username = '') {
  return [
    { ok: password.length >= 8, text: 'Mínimo 8 caracteres' },
    { ok: /[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(password) && /\d/.test(password), text: 'Letras y números' },
    { ok: !username || !password.toLowerCase().includes(username.toLowerCase()), text: 'Que no contenga el usuario' },
  ];
}

export function PasswordChecks({ password, username }: { password: string; username?: string }) {
  return (
    <ul className="pass-checks">
      {passwordProblems(password, username).map((r) => (
        <li key={r.text} className={r.ok ? 'ok' : ''}>
          {r.ok ? <Check /> : <X />} {r.text}
        </li>
      ))}
    </ul>
  );
}
