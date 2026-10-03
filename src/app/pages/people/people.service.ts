import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChangeJob, CreateEmployee, Department, Designation, EmployeeDetails, EmployeeListItem, EmploymentStatus,
  Location, Paged, SaveDepartment, SaveDesignation, SaveLocation, UpdateProfile
} from './people.models';

/**
 * Gateway:
 *   /employees, /employees/{x}  → Employee API /api/employees/...
 *   /org/{resource}/{id}       → Employee API /api/{resource}/... (departments, designations, locations)
 */
@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);
  private readonly employees = `${environment.apiGatewayUrl}/employees`;
  private readonly org = `${environment.apiGatewayUrl}/org`;

  // ── Employees ──
  getEmployees(q: {
    page: number; pageSize: number; search?: string; departmentId?: string; locationId?: string;
    status?: EmploymentStatus | ''; includeExited?: boolean;
  }): Observable<Paged<EmployeeListItem>> {
    let p = new HttpParams().set('page', q.page).set('pageSize', q.pageSize);
    if (q.search?.trim()) p = p.set('search', q.search.trim());
    if (q.departmentId) p = p.set('departmentId', q.departmentId);
    if (q.locationId) p = p.set('locationId', q.locationId);
    if (q.status) p = p.set('status', q.status);
    if (q.includeExited) p = p.set('includeExited', true);
    return this.http.get<Paged<EmployeeListItem>>(this.employees, { params: p });
  }

  getEmployee(id: string): Observable<EmployeeDetails> {
    return this.http.get<EmployeeDetails>(`${this.employees}/${id}`);
  }

  createEmployee(body: CreateEmployee): Observable<string> {
    return this.http.post<{ id: string } | string>(this.employees, body).pipe(map(r => (typeof r === 'string' ? r : r.id)));
  }

  updateProfile(body: UpdateProfile): Observable<void> {
    return this.http.put<void>(`${this.employees}/${body.employeeId}/profile`, body);
  }

  changeJob(body: ChangeJob): Observable<void> {
    return this.http.post<void>(`${this.employees}/${body.employeeId}/job-change`, body);
  }

  confirm(employeeId: string, confirmationDate: string): Observable<void> {
    return this.http.post<void>(`${this.employees}/${employeeId}/confirm`, { employeeId, confirmationDate });
  }

  exit(employeeId: string, exitDate: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.employees}/${employeeId}/exit`, { employeeId, exitDate, reason });
  }

  // ── Organization (cache — har form mein dropdown chahiye) ──
  private departments$?: Observable<Department[]>;
  private designations$?: Observable<Designation[]>;
  private locations$?: Observable<Location[]>;

  getDepartments(refresh = false): Observable<Department[]> {
    if (refresh || !this.departments$)
      this.departments$ = this.http.get<Department[]>(`${this.org}/departments`, { params: { includeInactive: true } }).pipe(shareReplay(1));
    return this.departments$;
  }

  getDesignations(refresh = false): Observable<Designation[]> {
    if (refresh || !this.designations$)
      this.designations$ = this.http.get<Designation[]>(`${this.org}/designations`, { params: { includeInactive: true } }).pipe(shareReplay(1));
    return this.designations$;
  }

  getLocations(refresh = false): Observable<Location[]> {
    if (refresh || !this.locations$)
      this.locations$ = this.http.get<Location[]>(`${this.org}/locations`, { params: { includeInactive: true } }).pipe(shareReplay(1));
    return this.locations$;
  }

  saveDepartment(body: SaveDepartment, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.org}/departments/${id}`, body) : this.http.post(`${this.org}/departments`, body);
  }

  saveDesignation(body: SaveDesignation, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.org}/designations/${id}`, body) : this.http.post(`${this.org}/designations`, body);
  }

  saveLocation(body: SaveLocation, id?: string): Observable<unknown> {
    return id ? this.http.put(`${this.org}/locations/${id}`, body) : this.http.post(`${this.org}/locations`, body);
  }
}
