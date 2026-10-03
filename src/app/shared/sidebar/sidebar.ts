import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LayoutService } from '../../core/layout/layout.service';
import { CurrentUserService } from '../../core/auth/current-user';
import { P, PermissionService } from '../../core/auth/permissions';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  /** In mein se koi ek ho to item dikhe */
  permission?: string | readonly string[];
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
  private readonly permissions = inject(PermissionService);

  /**
   * Order: jo kaam roz hota hai woh upar, jo ek dafa set hota hai woh neeche.
   * Payroll: har mahine Runs → jab salary badle Employee Salaries → kabhi kabhi Structure → shuru mein Setup.
   */
  private readonly allSections: NavSection[] = [
    {
      items: [{ icon: 'space_dashboard', label: 'nav.dashboard', route: '/app/dashboard', permission: P.dashboardView }]
    },
    {
      title: 'nav.administration',
      items: [
        { icon: 'manage_accounts', label: 'nav.users', route: '/app/admin/users', permission: P.usersManage },
        { icon: 'admin_panel_settings', label: 'nav.roles', route: '/app/admin/roles', permission: P.rolesManage },
        { icon: 'history', label: 'nav.loginActivity', route: '/app/admin/login-activity', permission: P.settingsView },
        { icon: 'domain', label: 'nav.companySettings', route: '/app/admin/company', permission: [P.settingsView, P.settingsManage] }
      ]
    },
    {
      title: 'nav.people',
      items: [
        { icon: 'groups', label: 'nav.employees', route: '/app/employees', permission: P.employeesView },
        { icon: 'lan', label: 'nav.organization', route: '/app/organization', permission: P.employeesView },
        { icon: 'event_available', label: 'nav.leaves', route: '/app/leaves', permission: [P.leavesViewOwn, P.leavesViewAll] },
        { icon: 'schedule', label: 'nav.attendance', route: '/app/attendance', permission: P.employeesView }
      ]
    },
    {
      title: 'nav.payroll',
      items: [
        { icon: 'receipt_long', label: 'nav.payrollRuns', route: '/app/payroll/runs', permission: P.payrollViewAll },
        { icon: 'request_quote', label: 'nav.employeeSalaries', route: '/app/payroll/salaries', permission: P.payrollViewAll },
        { icon: 'account_tree', label: 'nav.salaryStructure', route: '/app/payroll/structure', permission: P.payrollRun },
        { icon: 'tune', label: 'nav.payrollSetup', route: '/app/payroll/setup', permission: P.payrollRun }
      ]
    }
  ];

  /** Sirf wahi items jin ki permission hai; khali section bhi gayab. */
  readonly sections: NavSection[] = this.allSections
    .map(section => ({ ...section, items: section.items.filter(i => this.permissions.hasAny(i.permission)) }))
    .filter(section => section.items.length > 0);

  readonly settings: NavItem = { icon: 'settings', label: 'nav.mySettings', route: '/app/settings' };

  onNavigate(): void {
    this.layout.closeMobile();
  }
}
