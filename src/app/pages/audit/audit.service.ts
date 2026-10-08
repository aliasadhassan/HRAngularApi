import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditCount, AuditPage, AuditQuery, AuditSource, AuditSummary } from './audit.models';

/**
 * Gateway: /audit/x → Employee API, /payroll/audit/x → Payroll API, /audit/access/x → Identity API.
 * Teeno ka shape ek hai; component inko jod kar dikhata hai.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  private base(source: AuditSource): string {
    const gw = environment.apiGatewayUrl;
    return source === 'people' ? `${gw}/audit` : source === 'payroll' ? `${gw}/payroll/audit` : `${gw}/audit/access`;
  }

  entries(source: AuditSource, q: AuditQuery): Observable<AuditPage> {
    let p = new HttpParams().set('limit', q.limit ?? 50);
    if (q.before) p = p.set('before', q.before);
    if (q.from) p = p.set('from', q.from);
    if (q.userId) p = p.set('userId', q.userId);
    if (q.entityType) p = p.set('entityType', q.entityType);
    if (q.entityId) p = p.set('entityId', q.entityId);
    if (q.action) p = p.set('action', q.action);
    if (q.search?.trim()) p = p.set('search', q.search.trim());
    return this.http.get<AuditPage>(`${this.base(source)}/entries`, { params: p });
  }

  summary(source: AuditSource, days: number): Observable<AuditSummary> {
    const offsetMinutes = -new Date().getTimezoneOffset();
    return this.http.get<AuditSummary>(`${this.base(source)}/summary`, { params: { days, offsetMinutes } });
  }

  entityTypes(source: AuditSource): Observable<AuditCount[]> {
    return this.http.get<AuditCount[]>(`${this.base(source)}/entity-types`);
  }
}
