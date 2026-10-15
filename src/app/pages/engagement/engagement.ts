import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { todayIso } from '../lifecycle/lifecycle.models';
import { EngagementService } from './engagement.service';
import { PaginationComponent } from '../../shared/pagination/pagination';
import { clientPager } from '../../shared/pagination/client-pager';
import {
  EngagementSummary, FeedScope, Lookups, MAX_OPTIONS, MAX_QUESTIONS, MAX_RECIPIENTS, NPS_SCALE, QUESTION_ICON, QUESTION_TYPES,
  QuestionResult, QuestionType, RATINGS, RECOGNITION_VALUES, Recognition, RecognitionStats, RecognitionValue, STATUS_CHIP,
  SURVEY_STATUSES, StatsPeriod, SurveyAudience, SurveyDetail, SurveyListItem, SurveyResults, SurveyStatus, SurveyTemplate,
  VALUE_ICON, initials, npsTone, ratingTone
} from './engagement.models';

type Tab = 'surveys' | 'recognition';
type Drawer = 'survey' | 'surveyEdit' | 'answer' | 'results' | 'templates' | 'give';

const TABS: readonly Tab[] = ['surveys', 'recognition'];
const FEED_PAGE = 30;

interface QuestionForm {
  key: number;
  text: string;
  type: QuestionType;
  options: string[];
  isRequired: boolean;
}

interface SurveyForm {
  id: string | null;
  published: boolean;
  title: string;
  description: string;
  isAnonymous: boolean;
  audience: SurveyAudience;
  departmentId: string;
  closesOn: string;
  questions: QuestionForm[];
}

interface AnswerForm {
  values: Record<string, number | null>;
  texts: Record<string, string>;
}

interface GiveForm {
  picked: Set<string>;
  search: string;
  value: RecognitionValue | '';
  message: string;
}

@Component({
  selector: 'app-engagement',
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './engagement.html',
  styleUrl: './engagement.css'
})
export class EngagementComponent {
  private readonly api = inject(EngagementService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly today = todayIso();
  readonly statuses = SURVEY_STATUSES;
  readonly questionTypes = QUESTION_TYPES;
  readonly values = RECOGNITION_VALUES;
  readonly ratings = RATINGS;
  readonly npsScale = NPS_SCALE;
  readonly statusChip = STATUS_CHIP;
  readonly questionIcon = QUESTION_ICON;
  readonly valueIcon = VALUE_ICON;
  readonly maxQuestions = MAX_QUESTIONS;
  readonly maxOptions = MAX_OPTIONS;
  readonly maxRecipients = MAX_RECIPIENTS;
  readonly initials = initials;
  readonly npsTone = npsTone;
  readonly ratingTone = ratingTone;

  readonly tab = signal<Tab>('surveys');
  readonly saving = signal(false);
  readonly summary = signal<EngagementSummary | null>(null);
  readonly lookups = signal<Lookups>({ departments: [], people: [] });

  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  readonly canSeeResults = computed(() => this.summary()?.canSeeResults ?? false);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);

  // ───── Surveys ─────
  readonly mine = signal<SurveyListItem[] | null>(null);
  readonly toAnswer = computed(() => (this.mine() ?? []).filter(s => s.canRespond));
  readonly answered = computed(() => (this.mine() ?? []).filter(s => !s.canRespond).slice(0, 6));
  readonly all = signal<SurveyListItem[] | null>(null);
  readonly allPager = clientPager(() => this.all() ?? []);
  readonly allStatus = signal<SurveyStatus | ''>('');
  readonly allSearch = signal('');
  private readonly all$ = new Subject<void>();

  // ───── Recognition ─────
  readonly feed = signal<Recognition[] | null>(null);
  readonly feedMore = signal(false);
  readonly feedScope = signal<FeedScope>('all');
  readonly feedValue = signal<RecognitionValue | ''>('');
  readonly feedDept = signal('');
  readonly stats = signal<RecognitionStats | null>(null);
  readonly period = signal<StatsPeriod>('month');
  readonly statsMax = computed(() => Math.max(1, ...(this.stats()?.byValue ?? []).map(v => v.count)));

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly survey = signal<SurveyDetail | null>(null);
  readonly results = signal<SurveyResults | null>(null);
  readonly templates = signal<SurveyTemplate[] | null>(null);

