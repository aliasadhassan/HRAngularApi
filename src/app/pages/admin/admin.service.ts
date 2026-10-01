import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssignableRole, Company, CompanyProfile, CompanySettings, LoginActivityItem, LoginActivitySummary, LoginMethod, Paged, PermissionItem, RoleItem,
  UserCounts, UserListItem, UserStatus
} from './admin.models';

export interface UserQuery {
  search?: string;
  status?: UserStatus | '';
  roleId?: string;
  page: number;
  pageSize: number;
}

/** Gateway: /identity/{x} → Identity API /api/{x} */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly users = `${environment.apiGatewayUrl}/identity/users`;
  private readonly roles = `${environment.apiGatewayUrl}/identity/roles`;
  private readonly activity = `${environment.apiGatewayUrl}/identity/login-activity`;
  private readonly company = `${environment.apiGatewayUrl}/identity/company`;

  getUsers(q: UserQuery): Observable<Paged<UserListItem>> {
    let params = new HttpParams().set('page', q.page).set('pageSize', q.pageSize);
    if (q.search?.trim()) params = params.set('search', q.search.trim());
    if (q.status) params = params.set('status', q.status);
    if (q.roleId) params = params.set('roleId', q.roleId);
    return this.http.get<Paged<UserListItem>>(this.users, { params });
  }

  getCounts(): Observable<UserCounts> {
    return this.http.get<UserCounts>(`${this.users}/counts`);
  }

  getAssignableRoles(): Observable<AssignableRole[]> {
    return this.http.get<AssignableRole[]>(`${this.users}/assignable-roles`);
  }

  invite(email: string, displayName: string, roleIds: string[]): Observable<string> {
    return this.http
      .post<{ id: string }>(`${this.users}/invite`, { email, displayName, roleIds })
      .pipe(map(r => r.id));
  }

  update(id: string, displayName: string, roleIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.users}/${id}`, { displayName, roleIds });
  }

  action(id: string, action: UserAction): Observable<void> {
    return this.http.post<void>(`${this.users}/${id}/${action}`, {});
  }

  // ───── Roles ─────
  getRoles(): Observable<RoleItem[]> {
    return this.http.get<RoleItem[]>(this.roles);
  }

  getPermissionCatalog(): Observable<PermissionItem[]> {
    return this.http.get<PermissionItem[]>(`${this.roles}/permissions`);
  }

  createRole(payload: RolePayload): Observable<string> {
    return this.http.post<{ id: string }>(this.roles, payload).pipe(map(r => r.id));
  }

  updateRole(id: string, payload: RolePayload): Observable<void> {
    return this.http.put<void>(`${this.roles}/${id}`, payload);
  }

  duplicateRole(id: string, name: string): Observable<string> {
    return this.http.post<{ id: string }>(`${this.roles}/${id}/duplicate`, { name }).pipe(map(r => r.id));
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.roles}/${id}`);
  }

  // ───── Login activity ─────
  getLoginActivity(q: LoginActivityQuery): Observable<Paged<LoginActivityItem>> {
    let params = new HttpParams().set('days', q.days).set('page', q.page).set('pageSize', q.pageSize);
    if (q.userId) params = params.set('userId', q.userId);
    if (q.search?.trim()) params = params.set('search', q.search.trim());
    if (q.succeeded !== null) params = params.set('succeeded', q.succeeded);
    if (q.method) params = params.set('method', q.method);
    return this.http.get<Paged<LoginActivityItem>>(this.activity, { params });
  }

  // ───── Company ─────
  getCompany(): Observable<Company> {
    return this.http.get<Company>(this.company);
  }

  updateCompanyProfile(profile: Pick<CompanyProfile, 'name' | 'legalName' | 'logoUrl' | 'primaryEmail' | 'phone'>): Observable<Company> {
    return this.http.put<Company>(`${this.company}/profile`, profile);
  }

  updateCompanySettings(settings: CompanySettings): Observable<Company> {
    return this.http.put<Company>(`${this.company}/settings`, settings);
  }

  getLoginSummary(days: number): Observable<LoginActivitySummary> {
    return this.http.get<LoginActivitySummary>(`${this.activity}/summary`, { params: { days } });
  }
}

export interface LoginActivityQuery {
  userId?: string;
  search?: string;
  succeeded: boolean | null;
  method?: LoginMethod | '';
  days: number;
  page: number;
  pageSize: number;
}

// ───── Roles ─────
export interface RolePayload {
  name: string;
  description: string | null;
  permissionIds: number[];
}
export type UserAction = 'deactivate' | 'activate' | 'unlock' | 'send-password-reset' | 'resend-invite' | 'revoke-sessions';
