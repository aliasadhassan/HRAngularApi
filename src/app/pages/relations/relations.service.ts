import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccessLogItem, CaseAction, CaseDetail, CaseListItem, CaseMemberRole, CaseOutcome, CasePhase, CaseScope, CaseSeverity, CaseType,
  ConcernBody, ConcernDetail, ConcernListItem, CreateCaseBody, Lookups, PartyBody, RelationsSummary, Stage, StageBody, UpdateCaseBody
} from './relations.models';

export interface CaseFilter {
  scope: CaseScope;
  phase: CasePhase | '';
  type: CaseType | '';
  severity: CaseSeverity | '';
  includeClosed: boolean;
  search: string;
}

/** Gateway: /relations/{x} → Employee API /api/relations/{x} */
@Injectable({ providedIn: 'root' })
export class RelationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/relations`;

  summary(): Observable<RelationsSummary> {
    return this.http.get<RelationsSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  // ───── Cases ─────
  cases(f: CaseFilter): Observable<CaseListItem[]> {
    let p = new HttpParams().set('scope', f.scope);
    if (f.phase) p = p.set('phase', f.phase);
    if (f.type) p = p.set('type', f.type);
    if (f.severity) p = p.set('severity', f.severity);
    if (f.includeClosed) p = p.set('includeClosed', true);
    if (f.search.trim()) p = p.set('search', f.search.trim());
    return this.http.get<CaseListItem[]>(`${this.base}/cases`, { params: p });
  }

  case(id: string): Observable<CaseDetail> {
    return this.http.get<CaseDetail>(`${this.base}/cases/${id}`);
  }

  accessLog(id: string): Observable<AccessLogItem[]> {
    return this.http.get<AccessLogItem[]>(`${this.base}/cases/${id}/access`);
  }

  create(body: CreateCaseBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/cases`, body).pipe(map(r => r.id));
  }

  update(id: string, body: UpdateCaseBody): Observable<void> {
    return this.http.put<void>(`${this.base}/cases/${id}`, body);
  }

  move(id: string, stageId: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/stage`, { stageId, note });
  }

  close(id: string, stageId: string | null, outcome: CaseOutcome, action: CaseAction, summary: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/close`, { stageId, outcome, action, summary });
  }

  reopen(id: string, stageId: string | null, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/reopen`, { stageId, reason });
  }

  deadline(id: string, dueOn: string | null, reason: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/deadline`, { dueOn, reason });
  }

  escalate(id: string, reason: string, toEmployeeId: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/escalate`, { reason, toEmployeeId });
  }

  take(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/take`, {});
  }

  owner(id: string, employeeId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/owner`, { employeeId });
  }

  addMember(id: string, employeeId: string, role: CaseMemberRole): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/members`, { employeeId, role });
  }

  removeMember(id: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cases/${id}/members/${employeeId}`);
  }

  addParty(id: string, body: PartyBody): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/parties`, body);
  }

  removeParty(id: string, partyId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cases/${id}/parties/${partyId}`);
  }

  note(id: string, text: string, shared: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/notes`, { text, shared });
  }

  addEvidence(id: string, title: string, url: string, note: string | null, restricted: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/evidence`, { title, url, note, restricted });
  }

  removeEvidence(id: string, evidenceId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cases/${id}/evidence/${evidenceId}`);
  }

  breakGlass(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/break-glass`, { reason });
  }

  // ───── Concerns (jo maine uthaye) ─────
  concerns(): Observable<ConcernListItem[]> {
    return this.http.get<ConcernListItem[]>(`${this.base}/concerns`);
  }

  concern(id: string): Observable<ConcernDetail> {
    return this.http.get<ConcernDetail>(`${this.base}/concerns/${id}`);
  }

  raise(body: ConcernBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/concerns`, body).pipe(map(r => r.id));
  }

  concernMessage(id: string, text: string): Observable<void> {
    return this.http.post<void>(`${this.base}/concerns/${id}/messages`, { text, shared: true });
  }

  concernEvidence(id: string, title: string, url: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/concerns/${id}/evidence`, { title, url, note, restricted: true });
  }

  // ───── Stages ─────
  stages(): Observable<Stage[]> {
    return this.http.get<Stage[]>(`${this.base}/stages`);
  }

  createStage(body: StageBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/stages`, body).pipe(map(r => r.id));
  }

  updateStage(id: string, body: StageBody): Observable<void> {
    return this.http.put<void>(`${this.base}/stages/${id}`, body);
  }

  deleteStage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/stages/${id}`);
  }

  defaultStages(): Observable<number> {
    return this.http.post<{ added: number }>(`${this.base}/stages/defaults`, {}).pipe(map(r => r.added));
  }
}
