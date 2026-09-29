import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PayGroup, PayPeriod, PayrollRun, Payslip, PayslipListItem } from './payroll.models';

/**
 * Gateway: /payroll/{x} → Payroll API /api/payroll/{x}
 * NOTE: pay-groups ke routes PayGroupsController se confirm karne hain (neeche do constants).
 */
const PAY_GROUPS = 'pay-groups';
const PAY_PERIODS = (payGroupId: string) => `pay-groups/${payGroupId}/periods`;

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/payroll`;

  // ── Runs ──
  getRuns(payGroupId?: string): Observable<PayrollRun[]> {
    const params = payGroupId ? new HttpParams().set('payGroupId', payGroupId) : undefined;
    return this.http.get<PayrollRun[]>(`${this.base}/runs`, { params });
  }

  getRun(id: string): Observable<PayrollRun> {
    return this.http.get<PayrollRun>(`${this.base}/runs/${id}`);
  }

  createRun(payGroupId: string, payPeriodId: string): Observable<string> {
    return this.http
      .post<{ id: string }>(`${this.base}/runs`, { payGroupId, payPeriodId })
      .pipe(map(r => r.id));
  }

  calculate(id: string): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(`${this.base}/runs/${id}/calculate`, {});
  }

  approve(id: string): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(`${this.base}/runs/${id}/approve`, {});
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/runs/${id}/cancel`, {});
  }

  // ── Payslips ──
  getRunPayslips(runId: string): Observable<PayslipListItem[]> {
    return this.http.get<PayslipListItem[]>(`${this.base}/runs/${runId}/payslips`);
  }

  getPayslip(id: string): Observable<Payslip> {
    return this.http.get<Payslip>(`${this.base}/payslips/${id}`);
  }

  // ── Setup ──
  getPayGroups(): Observable<PayGroup[]> {
    return this.http.get<PayGroup[]>(`${this.base}/${PAY_GROUPS}`);
  }

  getPayPeriods(payGroupId: string): Observable<PayPeriod[]> {
    return this.http.get<PayPeriod[]>(`${this.base}/${PAY_PERIODS(payGroupId)}`);
  }

  /** Backend ProblemDetails se saaf message (validation errors bhi). */
  static errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const body = error.error;
    if (body?.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors as Record<string, string[]>).flat()[0];
      if (first) return first;
    }
    return body?.detail || body?.title || fallback;
  }
}
