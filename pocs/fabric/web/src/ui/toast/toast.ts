export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

type Listener = (toasts: Toast[]) => void;

class ToastBus {
  private toasts: Toast[] = [];
  private listeners = new Set<Listener>();
  private nextId = 1;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => { this.listeners.delete(listener); };
  }

  push(kind: ToastKind, message: string, action?: Toast['action']): number {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { id, kind, message, action }];
    this.notify();
    // auto-dismiss after 5s for info/success; errors stay until dismissed
    if (kind !== 'error') setTimeout(() => this.dismiss(id), 5000);
    return id;
  }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  private notify(): void {
    for (const l of this.listeners) l(this.toasts);
  }
}

export const toastBus = new ToastBus();

export const notify = {
  info:    (message: string, action?: Toast['action']) => toastBus.push('info', message, action),
  success: (message: string, action?: Toast['action']) => toastBus.push('success', message, action),
  error:   (message: string, action?: Toast['action']) => toastBus.push('error', message, action),
};
