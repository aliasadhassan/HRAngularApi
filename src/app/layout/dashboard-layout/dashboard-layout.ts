import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/sidebar/sidebar';
import { TopbarComponent } from '../../shared/topbar/topbar';
import { LayoutService } from '../../core/layout/layout.service';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css'
})
export class DashboardLayoutComponent {
  readonly layout = inject(LayoutService);
}
