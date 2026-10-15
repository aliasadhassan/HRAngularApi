import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { PaginationComponent } from '../../shared/pagination/pagination';
import { clientPager } from '../../shared/pagination/client-pager';
import { todayIso } from '../lifecycle/lifecycle.models';
import { LearningService } from './learning.service';
import {
  COURSE_CATEGORIES, COURSE_FORMATS, COURSE_ICON, CareerGoalRow, CareerRole, CourseCategory, CourseDetail, CourseFormat, CourseListItem,
  ENROLLMENT_CHIP, ENROLLMENT_STATUSES, Enrollment, EnrollmentStatus, FORMAT_ICON, LEVELS, LearningSummary, Lookups, PersonGrowth,
  SKILL_CATEGORIES, SOURCE_CHIP, Skill, SkillCategory, SkillMatrix, isHttpLink, readinessTone
} from './learning.models';

type Tab = 'courses' | 'skills' | 'career';
type CourseView = 'catalogue' | 'team';
type Drawer = 'course' | 'courseEdit' | 'enrollment' | 'person' | 'skillEdit' | 'goalEdit' | 'roleEdit';

const TABS: readonly Tab[] = ['courses', 'skills', 'career'];

interface CourseForm {
  id: string | null;
  title: string;
  category: CourseCategory;
  format: CourseFormat;
  provider: string;
  description: string;
  linkUrl: string;
  durationHours: number | null;
  skillId: string;
  skillLevel: number | null;
  allowSelfEnrol: boolean;
  completeWithinDays: number | null;
  isActive: boolean;
}

interface CompleteForm {
  completedOn: string;
  score: number | null;
  rating: number | null;
  feedback: string;
  certificateUrl: string;
}

interface AssignForm {
  picked: Set<string>;
  dueOn: string;
  search: string;
}

interface SkillForm {
  id: string | null;
  name: string;
  category: SkillCategory;
  description: string;
  isActive: boolean;
}

interface GoalForm {
  employeeId: string;
  name: string;
  currentDesignationId: string;
  targetDesignationId: string;
  targetDate: string;
  notes: string;
}

interface RoleForm {
  designationId: string;
  title: string;
  rows: { skillId: string; level: number }[];
}

@Component({
  selector: 'app-learning',
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './learning.html',
  styleUrl: './learning.css'
})
export class LearningComponent {
  private readonly api = inject(LearningService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly today = todayIso();
  readonly categories = COURSE_CATEGORIES;
  readonly formats = COURSE_FORMATS;
  readonly statuses = ENROLLMENT_STATUSES;
  readonly skillCategories = SKILL_CATEGORIES;
  readonly levels = LEVELS;
  readonly courseIcon = COURSE_ICON;
  readonly formatIcon = FORMAT_ICON;
  readonly enrollmentChip = ENROLLMENT_CHIP;
  readonly sourceChip = SOURCE_CHIP;
  readonly tone = readinessTone;

  readonly tab = signal<Tab>('courses');
  readonly saving = signal(false);
  readonly summary = signal<LearningSummary | null>(null);
  readonly lookups = signal<Lookups>({ departments: [], people: [], designations: [], skills: [] });

  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  readonly canSeeTeam = computed(() => !!this.summary()?.canSeeAll || !!this.summary()?.isManager);
  readonly canLead = computed(() => this.canManage() || !!this.summary()?.isManager);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);

  // ───── Courses ─────
  readonly courseView = signal<CourseView>('catalogue');
  readonly courses = signal<CourseListItem[] | null>(null);
  readonly search = signal('');
  readonly category = signal<CourseCategory | ''>('');
  readonly showInactive = signal(false);
  private readonly search$ = new Subject<void>();

  readonly myLearning = signal<Enrollment[] | null>(null);
  readonly myOpen = computed(() => (this.myLearning() ?? []).filter(e => this.isOpen(e.status)));
  readonly myDone = computed(() => (this.myLearning() ?? []).filter(e => e.status === 'Completed').slice(0, 5));

  readonly team = signal<Enrollment[] | null>(null);
  readonly teamStatus = signal<EnrollmentStatus | ''>('');
  readonly teamOverdue = signal(false);
  readonly teamDept = signal('');
  readonly teamSearch = signal('');
  private readonly team$ = new Subject<void>();
  readonly teamPager = clientPager(() => this.team() ?? []);