  surveyForm: SurveyForm | null = null;
  answerForm: AnswerForm | null = null;
  giveForm: GiveForm | null = null;
  reopenDate = '';
  reopening = false;
  confirm: string | null = null;
  private questionKey = 0;

  readonly myId = computed(() => this.summary()?.myEmployeeId ?? null);
  readonly givable = computed(() => this.lookups().people.filter(p => p.id !== this.myId()));

  constructor() {
    this.all$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadAll());

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const surveyId = route.get('survey');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
        this.loadMine();
        if (s.canSeeResults) this.loadAll();
        this.setTab(wanted && TABS.includes(wanted) ? wanted : 'surveys');
        if (surveyId) this.openSurvey(surveyId);
      },
      error: e => this.fail(e, 'engagement.errors.load')
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'recognition') {
      if (this.feed() === null) this.loadFeed();
      if (this.stats() === null) this.loadStats();
    }
  }

  // ───── Loading ─────
  loadMine(): void {
    if (!this.linked()) {
      this.mine.set([]);
      return;
    }
    this.api.surveys('mine').subscribe({ next: l => this.mine.set(l), error: () => this.mine.set([]) });
  }

  loadAll(): void {
    if (!this.canSeeResults()) return;
    this.api.surveys('all', this.allStatus(), this.allSearch()).subscribe({ next: l => this.all.set(l), error: () => this.all.set([]) });
  }

  loadFeed(append = false): void {
    const current = append ? this.feed() ?? [] : [];
    const before = append && current.length ? current[current.length - 1]!.createdAt : null;
    this.api.recognitions({ scope: this.feedScope(), value: this.feedValue(), departmentId: this.feedDept(), before }, FEED_PAGE).subscribe({
      next: l => {
        this.feed.set([...current, ...l]);
        this.feedMore.set(l.length === FEED_PAGE);
      },
      error: () => this.feed.set(current)
    });
  }

  loadStats(): void {
    this.api.stats(this.period()).subscribe({ next: s => this.stats.set(s), error: () => this.stats.set(null) });
  }

  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    this.loadMine();
    if (this.all() !== null) this.loadAll();
  }

  setAllStatus(v: SurveyStatus | ''): void {
    this.allStatus.set(v);
    this.allPager.reset();
    this.loadAll();
  }

  onAllSearch(v: string): void {
    this.allSearch.set(v);
    this.allPager.reset();
    this.all$.next();
  }

  setScope(v: FeedScope): void {
    this.feedScope.set(v);
    this.loadFeed();
  }

  setFeedValue(v: RecognitionValue | ''): void {
    this.feedValue.set(v);
    this.loadFeed();
  }

  setFeedDept(v: string): void {
    this.feedDept.set(v);
    this.loadFeed();
  }

  setPeriod(p: StatsPeriod): void {
    this.period.set(p);
    this.loadStats();
  }

  /** Close date ke din: aaj, kal, N din. */
  closesKey(s: SurveyListItem): { key: string; n: number } | null {
    if (s.status !== 'Open' || s.daysLeft === null) return null;
    if (s.daysLeft === 0) return { key: 'engagement.closesToday', n: 0 };
    return { key: s.daysLeft === 1 ? 'engagement.closesTomorrow' : 'engagement.closesInDays', n: s.daysLeft };
  }

  rateText(rate: number | null): string {
    return rate === null ? '—' : `${new DecimalPipe(this.lang()).transform(rate, '1.0-0')}%`;
  }

  signed(n: number | null): string {
    return n === null ? '—' : n > 0 ? `+${n}` : `${n}`;
  }

  barWidth(count: number, q: QuestionResult): number {
    const max = Math.max(1, ...q.distribution);
    return Math.round((100 * count) / max);
  }

  share(count: number, q: QuestionResult): number {
    const total = q.distribution.reduce((a, b) => a + b, 0);
    return total ? Math.round((100 * count) / total) : 0;
  }

  /** NPS bar ka rang: 0-6 detractor, 7-8 passive, 9-10 promoter. */
  npsBand(n: number): string {
    return n <= 6 ? 'is-low' : n <= 8 ? 'is-mid' : 'is-good';
  }

  ratingLabel(n: number): string {
    return this.translate.instant(`engagement.rating.${n}`);
  }

  // ───── Survey detail / actions ─────
  openSurvey(id: string): void {
    this.resetForms();
    this.survey.set(null);
    this.drawer.set('survey');
    this.api.survey(id).subscribe({
      next: d => {
        if (!this.canSeeResults() && d.survey.canRespond) {
          this.startAnswer(d);
          return;
        }
        this.survey.set(d);
      },
      error: e => {
        this.closeDrawer();
        this.fail(e, 'engagement.errors.load');
      }
    });
  }

  private reloadSurvey(): void {
    const id = this.survey()?.survey.id;
    if (id && this.drawer() === 'survey') this.api.survey(id).subscribe({ next: d => this.survey.set(d), error: () => undefined });
  }

  publish(d: SurveyDetail): void {
    if (this.confirm !== 'publish') {
      this.confirm = 'publish';
      return;
    }
    this.surveyCall(this.api.publish(d.survey.id), 'engagement.msg.published', d.survey.title);
  }

  closeSurvey(d: SurveyDetail): void {
    if (this.confirm !== 'close') {
      this.confirm = 'close';
      return;
    }
    this.surveyCall(this.api.close(d.survey.id), 'engagement.msg.closed', d.survey.title);
  }

  startReopen(): void {
    this.reopening = true;
    this.reopenDate = '';
  }

  reopen(d: SurveyDetail): void {
    if (this.reopenDate && this.reopenDate < this.today) return;
    this.surveyCall(this.api.reopen(d.survey.id, this.reopenDate || null), 'engagement.msg.reopened', d.survey.title);
  }

  deleteSurvey(d: SurveyDetail): void {
    if (this.confirm !== 'delete') {
      this.confirm = 'delete';
      return;
    }
    this.saving.set(true);
    this.api.deleteSurvey(d.survey.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.done('engagement.msg.deleted', { title: d.survey.title });
      },
      error: e => this.fail(e)
    });
  }

  private surveyCall(call$: Observable<void>, key: string, title: string): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.done(key, { title });
        this.reloadSurvey();
      },
      error: e => this.fail(e)
    });
  }

  openResults(id: string): void {
    this.resetForms();
    this.results.set(null);
    this.drawer.set('results');
    this.api.results(id).subscribe({
      next: r => this.results.set(r),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'engagement.errors.load');
      }
    });
  }

  // ───── Survey form ─────
  newSurvey(): void {
    this.resetForms();
    this.surveyForm = {
      id: null, published: false, title: '', description: '', isAnonymous: true, audience: 'Everyone', departmentId: '', closesOn: '',
      questions: [this.blankQuestion('Rating')]
    };
    this.drawer.set('surveyEdit');
  }

  editSurvey(d: SurveyDetail): void {
    const s = d.survey;
    this.resetForms();
    this.surveyForm = {
      id: s.id, published: s.status !== 'Draft', title: s.title, description: s.description ?? '', isAnonymous: s.isAnonymous,
      audience: s.audience, departmentId: s.departmentId ?? '', closesOn: s.closesOn ?? '',
      questions: d.questions.map(q => ({ key: ++this.questionKey, text: q.text, type: q.type, options: [...q.options], isRequired: q.isRequired }))
    };
    this.drawer.set('surveyEdit');
  }

  private blankQuestion(type: QuestionType): QuestionForm {
    return { key: ++this.questionKey, text: '', type, options: type === 'Choice' ? ['', ''] : [], isRequired: type !== 'Text' };
  }

  addQuestion(type: QuestionType = 'Rating'): void {
    const f = this.surveyForm;
    if (f && f.questions.length < MAX_QUESTIONS) f.questions.push(this.blankQuestion(type));
  }

  removeQuestion(i: number): void {
    this.surveyForm?.questions.splice(i, 1);
  }

  moveQuestion(i: number, by: number): void {
    const list = this.surveyForm?.questions;
    const j = i + by;
    if (!list || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
  }

  setType(q: QuestionForm, type: QuestionType): void {
    q.type = type;
    if (type === 'Choice' && q.options.length < 2) q.options = [...q.options, '', ''].slice(0, Math.max(2, q.options.length));
  }

  addOption(q: QuestionForm): void {
    if (q.options.length < MAX_OPTIONS) q.options.push('');
  }

  removeOption(q: QuestionForm, i: number): void {
    q.options.splice(i, 1);
  }

  trackIndex(i: number): number {
    return i;
  }

  questionProblem(q: QuestionForm): string | null {
    if (!q.text.trim()) return 'engagement.form.needText';
    if (q.type === 'Choice') {
      const opts = q.options.map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) return 'engagement.form.needOptions';
      if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) return 'engagement.form.dupOptions';
    }
    return null;
  }

  canSaveSurvey(): boolean {
    const f = this.surveyForm;
    if (!f?.title.trim()) return false;
    if (f.audience === 'Department' && !f.departmentId) return false;
    if (f.closesOn && f.closesOn < this.today && !f.published) return false;
    return f.published || f.questions.every(q => !this.questionProblem(q));
  }

  saveSurvey(): void {
    const f = this.surveyForm;
    if (!f || !this.canSaveSurvey()) return;
    const body = {
      title: f.title.trim(), description: f.description.trim() || null, isAnonymous: f.isAnonymous, audience: f.audience,
      departmentId: f.audience === 'Department' ? f.departmentId : null, closesOn: f.closesOn || null,
      questions: f.published ? null : f.questions.map(q => ({
        text: q.text.trim(), type: q.type, isRequired: q.isRequired,
        options: q.type === 'Choice' ? q.options.map(o => o.trim()).filter(Boolean) : null
      }))
    };
    this.saving.set(true);
    const call$: Observable<unknown> = f.id ? this.api.updateSurvey(f.id, body) : this.api.createSurvey(body);
    call$.subscribe({
      next: r => {
        const id = f.id ?? (r as string);
        this.done('engagement.msg.saved', { title: body.title });
        this.openSurvey(id);
      },
      error: e => this.fail(e)
    });
  }

  openTemplates(): void {
    this.resetForms();
    this.drawer.set('templates');
    if (this.templates() === null)
      this.api.templates().subscribe({ next: l => this.templates.set(l), error: () => this.templates.set([]) });
  }

  useTemplate(t: SurveyTemplate): void {
    this.saving.set(true);
    this.api.fromTemplate(t.key).subscribe({
      next: id => {
        this.done('engagement.msg.fromTemplate', { title: t.title });
        this.api.survey(id).subscribe({ next: d => this.editSurvey(d), error: () => this.openSurvey(id) });
      },
      error: e => this.fail(e)
    });
  }

  // ───── Answering ─────
  answerSurvey(id: string): void {
    this.resetForms();
    this.survey.set(null);
    this.drawer.set('answer');
    this.api.survey(id).subscribe({
      next: d => this.startAnswer(d),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'engagement.errors.load');
      }
    });
  }

  private startAnswer(d: SurveyDetail): void {
    this.survey.set(d);
    this.answerForm = {
      values: Object.fromEntries(d.questions.filter(q => q.type !== 'Text').map(q => [q.id, null])),
      texts: Object.fromEntries(d.questions.filter(q => q.type === 'Text').map(q => [q.id, '']))
    };
    this.drawer.set('answer');
  }

  pick(questionId: string, value: number): void {
    if (this.answerForm) this.answerForm.values[questionId] = this.answerForm.values[questionId] === value ? null : value;
  }

  answeredCount(): number {
    const f = this.answerForm;
    const d = this.survey();
    if (!f || !d) return 0;
    return d.questions.filter(q => q.type === 'Text' ? !!f.texts[q.id]?.trim() : f.values[q.id] !== null).length;
  }

  missingRequired(): number {
    const f = this.answerForm;
    const d = this.survey();
    if (!f || !d) return 0;
    return d.questions.filter(q => q.isRequired && (q.type === 'Text' ? !f.texts[q.id]?.trim() : f.values[q.id] === null)).length;
  }

  submit(): void {
    const f = this.answerForm;
    const d = this.survey();
    if (!f || !d || this.missingRequired() || !this.answeredCount()) return;
    const answers = d.questions
      .map(q => q.type === 'Text'
        ? { questionId: q.id, value: null, text: f.texts[q.id]?.trim() || null }
        : { questionId: q.id, value: f.values[q.id] ?? null, text: null })
      .filter(a => a.value !== null || a.text !== null);
    this.saving.set(true);
    this.api.submit(d.survey.id, answers).subscribe({
      next: () => {
        this.closeDrawer();
        this.done('engagement.msg.submitted', { title: d.survey.title });
      },
      error: e => this.fail(e)
    });
  }

  // ───── Recognition ─────
  give(to?: string): void {
    this.resetForms();
    this.giveForm = { picked: new Set(to ? [to] : []), search: '', value: '', message: '' };
    this.drawer.set('give');
  }

  givePeople(): { id: string; name: string; extra: string | null }[] {
    const f = this.giveForm;
    const q = f?.search.trim().toLowerCase() ?? '';
    const list = this.givable();
    return (q ? list.filter(p => p.name.toLowerCase().includes(q) || (p.extra ?? '').toLowerCase().includes(q)) : list).slice(0, 60);
  }

  pickedPeople(): { id: string; name: string }[] {
    const f = this.giveForm;
    return f ? this.givable().filter(p => f.picked.has(p.id)) : [];
  }

  togglePerson(id: string): void {
    const f = this.giveForm;
    if (!f) return;
    if (f.picked.has(id)) f.picked.delete(id);
    else if (f.picked.size < MAX_RECIPIENTS) f.picked.add(id);
  }

  canGive(): boolean {
    const f = this.giveForm;
    return !!f && f.picked.size > 0 && !!f.value && f.message.trim().length >= 3;
  }

  sendRecognition(): void {
    const f = this.giveForm;
    if (!f || !this.canGive()) return;
    const names = this.pickedPeople().map(p => p.name).join(', ');
    this.saving.set(true);
    this.api.give([...f.picked], f.value as RecognitionValue, f.message.trim()).subscribe({
      next: () => {
        this.closeDrawer();
        this.done('engagement.msg.recognised', { names });
        this.loadFeed();
        this.loadStats();
      },
      error: e => this.fail(e)
    });
  }

  toggleCheer(r: Recognition): void {
    if (!this.linked() || r.isMine) return;
    const on = !r.iCheered;
    this.api.cheer(r.id, on).subscribe({
      next: n => this.feed.update(list => (list ?? []).map(x => x.id === r.id ? { ...x, cheers: n, iCheered: on } : x)),
      error: e => this.fail(e)
    });
  }

  removeRecognition(r: Recognition): void {
    const key = 'rec:' + r.id;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.api.deleteRecognition(r.id).subscribe({
      next: () => {
        this.confirm = null;
        this.feed.update(list => (list ?? []).filter(x => x.id !== r.id));
        this.alert.success(this.translate.instant('engagement.msg.removed'));
        this.loadStats();
        this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
      },
      error: e => this.fail(e)
    });
  }

  // ───── Helpers ─────
  private resetForms(): void {
    this.surveyForm = null;
    this.answerForm = null;
    this.giveForm = null;
    this.reopening = false;
    this.reopenDate = '';
    this.confirm = null;
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.survey.set(null);
    this.results.set(null);
    this.resetForms();
  }

  private done(key: string, params: Record<string, string | number>): void {
    this.saving.set(false);
    this.alert.success(this.translate.instant(key, params));
    this.confirm = null;
    this.reopening = false;
    this.refresh();
  }

  private fail(e: unknown, fallback = 'engagement.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
