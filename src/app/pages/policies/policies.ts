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
import { PoliciesService } from './policies.service';
import { PaginationComponent } from '../../shared/pagination/pagination';
import { clientPager } from '../../shared/pagination/client-pager';
import {
  ACK_CHIP, AckPerson, AckState, CATEGORY_ICON, ComplianceSummary, FREQUENCIES, Lookups, OBLIGATION_CATEGORIES, OBLIGATION_ICON,
  Obligation, ObligationCategory, ObligationDetail, ObligationFrequency, ObligationState, POLICY_CATEGORIES, POLICY_STATUSES, Policy,
  PolicyCategory, PolicyListItem, PolicyStatus, PolicyVersionContent, STATE_CHIP, STATUS_CHIP, TextBlock, isHttpLink, parseBody
} from './policies.models';

type Tab = 'policies' | 'acknowledgements' | 'statutory';
type Drawer = 'policy' | 'policyEdit' | 'tracking' | 'obligation' | 'obligationEdit';
type PolicyTask = 'publish' | 'delete' | 'archive';

const TABS: readonly Tab[] = ['policies', 'acknowledgements', 'statutory'];

interface PolicyForm {
  id: string | null;
  title: string;
  category: PolicyCategory;
  summary: string;
  body: string;
  documentUrl: string;
  departmentId: string;
  ownerEmployeeId: string;
  requiresAcknowledgement: boolean;
  acknowledgeWithinDays: number | null;
  reviewEveryMonths: number | null;
}

interface ObligationForm {
  id: string | null;
  title: string;
  authority: string;
  category: ObligationCategory;
  frequency: ObligationFrequency;
  description: string;
  linkUrl: string;
  ownerEmployeeId: string;
  remindDaysBefore: number;
  nextDueOn: string;
  isActive: boolean;
  completed: boolean;
}

interface FilingForm {
  filedOn: string;
  reference: string;
  evidenceUrl: string;
  notes: string;
}

@Component({
  selector: 'app-policies',
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './policies.html',
  styleUrl: './policies.css'
})
export class PoliciesComponent {
  private readonly api = inject(PoliciesService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly today = todayIso();
  readonly categories = POLICY_CATEGORIES;
  readonly statuses = POLICY_STATUSES;
  readonly obligationCategories = OBLIGATION_CATEGORIES;
  readonly frequencies = FREQUENCIES;
  readonly categoryIcon = CATEGORY_ICON;
  readonly obligationIcon = OBLIGATION_ICON;
  readonly statusChip = STATUS_CHIP;
  readonly ackChip = ACK_CHIP;
  readonly stateChip = STATE_CHIP;
  readonly ackStates: readonly AckState[] = ['Pending', 'Overdue', 'Done'];

  readonly tab = signal<Tab>('policies');
  readonly saving = signal(false);
  readonly summary = signal<ComplianceSummary | null>(null);
  readonly lookups = signal<Lookups>({ departments: [], people: [] });

  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  readonly canTrack = computed(() => this.summary()?.canTrack ?? false);
  readonly canViewStatutory = computed(() => this.summary()?.canViewStatutory ?? false);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);

  // ───── Policies list ─────
  readonly policies = signal<PolicyListItem[] | null>(null);
  readonly search = signal('');
  readonly category = signal<PolicyCategory | ''>('');
  readonly status = signal<PolicyStatus | ''>('');
  readonly mineOnly = signal(false);
  private readonly search$ = new Subject<void>();

  readonly shown = computed(() => (this.policies() ?? []).filter(p => !this.mineOnly() || this.isOpenAck(p.myAckState)));
  readonly myAcks = computed(() => (this.policies() ?? [])
    .filter(p => p.status === 'Published' && p.myAckState !== 'NotRequired')
    .sort((a, b) => this.ackOrder(a.myAckState) - this.ackOrder(b.myAckState) || a.title.localeCompare(b.title)));
  readonly tracked = computed(() => (this.policies() ?? []).filter(p => p.status === 'Published' && p.ackVersion !== null));
  readonly trackedPager = clientPager(this.tracked);
  readonly overdueTotal = computed(() => this.tracked().reduce((n, p) => n + (p.overdueCount ?? 0), 0));

