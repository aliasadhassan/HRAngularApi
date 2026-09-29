import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LayoutService } from '../../core/layout/layout.service';
import { CurrentUserService } from '../../core/auth/current-user';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  host: {
    '[class.is-collapsed]': 'layout.collapsed()',
    '[class.is-mobile-open]': 'layout.mobileOpen()'
  }
})
export class SidebarComponent {
  readonly layout = inject(LayoutService);
  readonly user = inject(CurrentUserService).get();

  /**
   * Order: jo kaam roz hota hai woh upar, jo ek dafa set hota hai woh neeche.
   * Payroll: har mahine Runs → jab salary badle Employee Salaries → kabhi kabhi Structure → shuru mein Setup.
   */
  readonly sections: NavSection[] = [
    {
      items: [{ icon: 'space_dashboard', label: 'nav.dashboard', route: '/app/dashboard' }]
    },
    {
      title: 'nav.people',
      items: [
        { icon: 'groups', label: 'nav.employees', route: '/app/employees' },
        { icon: 'event_available', label: 'nav.leaves', route: '/app/leaves' },
        { icon: 'schedule', label: 'nav.attendance', route: '/app/attendance' }
      ]
    },
    {
      title: 'nav.payroll',
      items: [
        { icon: 'receipt_long', label: 'nav.payrollRuns', route: '/app/payroll/runs' },
        { icon: 'request_quote', label: 'nav.employeeSalaries', route: '/app/payroll/salaries' },
        { icon: 'account_tree', label: 'nav.salaryStructure', route: '/app/payroll/structure' },
        { icon: 'tune', label: 'nav.payrollSetup', route: '/app/payroll/setup' }
      ]
    }
  ];

  readonly settings: NavItem = { icon: 'settings', label: 'nav.settings', route: '/app/settings' };

  onNavigate(): void {
    this.layout.closeMobile();
  }
}
