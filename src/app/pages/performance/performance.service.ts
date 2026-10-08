import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CycleBody, GoalBody, GoalDetail, GoalListItem, GoalStatus, MyPerformance, PerformancePerson, PerformanceSummary, Review,
  ReviewCycle, ReviewListItem, ReviewStatus
} from './performance.models';

/** Gateway: /performance/{x} → Employee API /api/performance/{x} */
@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/performance`;

  summary(): Observable<PerformanceSummary> {
    return this.http.get<PerformanceSummary>(`${this.base}/summary`);
  }

  mine(): Observable<MyPerformance> {
    return this.http.get<MyPerformance>(`${this.base}/my`);
  }

  people(): Observable<PerformancePerson[]> {
    return this.http.get<PerformancePerson[]>(`${this.base}/people`);
  }

  // ───── Cycles ─────
  cycles(): Observable<ReviewCycle[]> {
    return this.http.get<ReviewCycle[]>(`${this.base}/cycles`);
  }

  saveCycle(id: string | null, body: CycleBody): Observable<string> {
    return id
      ? this.http.put<void>(`${this.base}/cycles/${id}`, body).pipe(map(() => id))
      : this.http.post<{ id: string }>(`${this.base}/cycles`, body).pipe(map(r => r.id));
  }

  deleteCycle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cycles/${id}`);
  }

  launch(id: string, departmentIds: string[]): Observable<{ created: number; skipped: number }> {
    return this.http.post<{ created: number; skipped: number }>(`${this.base}/cycles/${id}/launch`, { departmentIds });
  }

  addReviews(id: string, employeeIds: string[]): Observable<{ created: number; skipped: number }> {
    return this.http.post<{ created: number; skipped: number }>(`${this.base}/cycles/${id}/reviews`, { employeeIds });
  }

  closeCycle(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cycles/${id}/close`, {});
  }

  // ───── Reviews ─────
  reviews(cycleId: string, status: ReviewStatus | '', overdue: boolean, search: string): Observable<ReviewListItem[]> {
    let p = new HttpParams();
    if (cycleId) p = p.set('cycleId', cycleId);
    if (status) p = p.set('status', status);
    if (overdue) p = p.set('overdue', true);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<ReviewListItem[]>(`${this.base}/reviews`, { params: p });
  }

  review(id: string): Observable<Review> {
    return this.http.get<Review>(`${this.base}/reviews/${id}`);
  }

  saveSelf(id: string, body: { rating: number | null; summary: string | null; submit: boolean }): Observable<void> {
    return this.http.put<void>(`${this.base}/reviews/${id}/self`, body);
  }

  saveManager(id: string, body: { rating: number | null; summary: string | null; strengths: string | null; improvements: string | null; submit: boolean }): Observable<void> {
    return this.http.put<void>(`${this.base}/reviews/${id}/manager`, body);
  }

  acknowledge(id: string, comment: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/reviews/${id}/acknowledge`, { comment });
  }

  reopen(id: string, selfReview: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/reviews/${id}/reopen`, {}, { params: new HttpParams().set('selfReview', selfReview) });
  }

  changeReviewer(id: string, reviewerEmployeeId: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/reviews/${id}/reviewer`, { reviewerEmployeeId });
  }

  removeReview(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/reviews/${id}`);
  }

  // ───── Goals ─────
  goals(cycleId: string, status: GoalStatus | '', overdue: boolean, search: string): Observable<GoalListItem[]> {
    let p = new HttpParams();
    if (cycleId) p = p.set('cycleId', cycleId);
    if (status) p = p.set('status', status);
    if (overdue) p = p.set('overdue', true);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<GoalListItem[]>(`${this.base}/goals`, { params: p });
  }

  goal(id: string): Observable<GoalDetail> {
    return this.http.get<GoalDetail>(`${this.base}/goals/${id}`);
  }

  saveGoal(id: string | null, body: GoalBody): Observable<string> {
    return id
      ? this.http.put<void>(`${this.base}/goals/${id}`, body).pipe(map(() => id))
      : this.http.post<{ id: string }>(`${this.base}/goals`, body).pipe(map(r => r.id));
  }

  deleteGoal(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/goals/${id}`);
  }

  checkIn(id: string, body: { progress: number; status: GoalStatus; note: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/goals/${id}/check-in`, body);
  }

  cancelGoal(id: string, comment: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/goals/${id}/cancel`, { comment });
  }

  reopenGoal(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/goals/${id}/reopen`, {});
  }
}
