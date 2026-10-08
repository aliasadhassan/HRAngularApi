import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { PeopleService } from '../people/people.service';
import { addDays, todayIso } from '../lifecycle/lifecycle.models';
import { PerformanceService } from './performance.service';
import {
  CHECKIN_STATUSES, CYCLE_CHIP, GOAL_CHIP, GOAL_STATUSES, GoalDetail, GoalListItem, GoalStatus, MyPerformance, PerformancePerson,
  PerformanceSummary, RATINGS, REVIEW_CHIP, REVIEW_STATUSES, Review, ReviewCycle, ReviewListItem, ReviewStatus, isClosedGoal
} from './performance.models';

type Tab = 'mine' | 'reviews' | 'goals' | 'cycles';
type Drawer = 'review' | 'goal' | 'goalEdit' | 'cycleEdit' | 'cycle';

const TABS: readonly Tab[] = ['mine', 'reviews', 'goals', 'cycles'];

interface GoalForm {
  id: string | null;
  employeeId: string;
  title: string;
  description: string;
  cycleId: string;
  weight: number | null;
  startDate: string;
  dueDate: string;
}

interface CycleForm {
  id: string | null;
  locked: boolean;
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  includeSelfReview: boolean;
  selfReviewDue: string;
  managerReviewDue: string;
}

interface LaunchForm {
  cycle: ReviewCycle;
  mode: 'launch' | 'add';
  departmentIds: string[];
  employeeIds: string[];
  search: string;
}

@Component({
  selector: 'app-performance',
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './performance.html',
  styleUrl: './performance.css'
})
export class PerformanceComponent {
  private readonly api = inject(PerformanceService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);
  private readonly peopleApi = inject(PeopleService);

  readonly lang = inject(LanguageService).language;
  readonly ratings = RATINGS;
  readonly reviewStatuses = REVIEW_STATUSES;
  readonly goalStatuses = GOAL_STATUSES;
  readonly checkInStatuses = CHECKIN_STATUSES;
  readonly reviewChip = REVIEW_CHIP;
  readonly goalChip = GOAL_CHIP;
  readonly cycleChip = CYCLE_CHIP;
  readonly isClosedGoal = isClosedGoal;
  readonly today = todayIso();
  readonly canView = this.perms.hasAny(P.employeesView);
  readonly canManage = this.perms.hasAny(P.employeesEdit);

  readonly tab = signal<Tab>(this.canView ? 'reviews' : 'mine');
  readonly busy = signal<string | null>(null);
  readonly saving = signal(false);

  // ───── Shared data ─────
  readonly summary = signal<PerformanceSummary | null>(null);
  readonly my = signal<MyPerformance | null>(null);
  readonly people = signal<PerformancePerson[]>([]);
  readonly cycles = signal<ReviewCycle[] | null>(null);
  readonly departments = signal<{ id: string; name: string }[]>([]);

  /** Manager = koi direct report ya jis ka reviewer hai — HR ke ilawa bhi team tabs dikhte hain */
  readonly hasTeam = computed(() => this.canView || this.people().some(p => !p.isSelf) || !!this.my()?.toReview.length);
  readonly openCycles = computed(() => (this.cycles() ?? []).filter(c => c.status !== 'Closed'));
  readonly myOpenGoals = computed(() => (this.my()?.goals ?? []).filter(g => !isClosedGoal(g.status)));
  readonly myClosedGoals = computed(() => (this.my()?.goals ?? []).filter(g => isClosedGoal(g.status)));
  readonly mySelfPending = computed(() => (this.my()?.reviews ?? []).filter(r => r.status === 'SelfReview' && r.cycleStatus === 'Active'));
  readonly myToAck = computed(() => (this.my()?.reviews ?? []).filter(r => r.status === 'Shared'));
  readonly managerQueue = computed(() => (this.my()?.toReview ?? []).filter(r => r.status === 'ManagerReview').length);

