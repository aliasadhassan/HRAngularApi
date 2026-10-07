import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { PeopleService } from '../people/people.service';
import { LifecycleService } from './lifecycle.service';
import {
  CASE_CHIP, Candidate, CaseListItem, CaseStatus, ChecklistTemplate, EXIT_TYPES, ExitType, LifecycleCase, LifecycleKind,
  LifecycleSummary, LifecycleTask, MyTask, OWNERS, OWNER_ICON, TaskOwner, TemplateTask, addDays, todayIso
} from './lifecycle.models';

type Tab = 'mine' | 'onboarding' | 'exits' | 'checklists';
type Drawer = 'case' | 'startOnboarding' | 'startExit' | 'template';

const TABS: readonly Tab[] = ['mine', 'onboarding', 'exits', 'checklists'];

interface TaskForm {
  id: string | null;
  title: string;
  description: string;
  owner: TaskOwner;
  assigneeEmployeeId: string | null;
  dueDate: string;
  isRequired: boolean;
}

interface TemplateForm {
  id: string | null;
  kind: LifecycleKind;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  tasks: TemplateTask[];
}

@Component({
  selector: 'app-lifecycle',
  imports: [DatePipe, NgTemplateOutlet, FormsModule, TranslatePipe],
  templateUrl: './lifecycle.html',
  styleUrl: './lifecycle.css'
})
export class LifecycleComponent {
  private readonly api = inject(LifecycleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);
  private readonly people = inject(PeopleService);

  readonly lang = inject(LanguageService).language;
  readonly caseChip = CASE_CHIP;
  readonly owners = OWNERS;
  readonly ownerIcon = OWNER_ICON;
  readonly exitTypes = EXIT_TYPES;
  readonly today = todayIso();
  readonly canView = this.perms.hasAny(P.employeesView);
  readonly canManage = this.perms.hasAny(P.employeesEdit);
  readonly canEditTemplates = this.perms.hasAny([P.employeesEdit, P.settingsManage]);

  readonly tab = signal<Tab>(this.canView ? 'onboarding' : 'mine');
  readonly busy = signal<string | null>(null);
  readonly saving = signal(false);

  // ───── Mine ─────
  readonly myTasks = signal<MyTask[] | null>(null);
  readonly myOverdue = computed(() => (this.myTasks() ?? []).filter(t => t.dueDate && t.dueDate < this.today).length);

  // ───── HR lists ─────
  readonly summary = signal<LifecycleSummary | null>(null);
  readonly cases = signal<CaseListItem[] | null>(null);
  readonly status = signal<CaseStatus | ''>('InProgress');
  readonly search = signal('');
  private readonly search$ = new Subject<void>();

  // ───── Templates ─────
  readonly templates = signal<ChecklistTemplate[] | null>(null);
  readonly onboardingTemplates = computed(() => (this.templates() ?? []).filter(t => t.kind === 'Onboarding'));
  readonly exitTemplates = computed(() => (this.templates() ?? []).filter(t => t.kind === 'Exit'));

  // ───── Drawer ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly detail = signal<LifecycleCase | null>(null);
  readonly candidates = signal<Candidate[]>([]);
  /** Task assignee picker: chalte employees */
  readonly staff = signal<{ id: string; name: string; code: string }[]>([]);
  candidateSearch = '';
  private readonly candidate$ = new Subject<void>();

  startForm = {
    employeeId: '', templateId: null as string | null, notes: '',
    exitType: 'Resignation' as ExitType, noticeDate: todayIso(), lastWorkingDay: addDays(todayIso(), 30), reason: ''
  };
  exitForm: { exitType: ExitType; noticeDate: string; lastWorkingDay: string; reason: string; eligibleForRehire: boolean | null; interviewNotes: string } | null = null;
  notesForm: string | null = null;
  taskForm: TaskForm | null = null;
  skipping: { id: string; note: string } | null = null;
  confirm: string | null = null;
  templateForm: TemplateForm | null = null;

