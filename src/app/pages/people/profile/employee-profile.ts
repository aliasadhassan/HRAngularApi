import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { PermissionService } from '../../../core/auth/permissions';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../people.service';
import {
  ChangeJob, Department, Designation, EmployeeDetails, EmployeeListItem, Gender, Location, MaritalStatus,
  STATUS_CHIP, UpdateProfile, initialsOf
} from '../people.models';

type Tab = 'overview' | 'job' | 'contacts';
type Drawer = 'profile' | 'job' | 'exit' | 'confirm' | null;

@Component({
  selector: 'app-employee-profile',
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './employee-profile.html',
  styleUrl: './employee-profile.css'
})
export class EmployeeProfileComponent {
  private readonly api = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly id = input.required<string>();
  readonly lang = inject(LanguageService).language;
  readonly canEdit = inject(PermissionService).hasAny('employees.edit');
  readonly chip = STATUS_CHIP;
  readonly initials = initialsOf;
  readonly genders: Gender[] = ['Male', 'Female', 'Other'];
  readonly maritals: MaritalStatus[] = ['Single', 'Married', 'Divorced', 'Widowed'];

  readonly emp = signal<EmployeeDetails | null>(null);
  readonly tab = signal<Tab>('overview');
  readonly drawer = signal<Drawer>(null);
  readonly saving = signal(false);

  readonly departments = signal<Department[]>([]);
  readonly designations = signal<Designation[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly managers = signal<EmployeeListItem[]>([]);

  profileForm!: UpdateProfile;
  jobForm!: ChangeJob;
  exitForm = { exitDate: '', reason: '' };
  confirmDate = '';

  readonly fullName = computed(() => {
    const e = this.emp();
    return e ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') : '';
  });

  /** "2 years 3 months" */
  readonly tenure = computed(() => {
    const e = this.emp();
    if (!e) return null;
    const start = new Date(e.joiningDate);
    const end = e.exitDate ? new Date(e.exitDate) : new Date();
    let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) months--;
    months = Math.max(0, months);
    return { years: Math.floor(months / 12), months: months % 12 };
  });

  readonly history = computed(() =>
    [...(this.emp()?.jobHistory ?? [])].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)));

  constructor() {
    effect(() => this.load(this.id()));
    this.api.getDepartments().subscribe({ next: d => this.departments.set(d) });
    this.api.getDesignations().subscribe({ next: d => this.designations.set(d) });
    this.api.getLocations().subscribe({ next: d => this.locations.set(d) });
  }

  load(id: string): void {
    this.api.getEmployee(id).subscribe({
      next: e => this.emp.set(e),
      error: err => this.alert.error(PayrollService.errorMessage(err, this.translate.instant('people.errors.load')))
    });
  }

  lookup(kind: 'department' | 'designation' | 'location', id: string | null): string {
    if (!id) return '—';
    if (kind === 'department') return this.departments().find(d => d.id === id)?.name ?? '—';
    if (kind === 'designation') return this.designations().find(d => d.id === id)?.title ?? '—';
    return this.locations().find(l => l.id === id)?.name ?? '—';
  }

  hasAddress(): boolean {
    const a = this.emp()?.address;
    return !!a && !!(a.line1 || a.city || a.countryCode);
  }

  addressLine(): string {
    const a = this.emp()?.address;
    return a ? [a.line1, a.line2, a.city, a.state, a.postalCode, a.countryCode].filter(Boolean).join(', ') : '';
  }

  // ───── Drawers ─────
  editProfile(): void {
    const e = this.emp()!;
    this.profileForm = {
      employeeId: e.id, firstName: e.firstName, middleName: e.middleName, lastName: e.lastName,
      gender: e.gender, dateOfBirth: e.dateOfBirth, maritalStatus: e.maritalStatus, nationalityCode: e.nationalityCode,
      personalEmail: e.personalEmail, workPhone: e.workPhone, personalPhone: e.personalPhone,
      address: { ...e.address }
    };
    this.drawer.set('profile');
  }

  changeJob(): void {
    const e = this.emp()!;
    this.jobForm = {
      employeeId: e.id, departmentId: e.department.id, locationId: e.location.id, designationId: e.designation.id,
      managerId: e.manager?.id ?? null, effectiveDate: new Date().toISOString().slice(0, 10), remarks: null
    };
    this.api.getEmployees({ page: 1, pageSize: 100 }).subscribe({ next: r => this.managers.set(r.items.filter(m => m.id !== e.id)) });
    this.drawer.set('job');
  }

  startExit(): void {
    this.exitForm = { exitDate: new Date().toISOString().slice(0, 10), reason: '' };
    this.drawer.set('exit');
  }

  startConfirm(): void {
    this.confirmDate = new Date().toISOString().slice(0, 10);
    this.drawer.set('confirm');
  }

  saveProfile(): void {
    const f = this.profileForm;
    const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    const a = f.address!;
    this.run(this.api.updateProfile({
      ...f,
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), middleName: clean(f.middleName),
      gender: f.gender || null, maritalStatus: f.maritalStatus || null, dateOfBirth: f.dateOfBirth || null,
      nationalityCode: clean(f.nationalityCode)?.toUpperCase() ?? null,
      personalEmail: clean(f.personalEmail), workPhone: clean(f.workPhone), personalPhone: clean(f.personalPhone),
      address: { line1: clean(a.line1), line2: clean(a.line2), city: clean(a.city), state: clean(a.state),
                 postalCode: clean(a.postalCode), countryCode: clean(a.countryCode)?.toUpperCase() ?? null }
    }));
  }

  saveJob(): void {
    this.run(this.api.changeJob({ ...this.jobForm, managerId: this.jobForm.managerId || null, remarks: this.jobForm.remarks?.trim() || null }));
  }

  saveExit(): void {
    if (!this.exitForm.reason.trim()) return;
    this.run(this.api.exit(this.emp()!.id, this.exitForm.exitDate, this.exitForm.reason.trim()));
  }

  saveConfirm(): void {
    this.run(this.api.confirm(this.emp()!.id, this.confirmDate));
  }

  private run(request: Observable<unknown>): void {
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.drawer.set(null);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
        this.load(this.id());
      },
      error: e => {
        this.saving.set(false);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }
}
