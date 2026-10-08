import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { PeopleService } from '../people/people.service';
import { addDays, todayIso } from '../lifecycle/lifecycle.models';
import { AssetsService } from './assets.service';
import {
  AFTER_RETURN, Asset, AssetAssignment, AssetCategory, AssetCondition, AssetEvent, AssetEventType, AssetListItem, AssetStatus,
  AssetSummary, CATEGORY_ICONS, CONDITIONS, EVENT_ICON, EVENT_TYPES, MyAsset, STATUSES, STATUS_CHIP
} from './assets.models';

type Tab = 'mine' | 'inventory' | 'assignments' | 'returns' | 'history';
type Drawer = 'asset' | 'edit' | 'categories';

const TABS: readonly Tab[] = ['mine', 'inventory', 'assignments', 'returns', 'history'];

interface AssetForm {
  id: string | null;
  assetTag: string;
  name: string;
  categoryId: string;
  brand: string;
  model: string;
  serialNumber: string;
  locationId: string | null;
  purchaseDate: string;
  purchaseCost: number | null;
  vendor: string;
  warrantyUntil: string;
  condition: AssetCondition;
  notes: string;
}

interface CategoryForm {
  id: string | null;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

@Component({
  selector: 'app-assets',
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './assets.html',
  styleUrl: './assets.css'
})
export class AssetsComponent {
  private readonly api = inject(AssetsService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);
  private readonly people = inject(PeopleService);

  readonly lang = inject(LanguageService).language;
  readonly statuses = STATUSES;
  readonly conditions = CONDITIONS;
  readonly eventTypes = EVENT_TYPES;
  readonly afterReturn = AFTER_RETURN;
  readonly statusChip = STATUS_CHIP;
  readonly eventIcon = EVENT_ICON;
  readonly categoryIcons = CATEGORY_ICONS;
  readonly today = todayIso();
  readonly canView = this.perms.hasAny(P.employeesView);
  readonly canManage = this.perms.hasAny(P.employeesEdit);
  readonly canEditCategories = this.perms.hasAny([P.employeesEdit, P.settingsManage]);

  readonly tab = signal<Tab>(this.canView ? 'inventory' : 'mine');
  readonly busy = signal<string | null>(null);
  readonly saving = signal(false);

  // ───── Mine ─────
  readonly mine = signal<MyAsset[] | null>(null);
  readonly myCurrent = computed(() => (this.mine() ?? []).filter(m => !m.returnedOn));
  readonly myPast = computed(() => (this.mine() ?? []).filter(m => !!m.returnedOn));
  readonly myUnconfirmed = computed(() => this.myCurrent().filter(m => !m.acknowledgedAt).length);

  // ───── HR lists ─────
  readonly summary = signal<AssetSummary | null>(null);
  readonly categories = signal<AssetCategory[] | null>(null);
  readonly activeCategories = computed(() => (this.categories() ?? []).filter(c => c.isActive));
  readonly items = signal<AssetListItem[] | null>(null);
  readonly assignments = signal<AssetAssignment[] | null>(null);
  readonly due = signal<AssetAssignment[] | null>(null);
  readonly returned = signal<AssetAssignment[] | null>(null);
  readonly events = signal<AssetEvent[] | null>(null);

  readonly status = signal<AssetStatus | ''>('');
  readonly categoryId = signal('');
  readonly search = signal('');
  readonly eventType = signal<AssetEventType | ''>('');
  readonly from = signal(addDays(todayIso(), -30));
  readonly to = signal('');
  private readonly search$ = new Subject<void>();

  // ───── Drawer ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly detail = signal<Asset | null>(null);
  readonly staff = signal<{ id: string; name: string; code: string }[]>([]);
  readonly locations = signal<{ id: string; name: string }[]>([]);
  assetForm: AssetForm | null = null;
  categoryForm: CategoryForm | null = null;
  assignForm: { employeeId: string; assignedOn: string; dueBack: string; note: string } | null = null;
  returnForm: { returnedOn: string; condition: AssetCondition; nextStatus: AssetStatus; note: string } | null = null;
  statusForm: { status: AssetStatus; note: string } | null = null;
  dueBackForm: string | null = null;
  confirm: string | null = null;
  staffSearch = '';

  constructor() {
    this.loadMine();
    if (this.canView) {
      this.loadSummary();
      this.loadCategories();
      this.loadItems();
    }

    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());

