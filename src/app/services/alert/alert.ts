import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface Alert {
  message: string;
  type: AlertType;
  /** Kitni der dikhe (ms); 0 = user khud band kare */
  duration: number;
  /** Har naya alert naya id — same message dobara aaye to bhi animation chale */
  id: number;
}

/** Error parhne mein zyada waqt lagta hai, is liye thora lamba */
const DURATION: Record<AlertType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000
};

@Injectable({ providedIn: 'root' })
export class AlertService {
  private alertSubject = new BehaviorSubject<Alert | null>(null);
  alert$ = this.alertSubject.asObservable();

  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private remaining = 0;
  private startedAt = 0;

  success(message: string, autoClose = true) {
    this.show(message, 'success', autoClose);
  }

  error(message: string, autoClose = true) {
    this.show(message, 'error', autoClose);
  }

  info(message: string, autoClose = true) {
    this.show(message, 'info', autoClose);
  }

  warning(message: string, autoClose = true) {
    this.show(message, 'warning', autoClose);
  }

  /** Hover pe timer ruk jaye — lamba message parhte parhte gaib na ho */
  pause() {
    if (!this.autoCloseTimer) return;
    this.clearTimer();
    this.remaining -= Date.now() - this.startedAt;
  }

  resume() {
    if (this.autoCloseTimer || this.remaining <= 0 || !this.alertSubject.value) return;
    this.startTimer(this.remaining);
  }

  clear() {
    this.clearTimer();
    this.remaining = 0;
    this.alertSubject.next(null);
  }

  private show(message: string, type: AlertType, autoClose: boolean) {
    this.clearTimer();
    const duration = autoClose ? DURATION[type] : 0;
    this.alertSubject.next({ message, type, duration, id: ++this.seq });
    this.remaining = duration;
    if (duration) this.startTimer(duration);
  }

  private startTimer(ms: number) {
    this.startedAt = Date.now();
    this.autoCloseTimer = setTimeout(() => this.clear(), ms);
  }

  private clearTimer() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }
}
