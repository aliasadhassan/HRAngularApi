import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PayrollDashboard, PeopleDashboard } from './dashboard.models';

/** Gateway: /dashboard/summary → Employee API, /payroll/dashboard → Payroll API */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  people(): Observable<PeopleDashboard> {
    return this.http.get<PeopleDashboard>(`${environment.apiGatewayUrl}/dashboard/summary`);
  }

  payroll(): Observable<PayrollDashboard> {
    return this.http.get<PayrollDashboard>(`${environment.apiGatewayUrl}/payroll/dashboard`);
  }
}