  // ───── Skills / career ─────
  readonly me = signal<PersonGrowth | null>(null);
  readonly meError = signal(false);
  readonly matrix = signal<SkillMatrix | null>(null);
  readonly matrixDept = signal('');
  readonly matrixSkill = signal('');
  readonly matrixSearch = signal('');
  private readonly matrix$ = new Subject<void>();
  readonly library = signal<Skill[] | null>(null);
  readonly roles = signal<CareerRole[] | null>(null);
  readonly goals = signal<CareerGoalRow[] | null>(null);
  readonly goalsDept = signal('');
  readonly matrixPager = clientPager(() => this.matrix()?.people ?? []);
  readonly libraryPager = clientPager(() => this.library() ?? []);
  readonly goalsPager = clientPager(() => this.goals() ?? []);
  readonly unratedSkills = computed(() => {
    const mine = new Set((this.me()?.skills ?? []).map(s => s.skillId));
    return this.lookups().skills.filter(s => !mine.has(s.id));
  });
  readonly matrixCategories = computed(() => {
    const m = this.matrix();
    if (!m) return [];
    const out: { category: SkillCategory; span: number }[] = [];
    for (const s of m.skills) {
      const last = out.at(-1);
      if (last?.category === s.category) last.span++;
      else out.push({ category: s.category, span: 1 });
    }
    return out;
  });

  addSkillId = '';
  addSkillLevel = 3;

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly course = signal<CourseDetail | null>(null);
  readonly enrollment = signal<Enrollment | null>(null);
  readonly person = signal<PersonGrowth | null>(null);

  courseForm: CourseForm | null = null;
  completeForm: CompleteForm | null = null;
  assignForm: AssignForm | null = null;
  skillForm: SkillForm | null = null;
  goalForm: GoalForm | null = null;
  roleForm: RoleForm | null = null;
  progressValue = 0;
  dueValue = '';
  editingDue = false;
  confirm: string | null = null;

