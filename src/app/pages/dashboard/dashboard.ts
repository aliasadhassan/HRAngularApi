import { Component } from '@angular/core';
import { KpiCardsComponent } from '../../shared/widgets/kpi-cards/kpi-cards';
import { DatePipe } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [KpiCardsComponent, DatePipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  today = new Date();
}
