import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_LOADER } from '../../interceptors/loader-interceptor';
import {
  AiHome, AiSettings, AiSettingsBody, AskResult, Conversation, ConversationItem, Insights, Screening, ScreeningBoard
} from './ai.models';

/** Gateway: /ai/{x} → Employee API /api/ai/{x}. Key na ho to home.configured = false aur koi call model tak nahi jati. */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/ai`;
  /** Model ki calls lambi hain; page apna "Looking it up…" dikhata hai. */
  private readonly quiet = { context: new HttpContext().set(SKIP_LOADER, true) };

  home(): Observable<AiHome> {
    return this.http.get<AiHome>(`${this.base}/home`);
  }

  saveSettings(body: AiSettingsBody): Observable<AiSettings> {
    return this.http.put<AiSettings>(`${this.base}/settings`, body);
  }

  // ───── Chat ─────
  conversations(): Observable<ConversationItem[]> {
    return this.http.get<ConversationItem[]>(`${this.base}/conversations`);
  }

  conversation(id: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.base}/conversations/${id}`);
  }

  ask(conversationId: string | null, question: string, language: string): Observable<AskResult> {
    return this.http.post<AskResult>(`${this.base}/ask`, { conversationId, question, language }, this.quiet);
  }

  deleteConversation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/conversations/${id}`);
  }

  // ───── Insights ─────
  insights(dismissed: boolean): Observable<Insights> {
    return this.http.get<Insights>(`${this.base}/insights`, { params: new HttpParams().set('dismissed', dismissed) });
  }

  runInsights(): Observable<Insights> {
    return this.http.post<Insights>(`${this.base}/insights/run`, {}, this.quiet);
  }

  setInsight(id: string, dismissed: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/insights/${id}/status`, { dismissed });
  }

  // ───── Screening ─────
  board(jobId: string | null): Observable<ScreeningBoard> {
    let p = new HttpParams();
    if (jobId) p = p.set('jobId', jobId);
    return this.http.get<ScreeningBoard>(`${this.base}/screening`, { params: p });
  }

  screening(applicationId: string): Observable<Screening | null> {
    return this.http.get<Screening | null>(`${this.base}/screening/${applicationId}`);
  }

  screen(applicationId: string, cvText: string | null, cvPdfBase64: string | null): Observable<Screening> {
    return this.http.post<Screening>(`${this.base}/screening/${applicationId}`, { cvText, cvPdfBase64 }, this.quiet);
  }
}
