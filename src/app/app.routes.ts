import { Route, Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { EmployeeDirectoryComponent } from './pages/people/directory/employee-directory';
import { EmployeeProfileComponent } from './pages/people/profile/employee-profile';
import { OrganizationComponent } from './pages/people/organization/organization';
import { LeavesComponent } from './pages/leave/leaves/leaves';
import { LeaveSetupComponent } from './pages/leave/setup/leave-setup';
import { MyPayslipsComponent } from './pages/payroll/my-payslips/my-payslips';
import { MySettingsComponent } from './pages/me/my-settings';
import { authGuardGuard } from './auth/auth.guard-guard';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from './auth/reset-password/reset-password';
import { AuthCallbackComponent } from './auth-callback/auth-callback';
import { ComingSoonComponent } from './pages/coming-soon/coming-soon';
import { PayrollRunsComponent } from './pages/payroll/runs/payroll-runs';
import { PayrollRunDetailComponent } from './pages/payroll/run-detail/payroll-run-detail';
import { PayslipComponent } from './pages/payroll/payslip/payslip';
import { PayrollSetupComponent } from './pages/payroll/setup/payroll-setup';
import { SalaryStructureComponent } from './pages/payroll/structure/salary-structure';
import { EmployeeSalariesComponent } from './pages/payroll/salaries/employee-salaries';
import { P, permissionGuard } from './core/auth/permissions';
import { UsersComponent } from './pages/admin/users/users';
import { RolesComponent } from './pages/admin/roles/roles';
import { LoginActivityComponent } from './pages/admin/login-activity/login-activity';
import { CompanyComponent } from './pages/admin/company/company';

/**
 * Abhi bana nahi — "coming soon" page. Asli component banne par isko PLANNED se nikaal kar
 * upar `app` ke children mein asli route likho. data.comingSoon = true se sidebar/QA pehchan sakte hain.
 * data.tabs = is page ke planned tabs (coming-soon page pe dikhte hain) — chhote pages alag nahi, tab bante hain.
 */
const soon = (
  path: string,
  titleKey: string,
  permission?: string | readonly string[],
  tabs?: readonly string[]
): Route => ({
  path,
  component: ComingSoonComponent,
  ...(permission ? { canActivate: [permissionGuard] } : {}),
  data: { titleKey, permission, tabs, comingSoon: true }
});

/**
 * Sidebar mein naam hai, page baad mein. Order sidebar jaisa.
 * Consolidation: ek kaam ke chhote pages ek page ke tabs hain (56 → 19 planned pages).
 */
const PLANNED: Route[] = [
  // Payroll (components / allowances / deductions = Payroll setup ka Components tab)
  soon('payroll/benefits', 'nav.benefitsRewards', P.payrollViewAll, ['benefitPlans', 'enrolments', 'increments', 'bonuses']),

  // Talent
  soon('talent/recruitment', 'nav.recruitment', undefined, ['requisitions', 'jobs', 'candidates', 'headcount']),
  soon('talent/performance', 'nav.performance', undefined, ['reviews', 'goals', 'cycles']),
  soon('talent/learning', 'nav.learningGrowth', undefined, ['courses', 'skills', 'career']),

  // Employee experience
  soon('requests', 'nav.requestsHelpdesk', undefined, ['myRequests', 'teamApprovals', 'helpdesk']),
  soon('engagement', 'nav.engagement', undefined, ['surveys', 'recognition']),

  // Reporting
  soon('reports/builder', 'nav.reportBuilder', undefined, ['builder', 'savedReports', 'scheduled']),

  // Compliance
  soon('compliance/policies', 'nav.policiesCompliance', undefined, ['policies', 'acknowledgements', 'statutory']),
  soon('compliance/health-safety', 'nav.healthSafety', undefined, ['incidents', 'inspections']),
  soon('compliance/relations', 'nav.employeeRelations', undefined, ['grievances', 'disciplinary']),
  soon('compliance/audit', 'nav.audit', undefined, ['activity', 'dataChanges']),

  // AI
  soon('ai', 'nav.aiAssistant', undefined, ['chat', 'insights', 'aiRecruitment'])
];

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'auth-callback', component: AuthCallbackComponent },
  {
    path: 'app',
    component: DashboardLayoutComponent,
    canActivate: [authGuardGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, data: { titleKey: 'nav.dashboard' } },
      { path: 'employees', component: EmployeeDirectoryComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.employees', permission: P.employeesView } },
      { path: 'employees/:id', component: EmployeeProfileComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.employees', permission: P.employeesView } },
      { path: 'organization', component: OrganizationComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.organization', permission: P.employeesView } },
      { path: 'attendance', loadComponent: () => import('./pages/attendance/attendance').then(m => m.AttendanceComponent), data: { titleKey: 'nav.attendance' } },
      { path: 'attendance-setup', loadComponent: () => import('./pages/attendance/setup/attendance-setup').then(m => m.AttendanceSetupComponent), canActivate: [permissionGuard], data: { titleKey: 'nav.attendanceSetup', permission: P.settingsManage } },
      { path: 'leaves', component: LeavesComponent, data: { titleKey: 'nav.leaves' } },
      { path: 'leave-setup', component: LeaveSetupComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.leaveSetup', permission: P.settingsManage } },
      { path: 'payroll/loans', loadComponent: () => import('./pages/payroll/loans/loans').then(m => m.LoansComponent), canActivate: [permissionGuard], data: { titleKey: 'nav.loansAdvances', permission: [P.payrollViewOwn, P.payrollViewAll, P.payrollApprove] } },
      { path: 'expenses', loadComponent: () => import('./pages/expenses/expenses').then(m => m.ExpensesComponent), data: { titleKey: 'nav.expensesTravel' } },
      { path: 'assets', loadComponent: () => import('./pages/assets/assets').then(m => m.AssetsComponent), data: { titleKey: 'nav.assets' } },
      { path: 'talent/lifecycle', loadComponent: () => import('./pages/lifecycle/lifecycle').then(m => m.LifecycleComponent), data: { titleKey: 'nav.onboardingExit' } },
      { path: 'reports', loadComponent: () => import('./pages/reports/reports').then(m => m.ReportsComponent), canActivate: [permissionGuard], data: { titleKey: 'nav.reports', permission: [P.employeesView, P.payrollViewAll, P.payrollApprove] } },
      { path: 'me/payslips', component: MyPayslipsComponent, data: { titleKey: 'nav.myPayslips' } },
      { path: 'me/payslips/:id', component: PayslipComponent, data: { titleKey: 'payroll.payslip.title', self: true } },
      { path: 'settings', component: MySettingsComponent, data: { titleKey: 'nav.mySettings' } },
      {
        path: 'payroll',
        canActivate: [permissionGuard],
        data: { permission: [P.payrollViewAll, P.payrollRun] },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'runs' },
          { path: 'runs', component: PayrollRunsComponent, data: { titleKey: 'nav.payrollRuns' } },
          { path: 'runs/:id', component: PayrollRunDetailComponent, data: { titleKey: 'nav.payrollRuns' } },
          { path: 'runs/:runId/payslips/:id', component: PayslipComponent, data: { titleKey: 'payroll.payslip.title' } },
          { path: 'salaries', component: EmployeeSalariesComponent, data: { titleKey: 'nav.employeeSalaries' } },
          { path: 'structure', component: SalaryStructureComponent, data: { titleKey: 'nav.salaryStructure' } },
          { path: 'setup', component: PayrollSetupComponent, data: { titleKey: 'nav.payrollSetup' } }
        ]
      },
      {
        path: 'admin',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'users' },
          { path: 'users', component: UsersComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.users', permission: P.usersManage } },
          { path: 'roles', component: RolesComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.roles', permission: P.rolesManage } },
          { path: 'login-activity', component: LoginActivityComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.loginActivity', permission: P.settingsView } },
          { path: 'company', component: CompanyComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.companySettings', permission: [P.settingsView, P.settingsManage] } }
        ]
      },
      ...PLANNED,
      { path: '**', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
