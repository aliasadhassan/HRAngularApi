import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AmountPipe } from '../../shared/pipes/amount.pipe';
import { ChartComponent } from '../../shared/widgets/chart/chart';
import { PayrollService } from '../payroll/payroll.service';
import { PeopleService } from '../people/people.service';
import { Department } from '../people/people.models';
import { ReportsService } from './reports.service';
import {
  CountRow, PayRegister, PayReport, PeopleReport, RANGE_PRESETS, RangePreset, TimeEmployeeRow, TimeReport, downloadCsv, presetRange
} from './reports.models';

type Tab = 'people' | 'time' | 'pay';
type TimeSort = 'department' | 'rateAsc' | 'lateDesc' | 'absentDesc';

const TABS: readonly Tab[] = ['people', 'time', 'pay'];
const MOSS = '#3f5e48';
const BRASS = '#b08d3e';

/** Har report ek hi shakal: chhoti horizontal bars (mix panel ke liye) */
interface MixGroup { title: string; rows: { label: string; count: number; pct: number }[]; }

@Component({
  selector: 'app-reports',
  imports: [DatePipe, FormsModule, TranslatePipe, AmountPipe, ChartComponent],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class ReportsComponent {
  private readonly api = inject(ReportsService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  private readonly langTick = toSignal(this.translate.onLangChange.pipe(map(() => Date.now()), startWith(0)), { initialValue: 0 });

  readonly canPeople = this.perms.hasAny(P.employeesView);
  readonly canPay = this.perms.hasAny([P.payrollViewAll, P.payrollApprove]);
  readonly presets = RANGE_PRESETS;

  readonly tab = signal<Tab>(this.canPeople ? 'people' : 'pay');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ───── Filters ─────
  preset: RangePreset = 'last12';
  from = presetRange('last12')[0];
  to = presetRange('last12')[1];
  departmentId: string | null = null;
  readonly departments = signal<Department[]>([]);

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  year = new Date().getFullYear();
  registerMonth = new Date().getMonth() + 1;

  // ───── Data ─────
  readonly people = signal<PeopleReport | null>(null);
  readonly time = signal<TimeReport | null>(null);
  readonly pay = signal<PayReport | null>(null);
  readonly register = signal<PayRegister | null>(null);
  readonly registerLoading = signal(false);
  readonly timeSort = signal<TimeSort>('department');

  constructor() {
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && TABS.includes(tab) && this.allowed(tab)) this.tab.set(tab);

    if (this.canPeople) inject(PeopleService).getDepartments().subscribe(d => this.departments.set(d.filter(x => x.isActive)));
    this.load();
  }

  allowed(tab: Tab): boolean {
    return tab === 'pay' ? this.canPay : this.canPeople;
  }

  setTab(tab: Tab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.error.set(null);
    this.load();
  }

  // ───── Filters ─────
  onPreset(): void {
    if (this.preset === 'custom') return;
    [this.from, this.to] = presetRange(this.preset);
    this.load();
  }

  onDates(): void {
    this.preset = 'custom';
    if (!this.from || !this.to) return;
    if (this.from > this.to) {
      this.error.set(this.translate.instant('reports.errors.order'));
      return;
    }
    const days = (Date.parse(this.to) - Date.parse(this.from)) / 86_400_000;
    if (days >= 366) {
      this.error.set(this.translate.instant('reports.errors.tooLong'));
      return;
    }
    this.load();
  }

  load(): void {
    const tab = this.tab();
    this.error.set(null);
    this.loading.set(true);
    const done = { complete: () => this.loading.set(false) };
    const fail = (e: unknown) => {
      this.loading.set(false);
      this.error.set(PayrollService.errorMessage(e, this.translate.instant('reports.errors.load')));
    };

    if (tab === 'people') {
      this.api.people(this.from, this.to, this.departmentId).subscribe({ next: r => this.people.set(r), error: fail, ...done });
    } else if (tab === 'time') {
      this.api.time(this.from, this.to, this.departmentId).subscribe({ next: r => this.time.set(r), error: fail, ...done });
    } else {
      this.api.pay(this.year).subscribe({ next: r => this.pay.set(r), error: fail, ...done });
      this.loadRegister();
    }
  }

  loadRegister(): void {
    this.registerLoading.set(true);
    this.api.register(this.year, this.registerMonth).subscribe({
      next: r => { this.register.set(r); this.registerLoading.set(false); },
      error: () => { this.register.set(null); this.registerLoading.set(false); }
    });
  }

  onYear(): void {
    // Naya saal: register ka mahina us saal ka aakhri mahina jis mein payroll hua (warna December/aaj)
    const now = new Date();
    this.registerMonth = this.year === now.getFullYear() ? now.getMonth() + 1 : 12;
    this.load();
  }

  // ───── People ─────
  readonly headcountChange = computed(() => {
    const s = this.people()?.summary;
    return s ? s.headcountEnd - s.headcountStart : 0;
  });

  readonly mix = computed<MixGroup[]>(() => {
    this.langTick();
    const r = this.people();
    if (!r) return [];
    const t = (k: string) => this.translate.instant(k);
    const group = (title: string, rows: CountRow[], label: (k: string) => string): MixGroup => {
      const total = rows.reduce((s, x) => s + x.count, 0) || 1;
      return { title: t(title), rows: rows.map(x => ({ label: label(x.key), count: x.count, pct: Math.round((x.count * 100) / total) })) };
    };
    return [
      group('reports.people.byType', r.byType, k => t(`people.type.${k}`)),
      group('reports.people.byStatus', r.byStatus, k => t(`people.status.${k}`)),
      group('reports.people.byGender', r.byGender, k => (k === 'Unknown' ? t('reports.unknown') : t(`people.gender.${k}`))),
      group('reports.people.byTenure', r.tenureBands, k => t(`reports.tenure.${k}`)),
      group('reports.people.byLocation', r.byLocation, k => k)
    ];
  });

  readonly trendLabels = computed(() => {
    this.langTick();
    const fmt = new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { month: 'short', year: '2-digit' });
    return (this.people()?.trend ?? []).map(p => fmt.format(new Date(`${p.date}T00:00:00`)));
  });

  readonly trendDatasets = computed(() => {
    this.langTick();
    const points = this.people()?.trend ?? [];
    return [{
      label: this.translate.instant('reports.people.headcount'),
      data: points.map(p => p.headcount),
      borderColor: MOSS,
      backgroundColor: 'rgba(63, 94, 72, 0.08)',
      pointBackgroundColor: points.map((_, i) => (i === points.length - 1 ? BRASS : MOSS)),
      pointRadius: 3,
      fill: true,
      tension: 0.25
    }];
  });

  readonly trendOptions = computed(() => {
    const values = (this.people()?.trend ?? []).map(p => p.headcount);
    const low = values.length ? Math.min(...values) : 0;
    return { plugins: { legend: { display: false } }, scales: { y: { suggestedMin: Math.max(0, Math.floor(low * 0.9)), ticks: { precision: 0 } } } };
  });

  // ───── Time ─────
  readonly timeRows = computed<TimeEmployeeRow[]>(() => {
    const rows = [...(this.time()?.employees ?? [])];
    switch (this.timeSort()) {
      case 'rateAsc': return rows.sort((a, b) => a.attendanceRate - b.attendanceRate || a.name.localeCompare(b.name));
      case 'lateDesc': return rows.sort((a, b) => b.lateDays - a.lateDays || b.lateMinutes - a.lateMinutes);
      case 'absentDesc': return rows.sort((a, b) => b.absent - a.absent || a.name.localeCompare(b.name));
      default: return rows;
    }
  });

  readonly maxLeaveDays = computed(() => Math.max(1, ...(this.time()?.leaveTypes ?? []).map(t => t.days)));

  hours(minutes: number): number {
    return Math.round((minutes / 60) * 10) / 10;
  }

  rateClass(rate: number, scheduled: number): string {
    if (!scheduled) return 'dim';
    return rate < 85 ? 'rate-low' : rate < 95 ? 'rate-mid' : 'rate-ok';
  }

  // ───── Pay ─────
  readonly payTotalCost = computed(() => {
    const t = this.pay()?.totals;
    return t ? t.gross + t.employerCost : 0;
  });

  readonly monthLabels = computed(() => {
    this.langTick();
    const fmt = new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { month: 'short' });
    return this.months.map(m => fmt.format(new Date(2000, m - 1, 1)));
  });

  monthName(m: number): string {
    return this.monthLabels()[m - 1] ?? String(m);
  }

  readonly payDatasets = computed(() => {
    this.langTick();
    const months = this.pay()?.months ?? [];
    return [
      { label: this.translate.instant('reports.pay.net'), data: months.map(m => m.net), backgroundColor: MOSS, borderRadius: 3, maxBarThickness: 18, stack: 'cost' },
      { label: this.translate.instant('reports.pay.deductions'), data: months.map(m => m.deductions), backgroundColor: '#a9b5a3', borderRadius: 3, maxBarThickness: 18, stack: 'cost' },
      { label: this.translate.instant('reports.pay.employerCost'), data: months.map(m => m.employerCost), backgroundColor: BRASS, borderRadius: 3, maxBarThickness: 18, stack: 'cost' }
    ];
  });

  readonly payOptions = computed(() => {
    const lang = this.lang();
    const fmt = new Intl.NumberFormat(`${lang}-u-nu-latn`, { notation: 'compact', maximumFractionDigits: 1 });
    return {
      plugins: { legend: { display: true, position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v: number | string) => fmt.format(Number(v)) } } }
    };
  });

  readonly hasPay = computed(() => (this.pay()?.totals.payslips ?? 0) > 0);

  readonly componentGroups = computed(() => {
    const list = this.pay()?.components ?? [];
    return (['Earning', 'Deduction', 'EmployerContribution', 'Informational'] as const)
      .map(type => ({ type, rows: list.filter(c => c.type === type), total: list.filter(c => c.type === type).reduce((s, c) => s + c.amount, 0) }))
      .filter(g => g.rows.length > 0);
  });

  // ───── CSV ─────
  private t(key: string): string {
    return this.translate.instant(key);
  }

  private rangeTag(): string {
    return `${this.from}_${this.to}`;
  }

  exportDepartments(): void {
    const r = this.people();
    if (!r) return;
    downloadCsv(`people-departments_${this.rangeTag()}`,
      [this.t('reports.col.department'), this.t('reports.people.headcount'), this.t('reports.people.joined'), this.t('reports.people.left'), this.t('reports.people.avgTenure')],
      r.departments.map(d => [d.name, d.headcount, d.joined, d.left, d.averageTenureYears]));
  }

  exportMovements(): void {
    const r = this.people();
    if (!r) return;
    downloadCsv(`people-movements_${this.rangeTag()}`,
      [this.t('reports.col.date'), this.t('reports.col.kind'), this.t('reports.col.code'), this.t('reports.col.employee'), this.t('reports.col.department'),
        this.t('reports.col.designation'), this.t('reports.col.reason')],
      r.movements.map(m => [m.date, this.t(`reports.movement.${m.kind}`), m.employeeCode, m.name, m.department, m.designation, m.reason]));
  }

  exportTime(): void {
    const r = this.time();
    if (!r) return;
    downloadCsv(`attendance_${this.rangeTag()}`,
      [this.t('reports.col.code'), this.t('reports.col.employee'), this.t('reports.col.department'), this.t('reports.time.scheduled'),
        this.t('reports.time.present'), this.t('reports.time.halfDays'), this.t('reports.time.absent'), this.t('reports.time.missingPunch'),
        this.t('reports.time.lateDays'), this.t('reports.time.lateMinutes'), this.t('reports.time.overtimeHours'), this.t('reports.time.leaveDays'),
        this.t('reports.time.rate')],
      this.timeRows().map(e => [e.employeeCode, e.name, e.department, e.scheduled, e.present, e.halfDays, e.absent, e.incomplete,
        e.lateDays, e.lateMinutes, this.hours(e.overtimeMinutes), e.leaveDays, e.attendanceRate]));
  }

  exportLeave(): void {
    const r = this.time();
    if (!r) return;
    downloadCsv(`leave-by-type_${this.rangeTag()}`,
      [this.t('reports.time.leaveType'), this.t('reports.time.requests'), this.t('reports.time.people'), this.t('reports.time.leaveDays')],
      r.leaveTypes.map(l => [l.name, l.requests, l.employees, l.days]));
  }

  exportMonths(): void {
    const r = this.pay();
    if (!r) return;
    downloadCsv(`payroll-${r.year}-by-month`,
      [this.t('reports.col.month'), this.t('reports.pay.payslips'), this.t('reports.pay.gross'), this.t('reports.pay.deductions'),
        this.t('reports.pay.tax'), this.t('reports.pay.net'), this.t('reports.pay.employerCost')],
      r.months.map(m => [`${r.year}-${String(m.month).padStart(2, '0')}`, m.payslips, m.gross, m.deductions, m.tax, m.net, m.employerCost]));
  }

  exportPayDepartments(): void {
    const r = this.pay();
    if (!r) return;
    downloadCsv(`payroll-${r.year}-by-department`,
      [this.t('reports.col.department'), this.t('reports.pay.employees'), this.t('reports.pay.gross'), this.t('reports.pay.employerCost'),
        this.t('reports.pay.totalCost'), this.t('reports.pay.net')],
      r.departments.map(d => [d.name, d.employees, d.gross, d.employerCost, d.totalCost, d.net]));
  }

  exportComponents(): void {
    const r = this.pay();
    if (!r) return;
    downloadCsv(`payroll-${r.year}-by-component`,
      [this.t('reports.col.code'), this.t('reports.pay.component'), this.t('reports.pay.type'), this.t('reports.pay.employees'), this.t('reports.pay.amount')],
      r.components.map(c => [c.code, c.name, this.t(`reports.componentType.${c.type}`), c.employees, c.amount]));
  }

  exportRegister(): void {
    const r = this.register();
    if (!r) return;
    downloadCsv(`payroll-register-${r.year}-${String(r.month).padStart(2, '0')}`,
      [this.t('reports.pay.payslip'), this.t('reports.col.code'), this.t('reports.col.employee'), this.t('reports.col.department'),
        this.t('reports.col.designation'), this.t('reports.pay.payableDays'), this.t('reports.pay.gross'), this.t('reports.pay.deductions'),
        this.t('reports.pay.tax'), this.t('reports.pay.net'), this.t('reports.pay.employerCost')],
      r.rows.map(x => [x.payslipNumber, x.employeeCode, x.employeeName, x.department, x.designation, x.payableDays, x.gross,
        x.deductions, x.tax, x.net, x.employerCost]));
  }
}
