import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/i18n/language.service';
import { P, PermissionService } from '../../../core/auth/permissions';
import { AlertService } from '../../../services/alert/alert';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { PayrollService } from '../payroll.service';
import { PayComponent, PayrollEmployee } from '../payroll.models';
import { LoansService } from './loans.service';
import {
  LOAN_STATUS_CHIP, LOAN_TYPES, Loan, LoanAction, LoanLimit, LoanPolicy, LoanRepayment, LoanRequest,
  LoanRequestStatus, LoanStatus, LoanType, MyLoans, REQUEST_STATUS_CHIP
} from './loans.models';

type Tab = 'mine' | 'requests' | 'loans' | 'repayments';
type Drawer = 'request' | 'approve' | 'newLoan' | 'installment' | 'policy';

/** "2026-11" → "2026-11-01" (DateOnly) */
const monthStart = (month: string): string => `${month}-01`;
const nextMonth = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

@Component({
  selector: 'app-loans',
  imports: [DatePipe, FormsModule, TranslatePipe, AmountPipe],
  templateUrl: './loans.html',
  styleUrl: './loans.css'
})
export class LoansComponent {
  private readonly api = inject(LoansService);
  private readonly payroll = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  readonly loanChip = LOAN_STATUS_CHIP;
  readonly requestChip = REQUEST_STATUS_CHIP;
  readonly loanTypes = LOAN_TYPES;
  readonly canSeeAll = this.perms.hasAny([P.payrollViewAll, P.payrollApprove]);
  readonly canApprove = this.perms.hasAny(P.payrollApprove);
  readonly canEditPolicy = this.perms.hasAny(P.settingsManage);

  readonly tab = signal<Tab>('mine');
  readonly my = signal<MyLoans | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  readonly requests = signal<LoanRequest[]>([]);
  readonly requestStatus = signal<LoanRequestStatus | ''>('Pending');
  readonly pendingCount = signal(0);

  readonly loans = signal<Loan[]>([]);
  readonly loanStatus = signal<LoanStatus | ''>('Active');
  readonly loanType = signal<LoanType | ''>('');

  readonly repayments = signal<LoanRepayment[]>([]);
  repFrom = '';
  repTo = '';
  readonly repTotal = computed(() => this.repayments().reduce((s, r) => s + r.amount, 0));

  // ───── Drawer state ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly saving = signal(false);
  requestForm = { loanType: 'Loan' as LoanType, amount: null as number | null, installments: 1, month: nextMonth(), reason: '' };
  approveTarget: LoanRequest | null = null;
  approveForm = { amount: null as number | null, installmentAmount: null as number | null, month: '', comment: '' };
  loanForm = { employeeId: '', employeeName: '', loanType: 'Loan' as LoanType, amount: null as number | null, installmentAmount: null as number | null, month: nextMonth(), remarks: '' };
  installmentTarget: Loan | null = null;
  installmentAmount: number | null = null;
  policyForm: LoanPolicy | null = null;
  readonly deductionComponents = signal<PayComponent[]>([]);

  // Employee search (new loan)
  readonly employeeHits = signal<PayrollEmployee[]>([]);
  employeeQuery = '';
  private readonly employeeSearch = new Subject<string>();

  confirmCancelId: string | null = null;

  // Reject inline
  rejectingId: string | null = null;
  rejectComment = '';

  readonly myOpenLoans = computed(() => (this.my()?.loans ?? []).filter(l => l.status === 'Active' || l.status === 'Paused'));
  readonly myPastLoans = computed(() => (this.my()?.loans ?? []).filter(l => l.status === 'Closed' || l.status === 'Cancelled'));

  constructor() {
    this.employeeSearch.pipe(
      debounceTime(250),
      switchMap(q => q.trim().length < 2
        ? of([])
        : this.payroll.getPayrollEmployees({ page: 1, pageSize: 8, search: q.trim() }).pipe(
            switchMap(r => of(r.items.filter(e => e.isActive))),
            catchError(() => of([])))),
      takeUntilDestroyed()
    ).subscribe(hits => this.employeeHits.set(hits));

    this.loadMine();
    if (this.canSeeAll) this.loadPendingCount();
  }

  // ───── Loading ─────
  loadMine(): void {
    this.api.me().subscribe({
      next: m => {
        this.my.set(m);
        this.loadError.set(null);
        // HR jo khud employee nahi, seedha kaam ke tab pe
        if (!m.employeeId && this.canSeeAll && this.tab() === 'mine') this.setTab('requests');
      },
      error: e => this.loadError.set(PayrollService.errorMessage(e, this.translate.instant('loans.errors.load')))
    });
  }

  private loadPendingCount(): void {
    this.api.requests('Pending').subscribe({ next: r => this.pendingCount.set(r.length), error: () => this.pendingCount.set(0) });
  }

