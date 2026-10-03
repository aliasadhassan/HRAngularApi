import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalSettings, HalfDayPeriod, Holiday, LeavePolicy, LeaveRequest, LeaveScope, LeaveStatus, LeaveType, MyLeave, PolicyRule
} from './leave.models';

/** Gateway: /leave/{x} → Employee API /api/leave/{x} */
@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/leave`;

  me(year?: number): Observable<MyLeave> {
    return this.http.get<MyLeave>(`${this.base}/me`, { params: year ? { year } : {} });
  }

  preview(start: string, end: string, halfDay: boolean): Observable<{ days: number; holidays: string[] }> {
    return this.http.get<{ days: number; holidays: string[] }>(`${this.base}/me/preview`, { params: { start, end, halfDay } });
  }

  submit(body: { leaveTypeId: string; startDate: string; endDate: string; halfDayPeriod: HalfDayPeriod | null; reason: string | null }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/requests`, body).pipe(map(r => r.id));
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/cancel`, {});
  }

  requests(scope: LeaveScope, status?: LeaveStatus | '', year?: number): Observable<LeaveRequest[]> {
    let p = new HttpParams().set('scope', scope);
    if (status) p = p.set('status', status);
    if (year) p = p.set('year', year);
    return this.http.get<LeaveRequest[]>(`${this.base}/requests`, { params: p });
  }

  decide(id: string, approve: boolean, comment: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/${approve ? 'approve' : 'reject'}`, { comment });
  }

  // ── Setup ──
  types(includeInactive = true): Observable<LeaveType[]> {
    return this.http.get<LeaveType[]>(`${this.base}/types`, { params: { includeInactive } });
  }

  saveType(body: Omit<LeaveType, 'id'>, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.base}/types/${id}`, body) : this.http.post(`${this.base}/types`, body);
  }

  holidays(year: number): Observable<Holiday[]> {
    return this.http.get<Holiday[]>(`${this.base}/holidays`, { params: { year } });
  }

  saveHoliday(body: { date: string; name: string; locationId: string | null; isOptional: boolean }, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.base}/holidays/${id}`, body) : this.http.post(`${this.base}/holidays`, body);
  }

  deleteHoliday(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/holidays/${id}`);
  }

  policies(): Observable<LeavePolicy[]> {
    return this.http.get<LeavePolicy[]>(`${this.base}/policies`);
  }

  savePolicy(body: { name: string; locationId: string | null; effectiveFrom: string; isActive: boolean; rules: PolicyRule[] }, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.base}/policies/${id}`, body) : this.http.post(`${this.base}/policies`, body);
  }

  approvalSettings(): Observable<ApprovalSettings> {
    return this.http.get<ApprovalSettings>(`${this.base}/approval-settings`);
  }

  saveApprovalSettings(body: ApprovalSettings): Observable<void> {
    return this.http.put<void>(`${this.base}/approval-settings`, body);
  }
}
