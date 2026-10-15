import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../people.service';
import { DEFAULT_PAGE_SIZE, PaginationComponent } from '../../../shared/pagination/pagination';
import { Department, Designation, EmployeeListItem, Location, SaveDepartment, SaveDesignation, SaveLocation } from '../people.models';

type Tab = 'departments' | 'designations' | 'locations';

const DAYS = [1, 2, 4, 8, 16, 32, 64];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

@Component({
  selector: 'app-organization',
  imports: [FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './organization.html',
  styleUrl: './organization.css'
})
export class OrganizationComponent {
  private readonly api = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly tabs: Tab[] = ['departments', 'designations', 'locations'];
  readonly tab = signal<Tab>('departments');
  readonly days = DAYS.map((bit, i) => ({ bit, key: DAY_KEYS[i] }));
  readonly timeZones: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'UTC'];

  readonly departments = signal<Department[]>([]);
  readonly designations = signal<Designation[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly people = signal<EmployeeListItem[]>([]);

  readonly drawer = signal<Tab | null>(null);
  readonly saving = signal(false);
  editingId: string | null = null;
  deptForm: SaveDepartment = this.emptyDept();
  desigForm: SaveDesignation = { title: '', level: null, description: null };
  locForm: SaveLocation = this.emptyLoc();

  readonly sortedDesignations = computed(() =>
    [...this.designations()].sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || a.title.localeCompare(b.title)));

  // Pagination (Employees jaisa). Lists poori aati hain (dropdowns ko bhi chahiye), page yahin katta hai.
  // Har tab ka apna page; size sab tabs ka ek.
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly pages = signal<Record<Tab, number>>({ departments: 1, designations: 1, locations: 1 });
  readonly page = computed(() => this.pages()[this.tab()]);
  readonly pagedDepartments = computed(() => this.slice(this.filteredDepartments(), this.pages().departments));
  readonly pagedDesignations = computed(() => this.slice(this.filteredDesignations(), this.pages().designations));
  readonly pagedLocations = computed(() => this.slice(this.filteredLocations(), this.pages().locations));

  // Search: har tab ka apna text (trim + lower case), client-side kyunke list poori aati hai.
  readonly queries = signal<Record<Tab, string>>({ departments: '', designations: '', locations: '' });
  readonly query = computed(() => this.queries()[this.tab()]);
  readonly filteredDepartments = computed(() => this.match(this.departments(), this.queries().departments,
    d => [d.name, d.code, d.description, d.parentName, d.headName]));
  readonly filteredDesignations = computed(() => this.match(this.sortedDesignations(), this.queries().designations,
    d => [d.title, d.description, d.level ? 'L' + d.level : null]));
  readonly filteredLocations = computed(() => this.match(this.locations(), this.queries().locations,
    l => [l.name, l.code, l.city, l.countryCode, l.timeZone]));

  constructor() {
    this.load(false);
    // Bulk import ke baad ?tab=locations waghera
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && this.tabs.includes(tab)) this.tab.set(tab);
  }

  load(refresh = true): void {
    this.api.getDepartments(refresh).subscribe({ next: d => this.departments.set(d), error: e => this.fail(e, 'people.errors.load') });
    this.api.getDesignations(refresh).subscribe({ next: d => this.designations.set(d) });
    this.api.getLocations(refresh).subscribe({ next: d => this.locations.set(d) });
  }

  setQuery(text: string): void {
    this.queries.update(q => ({ ...q, [this.tab()]: text }));
    this.setPage(1);
  }

  /** Search ke baad kitni rows bachi (pagination ke liye); tab ka badge poora count hi dikhata hai */
  shown(t: Tab): number {
    return t === 'departments' ? this.filteredDepartments().length : t === 'designations' ? this.filteredDesignations().length : this.filteredLocations().length;
  }

  private match<T>(items: T[], text: string, fields: (item: T) => (string | null | undefined)[]): T[] {
    const q = text.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => fields(item).some(f => f?.toLowerCase().includes(q)));
  }

  setPage(page: number): void {
    this.pages.update(p => ({ ...p, [this.tab()]: page }));
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.pages.set({ departments: 1, designations: 1, locations: 1 });
  }

  /** Page list se bahar ho jaye (size badla / record kam hue) to aakhri page dikhao */
  private slice<T>(items: T[], page: number): T[] {
    const size = this.pageSize();
    const last = Math.max(1, Math.ceil(items.length / size));
    const start = (Math.min(page, last) - 1) * size;
    return items.slice(start, start + size);
  }

  count(t: Tab): number {
    return t === 'departments' ? this.departments().length : t === 'designations' ? this.designations().length : this.locations().length;
  }

  // ───── Open ─────
  openDept(d?: Department): void {
    this.editingId = d?.id ?? null;
    this.deptForm = d ? { name: d.name, code: d.code, description: d.description, parentDepartmentId: d.parentDepartmentId, headEmployeeId: d.headEmployeeId } : this.emptyDept();
    this.api.getAllEmployees().subscribe({ next: list => this.people.set(list) });
    this.drawer.set('departments');
  }

  openDesig(d?: Designation): void {
    this.editingId = d?.id ?? null;
    this.desigForm = d ? { title: d.title, level: d.level, description: d.description } : { title: '', level: null, description: null };
    this.drawer.set('designations');
  }

  openLoc(l?: Location): void {
    this.editingId = l?.id ?? null;
    this.locForm = l
      ? { name: l.name, code: l.code, countryCode: l.countryCode, timeZone: l.timeZone, city: l.city, addressLine: l.addressLine, workWeekDays: l.workWeekDays, isHeadOffice: l.isHeadOffice }
      : this.emptyLoc();
    this.drawer.set('locations');
  }

  parentOptions(): Department[] {
    return this.departments().filter(d => d.id !== this.editingId && d.isActive);
  }

  workDays(mask: number): string {
    return this.days.filter(d => mask & d.bit).map(d => this.translate.instant('admin.company.daysShort.' + d.key)).join(', ');
  }

  isOn(bit: number): boolean {
    return (this.locForm.workWeekDays & bit) !== 0;
  }

  toggleDay(bit: number): void {
    const next = this.locForm.workWeekDays ^ bit;
    if (next) this.locForm = { ...this.locForm, workWeekDays: next };
  }

  // ───── Save ─────
  save(): void {
    const t = this.drawer();
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
    let request: Observable<unknown>;
    if (t === 'departments') {
      const f = this.deptForm;
      request = this.api.saveDepartment({ name: f.name.trim(), code: f.code.trim().toUpperCase(), description: clean(f.description),
        parentDepartmentId: f.parentDepartmentId || null, headEmployeeId: f.headEmployeeId || null }, this.editingId ?? undefined);
    } else if (t === 'designations') {
      const f = this.desigForm;
      request = this.api.saveDesignation({ title: f.title.trim(), level: f.level === null || (f.level as unknown) === '' ? null : +f.level,
        description: clean(f.description) }, this.editingId ?? undefined);
    } else {
      const f = this.locForm;
      request = this.api.saveLocation({ ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), countryCode: f.countryCode.trim().toUpperCase(),
        city: clean(f.city), addressLine: clean(f.addressLine) }, this.editingId ?? undefined);
    }
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.drawer.set(null);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
        this.load(true);
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  valid(): boolean {
    const t = this.drawer();
    if (t === 'departments') return !!(this.deptForm.name.trim() && this.deptForm.code.trim());
    if (t === 'designations') return !!this.desigForm.title.trim();
    return !!(this.locForm.name.trim() && this.locForm.code.trim() && this.locForm.countryCode.trim().length === 2 && this.locForm.timeZone);
  }

  private fail(e: unknown, key: string): void {
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(key)));
  }

  private emptyDept(): SaveDepartment {
    return { name: '', code: '', description: null, parentDepartmentId: null, headEmployeeId: null };
  }

  private emptyLoc(): SaveLocation {
    return { name: '', code: '', countryCode: 'PK', timeZone: 'Asia/Karachi', city: null, addressLine: null, workWeekDays: 31, isHeadOffice: false };
  }
}