  readonly assignable = computed(() => this.lookups().people);

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadCourses());
    this.team$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadTeam());
    this.matrix$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadMatrix());

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const courseId = route.get('course');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
        this.loadCourses();
        this.loadMine();
        this.setTab(wanted && TABS.includes(wanted) ? wanted : 'courses');
        if (courseId) this.openCourse(courseId);
      },
      error: e => this.fail(e, 'learning.errors.load')
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t !== 'courses' && this.me() === null && this.linked()) this.loadMe();
    if (t === 'skills') {
      if (this.canSeeTeam() && this.matrix() === null) this.loadMatrix();
      if (this.canManage() && this.library() === null) this.loadLibrary();
    }
    if (t === 'career') {
      if (this.roles() === null) this.loadRoles();
      if (this.canSeeTeam() && this.goals() === null) this.loadGoals();
    }
  }

  setCourseView(v: CourseView): void {
    this.courseView.set(v);
    if (v === 'team' && this.team() === null) this.loadTeam();
  }

  // ───── Loading ─────
  loadCourses(): void {
    this.api.courses(this.category(), this.search(), this.showInactive())
      .subscribe({ next: l => this.courses.set(l), error: () => this.courses.set([]) });
  }

  loadMine(): void {
    if (!this.linked()) {
      this.myLearning.set([]);
      return;
    }
    this.api.enrollments({ scope: 'mine' }).subscribe({ next: l => this.myLearning.set(l), error: () => this.myLearning.set([]) });
  }

  loadTeam(): void {
    if (!this.canSeeTeam()) return;
    this.api.enrollments({
      scope: 'team', status: this.teamStatus(), overdue: this.teamOverdue(), departmentId: this.teamDept(), search: this.teamSearch()
    }).subscribe({ next: l => this.team.set(l), error: () => this.team.set([]) });
  }

  loadMe(): void {
    this.api.person(null).subscribe({
      next: p => {
        this.me.set(p);
        this.meError.set(false);
      },
      error: () => this.meError.set(true)
    });
  }

  loadMatrix(): void {
    if (!this.canSeeTeam()) return;
    this.api.matrix(this.matrixDept(), this.matrixSkill(), this.matrixSearch())
      .subscribe({ next: m => this.matrix.set(m), error: () => this.matrix.set({ skills: [], people: [] }) });
  }

  loadLibrary(): void {
    this.api.skills(true).subscribe({ next: l => this.library.set(l), error: () => this.library.set([]) });
  }

  loadRoles(): void {
    this.api.roles().subscribe({ next: l => this.roles.set(l), error: () => this.roles.set([]) });
  }

  loadGoals(): void {
    if (!this.canSeeTeam()) return;
    this.api.goals(this.goalsDept()).subscribe({ next: l => this.goals.set(l), error: () => this.goals.set([]) });
  }

  /** Kuch bhi badla: summary aur jo list khuli hai dobara. */
  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    this.loadCourses();
    this.loadMine();
    if (this.team() !== null) this.loadTeam();
    if (this.me() !== null) this.loadMe();
    if (this.matrix() !== null) this.loadMatrix();
    if (this.library() !== null) this.loadLibrary();
    if (this.roles() !== null) this.loadRoles();
    if (this.goals() !== null) this.loadGoals();
  }

  private reloadLookups(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.search$.next();
  }

  setCategory(v: CourseCategory | ''): void {
    this.category.set(v);
    this.loadCourses();
  }

  setInactive(v: boolean): void {
    this.showInactive.set(v);
    this.loadCourses();
  }

  setTeamStatus(v: EnrollmentStatus | ''): void {
    this.teamStatus.set(v);
    this.teamOverdue.set(false);
    this.teamPager.reset();
    this.loadTeam();
  }

  showOverdue(): void {
    this.tab.set('courses');
    this.teamStatus.set('');
    this.teamOverdue.set(true);
    this.courseView.set('team');
    this.teamPager.reset();
    this.loadTeam();
  }

  setTeamDept(v: string): void {
    this.teamDept.set(v);
    this.teamPager.reset();
    this.loadTeam();
  }

  onTeamSearch(v: string): void {
    this.teamSearch.set(v);
    this.teamPager.reset();
    this.team$.next();
  }

  setMatrixDept(v: string): void {
    this.matrixDept.set(v);
    this.matrixPager.reset();
    this.loadMatrix();
  }

  setMatrixSkill(v: string): void {
    this.matrixSkill.set(v);
    this.matrixPager.reset();
    this.loadMatrix();
  }

  onMatrixSearch(v: string): void {
    this.matrixSearch.set(v);
    this.matrixPager.reset();
    this.matrix$.next();
  }

  setGoalsDept(v: string): void {
    this.goalsDept.set(v);
    this.goalsPager.reset();
    this.loadGoals();
  }

  isOpen(s: EnrollmentStatus | null): boolean {
    return s === 'NotStarted' || s === 'InProgress';
  }

  /** "Due in 5 days" / "3 days late" / "Due today". */
  dueKey(days: number | null): { key: string; n: number } | null {
    if (days === null) return null;
    if (days === 0) return { key: 'learning.dueToday', n: 0 };
    return days > 0 ? { key: 'learning.dueInDays', n: days } : { key: 'learning.daysLate', n: -days };
  }

  daysTo(iso: string | null): number | null {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const [ty, tm, td] = this.today.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  }

  linkOk(v: string): boolean {
    return isHttpLink(v);
  }

  // ───── Course drawer ─────
  openCourse(id: string): void {
    this.course.set(null);
    this.resetForms();
    this.drawer.set('course');
    this.api.course(id).subscribe({
      next: c => this.course.set(c),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'learning.errors.load');
      }
    });
  }

  private reloadCourse(): void {
    const c = this.course();
    if (c && this.drawer() === 'course') this.api.course(c.course.id).subscribe({ next: x => this.course.set(x), error: () => undefined });
  }

  enrol(courseId: string, title: string): void {
    this.saving.set(true);
    this.api.enrol(courseId).subscribe({
      next: () => this.done('learning.msg.enrolled', { title }),
      error: e => this.fail(e)
    });
  }

  startAssign(): void {
    this.assignForm = { picked: new Set(), dueOn: '', search: '' };
  }

  assignPeople(): { id: string; name: string; extra: string | null }[] {
    const f = this.assignForm;
    const term = f?.search.trim().toLowerCase() ?? '';
    return this.assignable().filter(p => !term || p.name.toLowerCase().includes(term) || (p.extra ?? '').toLowerCase().includes(term));
  }

  togglePick(id: string): void {
    const f = this.assignForm;
    if (!f) return;
    if (f.picked.has(id)) f.picked.delete(id);
    else f.picked.add(id);
  }

  pickAllShown(): void {
    const f = this.assignForm;
    if (!f) return;
    for (const p of this.assignPeople()) f.picked.add(p.id);
  }

  runAssign(): void {
    const c = this.course();
    const f = this.assignForm;
    if (!c || !f?.picked.size || (f.dueOn && f.dueOn < this.today)) return;
    this.saving.set(true);
    this.api.assign(c.course.id, [...f.picked], f.dueOn || null).subscribe({
      next: r => {
        const key = r.skipped ? 'learning.msg.assignedSkipped' : 'learning.msg.assigned';
        this.done(key, { n: r.assigned, skipped: r.skipped, title: c.course.title });
      },
      error: e => this.fail(e)
    });
  }

  deleteCourse(): void {
    const c = this.course();
    if (!c) return;
    if (this.confirm !== 'deleteCourse') {
      this.confirm = 'deleteCourse';
      return;
    }
    this.saving.set(true);
    this.api.deleteCourse(c.course.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.done('learning.msg.courseDeleted', { title: c.course.title });
      },
      error: e => this.fail(e)
    });
  }

  // ───── New / edit course ─────
  newCourse(): void {
    this.courseForm = {
      id: null, title: '', category: 'Technical', format: 'Online', provider: '', description: '', linkUrl: '', durationHours: null,
      skillId: '', skillLevel: null, allowSelfEnrol: true, completeWithinDays: 30, isActive: true
    };
    this.course.set(null);
    this.drawer.set('courseEdit');
  }

  editCourse(): void {
    const c = this.course()?.course;
    if (!c) return;
    this.courseForm = {
      id: c.id, title: c.title, category: c.category, format: c.format, provider: c.provider ?? '', description: c.description ?? '',
      linkUrl: c.linkUrl ?? '', durationHours: c.durationHours, skillId: c.skillId ?? '', skillLevel: c.skillLevel,
      allowSelfEnrol: c.allowSelfEnrol, completeWithinDays: c.completeWithinDays, isActive: c.isActive
    };
    this.drawer.set('courseEdit');
  }

  canSaveCourse(): boolean {
    const f = this.courseForm;
    if (!f?.title.trim() || !isHttpLink(f.linkUrl)) return false;
    const h = f.durationHours;
    const d = f.completeWithinDays;
    return (h === null || (h > 0 && h <= 1000)) && (d === null || (d >= 1 && d <= 365)) && (!f.skillId || f.skillLevel !== null);
  }

  saveCourse(): void {
    const f = this.courseForm;
    if (!f || !this.canSaveCourse()) return;
    const body = {
      title: f.title.trim(), category: f.category, format: f.format, provider: f.provider.trim() || null,
      description: f.description.trim() || null, linkUrl: f.linkUrl.trim() || null, durationHours: f.durationHours || null,
      skillId: f.skillId || null, skillLevel: f.skillId ? f.skillLevel : null, allowSelfEnrol: f.allowSelfEnrol,
      completeWithinDays: f.completeWithinDays || null, isActive: f.isActive
    };
    this.saving.set(true);
    const saved = (id: string) => {
      this.saving.set(false);
      this.alert.success(this.translate.instant('learning.msg.courseSaved', { title: body.title }));
      this.refresh();
      this.openCourse(id);
    };
    if (f.id) {
      const id = f.id;
      this.api.updateCourse(id, body).subscribe({ next: () => saved(id), error: e => this.fail(e) });
    } else {
      this.api.createCourse(body).subscribe({ next: id => saved(id), error: e => this.fail(e) });
    }
  }

  // ───── Enrollment ─────
  openEnrollment(e: Enrollment): void {
    this.resetForms();
    this.enrollment.set(e);
    this.progressValue = e.progress;
    this.dueValue = e.dueOn ?? '';
    this.drawer.set('enrollment');
  }

  openMyEnrollment(enrollmentId: string | null): void {
    const e = (this.myLearning() ?? []).find(x => x.id === enrollmentId);
    if (e) this.openEnrollment(e);
  }

  saveProgress(): void {
    const e = this.enrollment();
    if (!e) return;
    const value = Math.max(0, Math.min(99, Math.round(this.progressValue)));
    this.enrollmentCall(this.api.progress(e.id, value), 'learning.msg.progress', { title: e.courseTitle, n: value });
  }

  startComplete(): void {
    this.completeForm = { completedOn: this.today, score: null, rating: null, feedback: '', certificateUrl: '' };
  }

  canComplete(): boolean {
    const f = this.completeForm;
    return !!f?.completedOn && f.completedOn <= this.today && isHttpLink(f.certificateUrl)
      && (f.score === null || (f.score >= 0 && f.score <= 100));
  }

  runComplete(): void {
    const e = this.enrollment();
    const f = this.completeForm;
    if (!e || !f || !this.canComplete()) return;
    const body = {
      completedOn: f.completedOn, score: f.score, rating: f.rating, feedback: f.feedback.trim() || null, certificateUrl: f.certificateUrl.trim() || null
    };
    this.enrollmentCall(this.api.complete(e.id, body), 'learning.msg.completed', { title: e.courseTitle });
  }

  cancelEnrollment(): void {
    const e = this.enrollment();
    if (!e) return;
    if (this.confirm !== 'cancel') {
      this.confirm = 'cancel';
      return;
    }
    this.enrollmentCall(this.api.cancel(e.id), 'learning.msg.cancelled', { title: e.courseTitle });
  }

  saveDue(): void {
    const e = this.enrollment();
    if (!e || (this.dueValue && this.dueValue < this.today)) return;
    this.enrollmentCall(this.api.changeDue(e.id, this.dueValue || null), 'learning.msg.dueChanged', { title: e.courseTitle });
  }

  canCancel(e: Enrollment): boolean {
    return e.canManage || (e.canUpdate && e.source === 'Self');
  }

  private enrollmentCall(call$: Observable<void>, key: string, params: Record<string, string | number>): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.closeDrawer();
        this.done(key, params);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Skills ─────
  rate(p: PersonGrowth, skillId: string, level: number): void {
    if (!(p.canRate || p.canAssess)) return;
    this.saving.set(true);
    this.api.rate(p.employeeId, skillId, level).subscribe({
      next: () => {
        this.saving.set(false);
        this.reloadPerson(p);
      },
      error: e => this.fail(e)
    });
  }

  addMySkill(): void {
    const p = this.me();
    if (!p || !this.addSkillId) return;
    this.rate(p, this.addSkillId, this.addSkillLevel);
    this.addSkillId = '';
    this.addSkillLevel = 3;
  }

  removeSkill(p: PersonGrowth, skillId: string): void {
    const key = `skill:${p.employeeId}:${skillId}`;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.saving.set(true);
    this.api.removeSkill(p.employeeId, skillId).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirm = null;
        this.reloadPerson(p);
      },
      error: e => this.fail(e)
    });
  }

  private reloadPerson(p: PersonGrowth): void {
    if (p.isMe) this.loadMe();
    if (this.person()?.employeeId === p.employeeId) this.openPerson(p.employeeId, false);
    if (this.matrix() !== null) this.loadMatrix();
    if (this.goals() !== null) this.loadGoals();
    if (this.library() !== null) this.loadLibrary();
  }

  openPerson(employeeId: string, reset = true): void {
    if (employeeId === this.summary()?.myEmployeeId) {
      this.closeDrawer();
      this.setTab('skills');
      return;
    }
    if (reset) {
      this.resetForms();
      this.person.set(null);
    }
    this.drawer.set('person');
    this.api.person(employeeId).subscribe({
      next: p => this.person.set(p),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'learning.errors.load');
      }
    });
  }

  newSkill(): void {
    this.skillForm = { id: null, name: '', category: 'Technical', description: '', isActive: true };
    this.drawer.set('skillEdit');
  }

  editSkill(s: Skill): void {
    this.skillForm = { id: s.id, name: s.name, category: s.category, description: s.description ?? '', isActive: s.isActive };
    this.confirm = null;
    this.drawer.set('skillEdit');
  }

  saveSkill(): void {
    const f = this.skillForm;
    if (!f?.name.trim()) return;
    const body = { name: f.name.trim(), category: f.category, description: f.description.trim() || null, isActive: f.isActive };
    this.saving.set(true);
    const call$ = f.id ? this.api.updateSkill(f.id, body) : this.api.createSkill(body);
    (call$ as Observable<unknown>).subscribe({
      next: () => {
        this.closeDrawer();
        this.reloadLookups();
        this.done('learning.msg.skillSaved', { name: body.name });
      },
      error: e => this.fail(e)
    });
  }

  deleteSkill(): void {
    const f = this.skillForm;
    if (!f?.id) return;
    if (this.confirm !== 'deleteSkill') {
      this.confirm = 'deleteSkill';
      return;
    }
    this.saving.set(true);
    this.api.deleteSkill(f.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.reloadLookups();
        this.done('learning.msg.skillDeleted', { name: f.name });
      },
      error: e => this.fail(e)
    });
  }

  addStarterSkills(): void {
    this.saving.set(true);
    this.api.addStarterSkills().subscribe({
      next: n => {
        this.reloadLookups();
        this.done(n ? 'learning.msg.starterAdded' : 'learning.msg.starterNone', { n });
      },
      error: e => this.fail(e)
    });
  }

  levelLabel(n: number): string {
    return this.translate.instant(`learning.level.${n}`);
  }

  // ───── Career ─────
  editGoal(p: PersonGrowth): void {
    this.goalForm = {
      employeeId: p.employeeId, name: p.name, currentDesignationId: p.designationId,
      targetDesignationId: p.goal?.status === 'Active' ? p.goal.targetDesignationId : '',
      targetDate: p.goal?.status === 'Active' ? p.goal.targetDate ?? '' : '', notes: p.goal?.status === 'Active' ? p.goal.notes ?? '' : ''
    };
    this.confirm = null;
    this.drawer.set('goalEdit');
  }

  canSaveGoal(): boolean {
    const f = this.goalForm;
    return !!f?.targetDesignationId && f.targetDesignationId !== f.currentDesignationId && (!f.targetDate || f.targetDate >= this.today);
  }

  saveGoal(): void {
    const f = this.goalForm;
    if (!f || !this.canSaveGoal()) return;
    this.goalCall(this.api.setGoal(f.employeeId, f.targetDesignationId, f.targetDate || null, f.notes.trim() || null), f.employeeId, 'learning.msg.goalSaved', f.name);
  }

  achieveGoal(p: PersonGrowth): void {
    if (this.confirm !== 'achieve') {
      this.confirm = 'achieve';
      return;
    }
    this.goalCall(this.api.achieveGoal(p.employeeId), p.employeeId, 'learning.msg.goalAchieved', p.name);
  }

  clearGoal(p: PersonGrowth): void {
    if (this.confirm !== 'clearGoal') {
      this.confirm = 'clearGoal';
      return;
    }
    this.goalCall(this.api.clearGoal(p.employeeId), p.employeeId, 'learning.msg.goalCleared', p.name);
  }

  private goalCall(call$: Observable<void>, employeeId: string, key: string, name: string): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        const other = employeeId !== this.summary()?.myEmployeeId;
        this.closeDrawer();
        this.done(key, { name });
        if (other) this.openPerson(employeeId);
      },
      error: e => this.fail(e)
    });
  }

  editRole(r: CareerRole): void {
    this.roleForm = { designationId: r.designationId, title: r.title, rows: r.skills.map(s => ({ skillId: s.skillId, level: s.requiredLevel })) };
    if (!this.roleForm.rows.length) this.addRoleRow();
    this.drawer.set('roleEdit');
  }

  addRoleRow(): void {
    this.roleForm?.rows.push({ skillId: '', level: 3 });
  }

  removeRoleRow(i: number): void {
    this.roleForm?.rows.splice(i, 1);
  }

  roleSkillTaken(skillId: string, i: number): boolean {
    return !!this.roleForm?.rows.some((r, j) => j !== i && r.skillId === skillId);
  }

  saveRole(): void {
    const f = this.roleForm;
    if (!f) return;
    const rows = f.rows.filter(r => r.skillId);
    this.saving.set(true);
    this.api.saveRole(f.designationId, rows.map(r => ({ skillId: r.skillId, level: Number(r.level) }))).subscribe({
      next: () => {
        this.closeDrawer();
        this.done('learning.msg.roleSaved', { title: f.title });
      },
      error: e => this.fail(e)
    });
  }

  // ───── Helpers ─────
  private resetForms(): void {
    this.courseForm = null;
    this.completeForm = null;
    this.assignForm = null;
    this.skillForm = null;
    this.goalForm = null;
    this.roleForm = null;
    this.editingDue = false;
    this.confirm = null;
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.course.set(null);
    this.enrollment.set(null);
    this.person.set(null);
    this.resetForms();
  }

  private done(key: string, params: Record<string, string | number>): void {
    this.saving.set(false);
    this.alert.success(this.translate.instant(key, params));
    this.resetForms();
    this.reloadCourse();
    this.refresh();
  }

  private fail(e: unknown, fallback = 'learning.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