  // ───── Team lists ─────
  readonly reviews = signal<ReviewListItem[] | null>(null);
  readonly goals = signal<GoalListItem[] | null>(null);
  readonly cycleId = signal('');
  readonly reviewStatus = signal<ReviewStatus | ''>('');
  readonly goalStatus = signal<GoalStatus | ''>('');
  readonly overdue = signal(false);
  readonly search = signal('');
  private readonly search$ = new Subject<void>();

  // ───── Drawer ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly review = signal<Review | null>(null);
  readonly goal = signal<GoalDetail | null>(null);
  selfForm: { rating: number | null; summary: string } | null = null;
  managerForm: { rating: number | null; summary: string; strengths: string; improvements: string } | null = null;
  ackComment = '';
  reviewerForm: string | null = null;
  checkInForm: { progress: number; status: GoalStatus; note: string } | null = null;
  cancelNote: string | null = null;
  goalForm: GoalForm | null = null;
  cycleForm: CycleForm | null = null;
  launchForm: LaunchForm | null = null;
  confirm: string | null = null;

  constructor() {
    this.loadMine();
    this.loadSummary();
    this.loadCycles();
    this.api.people().subscribe({ next: p => this.people.set(p), error: () => undefined });
    if (this.canView) this.loadReviews();

    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());