    // Dashboard / links se ?tab=returns
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && TABS.includes(tab) && (tab === 'mine' || this.canView)) this.setTab(tab);
  }

  // ───── Loading ─────
  loadMine(): void {
    this.api.mine().subscribe({ next: m => this.mine.set(m), error: () => this.mine.set([]) });
  }

  loadSummary(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
  }

  loadCategories(): void {
    this.api.categories().subscribe({ next: c => this.categories.set(c), error: () => this.categories.set([]) });
  }

  loadItems(): void {
    this.api.list(this.status(), this.categoryId(), this.search()).subscribe({
      next: r => this.items.set(r),
      error: e => {
        this.items.set([]);
        this.fail(e, 'assets.errors.load');
      }
    });
  }

  loadAssignments(): void {
    this.api.assignments('Open', this.search()).subscribe({
      next: r => this.assignments.set(r),
      error: e => {
        this.assignments.set([]);
        this.fail(e, 'assets.errors.load');
      }
    });
  }

  loadReturns(): void {
    this.api.assignments('Due', this.search()).subscribe({ next: r => this.due.set(r), error: () => this.due.set([]) });
    this.api.assignments('Returned', this.search()).subscribe({ next: r => this.returned.set(r), error: () => this.returned.set([]) });
  }

  loadHistory(): void {
    this.api.history(this.eventType(), this.search(), this.from(), this.to()).subscribe({
      next: r => this.events.set(r),
      error: e => {
        this.events.set([]);
        this.fail(e, 'assets.errors.load');
      }
    });
  }

  /** Abhi wala tab dobara load */
  reload(): void {
    switch (this.tab()) {
      case 'inventory': this.loadItems(); break;
      case 'assignments': this.loadAssignments(); break;
      case 'returns': this.loadReturns(); break;
      case 'history': this.loadHistory(); break;
      case 'mine': this.loadMine(); break;
    }
  }

  setTab(t: Tab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    this.search.set('');
    this.confirm = null;
    this.reload();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next();
  }

  setStatus(value: AssetStatus | ''): void {
    this.status.set(value);
    this.loadItems();
  }

  setCategory(value: string): void {
    this.categoryId.set(value);
    this.loadItems();
  }

  setEventType(value: AssetEventType | ''): void {
    this.eventType.set(value);
    this.loadHistory();
  }

  setRange(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
    this.loadHistory();
  }

  /** Tally click → inventory us status par */
  showStatus(s: AssetStatus | ''): void {
    this.status.set(s);
    if (this.tab() !== 'inventory') {
      this.tab.set('inventory');
      this.search.set('');
    }
    this.loadItems();
  }

  // ───── Helpers ─────
  daysTo(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const [ty, tm, td] = this.today.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  }

  /** Returns tab ki wajah: chhoda / notice / date guzar gayi / date qareeb */
  dueReason(a: AssetAssignment): 'exited' | 'leaving' | 'overdue' | 'soon' {
    if (a.employmentStatus === 'Exited') return 'exited';
    if (a.employmentStatus === 'OnNotice') return 'leaving';
    return a.dueBack && a.dueBack < this.today ? 'overdue' : 'soon';
  }

  warrantySoon(date: string | null): boolean {
    return !!date && date >= this.today && date <= addDays(this.today, 30);
  }

  describe(a: { brand: string | null; model: string | null; serialNumber: string | null }): string {
    return [a.brand, a.model].filter(Boolean).join(' ') + (a.serialNumber ? ` · ${this.translate.instant('assets.sn')} ${a.serialNumber}` : '');
  }

  // ───── Mine ─────
  acknowledge(m: MyAsset): void {
    this.busy.set(m.assignmentId);
    this.api.acknowledge(m.assignmentId).subscribe({
      next: () => {
        this.busy.set(null);
        this.alert.success(this.translate.instant('assets.msg.acknowledged', { name: m.name }));
        this.loadMine();
        if (this.canView) this.loadSummary();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  // ───── Asset drawer ─────
  /** withReturn: Returns tab se — drawer khulte hi wapsi ka form */
  open(id: string, withReturn = false): void {
    this.detail.set(null);
    this.assetForm = null;
    this.resetForms();
    this.drawer.set('asset');
    this.reloadDetail(id, withReturn && this.canManage);
  }

  private reloadDetail(id: string, withReturn = false): void {
    this.api.get(id).subscribe({
      next: a => {
        this.detail.set(a);
        if (withReturn && a.status === 'Assigned') this.startReturn();
      },
      error: e => this.fail(e, 'assets.errors.load')
    });
  }

  private resetForms(): void {
    this.assignForm = null;
    this.returnForm = null;
    this.statusForm = null;
    this.dueBackForm = null;
    this.confirm = null;
  }

  readonly holder = computed(() => this.detail()?.assignments.find(a => !a.returnedOn) ?? null);
  readonly pastAssignments = computed(() => (this.detail()?.assignments ?? []).filter(a => !!a.returnedOn));

  startAssign(): void {
    this.resetForms();
    this.staffSearch = '';
    this.assignForm = { employeeId: '', assignedOn: this.today, dueBack: '', note: '' };
    this.ensureStaff();
  }

  filteredStaff(): { id: string; name: string; code: string }[] {
    const q = this.staffSearch.trim().toLowerCase();
    const list = this.staff();
    return q ? list.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) : list;
  }

  saveAssign(): void {
    const a = this.detail();
    const f = this.assignForm;
    if (!a || !f || !f.employeeId || !f.assignedOn || (f.dueBack && f.dueBack < f.assignedOn)) return;
    const name = this.staff().find(p => p.id === f.employeeId)?.name ?? '';
    this.submit(this.api.assign(a.id, { employeeId: f.employeeId, assignedOn: f.assignedOn, dueBack: f.dueBack || null, note: f.note.trim() || null }),
      'assets.msg.assigned', { tag: a.assetTag, name });
  }

  startReturn(): void {
    const a = this.detail();
    if (!a) return;
    this.resetForms();
    this.returnForm = { returnedOn: this.today, condition: a.condition, nextStatus: 'Available', note: '' };
  }

  /** Damaged wapis aaye to default "in repair" */
  onReturnCondition(c: AssetCondition): void {
    if (!this.returnForm) return;
    this.returnForm.condition = c;
    if (c === 'Damaged' && this.returnForm.nextStatus === 'Available') this.returnForm.nextStatus = 'InRepair';
  }

  canReturn(): boolean {
    const f = this.returnForm;
    const h = this.holder();
    return !!f && !!h && !!f.returnedOn && f.returnedOn >= h.assignedOn && (f.nextStatus !== 'Lost' || !!f.note.trim());
  }

  saveReturn(): void {
    const a = this.detail();
    const f = this.returnForm;
    if (!a || !f || !this.canReturn()) return;
    this.submit(this.api.returnAsset(a.id, { returnedOn: f.returnedOn, condition: f.condition, nextStatus: f.nextStatus, note: f.note.trim() || null }),
      'assets.msg.returned', { tag: a.assetTag });
  }

  saveDueBack(): void {
    const a = this.detail();
    if (!a || this.dueBackForm === null) return;
    this.submit(this.api.dueBack(a.id, this.dueBackForm || null), 'assets.msg.saved');
  }

  /** Status menu: assigned na ho to repair / available / retire / lost */
  statusOptions(a: Asset): AssetStatus[] {
    return STATUSES.filter(s => s !== 'Assigned' && s !== a.status);
  }

  startStatus(s: AssetStatus): void {
    this.resetForms();
    this.statusForm = { status: s, note: '' };
  }

  needsNote(s: AssetStatus): boolean {
    return s === 'Retired' || s === 'Lost';
  }

  saveStatus(): void {
    const a = this.detail();
    const f = this.statusForm;
    if (!a || !f || (this.needsNote(f.status) && !f.note.trim())) return;
    this.submit(this.api.setStatus(a.id, f.status, f.note.trim() || null), 'assets.msg.statusChanged', {
      tag: a.assetTag, status: this.translate.instant('assets.status.' + f.status)
    });
  }

  removeAsset(): void {
    const a = this.detail();
    if (!a) return;
    if (this.confirm !== 'delete') {
      this.confirm = 'delete';
      return;
    }
    this.saving.set(true);
    this.api.remove(a.id).subscribe({
      next: () => this.done('assets.msg.deleted', { tag: a.assetTag }),
      error: e => this.fail(e)
    });
  }

  // ───── Add / edit asset ─────
  openNew(): void {
    this.assetForm = {
      id: null, assetTag: '', name: '', categoryId: this.categoryId() || (this.activeCategories()[0]?.id ?? ''), brand: '', model: '',
      serialNumber: '', locationId: null, purchaseDate: '', purchaseCost: null, vendor: '', warrantyUntil: '', condition: 'New', notes: ''
    };
    this.confirm = null;
    this.drawer.set('edit');
    this.ensureLocations();
    this.tagHint = '';
    this.api.nextTag().subscribe({ next: t => (this.tagHint = t), error: () => undefined });
  }

  /** Khali tag = server agla AST-000N dega */
  tagHint = '';

  edit(): void {
    const a = this.detail();
    if (!a) return;
    this.assetForm = {
      id: a.id, assetTag: a.assetTag, name: a.name, categoryId: a.categoryId, brand: a.brand ?? '', model: a.model ?? '',
      serialNumber: a.serialNumber ?? '', locationId: a.locationId, purchaseDate: a.purchaseDate ?? '', purchaseCost: a.purchaseCost,
      vendor: a.vendor ?? '', warrantyUntil: a.warrantyUntil ?? '', condition: a.condition, notes: a.notes ?? ''
    };
    this.confirm = null;
    this.drawer.set('edit');
    this.ensureLocations();
  }

  /** Edit mein purani (inactive) category bhi list mein rahe */
  formCategories(): AssetCategory[] {
    const f = this.assetForm;
    return (this.categories() ?? []).filter(c => c.isActive || c.id === f?.categoryId);
  }

  canSaveAsset(): boolean {
    const f = this.assetForm;
    return !!f && !!f.name.trim() && !!f.categoryId && (f.purchaseCost === null || f.purchaseCost >= 0)
      && (!f.warrantyUntil || !f.purchaseDate || f.warrantyUntil >= f.purchaseDate);
  }

  saveAsset(): void {
    const f = this.assetForm;
    if (!f || !this.canSaveAsset()) return;
    this.saving.set(true);
    const isNew = !f.id;
    this.api.save(f.id, {
      assetTag: f.assetTag.trim() || null, name: f.name.trim(), categoryId: f.categoryId, brand: f.brand.trim() || null,
      model: f.model.trim() || null, serialNumber: f.serialNumber.trim() || null, locationId: f.locationId || null,
      purchaseDate: f.purchaseDate || null, purchaseCost: f.purchaseCost ?? null, vendor: f.vendor.trim() || null,
      warrantyUntil: f.warrantyUntil || null, condition: f.condition, notes: f.notes.trim() || null
    }).subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(isNew ? 'assets.msg.created' : 'assets.msg.saved'));
        this.assetForm = null;
        this.refreshLists();
        this.open(id);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Categories ─────
  openCategories(): void {
    this.categoryForm = null;
    this.confirm = null;
    this.drawer.set('categories');
    this.loadCategories();
  }

  newCategory(): void {
    this.categoryForm = { id: null, name: '', description: '', icon: 'inventory_2', isActive: true };
  }

  editCategory(c: AssetCategory): void {
    this.categoryForm = { id: c.id, name: c.name, description: c.description ?? '', icon: c.icon ?? '', isActive: c.isActive };
    this.confirm = null;
  }

  saveCategory(): void {
    const f = this.categoryForm;
    if (!f || !f.name.trim()) return;
    this.saving.set(true);
    this.api.saveCategory(f.id, { name: f.name.trim(), description: f.description.trim() || null, icon: f.icon || null, isActive: f.isActive }).subscribe({
      next: () => {
        this.saving.set(false);
        this.categoryForm = null;
        this.alert.success(this.translate.instant('assets.msg.categorySaved'));
        this.loadCategories();
      },
      error: e => this.fail(e)
    });
  }

  deleteCategory(): void {
    const f = this.categoryForm;
    if (!f?.id) return;
    if (this.confirm !== 'deleteCategory') {
      this.confirm = 'deleteCategory';
      return;
    }
    this.saving.set(true);
    this.api.deleteCategory(f.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.categoryForm = null;
        this.confirm = null;
        this.alert.success(this.translate.instant('assets.msg.categoryDeleted'));
        this.loadCategories();
      },
      error: e => this.fail(e)
    });
  }

  createStarter(): void {
    this.saving.set(true);
    this.api.starter().subscribe({
      next: n => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('assets.msg.starterCreated', { n }));
        this.loadCategories();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Plumbing ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.detail.set(null);
    this.assetForm = null;
    this.categoryForm = null;
    this.resetForms();
  }

  private ensureStaff(): void {
    if (this.staff().length) return;
    this.people.getEmployees({ page: 1, pageSize: 200 }).subscribe({
      next: r => this.staff.set(r.items.filter(e => e.employmentStatus !== 'Exited').map(e => ({ id: e.id, name: e.fullName, code: e.employeeCode }))),
      error: () => undefined
    });
  }

  private ensureLocations(): void {
    if (this.locations().length) return;
    this.people.getLocations().subscribe({ next: l => this.locations.set(l.map(x => ({ id: x.id, name: x.name }))), error: () => undefined });
  }

  private submit(req: ReturnType<AssetsService['remove']>, key: string, params?: Record<string, string>): void {
    const a = this.detail();
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForms();
        this.alert.success(this.translate.instant(key, params));
        if (a) this.reloadDetail(a.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  private refreshLists(): void {
    if (this.canView) {
      this.loadSummary();
      this.reload();
      if (this.drawer() === 'categories' || !this.categories()) this.loadCategories();
    }
    if (this.tab() !== 'mine') this.loadMine();
  }

  private done(key: string, params?: Record<string, string>): void {
    this.saving.set(false);
    this.closeDrawer();
    this.alert.success(this.translate.instant(key, params));
    this.refreshLists();
  }

  private fail(e: unknown, fallback = 'assets.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
