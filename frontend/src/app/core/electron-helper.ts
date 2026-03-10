export {};

declare global {
  interface Window {
    dailyElectron?: {
      markDailyDone: () => void;
      markDailyNotDone: () => void;
    };
  }
}

export function notifyDailyDone() {
  window.dailyElectron?.markDailyDone?.();
}

