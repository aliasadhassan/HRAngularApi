import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { buildGuilloche } from '../../../shared/guilloche/guilloche';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import { PAYSLIP_STATUS_CHIP, PayrollRun, PayslipListItem, RUN_STATUS_CHIP } from '../payroll.models';

type PendingAction = 'approve' | 'cancel' | null;

@Component({
  selector: 'app-payroll-run-detail',
  imports: [DatePipe, RouterLink, TranslatePipe, AmountPipe],
  templateUrl: './payroll-run-detail.html',
  styleUrl: './payroll-run-detail.css'
})
export class PayrollRunDetailComponent {
  private readonly api = inject(PayrollService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  /** Route param (withComponentInputBinding) */
  readonly id = input.required<string>();

  readonly lang = inject(LanguageService).language;
  readonly guilloche = buildGuilloche();
  readonly runChip = RUN_STATUS_CHIP;
  readonly slipChip = PAYSLIP_STATUS_CHIP;

  readonly run = signal<PayrollRun | null>(null);
  readonly payslips = signal<PayslipListItem[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly confirm = signal<PendingAction>(null);

  readonly status = computed(() => this.run()?.status);
  readonly canCalculate = computed(() => ['Draft', 'Calculated', 'Failed'].includes(this.status() ?? ''));
  readonly canApprove = computed(() => this.status() === 'Calculated');
  readonly canCancel = computed(() => ['Draft', 'Calculated', 'Failed'].includes(this.status() ?? ''));
  /** Calculate se pehle totals 0 hote hain — 0.00 dikhane ke bajaye khali. */
  readonly hasTotals = computed(() => !!this.run()?.calculatedAt);
  readonly isLocked = computed(() => ['Approved', 'Paid'].includes(this.status() ?? ''));

  readonly failureLines = computed(() =>
    (this.run()?.failureReason ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  );

  readonly totalTax = computed(() => this.payslips().reduce((sum, p) => sum + p.taxAmount, 0));
  readonly onHold = computed(() => this.payslips().filter(p => p.status === 'OnHold').length);

  constructor() {
    effect(() => this.load(this.id()));
  }

  load(id: string): void {
    this.loading.set(true);
    this.api.getRun(id).subscribe({
      next: run => {
        this.run.set(run);
        this.loadPayslips(run);
      },
      error: err => {
        this.loading.set(false);
        this.alert.error(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.load')));
        this.router.navigate(['/app/payroll/runs']);
      }
    });
  }

  calculate(): void {
    const run = this.run();
    if (!run) return;
    this.busy.set(true);
    this.api.calculate(run.id).subscribe({
      next: updated => {
        this.busy.set(false);
        this.run.set(updated);
        if (updated.status === 'Failed') {
          this.alert.error(this.translate.instant('payroll.detail.calculationFailed'));
        } else {
          this.alert.success(this.translate.instant('payroll.detail.calculated'));
        }
        this.loadPayslips(updated);
      },
      error: err => this.fail(err)
    });
  }

  ask(action: PendingAction): void {
    this.confirm.set(action);
  }

  confirmAction(): void {
    const run = this.run();
    const action = this.confirm();
    if (!run || !action) return;
    this.busy.set(true);

    if (action === 'approve') {
      this.api.approve(run.id).subscribe({
        next: updated => {
          this.busy.set(false);
          this.confirm.set(null);
          this.run.set(updated);
          this.alert.success(this.translate.instant('payroll.detail.approved'));
          this.loadPayslips(updated);
        },
        error: err => this.fail(err)
      });
    } else {
      this.api.cancel(run.id).subscribe({
        next: () => {
          this.busy.set(false);
          this.confirm.set(null);
          this.alert.success(this.translate.instant('payroll.detail.cancelled'));
          this.router.navigate(['/app/payroll/runs']);
        },
        error: err => this.fail(err)
      });
    }
  }

  openPayslip(slip: PayslipListItem): void {
    this.router.navigate(['/app/payroll/runs', this.id(), 'payslips', slip.id]);
  }

  private loadPayslips(run: PayrollRun): void {
    if (run.status === 'Draft' || run.status === 'Failed' && run.totalEmployees === 0) {
      this.payslips.set([]);
      this.loading.set(false);
      return;
    }
    this.api.getRunPayslips(run.id).subscribe({
      next: slips => {
        this.payslips.set(slips);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.confirm.set(null);
    this.alert.error(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.action')));
  }
}
