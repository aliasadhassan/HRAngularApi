import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/i18n/language.service';
import { P, PermissionService } from '../../../core/auth/permissions';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../people.service';
import {
  CreateEmployee, Department, Designation, EmployeeListItem, EmploymentStatus, EmploymentType, Location,
  STATUS_CHIP, initialsOf
} from '../people.models';

type Tab = '' | 'Active' | 'Probation' | 'OnNotice' | 'Exited';

@Component({
  selector: 'app-employee-directory',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './employee-directory.html',
  styleUrl: './employee-directory.css'
})
export class EmployeeDirectoryComponent {
  private readonly api = inject(PeopleService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly rtl = inject(LanguageService).isRtl;
  readonly canCreate = inject(PermissionService).hasAny('employees.create');
  readonly chip = STATUS_CHIP;
  readonly initials = initialsOf;
  readonly tabs: Tab[] = ['', 'Active', 'Probation', 'OnNotice', 'Exited'];
  readonly types: EmploymentType[] = ['FullTime', 'PartTime', 'Contract', 'Intern'];

  readonly rows = signal<EmployeeListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly tab = signal<Tab>('');
  readonly page = signal(1);
  readonly pageSize = 25;
  search = '';
  departmentId = '';
  locationId = '';
  private readonly searchChanged = new Subject<void>();

  readonly departments = signal<Department[]>([]);
  readonly designations = signal<Designation[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly managers = signal<EmployeeListItem[]>([]);

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  form: CreateEmployee = this.emptyForm();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  constructor() {
    this.searchChanged.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
    this.api.getDepartments().subscribe({ next: d => this.departments.set(d.filter(x => x.isActive)) });
    this.api.getDesignations().subscribe({ next: d => this.designations.set(d.filter(x => x.isActive)) });
    this.api.getLocations().subscribe({ next: d => this.locations.set(d.filter(x => x.isActive)) });
    this.reload();
  }

  reload(resetPage = true): void {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    const t = this.tab();
    this.api.getEmployees({
      page: this.page(), pageSize: this.pageSize, search: this.search,
      departmentId: this.departmentId || undefined, locationId: this.locationId || undefined,
      status: t as EmploymentStatus | '', includeExited: t === 'Exited'
    }).subscribe({
      next: r => {
        this.rows.set(r.items);
        this.total.set(r.totalCount);
        this.loading.set(false);
      },
      error: e => {
        this.loading.set(false);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('people.errors.load')));
      }
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.reload();
  }

  onSearch(): void {
    this.searchChanged.next();
  }

  goTo(p: number): void {
    if (p < 1 || p > this.pages()) return;
    this.page.set(p);
    this.reload(false);
  }

  open(e: EmployeeListItem): void {
    this.router.navigate(['/app/employees', e.id]);
  }

  // ───── Add employee ─────
  openNew(): void {
    this.form = this.emptyForm();
    const ho = this.locations().find(l => l.isHeadOffice) ?? this.locations()[0];
    if (ho) this.form.locationId = ho.id;
    this.api.getEmployees({ page: 1, pageSize: 100 }).subscribe({ next: r => this.managers.set(r.items) });
    this.drawerOpen.set(true);
  }

  valid(): boolean {
    const f = this.form;
    return !!(f.firstName.trim() && f.lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.workEmail.trim())
      && f.locationId && f.departmentId && f.designationId && f.joiningDate);
  }

  save(): void {
    if (!this.valid()) return;
    const f = this.form;
    this.saving.set(true);
    this.api.createEmployee({
      ...f,
      employeeCode: f.employeeCode?.trim() || null,
      firstName: f.firstName.trim(),
      middleName: f.middleName?.trim() || null,
      lastName: f.lastName.trim(),
      workEmail: f.workEmail.trim(),
      managerId: f.managerId || null,
      probationEndDate: f.probationEndDate || null
    }).subscribe({
      next: id => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.alert.success(this.translate.instant('people.added', { name: `${f.firstName} ${f.lastName}` }));
        this.router.navigate(['/app/employees', id]);
      },
      error: e => {
        this.saving.set(false);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }

  private emptyForm(): CreateEmployee {
    const today = new Date().toISOString().slice(0, 10);
    return { employeeCode: null, firstName: '', middleName: null, lastName: '', workEmail: '', locationId: '', departmentId: '',
             designationId: '', managerId: null, employmentType: 'FullTime', joiningDate: today, probationEndDate: null };
  }
}
