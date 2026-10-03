import { Route, Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { EmployeeDirectoryComponent } from './pages/people/directory/employee-directory';
import { EmployeeProfileComponent } from './pages/people/profile/employee-profile';
import { OrganizationComponent } from './pages/people/organization/organization';
import { AttendanceComponent } from './pages/attendance/attendance';
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
 */
const soon = (path: string, titleKey: string, permission?: string | readonly string[]): Route => ({
  path,
  component: ComingSoonComponent,
  ...(permission ? { canActivate: [permissionGuard] } : {}),
  data: { titleKey, permission, comingSoon: true }
});

/** Sidebar mein naam hai, page baad mein. Order sidebar jaisa. */
const PLANNED: Route[] = [
  // People
  soon('employee-requests', 'nav.employeeRequests'),

  // Workforce
  soon('workforce/time-tracking', 'nav.timeTracking'),
  soon('workforce/shifts', 'nav.shiftManagement'),
  soon('workforce/scheduling', 'nav.workforceScheduling'),
  soon('workforce/overtime', 'nav.overtime'),
  soon('workforce/expenses', 'nav.expenseManagement'),
  soon('workforce/travel', 'nav.businessTravel'),
  soon('workforce/planning', 'nav.workforcePlanning'),

  // Payroll
  soon('payroll/components', 'nav.salaryComponents', P.payrollRun),
  soon('payroll/allowances', 'nav.allowances', P.payrollRun),
  soon('payroll/deductions', 'nav.deductions', P.payrollRun),
  soon('payroll/loans', 'nav.loansAdvances', P.payrollViewAll),
  soon('payroll/benefits', 'nav.benefits', P.payrollViewAll),
  soon('payroll/compensation', 'nav.compensationRewards', P.payrollRun),

  // Talent
  soon('talent/recruitment', 'nav.recruitment'),
  soon('talent/job-requisitions', 'nav.jobRequisitions'),
  soon('talent/onboarding', 'nav.onboarding'),
  soon('talent/offboarding', 'nav.offboarding'),
  soon('talent/performance', 'nav.performance'),
  soon('talent/goals', 'nav.goals'),
  soon('talent/learning', 'nav.learningTraining'),
  soon('talent/skills', 'nav.skillsCompetencies'),
  soon('talent/career', 'nav.careerSuccession'),

  // Employee experience
  soon('employee/self-service', 'nav.employeeSelfService'),
  soon('manager/self-service', 'nav.managerSelfService'),
  soon('employee-experience/helpdesk', 'nav.hrHelpdesk'),
  soon('employee-experience/surveys', 'nav.surveys'),
  soon('employee-experience/recognition', 'nav.recognitionRewards'),
  soon('employee-experience/grievances', 'nav.grievances'),

  // Assets
  soon('assets', 'nav.assetManagement'),
  soon('assets/assignment', 'nav.assetAssignment'),
  soon('assets/returns', 'nav.assetReturn'),
  soon('assets/history', 'nav.assetHistory'),

  // Reporting
  soon('reports', 'nav.reportsDashboard'),
  soon('reports/employees', 'nav.employeeReport'),
  soon('reports/payroll', 'nav.payrollReport'),
  soon('reports/loans', 'nav.loansReport'),
  soon('reports/allowances', 'nav.allowancesReport'),
  soon('reports/deductions', 'nav.deductionsReport'),
  soon('reports/leaves', 'nav.leaveReport'),
  soon('reports/attendance', 'nav.attendanceReport'),
  soon('reports/recruitment', 'nav.recruitmentReport'),
  soon('reports/attrition', 'nav.attritionReport'),
  soon('reports/performance', 'nav.performanceReport'),
  soon('reports/builder', 'nav.reportBuilder'),
  soon('reports/designer', 'nav.reportDesigner'),
  soon('reports/scheduled', 'nav.scheduledReports'),

  // Compliance
  soon('compliance', 'nav.complianceManagement'),
  soon('compliance/policies', 'nav.policyManagement'),
  soon('compliance/health-safety', 'nav.healthSafety'),
  soon('compliance/disciplinary', 'nav.disciplinaryActions'),
  soon('compliance/audit', 'nav.audit'),

  // AI
  soon('ai/assistant', 'nav.aiAssistant'),
  soon('ai/insights', 'nav.aiInsights'),
  soon('ai/recruitment', 'nav.aiRecruitment')
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
      // ⚠ employees/:id se PEHLE — warna 'documents' ko employee id samjha jayega
      soon('employees/documents', 'nav.employeeDocuments', P.employeesView),
      { path: 'employees/:id', component: EmployeeProfileComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.employees', permission: P.employeesView } },
      { path: 'organization', component: OrganizationComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.organization', permission: P.employeesView } },
      { path: 'attendance', component: AttendanceComponent, data: { titleKey: 'nav.attendance' } },
      { path: 'leaves', component: LeavesComponent, data: { titleKey: 'nav.leaves' } },
      { path: 'leave-setup', component: LeaveSetupComponent, canActivate: [permissionGuard], data: { titleKey: 'nav.leaveSetup', permission: P.settingsManage } },
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
