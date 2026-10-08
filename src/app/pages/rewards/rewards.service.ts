import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BatchResult, BenefitPlan, Bonus, BonusBasis, BonusBody, BonusStatus, BonusType, Enrolment, EnrolmentStatus, MyRewards, PayoutMethod,
  PlanBody, Revision, RevisionBody, RevisionReason, RevisionStatus, RewardsLookups, RewardsSummary, SalaryLine
} from './rewards.models';

/** Gateway: /payroll/rewards/{x} → Payroll API /api/payroll/rewards/{x} */
@Injectable({ providedIn: 'root' })
export class RewardsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/payroll/rewards`;

  summary(): Observable<RewardsSummary> {
    return this.http.get<RewardsSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<RewardsLookups> {
    return this.http.get<RewardsLookups>(`${this.base}/lookups`);
  }

  // ───── Employee ─────
  me(): Observable<MyRewards> {
    return this.http.get<MyRewards>(`${this.base}/me`);
  }

  requestEnrolment(planId: string, dependents: number, note: string | null): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/me/enrolments`, { planId, dependents, note }).pipe(map(r => r.id));
  }

  cancelEnrolmentRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/me/enrolments/${id}/cancel`, {});
  }

  // ───── Plans ─────
  plans(): Observable<BenefitPlan[]> {
    return this.http.get<BenefitPlan[]>(`${this.base}/plans`);
  }

  createPlan(body: PlanBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/plans`, body).pipe(map(r => r.id));
  }

  updatePlan(id: string, body: PlanBody): Observable<void> {
    return this.http.put<void>(`${this.base}/plans/${id}`, body);
  }

  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/plans/${id}`);
  }

  // ───── Enrolments ─────
  enrolments(status: EnrolmentStatus | '', planId: string): Observable<Enrolment[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (planId) p = p.set('planId', planId);
    return this.http.get<Enrolment[]>(`${this.base}/enrolments`, { params: p });
  }

  enrol(body: { planId: string; employeeId: string; dependents: number; startDate: string; note: string | null }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/enrolments`, body).pipe(map(r => r.id));
  }

  approveEnrolment(id: string, startDate: string, dependents: number | null, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/enrolments/${id}/approve`, { startDate, dependents, note });
  }

  rejectEnrolment(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/enrolments/${id}/reject`, { note });
  }

  endEnrolment(id: string, endDate: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/enrolments/${id}/end`, { endDate, note });
  }

  changeDependents(id: string, dependents: number): Observable<void> {
    return this.http.put<void>(`${this.base}/enrolments/${id}/dependents`, { dependents });
  }

  // ───── Increments ─────
  salaries(): Observable<SalaryLine[]> {
    return this.http.get<SalaryLine[]>(`${this.base}/salaries`);
  }

  revisions(status: RevisionStatus | ''): Observable<Revision[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<Revision[]>(`${this.base}/revisions`, { params });
  }

  proposeRevision(body: RevisionBody & { employeeId: string }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/revisions`, body).pipe(map(r => r.id));
  }

  proposeRevisions(body: { employeeIds: string[]; percent: number; effectiveFrom: string; reason: RevisionReason; justification: string | null }): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${this.base}/revisions/batch`, body);
  }

  updateRevision(id: string, body: RevisionBody): Observable<void> {
    return this.http.put<void>(`${this.base}/revisions/${id}`, body);
  }

  approveRevisions(ids: string[], note: string | null): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${this.base}/revisions/approve`, { ids, note });
  }

  rejectRevision(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/revisions/${id}/reject`, { note });
  }

  cancelRevision(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/revisions/${id}/cancel`, {});
  }

  // ───── Bonuses ─────
  bonuses(status: BonusStatus | '', type: BonusType | ''): Observable<Bonus[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (type) p = p.set('type', type);
    return this.http.get<Bonus[]>(`${this.base}/bonuses`, { params: p });
  }

  proposeBonuses(body: { employeeIds: string[]; bonusType: BonusType; title: string; basis: BonusBasis; value: number; payComponentId: string; reason: string | null }): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${this.base}/bonuses/batch`, body);
  }

  updateBonus(id: string, body: BonusBody): Observable<void> {
    return this.http.put<void>(`${this.base}/bonuses/${id}`, body);
  }

  approveBonuses(ids: string[], payout: PayoutMethod, note: string | null): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${this.base}/bonuses/approve`, { ids, payout, note });
  }

  rejectBonus(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/bonuses/${id}/reject`, { note });
  }

  cancelBonus(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/bonuses/${id}/cancel`, {});
  }

  markBonusPaid(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/bonuses/${id}/paid`, {});
  }
}
