import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttendanceDay, AttendanceDayDetail, AttendanceDevice, AttendancePolicy, AttendanceRequest, AttendanceRequestScope,
  AttendanceRequestStatus, AttendanceRequestType, AttendanceStatus, AttendanceSummary, MyToday, Paged, PunchSource,
  RosterRow, SaveDevice, SavePolicy, SaveShift, Shift, ShiftAssignment, TimesheetQuery
} from './attendance.models';

/** Gateway: /attendance/{x} → Employee API /api/attendance/{x} */
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/attendance`;
  private readonly setup = `${this.base}/setup`;

  // ── Me ──
  today(): Observable<MyToday> {
    return this.http.get<MyToday>(`${this.base}/me/today`);
  }

  clock(body: { source: PunchSource; latitude: number | null; longitude: number | null; note: string | null }): Observable<MyToday> {
    return this.http.post<MyToday>(`${this.base}/me/clock`, body);
  }

  // ── Timesheet ──
  timesheet(q: TimesheetQuery): Observable<Paged<AttendanceDay>> {
    let p = new HttpParams().set('from', q.from).set('to', q.to).set('page', q.page).set('pageSize', q.pageSize);
    if (q.employeeId) p = p.set('employeeId', q.employeeId);
    if (q.departmentId) p = p.set('departmentId', q.departmentId);
    if (q.locationId) p = p.set('locationId', q.locationId);
    if (q.status) p = p.set('status', q.status);
    if (q.lateOnly) p = p.set('lateOnly', true);
    return this.http.get<Paged<AttendanceDay>>(`${this.base}/timesheet`, { params: p });
  }

  summary(date: string, locationId?: string): Observable<AttendanceSummary> {
    return this.http.get<AttendanceSummary>(`${this.base}/summary`, { params: locationId ? { date, locationId } : { date } });
  }

  day(id: string): Observable<AttendanceDayDetail> {
    return this.http.get<AttendanceDayDetail>(`${this.base}/days/${id}`);
  }

  addPunch(employeeId: string, punchedAt: string, note: string): Observable<string> {
    return this.http.post<{ dayId: string }>(`${this.base}/punches`, { employeeId, punchedAt, note }).pipe(map(r => r.dayId));
  }

  ignorePunch(dayId: string, punchId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/days/${dayId}/punches/${punchId}/ignore`, { reason });
  }

  overrideDay(id: string, status: AttendanceStatus, remarks: string): Observable<void> {
    return this.http.put<void>(`${this.base}/days/${id}/status`, { status, remarks });
  }

  process(date: string, locationId: string | null): Observable<number> {
    return this.http.post<{ employees: number }>(`${this.base}/process`, { date, locationId }).pipe(map(r => r.employees));
  }

  // ── Roster ──
  roster(q: { from: string; to: string; departmentId?: string; locationId?: string }): Observable<RosterRow[]> {
    let p = new HttpParams().set('from', q.from).set('to', q.to);
    if (q.departmentId) p = p.set('departmentId', q.departmentId);
    if (q.locationId) p = p.set('locationId', q.locationId);
    return this.http.get<RosterRow[]>(`${this.base}/roster`, { params: p });
  }

  assignments(q: { employeeId?: string; shiftId?: string; currentOnly?: boolean }): Observable<ShiftAssignment[]> {
    let p = new HttpParams().set('currentOnly', q.currentOnly ?? true);
    if (q.employeeId) p = p.set('employeeId', q.employeeId);
    if (q.shiftId) p = p.set('shiftId', q.shiftId);
    return this.http.get<ShiftAssignment[]>(`${this.base}/roster/assignments`, { params: p });
  }

  assign(body: { employeeIds: string[]; shiftId: string; effectiveFrom: string; effectiveTo: string | null; weeklyOffDays: number | null }): Observable<number> {
    return this.http.post<{ assigned: number }>(`${this.base}/roster/assignments`, body).pipe(map(r => r.assigned));
  }

  deleteAssignment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/roster/assignments/${id}`);
  }

  /** shiftId null = us din off. */
  setRosterEntry(body: { employeeId: string; workDate: string; shiftId: string | null; note: string | null }): Observable<unknown> {
    return this.http.put(`${this.base}/roster/entries`, body);
  }

  clearRosterEntry(employeeId: string, workDate: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/roster/entries`, { params: { employeeId, workDate } });
  }

  // ── Requests / overtime ──
  requests(q: { scope: AttendanceRequestScope; overtime: boolean; status?: AttendanceRequestStatus | ''; page: number; pageSize: number }): Observable<Paged<AttendanceRequest>> {
    let p = new HttpParams().set('scope', q.scope).set('overtime', q.overtime).set('page', q.page).set('pageSize', q.pageSize);
    if (q.status) p = p.set('status', q.status);
    return this.http.get<Paged<AttendanceRequest>>(`${this.base}/requests`, { params: p });
  }

  submitRequest(body: { workDate: string; type: AttendanceRequestType; requestedIn: string | null; requestedOut: string | null; reason: string }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/requests`, body).pipe(map(r => r.id));
  }

  submitOvertime(body: { workDate: string; minutes: number | null; reason: string | null }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/requests/overtime`, body).pipe(map(r => r.id));
  }

  approve(id: string, comment: string | null, approvedMinutes: number | null): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/approve`, { comment, approvedMinutes });
  }

  reject(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/reject`, { reason });
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/cancel`, {});
  }

  // ── Setup ──
  shifts(includeInactive = true): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.setup}/shifts`, { params: { includeInactive } });
  }

  saveShift(body: SaveShift, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.setup}/shifts/${id}`, body) : this.http.post(`${this.setup}/shifts`, body);
  }

  policies(): Observable<AttendancePolicy[]> {
    return this.http.get<AttendancePolicy[]>(`${this.setup}/policies`);
  }

  savePolicy(body: SavePolicy, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.setup}/policies/${id}`, body) : this.http.post(`${this.setup}/policies`, body);
  }

  devices(): Observable<AttendanceDevice[]> {
    return this.http.get<AttendanceDevice[]>(`${this.setup}/devices`);
  }

  saveDevice(body: SaveDevice, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.setup}/devices/${id}`, body) : this.http.post(`${this.setup}/devices`, body);
  }
}
