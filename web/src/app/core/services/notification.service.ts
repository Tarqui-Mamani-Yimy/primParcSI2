import { Injectable, signal } from '@angular/core';
import { ToastMessage } from '../models';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastsSignal = signal<ToastMessage[]>([]);
  public toasts = this.toastsSignal.asReadonly();

  show(type: 'success' | 'info' | 'warning' | 'error', title: string, message: any, durationMs = 4000) {
    let msgStr = '';
    if (typeof message === 'string') {
      msgStr = message;
    } else if (message && typeof message === 'object') {
      if (typeof message.message === 'string') {
        msgStr = message.message;
      } else if (typeof message.detail === 'string') {
        msgStr = message.detail;
      } else {
        msgStr = JSON.stringify(message);
      }
    } else {
      msgStr = String(message ?? '');
    }
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const toast: ToastMessage = { id, type, title, message: msgStr };
    this.toastsSignal.update(toasts => [...toasts, toast]);

    setTimeout(() => {
      this.remove(id);
    }, durationMs);
  }

  success(title: string, message: string) {
    this.show('success', title, message);
  }

  info(title: string, message: string) {
    this.show('info', title, message);
  }

  warning(title: string, message: string) {
    this.show('warning', title, message);
  }

  error(title: string, message: string) {
    this.show('error', title, message);
  }

  remove(id: string) {
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }
}
