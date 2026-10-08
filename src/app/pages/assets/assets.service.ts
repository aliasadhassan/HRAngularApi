import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Asset, AssetBody, AssetCategory, AssetCondition, AssetEvent, AssetEventType, AssetListItem, AssetAssignment, AssetStatus,
  AssetSummary, AssignmentState, CategoryBody, MyAsset
} from './assets.models';

/** Gateway: /assets/{x} → Employee API /api/assets/{x} (list "items" par, khali path route nahi hota) */
@Injectable({ providedIn: 'root' })
export class AssetsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/assets`;

  summary(): Observable<AssetSummary> {
    return this.http.get<AssetSummary>(`${this.base}/summary`);
  }

  list(status: AssetStatus | '', categoryId: string, search: string): Observable<AssetListItem[]> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    if (categoryId) p = p.set('categoryId', categoryId);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<AssetListItem[]>(`${this.base}/items`, { params: p });
  }

  get(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.base}/items/${id}`);
  }

  nextTag(): Observable<string> {
    return this.http.get<{ tag: string }>(`${this.base}/next-tag`).pipe(map(r => r.tag));
  }

  assignments(state: AssignmentState, search = ''): Observable<AssetAssignment[]> {
    let p = new HttpParams().set('state', state);
    if (search.trim()) p = p.set('search', search.trim());
    return this.http.get<AssetAssignment[]>(`${this.base}/assignments`, { params: p });
  }

  history(type: AssetEventType | '', search: string, from: string, to: string): Observable<AssetEvent[]> {
    let p = new HttpParams();
    if (type) p = p.set('type', type);
    if (search.trim()) p = p.set('search', search.trim());
    if (from) p = p.set('from', from);
    if (to) p = p.set('to', to);
    return this.http.get<AssetEvent[]>(`${this.base}/history`, { params: p });
  }

  mine(): Observable<MyAsset[]> {
    return this.http.get<MyAsset[]>(`${this.base}/my`);
  }

  acknowledge(assignmentId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/my/${assignmentId}/acknowledge`, {});
  }

  save(id: string | null, body: AssetBody): Observable<string> {
    return id
      ? this.http.put<void>(`${this.base}/items/${id}`, body).pipe(map(() => id))
      : this.http.post<{ id: string }>(`${this.base}/items`, body).pipe(map(r => r.id));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/items/${id}`);
  }

  assign(id: string, body: { employeeId: string; assignedOn: string; dueBack: string | null; note: string | null }): Observable<void> {
    return this.http.post<unknown>(`${this.base}/items/${id}/assign`, body).pipe(map(() => undefined));
  }

  returnAsset(id: string, body: { returnedOn: string; condition: AssetCondition; nextStatus: AssetStatus; note: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/items/${id}/return`, body);
  }

  dueBack(id: string, dueBack: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/items/${id}/due-back`, { dueBack });
  }

  setStatus(id: string, status: AssetStatus, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/items/${id}/status`, { status, note });
  }

  categories(): Observable<AssetCategory[]> {
    return this.http.get<AssetCategory[]>(`${this.base}/categories`);
  }

  saveCategory(id: string | null, body: CategoryBody): Observable<void> {
    return id
      ? this.http.put<void>(`${this.base}/categories/${id}`, body)
      : this.http.post<unknown>(`${this.base}/categories`, body).pipe(map(() => undefined));
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  starter(): Observable<number> {
    return this.http.post<{ created: number }>(`${this.base}/categories/starter`, {}).pipe(map(r => r.created));
  }
}
