import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import { PayGroup, PayPeriod, PayrollRun, RUN_STATUS_CHIP } from '../payroll.models';

@Component({
  selector: 'app-payroll-runs',
  imports: [DatePipe, FormsModule, TranslatePipe, AmountPipe],
  templateUrl: './payroll-runs.html',
  styleUrl: './payroll-runs.css'
})
export class PayrollRunsComponent {
  private readonly api = inject(PayrollService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly statusChip = RUN_STATUS_CHIP;

  readonly runs = signal<PayrollRun[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  // Naya run
  readonly drawerOpen = signal(false);
  readonly payGroups = signal<PayGroup[]>([]);
  readonly periods = signal<PayPeriod[]>([]);
  readonly periodsLoading = signal(false);
  readonly creating = signal(false);
  selectedGroupId = '';
  selectedPeriodId = '';

  /** Jin periods ka regular run pehle se hai unhe list mein nahi dikhana. */
  readonly availablePeriods = computed(() => {
    const taken = new Set(this.runs().filter(r => r.status !== 'Cancelled').map(r => r.payPeriodId));
    return this.periods().filter(p => p.status === 'Open' && !taken.has(p.id));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getRuns().subscribe({
      next: runs => {
        this.runs.set(runs);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.load')));
        this.loading.set(false);
      }
    });
  }

  open(run: PayrollRun): void {
    this.router.navigate(['/app/payroll/runs', run.id]);
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
    this.selectedGroupId = '';
    this.selectedPeriodId = '';
    this.periods.set([]);

    if (this.payGroups().length) {
      this.autoSelectGroup();
      return;
    }
    this.api.getPayGroups().subscribe({
      next: groups => {
        this.payGroups.set(groups.filter(g => g.isActive));
        this.autoSelectGroup();
      },
      error: err => this.alert.error(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.load')))
    });
  }

  closeDrawer(): void {
    if (!this.creating()) this.drawerOpen.set(false);
  }

  onGroupChange(): void {
    this.selectedPeriodId = '';
    this.periods.set([]);
    if (!this.selectedGroupId) return;

    this.periodsLoading.set(true);
    this.api.getPayPeriods(this.selectedGroupId).subscribe({
      next: periods => {
        this.periods.set(periods);
        this.selectedPeriodId = this.availablePeriods()[0]?.id ?? '';
        this.periodsLoading.set(false);
      },
      error: err => {
        this.periodsLoading.set(false);
        this.alert.error(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.load')));
      }
    });
  }

  create(): void {
    if (!this.selectedGroupId || !this.selectedPeriodId) return;
    this.creating.set(true);
    this.api.createRun(this.selectedGroupId, this.selectedPeriodId).subscribe({
      next: id => {
        this.creating.set(false);
        this.drawerOpen.set(false);
        this.router.navigate(['/app/payroll/runs', id]);
      },
      error: err => {
        this.creating.set(false);
        this.alert.error(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.create')));
      }
    });
  }

  private autoSelectGroup(): void {
    if (this.payGroups().length === 1) {
      this.selectedGroupId = this.payGroups()[0].id;
      this.onGroupChange();
    }
  }
}
