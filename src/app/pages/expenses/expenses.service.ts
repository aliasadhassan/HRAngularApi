import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClaimStatus, ExpenseCategory, ExpenseClaim, ExpensePolicy, MyExpenses, PayoutMethod, TravelMode, TravelRequest, TravelStatus
} from './expenses.models';

export interface ClaimLineBody {
  categoryId: string;
  expenseDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  receiptNumber: string | null;
  hasReceipt: boolean;
}

/** Gateway: /payroll/expenses/{x} → Payroll API /api/payroll/expenses/{x} */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/payroll/expenses`;

  me(): Observable<MyExpenses> {
    return this.http.get<MyExpenses>(`${this.base}/me`);
  }

  submitClaim(body: { title: string; travelRequestId: string | null; lines: ClaimLineBody[] }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/claims`, body).pipe(map(r => r.id));
  }

  cancelClaim(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/claims/${id}/cancel`, {});
  }

  submitTravel(body: {
    purpose: string; destination: string; departDate: string; returnDate: string; travelMode: TravelMode;
    estimatedCost: number; advanceRequested: number;
  }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/travel`, body).pipe(map(r => r.id));
  }

  cancelTravel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/travel/${id}/cancel`, {});
  }

  claims(status?: ClaimStatus | ''): Observable<ExpenseClaim[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ExpenseClaim[]>(`${this.base}/claims`, { params });
  }

  approveClaim(id: string, body: { approvedAmount: number | null; payout: PayoutMethod | null; comment: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/claims/${id}/approve`, body);
  }

  rejectClaim(id: string, comment: string): Observable<void> {
    return this.http.post<void>(`${this.base}/claims/${id}/reject`, { comment });
  }

  markPaid(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/claims/${id}/mark-paid`, {});
  }

  travel(status?: TravelStatus | '', advancesOnly = false): Observable<TravelRequest[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (advancesOnly) p = p.set('advancesOnly', true);
    return this.http.get<TravelRequest[]>(`${this.base}/travel`, { params: p });
  }

  approveTravel(id: string, body: { advanceApproved: number | null; comment: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/travel/${id}/approve`, body);
  }

  rejectTravel(id: string, comment: string): Observable<void> {
    return this.http.post<void>(`${this.base}/travel/${id}/reject`, { comment });
  }

  payAdvance(id: string, payout: PayoutMethod): Observable<void> {
    return this.http.post<void>(`${this.base}/travel/${id}/pay-advance`, { payout });
  }

  policy(): Observable<ExpensePolicy> {
    return this.http.get<ExpensePolicy>(`${this.base}/policy`);
  }

  savePolicy(body: ExpensePolicy): Observable<void> {
    return this.http.put<void>(`${this.base}/policy`, body);
  }

  categories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.base}/categories`);
  }

  saveCategory(id: string | null, body: Omit<ExpenseCategory, 'id'>): Observable<void> {
    return id
      ? this.http.put<void>(`${this.base}/categories/${id}`, body)
      : this.http.post<unknown>(`${this.base}/categories`, body).pipe(map(() => undefined));
  }
}
