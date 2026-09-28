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
  private shownAt = 0;
  visible = false;

 constructor(private alertService: AlertService) {
    this.alertService.alert$.subscribe(alert => {
      this.alert = alert;

      if (alert) {
        this.visible = false;
        this.shownAt = Date.now();

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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.alert) return;

    if (Date.now() - this.shownAt < 300) {
      return;
    }

    const target = event.target as HTMLElement;
    if (!target.closest('.alert')) {
      this.alertService.clear();
    }
  }
}
