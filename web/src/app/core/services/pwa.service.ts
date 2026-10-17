import { Injectable, signal } from '@angular/core';
import { registerSW } from 'virtual:pwa-register';

/**
 * Service managing Progressive Web App service worker lifecycle and updates (OW1).
 */
@Injectable({
  providedIn: 'root',
})
export class PwaService {
  readonly needRefresh = signal<boolean>(false);
  readonly offlineReady = signal<boolean>(false);
  private updateFn?: (reloadPage?: boolean) => Promise<void>;

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      this.updateFn = registerSW({
        immediate: true,
        onNeedRefresh: () => {
          this.needRefresh.set(true);
        },
        onOfflineReady: () => {
          this.offlineReady.set(true);
        },
      });
    }
  }

  update(): void {
    if (this.updateFn) {
      this.updateFn(true);
    }
  }

  dismiss(): void {
    this.needRefresh.set(false);
  }
}