  loadRequests(): void {
    this.api.requests(this.requestStatus()).subscribe({
      next: r => {
        this.requests.set(r);
        if (this.requestStatus() === 'Pending') this.pendingCount.set(r.length);
      },
      error: e => this.alert.error(PayrollService.errorMessage(e, this.translate.instant('loans.errors.load')))
    });
  }

  loadLoans(): void {
    this.api.loans(this.loanStatus(), this.loanType()).subscribe({
      next: l => this.loans.set(l),
      error: e => this.alert.error(PayrollService.errorMessage(e, this.translate.instant('loans.errors.load')))
    });
  }

  loadRepayments(): void {
    const from = this.repFrom ? monthStart(this.repFrom) : undefined;
    const to = this.repTo ? this.monthEnd(this.repTo) : undefined;
    this.api.repayments(from, to).subscribe({
      next: r => this.repayments.set(r),
      error: e => this.alert.error(PayrollService.errorMessage(e, this.translate.instant('loans.errors.load')))
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'requests') this.loadRequests();
    if (t === 'loans') this.loadLoans();
    if (t === 'repayments') this.loadRepayments();
  }

  limit(type: LoanType): LoanLimit | null {
    return this.my()?.limits.find(l => l.loanType === type) ?? null;
  }

  progress(l: Loan): number {
    return l.principalAmount > 0 ? Math.min(100, (l.repaidAmount / l.principalAmount) * 100) : 0;
  }

  // ───── Employee: request ─────
  openRequest(type: LoanType): void {
    const lim = this.limit(type);
    this.requestForm = { loanType: type, amount: null, installments: Math.min(lim?.maxInstallments ?? 1, type === 'Loan' ? 12 : 1), month: nextMonth(), reason: '' };
    this.drawer.set('request');
  }

  readonly minMonth = nextMonth();

  requestLimit(): LoanLimit | null {
    return this.limit(this.requestForm.loanType);
  }

  requestInstallment(): number | null {
    const f = this.requestForm;
    if (!f.amount || f.amount <= 0 || !f.installments || f.installments < 1) return null;
    return Math.ceil((f.amount / f.installments) * 100) / 100;
  }

  requestProblem(): string | null {
    const f = this.requestForm;
    const lim = this.requestLimit();
    if (!lim || !lim.enabled) return 'loans.problem.disabled';
    if (!lim.eligible) return null; // reason backend se aata hai, alag dikhta hai
    if (lim.maxAmount !== null && f.amount !== null && f.amount > lim.maxAmount) return 'loans.problem.overLimit';
    if (f.installments > lim.maxInstallments) return 'loans.problem.tooManyInstallments';
    return null;
  }

  canSendRequest(): boolean {
    const f = this.requestForm;
    const lim = this.requestLimit();
    return !!(lim?.enabled && lim.eligible && f.amount && f.amount > 0 && f.installments >= 1 && f.month && f.reason.trim() && !this.requestProblem());
  }

  sendRequest(): void {
    const f = this.requestForm;
    this.saving.set(true);
    this.api.submit({ loanType: f.loanType, amount: f.amount!, installments: f.installments, preferredStartDate: monthStart(f.month), reason: f.reason.trim() }).subscribe({
      next: () => this.done('loans.msg.requested', () => {
        this.loadMine();
        if (this.canSeeAll) this.loadPendingCount();
      }),
      error: e => this.fail(e)
    });
  }

  cancelRequest(r: LoanRequest): void {
    this.busy.set(r.id);
    this.api.cancelRequest(r.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.alert.success(this.translate.instant('loans.msg.requestCancelled'));
        this.loadMine();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  // ───── HR: requests ─────
  openApprove(r: LoanRequest): void {
    this.approveTarget = r;
    this.approveForm = { amount: r.requestedAmount, installmentAmount: r.suggestedInstallment, month: r.preferredStartDate.slice(0, 7), comment: '' };
    this.drawer.set('approve');
  }

  approveInstallments(): number | null {
    const f = this.approveForm;
    if (!f.amount || !f.installmentAmount || f.installmentAmount <= 0) return null;
    return Math.ceil(f.amount / f.installmentAmount);
  }

  confirmApprove(): void {
    const r = this.approveTarget;
    if (!r) return;
    const f = this.approveForm;
    this.saving.set(true);
    this.api.approve(r.id, {
      amount: f.amount,
      installmentAmount: f.installmentAmount,
      startDate: f.month ? monthStart(f.month) : null,
      comment: f.comment.trim() || null
    }).subscribe({
      next: () => this.done('loans.msg.approved', () => this.afterDecision(), { name: r.employeeName }),
      error: e => this.fail(e)
    });
  }

  startReject(r: LoanRequest): void {
    this.rejectingId = r.id;
    this.rejectComment = '';
  }

  confirmReject(r: LoanRequest): void {
    const comment = this.rejectComment.trim();
    if (!comment) return;
    this.busy.set(r.id);
    this.api.reject(r.id, comment).subscribe({
      next: () => {
        this.busy.set(null);
        this.rejectingId = null;
        this.alert.success(this.translate.instant('loans.msg.rejected', { name: r.employeeName }));
        this.afterDecision();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  private afterDecision(): void {
    this.loadRequests();
    if (this.requestStatus() !== 'Pending') this.loadPendingCount();
    if (this.my()?.employeeId) this.loadMine();
  }

  // ───── HR: loans ─────
  openNewLoan(): void {
    this.loanForm = { employeeId: '', employeeName: '', loanType: 'Loan', amount: null, installmentAmount: null, month: nextMonth(), remarks: '' };
    this.employeeQuery = '';
    this.employeeHits.set([]);
    this.drawer.set('newLoan');
  }

  onEmployeeQuery(q: string): void {
    this.employeeQuery = q;
    this.loanForm.employeeId = '';
    this.employeeSearch.next(q);
  }

  pickEmployee(e: PayrollEmployee): void {
    this.loanForm.employeeId = e.employeeId;
    this.loanForm.employeeName = e.fullName;
    this.employeeQuery = `${e.fullName} · ${e.employeeCode}`;
    this.employeeHits.set([]);
  }

  newLoanInstallments(): number | null {
    const f = this.loanForm;
    if (!f.amount || !f.installmentAmount || f.installmentAmount <= 0) return null;
    return Math.ceil(f.amount / f.installmentAmount);
  }

  canCreateLoan(): boolean {
    const f = this.loanForm;
    return !!(f.employeeId && f.amount && f.amount > 0 && f.installmentAmount && f.installmentAmount > 0 && f.installmentAmount <= f.amount && f.month);
  }

  createLoan(): void {
    const f = this.loanForm;
    this.saving.set(true);
    this.api.create({
      employeeId: f.employeeId,
      loanType: f.loanType,
      amount: f.amount!,
      installmentAmount: f.installmentAmount!,
      startDate: monthStart(f.month),
      remarks: f.remarks.trim() || null
    }).subscribe({
      next: () => this.done('loans.msg.created', () => this.loadLoans(), { name: f.employeeName }),
      error: e => this.fail(e)
    });
  }

  openInstallment(l: Loan): void {
    this.installmentTarget = l;
    this.installmentAmount = l.installmentAmount;
    this.drawer.set('installment');
  }

  installmentsAfterChange(): number | null {
    const l = this.installmentTarget;
    const a = this.installmentAmount;
    if (!l || !a || a <= 0) return null;
    return Math.ceil(l.outstandingAmount / a);
  }

  saveInstallment(): void {
    const l = this.installmentTarget;
    if (!l || !this.installmentAmount) return;
    this.saving.set(true);
    this.api.changeInstallment(l.id, this.installmentAmount).subscribe({
      next: () => this.done('loans.msg.installmentChanged', () => this.loadLoans()),
      error: e => this.fail(e)
    });
  }

  changeStatus(l: Loan, op: LoanAction): void {
    // Cancel do qadam: pehli click pe "Pakka?" button
    if (op === 'cancel' && this.confirmCancelId !== l.id) {
      this.confirmCancelId = l.id;
      return;
    }
    this.confirmCancelId = null;
    this.busy.set(l.id);
    this.api.changeStatus(l.id, op).subscribe({
      next: () => {
        this.busy.set(null);
        this.alert.success(this.translate.instant('loans.msg.' + op));
        this.loadLoans();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  // ───── Policy ─────
  openPolicy(): void {
    this.api.policy().subscribe({
      next: p => {
        this.policyForm = { ...p };
        this.drawer.set('policy');
      },
      error: e => this.fail(e)
    });
    if (!this.deductionComponents().length) {
      this.payroll.getComponents(false).subscribe({
        next: c => this.deductionComponents.set(c.filter(x => x.componentType === 'Deduction')),
        error: () => this.deductionComponents.set([])
      });
    }
  }

  savePolicy(): void {
    const p = this.policyForm;
    if (!p) return;
    this.saving.set(true);
    this.api.savePolicy(p).subscribe({
      next: () => this.done('loans.msg.policySaved', () => this.loadMine()),
      error: e => this.fail(e)
    });
  }

  // ───── Helpers ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.approveTarget = null;
    this.installmentTarget = null;
  }

  private monthEnd(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, '0')}`;
  }

  private done(key: string, reload: () => void, params?: Record<string, string>): void {
    this.saving.set(false);
    this.closeDrawer();
    this.alert.success(this.translate.instant(key, params));
    reload();
  }

  private fail(e: unknown): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
  }
}
