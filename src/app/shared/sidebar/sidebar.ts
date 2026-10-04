import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LayoutService } from '../../core/layout/layout.service';
import { CurrentUserService } from '../../core/auth/current-user';
import { P, PermissionService } from '../../core/auth/permissions';

interface NavItem {
  icon: string;
  label: string;
  route: string;
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

  // Accordion: default mein koi module open nahi.
  readonly expandedSections = signal<Record<string, boolean>>({});

  /**
   * Ek kaam = ek page; us kaam ke hisse tabs hain (Leave setup / Payroll setup jaisa).
   * Isi liye yahan ~20 links hain, 60 nahi. Naya link dalne se pehle socho: kisi page ka tab ban sakta hai?
   */
  private readonly allSections: NavSection[] = [
    {
      items: [
        { icon: 'space_dashboard', label: 'nav.dashboard', route: '/app/dashboard', permission: P.dashboardView },
        { icon: 'smart_toy', label: 'nav.aiAssistant', route: '/app/ai' }
      ]
    },

    {
      title: 'nav.administration',
      items: [
        { icon: 'manage_accounts', label: 'nav.users', route: '/app/admin/users', permission: P.usersManage },
        { icon: 'admin_panel_settings', label: 'nav.roles', route: '/app/admin/roles', permission: P.rolesManage },
        { icon: 'history', label: 'nav.loginActivity', route: '/app/admin/login-activity', permission: P.settingsView },
        {
          icon: 'domain',
          label: 'nav.companySettings',
          route: '/app/admin/company',
          permission: [P.settingsView, P.settingsManage]
        }
      ]
    },

    {
      title: 'nav.people',
      items: [
        { icon: 'groups', label: 'nav.employees', route: '/app/employees', permission: P.employeesView },
        { icon: 'lan', label: 'nav.organization', route: '/app/organization', permission: P.employeesView },
        { icon: 'devices', label: 'nav.assets', route: '/app/assets' }
      ]
    },

    {
      title: 'nav.timeAttendance',
      items: [
        { icon: 'schedule', label: 'nav.attendance', route: '/app/attendance' },   // har employee clock in karta hai; data scope backend karta hai
        { icon: 'event_available', label: 'nav.leaves', route: '/app/leaves', permission: [P.leavesViewOwn, P.leavesViewAll] },
        { icon: 'manage_history', label: 'nav.attendanceSetup', route: '/app/attendance-setup', permission: P.settingsManage },
        { icon: 'event_note', label: 'nav.leaveSetup', route: '/app/leave-setup', permission: P.settingsManage }
      ]
    },

    {
      title: 'nav.payroll',
      items: [
        { icon: 'receipt_long', label: 'nav.payrollRuns', route: '/app/payroll/runs', permission: P.payrollViewAll },
        { icon: 'request_quote', label: 'nav.employeeSalaries', route: '/app/payroll/salaries', permission: P.payrollViewAll },
        { icon: 'account_tree', label: 'nav.salaryStructure', route: '/app/payroll/structure', permission: P.payrollRun },
        { icon: 'tune', label: 'nav.payrollSetup', route: '/app/payroll/setup', permission: P.payrollRun },
        { icon: 'account_balance', label: 'nav.loansAdvances', route: '/app/payroll/loans', permission: P.payrollViewAll },
        { icon: 'redeem', label: 'nav.benefitsRewards', route: '/app/payroll/benefits', permission: P.payrollViewAll },
        { icon: 'receipt', label: 'nav.expensesTravel', route: '/app/expenses' }
      ]
    },

    {
      title: 'nav.talent',
      items: [
        { icon: 'work', label: 'nav.recruitment', route: '/app/talent/recruitment' },
        { icon: 'how_to_reg', label: 'nav.onboardingExit', route: '/app/talent/lifecycle' },
        { icon: 'rate_review', label: 'nav.performance', route: '/app/talent/performance' },
        { icon: 'school', label: 'nav.learningGrowth', route: '/app/talent/learning' }
      ]
    },

    {
      title: 'nav.employeeExperience',
      items: [
        { icon: 'support_agent', label: 'nav.requestsHelpdesk', route: '/app/requests' },
        { icon: 'emoji_events', label: 'nav.engagement', route: '/app/engagement' }
      ]
    },

    {
      title: 'nav.reporting',
      items: [
        { icon: 'assessment', label: 'nav.reports', route: '/app/reports' },
        { icon: 'design_services', label: 'nav.reportBuilder', route: '/app/reports/builder' }
      ]
    },

    {
      title: 'nav.compliance',
      items: [
        { icon: 'policy', label: 'nav.policiesCompliance', route: '/app/compliance/policies' },
        { icon: 'health_and_safety', label: 'nav.healthSafety', route: '/app/compliance/health-safety' },
        { icon: 'gavel', label: 'nav.employeeRelations', route: '/app/compliance/relations' },
        { icon: 'fact_check', label: 'nav.audit', route: '/app/compliance/audit' }
      ]
    }
  ];

  /** Permission filter + empty sections remove. */
  readonly sections: NavSection[] = this.allSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => this.permissions.hasAny(item.permission))
    }))
    .filter(section => section.items.length > 0);

  readonly settings: NavItem = {
    icon: 'settings',
    label: 'nav.mySettings',
    route: '/app/settings'
  };

  isSectionExpanded(section: NavSection): boolean {
    return section.title ? (this.expandedSections()[section.title] ?? false) : true;
  }

  toggleSection(section: NavSection): void {
    if (!section.title) {
      return;
    }

    this.expandedSections.update(state => {
      const isOpen = state[section.title!] ?? false;

      return {
        ...Object.keys(state).reduce(
          (next, key) => ({ ...next, [key]: false }),
          {} as Record<string, boolean>
        ),
        [section.title!]: !isOpen
      };
    });
  }

  onNavigate(): void {
    this.layout.closeMobile();
  }
}