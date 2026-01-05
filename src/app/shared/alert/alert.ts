import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../services/alert/alert';

@Component({
  selector: 'app-alert',
  standalone: true,          
  imports: [CommonModule],   
  template: `
    <div *ngIf="alert" class="alert" [class]="alert.type">
      {{ alert.message }}
    </div>
  `,
  styleUrls: ['./alert.css']
})
export class AlertComponent {
  alert: any;

  constructor(private alertService: AlertService) {
    this.alertService.alert$.subscribe(alert => {
      this.alert = alert;
      setTimeout(() => (this.alert = null), 5000); // auto hide
    });
  }
}