  // ───── Statutory ─────
  readonly obligations = signal<Obligation[] | null>(null);
  readonly obligationFilter = signal<ObligationState | ''>('');
  readonly obligationRows = computed(() => (this.obligations() ?? []).filter(o => !this.obligationFilter() || o.state === this.obligationFilter()));
  readonly obligationsPager = clientPager(this.obligationRows);

  /** Tally/chip se state filter; dobara click = filter hatao. Page 1 se. */
  setObligationFilter(v: ObligationState | ''): void {
    this.obligationFilter.set(v);
    this.obligationsPager.reset();
  }
  readonly upcomingCount = computed(() => (this.obligations() ?? []).filter(o => o.state === 'Upcoming').length);

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly policy = signal<Policy | null>(null);
  readonly viewing = signal<PolicyVersionContent | null>(null);
  readonly people = signal<AckPerson[] | null>(null);
  readonly peopleState = signal<AckState | ''>('');
  readonly peopleDept = signal('');
  readonly peopleSearch = signal('');
  private readonly people$ = new Subject<void>();
  readonly obligation = signal<ObligationDetail | null>(null);

  policyForm: PolicyForm | null = null;
  obligationForm: ObligationForm | null = null;
  filingForm: FilingForm | null = null;
  task: PolicyTask | null = null;
  publishSummary = '';
  publishReack = true;
  publishEffective = '';
  ackChecked = false;
  confirm: string | null = null;

