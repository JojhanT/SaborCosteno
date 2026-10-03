import { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { toast, toastError } from '../../shared/components/ui';
import { api } from '../../shared/lib/api';
import { refreshBootstrap, useLive } from '../../shared/lib/live';
import { money, plain } from '../../shared/lib/format';
import { QrCarta } from '../carta/QrCarta';
import type { Settings } from '../../shared/types';

type Form = Settings;

export function SettingsPanel() {
  const { bootstrap } = useLive();
  const settings = bootstrap!.settings;
  const [f, setF] = useState<Form>(() => ({ ...settings }));
  const [feeText, setFeeText] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/settings', f);
      await refreshBootstrap();
      toast('Ajustes guardados', { text: 'Todas las pantallas se actualizaron', art: 'menu' });
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const addFee = () => {
    const v = Number(feeText);
    if (!v || f.deliveryFeePresets.includes(v)) return setFeeText('');
    set({ deliveryFeePresets: [...f.deliveryFeePresets, v].sort((a, b) => a - b).slice(0, 8) });
    setFeeText('');
  };

  return (
    <div className="apanel settings">
      <header className="apanel-head">
        <div>
          <h2 className="display">Ajustes</h2>
          <p className="muted">Se aplican al instante en la caja, la cocina y los turnos.</p>
        </div>
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Save />} Guardar ajustes
        </button>
      </header>

      <div className="settings-grid">
        <section className="scard">
          <header>
            <span className="scard-art">
              <Art name="mesa" />
            </span>
            <h3 className="display">Negocio</h3>
          </header>
          <label className="field">
            <span>Nombre del negocio</span>
            <input className="input" value={f.businessName} onChange={(e) => set({ businessName: e.target.value })} />
          </label>
          <label className="field">
            <span>Lema</span>
            <input className="input" value={f.slogan} maxLength={60} placeholder="¡ajá!" onChange={(e) => set({ slogan: e.target.value })} />
          </label>
          <label className="field">
            <span>Número de mesas</span>
            <input className="input num" type="number" min={1} max={60} value={f.tables} onChange={(e) => set({ tables: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>La jornada empieza a las (hora)</span>
            <select className="input" value={f.dayCutoffHour} onChange={(e) => set({ dayCutoffHour: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? '12:00 a. m. (medianoche)' : `${h}:00 a. m.`}
                </option>
              ))}
            </select>
            <small className="muted">Los pedidos de la madrugada cuentan para el día anterior y los turnos vuelven a empezar en 1 a esta hora.</small>
          </label>
        </section>

        <section className="scard">
          <header>
            <span className="scard-art">
              <Art name="llevar" />
            </span>
            <h3 className="display">Carta para clientes</h3>
          </header>
          <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>Esto es lo que ve quien escanea el código QR. Lo que dejes vacío, no aparece.</p>
          <label className="field">
            <span>Dirección</span>
            <input className="input" value={f.address} maxLength={120} placeholder="Calle 110 # 48 B - 15, Barrio La Francia" onChange={(e) => set({ address: e.target.value })} />
          </label>
          <label className="field">
            <span>Horario de atención</span>
            <input className="input" value={f.hours} maxLength={120} placeholder="Lunes a domingo, 5:00 p. m. a 11:00 p. m." onChange={(e) => set({ hours: e.target.value })} />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input className="input" inputMode="tel" value={f.phone} maxLength={30} placeholder="300 000 0000" onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <input className="input" inputMode="tel" value={f.whatsapp} maxLength={30} placeholder="300 000 0000" onChange={(e) => set({ whatsapp: e.target.value })} />
            <small className="muted">Se abre el chat directo. Si es el mismo del teléfono, escríbelo igual.</small>
          </label>
          <label className="field">
            <span>Instagram</span>
            <input className="input" value={f.instagram} maxLength={60} placeholder="saborcosteno" autoCapitalize="none" onChange={(e) => set({ instagram: e.target.value })} />
          </label>
          <label className="field">
            <span>Facebook</span>
            <input className="input" value={f.facebook} maxLength={60} placeholder="saborcosteno" autoCapitalize="none" onChange={(e) => set({ facebook: e.target.value })} />
          </label>
        </section>

        <QrCarta />

        <section className="scard">
          <header>
            <span className="scard-art">
              <Art name="domicilio" />
            </span>
            <h3 className="display">Domicilios</h3>
          </header>
          <div className="field">
            <span>Valores rápidos de domicilio</span>
            <div className="fee-edit">
              {f.deliveryFeePresets.map((v) => (
                <span key={v} className={`tag ${v === f.defaultDeliveryFee ? 'tag-on' : ''}`}>
                  <button type="button" className="tag-main" onClick={() => set({ defaultDeliveryFee: v })} title="Usar como valor por defecto">
                    {money(v)}
                  </button>
                  <button type="button" onClick={() => set({ deliveryFeePresets: f.deliveryFeePresets.filter((x) => x !== v) })} aria-label="Quitar">
                    <X />
                  </button>
                </span>
              ))}
              <form
                className="fee-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  addFee();
                }}
              >
                <div className="input-money">
                  <input className="input num" inputMode="numeric" placeholder="Otro" value={feeText ? plain(Number(feeText)) : ''} onChange={(e) => setFeeText(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                </div>
                <button className="btn sm icon outline" aria-label="Agregar">
                  <Plus />
                </button>
              </form>
            </div>
            <small className="muted">Toca un valor para dejarlo como predeterminado (resaltado).</small>
          </div>
          <label className="switch">
            <input type="checkbox" checked={f.showDeliveryOnTurns} onChange={(e) => set({ showDeliveryOnTurns: e.target.checked })} />
            Mostrar domicilios en la pantalla de turnos
          </label>
        </section>

        <section className="scard">
          <header>
            <span className="scard-art">
              <Art name="cocina" />
            </span>
            <h3 className="display">Cocina</h3>
          </header>
          <div className="settings-2">
            <label className="field">
              <span>Amarillo (demorado) a los</span>
              <div className="suffix">
                <input className="input num" type="number" min={1} value={f.kitchenWarnMinutes} onChange={(e) => set({ kitchenWarnMinutes: Number(e.target.value) })} />
                <i>min</i>
              </div>
            </label>
            <label className="field">
              <span>Rojo (atrasado) a los</span>
              <div className="suffix">
                <input className="input num" type="number" min={1} value={f.kitchenLateMinutes} onChange={(e) => set({ kitchenLateMinutes: Number(e.target.value) })} />
                <i>min</i>
              </div>
            </label>
          </div>
          <label className="field">
            <span>Voz de la cocina al llegar un pedido</span>
            <input className="input" value={f.voiceKitchen} onChange={(e) => set({ voiceKitchen: e.target.value })} />
          </label>
          <p className="vars">
            Puedes usar <code>{'{turno}'}</code> <code>{'{tipo}'}</code> <code>{'{mesa}'}</code> <code>{'{nombre}'}</code>
          </p>
        </section>

        <section className="scard">
          <header>
            <span className="scard-art">
              <Art name="turnos" />
            </span>
            <h3 className="display">Pantalla de turnos</h3>
          </header>
          <label className="switch">
            <input type="checkbox" checked={f.turnsScreenEnabled} onChange={(e) => set({ turnsScreenEnabled: e.target.checked })} />
            {f.turnsScreenEnabled ? 'Activada: el TV para clientes muestra los turnos' : 'Oculta: no aparece en el inicio ni se puede abrir'}
          </label>
          <label className="field">
            <span>Voz cuando el pedido está listo</span>
            <input className="input" value={f.voiceReady} onChange={(e) => set({ voiceReady: e.target.value })} />
          </label>
          <label className="field">
            <span>Voz cuando llega un pedido nuevo</span>
            <input className="input" value={f.voiceNew} onChange={(e) => set({ voiceNew: e.target.value })} />
          </label>
          <label className="field">
            <span>Mensajes de la cinta inferior (uno por línea)</span>
            <textarea className="input" rows={4} value={f.turnsMarquee.join('\n')} onChange={(e) => set({ turnsMarquee: e.target.value.split('\n') })} />
          </label>
        </section>

      </div>
    </div>
  );
}
