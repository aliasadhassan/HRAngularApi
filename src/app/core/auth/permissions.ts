import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from './current-user';

/** Backend ke permission codes (HR.Shared.Library.Authorization.Permissions) ke saath 1:1. */
export const P = {
  dashboardView: 'dashboard.view',
  employeesView: 'employees.view',
  employeesEdit: 'employees.edit',
  leavesViewOwn: 'leaves.view.own',
  leavesViewAll: 'leaves.view.all',
  payrollViewOwn: 'payroll.view.own',
  payrollViewAll: 'payroll.view.all',
  payrollRun: 'payroll.run',
  payrollApprove: 'payroll.approve',
  settingsView: 'settings.view',
  settingsManage: 'settings.manage',
  usersManage: 'users.manage',
  rolesManage: 'roles.manage'
} as const;

/**
 * UI mein kya dikhana hai. Asal hifazat backend [HasPermission] karta hai —
 * ye sirf menu/buttons chhupata hai taake user ko wo cheez na dikhe jo woh kar hi nahi sakta.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly currentUser = inject(CurrentUserService);

  /** Kisi ek bhi permission ho to true. Purane token (perm claims nahi) pe sab dikhao. */
  hasAny(required: string | readonly string[] | undefined): boolean {
    if (!required || required.length === 0) return true;
    const granted = this.currentUser.get().permissions;
    if (granted === null) return true;
    const list = typeof required === 'string' ? [required] : required;
    return list.some(p => granted.includes(p));
  }
}

/** Route pe: canActivate: [permissionGuard], data: { permission: P.payrollViewAll } */
export const permissionGuard: CanActivateFn = route => {
  const allowed = inject(PermissionService).hasAny(route.data['permission']);
  return allowed || inject(Router).createUrlTree(['/app/dashboard']);
};
