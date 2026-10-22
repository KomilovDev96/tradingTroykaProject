import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'bkx-signals.theme';

function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage may be unavailable; dark is the original app default.
  }
  return 'dark';
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const initialMode = readTheme();
applyTheme(initialMode);

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // The preference still applies for this visit.
    }
    applyTheme(mode);
    set({ mode });
  },
  toggle: () => {
    const next = useThemeStore.getState().mode === 'dark' ? 'light' : 'dark';
    useThemeStore.getState().setMode(next);
  },
}));
