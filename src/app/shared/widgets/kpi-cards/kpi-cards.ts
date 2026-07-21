import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-cards.html',
  styleUrls: ['./kpi-cards.css']
})
export class KpiCardsComponent {
  cards = [
    { title: 'Total Employees', value: 128, icon: 'group', trend: '+4.2%', direction: 'up' },
    { title: 'Present Today', value: 94, icon: 'check_circle', trend: '+1.8%', direction: 'up' },
    { title: 'On Leave', value: 12, icon: 'beach_access', trend: '-0.6%', direction: 'down' },
    { title: 'Departments', value: 6, icon: 'apartment', trend: '0%', direction: 'flat' }
  ];
}