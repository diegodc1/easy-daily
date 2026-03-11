export {};

interface ElectronUpdateAvailability {
  supported: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  updateInProgress: boolean;
  currentVersion?: string;
  latestVersion?: string | null;
}

interface ElectronManualUpdateResult {
  started: boolean;
  downloaded?: boolean;
  reason?: string;
}

declare global {
  interface Window {
    dailyElectron?: {
      markDailyDone: () => void;
      markDailyNotDone: () => void;
      getAppVersion?: () => Promise<string>;
      checkUpdateAvailability?: () => Promise<ElectronUpdateAvailability>;
      startManualUpdate?: () => Promise<ElectronManualUpdateResult>;
    };
  }
}

export function notifyDailyDone() {
  window.dailyElectron?.markDailyDone?.();
}

export function notifyDailyNotDone() {
  window.dailyElectron?.markDailyNotDone?.();
}

