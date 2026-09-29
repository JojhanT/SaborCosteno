import { Logo } from './ui';

export function Splash({ text = 'Preparando todo…' }: { text?: string }) {
  return (
    <div className="splash">
      <Logo kind="hat" className="splash-hat" />
      <div className="splash-bar">
        <span />
      </div>
      <p>{text}</p>
    </div>
  );
}
