import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import {
  CalcType, ComponentType, PayComponent, PayFrequency, PayGroup, PayPeriod, PayrollSettings,
  ProrationMethod, SavePayComponent, TaxCalcMethod, TaxRegime, TaxSlab
} from '../payroll.models';

type Tab = 'general' | 'groups' | 'components' | 'tax';
type Drawer = 'group' | 'component' | 'tax' | null;

const CURRENCIES = ['PKR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'USD', 'GBP', 'EUR'];

@Component({
  selector: 'app-payroll-setup',
  imports: [DatePipe, FormsModule, TranslatePipe, AmountPipe],
  templateUrl: './payroll-setup.html',
  styleUrl: './payroll-setup.css'
})
export class PayrollSetupComponent {
  private readonly api = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly tabs: Tab[] = ['general', 'groups', 'components', 'tax'];
  readonly tab = signal<Tab>('general');

  readonly currencies = CURRENCIES;
  readonly frequencies: PayFrequency[] = ['Monthly', 'SemiMonthly', 'BiWeekly', 'Weekly'];
  readonly prorations: ProrationMethod[] = ['CalendarDays', 'WorkingDays', 'Fixed30'];
  readonly componentTypes: ComponentType[] = ['Earning', 'Deduction', 'EmployerContribution', 'Informational'];
  readonly calcTypes: CalcType[] = ['Fixed', 'PercentOfComponent', 'PercentOfGross', 'Variable', 'Remainder'];
  readonly taxMethods: TaxCalcMethod[] = ['Annualized', 'PerPeriodFlat', 'None'];
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Data
  readonly settings = signal<PayrollSettings | null>(null);
  readonly notInitialized = signal(false);
  readonly groups = signal<PayGroup[]>([]);
  readonly components = signal<PayComponent[]>([]);
  readonly regimes = signal<TaxRegime[]>([]);
  readonly selectedGroupId = signal<string | null>(null);
  readonly periods = signal<PayPeriod[]>([]);
  readonly saving = signal(false);

  // Forms
  settingsForm: PayrollSettings = { baseCurrency: 'PKR', prorationMethod: 'CalendarDays', roundingDecimals: 2, payslipNumberPrefix: 'PS', requireApproval: true };
  initCurrency = 'PKR';
  periodCount = 6;
  readonly drawer = signal<Drawer>(null);
  editingId: string | null = null;
  groupForm = this.emptyGroup();
  componentForm: SavePayComponent = this.emptyComponent();
  taxForm = this.emptyTax();

  readonly selectedGroup = computed(() => this.groups().find(g => g.id === this.selectedGroupId()) ?? null);
  readonly earnings = computed(() => this.components().filter(c => c.componentType === 'Earning'));

  constructor() {
    this.loadSettings();
    this.loadGroups();
    this.loadComponents();
    this.loadRegimes();
  }

  // ───── Loading ─────
  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: s => {
        this.settings.set(s);
        this.settingsForm = { ...s };
        this.notInitialized.set(false);
      },
      error: () => this.notInitialized.set(true)
    });
  }

  loadGroups(): void {
    this.api.getPayGroups(true).subscribe({
      next: g => {
        this.groups.set(g);
        if (!this.selectedGroupId() && g.length) this.selectGroup(g[0].id);
      },
      error: e => this.fail(e, 'payrollSetup.errors.load')
    });
  }

  loadComponents(): void {
    this.api.getComponents(true).subscribe({ next: c => this.components.set(c), error: e => this.fail(e, 'payrollSetup.errors.load') });
  }

  loadRegimes(): void {
    this.api.getTaxRegimes().subscribe({ next: r => this.regimes.set(r), error: e => this.fail(e, 'payrollSetup.errors.load') });
  }

  selectGroup(id: string): void {
    this.selectedGroupId.set(id);
    this.api.getPayPeriods(id).subscribe({ next: p => this.periods.set(p), error: () => this.periods.set([]) });
  }

  // ───── General ─────
  settingsDirty(): boolean {
    const s = this.settings();
    return !!s && JSON.stringify({ ...this.settingsForm, roundingDecimals: +this.settingsForm.roundingDecimals }) !== JSON.stringify(s);
  }

  saveSettings(): void {
    this.run(this.api.updateSettings({ ...this.settingsForm, roundingDecimals: +this.settingsForm.roundingDecimals }), () => this.loadSettings());
  }

  initialize(): void {
    this.run(this.api.initialize(this.initCurrency), () => {
      this.loadSettings();
      this.loadComponents();
    });
  }

  // ───── Pay groups ─────
  openGroup(group?: PayGroup): void {
    this.editingId = group?.id ?? null;
    this.groupForm = group
      ? { name: group.name, code: group.code, payFrequency: group.payFrequency, countryCode: group.countryCode, currencyCode: group.currencyCode, anchorDate: group.anchorDate, payDayOffset: group.payDayOffset }
      : this.emptyGroup();
    this.drawer.set('group');
  }

  saveGroup(): void {
    const f = this.groupForm;
    const request: Observable<unknown> = this.editingId
      ? this.api.updatePayGroup(this.editingId, { name: f.name.trim(), code: f.code.trim(), payDayOffset: +f.payDayOffset })
      : this.api.createPayGroup({ ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), countryCode: f.countryCode.toUpperCase(), payDayOffset: +f.payDayOffset });
    this.run(request, () => {
      this.drawer.set(null);
      this.loadGroups();
    });
  }

  generatePeriods(): void {
    const id = this.selectedGroupId();
    if (!id) return;
    this.run(this.api.generatePeriods(id, +this.periodCount), () => this.selectGroup(id), 'payrollSetup.groups.generated');
  }

  // ───── Components ─────
  openComponent(c?: PayComponent): void {
    this.editingId = c?.id ?? null;
    this.componentForm = c
      ? { code: c.code, name: c.name, componentType: c.componentType, defaultCalcType: c.defaultCalcType, defaultBaseComponentId: c.defaultBaseComponentId,
          isTaxable: c.isTaxable, isProrated: c.isProrated, isRecurring: c.isRecurring, showOnPayslip: c.showOnPayslip, sortOrder: c.sortOrder }
      : this.emptyComponent();
    this.drawer.set('component');
  }

  isSystem(c: PayComponent): boolean {
    return !!c.systemCode;
  }

  saveComponent(): void {
    const f = this.componentForm;
    const body: SavePayComponent = {
      ...f,
      code: f.code.trim().toUpperCase(),
      name: f.name.trim(),
      sortOrder: +f.sortOrder,
      defaultBaseComponentId: f.defaultCalcType === 'PercentOfComponent' ? f.defaultBaseComponentId : null
    };
    this.run(this.api.saveComponent(body, this.editingId ?? undefined), () => {
      this.drawer.set(null);
      this.loadComponents();
    });
  }

  // ───── Tax ─────
  openTax(): void {
    this.taxForm = this.emptyTax();
    this.drawer.set('tax');
  }

  addSlab(): void {
    const last = this.taxForm.slabs.at(-1);
    this.taxForm.slabs = [...this.taxForm.slabs, { fromAmount: last?.toAmount ?? 0, toAmount: null, fixedAmount: 0, ratePercent: 0 }];
  }

  removeSlab(i: number): void {
    this.taxForm.slabs = this.taxForm.slabs.filter((_, idx) => idx !== i);
  }

  saveTax(): void {
    const f = this.taxForm;
    this.run(this.api.createTaxRegime({
      countryCode: f.countryCode.toUpperCase(),
      name: f.name.trim(),
      taxYearStartMonth: +f.taxYearStartMonth,
      calcMethod: f.calcMethod,
      effectiveFrom: f.effectiveFrom,
      effectiveTo: f.effectiveTo || null,
      slabs: f.calcMethod === 'None' ? [] : f.slabs.map(s => ({
        fromAmount: +s.fromAmount, toAmount: s.toAmount === null || (s.toAmount as unknown) === '' ? null : +s.toAmount,
        fixedAmount: +s.fixedAmount, ratePercent: +s.ratePercent
      }))
    }), () => {
      this.drawer.set(null);
      this.loadRegimes();
    });
  }

  componentName(id: string | null): string {
    return this.components().find(c => c.id === id)?.code ?? '—';
  }

  // ───── Helpers ─────
  private run(request: Observable<unknown>, after: () => void, successKey = 'payrollSetup.saved'): void {
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(successKey));
        after();
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  private fail(e: unknown, key: string): void {
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(key)));
  }

  private emptyGroup() {
    const today = new Date();
    const anchor = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    return { name: '', code: '', payFrequency: 'Monthly' as PayFrequency, countryCode: 'PK', currencyCode: 'PKR', anchorDate: anchor, payDayOffset: 0 };
  }

  private emptyComponent(): SavePayComponent {
    return { code: '', name: '', componentType: 'Earning', defaultCalcType: 'Fixed', defaultBaseComponentId: null,
             isTaxable: true, isProrated: true, isRecurring: true, showOnPayslip: true, sortOrder: 10 };
  }

  private emptyTax() {
    return {
      countryCode: 'PK', name: '', taxYearStartMonth: 7, calcMethod: 'Annualized' as TaxCalcMethod,
      effectiveFrom: `${new Date().getFullYear()}-07-01`, effectiveTo: '' as string | null,
      slabs: [{ fromAmount: 0, toAmount: null, fixedAmount: 0, ratePercent: 0 }] as TaxSlab[]
    };
  }
}
