import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Loan, LoanAction, LoanPolicy, LoanRepayment, LoanRequest, LoanRequestStatus, LoanStatus, LoanType, MyLoans } from './loans.models';

/** Gateway: /payroll/loans/{x} → Payroll API /api/payroll/loans/{x} */
@Injectable({ providedIn: 'root' })
export class LoansService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/payroll/loans`;

  me(): Observable<MyLoans> {
    return this.http.get<MyLoans>(`${this.base}/me`);
  }

  submit(body: { loanType: LoanType; amount: number; installments: number; preferredStartDate: string; reason: string }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/requests`, body).pipe(map(r => r.id));
  }

  cancelRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/cancel`, {});
  }

  requests(status?: LoanRequestStatus | ''): Observable<LoanRequest[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<LoanRequest[]>(`${this.base}/requests`, { params });
  }

  approve(id: string, body: { amount: number | null; installmentAmount: number | null; startDate: string | null; comment: string | null }): Observable<string> {
    return this.http.post<{ loanId: string }>(`${this.base}/requests/${id}/approve`, body).pipe(map(r => r.loanId));
  }

  reject(id: string, comment: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/reject`, { comment });
  }

  loans(status?: LoanStatus | '', loanType?: LoanType | ''): Observable<Loan[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (loanType) p = p.set('loanType', loanType);
    return this.http.get<Loan[]>(this.base, { params: p });
  }

  create(body: { employeeId: string; loanType: LoanType; amount: number; installmentAmount: number; startDate: string; remarks: string | null }): Observable<string> {
    return this.http.post<{ id: string }>(this.base, body).pipe(map(r => r.id));
  }

  changeInstallment(id: string, installmentAmount: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/installment`, { installmentAmount });
  }

  changeStatus(id: string, op: LoanAction): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/${op}`, {});
  }

  repayments(from?: string, to?: string, loanId?: string): Observable<LoanRepayment[]> {
    let p = new HttpParams();
    if (from) p = p.set('from', from);
    if (to) p = p.set('to', to);
    if (loanId) p = p.set('loanId', loanId);
    return this.http.get<LoanRepayment[]>(`${this.base}/repayments`, { params: p });
  }

  policy(): Observable<LoanPolicy> {
    return this.http.get<LoanPolicy>(`${this.base}/policy`);
  }

  savePolicy(body: LoanPolicy): Observable<void> {
    return this.http.put<void>(`${this.base}/policy`, body);
  }
}