  /** Reader drawer: purana version, warna current; manager ke draft par working copy. */
  readonly reading = computed<{ body: TextBlock[]; documentUrl: string | null; draft: boolean } | null>(() => {
    const p = this.policy();
    if (!p) return null;
    const v = this.viewing() ?? p.current;
    if (v) return { body: parseBody(v.body), documentUrl: v.documentUrl, draft: false };
    return { body: parseBody(p.workingBody), documentUrl: p.workingDocumentUrl, draft: true };
  });

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadPolicies());
    this.people$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadPeople());

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const policyId = route.get('policy');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        if (s.canManage || s.canTrack) this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
        this.loadPolicies();
        let start: Tab = 'policies';
        if (wanted && TABS.includes(wanted) && this.tabAllowed(wanted)) start = wanted;
        this.setTab(start);
        if (policyId) this.openPolicy(policyId);
      },
      error: e => this.fail(e, 'policies.errors.load')
    });
  }

  tabAllowed(t: Tab): boolean {
    return t !== 'statutory' || this.canViewStatutory();
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'statutory' && this.obligations() === null) this.loadObligations();
  }

  // ───── Loading ─────
  loadPolicies(): void {
    this.api.policies(this.status(), this.category(), this.search())
      .subscribe({ next: l => this.policies.set(l), error: () => this.policies.set([]) });
  }

  loadObligations(): void {
    if (!this.canViewStatutory()) return;
    this.api.obligations().subscribe({ next: l => this.obligations.set(l), error: () => this.obligations.set([]) });
  }

  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    this.loadPolicies();
    if (this.obligations() !== null) this.loadObligations();
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.search$.next();
  }

  setCategory(v: PolicyCategory | ''): void {
    this.category.set(v);
    this.loadPolicies();
  }

  setStatus(v: PolicyStatus | ''): void {
    this.status.set(v);
    this.loadPolicies();
  }

  showMine(): void {
    this.tab.set('policies');
    this.mineOnly.set(true);
  }

  isOpenAck(s: AckState): boolean {
    return s === 'Pending' || s === 'Overdue';
  }

  private ackOrder(s: AckState): number {
    return { Overdue: 0, Pending: 1, Done: 2, NotRequired: 3 }[s];
  }

  percent(done: number | null, of: number | null): number {
    return of ? Math.round((100 * (done ?? 0)) / of) : 0;
  }

  // ───── Policy reader ─────
  openPolicy(id: string): void {
    this.policy.set(null);
    this.viewing.set(null);
    this.resetTask();
    this.drawer.set('policy');
    this.api.policy(id).subscribe({
      next: p => this.policy.set(p),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'policies.errors.load');
      }
    });
  }

  private reloadPolicy(): void {
    const p = this.policy();
    if (p) this.api.policy(p.policy.id).subscribe({ next: x => this.policy.set(x), error: () => undefined });
  }

  viewVersion(n: number): void {
    const p = this.policy();
    if (!p) return;
    if (n === p.policy.currentVersion) {
      this.viewing.set(null);
      return;
    }
    this.api.version(p.policy.id, n).subscribe({ next: v => this.viewing.set(v), error: e => this.fail(e, 'policies.errors.load') });
  }

  acknowledge(): void {
    const p = this.policy();
    if (!p || !this.ackChecked) return;
    this.submit(this.api.act(p.policy.id, 'acknowledge'), 'policies.msg.acknowledged', { title: p.policy.title });
  }

  private resetTask(): void {
    this.task = null;
    this.publishSummary = '';
    this.publishReack = true;
    this.publishEffective = '';
    this.ackChecked = false;
    this.confirm = null;
  }

  startTask(t: PolicyTask): void {
    this.resetTask();
    this.task = t;
    if (t === 'publish') this.publishEffective = this.today;
  }

  firstPublish(p: Policy): boolean {
    return p.policy.currentVersion === 0;
  }

  canRunPublish(p: Policy): boolean {
    return this.firstPublish(p) || !!this.publishSummary.trim();
  }

  runPublish(): void {
    const p = this.policy();
    if (!p || !this.canRunPublish(p)) return;
    const reack = p.policy.requiresAcknowledgement && !this.firstPublish(p) && this.publishReack;
    this.submit(
      this.api.publish(p.policy.id, this.publishSummary.trim() || null, reack, this.publishEffective || null),
      'policies.msg.published', { title: p.policy.title, n: p.policy.currentVersion + 1 });
  }

  policyAction(action: 'archive' | 'restore' | 'reviewed'): void {
    const p = this.policy();
    if (!p) return;
    this.submit(this.api.act(p.policy.id, action), `policies.msg.${action}`, { title: p.policy.title });
  }

  deletePolicy(): void {
    const p = this.policy();
    if (!p) return;
    this.saving.set(true);
    this.api.remove(p.policy.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('policies.msg.deleted', { title: p.policy.title }));
        this.closeDrawer();
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  private submit(call$: Observable<void>, key: string, params: Record<string, string | number>): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(key, params));
        this.resetTask();
        this.viewing.set(null);
        this.reloadPolicy();
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  // ───── New / edit policy ─────
  newPolicy(): void {
    this.policyForm = {
      id: null, title: '', category: 'General', summary: '', body: '', documentUrl: '', departmentId: '', ownerEmployeeId: '',
      requiresAcknowledgement: true, acknowledgeWithinDays: 14, reviewEveryMonths: 12
    };
    this.policy.set(null);
    this.drawer.set('policyEdit');
  }

  editPolicy(): void {
    const p = this.policy();
    if (!p) return;
    const x = p.policy;
    this.policyForm = {
      id: x.id, title: x.title, category: x.category, summary: x.summary ?? '', body: p.workingBody ?? '', documentUrl: p.workingDocumentUrl ?? '',
      departmentId: x.departmentId ?? '', ownerEmployeeId: x.ownerEmployeeId ?? '', requiresAcknowledgement: x.requiresAcknowledgement,
      acknowledgeWithinDays: x.acknowledgeWithinDays ?? 14, reviewEveryMonths: x.reviewEveryMonths
    };
    this.drawer.set('policyEdit');
  }

  linkOk(v: string): boolean {
    return isHttpLink(v);
  }

  canSavePolicy(): boolean {
    const f = this.policyForm;
    if (!f?.title.trim() || !isHttpLink(f.documentUrl)) return false;
    const days = f.acknowledgeWithinDays;
    const months = f.reviewEveryMonths;
    return (!f.requiresAcknowledgement || days === null || (days >= 1 && days <= 365)) && (months === null || (months >= 1 && months <= 60));
  }

  savePolicy(): void {
    const f = this.policyForm;
    if (!f || !this.canSavePolicy()) return;
    const body = {
      title: f.title.trim(), category: f.category, summary: f.summary.trim() || null, body: f.body.trim() || null,
      documentUrl: f.documentUrl.trim() || null, departmentId: f.departmentId || null, ownerEmployeeId: f.ownerEmployeeId || null,
      requiresAcknowledgement: f.requiresAcknowledgement, acknowledgeWithinDays: f.requiresAcknowledgement ? f.acknowledgeWithinDays || null : null,
      reviewEveryMonths: f.reviewEveryMonths || null
    };
    this.saving.set(true);
    const done = (id: string) => {
      this.saving.set(false);
      this.alert.success(this.translate.instant('policies.msg.saved', { title: body.title }));
      this.refresh();
      this.openPolicy(id);
    };
    if (f.id) {
      const id = f.id;
      this.api.update(id, body).subscribe({ next: () => done(id), error: e => this.fail(e) });
    } else {
      this.api.create(body).subscribe({ next: id => done(id), error: e => this.fail(e) });
    }
  }

  addStarter(): void {
    this.saving.set(true);
    this.api.addStarter().subscribe({
      next: n => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(n ? 'policies.msg.starterAdded' : 'policies.msg.starterNone', { n }));
        this.status.set('');
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Tracking ─────
  openTracking(id: string): void {
    const p = (this.policies() ?? []).find(x => x.id === id) ?? this.policy()?.policy ?? null;
    if (!p) return;
    this.peopleState.set('');
    this.peopleDept.set('');
    this.peopleSearch.set('');
    this.people.set(null);
    this.trackedPolicy.set(p);
    this.drawer.set('tracking');
    this.loadPeople();
  }

  readonly trackedPolicy = signal<PolicyListItem | null>(null);

  loadPeople(): void {
    const p = this.trackedPolicy();
    if (!p) return;
    this.api.acknowledgements(p.id, this.peopleState(), this.peopleDept(), this.peopleSearch())
      .subscribe({ next: l => this.people.set(l), error: () => this.people.set([]) });
  }

  setPeopleState(s: AckState | ''): void {
    this.peopleState.set(s);
    this.loadPeople();
  }

  setPeopleDept(d: string): void {
    this.peopleDept.set(d);
    this.loadPeople();
  }

  onPeopleSearch(v: string): void {
    this.peopleSearch.set(v);
    this.people$.next();
  }

  // ───── Obligations ─────
  openObligation(id: string): void {
    this.obligation.set(null);
    this.filingForm = null;
    this.confirm = null;
    this.drawer.set('obligation');
    this.api.obligation(id).subscribe({
      next: o => this.obligation.set(o),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'policies.errors.load');
      }
    });
  }

  private reloadObligation(): void {
    const o = this.obligation();
    if (o) this.api.obligation(o.obligation.id).subscribe({ next: x => this.obligation.set(x), error: () => undefined });
  }

  startFiling(o: Obligation): void {
    if (this.drawer() !== 'obligation' || this.obligation()?.obligation.id !== o.id) this.openObligation(o.id);
    this.filingForm = { filedOn: this.today, reference: '', evidenceUrl: '', notes: '' };
  }

  canFile(o: Obligation): boolean {
    return this.canManage() && o.isActive && o.nextDueOn !== null;
  }

  canSaveFiling(): boolean {
    const f = this.filingForm;
    return !!f?.filedOn && f.filedOn <= this.today && isHttpLink(f.evidenceUrl);
  }

  saveFiling(): void {
    const o = this.obligation();
    const f = this.filingForm;
    if (!o || !f || !this.canSaveFiling()) return;
    const body = { filedOn: f.filedOn, reference: f.reference.trim() || null, evidenceUrl: f.evidenceUrl.trim() || null, notes: f.notes.trim() || null };
    this.obligationCall(this.api.recordFiling(o.obligation.id, body), 'policies.msg.filed', { title: o.obligation.title });
  }

  undoFiling(filingId: string): void {
    const o = this.obligation();
    if (!o) return;
    if (this.confirm !== `undo:${filingId}`) {
      this.confirm = `undo:${filingId}`;
      return;
    }
    this.obligationCall(this.api.undoFiling(o.obligation.id, filingId), 'policies.msg.undone', { title: o.obligation.title });
  }

  private obligationCall(call$: Observable<void>, key: string, params: Record<string, string>): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(key, params));
        this.filingForm = null;
        this.confirm = null;
        this.reloadObligation();
        this.refresh();
        this.loadObligations();
      },
      error: e => this.fail(e)
    });
  }

  newObligation(): void {
    this.obligationForm = {
      id: null, title: '', authority: '', category: 'Tax', frequency: 'Monthly', description: '', linkUrl: '', ownerEmployeeId: '',
      remindDaysBefore: 7, nextDueOn: '', isActive: true, completed: false
    };
    this.obligation.set(null);
    this.confirm = null;
    this.drawer.set('obligationEdit');
  }

  editObligation(): void {
    const d = this.obligation();
    if (!d) return;
    const o = d.obligation;
    this.obligationForm = {
      id: o.id, title: o.title, authority: o.authority ?? '', category: o.category, frequency: o.frequency, description: o.description ?? '',
      linkUrl: o.linkUrl ?? '', ownerEmployeeId: o.ownerEmployeeId ?? '', remindDaysBefore: o.remindDaysBefore, nextDueOn: o.nextDueOn ?? '',
      isActive: o.isActive, completed: o.nextDueOn === null
    };
    this.confirm = null;
    this.drawer.set('obligationEdit');
  }

  canSaveObligation(): boolean {
    const f = this.obligationForm;
    return !!f?.title.trim() && (f.completed || !!f.nextDueOn) && isHttpLink(f.linkUrl) && f.remindDaysBefore >= 0 && f.remindDaysBefore <= 90;
  }

  saveObligation(): void {
    const f = this.obligationForm;
    if (!f || !this.canSaveObligation()) return;
    const body = {
      title: f.title.trim(), authority: f.authority.trim() || null, category: f.category, frequency: f.frequency,
      description: f.description.trim() || null, linkUrl: f.linkUrl.trim() || null, ownerEmployeeId: f.ownerEmployeeId || null,
      remindDaysBefore: f.remindDaysBefore, nextDueOn: f.nextDueOn || null, isActive: f.isActive
    };
    this.saving.set(true);
    const done = (id: string) => {
      this.saving.set(false);
      this.alert.success(this.translate.instant('policies.msg.obligationSaved', { title: body.title }));
      this.refresh();
      this.loadObligations();
      this.openObligation(id);
    };
    if (f.id) {
      const id = f.id;
      this.api.updateObligation(id, body).subscribe({ next: () => done(id), error: e => this.fail(e) });
    } else {
      this.api.createObligation(body).subscribe({ next: id => done(id), error: e => this.fail(e) });
    }
  }

  deleteObligation(): void {
    const d = this.obligation();
    if (!d) return;
    if (this.confirm !== 'delete') {
      this.confirm = 'delete';
      return;
    }
    this.saving.set(true);
    this.api.deleteObligation(d.obligation.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('policies.msg.obligationDeleted', { title: d.obligation.title }));
        this.closeDrawer();
        this.refresh();
        this.loadObligations();
      },
      error: e => this.fail(e)
    });
  }

  /** "Due in 5 days" / "3 days late" / "Due today". */
  dueKey(days: number | null): { key: string; n: number } | null {
    if (days === null) return null;
    if (days === 0) return { key: 'policies.dueToday', n: 0 };
    return days > 0 ? { key: 'policies.dueInDays', n: days } : { key: 'policies.daysLate', n: -days };
  }

  // ───── Helpers ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.policy.set(null);
    this.viewing.set(null);
    this.obligation.set(null);
    this.policyForm = null;
    this.obligationForm = null;
    this.filingForm = null;
    this.resetTask();
  }

  private fail(e: unknown, fallback = 'policies.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
