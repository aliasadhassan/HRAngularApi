import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import { MyPayslip } from '../payroll.models';

@Component({
  selector: 'app-my-payslips',
  imports: [DatePipe, RouterLink, TranslatePipe, AmountPipe],
  templateUrl: './my-payslips.html',
  styleUrl: './my-payslips.css'
})
export class MyPayslipsComponent {
  private readonly api = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly slips = signal<MyPayslip[] | null>(null);
  readonly latest = computed(() => this.slips()?.[0] ?? null);
  readonly yearTotal = computed(() => {
    const y = new Date().getFullYear();
    return (this.slips() ?? []).filter(s => s.periodStart.startsWith(String(y))).reduce((t, s) => t + s.netPay, 0);
  });

  constructor() {
    this.api.getMyPayslips().subscribe({
      next: s => this.slips.set(s),
      error: e => {
        this.slips.set([]);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('myPayslips.error')));
      }
    });
  }
}
