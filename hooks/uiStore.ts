import { useSyncExternalStore } from 'react';
import { TOAST_DURATION, ToastType } from '@/constants/ui';

type ToastState = { visible: boolean; type: ToastType; message: string; durationMs: number };

type State = {
  loading: Record<string, boolean>;
  toast: ToastState;
};

let state: State = {
  loading: {},
  toast: { visible: false, type: 'info', message: '', durationMs: TOAST_DURATION },
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach(l => l());
}

export function useUIStore() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
  return snapshot;
}

export function setLoading(id: string, value: boolean) {
  state = { ...state, loading: { ...state.loading, [id]: value } };
  emit();
}

export function isLoading(id: string) {
  return !!state.loading[id];
}

export function showToast(input: { type: ToastType; message: string; durationMs?: number }) {
  state = {
    ...state,
    toast: {
      visible: true,
      type: input.type,
      message: input.message,
      durationMs: input.durationMs ?? TOAST_DURATION,
    },
  };
  emit();
}

export function hideToast() {
  state = { ...state, toast: { ...state.toast, visible: false } };
  emit();
}
