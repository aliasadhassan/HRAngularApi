import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { utc } from '../admin/admin.models';
import { RequestsService } from './requests.service';
import {
  Activity, Category, HelpdeskSummary, Lookups, PRIORITIES, PRIORITY_CHIP, RATINGS, STATUSES, STATUS_CHIP, Ticket, TicketListItem,
  TicketPriority, TicketStatus, isActive, isFinal, isHttpLink, isIconName
} from './requests.models';

type Tab = 'mine' | 'approvals' | 'queue' | 'categories';
type Drawer = 'ticket' | 'ticketEdit' | 'category';
type TicketAction = 'reject' | 'approve' | 'wait' | 'resolve' | 'reopen' | 'cancel' | 'confirm';

const KIND_ICON: Record<string, string> = {
  Created: 'add_circle', Status: 'sync_alt', Assigned: 'person', Approved: 'check_circle', Rejected: 'cancel', Rated: 'star'
};

const TABS: readonly Tab[] = ['mine', 'approvals', 'queue', 'categories'];

/** Dusre modules ke approvals (leave, attendance, loans) — sirf link, faisla unke apne page par. */
interface OtherApproval {
  id: string;
  icon: string;
  person: string | null;
  titleKey: string;
  params: Record<string, string | number>;
  link: string;
  queryParams?: Record<string, string>;
}

interface TicketForm {
  id: string | null;
  categoryId: string;
  subject: string;
  description: string;
  link: string;
  priority: TicketPriority;
  employeeId: string;
}

interface CategoryForm {
  id: string | null;
  name: string;
  description: string;
  icon: string;
  needsManagerApproval: boolean;
  isConfidential: boolean;
  resolutionHours: number | null;
  defaultAssigneeEmployeeId: string;
  sortOrder: number;
  isActive: boolean;
}

@Component({
  selector: 'app-requests',
  imports: [DatePipe, DecimalPipe, FormsModule, NgTemplateOutlet, RouterLink, TranslatePipe],
  templateUrl: './requests.html',
  styleUrl: './requests.css'
})
export class RequestsComponent {
  private readonly api = inject(RequestsService);
  private readonly dashboards = inject(DashboardService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly permissions = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly ratings = RATINGS;
  readonly statusChip = STATUS_CHIP;
  readonly priorityChip = PRIORITY_CHIP;
  readonly isFinal = isFinal;
  readonly isActive = isActive;
  readonly kindIcon = KIND_ICON;

  readonly tab = signal<Tab>('mine');
  readonly saving = signal(false);

  readonly summary = signal<HelpdeskSummary | null>(null);
  readonly lookups = signal<Lookups>({ categories: [], people: [] });

  readonly isAgent = computed(() => this.summary()?.isAgent ?? false);
  readonly canViewQueue = computed(() => this.summary()?.canViewQueue ?? false);
  readonly canConfigure = computed(() => this.summary()?.canConfigure ?? false);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);

  // ───── Lists ─────
  readonly mine = signal<TicketListItem[] | null>(null);
  readonly approvals = signal<TicketListItem[] | null>(null);
  readonly queue = signal<TicketListItem[] | null>(null);
  readonly categories = signal<Category[] | null>(null);
  readonly others = signal<OtherApproval[]>([]);

  readonly mineOpen = computed(() => (this.mine() ?? []).filter(t => !isFinal(t.status)));
  readonly mineClosed = computed(() => (this.mine() ?? []).filter(t => isFinal(t.status)));
  readonly pendingApprovals = computed(() => (this.approvals() ?? []).filter(t => t.status === 'PendingApproval'));
  readonly decidedApprovals = computed(() => (this.approvals() ?? []).filter(t => t.status !== 'PendingApproval').slice(0, 20));
  readonly showApprovals = computed(() => (this.summary()?.awaitingMyApproval ?? 0) > 0 || (this.approvals()?.length ?? 0) > 0 || this.others().length > 0);
  readonly showClosed = signal(false);

  readonly search = signal('');
  readonly status = signal<TicketStatus | ''>('');
  readonly activeOnly = signal(true);
  readonly categoryId = signal('');
  readonly assignee = signal('');
  private readonly search$ = new Subject<void>();

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly ticket = signal<Ticket | null>(null);
  ticketForm: TicketForm | null = null;
  categoryForm: CategoryForm | null = null;
  action: TicketAction | null = null;
  actionNote = '';
  actionRating: number | null = null;
  comment = '';
  internal = false;
  assignTo = '';
  confirm: string | null = null;

