import { ActivatedRoute, Router } from '@angular/router';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { RecruitmentService } from '../recruitment/recruitment.service';
import { utc } from '../admin/admin.models';
import { AiService } from './ai.service';
import {
  AREAS, AiArea, AiHome, ChatMessage, ConversationItem, FIT_CHIP, HISTORY_DAYS, Insight, Insights, LEVEL_CHIP, MAX_CV_CHARS,
  MAX_PDF_BYTES, MAX_QUESTION, Screening, ScreeningBoard, ScreeningRow, joinAreas, parseAreas
} from './ai.models';
import { plainText, renderMarkdown } from './markdown';

type Tab = 'chat' | 'insights' | 'screening' | 'settings';
const TABS: readonly Tab[] = ['chat', 'insights', 'screening', 'settings'];

/** Jab tak jawab aaye, sawal turant dikhe (server ke jawab par asal row se badal jata hai). */
interface PendingTurn {
  question: string;
}

interface SettingsForm {
  areas: Set<AiArea>;
  monthlyLimit: number;
  historyDays: number;
  selfService: boolean;
}

const SUGGESTIONS = ['ai.suggest.joined', 'ai.suggest.late', 'ai.suggest.payroll', 'ai.suggest.policy'] as const;

@Component({
  selector: 'app-ai',
  imports: [DatePipe, DecimalPipe, FormsModule, NgClass, TranslatePipe],
  templateUrl: './ai.html',
  styleUrl: './ai.css'
})
export class AiComponent {
  private readonly api = inject(AiService);
  private readonly recruitment = inject(RecruitmentService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly areas = AREAS;
  readonly historyOptions = HISTORY_DAYS;
  readonly levelChip = LEVEL_CHIP;
  readonly fitChip = FIT_CHIP;
  readonly suggestions = SUGGESTIONS;
  readonly maxQuestion = MAX_QUESTION;
  readonly today = new Date();

  readonly home = signal<AiHome | null>(null);
  readonly failed = signal(false);
  readonly tab = signal<Tab>('chat');
  readonly saving = signal(false);

  readonly configured = computed(() => this.home()?.configured ?? false);
  readonly usage = computed(() => this.home()?.usage ?? null);
  readonly limitReached = computed(() => {
    const u = this.usage();
    return !!u && u.used >= u.limit;
  });
  readonly usagePct = computed(() => {
    const u = this.usage();
    return !u || u.limit <= 0 ? 100 : Math.min(100, Math.round((u.used / u.limit) * 100));
  });
  readonly tabs = computed(() => {
    const h = this.home();
    if (!h) return [] as Tab[];
    return TABS.filter(t => (t === 'chat' && h.canChat) || (t === 'insights' && h.canInsights)
      || (t === 'screening' && h.canScreen) || (t === 'settings' && h.canManage));
  });
  /** Model tak call ho sakti hai? (key + had) */
  readonly canCall = computed(() => this.configured() && !this.limitReached());

  // ───── Chat ─────
  readonly conversations = signal<ConversationItem[] | null>(null);
  readonly activeId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly canContinue = signal(true);
  readonly pending = signal<PendingTurn | null>(null);
  readonly loadingChat = signal(false);
  question = '';
  confirmDelete: string | null = null;
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  private readonly htmlCache = new Map<string, string>();

  readonly visibleAreas = computed(() => {
    const on = parseAreas(this.home()?.settings.areas);
    return AREAS.filter(a => on.has(a.key));
  });

  // ───── Insights ─────
  readonly insights = signal<Insights | null>(null);
  readonly showDismissed = signal(false);
  readonly areaFilter = signal<string>('');
  readonly running = signal(false);
  readonly insightAreas = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this.insights()?.items ?? []) counts.set(i.area, (counts.get(i.area) ?? 0) + 1);
    return [...counts.entries()].map(([area, n]) => ({ area, n }));
  });
  readonly shownInsights = computed(() => {
    const f = this.areaFilter();
    const items = this.insights()?.items ?? [];
    return f ? items.filter(i => i.area === f) : items;
  });

  // ───── Screening ─────
  readonly board = signal<ScreeningBoard | null>(null);
  readonly selected = signal<ScreeningRow | null>(null);
  readonly screening = signal<Screening | null>(null);
  readonly loadingScreening = signal(false);
  readonly screeningBusy = signal(false);
  readonly ranked = computed(() => {
    const rows = [...(this.board()?.rows ?? [])];
    return rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.candidateName.localeCompare(b.candidateName));
  });
  readonly screenedCount = computed(() => (this.board()?.rows ?? []).filter(r => r.score !== null).length);
  readonly currentJob = computed(() => {
    const b = this.board();
    return b?.jobs.find(j => j.id === b.jobId) ?? null;
  });
  cvText = '';
  cvFile: { name: string; base64: string } | null = null;
  rescreen = false;

  // ───── Settings ─────
  settingsForm: SettingsForm | null = null;

  constructor() {
    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const chatId = route.get('chat');

    this.api.home().subscribe({
      next: h => {
        this.home.set(h);
        const allowed = this.tabs();
        if (!allowed.length) return;
        this.setTab(wanted && allowed.includes(wanted) ? wanted : allowed[0]!);
        if (chatId && h.canChat) this.openChat(chatId);
      },
      error: e => {
        this.failed.set(true);
        this.fail(e, 'ai.errors.load');
      }
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'chat' && this.conversations() === null) this.loadConversations();
    if (t === 'insights' && this.insights() === null) this.loadInsights();
    if (t === 'screening' && this.board() === null) this.loadBoard(null);
    if (t === 'settings' && !this.settingsForm) this.resetSettings();
  }

  // ═════ Chat ═════
  loadConversations(): void {
    this.api.conversations().subscribe({ next: l => this.conversations.set(l), error: () => this.conversations.set([]) });
  }

  newChat(): void {
    this.activeId.set(null);
    this.messages.set([]);
    this.canContinue.set(true);
    this.question = '';
    queueMicrotask(() => this.composer()?.nativeElement.focus());
  }

  openChat(id: string): void {
    if (this.pending()) return;
    this.activeId.set(id);
    this.loadingChat.set(true);
    this.api.conversation(id).subscribe({
      next: c => {
        this.messages.set(c.messages);
        this.canContinue.set(c.canContinue);
        this.loadingChat.set(false);
        this.scrollDown();
      },
      error: e => {
        this.loadingChat.set(false);
        this.activeId.set(null);
        this.fail(e, 'ai.errors.load');
      }
    });
  }

  useSuggestion(key: string): void {
    this.question = this.translate.instant(key);
    this.send();
  }

  onComposerKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.send();
    }
  }

  send(): void {
    const q = this.question.trim();
    if (!q || this.pending() || !this.canCall() || !this.canContinue()) return;
    this.pending.set({ question: q });
    this.question = '';
    this.scrollDown();
    this.api.ask(this.activeId(), q, this.lang()).subscribe({
      next: r => {
        this.pending.set(null);
        const isNew = this.activeId() !== r.conversationId;
        this.activeId.set(r.conversationId);
        this.messages.update(m => [...(isNew ? [] : m), r.question, r.answer]);
        this.patchUsage(r.usage);
        this.upsertConversation(r.conversationId, r.title, r.answer.at);
        this.scrollDown();
      },
      error: e => {
        this.pending.set(null);
        this.question = q;
        this.fail(e, 'ai.errors.ask');
        this.refreshHome();
      }
    });
  }

  deleteChat(id: string): void {
    this.api.deleteConversation(id).subscribe({
      next: () => {
        this.confirmDelete = null;
        this.conversations.update(l => (l ?? []).filter(c => c.id !== id));
        if (this.activeId() === id) this.newChat();
      },
      error: e => this.fail(e)
    });
  }

  html(m: ChatMessage): string {
    let h = this.htmlCache.get(m.id);
    if (h === undefined) {
      h = renderMarkdown(m.text);
      this.htmlCache.set(m.id, h);
    }
    return h;
  }

  /** Jawab ke andar /app/... link: poora page reload na ho, router se jao. */
  onAnswerClick(e: MouseEvent): void {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (href?.startsWith('/app/')) {
      e.preventDefault();
      this.router.navigateByUrl(href);
    }
  }

  copy(m: ChatMessage): void {
    navigator.clipboard?.writeText(plainText(m.text)).then(
      () => this.alert.success(this.translate.instant('ai.copied')),
      () => undefined
    );
  }

  private upsertConversation(id: string, title: string, at: string): void {
    this.conversations.update(list => {
      const rest = (list ?? []).filter(c => c.id !== id);
      const old = (list ?? []).find(c => c.id === id);
      return [{ id, title, lastMessageAt: at, turnCount: (old?.turnCount ?? 0) + 1 }, ...rest];
    });
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  dayKey(value: string): 'today' | 'yesterday' | 'earlier' {
    const d = utc(value);
    if (!d) return 'earlier';
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (d >= start) return 'today';
    start.setDate(start.getDate() - 1);
    return d >= start ? 'yesterday' : 'earlier';
  }

  // ═════ Insights ═════
  loadInsights(): void {
    this.api.insights(this.showDismissed()).subscribe({
      next: i => {
        this.insights.set(i);
        if (this.areaFilter() && !i.items.some(x => x.area === this.areaFilter())) this.areaFilter.set('');
      },
      error: () => this.insights.set({ lastRunAt: null, lastRunBy: null, items: [] })
    });
  }

  setInsightView(dismissed: boolean): void {
    this.showDismissed.set(dismissed);
    this.areaFilter.set('');
    this.insights.set(null);
    this.loadInsights();
  }

  runInsights(): void {
    if (this.running() || !this.canCall()) return;
    this.running.set(true);
    this.api.runInsights().subscribe({
      next: i => {
        this.running.set(false);
        this.showDismissed.set(false);
        this.areaFilter.set('');
        this.insights.set(i);
        this.refreshHome();
      },
      error: e => {
        this.running.set(false);
        this.fail(e, 'ai.errors.run');
      }
    });
  }

  toggleInsight(i: Insight): void {
    const dismiss = i.status === 'Open';
    this.api.setInsight(i.id, dismiss).subscribe({
      next: () => this.insights.update(s => (s ? { ...s, items: s.items.filter(x => x.id !== i.id) } : s)),
      error: e => this.fail(e)
    });
  }

  askAbout(i: Insight): void {
    this.newChat();
    this.question = this.translate.instant('ai.insight.askPrompt', { title: i.title, metric: i.metric ?? '' }).trim();
    this.setTab('chat');
  }

  openLink(link: string): void {
    if (link.startsWith('/app/')) this.router.navigateByUrl(link);
  }

  // ═════ Screening ═════
  loadBoard(jobId: string | null): void {
    this.board.set(null);
    this.selected.set(null);
    this.screening.set(null);
    this.api.board(jobId).subscribe({
      next: b => {
        this.board.set(b);
        const first = [...b.rows].sort((x, y) => (y.score ?? -1) - (x.score ?? -1))[0];
        if (first) this.select(first);
      },
      error: e => {
        this.board.set({ jobs: [], jobId: null, rows: [] });
        this.fail(e, 'ai.errors.load');
      }
    });
  }

  select(row: ScreeningRow): void {
    this.selected.set(row);
    this.screening.set(null);
    this.resetCv();
    if (!row.screeningId) return;
    this.loadingScreening.set(true);
    this.api.screening(row.applicationId).subscribe({
      next: s => {
        this.loadingScreening.set(false);
        if (this.selected()?.applicationId === row.applicationId) this.screening.set(s);
      },
      error: () => this.loadingScreening.set(false)
    });
  }

  async onCvFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.alert.error(this.translate.instant('ai.screen.pdfOnly'));
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      this.alert.error(this.translate.instant('ai.screen.pdfTooBig'));
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let k = 0; k < bytes.length; k += 0x8000) binary += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
    this.cvFile = { name: file.name, base64: btoa(binary) };
    this.cvText = '';
  }

  canScreenNow(): boolean {
    return this.canCall() && !this.screeningBusy() && (!!this.cvFile || this.cvText.trim().length >= 80)
      && this.cvText.length <= MAX_CV_CHARS;
  }

  screen(): void {
    const row = this.selected();
    if (!row || !this.canScreenNow()) return;
    this.screeningBusy.set(true);
    this.api.screen(row.applicationId, this.cvFile ? null : this.cvText.trim(), this.cvFile?.base64 ?? null).subscribe({
      next: s => {
        this.screeningBusy.set(false);
        this.screening.set(s);
        this.resetCv();
        const updated: ScreeningRow = { ...row, screeningId: s.id, score: s.score, fit: s.fit, screenedAt: s.at };
        this.board.update(b => (b ? { ...b, rows: b.rows.map(r => (r.applicationId === row.applicationId ? updated : r)) } : b));
        this.selected.set(updated);
        this.refreshHome();
      },
      error: e => {
        this.screeningBusy.set(false);
        this.fail(e, 'ai.errors.screen');
      }
    });
  }

  moveToInterview(row: ScreeningRow): void {
    this.saving.set(true);
    this.recruitment.move(row.applicationId, 'Interview', null).subscribe({
      next: () => {
        this.saving.set(false);
        const updated: ScreeningRow = { ...row, stage: 'Interview' };
        this.board.update(b => (b ? { ...b, rows: b.rows.map(r => (r.applicationId === row.applicationId ? updated : r)) } : b));
        this.selected.set(updated);
        this.alert.success(this.translate.instant('ai.screen.moved', { name: row.candidateName }));
      },
      error: e => this.fail(e)
    });
  }

  openPipeline(): void {
    const job = this.board()?.jobId;
    this.router.navigate(['/app/talent/recruitment'], { queryParams: job ? { job } : {} });
  }

  resetCv(): void {
    this.cvText = '';
    this.cvFile = null;
    this.rescreen = false;
  }

  candidateLine(r: ScreeningRow): string {
    const parts: string[] = [];
    if (r.currentTitle) parts.push(r.currentTitle);
    if (r.experienceYears !== null) parts.push(this.translate.instant('ai.screen.years', { n: r.experienceYears }));
    if (r.city) parts.push(r.city);
    return parts.join(' · ');
  }

  // ═════ Settings ═════
  resetSettings(): void {
    const s = this.home()?.settings;
    if (!s) return;
    this.settingsForm = {
      areas: parseAreas(s.areas),
      monthlyLimit: s.monthlyLimit,
      historyDays: s.historyDays,
      selfService: s.selfService
    };
  }

  toggleArea(key: AiArea): void {
    const f = this.settingsForm;
    if (!f) return;
    if (f.areas.has(key)) f.areas.delete(key); else f.areas.add(key);
  }

  saveSettings(): void {
    const f = this.settingsForm;
    const h = this.home();
    if (!f || !h || this.saving()) return;
    const limit = Math.round(Number(f.monthlyLimit));
    if (!Number.isFinite(limit) || limit < 0 || limit > 100_000) {
      this.alert.error(this.translate.instant('ai.settings.limitRange'));
      return;
    }
    this.saving.set(true);
    this.api.saveSettings({
      areas: joinAreas(f.areas),
      monthlyLimit: limit,
      historyDays: Number(f.historyDays),
      selfService: f.selfService,
      rowVersion: h.settings.rowVersion || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('ai.settings.saved'));
        this.refreshHome(() => this.resetSettings());
        this.conversations.set(null);
        this.insights.set(null);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Helpers ─────
  private patchUsage(usage: AiHome['usage']): void {
    this.home.update(h => (h ? { ...h, usage } : h));
  }

  private refreshHome(then?: () => void): void {
    this.api.home().subscribe({
      next: h => {
        this.home.set(h);
        then?.();
      },
      error: () => undefined
    });
  }

  private fail(e: unknown, fallback = 'ai.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
