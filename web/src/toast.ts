import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'ok';
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  listeners.forEach((l) => l());
}

export function toast(message: string, kind: Toast['kind'] = 'ok') {
  const id = ++seq;
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, kind === 'error' ? 6000 : 2500);
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}
