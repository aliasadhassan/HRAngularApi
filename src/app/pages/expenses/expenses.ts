import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { AmountPipe } from '../../shared/pipes/amount.pipe';
import { PayrollService } from '../payroll/payroll.service';
import { PayComponent } from '../payroll/payroll.models';
import { ExpensesService } from './expenses.service';
import {
  ADVANCE_CHIP, CLAIM_CHIP, ClaimStatus, ExpenseCategory, ExpenseClaim, ExpensePolicy, LineForm, MyExpenses,
  PayoutMethod, TRAVEL_CHIP, TRAVEL_MODES, TravelMode, TravelRequest, TravelStatus
} from './expenses.models';

type Tab = 'mine' | 'claims' | 'travel' | 'advances' | 'policies';
type Drawer = 'claim' | 'trip' | 'approveClaim' | 'approveTrip' | 'viewClaim' | 'category';

const TABS: readonly Tab[] = ['mine', 'claims', 'travel', 'advances', 'policies'];

/** Aaj ki local date "2026-10-07" (DateOnly) */
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyLine = (categoryId = ''): LineForm => ({
  categoryId, expenseDate: today(), description: '', merchant: '', amount: null, receiptNumber: '', hasReceipt: false
});

@Component({
  selector: 'app-expenses',
  imports: [DatePipe, FormsModule, TranslatePipe, AmountPipe],
  templateUrl: './expenses.html',
  styleUrl: './expenses.css'
})
export class ExpensesComponent {
  private readonly api = inject(ExpensesService);
  private readonly payroll = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  readonly claimChip = CLAIM_CHIP;
  readonly travelChip = TRAVEL_CHIP;
  readonly advanceChip = ADVANCE_CHIP;
  readonly modes = TRAVEL_MODES;
  readonly today = today();
  readonly canSeeAll = this.perms.hasAny([P.payrollViewAll, P.payrollApprove]);
  readonly canApprove = this.perms.hasAny(P.payrollApprove);
  readonly canEditPolicy = this.perms.hasAny(P.settingsManage);

  readonly tab = signal<Tab>('mine');
  readonly my = signal<MyExpenses | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  readonly claims = signal<ExpenseClaim[]>([]);
  readonly claimStatus = signal<ClaimStatus | ''>('Submitted');
  readonly pendingClaims = signal(0);

  readonly trips = signal<TravelRequest[]>([]);
  readonly tripStatus = signal<TravelStatus | ''>('Pending');
  readonly pendingTrips = signal(0);

  readonly advances = signal<TravelRequest[]>([]);

  readonly policy = signal<ExpensePolicy | null>(null);
  readonly categories = signal<ExpenseCategory[]>([]);
  readonly earningComponents = signal<PayComponent[]>([]);
  readonly deductionComponents = signal<PayComponent[]>([]);

  // ───── Mine: summary ─────
  readonly myClaims = computed(() => this.my()?.claims ?? []);
  readonly myTrips = computed(() => this.my()?.travel ?? []);
  readonly awaiting = computed(() => this.sum(this.myClaims().filter(c => c.status === 'Submitted'), c => c.totalAmount));
  readonly toBePaid = computed(() => this.sum(this.myClaims().filter(c => c.status === 'Approved'), c => c.netPayable));
  readonly paidThisYear = computed(() => {
    const y = new Date().getFullYear();
    return this.sum(this.myClaims().filter(c => c.status === 'Paid' && (c.paidAt ?? c.decidedAt ?? '').startsWith(String(y))), c => c.netPayable);
  });
  readonly advanceOut = computed(() => this.sum(this.myTrips().filter(t => t.advanceStatus === 'Paid'), t => t.advanceApproved));
  readonly claimableTrips = computed(() => this.myTrips().filter(t => t.canClaim));

  // ───── Drawer state ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly saving = signal(false);
  claimForm = { title: '', travelRequestId: null as string | null, lines: [emptyLine()] };
  tripForm = { purpose: '', destination: '', departDate: today(), returnDate: today(), travelMode: 'Air' as TravelMode, estimatedCost: null as number | null, advanceRequested: 0 };
  claimTarget: ExpenseClaim | null = null;
  approveClaimForm = { approvedAmount: null as number | null, payout: 'Payroll' as PayoutMethod, comment: '' };
  tripTarget: TravelRequest | null = null;
  approveTripForm = { advanceApproved: 0, comment: '' };
  categoryForm: (Omit<ExpenseCategory, 'id'> & { id: string | null }) | null = null;
  policyForm: ExpensePolicy | null = null;

