import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { EmployeeDirectoryComponent } from './pages/people/directory/employee-directory';
import { EmployeeProfileComponent } from './pages/people/profile/employee-profile';
import { OrganizationComponent } from './pages/people/organization/organization';
import { AttendanceComponent } from './pages/attendance/attendance';
import { LeavesComponent } from './pages/leaves/leaves';
import { SettingsComponent } from './pages/settings/settings';
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
      { path: 'attendance', component: AttendanceComponent, data: { titleKey: 'nav.attendance' } },
      { path: 'leaves', component: LeavesComponent, data: { titleKey: 'nav.leaves' } },
      { path: 'settings', component: SettingsComponent, data: { titleKey: 'nav.mySettings' } },
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
      { path: '**', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
