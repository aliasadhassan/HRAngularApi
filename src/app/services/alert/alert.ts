import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AlertType = 'success' | 'error' | 'info';

export interface Alert {
  message: string;
  type: AlertType;
}

@Injectable({ providedIn: 'root' })
export class AlertService {

  private alertSubject = new BehaviorSubject<Alert | null>(null);
  alert$ = this.alertSubject.asObservable();

  private autoCloseTimer: any;

  success(message: string, autoClose = true) {
    this.show({ message, type: 'success' }, autoClose);
  }

  error(message: string, autoClose = true) {
    this.show({ message, type: 'error' }, autoClose);
  }

  info(message: string, autoClose = true) {
    this.show({ message, type: 'info' }, autoClose);
  }

  private show(alert: Alert, autoClose: boolean) {
    this.clearTimer();              // 🔥 reset old timer
    this.alertSubject.next(alert);

    if (autoClose) {
      this.autoCloseTimer = setTimeout(() => {
        this.clear();
      }, 3000);
    }
  }

  clear() {
    this.clearTimer();
    this.alertSubject.next(null);
  }

  private clearTimer() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }
}
