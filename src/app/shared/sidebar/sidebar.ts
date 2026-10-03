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

  private readonly allSections: NavSection[] = [
    {
      items: [
        {
          icon: 'space_dashboard',
          label: 'nav.dashboard',
          route: '/app/dashboard',
          permission: P.dashboardView
        }
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
        { icon: 'event_available', label: 'nav.leaves', route: '/app/leaves', permission: [P.leavesViewOwn, P.leavesViewAll] },
        { icon: 'schedule', label: 'nav.attendance', route: '/app/attendance', permission: P.employeesView },
        { icon: 'description', label: 'nav.employeeDocuments', route: '/app/employees/documents' },
        { icon: 'support_agent', label: 'nav.employeeRequests', route: '/app/employee-requests' }
      ]
    },

    {
      title: 'nav.workforce',
      items: [
        { icon: 'fingerprint', label: 'nav.timeTracking', route: '/app/workforce/time-tracking' },
        { icon: 'calendar_month', label: 'nav.shiftManagement', route: '/app/workforce/shifts' },
        { icon: 'event_repeat', label: 'nav.workforceScheduling', route: '/app/workforce/scheduling' },
        { icon: 'more_time', label: 'nav.overtime', route: '/app/workforce/overtime' },
        { icon: 'account_balance_wallet', label: 'nav.expenseManagement', route: '/app/workforce/expenses' },
        { icon: 'flight_takeoff', label: 'nav.businessTravel', route: '/app/workforce/travel' },
        { icon: 'groups_2', label: 'nav.workforcePlanning', route: '/app/workforce/planning' }
      ]
    },

    {
      title: 'nav.payroll',
      items: [
        { icon: 'receipt_long', label: 'nav.payrollRuns', route: '/app/payroll/runs', permission: P.payrollViewAll },
        { icon: 'request_quote', label: 'nav.employeeSalaries', route: '/app/payroll/salaries', permission: P.payrollViewAll },
        { icon: 'account_tree', label: 'nav.salaryStructure', route: '/app/payroll/structure', permission: P.payrollRun },
        { icon: 'tune', label: 'nav.payrollSetup', route: '/app/payroll/setup', permission: P.payrollRun },
        { icon: 'payments', label: 'nav.salaryComponents', route: '/app/payroll/components', permission: P.payrollRun },
        { icon: 'add_card', label: 'nav.allowances', route: '/app/payroll/allowances', permission: P.payrollRun },
        { icon: 'remove_circle_outline', label: 'nav.deductions', route: '/app/payroll/deductions', permission: P.payrollRun },
        { icon: 'account_balance', label: 'nav.loansAdvances', route: '/app/payroll/loans', permission: P.payrollViewAll },
        { icon: 'redeem', label: 'nav.benefits', route: '/app/payroll/benefits', permission: P.payrollViewAll },
        { icon: 'card_giftcard', label: 'nav.compensationRewards', route: '/app/payroll/compensation', permission: P.payrollRun }
      ]
    },

    {
      title: 'nav.talent',
      items: [
        { icon: 'work', label: 'nav.recruitment', route: '/app/talent/recruitment' },
        { icon: 'post_add', label: 'nav.jobRequisitions', route: '/app/talent/job-requisitions' },
        { icon: 'how_to_reg', label: 'nav.onboarding', route: '/app/talent/onboarding' },
        { icon: 'person_remove', label: 'nav.offboarding', route: '/app/talent/offboarding' },
        { icon: 'rate_review', label: 'nav.performance', route: '/app/talent/performance' },
        { icon: 'flag', label: 'nav.goals', route: '/app/talent/goals' },
        { icon: 'school', label: 'nav.learningTraining', route: '/app/talent/learning' },
        { icon: 'psychology', label: 'nav.skillsCompetencies', route: '/app/talent/skills' },
        { icon: 'trending_up', label: 'nav.careerSuccession', route: '/app/talent/career' }
      ]
    },

    {
      title: 'nav.employeeExperience',
      items: [
        { icon: 'person', label: 'nav.employeeSelfService', route: '/app/employee/self-service' },
        { icon: 'manage_accounts', label: 'nav.managerSelfService', route: '/app/manager/self-service' },
        { icon: 'support_agent', label: 'nav.hrHelpdesk', route: '/app/employee-experience/helpdesk' },
        { icon: 'feedback', label: 'nav.surveys', route: '/app/employee-experience/surveys' },
        { icon: 'emoji_events', label: 'nav.recognitionRewards', route: '/app/employee-experience/recognition' },
        { icon: 'report_problem', label: 'nav.grievances', route: '/app/employee-experience/grievances' }
      ]
    },

    {
      title: 'nav.assets',
      items: [
        { icon: 'devices', label: 'nav.assetManagement', route: '/app/assets' },
        { icon: 'assignment_ind', label: 'nav.assetAssignment', route: '/app/assets/assignment' },
        { icon: 'assignment_return', label: 'nav.assetReturn', route: '/app/assets/returns' },
        { icon: 'history', label: 'nav.assetHistory', route: '/app/assets/history' }
      ]
    },

    {
      title: 'nav.reporting',
      items: [
        { icon: 'dashboard', label: 'nav.reportsDashboard', route: '/app/reports' },
        { icon: 'groups', label: 'nav.employeeReport', route: '/app/reports/employees' },
        { icon: 'payments', label: 'nav.payrollReport', route: '/app/reports/payroll' },
        { icon: 'account_balance_wallet', label: 'nav.loansReport', route: '/app/reports/loans' },
        { icon: 'add_card', label: 'nav.allowancesReport', route: '/app/reports/allowances' },
        { icon: 'remove_circle_outline', label: 'nav.deductionsReport', route: '/app/reports/deductions' },
        { icon: 'event_available', label: 'nav.leaveReport', route: '/app/reports/leaves' },
        { icon: 'schedule', label: 'nav.attendanceReport', route: '/app/reports/attendance' },
        { icon: 'person_search', label: 'nav.recruitmentReport', route: '/app/reports/recruitment' },
        { icon: 'trending_down', label: 'nav.attritionReport', route: '/app/reports/attrition' },
        { icon: 'assessment', label: 'nav.performanceReport', route: '/app/reports/performance' },
        { icon: 'design_services', label: 'nav.reportBuilder', route: '/app/reports/builder' },
        { icon: 'edit_document', label: 'nav.reportDesigner', route: '/app/reports/designer' },
        { icon: 'schedule_send', label: 'nav.scheduledReports', route: '/app/reports/scheduled' }
      ]
    },

    {
      title: 'nav.compliance',
      items: [
        { icon: 'policy', label: 'nav.policyManagement', route: '/app/compliance/policies' },
        { icon: 'verified_user', label: 'nav.complianceManagement', route: '/app/compliance' },
        { icon: 'health_and_safety', label: 'nav.healthSafety', route: '/app/compliance/health-safety' },
        { icon: 'gavel', label: 'nav.disciplinaryActions', route: '/app/compliance/disciplinary' },
        { icon: 'fact_check', label: 'nav.audit', route: '/app/compliance/audit' }
      ]
    },

    {
      title: 'nav.ai',
      items: [
        { icon: 'smart_toy', label: 'nav.aiAssistant', route: '/app/ai/assistant' },
        { icon: 'auto_awesome', label: 'nav.aiInsights', route: '/app/ai/insights' },
        { icon: 'person_search', label: 'nav.aiRecruitment', route: '/app/ai/recruitment' }
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