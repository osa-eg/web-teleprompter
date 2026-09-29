import { create } from 'zustand';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: ToastAction;
}

interface ToastInput {
  message: string;
  tone?: ToastItem['tone'];
  action?: ToastAction;
  /** ms; 0 keeps the toast until dismissed. */
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  show(input: ToastInput): number;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show({ message, tone = 'info', action, duration = action ? 6000 : 3500 }) {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone, action }] }));
    if (duration > 0) setTimeout(() => get().dismiss(id), duration);
    return id;
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = (input: ToastInput) => useToasts.getState().show(input);
