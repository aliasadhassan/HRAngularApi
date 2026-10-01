import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { AdminService } from '../admin.service';
import { PermissionItem, RoleItem } from '../admin.models';

interface ModuleGroup {
  module: string;
  permissions: PermissionItem[];
}

/** Naya role banate waqt ye id — backend ki koi Guid nahi */
const NEW = 'new';

@Component({
  selector: 'app-roles',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './roles.html',
  styleUrl: './roles.css'
})
export class RolesComponent {
  private readonly api = inject(AdminService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly roles = signal<RoleItem[]>([]);
  readonly catalog = signal<PermissionItem[]>([]);
  readonly loading = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly confirmDelete = signal(false);

  // Form (draft)
  name = '';
  description = '';
  readonly granted = signal<Set<number>>(new Set());

  readonly selected = computed(() => this.roles().find(r => r.id === this.selectedId()) ?? null);
  readonly isNew = computed(() => this.selectedId() === NEW);
  readonly readOnly = computed(() => !!this.selected()?.isSystem);

  /** Built-in roles ikhtiyar ke hisaab se, alphabet se nahi */
  readonly systemRoles = computed(() => {
    const order = ['Tenant Admin', 'HR Manager', 'Line Manager', 'Employee'];
    const rank = (name: string) => (order.indexOf(name) + 1 || order.length + 1);
    return this.roles().filter(r => r.isSystem).sort((a, b) => rank(a.name) - rank(b.name));
  });
  readonly customRoles = computed(() => this.roles().filter(r => !r.isSystem));

  /** Catalogue module ke hisaab se, SortOrder mein */
  readonly groups = computed<ModuleGroup[]>(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of [...this.catalog()].sort((a, b) => a.sortOrder - b.sortOrder)) {
      map.set(p.module, [...(map.get(p.module) ?? []), p]);
    }
    return [...map].map(([module, permissions]) => ({ module, permissions }));
  });

  /** Name/description plain fields hain (ngModel), is liye computed nahi — har change detection pe check */
  isDirty(): boolean {
    const role = this.selected();
    if (this.isNew()) return true;
    if (!role || role.isSystem) return false;
    const a = [...this.granted()].sort().join();
    const b = [...role.permissionIds].sort().join();
    return a !== b || this.name.trim() !== role.name || (this.description.trim() || null) !== (role.description || null);
  }

  constructor() {
    this.api.getPermissionCatalog().subscribe({ next: c => this.catalog.set(c) });
    this.load();
  }

  load(selectId?: string): void {
    this.loading.set(true);
    this.api.getRoles().subscribe({
      next: roles => {
        this.roles.set(roles);
        this.loading.set(false);
        const target = selectId ?? this.selectedId() ?? this.systemRoles()[0]?.id ?? roles[0]?.id;
        if (target && target !== NEW) this.select(roles.find(r => r.id === target) ?? roles[0]);
      },
      error: err => {
        this.loading.set(false);
        this.alert.error(this.msg(err, 'admin.errors.load'));
      }
    });
  }

  select(role: RoleItem | undefined): void {
    if (!role) return;
    this.selectedId.set(role.id);
    this.name = role.name;
    this.description = role.description ?? '';
    this.granted.set(new Set(role.permissionIds));
    this.confirmDelete.set(false);
  }

  startNew(): void {
    this.selectedId.set(NEW);
    this.name = '';
    this.description = '';
    this.granted.set(new Set());
    this.confirmDelete.set(false);
  }

  // ───── Matrix ─────
  has(id: number): boolean {
    return this.granted().has(id);
  }

  toggle(id: number): void {
    if (this.readOnly()) return;
    const next = new Set(this.granted());
    next.has(id) ? next.delete(id) : next.add(id);
    this.granted.set(next);
  }

  moduleState(group: ModuleGroup): 'all' | 'some' | 'none' {
    const on = group.permissions.filter(p => this.granted().has(p.id)).length;
    return on === 0 ? 'none' : on === group.permissions.length ? 'all' : 'some';
  }

  countOn(group: ModuleGroup): number {
    return group.permissions.filter(p => this.granted().has(p.id)).length;
  }

  toggleModule(group: ModuleGroup): void {
    if (this.readOnly()) return;
    const next = new Set(this.granted());
    const turnOn = this.moduleState(group) !== 'all';
    group.permissions.forEach(p => (turnOn ? next.add(p.id) : next.delete(p.id)));
    this.granted.set(next);
  }

  /** DB ka description English hai — Arabic ke liye translation key, na mile to DB wala text. */
  label(p: PermissionItem): string {
    const key = `perm.${p.code}`;
    const t = this.translate.instant(key);
    return t === key ? p.description ?? p.code : t;
  }

  moduleLabel(module: string): string {
    const key = `permModule.${module}`;
    const t = this.translate.instant(key);
    return t === key ? module : t;
  }

  // ───── Save / duplicate / delete ─────
  save(): void {
    if (!this.name.trim() || this.readOnly()) return;
    this.saving.set(true);
    const payload = {
      name: this.name.trim(),
      description: this.description.trim() || null,
      permissionIds: [...this.granted()]
    };
    const role = this.selected();
    const request: Observable<unknown> = this.isNew() || !role
      ? this.api.createRole(payload)
      : this.api.updateRole(role.id, payload);

    request.subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('admin.roles.saved'));
        this.load(typeof id === 'string' ? id : role?.id);
      },
      error: err => {
        this.saving.set(false);
        this.alert.error(this.msg(err, 'admin.errors.save'));
      }
    });
  }

  duplicate(): void {
    const role = this.selected();
    if (!role) return;
    const name = this.translate.instant('admin.roles.copyOf', { name: role.name }) as string;
    this.saving.set(true);
    this.api.duplicateRole(role.id, this.uniqueName(name)).subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('admin.roles.duplicated'));
        this.load(id);
      },
      error: err => {
        this.saving.set(false);
        this.alert.error(this.msg(err, 'admin.errors.save'));
      }
    });
  }

  remove(): void {
    const role = this.selected();
    if (!role || role.isSystem) return;
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    this.saving.set(true);
    this.api.deleteRole(role.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedId.set(null);
        this.alert.success(this.translate.instant('admin.roles.deleted', { name: role.name }));
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.confirmDelete.set(false);
        this.alert.error(this.msg(err, 'admin.errors.save'));
      }
    });
  }

  discard(): void {
    const role = this.selected();
    role ? this.select(role) : this.load();
  }

  private uniqueName(base: string): string {
    const taken = new Set(this.roles().map(r => r.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private msg(err: unknown, key: string): string {
    return PayrollService.errorMessage(err, this.translate.instant(key));
  }
}
