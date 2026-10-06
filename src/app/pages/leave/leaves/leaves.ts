import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, switchMap, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/i18n/language.service';
import { PermissionService } from '../../../core/auth/permissions';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { LeaveService } from '../leave.service';
import { HalfDayPeriod, LEAVE_STATUS_CHIP, LeaveRequest, LeaveStatus, MyLeave } from '../leave.models';

type Tab = 'mine' | 'approvals' | 'all';

@Component({
  selector: 'app-leaves',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './leaves.html',
  styleUrl: './leaves.css'
})
export class LeavesComponent {
  private readonly api = inject(LeaveService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  readonly chip = LEAVE_STATUS_CHIP;
  readonly canSeeAll = this.perms.hasAny('leaves.view.all');
  readonly canApprove = this.perms.hasAny(['leaves.approve', 'leaves.view.all']);
  readonly year = new Date().getFullYear();

  readonly tab = signal<Tab>('mine');
  readonly my = signal<MyLeave | null>(null);
  readonly notLinked = signal<string | null>(null);
  readonly approvals = signal<LeaveRequest[]>([]);
  readonly all = signal<LeaveRequest[]>([]);
  readonly allStatus = signal<LeaveStatus | ''>('');
  readonly expanded = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  // Apply drawer
  readonly applying = signal(false);
  readonly saving = signal(false);
  readonly preview = signal<{ days: number; holidays: string[] } | null>(null);
  form = { leaveTypeId: '', startDate: '', endDate: '', halfDay: false, halfDayPeriod: 'FirstHalf' as HalfDayPeriod, reason: '' };
  private readonly previewTrigger = new Subject<void>();

  // Reject
  rejectingId: string | null = null;
  rejectComment = '';

  readonly selectedBalance = computed(() => this.my()?.balances.find(b => b.leaveTypeId === this.form.leaveTypeId) ?? null);
  readonly upcoming = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (this.my()?.requests ?? []).filter(r => r.status === 'Approved' && r.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  });

  constructor() {
    this.previewTrigger.pipe(
      debounceTime(250),
      switchMap(() => {
        const f = this.form;
        const end = f.halfDay ? f.startDate : f.endDate;
        if (!f.startDate || !end || end < f.startDate) return of(null);
        return this.api.preview(f.startDate, end, f.halfDay).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed()
    ).subscribe(p => this.preview.set(p));

    this.loadMine();
    if (this.canApprove) this.loadApprovals();

    // Dashboard se ?tab=approvals
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && (['mine', 'approvals', 'all'] as Tab[]).includes(tab)) this.setTab(tab);
  }

  loadMine(): void {
    this.api.me(this.year).subscribe({
      next: m => {
        this.my.set(m);
        this.notLinked.set(null);
      },
      error: e => this.notLinked.set(PayrollService.errorMessage(e, this.translate.instant('leave.errors.load')))
    });
  }

  loadApprovals(): void {
    this.api.requests('Approvals').subscribe({ next: r => this.approvals.set(r), error: () => this.approvals.set([]) });
  }

  loadAll(): void {
    this.api.requests('All', this.allStatus(), this.year).subscribe({
      next: r => this.all.set(r),
      error: e => this.alert.error(PayrollService.errorMessage(e, this.translate.instant('leave.errors.load')))
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'all' && !this.all().length) this.loadAll();
    if (t === 'approvals') this.loadApprovals();
  }

  percentUsed(b: { entitled: number; carriedForward: number; adjusted: number; used: number; pending: number }): { used: number; pending: number } {
    const total = b.entitled + b.carriedForward + b.adjusted;
    if (total <= 0) return { used: 0, pending: 0 };
    return { used: Math.min(100, (b.used / total) * 100), pending: Math.min(100, (b.pending / total) * 100) };
  }

  // ───── Apply ─────
  openApply(typeId?: string): void {
    const today = new Date().toISOString().slice(0, 10);
    this.form = { leaveTypeId: typeId ?? this.my()?.balances[0]?.leaveTypeId ?? '', startDate: today, endDate: today, halfDay: false, halfDayPeriod: 'FirstHalf', reason: '' };
    this.preview.set(null);
    this.applying.set(true);
    this.previewTrigger.next();
  }

  onDatesChange(): void {
    if (this.form.endDate < this.form.startDate) this.form.endDate = this.form.startDate;
    this.previewTrigger.next();
  }

  canSubmit(): boolean {
    const p = this.preview();
    return !!(this.form.leaveTypeId && this.form.startDate && p && p.days > 0);
  }

  submit(): void {
    const f = this.form;
    this.saving.set(true);
    this.api.submit({
      leaveTypeId: f.leaveTypeId,
      startDate: f.startDate,
      endDate: f.halfDay ? f.startDate : f.endDate,
      halfDayPeriod: f.halfDay ? f.halfDayPeriod : null,
      reason: f.reason.trim() || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.applying.set(false);
        this.alert.success(this.translate.instant('leave.submitted'));
        this.loadMine();
      },
      error: e => {
        this.saving.set(false);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }

  cancel(r: LeaveRequest): void {
    this.busy.set(r.id);
    this.api.cancel(r.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.alert.success(this.translate.instant('leave.cancelled'));
        this.loadMine();
      },
      error: e => {
        this.busy.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }

  // ───── Approvals ─────
  approve(r: LeaveRequest): void {
    this.decide(r, true, null);
  }

  startReject(r: LeaveRequest): void {
    this.rejectingId = r.id;
    this.rejectComment = '';
  }

  confirmReject(r: LeaveRequest): void {
    if (!this.rejectComment.trim()) return;
    this.decide(r, false, this.rejectComment.trim());
  }

  private decide(r: LeaveRequest, approve: boolean, comment: string | null): void {
    this.busy.set(r.id);
    this.api.decide(r.id, approve, comment).subscribe({
      next: () => {
        this.busy.set(null);
        this.rejectingId = null;
        this.alert.success(this.translate.instant(approve ? 'leave.approvedMsg' : 'leave.rejectedMsg', { name: r.employeeName }));
        this.loadApprovals();
        if (this.all().length) this.loadAll();
      },
      error: e => {
        this.busy.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }

  toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }
}
