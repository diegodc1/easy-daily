export {};

declare global {
  interface Window {
    dailyElectron?: {
      markDailyDone: () => void;
      markDailyNotDone: () => void;
      getAppVersion?: () => Promise<string>;
    };
  }
}

export function notifyDailyDone() {
  window.dailyElectron?.markDailyDone?.();
}

export function notifyDailyNotDone() {
  window.dailyElectron?.markDailyNotDone?.();
}

