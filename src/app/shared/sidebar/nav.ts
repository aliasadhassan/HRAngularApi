import { P } from '../../core/auth/permissions';

export interface NavItem {
  icon: string;
  label: string;
  route: string;
  permission?: string | readonly string[];
  /** Sirf isi URL par active (e.g. /app/reports, taake /app/reports/builder par dono na chamkein) */
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Ek kaam = ek page; us kaam ke hisse tabs hain (Leave setup / Payroll setup jaisa).
 * Isi liye yahan ~20 links hain, 60 nahi. Naya link dalne se pehle socho: kisi page ka tab ban sakta hai?
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { icon: 'space_dashboard', label: 'nav.dashboard', route: '/app/dashboard', permission: P.dashboardView },
      { icon: 'smart_toy', label: 'nav.aiAssistant', route: '/app/ai', permission: [P.aiUse, P.aiInsights, P.aiScreening, P.aiManage] }
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
      { icon: 'upload_file', label: 'nav.bulkImport', route: '/app/bulk-import', permission: P.employeesCreate },
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
      { icon: 'account_balance', label: 'nav.loansAdvances', route: '/app/payroll/loans', permission: [P.payrollViewOwn, P.payrollViewAll, P.payrollApprove] },   // employee bhi request karta hai
      { icon: 'redeem', label: 'nav.benefitsRewards', route: '/app/payroll/benefits', permission: [P.payrollViewOwn, P.payrollViewAll, P.payrollRun, P.payrollApprove, P.settingsManage] },   // employee apne benefits dekhta hai
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
      { icon: 'assessment', label: 'nav.reports', route: '/app/reports', exact: true, permission: [P.employeesView, P.payrollViewAll, P.payrollApprove] },
      { icon: 'design_services', label: 'nav.reportBuilder', route: '/app/reports/builder', permission: [P.reportsBuild, P.lettersIssue, P.employeesView, P.leavesViewAll, P.payrollViewAll, P.payrollApprove] }
    ]
  },

  {
    title: 'nav.compliance',
    items: [
      { icon: 'policy', label: 'nav.policiesCompliance', route: '/app/compliance/policies' },
      { icon: 'health_and_safety', label: 'nav.healthSafety', route: '/app/compliance/health-safety' },
      { icon: 'gavel', label: 'nav.employeeRelations', route: '/app/compliance/relations' },
      { icon: 'fact_check', label: 'nav.audit', route: '/app/compliance/audit', permission: P.settingsView }
    ]
  }
];

export const NAV_SETTINGS: NavItem = { icon: 'settings', label: 'nav.mySettings', route: '/app/settings' };

/**
 * URL ka sidebar item + uska section (topbar ke icon aur chhote section naam ke liye).
 * Sab se lamba milta route jeet-ta hai: /app/reports/builder → Report builder, Reports nahi.
 */
export function findNav(url: string): { item: NavItem; section?: string } | null {
  const path = url.split(/[?#]/)[0];
  let best: { item: NavItem; section?: string } | null = null;
  const all = [...NAV_SECTIONS, { items: [NAV_SETTINGS] }];
  for (const section of all)
    for (const item of section.items)
      if ((path === item.route || path.startsWith(item.route + '/')) && (!best || item.route.length > best.item.route.length))
        best = { item, section: section.title };
  return best;
}
