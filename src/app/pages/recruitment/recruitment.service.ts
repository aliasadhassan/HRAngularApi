import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Application, ApplicationListItem, Candidate, CandidateBody, CandidateListItem, CandidateSource, HeadcountRow, HireBody, HireResult,
  Interview, InterviewBody, InterviewStatus, Job, JobBody, JobListItem, JobStatus, Lookups, Recommendation, RecruitmentSummary, Stage
} from './recruitment.models';

/** Gateway: /recruitment/{x} → Employee API /api/recruitment/{x} */
@Injectable({ providedIn: 'root' })
export class RecruitmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/recruitment`;

  summary(): Observable<RecruitmentSummary> {
    return this.http.get<RecruitmentSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  headcount(): Observable<HeadcountRow[]> {
    return this.http.get<HeadcountRow[]>(`${this.base}/headcount`);
  }

  // ───── Jobs ─────
  jobs(status: JobStatus | '', departmentId: string, search: string): Observable<JobListItem[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (departmentId) p = p.set('departmentId', departmentId);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<JobListItem[]>(`${this.base}/jobs`, { params: p });
  }

  job(id: string): Observable<Job> {
    return this.http.get<Job>(`${this.base}/jobs/${id}`);
  }

  saveJob(id: string | null, body: JobBody): Observable<string> {
    return id
      ? this.http.put<void>(`${this.base}/jobs/${id}`, body).pipe(map(() => id))
      : this.http.post<{ id: string }>(`${this.base}/jobs`, body).pipe(map(r => r.id));
  }

  deleteJob(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/jobs/${id}`);
  }

  jobAction(id: string, action: 'submit' | 'approve' | 'hold' | 'resume' | 'reopen'): Observable<void> {
    return this.http.post<void>(`${this.base}/jobs/${id}/${action}`, {});
  }

  sendBack(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/jobs/${id}/send-back`, { note });
  }

  closeJob(id: string, filled: boolean, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/jobs/${id}/close`, { filled, note });
  }

  // ───── Candidates ─────
  candidates(source: CandidateSource | '', search: string): Observable<CandidateListItem[]> {
    let p = new HttpParams();
    if (source) p = p.set('source', source);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<CandidateListItem[]>(`${this.base}/candidates`, { params: p });
  }

  candidate(id: string): Observable<Candidate> {
    return this.http.get<Candidate>(`${this.base}/candidates/${id}`);
  }

  saveCandidate(id: string | null, body: CandidateBody): Observable<string> {
    return id
      ? this.http.put<void>(`${this.base}/candidates/${id}`, body).pipe(map(() => id))
      : this.http.post<{ id: string }>(`${this.base}/candidates`, body).pipe(map(r => r.id));
  }

  deleteCandidate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/candidates/${id}`);
  }

  // ───── Applications ─────
  applications(jobId: string, stage: Stage | '', activeOnly: boolean, search: string): Observable<ApplicationListItem[]> {
    let p = new HttpParams();
    if (jobId) p = p.set('jobId', jobId);
    if (stage) p = p.set('stage', stage);
    if (activeOnly) p = p.set('active', true);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<ApplicationListItem[]>(`${this.base}/applications`, { params: p });
  }

  application(id: string): Observable<Application> {
    return this.http.get<Application>(`${this.base}/applications/${id}`);
  }

  apply(jobId: string, candidateId: string): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/applications`, { jobId, candidateId }).pipe(map(r => r.id));
  }

  move(id: string, stage: Stage, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/applications/${id}/move`, { stage, note });
  }

  addNote(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/applications/${id}/notes`, { note });
  }

  rate(id: string, rating: number | null): Observable<void> {
    return this.http.put<void>(`${this.base}/applications/${id}/rating`, { rating });
  }

  offer(id: string, body: { salary: number | null; startDate: string | null; expiresOn: string | null; note: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/applications/${id}/offer`, body);
  }

  offerResponse(id: string, accepted: boolean, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/applications/${id}/offer-response`, { accepted, note });
  }

  hire(id: string, body: HireBody): Observable<HireResult> {
    return this.http.post<HireResult>(`${this.base}/applications/${id}/hire`, body);
  }

  // ───── Interviews ─────
  interviews(mine: boolean, status: InterviewStatus | ''): Observable<Interview[]> {
    let p = new HttpParams();
    if (mine) p = p.set('mine', true);
    if (status) p = p.set('status', status);
    return this.http.get<Interview[]>(`${this.base}/interviews`, { params: p });
  }

  schedule(applicationId: string, body: InterviewBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/applications/${applicationId}/interviews`, body).pipe(map(r => r.id));
  }

  updateInterview(id: string, body: InterviewBody): Observable<void> {
    return this.http.put<void>(`${this.base}/interviews/${id}`, body);
  }

  interviewAction(id: string, action: 'cancel' | 'no-show'): Observable<void> {
    return this.http.post<void>(`${this.base}/interviews/${id}/${action}`, {});
  }

  feedback(id: string, body: { rating: number; recommendation: Recommendation; feedback: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/interviews/${id}/feedback`, body);
  }
}
