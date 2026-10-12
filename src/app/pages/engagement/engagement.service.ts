import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnswerBody, EngagementSummary, FeedFilter, Lookups, Recognition, RecognitionStats, RecognitionValue, StatsPeriod, SurveyBody,
  SurveyDetail, SurveyListItem, SurveyResults, SurveyStatus, SurveyTemplate
} from './engagement.models';

/** Gateway: /engagement/{x} → Employee API /api/engagement/{x} */
@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/engagement`;

  summary(): Observable<EngagementSummary> {
    return this.http.get<EngagementSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  // ───── Surveys ─────
  surveys(scope: 'mine' | 'all', status: SurveyStatus | '' = '', search = ''): Observable<SurveyListItem[]> {
    let p = new HttpParams().set('scope', scope);
    if (status) p = p.set('status', status);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<SurveyListItem[]>(`${this.base}/surveys`, { params: p });
  }

  survey(id: string): Observable<SurveyDetail> {
    return this.http.get<SurveyDetail>(`${this.base}/surveys/${id}`);
  }

  results(id: string): Observable<SurveyResults> {
    return this.http.get<SurveyResults>(`${this.base}/surveys/${id}/results`);
  }

  templates(): Observable<SurveyTemplate[]> {
    return this.http.get<SurveyTemplate[]>(`${this.base}/surveys/templates`);
  }

  fromTemplate(key: string): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/surveys/templates/${key}`, {}).pipe(map(r => r.id));
  }

  createSurvey(body: SurveyBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/surveys`, body).pipe(map(r => r.id));
  }

  updateSurvey(id: string, body: SurveyBody): Observable<void> {
    return this.http.put<void>(`${this.base}/surveys/${id}`, body);
  }

  deleteSurvey(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/surveys/${id}`);
  }

  publish(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/surveys/${id}/publish`, {});
  }

  close(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/surveys/${id}/close`, {});
  }

  reopen(id: string, closesOn: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/surveys/${id}/reopen`, { closesOn });
  }

  submit(id: string, answers: AnswerBody[]): Observable<void> {
    return this.http.post<void>(`${this.base}/surveys/${id}/responses`, { answers });
  }

  // ───── Recognition ─────
  recognitions(f: FeedFilter, take = 30): Observable<Recognition[]> {
    let p = new HttpParams().set('scope', f.scope).set('take', take);
    if (f.value) p = p.set('value', f.value);
    if (f.departmentId) p = p.set('departmentId', f.departmentId);
    if (f.before) p = p.set('before', f.before);
    return this.http.get<Recognition[]>(`${this.base}/recognitions`, { params: p });
  }

  stats(period: StatsPeriod): Observable<RecognitionStats> {
    return this.http.get<RecognitionStats>(`${this.base}/recognitions/stats`, { params: new HttpParams().set('period', period) });
  }

  give(toEmployeeIds: string[], value: RecognitionValue, message: string): Observable<number> {
    return this.http.post<{ count: number }>(`${this.base}/recognitions`, { toEmployeeIds, value, message }).pipe(map(r => r.count));
  }

  deleteRecognition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recognitions/${id}`);
  }

  cheer(id: string, on: boolean): Observable<number> {
    const url = `${this.base}/recognitions/${id}/cheer`;
    return (on ? this.http.post<{ cheers: number }>(url, {}) : this.http.delete<{ cheers: number }>(url)).pipe(map(r => r.cheers));
  }
}