  rejectingId: string | null = null;
  rejectComment = '';
  confirmId: string | null = null;

  constructor() {
    this.loadMine();
    if (this.canSeeAll) this.loadPendingCounts();

    // Dashboard se ?tab=claims
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && TABS.includes(tab)) this.setTab(tab);
  }

  // ───── Loading ─────
  loadMine(): void {
    this.api.me().subscribe({
      next: m => {
        this.my.set(m);
        this.loadError.set(null);
        // HR jo khud employee nahi, seedha kaam ke tab pe
        if (!m.employeeId && this.canSeeAll && this.tab() === 'mine') this.setTab('claims');
      },
      error: e => this.loadError.set(PayrollService.errorMessage(e, this.translate.instant('expenses.errors.load')))
    });
  }

  private loadPendingCounts(): void {
    this.api.claims('Submitted').subscribe({ next: r => this.pendingClaims.set(r.length), error: () => this.pendingClaims.set(0) });
    this.api.travel('Pending').subscribe({ next: r => this.pendingTrips.set(r.length), error: () => this.pendingTrips.set(0) });
  }

  loadClaims(): void {
    this.api.claims(this.claimStatus()).subscribe({
      next: r => {
        this.claims.set(r);
        if (this.claimStatus() === 'Submitted') this.pendingClaims.set(r.length);
      },
      error: e => this.fail(e, 'expenses.errors.load')
    });
  }

  loadTrips(): void {
    this.api.travel(this.tripStatus()).subscribe({
      next: r => {
        this.trips.set(r);
        if (this.tripStatus() === 'Pending') this.pendingTrips.set(r.length);
      },
      error: e => this.fail(e, 'expenses.errors.load')
    });
  }

  loadAdvances(): void {
    this.api.travel('', true).subscribe({ next: r => this.advances.set(r), error: e => this.fail(e, 'expenses.errors.load') });
  }

  loadPolicies(): void {
    this.api.policy().subscribe({ next: p => this.policy.set(p), error: e => this.fail(e, 'expenses.errors.load') });
    this.api.categories().subscribe({ next: c => this.categories.set(c), error: e => this.fail(e, 'expenses.errors.load') });
    if (!this.earningComponents().length) {
      this.payroll.getComponents(false).subscribe({
        next: c => {
          this.earningComponents.set(c.filter(x => x.componentType === 'Earning'));
          this.deductionComponents.set(c.filter(x => x.componentType === 'Deduction'));
        },
        error: () => undefined
      });
    }
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.rejectingId = null;
    this.confirmId = null;
    if (t === 'claims') this.loadClaims();
    if (t === 'travel') this.loadTrips();
    if (t === 'advances') this.loadAdvances();
    if (t === 'policies') this.loadPolicies();
  }

  componentName(id: string | null, list: PayComponent[]): string | null {
    return id ? (list.find(c => c.id === id)?.name ?? null) : null;
  }

  // ───── Employee: claim ─────
  openClaim(trip?: TravelRequest): void {
    const first = this.my()?.categories[0]?.id ?? '';
    this.claimForm = {
      title: trip ? this.translate.instant('expenses.tripClaimTitle', { place: trip.destination }) : '',
      travelRequestId: trip?.id ?? null,
      lines: [emptyLine(first)]
    };
    this.drawer.set('claim');
  }

  addLine(): void {
    const last = this.claimForm.lines[this.claimForm.lines.length - 1];
    this.claimForm.lines = [...this.claimForm.lines, emptyLine(last?.categoryId ?? '')];
  }

  removeLine(i: number): void {
    this.claimForm.lines = this.claimForm.lines.filter((_, idx) => idx !== i);
  }

  claimTotal(): number {
    return this.claimForm.lines.reduce((s, l) => s + (l.amount && l.amount > 0 ? l.amount : 0), 0);
  }

  /** Line ke liye receipt zaroori? (policy + qism) */
  needsReceipt(l: LineForm): boolean {
    const m = this.my();
    if (!m || !l.amount) return false;
    const cat = m.categories.find(c => c.id === l.categoryId);
    const above = m.policy.receiptRequiredAbove;
    return !!cat?.receiptRequired || (above !== null && l.amount > above);
  }

  oldestDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - (this.my()?.policy.submitWithinDays ?? 90));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  lineProblem(l: LineForm): string | null {
    if (!l.amount || !l.description.trim()) return null;
    if (l.expenseDate > this.today) return 'expenses.problem.future';
    if (l.expenseDate < this.oldestDate()) return 'expenses.problem.tooOld';
    if (this.needsReceipt(l) && !l.hasReceipt && !l.receiptNumber.trim()) return 'expenses.problem.receipt';
    return null;
  }

  canSendClaim(): boolean {
    const f = this.claimForm;
    return !!f.title.trim() && f.lines.length > 0
      && f.lines.every(l => l.categoryId && l.expenseDate && l.description.trim() && l.amount && l.amount > 0 && !this.lineProblem(l));
  }

  sendClaim(): void {
    const f = this.claimForm;
    this.saving.set(true);
    this.api.submitClaim({
      title: f.title.trim(),
      travelRequestId: f.travelRequestId,
      lines: f.lines.map(l => ({
        categoryId: l.categoryId,
        expenseDate: l.expenseDate,
        description: l.description.trim(),
        merchant: l.merchant.trim() || null,
        amount: l.amount!,
        receiptNumber: l.receiptNumber.trim() || null,
        hasReceipt: l.hasReceipt
      }))
    }).subscribe({
      next: () => this.done('expenses.msg.claimSent', () => this.afterMine()),
      error: e => this.fail(e)
    });
  }

  cancelClaim(c: ExpenseClaim): void {
    this.run(c.id, this.api.cancelClaim(c.id), 'expenses.msg.claimCancelled', () => this.afterMine());
  }

  // ───── Employee: trip ─────
  openTrip(): void {
    this.tripForm = { purpose: '', destination: '', departDate: today(), returnDate: today(), travelMode: 'Air', estimatedCost: null, advanceRequested: 0 };
    this.drawer.set('trip');
  }

  maxAdvance(): number | null {
    const p = this.my()?.policy;
    const est = this.tripForm.estimatedCost;
    if (!p?.advancesEnabled || !est || est <= 0) return null;
    return Math.round(est * p.maxAdvancePercent) / 100;
  }

  tripProblem(): string | null {
    const f = this.tripForm;
    if (f.returnDate && f.departDate && f.returnDate < f.departDate) return 'expenses.problem.dates';
    const max = this.maxAdvance();
    if (f.advanceRequested > 0 && max !== null && f.advanceRequested > max) return 'expenses.problem.advance';
    return null;
  }

  canSendTrip(): boolean {
    const f = this.tripForm;
    return !!(f.purpose.trim() && f.destination.trim() && f.departDate && f.returnDate && f.estimatedCost && f.estimatedCost > 0
      && f.advanceRequested >= 0 && !this.tripProblem());
  }

  sendTrip(): void {
    const f = this.tripForm;
    this.saving.set(true);
    this.api.submitTravel({
      purpose: f.purpose.trim(), destination: f.destination.trim(), departDate: f.departDate, returnDate: f.returnDate,
      travelMode: f.travelMode, estimatedCost: f.estimatedCost!, advanceRequested: f.advanceRequested || 0
    }).subscribe({
      next: () => this.done('expenses.msg.tripSent', () => this.afterMine()),
      error: e => this.fail(e)
    });
  }

  cancelTrip(t: TravelRequest): void {
    this.run(t.id, this.api.cancelTravel(t.id), 'expenses.msg.tripCancelled', () => this.afterMine());
  }

  // ───── HR: claims ─────
  viewClaim(c: ExpenseClaim): void {
    this.claimTarget = c;
    this.drawer.set('viewClaim');
  }

  openApproveClaim(c: ExpenseClaim): void {
    this.claimTarget = c;
    const hasComponent = !!this.my()?.policy.reimbursementComponentId;
    this.approveClaimForm = { approvedAmount: c.totalAmount, payout: hasComponent ? 'Payroll' : 'Direct', comment: '' };
    if (c.travelRequestId) this.loadAdvances();   // advance preview ke liye
    this.drawer.set('approveClaim');
  }

  /** Approve drawer mein: linked trip ka advance kitna katega (preview) */
  advanceFor(c: ExpenseClaim): number {
    const trip = [...this.trips(), ...this.advances()].find(t => t.id === c.travelRequestId);
    return trip?.advanceStatus === 'Paid' ? trip.advanceApproved : 0;
  }

  confirmApproveClaim(): void {
    const c = this.claimTarget;
    if (!c) return;
    const f = this.approveClaimForm;
    this.saving.set(true);
    this.api.approveClaim(c.id, { approvedAmount: f.approvedAmount, payout: f.payout, comment: f.comment.trim() || null }).subscribe({
      next: () => this.done('expenses.msg.claimApproved', () => this.afterDecision(), { name: c.employeeName }),
      error: e => this.fail(e)
    });
  }

  startReject(id: string): void {
    this.rejectingId = id;
    this.rejectComment = '';
  }

  rejectClaim(c: ExpenseClaim): void {
    const comment = this.rejectComment.trim();
    if (!comment) return;
    this.run(c.id, this.api.rejectClaim(c.id, comment), 'expenses.msg.claimRejected', () => this.afterDecision(), { name: c.employeeName });
  }

  markPaid(c: ExpenseClaim): void {
    if (this.confirmId !== c.id) {
      this.confirmId = c.id;
      return;
    }
    this.run(c.id, this.api.markPaid(c.id), 'expenses.msg.markedPaid', () => this.loadClaims(), { name: c.employeeName });
  }

  // ───── HR: trips + advances ─────
  openApproveTrip(t: TravelRequest): void {
    this.tripTarget = t;
    this.approveTripForm = { advanceApproved: t.advanceRequested, comment: '' };
    this.drawer.set('approveTrip');
  }

  confirmApproveTrip(): void {
    const t = this.tripTarget;
    if (!t) return;
    const f = this.approveTripForm;
    this.saving.set(true);
    this.api.approveTravel(t.id, { advanceApproved: f.advanceApproved ?? 0, comment: f.comment.trim() || null }).subscribe({
      next: () => this.done('expenses.msg.tripApproved', () => this.afterDecision(), { name: t.employeeName }),
      error: e => this.fail(e)
    });
  }

  rejectTrip(t: TravelRequest): void {
    const comment = this.rejectComment.trim();
    if (!comment) return;
    this.run(t.id, this.api.rejectTravel(t.id, comment), 'expenses.msg.tripRejected', () => this.afterDecision(), { name: t.employeeName });
  }

  payAdvance(t: TravelRequest, payout: PayoutMethod): void {
    const key = `${t.id}:${payout}`;
    if (this.confirmId !== key) {
      this.confirmId = key;
      return;
    }
    this.run(t.id, this.api.payAdvance(t.id, payout), 'expenses.msg.advancePaid', () => this.loadAdvances(), { name: t.employeeName });
  }

  // ───── Policies ─────
  editPolicy(): void {
    const p = this.policy();
    if (p) this.policyForm = { ...p };
  }

  savePolicy(): void {
    const p = this.policyForm;
    if (!p) return;
    this.saving.set(true);
    this.api.savePolicy(p).subscribe({
      next: () => {
        this.saving.set(false);
        this.policyForm = null;
        this.alert.success(this.translate.instant('expenses.msg.policySaved'));
        this.loadPolicies();
        this.loadMine();
      },
      error: e => this.fail(e)
    });
  }

  openCategory(c?: ExpenseCategory): void {
    this.categoryForm = c
      ? { ...c }
      : { id: null, code: '', name: '', description: null, maxPerClaim: null, receiptRequired: true, isActive: true,
          sortOrder: (this.categories().at(-1)?.sortOrder ?? 0) + 10 };
    this.drawer.set('category');
  }

  saveCategory(): void {
    const f = this.categoryForm;
    if (!f) return;
    const { id, ...body } = f;
    this.saving.set(true);
    this.api.saveCategory(id, { ...body, code: body.code.trim().toUpperCase(), name: body.name.trim(), description: body.description?.trim() || null })
      .subscribe({
        next: () => this.done('expenses.msg.categorySaved', () => {
          this.loadPolicies();
          this.loadMine();
        }),
        error: e => this.fail(e)
      });
  }

  // ───── Helpers ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.claimTarget = null;
    this.tripTarget = null;
    this.categoryForm = null;
  }

  private afterMine(): void {
    this.loadMine();
    if (this.canSeeAll) this.loadPendingCounts();
  }

  private afterDecision(): void {
    if (this.tab() === 'claims') this.loadClaims();
    if (this.tab() === 'travel') this.loadTrips();
    this.loadPendingCounts();
    if (this.my()?.employeeId) this.loadMine();
  }

  private run(id: string, req: ReturnType<ExpensesService['markPaid']>, key: string, reload: () => void, params?: Record<string, string>): void {
    this.busy.set(id);
    req.subscribe({
      next: () => {
        this.busy.set(null);
        this.rejectingId = null;
        this.confirmId = null;
        this.alert.success(this.translate.instant(key, params));
        reload();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  private sum<T>(rows: T[], pick: (r: T) => number): number {
    return rows.reduce((s, r) => s + pick(r), 0);
  }

  private done(key: string, reload: () => void, params?: Record<string, string>): void {
    this.saving.set(false);
    this.closeDrawer();
    this.alert.success(this.translate.instant(key, params));
    reload();
  }

  private fail(e: unknown, fallback = 'payrollSetup.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
