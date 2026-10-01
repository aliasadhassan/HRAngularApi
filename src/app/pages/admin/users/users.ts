import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { AdminService, UserAction } from '../admin.service';
import { AssignableRole, USER_STATUS_CHIP, UserCounts, UserListItem, UserStatus, initials, utc } from '../admin.models';

type DrawerMode = 'invite' | 'edit' | null;
type ConfirmAction = Extract<UserAction, 'deactivate' | 'revoke-sessions'>;

@Component({
  selector: 'app-users',
  imports: [FormsModule, TranslatePipe, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class UsersComponent {
  private readonly api = inject(AdminService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly statusChip = USER_STATUS_CHIP;
  readonly initials = initials;
  readonly tabs: (UserStatus | '')[] = ['', 'Active', 'Invited', 'Locked', 'Disabled'];

  // List
  readonly users = signal<UserListItem[]>([]);
  readonly total = signal(0);
  readonly counts = signal<UserCounts | null>(null);
  readonly roles = signal<AssignableRole[]>([]);
  readonly loading = signal(true);
  readonly status = signal<UserStatus | ''>('');
  readonly page = signal(1);
  readonly pageSize = 20;
  search = '';
  roleId = '';
  private readonly searchChanged = new Subject<void>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly rangeFrom = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize + 1));
  readonly rangeTo = computed(() => Math.min(this.page() * this.pageSize, this.total()));

  // Drawer
  readonly drawer = signal<DrawerMode>(null);
  readonly editing = signal<UserListItem | null>(null);
  readonly saving = signal(false);
  readonly busyAction = signal<UserAction | null>(null);
  readonly confirm = signal<ConfirmAction | null>(null);
  formEmail = '';
  formName = '';
  formRoles = new Set<string>();

  constructor() {
    this.searchChanged.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
    this.api.getAssignableRoles().subscribe({ next: r => this.roles.set(r) });
    this.reload();
  }

  // ───────── List ─────────
  reload(resetPage = true): void {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    this.api
      .getUsers({ search: this.search, status: this.status(), roleId: this.roleId, page: this.page(), pageSize: this.pageSize })
      .subscribe({
        next: res => {
          this.users.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: err => {
          this.loading.set(false);
          this.alert.error(this.message(err, 'admin.errors.load'));
        }
      });
    this.api.getCounts().subscribe({ next: c => this.counts.set(c) });
  }

  onSearch(): void {
    this.searchChanged.next();
  }

  setStatus(status: UserStatus | ''): void {
    this.status.set(status);
    this.reload();
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page.set(page);
    this.reload(false);
  }

  countFor(tab: UserStatus | ''): number | null {
    const c = this.counts();
    if (!c) return null;
    return tab === '' ? c.all : c[tab.toLowerCase() as keyof UserCounts];
  }

  lastSeen(user: UserListItem): { key: string; params?: Record<string, number> } {
    const date = utc(user.lastLoginAt);
    if (!date) return { key: 'admin.users.never' };
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 2) return { key: 'admin.users.justNow' };
    if (minutes < 60) return { key: 'admin.users.minutesAgo', params: { n: minutes } };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { key: 'admin.users.hoursAgo', params: { n: hours } };
    const days = Math.floor(hours / 24);
    if (days === 1) return { key: 'admin.users.yesterday' };
    if (days < 30) return { key: 'admin.users.daysAgo', params: { n: days } };
    return { key: 'admin.users.monthsAgo', params: { n: Math.floor(days / 30) } };
  }

  // ───────── Drawer ─────────
  openInvite(): void {
    this.formEmail = '';
    this.formName = '';
    const employee = this.roles().find(r => r.name === 'Employee');
    this.formRoles = new Set(employee ? [employee.id] : []);
    this.editing.set(null);
    this.drawer.set('invite');
  }

  openEdit(user: UserListItem): void {
    this.formEmail = user.email;
    this.formName = user.displayName;
    this.formRoles = new Set(user.roles.map(r => r.id));
    this.editing.set(user);
    this.drawer.set('edit');
  }

  closeDrawer(): void {
    if (this.saving() || this.busyAction()) return;
    this.drawer.set(null);
    this.confirm.set(null);
  }

  toggleRole(id: string): void {
    const next = new Set(this.formRoles);
    next.has(id) ? next.delete(id) : next.add(id);
    this.formRoles = next;
  }

  get formValid(): boolean {
    const emailOk = this.drawer() === 'edit' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formEmail.trim());
    return emailOk && this.formName.trim().length > 0 && this.formRoles.size > 0;
  }

  save(): void {
    if (!this.formValid) return;
    this.saving.set(true);
    const roleIds = [...this.formRoles];
    const user = this.editing();

    const request: Observable<unknown> = user
      ? this.api.update(user.id, this.formName.trim(), roleIds)
      : this.api.invite(this.formEmail.trim(), this.formName.trim(), roleIds);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.drawer.set(null);
        this.alert.success(
          this.translate.instant(user ? 'admin.users.saved' : 'admin.users.invited', { email: this.formEmail.trim() })
        );
        this.reload(false);
      },
      error: err => {
        this.saving.set(false);
        this.alert.error(this.message(err, 'admin.errors.save'));
      }
    });
  }

  run(action: UserAction): void {
    const user = this.editing();
    if (!user) return;

    if ((action === 'deactivate' || action === 'revoke-sessions') && this.confirm() !== action) {
      this.confirm.set(action);
      return;
    }

    this.busyAction.set(action);
    this.api.action(user.id, action).subscribe({
      next: () => {
        this.busyAction.set(null);
        this.confirm.set(null);
        this.alert.success(this.translate.instant(`admin.users.done.${action}`, { name: user.displayName }));
        this.drawer.set(null);
        this.reload(false);
      },
      error: err => {
        this.busyAction.set(null);
        this.confirm.set(null);
        this.alert.error(this.message(err, 'admin.errors.save'));
      }
    });
  }

  private message(err: unknown, fallbackKey: string): string {
    return PayrollService.errorMessage(err, this.translate.instant(fallbackKey));
  }
}
