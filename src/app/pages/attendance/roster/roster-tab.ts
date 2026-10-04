import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../../people/people.service';
import { Department } from '../../people/people.models';
import { AttendanceService } from '../attendance.service';
import { RosterDay, RosterRow, Shift, WEEK_BITS, addDays, isoDate } from '../attendance.models';

/** Roster tab: hafta (ya 2 hafte) × employees. HR cell pe click karke us din ki shift badalta hai. */
@Component({
  selector: 'app-roster-tab',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './roster-tab.html',
  styleUrl: './roster-tab.css'
})
export class RosterTabComponent {
  private readonly api = inject(AttendanceService);
  private readonly people = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly canManage = input(false);
  readonly canViewAll = input(false);

  readonly lang = inject(LanguageService).language;
  readonly weekBits = WEEK_BITS;
  readonly span = signal<7 | 14>(7);
  readonly from = signal(this.monday(new Date()));
  readonly days = computed(() => Array.from({ length: this.span() }, (_, i) => addDays(this.from(), i)));
  readonly today = isoDate(new Date());

  readonly rows = signal<RosterRow[]>([]);
  readonly shifts = signal<Shift[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(false);
  departmentId = '';
  search = '';
  readonly query = signal('');
  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.rows().filter(r => r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q)) : this.rows();
  });

  // Cell edit
  readonly cell = signal<{ row: RosterRow; day: RosterDay } | null>(null);
  cellForm = { shiftId: null as string | null, note: '' };

  // Bulk assign
  readonly assigning = signal(false);
  assignForm = { shiftId: '', from: isoDate(new Date()), to: '', useCustomOff: false };
  offBits = new Set<number>([32, 64]);
  picked = new Set<string>();
  readonly saving = signal(false);

  constructor() {
    this.load();
    this.api.shifts(false).subscribe({ next: s => this.shifts.set(s) });
    this.people.getDepartments().subscribe({ next: d => this.departments.set(d.filter(x => x.isActive)) });
  }

  load(): void {
    this.loading.set(true);
    this.api.roster({ from: this.from(), to: addDays(this.from(), this.span() - 1), departmentId: this.departmentId || undefined }).subscribe({
      next: r => {
        this.rows.set(r);
        this.loading.set(false);
      },
      error: e => {
        this.loading.set(false);
        this.fail(e, 'attendance.errors.load');
      }
    });
  }

  move(weeks: number): void {
    this.from.set(addDays(this.from(), weeks * 7));
    this.load();
  }

  thisWeek(): void {
    this.from.set(this.monday(new Date()));
    this.load();
  }

  setSpan(n: 7 | 14): void {
    this.span.set(n);
    this.load();
  }

  shiftColor(id: string | null): string {
    return this.shifts().find(s => s.id === id)?.color ?? 'var(--moss)';
  }

  // ── Cell ──
  openCell(row: RosterRow, day: RosterDay): void {
    if (!this.canManage()) return;
    this.cellForm = { shiftId: day.dayType === 'Workday' ? day.shiftId : null, note: '' };
    this.cell.set({ row, day });
  }

  saveCell(): void {
    const c = this.cell()!;
    this.run(this.api.setRosterEntry({ employeeId: c.row.employeeId, workDate: c.day.date, shiftId: this.cellForm.shiftId, note: this.cellForm.note.trim() || null }),
      () => this.cell.set(null));
  }

  resetCell(): void {
    const c = this.cell()!;
    this.run(this.api.clearRosterEntry(c.row.employeeId, c.day.date), () => this.cell.set(null));
  }

  // ── Bulk assign ──
  openAssign(): void {
    this.assignForm = { shiftId: this.shifts()[0]?.id ?? '', from: this.from(), to: '', useCustomOff: false };
    this.offBits = new Set([32, 64]);
    this.picked = new Set(this.visible().map(r => r.employeeId));
    this.assigning.set(true);
  }

  togglePick(id: string): void {
    if (this.picked.has(id)) this.picked.delete(id);
    else this.picked.add(id);
  }

  toggleAll(): void {
    this.picked = this.picked.size === this.rows().length ? new Set() : new Set(this.rows().map(r => r.employeeId));
  }

  toggleOff(bit: number): void {
    if (this.offBits.has(bit)) this.offBits.delete(bit);
    else this.offBits.add(bit);
  }

  saveAssign(): void {
    const f = this.assignForm;
    const off = f.useCustomOff ? [...this.offBits].reduce((a, b) => a | b, 0) : null;
    this.saving.set(true);
    this.api.assign({ employeeIds: [...this.picked], shiftId: f.shiftId, effectiveFrom: f.from, effectiveTo: f.to || null, weeklyOffDays: off }).subscribe({
      next: n => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('attendance.roster.assigned', { n }));
        this.assigning.set(false);
        this.load();
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  private run(req: Observable<unknown>, after: () => void): void {
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
        after();
        this.load();
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  private monday(d: Date): string {
    const day = (d.getDay() + 6) % 7;
    return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
  }

  private fail(e: unknown, key: string): void {
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(key)));
  }
}
