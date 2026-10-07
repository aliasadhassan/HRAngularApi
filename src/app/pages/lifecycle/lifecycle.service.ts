import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Candidate, CaseListItem, CaseStatus, ChecklistTemplate, ExitType, LifecycleCase, LifecycleKind, LifecycleSummary, MyTask,
  TaskBody, TemplateTask
} from './lifecycle.models';

export interface TemplateBody {
  kind: LifecycleKind;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  tasks: TemplateTask[];
}

export interface ExitDetailsBody {
  exitType: ExitType;
  noticeDate: string;
  lastWorkingDay: string;
  reason: string;
  eligibleForRehire: boolean | null;
  interviewNotes: string | null;
}

/** Gateway: /lifecycle/{x} → Employee API /api/lifecycle/{x} */
@Injectable({ providedIn: 'root' })
export class LifecycleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/lifecycle`;

  summary(): Observable<LifecycleSummary> {
    return this.http.get<LifecycleSummary>(`${this.base}/summary`);
  }

  cases(kind: LifecycleKind, status: CaseStatus | '', search: string): Observable<CaseListItem[]> {
    let p = new HttpParams().set('kind', kind);
    if (status) p = p.set('status', status);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<CaseListItem[]>(`${this.base}/cases`, { params: p });
  }

  case(id: string): Observable<LifecycleCase> {
    return this.http.get<LifecycleCase>(`${this.base}/cases/${id}`);
  }

  candidates(kind: LifecycleKind, search = ''): Observable<Candidate[]> {
    let p = new HttpParams().set('kind', kind);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<Candidate[]>(`${this.base}/candidates`, { params: p });
  }

  myTasks(): Observable<MyTask[]> {
    return this.http.get<MyTask[]>(`${this.base}/my-tasks`);
  }

  startOnboarding(body: { employeeId: string; templateId: string | null; notes: string | null }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/onboarding`, body).pipe(map(r => r.id));
  }

  startExit(body: ExitDetailsBody & { employeeId: string; templateId: string | null; notes: string | null }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/exit`, body).pipe(map(r => r.id));
  }

  saveExitDetails(id: string, body: ExitDetailsBody): Observable<void> {
    return this.http.put<void>(`${this.base}/cases/${id}/exit-details`, body);
  }

  saveNotes(id: string, notes: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/cases/${id}/notes`, { notes });
  }

  complete(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/complete`, {});
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${id}/cancel`, {});
  }

  addTask(caseId: string, body: TaskBody): Observable<void> {
    return this.http.post<unknown>(`${this.base}/cases/${caseId}/tasks`, body).pipe(map(() => undefined));
  }

  updateTask(caseId: string, taskId: string, body: TaskBody): Observable<void> {
    return this.http.put<void>(`${this.base}/cases/${caseId}/tasks/${taskId}`, body);
  }

  removeTask(caseId: string, taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cases/${caseId}/tasks/${taskId}`);
  }

  taskAction(caseId: string, taskId: string, action: 'complete' | 'skip' | 'reopen', note: string | null = null): Observable<void> {
    return this.http.post<void>(`${this.base}/cases/${caseId}/tasks/${taskId}/${action}`, action === 'reopen' ? {} : { note });
  }

  templates(kind?: LifecycleKind): Observable<ChecklistTemplate[]> {
    const params = kind ? new HttpParams().set('kind', kind) : undefined;
    return this.http.get<ChecklistTemplate[]>(`${this.base}/templates`, { params });
  }

  saveTemplate(id: string | null, body: TemplateBody): Observable<void> {
    return id
      ? this.http.put<void>(`${this.base}/templates/${id}`, body)
      : this.http.post<unknown>(`${this.base}/templates`, body).pipe(map(() => undefined));
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }

  starter(): Observable<number> {
    return this.http.post<{ created: number }>(`${this.base}/templates/starter`, {}).pipe(map(r => r.created));
  }
}
