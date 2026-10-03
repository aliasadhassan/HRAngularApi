import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import {
  CalcType, EmployeeSalary, PayComponent, PayGroup, PayrollEmployee, SalaryBasis, SalaryChangeReason,
  SalaryGrade, SalaryTemplate, TemplateListItem
} from '../payroll.models';

type Filter = 'all' | 'unassigned';

@Component({
  selector: 'app-employee-salaries',
  imports: [DatePipe, FormsModule, TranslatePipe, AmountPipe],
  templateUrl: './employee-salaries.html',
  styleUrl: './employee-salaries.css'
})
export class EmployeeSalariesComponent {
  private readonly api = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly Math = Math;
  readonly bases: SalaryBasis[] = ['Monthly', 'Annual'];
  readonly reasons: SalaryChangeReason[] = ['Joining', 'Increment', 'Promotion', 'Correction', 'Other'];
  readonly overrideTypes: CalcType[] = ['Fixed', 'PercentOfGross', 'PercentOfComponent'];

  // List
  readonly rows = signal<PayrollEmployee[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly filter = signal<Filter>('all');
  search = '';
  payGroupId = '';
  private readonly searchChanged = new Subject<void>();

  readonly selected = signal<Set<string>>(new Set());
  bulkGroupId = '';

  // Reference data
  readonly groups = signal<PayGroup[]>([]);
  readonly templates = signal<TemplateListItem[]>([]);
  readonly grades = signal<SalaryGrade[]>([]);
  readonly components = signal<PayComponent[]>([]);

  // Drawer
  readonly employee = signal<PayrollEmployee | null>(null);
  readonly history = signal<EmployeeSalary[]>([]);
  readonly template = signal<SalaryTemplate | null>(null);
  readonly mode = signal<'view' | 'revise'>('view');
  readonly saving = signal(false);
  readonly warning = signal<string | null>(null);
  form = this.emptyForm();
  overrideEdit: { componentId: string; calcType: CalcType; amount: number | null; percentage: number | null; baseComponentId: string | null } | null = null;

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly current = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.history().find(s => s.effectiveFrom <= today && (!s.effectiveTo || s.effectiveTo >= today)) ?? this.history()[0] ?? null;
  });

  constructor() {
    this.searchChanged.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
    this.api.getPayGroups().subscribe({ next: g => this.groups.set(g) });
    this.api.getTemplates(false).subscribe({ next: t => this.templates.set(t) });
    this.api.getGrades(false).subscribe({ next: g => this.grades.set(g) });
    this.api.getComponents(false).subscribe({ next: c => this.components.set(c) });
    this.reload();
  }

  // ───── List ─────
  reload(resetPage = true): void {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    this.api.getPayrollEmployees({
      page: this.page(), pageSize: this.pageSize, search: this.search,
      payGroupId: this.payGroupId || undefined, onlyUnassigned: this.filter() === 'unassigned'
    }).subscribe({
      next: r => {
        this.rows.set(r.items);
        this.total.set(r.totalCount);
        this.loading.set(false);
        this.selected.set(new Set());
      },
      error: e => {
        this.loading.set(false);
        this.fail(e, 'salaries.errors.load');
      }
    });
  }

  onSearch(): void {
    this.searchChanged.next();
  }

  setFilter(f: Filter): void {
    this.filter.set(f);
    this.reload();
  }

  goTo(p: number): void {
    if (p < 1 || p > this.pages()) return;
    this.page.set(p);
    this.reload(false);
  }

  toggle(id: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }

  toggleAll(): void {
    const all = this.rows().every(r => this.selected().has(r.employeeId));
    this.selected.set(all ? new Set() : new Set(this.rows().map(r => r.employeeId)));
  }

  allSelected(): boolean {
    return this.rows().length > 0 && this.rows().every(r => this.selected().has(r.employeeId));
  }

  assignGroup(): void {
    if (!this.selected().size) return;
    this.run(this.api.assignPayGroup([...this.selected()], this.bulkGroupId || null), () => this.reload(false), 'salaries.groupAssigned');
  }

  // ───── Drawer ─────
  open(emp: PayrollEmployee): void {
    this.employee.set(emp);
    this.mode.set('view');
    this.warning.set(null);
    this.overrideEdit = null;
    this.loadHistory(emp.employeeId);
  }

  close(): void {
    if (!this.saving()) this.employee.set(null);
  }

  private loadHistory(employeeId: string): void {
    this.history.set([]);
    this.template.set(null);
    this.api.getSalaryHistory(employeeId).subscribe({
      next: h => {
        this.history.set([...h].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
        const cur = this.current();
        if (cur) this.api.getTemplate(cur.salaryTemplateId).subscribe({ next: t => this.template.set(t) });
        if (!h.length) this.startRevise();
      },
      error: e => this.fail(e, 'salaries.errors.load')
    });
  }

  startRevise(): void {
    const cur = this.current();
    this.form = cur
      ? { salaryTemplateId: cur.salaryTemplateId, salaryGradeId: cur.salaryGradeId, salaryBasis: cur.salaryBasis,
          basisAmount: cur.basisAmount, effectiveFrom: this.nextMonthStart(), changeReason: 'Increment', remarks: '' }
      : { ...this.emptyForm(), effectiveFrom: this.employee()?.joiningDate ?? this.emptyForm().effectiveFrom };
    this.warning.set(null);
    this.mode.set('revise');
  }

  saveSalary(): void {
    const emp = this.employee();
    if (!emp || !this.form.salaryTemplateId || !this.form.basisAmount) return;
    this.saving.set(true);
    this.api.assignSalary({
      employeeId: emp.employeeId,
      salaryTemplateId: this.form.salaryTemplateId,
      salaryGradeId: this.form.salaryGradeId || null,
      currencyCode: null,
      salaryBasis: this.form.salaryBasis,
      basisAmount: +this.form.basisAmount,
      effectiveFrom: this.form.effectiveFrom,
      changeReason: this.form.changeReason,
      remarks: this.form.remarks?.trim() || null
    }).subscribe({
      next: r => {
        this.saving.set(false);
        this.warning.set(r.warning);
        this.alert.success(this.translate.instant('salaries.saved'));
        this.mode.set('view');
        this.loadHistory(emp.employeeId);
        this.reload(false);
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  // ───── Overrides (current salary) ─────
  overrideFor(componentId: string) {
    return this.current()?.overrides.find(o => o.payComponentId === componentId) ?? null;
  }

  componentName(id: string | null): string {
    return this.components().find(c => c.id === id)?.name ?? '—';
  }

  editOverride(componentId: string): void {
    const o = this.overrideFor(componentId);
    this.overrideEdit = { componentId, calcType: (o?.calcType as CalcType) ?? 'Fixed', amount: o?.amount ?? 0, percentage: o?.percentage ?? null, baseComponentId: o?.baseComponentId ?? null };
  }

  saveOverride(): void {
    const emp = this.employee(), e = this.overrideEdit;
    if (!emp || !e) return;
    this.run(this.api.setOverride(emp.employeeId, e.componentId, {
      calcType: e.calcType,
      amount: e.calcType === 'Fixed' ? +(e.amount ?? 0) : null,
      percentage: e.calcType !== 'Fixed' ? +(e.percentage ?? 0) : null,
      baseComponentId: e.calcType === 'PercentOfComponent' ? e.baseComponentId : null
    }), () => { this.overrideEdit = null; this.loadHistory(emp.employeeId); });
  }

  exclude(componentId: string): void {
    const emp = this.employee();
    if (emp) this.run(this.api.excludeComponent(emp.employeeId, componentId), () => this.loadHistory(emp.employeeId));
  }

  resetOverride(componentId: string): void {
    const emp = this.employee();
    if (emp) this.run(this.api.removeOverride(emp.employeeId, componentId), () => this.loadHistory(emp.employeeId));
  }

  // ───── Helpers ─────
  private run(request: Observable<unknown>, after: () => void, key = 'payrollSetup.saved'): void {
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(key));
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

  private nextMonthStart(): string {
    const d = new Date();
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private emptyForm() {
    return {
      salaryTemplateId: '', salaryGradeId: null as string | null, salaryBasis: 'Monthly' as SalaryBasis,
      basisAmount: null as number | null, effectiveFrom: this.nextMonthStart(),
      changeReason: 'Joining' as SalaryChangeReason, remarks: ''
    };
  }
}
