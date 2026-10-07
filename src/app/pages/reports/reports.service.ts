import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PayRegister, PayReport, PeopleReport, TimeReport } from './reports.models';

/**
 * Gateway:
 *   /reports/{people|time}            → Employee API /api/reports/...
 *   /payroll/reports/{pay|register}   → Payroll API /api/payroll/reports/...
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiGatewayUrl;

  people(from: string, to: string, departmentId: string | null): Observable<PeopleReport> {
    return this.http.get<PeopleReport>(`${this.base}/reports/people`, { params: this.range(from, to, departmentId) });
  }

  time(from: string, to: string, departmentId: string | null): Observable<TimeReport> {
    return this.http.get<TimeReport>(`${this.base}/reports/time`, { params: this.range(from, to, departmentId) });
  }

  pay(year: number): Observable<PayReport> {
    return this.http.get<PayReport>(`${this.base}/payroll/reports/pay`, { params: { year } });
  }

  register(year: number, month: number): Observable<PayRegister> {
    return this.http.get<PayRegister>(`${this.base}/payroll/reports/register`, { params: { year, month } });
  }

  private range(from: string, to: string, departmentId: string | null): HttpParams {
    let p = new HttpParams().set('from', from).set('to', to);
    if (departmentId) p = p.set('departmentId', departmentId);
    return p;
  }
}
