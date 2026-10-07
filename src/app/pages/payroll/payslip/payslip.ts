import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { utc } from '../../admin/admin.models';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import { PAYSLIP_STATUS_CHIP, Payslip, PayslipLine } from '../payroll.models';

/** Printable payslip — screen pe document jaisa, print pe sirf yahi. */
@Component({
  selector: 'app-payslip',
  imports: [DatePipe, TranslatePipe, AmountPipe],
  templateUrl: './payslip.html',
  styleUrl: './payslip.css'
})
export class PayslipComponent {
  private readonly api = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly location = inject(Location);

  readonly id = input.required<string>();
  /** Route data: self=true → employee apni payslip */
  readonly self = input(false);
  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly chip = PAYSLIP_STATUS_CHIP;

  readonly slip = signal<Payslip | null>(null);

  readonly earnings = computed(() => this.byType('Earning'));
  readonly deductions = computed(() => this.byType('Deduction'));
  readonly employer = computed(() => this.byType('EmployerContribution'));

  constructor() {
    effect(() => {
      this.api.getPayslip(this.id(), this.self()).subscribe({
        next: s => this.slip.set(s),
        error: err => {
          this.alert.error(PayrollService.errorMessage(err, this.translate.instant('payroll.errors.load')));
          this.back();
        }
      });
    });
  }

  back(): void {
    this.location.back();
  }

  print(): void {
    window.print();
  }

  private byType(type: PayslipLine['componentType']): PayslipLine[] {
    return this.slip()?.lines.filter(l => l.componentType === type) ?? [];
  }
}