  constructor() {
    this.loadMine();
    if (this.canView) {
      this.loadSummary();
      this.loadCases();
    }

    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadCases());
    this.candidate$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadCandidates());

    // Dashboard / links se ?tab=exits
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && TABS.includes(tab) && (tab === 'mine' || this.canView)) this.setTab(tab);
  }

  get kind(): LifecycleKind {
    return this.tab() === 'exits' ? 'Exit' : 'Onboarding';
  }

  // ───── Loading ─────
  loadMine(): void {
    this.api.myTasks().subscribe({ next: t => this.myTasks.set(t), error: () => this.myTasks.set([]) });
  }

  loadSummary(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
  }

  loadCases(): void {
    if (this.tab() !== 'onboarding' && this.tab() !== 'exits') return;
    this.api.cases(this.kind, this.status(), this.search()).subscribe({
      next: r => this.cases.set(r),
      error: e => {
        this.cases.set([]);
        this.fail(e, 'lifecycle.errors.load');
      }
    });
  }

  loadTemplates(): void {
    this.api.templates().subscribe({ next: t => this.templates.set(t), error: e => this.fail(e, 'lifecycle.errors.load') });
  }

  setTab(t: Tab): void {
    if (this.tab() !== t) this.cases.set(null);
    this.tab.set(t);
    this.confirm = null;
    if (t === 'onboarding' || t === 'exits') this.loadCases();
    if (t === 'checklists' || (t !== 'mine' && !this.templates())) this.loadTemplates();
    if (t === 'mine') this.loadMine();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next();
  }

  setStatus(value: CaseStatus | ''): void {
    this.status.set(value);
    this.loadCases();
  }

  // ───── List helpers ─────
  progress(c: { totalTasks: number; closedTasks: number }): number {
    return c.totalTasks ? Math.round((c.closedTasks / c.totalTasks) * 100) : 0;
  }

  /** Joining / last working day kitne din door (minus = guzar gaya) */
  daysTo(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const [ty, tm, td] = this.today.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  }

  isOverdue(t: { dueDate: string | null; status?: string }): boolean {
    return !!t.dueDate && t.dueDate < this.today && (t.status === undefined || t.status === 'Open');
  }

  // ───── My tasks ─────
  doneMine(t: MyTask): void {
    this.run(t.taskId, this.api.taskAction(t.caseId, t.taskId, 'complete'), 'lifecycle.msg.taskDone', () => {
      this.loadMine();
      if (this.canView) this.loadSummary();
    });
  }

  // ───── Case drawer ─────
  openCase(id: string): void {
    this.detail.set(null);
    this.resetCaseForms();
    this.drawer.set('case');
    this.reloadCase(id);
  }

  private reloadCase(id: string): void {
    this.api.case(id).subscribe({ next: c => this.detail.set(c), error: e => this.fail(e, 'lifecycle.errors.load') });
  }

  private resetCaseForms(): void {
    this.exitForm = null;
    this.notesForm = null;
    this.taskForm = null;
    this.skipping = null;
    this.confirm = null;
  }

  readonly openRequired = computed(() => (this.detail()?.tasks ?? []).filter(t => t.isRequired && t.status === 'Open').length);
  readonly closedCount = computed(() => (this.detail()?.tasks ?? []).filter(t => t.status !== 'Open').length);

  /** Exit: last working day se pehle complete nahi ho sakta */
  readonly exitTooEarly = computed(() => {
    const c = this.detail();
    return !!c && c.kind === 'Exit' && c.anchorDate > this.today;
  });

  toggleTask(t: LifecycleTask): void {
    const c = this.detail();
    if (!c || c.status !== 'InProgress') return;
    const action = t.status === 'Open' ? 'complete' : 'reopen';
    this.run(t.id, this.api.taskAction(c.id, t.id, action), action === 'complete' ? 'lifecycle.msg.taskDone' : 'lifecycle.msg.taskReopened', () => this.afterCaseChange());
  }

  startSkip(t: LifecycleTask): void {
    this.skipping = { id: t.id, note: '' };
  }

  confirmSkip(t: LifecycleTask): void {
    const c = this.detail();
    if (!c || !this.skipping) return;
    const note = this.skipping.note.trim();
    if (t.isRequired && !note) return;
    this.run(t.id, this.api.taskAction(c.id, t.id, 'skip', note || null), 'lifecycle.msg.taskSkipped', () => {
      this.skipping = null;
      this.afterCaseChange();
    });
  }

  newTask(): void {
    this.taskForm = { id: null, title: '', description: '', owner: 'Hr', assigneeEmployeeId: null, dueDate: '', isRequired: false };
    this.ensureStaff();
  }

  editTask(t: LifecycleTask): void {
    this.taskForm = {
      id: t.id, title: t.title, description: t.description ?? '', owner: t.owner, assigneeEmployeeId: t.assigneeEmployeeId,
      dueDate: t.dueDate ?? '', isRequired: t.isRequired
    };
    this.ensureStaff();
  }

  saveTask(): void {
    const c = this.detail();
    const f = this.taskForm;
    if (!c || !f || !f.title.trim()) return;
    const body = {
      title: f.title.trim(), description: f.description.trim() || null, owner: f.owner,
      assigneeEmployeeId: f.assigneeEmployeeId || null, dueDate: f.dueDate || null, isRequired: f.isRequired
    };
    this.saving.set(true);
    (f.id ? this.api.updateTask(c.id, f.id, body) : this.api.addTask(c.id, body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.taskForm = null;
        this.alert.success(this.translate.instant('lifecycle.msg.taskSaved'));
        this.afterCaseChange();
      },
      error: e => this.fail(e)
    });
  }

  removeTask(t: LifecycleTask): void {
    const c = this.detail();
    if (!c) return;
    const key = `rm:${t.id}`;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.run(t.id, this.api.removeTask(c.id, t.id), 'lifecycle.msg.taskRemoved', () => this.afterCaseChange());
  }

  editExit(): void {
    const c = this.detail();
    if (!c) return;
    this.exitForm = {
      exitType: c.exitType ?? 'Resignation', noticeDate: c.noticeDate ?? this.today, lastWorkingDay: c.anchorDate,
      reason: c.reason ?? '', eligibleForRehire: c.eligibleForRehire, interviewNotes: c.interviewNotes ?? ''
    };
  }

  saveExit(): void {
    const c = this.detail();
    const f = this.exitForm;
    if (!c || !f || !f.reason.trim() || f.lastWorkingDay < f.noticeDate) return;
    this.saving.set(true);
    this.api.saveExitDetails(c.id, {
      exitType: f.exitType, noticeDate: f.noticeDate, lastWorkingDay: f.lastWorkingDay, reason: f.reason.trim(),
      eligibleForRehire: f.eligibleForRehire, interviewNotes: f.interviewNotes.trim() || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.exitForm = null;
        this.alert.success(this.translate.instant('lifecycle.msg.exitSaved'));
        this.afterCaseChange();
      },
      error: e => this.fail(e)
    });
  }

  saveNotes(): void {
    const c = this.detail();
    if (!c || this.notesForm === null) return;
    this.saving.set(true);
    this.api.saveNotes(c.id, this.notesForm.trim() || null).subscribe({
      next: () => {
        this.saving.set(false);
        this.notesForm = null;
        this.reloadCase(c.id);
      },
      error: e => this.fail(e)
    });
  }

  completeCase(): void {
    const c = this.detail();
    if (!c) return;
    if (this.confirm !== 'complete') {
      this.confirm = 'complete';
      return;
    }
    this.saving.set(true);
    this.api.complete(c.id).subscribe({
      next: () => this.done(c.kind === 'Exit' ? 'lifecycle.msg.exitDone' : 'lifecycle.msg.onboardingDone', { name: c.employeeName }),
      error: e => this.fail(e)
    });
  }

  cancelCase(): void {
    const c = this.detail();
    if (!c) return;
    if (this.confirm !== 'cancel') {
      this.confirm = 'cancel';
      return;
    }
    this.saving.set(true);
    this.api.cancel(c.id).subscribe({
      next: () => this.done(c.kind === 'Exit' ? 'lifecycle.msg.exitCancelled' : 'lifecycle.msg.onboardingCancelled', { name: c.employeeName }),
      error: e => this.fail(e)
    });
  }

  // ───── Start ─────
  openStart(kind: LifecycleKind, employee?: Candidate): void {
    this.startForm = {
      employeeId: employee?.id ?? '', templateId: this.defaultTemplate(kind), notes: '',
      exitType: 'Resignation', noticeDate: this.today, lastWorkingDay: addDays(this.today, 30), reason: ''
    };
    this.candidateSearch = '';
    this.candidates.set([]);
    this.drawer.set(kind === 'Exit' ? 'startExit' : 'startOnboarding');
    this.loadCandidates();
    if (!this.templates()) this.loadTemplates();
  }

  private defaultTemplate(kind: LifecycleKind): string | null {
    return (this.templates() ?? []).find(t => t.kind === kind && t.isDefault && t.isActive)?.id ?? null;
  }

  activeTemplates(kind: LifecycleKind): ChecklistTemplate[] {
    return (this.templates() ?? []).filter(t => t.kind === kind && t.isActive);
  }

  onCandidateSearch(): void {
    this.candidate$.next();
  }

  loadCandidates(): void {
    const kind: LifecycleKind = this.drawer() === 'startExit' ? 'Exit' : 'Onboarding';
    this.api.candidates(kind, this.candidateSearch).subscribe({
      next: list => {
        this.candidates.set(list);
        if (!this.startForm.templateId) this.startForm.templateId = this.defaultTemplate(kind);
      },
      error: () => this.candidates.set([])
    });
  }

  private ensureStaff(): void {
    if (this.staff().length) return;
    this.people.getEmployees({ page: 1, pageSize: 200 }).subscribe({
      next: r => this.staff.set(r.items.map(e => ({ id: e.id, name: e.fullName, code: e.employeeCode }))),
      error: () => undefined
    });
  }

  selectedCandidate(): Candidate | undefined {
    return this.candidates().find(c => c.id === this.startForm.employeeId);
  }

  canStart(): boolean {
    const f = this.startForm;
    if (!f.employeeId) return false;
    if (this.drawer() === 'startExit') return !!f.reason.trim() && !!f.noticeDate && !!f.lastWorkingDay && f.lastWorkingDay >= f.noticeDate;
    return true;
  }

  start(): void {
    const f = this.startForm;
    const exit = this.drawer() === 'startExit';
    const name = this.selectedCandidate()?.name ?? '';
    this.saving.set(true);
    const req = exit
      ? this.api.startExit({
          employeeId: f.employeeId, templateId: f.templateId, notes: f.notes.trim() || null, exitType: f.exitType,
          noticeDate: f.noticeDate, lastWorkingDay: f.lastWorkingDay, reason: f.reason.trim(), eligibleForRehire: null, interviewNotes: null
        })
      : this.api.startOnboarding({ employeeId: f.employeeId, templateId: f.templateId, notes: f.notes.trim() || null });
    req.subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(exit ? 'lifecycle.msg.exitStarted' : 'lifecycle.msg.onboardingStarted', { name }));
        this.refreshLists();
        if (this.tab() !== (exit ? 'exits' : 'onboarding')) this.setTab(exit ? 'exits' : 'onboarding');
        this.openCase(id);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Templates ─────
  createStarter(): void {
    this.saving.set(true);
    this.api.starter().subscribe({
      next: n => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('lifecycle.msg.starterCreated', { n }));
        this.loadTemplates();
      },
      error: e => this.fail(e)
    });
  }

  openTemplate(kind: LifecycleKind, t?: ChecklistTemplate): void {
    this.templateForm = t
      ? { id: t.id, kind: t.kind, name: t.name, description: t.description ?? '', isDefault: t.isDefault, isActive: t.isActive, tasks: t.tasks.map(x => ({ ...x })) }
      : { id: null, kind, name: '', description: '', isDefault: !(this.templates() ?? []).some(x => x.kind === kind && x.isDefault), isActive: true,
          tasks: [this.blankTemplateTask()] };
    this.confirm = null;
    this.drawer.set('template');
  }

  /** Card pe: is template mein kin teams ke tasks hain (OWNERS order) */
  templateOwners(t: ChecklistTemplate): TaskOwner[] {
    return this.owners.filter(o => t.tasks.some(x => x.owner === o));
  }

  blankTemplateTask(): TemplateTask {
    return { title: '', description: null, owner: 'Hr', dueOffsetDays: 0, isRequired: true };
  }

  addTemplateTask(): void {
    if (!this.templateForm) return;
    this.templateForm.tasks = [...this.templateForm.tasks, this.blankTemplateTask()];
  }

  removeTemplateTask(i: number): void {
    if (!this.templateForm) return;
    this.templateForm.tasks = this.templateForm.tasks.filter((_, idx) => idx !== i);
  }

  moveTemplateTask(i: number, delta: number): void {
    const f = this.templateForm;
    const j = i + delta;
    if (!f || j < 0 || j >= f.tasks.length) return;
    const tasks = [...f.tasks];
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
    f.tasks = tasks;
  }

  canSaveTemplate(): boolean {
    const f = this.templateForm;
    return !!f && !!f.name.trim() && f.tasks.every(t => t.title.trim() && Number.isInteger(t.dueOffsetDays) && Math.abs(t.dueOffsetDays) <= 365);
  }

  saveTemplate(): void {
    const f = this.templateForm;
    if (!f || !this.canSaveTemplate()) return;
    this.saving.set(true);
    this.api.saveTemplate(f.id, {
      kind: f.kind, name: f.name.trim(), description: f.description.trim() || null, isDefault: f.isDefault && f.isActive, isActive: f.isActive,
      tasks: f.tasks.map(t => ({ title: t.title.trim(), description: t.description?.trim() || null, owner: t.owner, dueOffsetDays: t.dueOffsetDays, isRequired: t.isRequired }))
    }).subscribe({
      next: () => {
        this.done('lifecycle.msg.templateSaved');
        this.loadTemplates();
      },
      error: e => this.fail(e)
    });
  }

  deleteTemplate(): void {
    const f = this.templateForm;
    if (!f?.id) return;
    if (this.confirm !== 'deleteTemplate') {
      this.confirm = 'deleteTemplate';
      return;
    }
    this.saving.set(true);
    this.api.deleteTemplate(f.id).subscribe({
      next: () => {
        this.done('lifecycle.msg.templateDeleted');
        this.loadTemplates();
      },
      error: e => this.fail(e)
    });
  }

  /** "3 days before" / "on the day" / "7 days after" */
  offsetLabel(kind: LifecycleKind, days: number): string {
    const anchor = this.translate.instant(kind === 'Exit' ? 'lifecycle.anchor.exit' : 'lifecycle.anchor.onboarding');
    if (days === 0) return this.translate.instant('lifecycle.offset.on', { anchor });
    return this.translate.instant(days < 0 ? 'lifecycle.offset.before' : 'lifecycle.offset.after', { n: Math.abs(days), anchor });
  }

  // ───── Helpers ─────
  closeDrawer(): void {
    this.drawer.set(null);
    this.detail.set(null);
    this.templateForm = null;
    this.resetCaseForms();
  }

  private afterCaseChange(): void {
    const c = this.detail();
    if (c) this.reloadCase(c.id);
    this.refreshLists();
  }

  private refreshLists(): void {
    if (this.canView) {
      this.loadSummary();
      this.loadCases();
    }
    this.loadMine();
  }

  private run(id: string, req: ReturnType<LifecycleService['cancel']>, key: string, after: () => void): void {
    this.busy.set(id);
    req.subscribe({
      next: () => {
        this.busy.set(null);
        this.confirm = null;
        this.alert.success(this.translate.instant(key));
        after();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e);
      }
    });
  }

  private done(key: string, params?: Record<string, string>): void {
    this.saving.set(false);
    this.closeDrawer();
    this.alert.success(this.translate.instant(key, params));
    this.refreshLists();
  }

  private fail(e: unknown, fallback = 'lifecycle.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
