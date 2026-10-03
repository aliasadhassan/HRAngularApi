import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { AmountPipe } from '../../../shared/pipes/amount.pipe';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../payroll.service';
import { CalcType, PayComponent, SalaryGrade, TemplateLine, TemplateListItem } from '../payroll.models';

type Drawer = 'grade' | 'template' | null;

/** Ek misaal ki gross pe template ka hisaab — editor mein "live preview" */
const PREVIEW_GROSS = 150_000;

@Component({
  selector: 'app-salary-structure',
  imports: [FormsModule, TranslatePipe, AmountPipe],
  templateUrl: './salary-structure.html',
  styleUrl: './salary-structure.css'
})
export class SalaryStructureComponent {
  private readonly api = inject(PayrollService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly calcTypes: CalcType[] = ['PercentOfGross', 'PercentOfComponent', 'Fixed', 'Remainder'];
  readonly previewGross = PREVIEW_GROSS;
  readonly isNaN = Number.isNaN;

  readonly grades = signal<SalaryGrade[]>([]);
  readonly templates = signal<TemplateListItem[]>([]);
  readonly components = signal<PayComponent[]>([]);
  readonly drawer = signal<Drawer>(null);
  readonly saving = signal(false);

  editingId: string | null = null;
  gradeForm = { code: '', name: '', currencyCode: 'PKR', minAnnual: null as number | null, maxAnnual: null as number | null };
  templateForm = { name: '', salaryGradeId: null as string | null, lines: [] as TemplateLine[] };

  /** Template mein sirf earnings/deductions — tax engine khud lagata hai */
  readonly pickable = computed(() =>
    this.components().filter(c => c.isActive && c.systemCode !== 'INCOME_TAX' && c.componentType !== 'Informational'));

  constructor() {
    this.load();
  }

  load(): void {
    this.api.getGrades(true).subscribe({ next: g => this.grades.set(g), error: e => this.fail(e, 'structure.errors.load') });
    this.api.getTemplates(true).subscribe({ next: t => this.templates.set(t), error: e => this.fail(e, 'structure.errors.load') });
    this.api.getComponents(false).subscribe({ next: c => this.components.set(c) });
  }

  gradeCode(id: string | null): string | null {
    return this.grades().find(g => g.id === id)?.code ?? null;
  }

  // ───── Grades ─────
  openGrade(g?: SalaryGrade): void {
    this.editingId = g?.id ?? null;
    this.gradeForm = g
      ? { code: g.code, name: g.name, currencyCode: g.currencyCode, minAnnual: g.minAnnual, maxAnnual: g.maxAnnual }
      : { code: '', name: '', currencyCode: 'PKR', minAnnual: null, maxAnnual: null };
    this.drawer.set('grade');
  }

  saveGrade(): void {
    const f = this.gradeForm;
    const num = (v: unknown) => (v === null || v === '' || v === undefined ? null : +v);
    this.run(this.api.saveGrade({ code: f.code.trim().toUpperCase(), name: f.name.trim(), currencyCode: f.currencyCode, minAnnual: num(f.minAnnual), maxAnnual: num(f.maxAnnual) }, this.editingId ?? undefined));
  }

  // ───── Templates ─────
  openTemplate(t?: TemplateListItem): void {
    this.editingId = t?.id ?? null;
    if (!t) {
      this.templateForm = { name: '', salaryGradeId: null, lines: this.starterLines() };
      this.drawer.set('template');
      return;
    }
    this.api.getTemplate(t.id).subscribe({
      next: full => {
        this.templateForm = { name: full.name, salaryGradeId: full.salaryGradeId, lines: full.lines.map(l => ({ ...l })) };
        this.drawer.set('template');
      },
      error: e => this.fail(e, 'structure.errors.load')
    });
  }

  addLine(): void {
    const used = new Set(this.templateForm.lines.map(l => l.payComponentId));
    const next = this.pickable().find(c => !used.has(c.id));
    if (!next) return;
    this.templateForm.lines = [...this.templateForm.lines, { payComponentId: next.id, calcType: 'Fixed', amount: 0, percentage: null, baseComponentId: null }];
  }

  removeLine(i: number): void {
    this.templateForm.lines = this.templateForm.lines.filter((_, idx) => idx !== i);
  }

  onCalcChange(line: TemplateLine): void {
    if (line.calcType === 'Fixed') { line.percentage = null; line.baseComponentId = null; line.amount ??= 0; }
    if (line.calcType === 'PercentOfGross') { line.amount = null; line.baseComponentId = null; line.percentage ??= 0; }
    if (line.calcType === 'PercentOfComponent') { line.amount = null; line.percentage ??= 0; }
    if (line.calcType === 'Remainder') { line.amount = null; line.percentage = null; line.baseComponentId = null; }
  }

  baseOptions(line: TemplateLine): PayComponent[] {
    const inTemplate = new Set(this.templateForm.lines.map(l => l.payComponentId));
    return this.pickable().filter(c => c.id !== line.payComponentId && inTemplate.has(c.id));
  }

  remainderCount(): number {
    return this.templateForm.lines.filter(l => l.calcType === 'Remainder').length;
  }

  /** Engine ki tarah: fixed, % of gross, % of component (dependency order), phir remainder */
  preview(): { id: string; name: string; amount: number }[] {
    const lines = this.templateForm.lines;
    const result = new Map<string, number>();
    let pending = lines.filter(l => l.calcType !== 'Remainder');
    for (let guard = 0; pending.length && guard < 10; guard++) {
      pending = pending.filter(l => {
        let v: number | null = null;
        if (l.calcType === 'Fixed') v = +(l.amount ?? 0);
        if (l.calcType === 'PercentOfGross') v = (PREVIEW_GROSS * +(l.percentage ?? 0)) / 100;
        if (l.calcType === 'PercentOfComponent' && l.baseComponentId && result.has(l.baseComponentId))
          v = (result.get(l.baseComponentId)! * +(l.percentage ?? 0)) / 100;
        if (v === null) return true;
        result.set(l.payComponentId, v);
        return false;
      });
    }
    const rem = lines.find(l => l.calcType === 'Remainder');
    if (rem) {
      const earnings = [...result].filter(([id]) => this.components().find(c => c.id === id)?.componentType === 'Earning');
      result.set(rem.payComponentId, PREVIEW_GROSS - earnings.reduce((s, [, v]) => s + v, 0));
    }
    return lines.map(l => ({ id: l.payComponentId, name: this.components().find(c => c.id === l.payComponentId)?.name ?? '?', amount: result.get(l.payComponentId) ?? NaN }));
  }

  previewTotal(): number {
    return this.preview()
      .filter(p => this.components().find(c => c.id === p.id)?.componentType === 'Earning')
      .reduce((s, p) => s + (isNaN(p.amount) ? 0 : p.amount), 0);
  }

  saveTemplate(): void {
    const f = this.templateForm;
    const lines = f.lines.map(l => ({
      ...l,
      amount: l.amount === null || (l.amount as unknown) === '' ? null : +l.amount,
      percentage: l.percentage === null || (l.percentage as unknown) === '' ? null : +l.percentage
    }));
    this.run(this.api.saveTemplate({ name: f.name.trim(), salaryGradeId: f.salaryGradeId || null, lines }, this.editingId ?? undefined));
  }

  // ───── Helpers ─────
  private starterLines(): TemplateLine[] {
    const byCode = (code: string) => this.pickable().find(c => c.code === code)?.id;
    const basic = byCode('BASIC'), hra = byCode('HRA'), special = byCode('SPECIAL');
    const lines: TemplateLine[] = [];
    if (basic) lines.push({ payComponentId: basic, calcType: 'PercentOfGross', amount: null, percentage: 60, baseComponentId: null });
    if (hra && basic) lines.push({ payComponentId: hra, calcType: 'PercentOfComponent', amount: null, percentage: 40, baseComponentId: basic });
    if (special) lines.push({ payComponentId: special, calcType: 'Remainder', amount: null, percentage: null, baseComponentId: null });
    return lines;
  }

  private run(request: Observable<unknown>): void {
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.drawer.set(null);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
        this.load();
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
}
