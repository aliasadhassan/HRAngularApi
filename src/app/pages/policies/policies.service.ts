import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AckPerson, AckState, ComplianceSummary, FilingBody, Lookups, Obligation, ObligationBody, ObligationDetail, Policy, PolicyBody,
  PolicyCategory, PolicyListItem, PolicyStatus, PolicyVersionContent
} from './policies.models';

/** Gateway: /compliance/{x} → Employee API /api/compliance/{x} */
@Injectable({ providedIn: 'root' })
export class PoliciesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/compliance`;

  summary(): Observable<ComplianceSummary> {
    return this.http.get<ComplianceSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  // ───── Policies ─────
  policies(status: PolicyStatus | '' = '', category: PolicyCategory | '' = '', search = ''): Observable<PolicyListItem[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (category) p = p.set('category', category);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<PolicyListItem[]>(`${this.base}/policies`, { params: p });
  }

  policy(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${this.base}/policies/${id}`);
  }

  version(id: string, n: number): Observable<PolicyVersionContent> {
    return this.http.get<PolicyVersionContent>(`${this.base}/policies/${id}/versions/${n}`);
  }

  acknowledgements(id: string, state: AckState | '' = '', departmentId = '', search = ''): Observable<AckPerson[]> {
    let p = new HttpParams();
    if (state) p = p.set('state', state);
    if (departmentId) p = p.set('departmentId', departmentId);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<AckPerson[]>(`${this.base}/policies/${id}/acknowledgements`, { params: p });
  }

  create(body: PolicyBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/policies`, body).pipe(map(r => r.id));
  }

  update(id: string, body: PolicyBody): Observable<void> {
    return this.http.put<void>(`${this.base}/policies/${id}`, body);
  }

  publish(id: string, changeSummary: string | null, reacknowledge: boolean, effectiveOn: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/policies/${id}/publish`, { changeSummary, reacknowledge, effectiveOn });
  }

  /** archive | restore | reviewed | acknowledge */
  act(id: string, action: 'archive' | 'restore' | 'reviewed' | 'acknowledge'): Observable<void> {
    return this.http.post<void>(`${this.base}/policies/${id}/${action}`, {});
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/policies/${id}`);
  }

  addStarter(): Observable<number> {
    return this.http.post<{ added: number }>(`${this.base}/policies/starter`, {}).pipe(map(r => r.added));
  }

  // ───── Statutory ─────
  obligations(): Observable<Obligation[]> {
    return this.http.get<Obligation[]>(`${this.base}/obligations`);
  }

  obligation(id: string): Observable<ObligationDetail> {
    return this.http.get<ObligationDetail>(`${this.base}/obligations/${id}`);
  }

  createObligation(body: ObligationBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/obligations`, body).pipe(map(r => r.id));
  }

  updateObligation(id: string, body: ObligationBody): Observable<void> {
    return this.http.put<void>(`${this.base}/obligations/${id}`, body);
  }

  deleteObligation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/obligations/${id}`);
  }

  recordFiling(id: string, body: FilingBody): Observable<void> {
    return this.http.post<void>(`${this.base}/obligations/${id}/filings`, body);
  }

  undoFiling(id: string, filingId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/obligations/${id}/filings/${filingId}`);
  }
}
