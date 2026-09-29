import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { EmployeesComponent } from './pages/employees/employees';
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
      { path: 'employees', component: EmployeesComponent, data: { titleKey: 'nav.employees' } },
      { path: 'attendance', component: AttendanceComponent, data: { titleKey: 'nav.attendance' } },
      { path: 'leaves', component: LeavesComponent, data: { titleKey: 'nav.leaves' } },
      { path: 'settings', component: SettingsComponent, data: { titleKey: 'nav.settings' } },
      {
        path: 'payroll',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'runs' },
          { path: 'runs', component: PayrollRunsComponent, data: { titleKey: 'nav.payrollRuns' } },
          { path: 'runs/:id', component: PayrollRunDetailComponent, data: { titleKey: 'nav.payrollRuns' } },
          { path: 'runs/:runId/payslips/:id', component: PayslipComponent, data: { titleKey: 'payroll.payslip.title' } },
          { path: 'salaries', component: ComingSoonComponent, data: { titleKey: 'nav.employeeSalaries' } },
          { path: 'structure', component: ComingSoonComponent, data: { titleKey: 'nav.salaryStructure' } },
          { path: 'setup', component: ComingSoonComponent, data: { titleKey: 'nav.payrollSetup' } }
        ]
      },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