  readonly pickedCategory = computed(() => this.lookups().categories.find(c => c.id === this.ticketForm?.categoryId) ?? null);

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadQueue());
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
    this.loadOthers();

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const ticketId = route.get('ticket');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        this.loadMine();
        this.loadApprovals();
        let start: Tab = s.myEmployeeId || !s.canViewQueue ? 'mine' : 'queue';
        if (s.awaitingMyApproval > 0) start = 'approvals';
        if (wanted && TABS.includes(wanted) && this.tabAllowed(wanted)) start = wanted;
        this.setTab(start);
        if (ticketId) this.openTicket(ticketId);
      },
      error: e => this.fail(e, 'requests.errors.load')
    });
  }

  tabAllowed(t: Tab): boolean {
    switch (t) {
      case 'queue': return this.canViewQueue();
      case 'categories': return this.canConfigure();
      default: return true;
    }
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'queue' && this.queue() === null) this.loadQueue();
    if (t === 'categories' && this.categories() === null) this.loadCategories();
  }

  // ───── Loading ─────
  loadMine(): void {
    this.api.tickets({ scope: 'Mine', status: '', active: false, categoryId: '', assignee: '', search: '' })
      .subscribe({ next: l => this.mine.set(l), error: () => this.mine.set([]) });
  }

  loadApprovals(): void {
    this.api.tickets({ scope: 'Approvals', status: '', active: false, categoryId: '', assignee: '', search: '' })
      .subscribe({ next: l => this.approvals.set(l), error: () => this.approvals.set([]) });
  }

  loadQueue(): void {
    if (!this.canViewQueue()) return;
    this.api.tickets({
      scope: 'Queue', status: this.status(), active: !this.status() && this.activeOnly(), categoryId: this.categoryId(),
      assignee: this.assignee(), search: this.search()
    }).subscribe({ next: l => this.queue.set(l), error: () => this.queue.set([]) });
  }

  loadCategories(): void {
    this.api.categories().subscribe({ next: c => this.categories.set(c), error: () => this.categories.set([]) });
  }

  /** Leave / attendance (Employee API) aur loans (Payroll API) jo mere faisle ke muntazir hain. */
  private loadOthers(): void {
    const people$ = this.dashboards.people().pipe(catchError(() => of(null)));
    const pay$ = this.permissions.hasAny([P.payrollViewAll, P.payrollApprove])
      ? this.dashboards.payroll().pipe(catchError(() => of(null)))
      : of(null);
    people$.subscribe(p => {
      const list: OtherApproval[] = [];
      for (const t of p?.tasks ?? []) {
        if (t.kind === 'Leave')
          list.push({ id: t.id, icon: 'event_busy', person: t.employeeName, titleKey: 'requests.other.leave',
            params: { type: t.detail ?? '', days: t.days ?? 0 }, link: '/app/leaves', queryParams: { tab: 'approvals' } });
        else if (t.kind === 'AttendanceRequest')
          list.push({ id: t.id, icon: 'schedule', person: t.employeeName, titleKey: 'requests.other.attendance',
            params: { type: this.translate.instant(`attendance.requestType.${t.requestType}`) },
            link: '/app/attendance', queryParams: { tab: t.requestType === 'Overtime' ? 'overtime' : 'requests' } });
      }
      this.others.update(o => [...o.filter(x => x.icon === 'account_balance_wallet' || x.icon === 'receipt_long'), ...list]);
    });
    pay$.subscribe(p => {
      const list: OtherApproval[] = [];
      for (const t of p?.tasks ?? []) {
        if (t.kind === 'runApproval')
          list.push({ id: t.id, icon: 'receipt_long', person: null, titleKey: 'requests.other.payroll', params: { count: t.count ?? 0 },
            link: `/app/payroll/runs/${t.id}` });
        else
          list.push({ id: t.id, icon: 'account_balance_wallet', person: t.employeeName,
            titleKey: t.kind === 'advanceRequest' ? 'requests.other.advance' : 'requests.other.loan',
            params: { amount: `${t.currencyCode ?? ''} ${new Intl.NumberFormat(this.lang()).format(t.amount ?? 0)}`.trim() },
            link: '/app/payroll/loans', queryParams: { tab: 'requests' } });
      }
      this.others.update(o => [...list, ...o.filter(x => x.icon !== 'account_balance_wallet' && x.icon !== 'receipt_long')]);
    });
  }

  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    this.loadMine();
    this.loadApprovals();
    if (this.queue() !== null) this.loadQueue();
    if (this.categories() !== null) this.loadCategories();
  }

  // ───── Queue filters ─────
  onSearch(v: string): void {
    this.search.set(v);
    this.search$.next();
  }

  setStatus(v: TicketStatus | ''): void {
    this.status.set(v);
    this.loadQueue();
  }

  setActiveOnly(v: boolean): void {
    this.activeOnly.set(v);
    this.loadQueue();
  }

  setCategory(v: string): void {
    this.categoryId.set(v);
    this.loadQueue();
  }

  setAssignee(v: string): void {
    this.assignee.set(v);
    this.loadQueue();
  }

  /** Tally se queue filter. */
  showQueue(assignee: string, overdue = false): void {
    this.assignee.set(assignee);
    this.status.set('');
    this.activeOnly.set(true);
    this.search.set(overdue ? '' : this.search());
    this.overdueOnly.set(overdue);
    this.setTab('queue');
    this.loadQueue();
  }

  readonly overdueOnly = signal(false);
  readonly queueRows = computed(() => (this.queue() ?? []).filter(t => !this.overdueOnly() || t.isOverdue));

  // ───── Ticket drawer ─────
  openTicket(id: string): void {
    this.ticket.set(null);
    this.resetActions();
    this.drawer.set('ticket');
    this.api.ticket(id).subscribe({
      next: t => {
        this.ticket.set(t);
        this.assignTo = t.ticket.assigneeEmployeeId ?? '';
      },
      error: e => {
        this.closeDrawer();
        this.fail(e, 'requests.errors.load');
      }
    });
  }

  private reloadTicket(): void {
    const t = this.ticket();
    if (!t) return;
    this.api.ticket(t.ticket.id).subscribe({ next: x => { this.ticket.set(x); this.assignTo = x.ticket.assigneeEmployeeId ?? ''; }, error: () => undefined });
  }

  private resetActions(): void {
    this.action = null;
    this.actionNote = '';
    this.actionRating = null;
    this.comment = '';
    this.internal = false;
    this.confirm = null;
  }

  startAction(a: TicketAction): void {
    this.action = a;
    this.actionNote = '';
    this.actionRating = null;
  }

  needsNote(a: TicketAction | null): boolean {
    return a === 'reject' || a === 'wait' || a === 'resolve' || a === 'reopen';
  }

  runAction(): void {
    const t = this.ticket();
    const a = this.action;
    if (!t || !a) return;
    const note = this.actionNote.trim();
    if (this.needsNote(a) && !note) return;
    const id = t.ticket.id;
    const name = t.ticket.employeeName;
    let call$: Observable<void>;
    let msg: string;
    switch (a) {
      case 'approve': call$ = this.api.approve(id, note || null); msg = 'requests.msg.approved'; break;
      case 'reject': call$ = this.api.reject(id, note); msg = 'requests.msg.rejected'; break;
      case 'wait': call$ = this.api.setStatus(id, 'WaitingOnEmployee', note); msg = 'requests.msg.asked'; break;
      case 'resolve': call$ = this.api.setStatus(id, 'Resolved', note); msg = 'requests.msg.resolved'; break;
      case 'reopen': call$ = this.api.reopen(id, note); msg = 'requests.msg.reopened'; break;
      case 'cancel': call$ = this.api.cancel(id, note || null); msg = 'requests.msg.cancelled'; break;
      case 'confirm': call$ = this.api.confirm(id, this.actionRating); msg = 'requests.msg.closed'; break;
    }
    this.submit(call$, msg, { name, code: t.ticket.code });
  }

  setTicketStatus(status: TicketStatus): void {
    const t = this.ticket();
    if (!t) return;
    this.submit(this.api.setStatus(t.ticket.id, status, null), status === 'Closed' ? 'requests.msg.closed' : 'requests.msg.started', { name: t.ticket.employeeName, code: t.ticket.code });
  }

  assign(toMe = false): void {
    const t = this.ticket();
    if (!t) return;
    const who = toMe ? this.summary()?.myEmployeeId ?? null : this.assignTo || null;
    const name = who ? this.personName(who) : '';
    this.submit(this.api.assign(t.ticket.id, who), who ? 'requests.msg.assigned' : 'requests.msg.unassigned', { code: t.ticket.code, name });
  }

  rate(n: number): void {
    const t = this.ticket();
    if (!t || !t.canRate || t.ticket.status !== 'Closed') return;
    this.submit(this.api.rate(t.ticket.id, n), 'requests.msg.rated', {}, false);
  }

  sendComment(): void {
    const t = this.ticket();
    const body = this.comment.trim();
    if (!t || !body) return;
    this.submit(this.api.comment(t.ticket.id, body, this.internal), this.internal ? 'requests.msg.noteAdded' : 'requests.msg.commented', {}, false);
  }

  /** Approvals list se seedha haan (wajah ke bina). */
  quickApprove(t: TicketListItem): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.approve(t.id, null).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('requests.msg.approved', { name: t.employeeName, code: t.code }));
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  private submit(call$: Observable<void>, key: string, params: Record<string, string>, toast = true): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.saving.set(false);
        if (toast) this.alert.success(this.translate.instant(key, params));
        this.resetActions();
        this.reloadTicket();
        this.refresh();
      },
      error: e => this.fail(e)
    });
  }

  visibleActivities(t: Ticket): Activity[] {
    return t.activities;
  }

  /** Timeline line ka key; Assigned/Rated ka note (naam / number) line ke andar jata hai. */
  eventKey(a: Activity): string {
    return a.kind === 'Assigned' && !a.note ? 'requests.kind.Unassigned' : `requests.kind.${a.kind}`;
  }

  eventNote(a: Activity): string | null {
    return a.kind === 'Assigned' || a.kind === 'Rated' ? null : a.note;
  }

  chipOf(t: TicketListItem): string {
    return STATUS_CHIP[t.status];
  }

  isConversation(a: Activity): boolean {
    return a.kind === 'Comment' || a.kind === 'InternalNote';
  }

  // ───── New / edit ticket ─────
  newTicket(categoryId = ''): void {
    this.ticketForm = { id: null, categoryId, subject: '', description: '', link: '', priority: 'Normal', employeeId: '' };
    this.ticket.set(null);
    this.drawer.set('ticketEdit');
  }

  editTicket(): void {
    const t = this.ticket();
    if (!t) return;
    this.ticketForm = {
      id: t.ticket.id, categoryId: t.ticket.categoryId, subject: t.ticket.subject, description: t.description ?? '', link: t.link ?? '',
      priority: t.ticket.priority, employeeId: t.ticket.employeeId
    };
    this.drawer.set('ticketEdit');
  }

  pickCategory(id: string): void {
    if (this.ticketForm) this.ticketForm.categoryId = id;
  }

  linkOk(v: string): boolean {
    return isHttpLink(v);
  }

  canSaveTicket(): boolean {
    const f = this.ticketForm;
    return !!f && !!f.categoryId && !!f.subject.trim() && isHttpLink(f.link) && (this.linked() || !!f.employeeId || !!f.id);
  }

  saveTicket(): void {
    const f = this.ticketForm;
    if (!f || !this.canSaveTicket()) return;
    const body = {
      categoryId: f.categoryId, subject: f.subject.trim(), description: f.description.trim() || null, link: f.link.trim() || null,
      priority: f.priority, employeeId: f.employeeId || null
    };
    this.saving.set(true);
    if (f.id) {
      const id = f.id;
      this.api.update(id, body).subscribe({
        next: () => {
          this.saving.set(false);
          this.alert.success(this.translate.instant('requests.msg.saved'));
          this.refresh();
          this.openTicket(id);
        },
        error: e => this.fail(e)
      });
    } else {
      const cat = this.pickedCategory();
      this.api.create(body).subscribe({
        next: id => {
          this.saving.set(false);
          this.alert.success(this.translate.instant(cat?.needsManagerApproval && !f.employeeId ? 'requests.msg.createdApproval' : 'requests.msg.created'));
          this.refresh();
          this.openTicket(id);
        },
        error: e => this.fail(e)
      });
    }
  }

  // ───── Categories ─────
  newCategory(): void {
    const next = Math.max(0, ...(this.categories() ?? []).map(c => c.sortOrder)) + 10;
    this.categoryForm = {
      id: null, name: '', description: '', icon: '', needsManagerApproval: false, isConfidential: false, resolutionHours: 48,
      defaultAssigneeEmployeeId: '', sortOrder: Math.min(next, 999), isActive: true
    };
    this.confirm = null;
    this.drawer.set('category');
  }

  editCategory(c: Category): void {
    this.categoryForm = {
      id: c.id, name: c.name, description: c.description ?? '', icon: c.icon ?? '', needsManagerApproval: c.needsManagerApproval,
      isConfidential: c.isConfidential, resolutionHours: c.resolutionHours, defaultAssigneeEmployeeId: c.defaultAssigneeEmployeeId ?? '',
      sortOrder: c.sortOrder, isActive: c.isActive
    };
    this.confirm = null;
    this.drawer.set('category');
  }

  editingCategory(): Category | null {
    const id = this.categoryForm?.id;
    return id ? (this.categories() ?? []).find(c => c.id === id) ?? null : null;
  }

  iconOk(v: string): boolean {
    return isIconName(v);
  }

  setConfidential(v: boolean): void {
    if (!this.categoryForm) return;
    this.categoryForm.isConfidential = v;
    if (v) this.categoryForm.needsManagerApproval = false;
  }

  canSaveCategory(): boolean {
    const f = this.categoryForm;
    return !!f && !!f.name.trim() && isIconName(f.icon) && (f.resolutionHours === null || (f.resolutionHours >= 1 && f.resolutionHours <= 2000))
      && f.sortOrder >= 0 && f.sortOrder <= 999;
  }

  saveCategory(): void {
    const f = this.categoryForm;
    if (!f || !this.canSaveCategory()) return;
    const body = {
      name: f.name.trim(), description: f.description.trim() || null, icon: f.icon.trim() || null, needsManagerApproval: f.needsManagerApproval,
      isConfidential: f.isConfidential, resolutionHours: f.resolutionHours || null, defaultAssigneeEmployeeId: f.defaultAssigneeEmployeeId || null,
      sortOrder: f.sortOrder, isActive: f.isActive
    };
    this.saving.set(true);
    const call$: Observable<unknown> = f.id ? this.api.updateCategory(f.id, body) : this.api.createCategory(body);
    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('requests.msg.categorySaved', { name: body.name }));
        this.closeDrawer();
        this.afterCategoryChange();
      },
      error: e => this.fail(e)
    });
  }

  deleteCategory(): void {
    const c = this.editingCategory();
    if (!c) return;
    if (this.confirm !== 'delete') {
      this.confirm = 'delete';
      return;
    }
    this.saving.set(true);
    this.api.deleteCategory(c.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('requests.msg.categoryDeleted', { name: c.name }));
        this.closeDrawer();
        this.afterCategoryChange();
      },
      error: e => this.fail(e)
    });
  }

  addDefaults(): void {
    this.saving.set(true);
    this.api.addDefaults().subscribe({
      next: n => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(n ? 'requests.msg.defaultsAdded' : 'requests.msg.defaultsNone', { n }));
        this.afterCategoryChange();
      },
      error: e => this.fail(e)
    });
  }

  private afterCategoryChange(): void {
    this.loadCategories();
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
  }

  // ───── Helpers ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.ticket.set(null);
    this.ticketForm = null;
    this.categoryForm = null;
    this.resetActions();
  }

  personName(id: string | null): string {
    return id ? this.lookups().people.find(p => p.id === id)?.name ?? '' : '';
  }

  hoursLabel(h: number | null): { key: string; n: number } | null {
    if (!h) return null;
    return h % 24 === 0 ? { key: 'requests.daysN', n: h / 24 } : { key: 'requests.hoursN', n: h };
  }

  /** "Due in 5h" / "3h overdue" ke liye ghante (manfi = late). */
  hoursLeft(dueAt: string | null): number | null {
    const due = utc(dueAt);
    return due ? Math.round((due.getTime() - Date.now()) / 3_600_000) : null;
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  private fail(e: unknown, fallback = 'requests.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
