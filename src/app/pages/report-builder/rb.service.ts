import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Home, IssuedLetter, IssuedLetterItem, IssuedResult, LetterData, LetterLang, LetterPay, LetterPerson, Letterhead, ReportBody,
  ReportSource, ReportSpec, RunResult, SaveResult, SavedReport, TemplateDetail, TemplateSettings, isPayroll
} from './rb.models';

export interface LetterFilter {
  employeeId?: string;
  templateId?: string;
  search?: string;
}

/**
 * Gateway: /report-builder/{x} → Employee API /api/report-builder/{x};
 * payroll sources /payroll/report-builder/{x}; letterhead /identity/company/letterhead.
 */
@Injectable({ providedIn: 'root' })
export class ReportBuilderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/report-builder`;
  private readonly payroll = `${environment.apiGatewayUrl}/payroll/report-builder`;

  home(): Observable<Home> {
    return this.http.get<Home>(`${this.base}/home`);
  }

  payrollSources(): Observable<ReportSource[]> {
    return this.http.get<ReportSource[]>(`${this.payroll}/sources`);
  }

  /** Source ke prefix se sahi service. */
  run(source: string, spec: ReportSpec, from: string | null, to: string | null): Observable<RunResult> {
    const url = isPayroll(source) ? `${this.payroll}/run` : `${this.base}/run`;
    return this.http.post<RunResult>(url, { source, spec, from, to });
  }

  // ───── Saved reports ─────
  report(id: string): Observable<SavedReport> {
    return this.http.get<SavedReport>(`${this.base}/reports/${id}`);
  }

  createReport(body: ReportBody): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/reports`, body);
  }

  updateReport(id: string, body: ReportBody): Observable<void> {
    return this.http.put<void>(`${this.base}/reports/${id}`, body);
  }

  deleteReport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/reports/${id}`);
  }

  markRun(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reports/${id}/ran`, {});
  }

  // ───── Templates ─────
  template(id: string): Observable<TemplateDetail> {
    return this.http.get<TemplateDetail>(`${this.base}/templates/${id}`);
  }

  createTemplate(settings: TemplateSettings, htmlEn: string | null, htmlAr: string | null): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/templates`, { settings, htmlEn, htmlAr });
  }

  saveSettings(id: string, settings: TemplateSettings, rowVersion: number): Observable<SaveResult> {
    return this.http.put<SaveResult>(`${this.base}/templates/${id}/settings`, { settings, rowVersion });
  }

  saveDraft(id: string, htmlEn: string | null, htmlAr: string | null, rowVersion: number): Observable<SaveResult> {
    return this.http.put<SaveResult>(`${this.base}/templates/${id}/draft`, { htmlEn, htmlAr, rowVersion });
  }

  publish(id: string, rowVersion: number): Observable<SaveResult> {
    return this.http.post<SaveResult>(`${this.base}/templates/${id}/publish`, { rowVersion });
  }

  archive(id: string, archive: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/templates/${id}/${archive ? 'archive' : 'restore'}`, {});
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }

  duplicate(id: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/templates/${id}/duplicate`, {});
  }

  // ───── Letters ─────
  people(search: string, departmentId: string | null, includeExited: boolean): Observable<LetterPerson[]> {
    let p = new HttpParams().set('includeExited', includeExited);
    if (search.trim()) p = p.set('search', search.trim());
    if (departmentId) p = p.set('departmentId', departmentId);
    return this.http.get<LetterPerson[]>(`${this.base}/people`, { params: p });
  }

  letterData(employeeIds: string[]): Observable<LetterData[]> {
    return this.http.post<LetterData[]>(`${this.base}/letter-data`, { employeeIds });
  }

  letterPay(employeeIds: string[]): Observable<LetterPay[]> {
    return this.http.post<LetterPay[]>(`${this.payroll}/letter-pay`, { employeeIds });
  }

  letterhead(): Observable<Letterhead> {
    return this.http.get<Letterhead>(`${environment.apiGatewayUrl}/identity/company/letterhead`);
  }

  letters(f: LetterFilter = {}): Observable<IssuedLetterItem[]> {
    let p = new HttpParams();
    if (f.employeeId) p = p.set('employeeId', f.employeeId);
    if (f.templateId) p = p.set('templateId', f.templateId);
    if (f.search?.trim()) p = p.set('search', f.search.trim());
    return this.http.get<IssuedLetterItem[]>(`${this.base}/letters`, { params: p });
  }

  letter(id: string): Observable<IssuedLetter> {
    return this.http.get<IssuedLetter>(`${this.base}/letters/${id}`);
  }

  issue(templateId: string, version: number, language: LetterLang, purpose: string | null,
        items: { employeeId: string; html: string }[]): Observable<IssuedResult[]> {
    return this.http.post<IssuedResult[]>(`${this.base}/letters`, { templateId, version, language, purpose, items });
  }

  voidLetter(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/letters/${id}/void`, { reason });
  }
}
