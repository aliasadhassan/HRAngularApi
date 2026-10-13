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
const PLANNED: Route[] = [];

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
      { path: 'payroll/benefits', loadComponent: () => import('./pages/rewards/rewards').then(m => m.RewardsComponent), canActivate: [permissionGuard], data: { titleKey: 'nav.benefitsRewards', permission: [P.payrollViewOwn, P.payrollViewAll, P.payrollRun, P.payrollApprove, P.settingsManage] } },
      { path: 'expenses', loadComponent: () => import('./pages/expenses/expenses').then(m => m.ExpensesComponent), data: { titleKey: 'nav.expensesTravel' } },
      { path: 'assets', loadComponent: () => import('./pages/assets/assets').then(m => m.AssetsComponent), data: { titleKey: 'nav.assets' } },
      { path: 'talent/performance', loadComponent: () => import('./pages/performance/performance').then(m => m.PerformanceComponent), data: { titleKey: 'nav.performance' } },
      { path: 'talent/recruitment', loadComponent: () => import('./pages/recruitment/recruitment').then(m => m.RecruitmentComponent), data: { titleKey: 'nav.recruitment' } },
      { path: 'requests', loadComponent: () => import('./pages/requests/requests').then(m => m.RequestsComponent), data: { titleKey: 'nav.requestsHelpdesk' } },
      { path: 'talent/learning', loadComponent: () => import('./pages/learning/learning').then(m => m.LearningComponent), data: { titleKey: 'nav.learningGrowth' } },
      { path: 'engagement', loadComponent: () => import('./pages/engagement/engagement').then(m => m.EngagementComponent), data: { titleKey: 'nav.engagement' } },
      { path: 'talent/lifecycle', loadComponent: () => import('./pages/lifecycle/lifecycle').then(m => m.LifecycleComponent), data: { titleKey: 'nav.onboardingExit' } },
      { path: 'compliance/policies', loadComponent: () => import('./pages/policies/policies').then(m => m.PoliciesComponent), data: { titleKey: 'nav.policiesCompliance' } },
      { path: 'compliance/health-safety', loadComponent: () => import('./pages/safety/safety').then(m => m.SafetyComponent), data: { titleKey: 'nav.healthSafety' } },
      { path: 'compliance/relations', loadComponent: () => import('./pages/relations/relations').then(m => m.RelationsComponent), data: { titleKey: 'nav.employeeRelations' } },
      { path: 'compliance/audit', loadComponent: () => import('./pages/audit/audit').then(m => m.AuditComponent), canActivate: [permissionGuard], data: { titleKey: 'nav.audit', permission: P.settingsView } },
      {
        path: 'ai',
        loadComponent: () => import('./pages/ai/ai').then(m => m.AiComponent),
        canActivate: [permissionGuard],
        data: { titleKey: 'nav.aiAssistant', permission: [P.aiUse, P.aiInsights, P.aiScreening, P.aiManage] }
      },
      {
        path: 'reports/builder',
        canActivate: [permissionGuard],
        data: { titleKey: 'nav.reportBuilder', permission: [P.reportsBuild, P.lettersIssue, P.employeesView, P.leavesViewAll, P.payrollViewAll, P.payrollApprove] },
        children: [
          { path: '', loadComponent: () => import('./pages/report-builder/report-builder').then(m => m.ReportBuilderComponent) },
          { path: 'report/:id', loadComponent: () => import('./pages/report-builder/table-report').then(m => m.TableReportComponent) },
          { path: 'template/:id', loadComponent: () => import('./pages/report-builder/letter-editor').then(m => m.LetterEditorComponent), canActivate: [permissionGuard], data: { permission: P.reportsBuild } },
          { path: 'template/:id/generate', loadComponent: () => import('./pages/report-builder/letter-generate').then(m => m.LetterGenerateComponent), canActivate: [permissionGuard], data: { permission: P.lettersIssue } },
          { path: 'letter/:id', loadComponent: () => import('./pages/report-builder/letter-view').then(m => m.LetterViewComponent), canActivate: [permissionGuard], data: { permission: [P.lettersIssue, P.reportsBuild] } }
        ]
      },
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
