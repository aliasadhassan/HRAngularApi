import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  message: string;
  type: AlertType;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  private alertSubject = new Subject<AlertMessage | null>();
  alert$ = this.alertSubject.asObservable();

  success(message: string) {
    this.alertSubject.next({ message, type: 'success' });
  }

  error(message: string) {
    this.alertSubject.next({ message, type: 'error' });
  }

  info(message: string) {
    this.alertSubject.next({ message, type: 'info' });
  }
  
  clear() {
    this.alertSubject.next(null);
  }
}
