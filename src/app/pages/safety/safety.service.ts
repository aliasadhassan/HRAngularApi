import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActionBody, ActionScope, ActionStatus, ChecklistBody, CompleteResult, IncidentBody, IncidentDetail, IncidentListItem, IncidentScope,
  IncidentStatus, IncidentType, InspectionAnswer, InspectionBody, InspectionDetail, InspectionListItem, InspectionScope, MyReport,
  MyReportDetail, ReportBody, RootCauseCategory, SafetyAction, SafetyChecklist, SafetyLookups, SafetySeverity, SafetySummary
} from './safety.models';

export interface IncidentFilter {
  scope: IncidentScope;
  status: IncidentStatus | '';
  type: IncidentType | '';
  severity: SafetySeverity | '';
  search: string;
}

/** Gateway: /safety/{x} → Employee API /api/safety/{x} */
@Injectable({ providedIn: 'root' })
export class SafetyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/safety`;

  summary(): Observable<SafetySummary> {
    return this.http.get<SafetySummary>(`${this.base}/summary`);
  }

  lookups(): Observable<SafetyLookups> {
    return this.http.get<SafetyLookups>(`${this.base}/lookups`);
  }

  // ───── Incidents ─────
  incidents(f: IncidentFilter): Observable<IncidentListItem[]> {
    let p = new HttpParams().set('scope', f.scope);
    if (f.status) p = p.set('status', f.status);
    if (f.type) p = p.set('type', f.type);
    if (f.severity) p = p.set('severity', f.severity);
    if (f.search.trim()) p = p.set('search', f.search.trim());
    return this.http.get<IncidentListItem[]>(`${this.base}/incidents`, { params: p });
  }

  incident(id: string): Observable<IncidentDetail> {
    return this.http.get<IncidentDetail>(`${this.base}/incidents/${id}`);
  }

  createIncident(body: IncidentBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/incidents`, body).pipe(map(r => r.id));
  }

  updateIncident(id: string, body: IncidentBody): Observable<void> {
    return this.http.put<void>(`${this.base}/incidents/${id}`, body);
  }

  move(id: string, status: IncidentStatus, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/status`, { status, note });
  }

  investigator(id: string, employeeId: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/investigator`, { employeeId });
  }

  rootCause(id: string, category: RootCauseCategory | null, rootCause: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/root-cause`, { category, rootCause });
  }

  authority(id: string, notifiedOn: string, reference: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/authority`, { notifiedOn, reference });
  }

  note(id: string, text: string): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/notes`, { text });
  }

  close(id: string, text: string): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/close`, { text });
  }

  reopen(id: string, text: string): Observable<void> {
    return this.http.post<void>(`${this.base}/incidents/${id}/reopen`, { text });
  }

  // ───── My reports ─────
  myReports(): Observable<MyReport[]> {
    return this.http.get<MyReport[]>(`${this.base}/my-reports`);
  }

  myReport(id: string): Observable<MyReportDetail> {
    return this.http.get<MyReportDetail>(`${this.base}/my-reports/${id}`);
  }

  report(body: ReportBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/my-reports`, body).pipe(map(r => r.id));
  }

  // ───── Actions ─────
  actions(scope: ActionScope, status: ActionStatus | '', search: string): Observable<SafetyAction[]> {
    let p = new HttpParams().set('scope', scope);
    if (status) p = p.set('status', status);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<SafetyAction[]>(`${this.base}/actions`, { params: p });
  }

  createAction(body: ActionBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/actions`, body).pipe(map(r => r.id));
  }

  updateAction(id: string, body: ActionBody): Observable<void> {
    return this.http.put<void>(`${this.base}/actions/${id}`, body);
  }

  startAction(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/actions/${id}/start`, {});
  }

  completeAction(id: string, text: string): Observable<void> {
    return this.http.post<void>(`${this.base}/actions/${id}/complete`, { text });
  }

  verifyAction(id: string, accepted: boolean, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/actions/${id}/verify`, { accepted, note });
  }

  cancelAction(id: string, reason: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/actions/${id}/cancel`, { reason });
  }

  // ───── Checklists ─────
  checklists(): Observable<SafetyChecklist[]> {
    return this.http.get<SafetyChecklist[]>(`${this.base}/checklists`);
  }

  createChecklist(body: ChecklistBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/checklists`, body).pipe(map(r => r.id));
  }

  updateChecklist(id: string, body: ChecklistBody): Observable<void> {
    return this.http.put<void>(`${this.base}/checklists/${id}`, body);
  }

  deleteChecklist(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/checklists/${id}`);
  }

  sampleChecklists(): Observable<number> {
    return this.http.post<{ added: number }>(`${this.base}/checklists/samples`, {}).pipe(map(r => r.added));
  }

  // ───── Inspections ─────
  inspections(scope: InspectionScope): Observable<InspectionListItem[]> {
    return this.http.get<InspectionListItem[]>(`${this.base}/inspections`, { params: new HttpParams().set('scope', scope) });
  }

  inspection(id: string): Observable<InspectionDetail> {
    return this.http.get<InspectionDetail>(`${this.base}/inspections/${id}`);
  }

  schedule(body: InspectionBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/inspections`, body).pipe(map(r => r.id));
  }

  reschedule(id: string, body: InspectionBody): Observable<void> {
    return this.http.put<void>(`${this.base}/inspections/${id}`, body);
  }

  cancelInspection(id: string, reason: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/inspections/${id}/cancel`, { reason });
  }

  completeInspection(id: string, answers: InspectionAnswer[], notes: string | null): Observable<CompleteResult> {
    return this.http.post<CompleteResult>(`${this.base}/inspections/${id}/complete`, { answers, notes });
  }
}
