import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, CategoryBody, HelpdeskSummary, Lookups, Ticket, TicketBody, TicketFilter, TicketListItem, TicketStatus } from './requests.models';

/** Gateway: /helpdesk/{x} → Employee API /api/helpdesk/{x} */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/helpdesk`;

  summary(): Observable<HelpdeskSummary> {
    return this.http.get<HelpdeskSummary>(`${this.base}/summary`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  // ───── Tickets ─────
  tickets(f: TicketFilter): Observable<TicketListItem[]> {
    let p = new HttpParams().set('scope', f.scope);
    if (f.status) p = p.set('status', f.status);
    if (f.active) p = p.set('active', true);
    if (f.categoryId) p = p.set('categoryId', f.categoryId);
    if (f.assignee) p = p.set('assignee', f.assignee);
    if (f.search.trim()) p = p.set('search', f.search.trim());
    return this.http.get<TicketListItem[]>(`${this.base}/tickets`, { params: p });
  }

  ticket(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.base}/tickets/${id}`);
  }

  create(body: TicketBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/tickets`, body).pipe(map(r => r.id));
  }

  update(id: string, body: TicketBody): Observable<void> {
    return this.http.put<void>(`${this.base}/tickets/${id}`, body);
  }

  approve(id: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/approve`, { note });
  }

  reject(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/reject`, { note });
  }

  assign(id: string, assigneeEmployeeId: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/assign`, { assigneeEmployeeId });
  }

  setStatus(id: string, status: TicketStatus, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/status`, { status, note });
  }

  comment(id: string, body: string, internal: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/comments`, { body, internal });
  }

  confirm(id: string, rating: number | null): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/confirm`, { rating });
  }

  rate(id: string, rating: number): Observable<void> {
    return this.http.put<void>(`${this.base}/tickets/${id}/rating`, { rating });
  }

  reopen(id: string, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/reopen`, { note });
  }

  cancel(id: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/tickets/${id}/cancel`, { note });
  }

  // ───── Categories ─────
  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  createCategory(body: CategoryBody): Observable<string> {
    return this.http.post<{ id: string }>(`${this.base}/categories`, body).pipe(map(r => r.id));
  }

  updateCategory(id: string, body: CategoryBody): Observable<void> {
    return this.http.put<void>(`${this.base}/categories/${id}`, body);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  addDefaults(): Observable<number> {
    return this.http.post<{ added: number }>(`${this.base}/categories/defaults`, {}).pipe(map(r => r.added));
  }
}
