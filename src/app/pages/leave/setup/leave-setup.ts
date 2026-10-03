import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../../people/people.service';
import { Location } from '../../people/people.models';
import { LeaveService } from '../leave.service';
import { AccrualMethod, ApprovalSettings, ApproverType, Holiday, LeavePolicy, LeaveType, PolicyRule } from '../leave.models';

type Tab = 'types' | 'policies' | 'holidays' | 'approval';
type Drawer = 'type' | 'policy' | 'holiday' | null;

const COLORS = ['#4F6F52', '#B08D3E', '#8C3B2E', '#3E5C76', '#7A5C99', '#B8712E', '#5B6B5E'];

@Component({
  selector: 'app-leave-setup',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './leave-setup.html',
  styleUrl: './leave-setup.css'
})
export class LeaveSetupComponent {
  private readonly api = inject(LeaveService);
  private readonly people = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly tabs: Tab[] = ['types', 'policies', 'holidays', 'approval'];
  readonly tab = signal<Tab>('types');
  readonly colors = COLORS;
  readonly approvers: ApproverType[] = ['LineManager', 'DepartmentHead', 'HR'];
  readonly accruals: AccrualMethod[] = ['Upfront', 'Monthly'];

  readonly types = signal<LeaveType[]>([]);
  readonly policies = signal<LeavePolicy[]>([]);
  readonly holidays = signal<Holiday[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly year = signal(new Date().getFullYear());
  approval: ApprovalSettings = { level1Approver: 'LineManager', level2Approver: null, autoApproveAfterDays: null, allowCancelAfterApproval: true };

  readonly drawer = signal<Drawer>(null);
  readonly saving = signal(false);
  editingId: string | null = null;
  typeForm = this.emptyType();
  policyForm = this.emptyPolicy();
  holidayForm = { date: '', name: '', locationId: null as string | null, isOptional: false };

  constructor() {
    this.loadAll();
    this.people.getLocations().subscribe({ next: l => this.locations.set(l.filter(x => x.isActive)) });
  }

  loadAll(): void {
    this.api.types(true).subscribe({ next: t => this.types.set(t), error: e => this.fail(e, 'leave.errors.load') });
    this.api.policies().subscribe({ next: p => this.policies.set(p) });
    this.api.approvalSettings().subscribe({ next: a => (this.approval = { ...a }) });
    this.loadHolidays();
  }

  loadHolidays(): void {
    this.api.holidays(this.year()).subscribe({ next: h => this.holidays.set(h) });
  }

  shiftYear(delta: number): void {
    this.year.update(y => y + delta);
    this.loadHolidays();
  }

  typeName(id: string): string {
    return this.types().find(t => t.id === id)?.name ?? '?';
  }

  // ── Types ──
  openType(t?: LeaveType): void {
    this.editingId = t?.id ?? null;
    this.typeForm = t ? { ...t } : this.emptyType();
    this.drawer.set('type');
  }

  // ── Policies ──
  openPolicy(p?: LeavePolicy): void {
    this.editingId = p?.id ?? null;
    this.policyForm = p
      ? { name: p.name, locationId: p.locationId, effectiveFrom: p.effectiveFrom, isActive: p.isActive, rules: p.rules.map(r => ({ ...r })) }
      : this.emptyPolicy();
    this.drawer.set('policy');
  }

  unusedTypes(): LeaveType[] {
    const used = new Set(this.policyForm.rules.map(r => r.leaveTypeId));
    return this.types().filter(t => t.isActive && !used.has(t.id));
  }

  addRule(typeId: string): void {
    if (!typeId) return;
    this.policyForm.rules = [...this.policyForm.rules, {
      leaveTypeId: typeId, annualEntitlement: 10, accrualMethod: 'Upfront', maxCarryForward: 0, carryForwardExpiryMonths: null,
      minServiceDays: 0, maxConsecutiveDays: null, applicableGender: null, applicableEmploymentTypes: null
    }];
  }

  removeRule(i: number): void {
    this.policyForm.rules = this.policyForm.rules.filter((_, idx) => idx !== i);
  }

  // ── Holidays ──
  openHoliday(h?: Holiday): void {
    this.editingId = h?.id ?? null;
    this.holidayForm = h ? { date: h.date, name: h.name, locationId: h.locationId, isOptional: h.isOptional } : { date: `${this.year()}-01-01`, name: '', locationId: null, isOptional: false };
    this.drawer.set('holiday');
  }

  deleteHoliday(h: Holiday): void {
    this.run(this.api.deleteHoliday(h.id), () => this.loadHolidays());
  }

  // ── Save ──
  save(): void {
    const d = this.drawer();
    const num = (v: unknown) => (v === null || v === '' || v === undefined ? null : +v);
    let req: Observable<unknown>;
    if (d === 'type') {
      const f = this.typeForm;
      req = this.api.saveType({ ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), sortOrder: +f.sortOrder }, this.editingId ?? undefined);
    } else if (d === 'policy') {
      const f = this.policyForm;
      req = this.api.savePolicy({
        ...f, name: f.name.trim(), locationId: f.locationId || null,
        rules: f.rules.map(r => ({
          leaveTypeId: r.leaveTypeId, annualEntitlement: +r.annualEntitlement, accrualMethod: r.accrualMethod,
          maxCarryForward: +r.maxCarryForward, carryForwardExpiryMonths: num(r.carryForwardExpiryMonths),
          minServiceDays: +r.minServiceDays, maxConsecutiveDays: num(r.maxConsecutiveDays),
          applicableGender: r.applicableGender || null, applicableEmploymentTypes: r.applicableEmploymentTypes || null
        }))
      }, this.editingId ?? undefined);
    } else {
      const f = this.holidayForm;
      req = this.api.saveHoliday({ ...f, name: f.name.trim(), locationId: f.locationId || null }, this.editingId ?? undefined);
    }
    this.run(req, () => {
      this.drawer.set(null);
      this.loadAll();
    });
  }

  saveApproval(): void {
    const a = this.approval;
    this.run(this.api.saveApprovalSettings({
      ...a, level2Approver: a.level2Approver || null,
      autoApproveAfterDays: a.autoApproveAfterDays === null || (a.autoApproveAfterDays as unknown) === '' ? null : +a.autoApproveAfterDays
    }), () => this.loadAll());
  }

  valid(): boolean {
    const d = this.drawer();
    if (d === 'type') return !!(this.typeForm.name.trim() && this.typeForm.code.trim());
    if (d === 'policy') return !!(this.policyForm.name.trim() && this.policyForm.effectiveFrom);
    return !!(this.holidayForm.name.trim() && this.holidayForm.date);
  }

  private run(req: Observable<unknown>, after: () => void): void {
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
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

  private emptyType(): Omit<LeaveType, 'id'> {
    return { name: '', code: '', color: COLORS[0], isPaid: true, requiresAttachment: false, allowHalfDay: true, allowNegativeBalance: false, sortOrder: 10, isActive: true };
  }

  private emptyPolicy() {
    return { name: '', locationId: null as string | null, effectiveFrom: `${new Date().getFullYear()}-01-01`, isActive: true, rules: [] as PolicyRule[] };
  }
}
