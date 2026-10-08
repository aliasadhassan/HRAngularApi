import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { AmountPipe } from '../../shared/pipes/amount.pipe';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { RewardsService } from './rewards.service';
import {
  BENEFIT_ICON, BENEFIT_TYPES, BONUS_CHIP, BONUS_STATUSES, BONUS_TYPES, BatchResult, BenefitPlan, BenefitType, Bonus, BonusBasis, BonusStatus,
  BonusType, ENROLMENT_CHIP, ENROLMENT_STATUSES, Enrolment, EnrolmentStatus, MyRewards, PayoutMethod, REVISION_CHIP, REVISION_REASONS,
  REVISION_STATUSES, Revision, RevisionReason, RevisionStatus, RewardsLookups, RewardsSummary, SalaryLine, employerCostFor,
  firstOfNextMonth, raised, round2, todayIso
} from './rewards.models';

type Tab = 'mine' | 'plans' | 'enrolments' | 'increments' | 'bonuses';
type Drawer = 'request' | 'plan' | 'enrol' | 'enrolment' | 'revision' | 'revisionEdit' | 'revBatch' | 'bonus' | 'bonusEdit' | 'bonusBatch';
type EnrolAction = 'approve' | 'reject' | 'end' | 'dependents';
type RowAction = 'reject' | 'cancel';

const TABS: readonly Tab[] = ['mine', 'plans', 'enrolments', 'increments', 'bonuses'];

interface PlanForm {
  id: string | null;
  name: string;
  benefitType: BenefitType;
  provider: string;
  description: string;
  currencyCode: string;
  employerMonthlyCost: number;
  employeeMonthlyCost: number;
  dependentMonthlyCost: number;
  maxDependents: number;
  deductionComponentId: string;
  openForRequests: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface RequestForm {
  planId: string;
  dependents: number;
  note: string;
}

interface EnrolForm {
  planId: string;
  employeeId: string;
  dependents: number;
  startDate: string;
  note: string;
}

interface RevisionForm {
  id: string | null;
  employeeId: string;
  reason: RevisionReason;
  proposedAmount: number | null;
  effectiveFrom: string;
  newTitle: string;
  justification: string;
}

interface RevBatchForm {
  percent: number | null;
  effectiveFrom: string;
  reason: RevisionReason;
  justification: string;
}

interface BonusForm {
  id: string | null;
  bonusType: BonusType;
  title: string;
  basis: BonusBasis;
  value: number | null;
  payComponentId: string;
  reason: string;
}

@Component({
  selector: 'app-rewards',
  imports: [AmountPipe, DatePipe, FormsModule, NgTemplateOutlet, TranslatePipe],
  templateUrl: './rewards.html',
  styleUrl: './rewards.css'
})
export class RewardsComponent {
  private readonly api = inject(RewardsService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly amountPipe = new AmountPipe();

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly benefitTypes = BENEFIT_TYPES;
  readonly benefitIcon = BENEFIT_ICON;
  readonly enrolmentStatuses = ENROLMENT_STATUSES;
  readonly revisionStatuses = REVISION_STATUSES;
  readonly revisionReasons = REVISION_REASONS;
  readonly bonusTypes = BONUS_TYPES;
  readonly bonusStatuses = BONUS_STATUSES;
  readonly enrolmentChip = ENROLMENT_CHIP;
  readonly revisionChip = REVISION_CHIP;
  readonly bonusChip = BONUS_CHIP;
  readonly today = todayIso();

  readonly tab = signal<Tab>('mine');
  readonly saving = signal(false);

  readonly summary = signal<RewardsSummary | null>(null);
  readonly lookups = signal<RewardsLookups>({ employees: [], departments: [], earningComponents: [], deductionComponents: [], baseCurrency: null });

  readonly canView = computed(() => this.summary()?.canView ?? false);
  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  readonly canApprove = computed(() => this.summary()?.canApprove ?? false);
  readonly canConfigure = computed(() => this.summary()?.canConfigure ?? false);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);
  readonly currency = computed(() => this.summary()?.currencyCode ?? this.lookups().baseCurrency ?? '');

  // ───── Lists ─────
  readonly my = signal<MyRewards | null>(null);
  readonly plans = signal<BenefitPlan[] | null>(null);
  readonly enrolments = signal<Enrolment[] | null>(null);
  readonly revisions = signal<Revision[] | null>(null);
  readonly salaries = signal<SalaryLine[] | null>(null);
  readonly bonuses = signal<Bonus[] | null>(null);

