import { Component } from '@angular/core';
import { KpiCardsComponent } from '../../shared/widgets/kpi-cards/kpi-cards';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [KpiCardsComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {}
