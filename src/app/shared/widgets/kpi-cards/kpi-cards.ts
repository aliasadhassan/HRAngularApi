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
    { title: 'Total Employees', value: 128, icon: '👥' },
    { title: 'Present Today', value: 94, icon: '✅' },
    { title: 'On Leave', value: 12, icon: '🌴' },
    { title: 'Departments', value: 6, icon: '🏢' }
  ];
}