  readonly myActive = computed(() => (this.my()?.enrolments ?? []).filter(e => e.status === 'Active' || e.status === 'Requested'));
  readonly myPast = computed(() => (this.my()?.enrolments ?? []).filter(e => e.status !== 'Active' && e.status !== 'Requested'));
  readonly myOpenPlans = computed(() => {
    const live = new Set(this.myActive().map(e => e.benefitPlanId));
    return (this.my()?.plans ?? []).filter(p => p.openForRequests && !live.has(p.id));
  });
  readonly myMonthlyShare = computed(() => this.myActive().filter(e => e.status === 'Active').reduce((s, e) => s + e.employeeMonthlyCost, 0));
  readonly myEmployerShare = computed(() => this.myActive().filter(e => e.status === 'Active').reduce((s, e) => s + e.employerMonthlyCost, 0));
  /** Mera reward record: lagu increments + manzoor/ada bonus, naye pehle. */
  readonly myHistory = computed(() => {
    const m = this.my();
    if (!m) return [];
    const rows: { id: string; at: string; kind: 'revision' | 'bonus'; revision?: Revision; bonus?: Bonus }[] = [
      ...m.revisions.map(r => ({ id: r.id, at: r.effectiveFrom, kind: 'revision' as const, revision: r })),
      ...m.bonuses.map(b => ({ id: b.id, at: b.paidAt ?? b.decidedAt ?? b.createdAt, kind: 'bonus' as const, bonus: b }))
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  });

  readonly enrolStatus = signal<EnrolmentStatus | ''>('');
  readonly enrolPlan = signal('');
  readonly enrolSearch = signal('');
  readonly enrolRows = computed(() => {
    const q = this.enrolSearch().trim().toLowerCase();
    return (this.enrolments() ?? []).filter(e => !q || `${e.employeeName} ${e.employeeCode} ${e.planName}`.toLowerCase().includes(q));
  });

  readonly revView = signal<'proposals' | 'salaries'>('proposals');
  readonly revStatus = signal<RevisionStatus | ''>('Pending');
  readonly pickedRevisions = signal<ReadonlySet<string>>(new Set());
  readonly pendingRevisions = computed(() => (this.revisions() ?? []).filter(r => r.status === 'Pending'));

  readonly salarySearch = signal('');
  readonly salaryDept = signal('');
  readonly pickedPeople = signal<ReadonlySet<string>>(new Set());
  readonly salaryRows = computed(() => {
    const q = this.salarySearch().trim().toLowerCase();
    const dept = this.salaryDept();
    return (this.salaries() ?? []).filter(s =>
      (!dept || s.departmentId === dept)
      && (!q || `${s.employeeName} ${s.employeeCode} ${s.designationTitle ?? ''}`.toLowerCase().includes(q)));
  });
  /** Increment ke liye chunne layak: salary ho aur pehle se pending na ho. */
  readonly salaryPickable = computed(() => this.salaryRows().filter(s => s.currentAmount !== null && !s.hasPendingRevision));

  readonly bonusStatus = signal<BonusStatus | ''>('Pending');
  readonly bonusType = signal<BonusType | ''>('');
  readonly pickedBonuses = signal<ReadonlySet<string>>(new Set());
  readonly pendingBonuses = computed(() => (this.bonuses() ?? []).filter(b => b.status === 'Pending'));
  readonly bonusTotal = computed(() => (this.bonuses() ?? []).reduce((s, b) => s + b.amount, 0));

  // Bulk approve bar
  payout: PayoutMethod = 'Payroll';
  bulkNote = '';

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  planForm: PlanForm | null = null;
  requestForm: RequestForm | null = null;
  enrolForm: EnrolForm | null = null;
  revisionForm: RevisionForm | null = null;
  revBatchForm: RevBatchForm | null = null;
  bonusForm: BonusForm | null = null;
  readonly enrolment = signal<Enrolment | null>(null);
  readonly revision = signal<Revision | null>(null);
  readonly bonus = signal<Bonus | null>(null);
  enrolAction: EnrolAction | null = null;
  rowAction: RowAction | null = null;
  actionNote = '';
  actionDate = '';
  actionDependents = 0;
  confirm: string | null = null;
  pickerSearch = '';
  pickerDept = '';

  constructor() {
    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        if (s.canView || s.canConfigure) this.loadLookups();
        this.loadMine();
        let start: Tab = s.myEmployeeId || !s.canView ? 'mine' : 'enrolments';
        if (!s.myEmployeeId && !s.canView && s.canConfigure) start = 'plans';
        if (s.canApprove && s.pendingRevisions > 0) start = 'increments';
        else if (s.canApprove && s.pendingBonuses > 0) start = 'bonuses';
        else if (s.canManage && s.pendingEnrolments > 0) start = 'enrolments';
        if (wanted && TABS.includes(wanted) && this.tabAllowed(wanted)) start = wanted;
        this.setTab(start);
      },
      error: e => this.fail(e, 'rewards.errors.load')
    });
  }

  tabAllowed(t: Tab): boolean {
    switch (t) {
      case 'plans': return this.canView() || this.canConfigure();
      case 'enrolments':
      case 'increments':
      case 'bonuses': return this.canView();
      default: return true;
    }
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'plans' && this.plans() === null) this.loadPlans();
    if (t === 'enrolments' && this.enrolments() === null) {
      if (this.plans() === null) this.loadPlans();
      if ((this.summary()?.pendingEnrolments ?? 0) > 0) this.enrolStatus.set('Requested');
      this.loadEnrolments();
    }
    if (t === 'increments' && this.revisions() === null) {
      this.loadRevisions();
      if (this.salaries() === null) this.loadSalaries();
    }
    if (t === 'bonuses' && this.bonuses() === null) {
      this.loadBonuses();
      if (this.salaries() === null) this.loadSalaries();
    }
  }

  // ───── Loading ─────
  private loadLookups(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
  }

  loadMine(): void {
    this.api.me().subscribe({ next: m => this.my.set(m), error: () => this.my.set({ employeeId: null, currencyCode: null, plans: [], enrolments: [], bonuses: [], revisions: [] }) });
  }

  loadPlans(): void {
    this.api.plans().subscribe({ next: p => this.plans.set(p), error: () => this.plans.set([]) });
  }

  loadEnrolments(): void {
    this.api.enrolments(this.enrolStatus(), this.enrolPlan()).subscribe({ next: l => this.enrolments.set(l), error: () => this.enrolments.set([]) });
  }

  loadRevisions(): void {
    this.api.revisions(this.revStatus()).subscribe({
      next: l => {
        this.revisions.set(l);
        this.pickedRevisions.set(new Set([...this.pickedRevisions()].filter(id => l.some(r => r.id === id && r.status === 'Pending'))));
      },
      error: () => this.revisions.set([])
    });
  }

  loadSalaries(): void {
    this.api.salaries().subscribe({ next: l => this.salaries.set(l), error: () => this.salaries.set([]) });
  }

  loadBonuses(): void {
    this.api.bonuses(this.bonusStatus(), this.bonusType()).subscribe({
      next: l => {
        this.bonuses.set(l);
        this.pickedBonuses.set(new Set([...this.pickedBonuses()].filter(id => l.some(b => b.id === id && b.status === 'Pending'))));
      },
      error: () => this.bonuses.set([])
    });
  }

  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    this.loadMine();
    if (this.plans() !== null) this.loadPlans();
    if (this.enrolments() !== null) this.loadEnrolments();
    if (this.revisions() !== null) this.loadRevisions();
    if (this.salaries() !== null) this.loadSalaries();
    if (this.bonuses() !== null) this.loadBonuses();
  }

  setEnrolStatus(v: EnrolmentStatus | ''): void {
    this.enrolStatus.set(v);
    this.loadEnrolments();
  }

  setEnrolPlan(v: string): void {
    this.enrolPlan.set(v);
    this.loadEnrolments();
  }

  setRevStatus(v: RevisionStatus | ''): void {
    this.revStatus.set(v);
    this.loadRevisions();
  }

  setBonusStatus(v: BonusStatus | ''): void {
    this.bonusStatus.set(v);
    this.loadBonuses();
  }

  setBonusType(v: BonusType | ''): void {
    this.bonusType.set(v);
    this.loadBonuses();
  }

  /** Tally se list filter. */
  show(t: Tab, status: string): void {
    if (t === 'enrolments') this.enrolStatus.set(status as EnrolmentStatus | '');
    if (t === 'increments') {
      this.revStatus.set(status as RevisionStatus | '');
      this.revView.set('proposals');
    }
    if (t === 'bonuses') this.bonusStatus.set(status as BonusStatus | '');
    if (t === 'enrolments' && this.enrolments() !== null) this.loadEnrolments();
    if (t === 'increments' && this.revisions() !== null) this.loadRevisions();
    if (t === 'bonuses' && this.bonuses() !== null) this.loadBonuses();
    this.setTab(t);
  }

  // ───── Selection ─────
  toggle(set: 'revisions' | 'bonuses' | 'people', id: string): void {
    const sig = set === 'revisions' ? this.pickedRevisions : set === 'bonuses' ? this.pickedBonuses : this.pickedPeople;
    const next = new Set(sig());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    sig.set(next);
  }

  toggleAll(set: 'revisions' | 'bonuses' | 'people'): void {
    const ids = set === 'revisions' ? this.pendingRevisions().map(r => r.id)
      : set === 'bonuses' ? this.pendingBonuses().map(b => b.id)
        : this.drawer() === 'bonusBatch' ? this.pickerRows().map(s => s.employeeId) : this.salaryPickable().map(s => s.employeeId);
    const sig = set === 'revisions' ? this.pickedRevisions : set === 'bonuses' ? this.pickedBonuses : this.pickedPeople;
    const all = ids.length > 0 && ids.every(id => sig().has(id));
    const next = new Set(sig());
    for (const id of ids) {
      if (all) next.delete(id);
      else next.add(id);
    }
    sig.set(next);
  }

  allPicked(set: 'revisions' | 'bonuses' | 'people'): boolean {
    const ids = set === 'revisions' ? this.pendingRevisions().map(r => r.id)
      : set === 'bonuses' ? this.pendingBonuses().map(b => b.id)
        : this.drawer() === 'bonusBatch' ? this.pickerRows().map(s => s.employeeId) : this.salaryPickable().map(s => s.employeeId);
    const sig = set === 'revisions' ? this.pickedRevisions : set === 'bonuses' ? this.pickedBonuses : this.pickedPeople;
    return ids.length > 0 && ids.every(id => sig().has(id));
  }

  /** Bonus drawer ka people picker. */
  pickerRows(): SalaryLine[] {
    const q = this.pickerSearch.trim().toLowerCase();
    return (this.salaries() ?? []).filter(s =>
      (!this.pickerDept || s.departmentId === this.pickerDept)
      && (!q || `${s.employeeName} ${s.employeeCode} ${s.designationTitle ?? ''}`.toLowerCase().includes(q)));
  }

  // ───── My benefits ─────
  requestPlan(p: BenefitPlan): void {
    this.requestForm = { planId: p.id, dependents: 0, note: '' };
    this.drawer.set('request');
  }

  requestedPlan(): BenefitPlan | null {
    const id = this.requestForm?.planId;
    return id ? (this.my()?.plans ?? []).find(p => p.id === id) ?? null : null;
  }

  saveRequest(): void {
    const f = this.requestForm;
    const p = this.requestedPlan();
    if (!f || !p || f.dependents < 0 || f.dependents > p.maxDependents) return;
    this.run(this.api.requestEnrolment(f.planId, f.dependents, f.note.trim() || null), 'rewards.msg.requested', { plan: p.name }, true);
  }

  cancelRequest(e: Enrolment): void {
    if (this.confirm !== `cancel:${e.id}`) {
      this.confirm = `cancel:${e.id}`;
      return;
    }
    this.run(this.api.cancelEnrolmentRequest(e.id), 'rewards.msg.requestCancelled', { plan: e.planName });
  }

  // ───── Plans ─────
  newPlan(): void {
    const next = Math.max(0, ...(this.plans() ?? []).map(p => p.sortOrder)) + 10;
    this.planForm = {
      id: null, name: '', benefitType: 'Health', provider: '', description: '', currencyCode: this.currency(), employerMonthlyCost: 0,
      employeeMonthlyCost: 0, dependentMonthlyCost: 0, maxDependents: 0, deductionComponentId: '', openForRequests: true, isActive: true,
      sortOrder: Math.min(next, 999)
    };
    this.confirm = null;
    this.drawer.set('plan');
  }

  editPlan(p: BenefitPlan): void {
    this.planForm = {
      id: p.id, name: p.name, benefitType: p.benefitType, provider: p.provider ?? '', description: p.description ?? '', currencyCode: p.currencyCode,
      employerMonthlyCost: p.employerMonthlyCost, employeeMonthlyCost: p.employeeMonthlyCost, dependentMonthlyCost: p.dependentMonthlyCost,
      maxDependents: p.maxDependents, deductionComponentId: p.deductionComponentId ?? '', openForRequests: p.openForRequests, isActive: p.isActive,
      sortOrder: p.sortOrder
    };
    this.confirm = null;
    this.drawer.set('plan');
  }

  editingPlan(): BenefitPlan | null {
    const id = this.planForm?.id;
    return id ? (this.plans() ?? []).find(p => p.id === id) ?? null : null;
  }

  planErrors(): string[] {
    const f = this.planForm;
    if (!f) return [];
    const errs: string[] = [];
    const money = (n: number | null) => n !== null && n >= 0 && n <= 10_000_000;
    if (!money(f.employerMonthlyCost) || !money(f.employeeMonthlyCost) || !money(f.dependentMonthlyCost)) errs.push('rewards.err.cost');
    if (f.maxDependents === null || f.maxDependents < 0 || f.maxDependents > 10) errs.push('rewards.err.maxDependents');
    if (f.dependentMonthlyCost > 0 && f.maxDependents === 0) errs.push('rewards.err.dependentCost');
    if (f.deductionComponentId && !(f.employeeMonthlyCost > 0)) errs.push('rewards.err.deductionNeedsShare');
    if (f.currencyCode && !/^[A-Za-z]{3}$/.test(f.currencyCode.trim())) errs.push('rewards.err.currency');
    return errs;
  }

  canSavePlan(): boolean {
    const f = this.planForm;
    return !!f && !!f.name.trim() && f.sortOrder >= 0 && f.sortOrder <= 999 && this.planErrors().length === 0;
  }

  savePlan(): void {
    const f = this.planForm;
    if (!f || !this.canSavePlan()) return;
    const body = {
      name: f.name.trim(), benefitType: f.benefitType, provider: f.provider.trim() || null, description: f.description.trim() || null,
      currencyCode: f.currencyCode.trim().toUpperCase() || null, employerMonthlyCost: f.employerMonthlyCost || 0, employeeMonthlyCost: f.employeeMonthlyCost || 0,
      dependentMonthlyCost: f.dependentMonthlyCost || 0, maxDependents: f.maxDependents || 0, deductionComponentId: f.deductionComponentId || null,
      openForRequests: f.openForRequests, isActive: f.isActive, sortOrder: f.sortOrder
    };
    const call$: Observable<unknown> = f.id ? this.api.updatePlan(f.id, body) : this.api.createPlan(body);
    this.run(call$, 'rewards.msg.planSaved', { name: body.name }, true);
  }

  deletePlan(): void {
    const p = this.editingPlan();
    if (!p) return;
    if (this.confirm !== 'delete') {
      this.confirm = 'delete';
      return;
    }
    this.run(this.api.deletePlan(p.id), 'rewards.msg.planDeleted', { name: p.name }, true);
  }

  // ───── Enrolments ─────
  newEnrolment(planId = ''): void {
    this.enrolForm = { planId, employeeId: '', dependents: 0, startDate: firstOfNextMonth(), note: '' };
    this.drawer.set('enrol');
  }

  enrolPlanPicked(): BenefitPlan | null {
    const id = this.enrolForm?.planId;
    return id ? (this.plans() ?? []).find(p => p.id === id) ?? null : null;
  }

  activePlans(): BenefitPlan[] {
    return (this.plans() ?? []).filter(p => p.isActive);
  }

  canSaveEnrol(): boolean {
    const f = this.enrolForm;
    const p = this.enrolPlanPicked();
    return !!f && !!p && !!f.employeeId && !!f.startDate && f.dependents >= 0 && f.dependents <= p.maxDependents;
  }

  saveEnrol(): void {
    const f = this.enrolForm;
    const p = this.enrolPlanPicked();
    if (!f || !p || !this.canSaveEnrol()) return;
    const name = this.lookups().employees.find(e => e.id === f.employeeId)?.name ?? '';
    this.run(this.api.enrol({ planId: f.planId, employeeId: f.employeeId, dependents: f.dependents, startDate: f.startDate, note: f.note.trim() || null }),
      'rewards.msg.enrolled', { name, plan: p.name }, true);
  }

  openEnrolment(e: Enrolment): void {
    this.enrolment.set(e);
    this.resetActions();
    this.drawer.set('enrolment');
  }

  planOf(e: Enrolment): BenefitPlan | null {
    return (this.plans() ?? []).find(p => p.id === e.benefitPlanId) ?? null;
  }

  startEnrolAction(a: EnrolAction): void {
    const e = this.enrolment();
    if (!e) return;
    this.enrolAction = a;
    this.actionNote = '';
    this.actionDependents = e.dependents;
    this.actionDate = a === 'approve' ? (e.startDate ?? firstOfNextMonth()) : a === 'end' ? this.today : '';
  }

  canRunEnrolAction(): boolean {
    const e = this.enrolment();
    const a = this.enrolAction;
    if (!e || !a) return false;
    const max = this.planOf(e)?.maxDependents ?? 10;
    switch (a) {
      case 'approve': return !!this.actionDate && this.actionDependents >= 0 && this.actionDependents <= max;
      case 'reject': return !!this.actionNote.trim();
      case 'end': return !!this.actionDate && (!e.startDate || this.actionDate >= e.startDate);
      case 'dependents': return this.actionDependents >= 0 && this.actionDependents <= max && this.actionDependents !== e.dependents;
    }
  }

  runEnrolAction(): void {
    const e = this.enrolment();
    const a = this.enrolAction;
    if (!e || !a || !this.canRunEnrolAction()) return;
    const note = this.actionNote.trim() || null;
    const params = { name: e.employeeName, plan: e.planName };
    switch (a) {
      case 'approve': this.run(this.api.approveEnrolment(e.id, this.actionDate, this.actionDependents, note), 'rewards.msg.enrolApproved', params, true); break;
      case 'reject': this.run(this.api.rejectEnrolment(e.id, note ?? ''), 'rewards.msg.enrolRejected', params, true); break;
      case 'end': this.run(this.api.endEnrolment(e.id, this.actionDate, note), 'rewards.msg.enrolEnded', params, true); break;
      case 'dependents': this.run(this.api.changeDependents(e.id, this.actionDependents), 'rewards.msg.dependentsChanged', params, true); break;
    }
  }

  quickApproveEnrolment(e: Enrolment): void {
    this.run(this.api.approveEnrolment(e.id, e.startDate ?? firstOfNextMonth(), null, null), 'rewards.msg.enrolApproved', { name: e.employeeName, plan: e.planName });
  }

  // ───── Increments ─────
  newRevision(line?: SalaryLine): void {
    this.revisionForm = {
      id: null, employeeId: line?.employeeId ?? '', reason: 'Increment', proposedAmount: null, effectiveFrom: firstOfNextMonth(), newTitle: '', justification: ''
    };
    this.drawer.set('revisionEdit');
  }

  openRevision(r: Revision): void {
    this.revision.set(r);
    this.resetActions();
    this.drawer.set('revision');
  }

  editRevision(): void {
    const r = this.revision();
    if (!r) return;
    this.revisionForm = {
      id: r.id, employeeId: r.employeeId, reason: r.reason, proposedAmount: r.proposedAmount, effectiveFrom: r.effectiveFrom,
      newTitle: r.newTitle ?? '', justification: r.justification ?? ''
    };
    this.drawer.set('revisionEdit');
  }

  /** Form ke employee ki current salary (naye ke liye salary lines se, edit ke liye revision snapshot se). */
  revisionBase(): { amount: number; currency: string; basis: string; from: string | null; title: string | null } | null {
    const f = this.revisionForm;
    if (!f) return null;
    const r = this.revision();
    if (f.id && r) return { amount: r.currentAmount, currency: r.currencyCode, basis: r.salaryBasis, from: null, title: r.designationTitle };
    const s = (this.salaries() ?? []).find(x => x.employeeId === f.employeeId);
    return s && s.currentAmount !== null
      ? { amount: s.currentAmount, currency: s.currencyCode ?? '', basis: s.salaryBasis ?? 'Monthly', from: s.currentFrom, title: s.designationTitle }
      : null;
  }

  revisionPercent(): number | null {
    const b = this.revisionBase();
    const v = this.revisionForm?.proposedAmount;
    return b && v ? round2((v - b.amount) / b.amount * 100) : null;
  }

  applyPercent(pct: number): void {
    const b = this.revisionBase();
    if (!b || !this.revisionForm) return;
    this.revisionForm.proposedAmount = raised(b.amount, pct, b.basis as SalaryLine['salaryBasis']);
  }

  revisionErrors(): string[] {
    const f = this.revisionForm;
    const b = this.revisionBase();
    if (!f || !b) return [];
    const errs: string[] = [];
    if (f.proposedAmount !== null) {
      if (f.proposedAmount <= 0 || f.proposedAmount === b.amount) errs.push('rewards.err.sameAmount');
      else if (f.proposedAmount > b.amount * 5) errs.push('rewards.err.tooHigh');
    }
    if (f.effectiveFrom && b.from && f.effectiveFrom <= b.from) errs.push('rewards.err.effectiveBefore');
    return errs;
  }

  canSaveRevision(): boolean {
    const f = this.revisionForm;
    return !!f && !!f.employeeId && !!this.revisionBase() && !!f.proposedAmount && !!f.effectiveFrom && this.revisionErrors().length === 0;
  }

  saveRevision(): void {
    const f = this.revisionForm;
    if (!f || !f.proposedAmount || !this.canSaveRevision()) return;
    const body = {
      reason: f.reason, proposedAmount: f.proposedAmount, effectiveFrom: f.effectiveFrom, newTitle: f.newTitle.trim() || null,
      justification: f.justification.trim() || null
    };
    const name = this.employeeName(f.employeeId);
    const call$: Observable<unknown> = f.id ? this.api.updateRevision(f.id, body) : this.api.proposeRevision({ ...body, employeeId: f.employeeId });
    this.run(call$, f.id ? 'rewards.msg.revisionSaved' : 'rewards.msg.revisionProposed', { name }, true);
  }

  newRevBatch(): void {
    this.revBatchForm = { percent: null, effectiveFrom: firstOfNextMonth(), reason: 'Increment', justification: '' };
    this.drawer.set('revBatch');
  }

  /** Batch preview: chune hue logon ki salary + naya amount. */
  revBatchRows(): (SalaryLine & { proposed: number | null })[] {
    const pct = this.revBatchForm?.percent ?? null;
    const picked = this.pickedPeople();
    return (this.salaries() ?? []).filter(s => picked.has(s.employeeId))
      .map(s => ({ ...s, proposed: pct !== null && s.currentAmount !== null ? raised(s.currentAmount, pct, s.salaryBasis) : null }));
  }

  canSaveRevBatch(): boolean {
    const f = this.revBatchForm;
    return !!f && f.percent !== null && f.percent !== 0 && f.percent > -50 && f.percent <= 100 && !!f.effectiveFrom && this.pickedPeople().size > 0;
  }

  saveRevBatch(): void {
    const f = this.revBatchForm;
    if (!f || f.percent === null || !this.canSaveRevBatch()) return;
    this.batch(this.api.proposeRevisions({
      employeeIds: [...this.pickedPeople()], percent: f.percent, effectiveFrom: f.effectiveFrom, reason: f.reason, justification: f.justification.trim() || null
    }), 'rewards.msg.revisionsProposed', () => {
      this.pickedPeople.set(new Set());
      this.revView.set('proposals');
      this.revStatus.set('Pending');
    });
  }

  approvePickedRevisions(): void {
    this.approveRevisions([...this.pickedRevisions()]);
  }

  approveRevisions(ids: string[]): void {
    if (!ids.length) return;
    this.batch(this.api.approveRevisions(ids, this.bulkNote.trim() || null), 'rewards.msg.revisionsApproved', () => {
      this.pickedRevisions.set(new Set());
      this.bulkNote = '';
    });
  }

  // ───── Bonuses ─────
  newBonusBatch(): void {
    this.bonusForm = { id: null, bonusType: 'Performance', title: '', basis: 'Fixed', value: null, payComponentId: this.lookups().earningComponents[0]?.id ?? '', reason: '' };
    this.pickedPeople.set(new Set());
    this.pickerSearch = '';
    this.pickerDept = '';
    if (this.salaries() === null) this.loadSalaries();
    this.drawer.set('bonusBatch');
  }

  openBonus(b: Bonus): void {
    this.bonus.set(b);
    this.resetActions();
    this.drawer.set('bonus');
  }

  editBonus(): void {
    const b = this.bonus();
    if (!b) return;
    this.bonusForm = { id: b.id, bonusType: b.bonusType, title: b.title, basis: 'Fixed', value: b.amount, payComponentId: b.payComponentId, reason: b.reason ?? '' };
    this.drawer.set('bonusEdit');
  }

  /** % basis: aaj ki monthly salary ka hissa (server jaisa). */
  bonusFor(s: SalaryLine): number | null {
    const f = this.bonusForm;
    if (!f || f.value === null) return null;
    if (f.basis === 'Fixed') return round2(f.value);
    return s.monthlyEquivalent !== null ? round2(s.monthlyEquivalent * f.value / 100) : null;
  }

  bonusBatchTotal(): number {
    const picked = this.pickedPeople();
    return (this.salaries() ?? []).filter(s => picked.has(s.employeeId)).reduce((t, s) => t + (this.bonusFor(s) ?? 0), 0);
  }

  canSaveBonus(): boolean {
    const f = this.bonusForm;
    if (!f || !f.title.trim() || !f.payComponentId || f.value === null || f.value <= 0) return false;
    if (f.basis === 'PercentOfMonthlySalary' && f.value > 1000) return false;
    return f.id ? true : this.pickedPeople().size > 0;
  }

  saveBonus(): void {
    const f = this.bonusForm;
    if (!f || f.value === null || !this.canSaveBonus()) return;
    if (f.id) {
      const body = { bonusType: f.bonusType, title: f.title.trim(), amount: round2(f.value), payComponentId: f.payComponentId, reason: f.reason.trim() || null };
      this.run(this.api.updateBonus(f.id, body), 'rewards.msg.bonusSaved', { name: this.bonus()?.employeeName ?? '' }, true);
      return;
    }
    this.batch(this.api.proposeBonuses({
      employeeIds: [...this.pickedPeople()], bonusType: f.bonusType, title: f.title.trim(), basis: f.basis, value: f.value,
      payComponentId: f.payComponentId, reason: f.reason.trim() || null
    }), 'rewards.msg.bonusesProposed', () => {
      this.pickedPeople.set(new Set());
      this.bonusStatus.set('Pending');
    });
  }

  approvePickedBonuses(): void {
    this.approveBonuses([...this.pickedBonuses()]);
  }

  approveBonuses(ids: string[]): void {
    if (!ids.length) return;
    this.batch(this.api.approveBonuses(ids, this.payout, this.bulkNote.trim() || null),
      this.payout === 'Payroll' ? 'rewards.msg.bonusesApprovedPayroll' : 'rewards.msg.bonusesApprovedDirect', () => {
        this.pickedBonuses.set(new Set());
        this.bulkNote = '';
      });
  }

  markPaid(): void {
    const b = this.bonus();
    if (!b) return;
    this.run(this.api.markBonusPaid(b.id), 'rewards.msg.bonusPaid', { name: b.employeeName }, true);
  }

  // ───── Reject / cancel (revision + bonus drawers) ─────
  startRowAction(a: RowAction): void {
    this.rowAction = a;
    this.actionNote = '';
  }

  runRowAction(): void {
    const a = this.rowAction;
    if (!a) return;
    const note = this.actionNote.trim();
    if (a === 'reject' && !note) return;
    const r = this.drawer() === 'revision' ? this.revision() : null;
    const b = this.drawer() === 'bonus' ? this.bonus() : null;
    if (r) {
      const call$ = a === 'reject' ? this.api.rejectRevision(r.id, note) : this.api.cancelRevision(r.id);
      this.run(call$, a === 'reject' ? 'rewards.msg.revisionRejected' : 'rewards.msg.revisionCancelled', { name: r.employeeName }, true);
    } else if (b) {
      const call$ = a === 'reject' ? this.api.rejectBonus(b.id, note) : this.api.cancelBonus(b.id);
      this.run(call$, a === 'reject' ? 'rewards.msg.bonusRejected' : 'rewards.msg.bonusCancelled', { name: b.employeeName }, true);
    }
  }

  approveOne(): void {
    const r = this.drawer() === 'revision' ? this.revision() : null;
    const b = this.drawer() === 'bonus' ? this.bonus() : null;
    if (r) this.approveRevisions([r.id]);
    if (b) this.approveBonuses([b.id]);
  }

  // ───── Helpers ─────
  private resetActions(): void {
    this.enrolAction = null;
    this.rowAction = null;
    this.actionNote = '';
    this.confirm = null;
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.planForm = null;
    this.requestForm = null;
    this.enrolForm = null;
    this.revisionForm = null;
    this.revBatchForm = null;
    this.bonusForm = null;
    this.enrolment.set(null);
    this.revision.set(null);
    this.bonus.set(null);
    this.resetActions();
  }

  employeeName(id: string): string {
    return this.lookups().employees.find(e => e.id === id)?.name ?? (this.salaries() ?? []).find(s => s.employeeId === id)?.employeeName ?? '';
  }

  /** "PKR 12,500" — kasr ho to do decimal. */
  money(v: number | null | undefined, cur: string | null | undefined): string {
    if (v === null || v === undefined) return '—';
    const text = this.amountPipe.transform(v, this.lang(), 'full', Math.abs(v % 1) > 0.001 ? 2 : 0);
    return cur ? `${cur} ${text}` : text;
  }

  pct(v: number | null | undefined): string {
    if (v === null || v === undefined) return '—';
    return `${v > 0 ? '+' : ''}${new Intl.NumberFormat(`${this.lang()}-u-nu-latn`, { maximumFractionDigits: 1 }).format(v)}%`;
  }

  /** Mahine ka plan kharcha: employee ka hissa + employer ka (dependents ke saath). */
  planCost(p: BenefitPlan, dependents: number): { employer: number; employee: number } {
    return { employer: employerCostFor(p, dependents), employee: p.employeeMonthlyCost };
  }

  dependentOptions(max: number): number[] {
    return Array.from({ length: max + 1 }, (_, i) => i);
  }

  enrolChip(e: Enrolment): string {
    return ENROLMENT_CHIP[e.status];
  }

  private run(call$: Observable<unknown>, key: string, params: Record<string, string>, close = false): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(key, params));
        if (close) this.closeDrawer();
        this.confirm = null;
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  private batch(call$: Observable<BatchResult>, key: string, after: () => void): void {
    this.saving.set(true);
    call$.subscribe({
      next: r => {
        this.saving.set(false);
        if (r.created) this.alert.success(this.translate.instant(key, { n: r.created }));
        if (r.skipped.length)
          this.alert.warning(this.translate.instant('rewards.msg.skipped', { n: r.skipped.length, list: r.skipped.slice(0, 5).join(' · ') }), false);
        after();
        this.closeDrawer();
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  private fail(e: unknown, fallback = 'rewards.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
