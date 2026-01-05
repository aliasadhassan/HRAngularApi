import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService, Alert } from '../../services/alert/alert';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.html',
  styleUrl: './alert.css'
})
export class AlertComponent {

  alert: Alert | null = null;
  private shownAt = 0; // 🔥 timestamp
  visible = false;

 constructor(private alertService: AlertService) {
    this.alertService.alert$.subscribe(alert => {
      this.alert = alert;

      if (alert) {
        this.visible = false;      // 🔥 start hidden
        this.shownAt = Date.now();

        // next tick → show (no flicker)
        setTimeout(() => {
          this.visible = true;
        }, 10);
      } else {
        this.visible = false;
      }
    });
  }

  close() {
    this.alertService.clear();
  }

  // 🔥 CLICK ANYWHERE → ALERT CLOSE (after grace time)
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.alert) return;

    // 🔥 ignore first click (same click that triggered alert)
    if (Date.now() - this.shownAt < 300) {
      return;
    }

    const target = event.target as HTMLElement;
    if (!target.closest('.alert')) {
      this.alertService.clear();
    }
  }
}
