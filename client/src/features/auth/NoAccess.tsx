import { ArrowLeft, LogOut } from 'lucide-react';
import { Logo } from '../../shared/components/ui';
import { logout, ROLE_LABEL, useMe } from '../../shared/lib/session';
import { navigate } from '../../shared/lib/router';
import { hasAny, landingPath, type Screen } from '../../app/routes';
import { AccessLayout } from './AccessLayout';

export function NoAccess({ screen }: { screen: Screen }) {
  const me = useMe()!;
  const user = me.user!;
  // tiene el permiso pero la pantalla está apagada en Ajustes
  const disabled = hasAny(me, screen.permission);
  return (
    <AccessLayout
      title={disabled ? `${screen.title}: apagada` : 'No tienes acceso aquí'}
      text={disabled ? 'Esta pantalla está desactivada en este momento.' : `La pantalla ${screen.title.toLowerCase()} no es para tu rol.`}
    >
      <section className="access-panel tone-terra">
        <Logo kind="hat" className="access-hat" />
        <p className="muted">
          {disabled ? (
            <>
              El administrador la puede activar en <b>Menú y ajustes → Ajustes</b>.
            </>
          ) : (
            <>
              Entraste como <b>{user.name}</b> ({ROLE_LABEL[user.role]}). Si necesitas esta pantalla, pídele al administrador que te cambie el rol o entra con otro usuario.
            </>
          )}
        </p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn outline" onClick={() => navigate(landingPath(me), { replace: true })}>
            <ArrowLeft /> Ir a mi pantalla
          </button>
          <button className="btn primary" onClick={() => void logout()}>
            <LogOut /> Cambiar de usuario
          </button>
        </div>
        <div className="band thin home-tile-band" />
      </section>
    </AccessLayout>
  );
}