    // Dashboard / links se ?tab=goals
    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const tab = route.get('tab') as Tab | null;
    if (tab && TABS.includes(tab) && (tab !== 'cycles' || this.canView)) this.setTab(tab);
  }

  // ───── Loading ─────
  loadMine(): void {
    this.api.mine().subscribe({ next: m => this.my.set(m), error: () => this.my.set({ linked: false, reviews: [], goals: [], toReview: [] }) });
  }

  loadSummary(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
  }

  loadCycles(): void {
    this.api.cycles().subscribe({ next: c => this.cycles.set(c), error: () => this.cycles.set([]) });
  }

  loadReviews(): void {
    this.api.reviews(this.cycleId(), this.reviewStatus(), this.overdue(), this.search()).subscribe({
      next: r => this.reviews.set(r),
      error: e => {
        this.reviews.set([]);
        this.fail(e, 'performance.errors.load');
      }
    });
  }

  loadGoals(): void {
    this.api.goals(this.cycleId(), this.goalStatus(), this.overdue(), this.search()).subscribe({
      next: r => this.goals.set(r),
      error: e => {
        this.goals.set([]);
        this.fail(e, 'performance.errors.load');
      }
    });
  }

  reload(): void {
    switch (this.tab()) {
      case 'reviews': this.loadReviews(); break;
      case 'goals': this.loadGoals(); break;
      case 'cycles': this.loadCycles(); break;
      case 'mine': this.loadMine(); break;
    }
  }

  setTab(t: Tab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    this.search.set('');
    this.overdue.set(false);
    this.confirm = null;
    this.reload();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next();
  }

  setCycle(value: string): void {
    this.cycleId.set(value);
    this.reload();
  }

  setReviewStatus(value: ReviewStatus | ''): void {
    this.reviewStatus.set(value);
    this.overdue.set(false);
    this.loadReviews();
  }

  setGoalStatus(value: GoalStatus | ''): void {
    this.goalStatus.set(value);
    this.loadGoals();
  }

  toggleOverdue(): void {
    this.overdue.update(v => !v);
    this.reload();
  }

  /** Tally click → reviews us status par (active cycle) */
  showReviews(status: ReviewStatus | '', overdue = false): void {
    this.reviewStatus.set(status);
    this.overdue.set(overdue);
    this.cycleId.set(this.summary()?.activeCycleId ?? '');
    if (this.tab() !== 'reviews') {
      this.tab.set('reviews');
      this.search.set('');
    }
    this.loadReviews();
  }

  showGoals(status: GoalStatus | '', overdue = false): void {
    this.goalStatus.set(status);
    this.overdue.set(overdue);
    this.cycleId.set('');
    if (this.tab() !== 'goals') {
      this.tab.set('goals');
      this.search.set('');
    }
    this.loadGoals();
  }

  // ───── Helpers ─────
  ratingLabel(n: number | null): string {
    return n ? this.translate.instant('performance.rating.' + n) : '';
  }

  /** Rating counts → bar width % (sab se bada = 100) */
  barWidth(counts: number[], n: number): number {
    const max = Math.max(...counts, 1);
    return Math.round((n / max) * 100);
  }

  /** Cycle progress stacked bar: ack / shared / manager / self */
  share(c: ReviewCycle, n: number): number {
    return c.reviews ? (n / c.reviews) * 100 : 0;
  }

  stageIndex(s: ReviewStatus): number {
    return REVIEW_STATUSES.indexOf(s);
  }

  stages(r: Review): ReviewStatus[] {
    return r.includeSelfReview ? [...REVIEW_STATUSES] : REVIEW_STATUSES.filter(s => s !== 'SelfReview');
  }

  // ───── Review drawer ─────
  openReview(id: string): void {
    this.review.set(null);
    this.resetForms();
    this.drawer.set('review');
    this.reloadReview(id);
  }

  private reloadReview(id: string): void {
    this.api.review(id).subscribe({
      next: r => {
        this.review.set(r);
        this.selfForm = r.canEditSelf ? { rating: r.selfRating, summary: r.selfSummary ?? '' } : null;
        this.managerForm = r.canEditManager
          ? { rating: r.managerRating, summary: r.managerSummary ?? '', strengths: r.strengths ?? '', improvements: r.improvements ?? '' }
          : null;
        this.ackComment = '';
      },
      error: e => this.fail(e, 'performance.errors.load')
    });
  }

  private resetForms(): void {
    this.selfForm = null;
    this.managerForm = null;
    this.reviewerForm = null;
    this.checkInForm = null;
    this.cancelNote = null;
    this.confirm = null;
    this.ackComment = '';
  }

  saveSelf(submit: boolean): void {
    const r = this.review();
    const f = this.selfForm;
    if (!r || !f || (submit && (!f.rating || !f.summary.trim()))) return;
    if (submit && this.confirm !== 'submitSelf') {
      this.confirm = 'submitSelf';
      return;
    }
    this.submitReview(this.api.saveSelf(r.id, { rating: f.rating, summary: f.summary.trim() || null, submit }),
      submit ? 'performance.msg.selfSubmitted' : 'performance.msg.draftSaved');
  }

  saveManager(submit: boolean): void {
    const r = this.review();
    const f = this.managerForm;
    if (!r || !f || (submit && (!f.rating || !f.summary.trim() || r.status === 'SelfReview'))) return;
    if (submit && this.confirm !== 'share') {
      this.confirm = 'share';
      return;
    }
    this.submitReview(this.api.saveManager(r.id, {
      rating: f.rating, summary: f.summary.trim() || null, strengths: f.strengths.trim() || null,
      improvements: f.improvements.trim() || null, submit
    }), submit ? 'performance.msg.shared' : 'performance.msg.draftSaved', { name: r.employeeName });
  }

  acknowledge(): void {
    const r = this.review();
    if (!r) return;
    this.submitReview(this.api.acknowledge(r.id, this.ackComment.trim() || null), 'performance.msg.acknowledged');
  }

  reopen(selfReview: boolean): void {
    const r = this.review();
    if (!r) return;
    const key = selfReview ? 'reopenSelf' : 'reopen';
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.submitReview(this.api.reopen(r.id, selfReview), 'performance.msg.reopened');
  }

  startReviewer(): void {
    const r = this.review();
    if (!r) return;
    this.reviewerForm = r.reviewerEmployeeId ?? '';
  }

  saveReviewer(): void {
    const r = this.review();
    if (!r || this.reviewerForm === null) return;
    this.submitReview(this.api.changeReviewer(r.id, this.reviewerForm || null), 'performance.msg.reviewerChanged');
  }

  /** Reviewer: koi bhi (khud employee nahi) */
  reviewerOptions(r: Review): PerformancePerson[] {
    return this.people().filter(p => p.id !== r.employeeId);
  }

  removeReview(): void {
    const r = this.review();
    if (!r) return;
    if (this.confirm !== 'removeReview') {
      this.confirm = 'removeReview';
      return;
    }
    this.saving.set(true);
    this.api.removeReview(r.id).subscribe({
      next: () => this.done('performance.msg.reviewRemoved', { name: r.employeeName }),
      error: e => this.fail(e)
    });
  }

  private submitReview(req: Observable<void>, key: string, params?: Record<string, string>): void {
    const r = this.review();
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForms();
        this.alert.success(this.translate.instant(key, params));
        if (r) this.reloadReview(r.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Goal drawer ─────
  openGoal(id: string): void {
    this.goal.set(null);
    this.resetForms();
    this.drawer.set('goal');
    this.reloadGoal(id);
  }

  private reloadGoal(id: string): void {
    this.api.goal(id).subscribe({ next: g => this.goal.set(g), error: e => this.fail(e, 'performance.errors.load') });
  }

  startCheckIn(): void {
    const g = this.goal()?.goal;
    if (!g) return;
    this.resetForms();
    this.checkInForm = { progress: g.progress, status: g.status === 'NotStarted' && g.progress === 0 ? 'OnTrack' : g.status, note: '' };
  }

  onProgress(value: number): void {
    const f = this.checkInForm;
    if (!f) return;
    f.progress = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (f.progress === 100) f.status = 'Completed';
    else if (f.status === 'Completed') f.status = 'OnTrack';
  }

  pickStatus(s: GoalStatus): void {
    const f = this.checkInForm;
    if (!f) return;
    f.status = s;
    if (s === 'Completed') f.progress = 100;
    else if (f.progress === 100) f.progress = 90;
  }

  /** Band goal dobara kholna: HR, khud ya team (people list wahi log hai) */
  canWorkOn(employeeId: string): boolean {
    return this.canManage || this.people().some(p => p.id === employeeId);
  }

  saveCheckIn(): void {
    const g = this.goal()?.goal;
    const f = this.checkInForm;
    if (!g || !f) return;
    this.submitGoal(this.api.checkIn(g.id, { progress: f.progress, status: f.status, note: f.note.trim() || null }),
      f.status === 'Completed' ? 'performance.msg.goalCompleted' : 'performance.msg.checkedIn', { title: g.title });
  }

  cancelGoal(): void {
    const g = this.goal()?.goal;
    if (!g) return;
    if (this.cancelNote === null) {
      this.resetForms();
      this.cancelNote = '';
      return;
    }
    this.submitGoal(this.api.cancelGoal(g.id, this.cancelNote.trim() || null), 'performance.msg.goalCancelled', { title: g.title });
  }

  reopenGoal(): void {
    const g = this.goal()?.goal;
    if (!g) return;
    this.submitGoal(this.api.reopenGoal(g.id), 'performance.msg.goalReopened', { title: g.title });
  }

  deleteGoal(): void {
    const g = this.goal()?.goal;
    if (!g) return;
    if (this.confirm !== 'deleteGoal') {
      this.confirm = 'deleteGoal';
      return;
    }
    this.saving.set(true);
    this.api.deleteGoal(g.id).subscribe({
      next: () => this.done('performance.msg.goalDeleted', { title: g.title }),
      error: e => this.fail(e)
    });
  }

  private submitGoal(req: Observable<void>, key: string, params?: Record<string, string>): void {
    const g = this.goal()?.goal;
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForms();
        this.alert.success(this.translate.instant(key, params));
        if (g) this.reloadGoal(g.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Add / edit goal ─────
  /** employeeId khali = khud (My tab) */
  newGoal(employeeId?: string): void {
    const self = this.people().find(p => p.isSelf)?.id ?? '';
    const active = this.openCycles().find(c => c.status === 'Active');
    this.goalForm = {
      id: null, employeeId: employeeId ?? (this.tab() === 'mine' ? self : ''), title: '', description: '',
      cycleId: active?.id ?? '', weight: null, startDate: this.today, dueDate: active?.periodEnd ?? addDays(this.today, 90)
    };
    this.confirm = null;
    this.drawer.set('goalEdit');
  }

  editGoal(): void {
    const g = this.goal()?.goal;
    if (!g) return;
    this.goalForm = {
      id: g.id, employeeId: g.employeeId, title: g.title, description: g.description ?? '', cycleId: g.cycleId ?? '',
      weight: g.weight, startDate: g.startDate ?? '', dueDate: g.dueDate
    };
    this.confirm = null;
    this.drawer.set('goalEdit');
  }

  /** Edit mein band cycle bhi dikhe agar goal us se juda hai */
  goalCycles(): ReviewCycle[] {
    const f = this.goalForm;
    return (this.cycles() ?? []).filter(c => c.status !== 'Closed' || c.id === f?.cycleId);
  }

  canSaveGoal(): boolean {
    const f = this.goalForm;
    return !!f && !!f.employeeId && !!f.title.trim() && !!f.dueDate && (!f.startDate || f.dueDate >= f.startDate)
      && (f.weight === null || (f.weight >= 0 && f.weight <= 100));
  }

  saveGoal(): void {
    const f = this.goalForm;
    if (!f || !this.canSaveGoal()) return;
    this.saving.set(true);
    const isNew = !f.id;
    this.api.saveGoal(f.id, {
      employeeId: f.employeeId, title: f.title.trim(), description: f.description.trim() || null, cycleId: f.cycleId || null,
      weight: f.weight ?? null, startDate: f.startDate || null, dueDate: f.dueDate
    }).subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(isNew ? 'performance.msg.goalCreated' : 'performance.msg.goalSaved'));
        this.goalForm = null;
        this.refreshLists();
        this.openGoal(id);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Cycles ─────
  newCycle(): void {
    const year = this.today.slice(0, 4);
    const h2 = Number(this.today.slice(5, 7)) > 6;
    const start = h2 ? `${year}-07-01` : `${year}-01-01`;
    const end = h2 ? `${year}-12-31` : `${year}-06-30`;
    this.cycleForm = {
      id: null, locked: false, name: `${year} ${h2 ? 'H2' : 'H1'}`, description: '', periodStart: start, periodEnd: end,
      includeSelfReview: true, selfReviewDue: addDays(this.today, 14), managerReviewDue: addDays(this.today, 28)
    };
    this.confirm = null;
    this.drawer.set('cycleEdit');
  }

  editCycle(c: ReviewCycle): void {
    this.cycleForm = {
      id: c.id, locked: c.status !== 'Draft', name: c.name, description: c.description ?? '', periodStart: c.periodStart,
      periodEnd: c.periodEnd, includeSelfReview: c.includeSelfReview, selfReviewDue: c.selfReviewDue ?? '', managerReviewDue: c.managerReviewDue
    };
    this.confirm = null;
    this.drawer.set('cycleEdit');
  }

  canSaveCycle(): boolean {
    const f = this.cycleForm;
    return !!f && !!f.name.trim() && !!f.periodStart && !!f.periodEnd && f.periodEnd >= f.periodStart && !!f.managerReviewDue
      && (!f.includeSelfReview || (!!f.selfReviewDue && f.selfReviewDue <= f.managerReviewDue));
  }

  saveCycle(): void {
    const f = this.cycleForm;
    if (!f || !this.canSaveCycle()) return;
    this.saving.set(true);
    this.api.saveCycle(f.id, {
      name: f.name.trim(), description: f.description.trim() || null, periodStart: f.periodStart, periodEnd: f.periodEnd,
      includeSelfReview: f.includeSelfReview, selfReviewDue: f.includeSelfReview ? f.selfReviewDue : null, managerReviewDue: f.managerReviewDue
    }).subscribe({
      next: () => this.done(f.id ? 'performance.msg.cycleSaved' : 'performance.msg.cycleCreated', { name: f.name.trim() }),
      error: e => this.fail(e)
    });
  }

  deleteCycle(c: ReviewCycle): void {
    if (this.confirm !== 'deleteCycle:' + c.id) {
      this.confirm = 'deleteCycle:' + c.id;
      return;
    }
    this.busy.set(c.id);
    this.api.deleteCycle(c.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.confirm = null;
        this.alert.success(this.translate.instant('performance.msg.cycleDeleted', { name: c.name }));
        this.loadCycles();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  closeCycle(c: ReviewCycle): void {
    if (this.confirm !== 'closeCycle:' + c.id) {
      this.confirm = 'closeCycle:' + c.id;
      return;
    }
    this.busy.set(c.id);
    this.api.closeCycle(c.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.confirm = null;
        this.alert.success(this.translate.instant('performance.msg.cycleClosed', { name: c.name }));
        this.loadCycles();
        this.loadSummary();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  /** Launch (departments) ya baad mein log jodna (employees) */
  openLaunch(c: ReviewCycle, mode: 'launch' | 'add'): void {
    this.launchForm = { cycle: c, mode, departmentIds: [], employeeIds: [], search: '' };
    this.confirm = null;
    this.drawer.set('cycle');
    if (mode === 'launch' && !this.departments().length)
      this.peopleApi.getDepartments().subscribe({ next: d => this.departments.set(d.filter(x => x.isActive).map(x => ({ id: x.id, name: x.name }))), error: () => undefined });
  }

  toggleIn(list: string[], id: string): void {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
  }

  filteredPeople(): PerformancePerson[] {
    const q = this.launchForm?.search.trim().toLowerCase() ?? '';
    const list = this.people();
    return q ? list.filter(p => p.name.toLowerCase().includes(q) || p.employeeCode.toLowerCase().includes(q)) : list;
  }

  runLaunch(): void {
    const f = this.launchForm;
    if (!f || (f.mode === 'add' && !f.employeeIds.length)) return;
    this.saving.set(true);
    const req = f.mode === 'launch' ? this.api.launch(f.cycle.id, f.departmentIds) : this.api.addReviews(f.cycle.id, f.employeeIds);
    req.subscribe({
      next: r => {
        this.saving.set(false);
        this.closeDrawer();
        this.alert.success(this.translate.instant(f.mode === 'launch' ? 'performance.msg.launched' : 'performance.msg.added',
          { name: f.cycle.name, n: r.created, skipped: r.skipped }));
        this.loadCycles();
        this.loadSummary();
        this.loadMine();
      },
      error: e => this.fail(e)
    });
  }

  viewCycleReviews(c: ReviewCycle): void {
    this.cycleId.set(c.id);
    this.reviewStatus.set('');
    this.overdue.set(false);
    this.tab.set('reviews');
    this.search.set('');
    this.loadReviews();
  }

  // ───── Plumbing ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.review.set(null);
    this.goal.set(null);
    this.goalForm = null;
    this.cycleForm = null;
    this.launchForm = null;
    this.resetForms();
  }

  private refreshLists(): void {
    this.loadSummary();
    this.loadMine();
    if (this.tab() !== 'mine') this.reload();
    if (this.tab() !== 'cycles' && this.canView) this.loadCycles();
  }

  private done(key: string, params?: Record<string, string>): void {
    this.saving.set(false);
    this.closeDrawer();
    this.alert.success(this.translate.instant(key, params));
    this.refreshLists();
    this.loadCycles();
  }

  private fail(e: unknown, fallback = 'performance.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
