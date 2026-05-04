import { useEffect, useState } from 'react';
import { toastBus, type Toast } from './toast';

export default function ToastHost(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => toastBus.subscribe(setToasts), []);
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__message">{t.message}</span>
          {t.action && (
            <button type="button" className="toast__action" onClick={() => { t.action!.onClick(); toastBus.dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => toastBus.dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
