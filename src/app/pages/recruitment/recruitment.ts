import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { EmploymentType } from '../people/people.models';
import { utc } from '../admin/admin.models';
import { addDays, todayIso } from '../lifecycle/lifecycle.models';
import { RecruitmentService } from './recruitment.service';
import {
  Application, ApplicationListItem, BOARD_STAGES, Candidate, CandidateListItem, CandidateSource, EMPLOYMENT_TYPES, HeadcountRow,
  INTERVIEW_CHIP, Interview, InterviewMode, InterviewStatus, JOB_CHIP, JOB_STATUSES, Job, JobListItem, JobReason, JobStatus, Lookups,
  MODES, MODE_ICON, MOVE_STAGES, RECOMMENDATIONS, Recommendation, RecruitmentSummary, SOURCES, STAGES, STAGE_CHIP, Stage, isActiveStage,
  isHttpLink, isOpenJob, toLocalInput
} from './recruitment.models';

type Tab = 'jobs' | 'pipeline' | 'candidates' | 'interviews' | 'headcount';
type Drawer = 'job' | 'jobEdit' | 'candidate' | 'candidateEdit' | 'application' | 'interview' | 'interviewEdit';
type AppForm = 'offer' | 'hire' | 'reject' | 'withdraw' | 'note' | 'response';

const TABS: readonly Tab[] = ['jobs', 'pipeline', 'candidates', 'interviews', 'headcount'];
const RATINGS: readonly number[] = [1, 2, 3, 4, 5];

interface JobForm {
  id: string | null;
  title: string;
  departmentId: string;
  designationId: string;
  locationId: string;
  hiringManagerEmployeeId: string;
  employmentType: EmploymentType;
  openings: number;
  reason: JobReason;
  replacesEmployeeId: string;
  targetStartDate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  requirements: string;
}

interface CandidateForm {
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  currentCompany: string;
  currentTitle: string;
  experienceYears: number | null;
  source: CandidateSource;
  referredByEmployeeId: string;
  resumeUrl: string;
  linkedInUrl: string;
  notes: string;
  jobId: string;
}

interface InterviewForm {
  id: string | null;
  applicationId: string;
  candidateName: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  locationOrLink: string;
  interviewerEmployeeId: string;
}

interface HireForm {
  useExisting: boolean;
  existingEmployeeId: string;
  employeeCode: string;
  workEmail: string;
  locationId: string;
  departmentId: string;
  designationId: string;
  managerId: string;
  employmentType: EmploymentType;
  joiningDate: string;
  probationEndDate: string;
  startOnboarding: boolean;
}

@Component({
  selector: 'app-recruitment',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './recruitment.html',
  styleUrl: './recruitment.css'
})
export class RecruitmentComponent {
  private readonly api = inject(RecruitmentService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly jobStatuses = JOB_STATUSES;
  readonly sources = SOURCES;
  readonly stages = STAGES;
  readonly boardStages = BOARD_STAGES;
  readonly moveStages = MOVE_STAGES;
  readonly modes = MODES;
  readonly modeIcon = MODE_ICON;
  readonly recommendations = RECOMMENDATIONS;
  readonly employmentTypes = EMPLOYMENT_TYPES;
  readonly ratings = RATINGS;
  readonly jobChip = JOB_CHIP;
  readonly stageChip = STAGE_CHIP;
  readonly interviewChip = INTERVIEW_CHIP;
  readonly isActiveStage = isActiveStage;
  readonly today = todayIso();

  readonly tab = signal<Tab>('jobs');
  readonly saving = signal(false);

  // ───── Shared data ─────
  readonly summary = signal<RecruitmentSummary | null>(null);
  readonly lookups = signal<Lookups>({ departments: [], designations: [], locations: [], people: [] });
  readonly allJobs = signal<JobListItem[]>([]);

  readonly isHr = computed(() => this.summary()?.isHr ?? false);
  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  /** Jobs/pipeline tab: HR, requisition maangne wale, ya jin ki koi job hai (hiring manager) */
  readonly hasJobs = computed(() => this.isHr() || (this.summary()?.canRequest ?? false) || this.allJobs().length > 0);
  readonly boardJobs = computed(() => this.allJobs().filter(j => isOpenJob(j.status)));
  readonly pendingApprovals = computed(() => this.allJobs().filter(j => j.status === 'Submitted'));
  readonly sentBack = computed(() => this.allJobs().filter(j => j.status === 'Draft' && j.isMine && j.reviewNote));

  // ───── Jobs ─────
  readonly jobs = signal<JobListItem[] | null>(null);
  readonly jobStatus = signal<JobStatus | ''>('');
  readonly departmentId = signal('');
  readonly search = signal('');
  private readonly search$ = new Subject<void>();

  // ───── Pipeline ─────
  readonly boardJobId = signal('');
  readonly board = signal<ApplicationListItem[] | null>(null);
  readonly showClosed = signal(false);
  readonly boardJob = computed(() => this.allJobs().find(j => j.id === this.boardJobId()) ?? null);
  readonly closedApps = computed(() => (this.board() ?? []).filter(a => a.stage === 'Rejected' || a.stage === 'Withdrawn'));

  // ───── Candidates ─────
  readonly candidates = signal<CandidateListItem[] | null>(null);
  readonly source = signal<CandidateSource | ''>('');

  // ───── Interviews ─────
  readonly interviews = signal<Interview[] | null>(null);
  readonly interviewScope = signal<'mine' | 'all'>('mine');
  readonly upcoming = computed(() => (this.interviews() ?? []).filter(i => i.status === 'Scheduled'));
  readonly pastInterviews = computed(() => (this.interviews() ?? []).filter(i => i.status !== 'Scheduled'));

  // ───── Headcount ─────
  readonly headcount = signal<HeadcountRow[] | null>(null);
  readonly headcountMax = computed(() => Math.max(1, ...(this.headcount() ?? []).map(h => h.employees + h.openPositions)));

  // ───── Drawer ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly job = signal<Job | null>(null);
  readonly candidate = signal<Candidate | null>(null);
  readonly app = signal<Application | null>(null);
  readonly interview = signal<Interview | null>(null);
  jobForm: JobForm | null = null;
  candidateForm: CandidateForm | null = null;
  interviewForm: InterviewForm | null = null;
  hireForm: HireForm | null = null;
  offerForm: { salary: number | null; startDate: string; expiresOn: string; note: string } | null = null;
  feedbackForm: { rating: number | null; recommendation: Recommendation | null; feedback: string } | null = null;
  appForm: AppForm | null = null;
  note = '';
  applyJobId = '';
  closeForm: { filled: boolean; note: string } | null = null;
  sendBackNote: string | null = null;
  confirm: string | null = null;

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const jobId = route.get('job');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        this.loadAllJobs(() => {
          let start: Tab = this.hasJobs() ? 'jobs' : 'interviews';
          if (wanted && TABS.includes(wanted) && this.tabAllowed(wanted)) start = wanted;
          if (jobId && this.allJobs().some(j => j.id === jobId)) {
            this.boardJobId.set(jobId);
            start = 'pipeline';
          }
          this.tab.set(start);
          this.reload();
        });
      },
      error: e => this.fail(e, 'recruitment.errors.load')
    });
  }

  tabAllowed(t: Tab): boolean {
    switch (t) {
      case 'jobs': case 'pipeline': return this.hasJobs();
      case 'candidates': case 'headcount': return this.isHr();
      default: return true;
    }
  }

  // ───── Loading ─────
  loadSummary(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
  }

  /** Sab jobs (filters ke baghair) — pipeline picker, notices aur tab counts ke liye */
  loadAllJobs(then?: () => void): void {
    this.api.jobs('', '', '').subscribe({
      next: j => {
        this.allJobs.set(j);
        if (!this.boardJobId() || !j.some(x => x.id === this.boardJobId() && isOpenJob(x.status)))
          this.boardJobId.set(j.find(x => isOpenJob(x.status))?.id ?? '');
        then?.();
      },
      error: () => then?.()
    });
  }

  loadJobs(): void {
    this.api.jobs(this.jobStatus(), this.departmentId(), this.search()).subscribe({
      next: j => this.jobs.set(j),
      error: e => {
        this.jobs.set([]);
        this.fail(e, 'recruitment.errors.load');
      }
    });
  }

  loadBoard(): void {
    const id = this.boardJobId();
    if (!id) {
      this.board.set([]);
      return;
    }
    this.api.applications(id, '', false, this.search()).subscribe({
      next: a => this.board.set(a),
      error: e => {
        this.board.set([]);
        this.fail(e, 'recruitment.errors.load');
      }
    });
  }

  loadCandidates(): void {
    this.api.candidates(this.source(), this.search()).subscribe({
      next: c => this.candidates.set(c),
      error: e => {
        this.candidates.set([]);
        this.fail(e, 'recruitment.errors.load');
      }
    });
  }

  loadInterviews(): void {
    this.api.interviews(this.interviewScope() === 'mine', '').subscribe({
      next: i => this.interviews.set(i),
      error: e => {
        this.interviews.set([]);
        this.fail(e, 'recruitment.errors.load');
      }
    });
  }

  loadHeadcount(): void {
    this.api.headcount().subscribe({ next: h => this.headcount.set(h), error: () => this.headcount.set([]) });
  }

  reload(): void {
    switch (this.tab()) {
      case 'jobs': this.loadJobs(); break;
      case 'pipeline': this.loadBoard(); break;
      case 'candidates': this.loadCandidates(); break;
      case 'interviews': this.loadInterviews(); break;
      case 'headcount': this.loadHeadcount(); break;
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

  setJobStatus(value: JobStatus | ''): void {
    this.jobStatus.set(value);
    this.loadJobs();
  }

  setDepartment(value: string): void {
    this.departmentId.set(value);
    this.loadJobs();
  }

  setSource(value: CandidateSource | ''): void {
    this.source.set(value);
    this.loadCandidates();
  }

  setBoardJob(id: string): void {
    this.boardJobId.set(id);
    this.board.set(null);
    this.loadBoard();
  }

  setScope(scope: 'mine' | 'all'): void {
    this.interviewScope.set(scope);
    this.interviews.set(null);
    this.loadInterviews();
  }

  /** Tally click → jobs list us status par */
  showJobs(status: JobStatus | ''): void {
    this.jobStatus.set(status);
    if (this.tab() !== 'jobs') {
      this.tab.set('jobs');
      this.search.set('');
    }
    this.loadJobs();
  }

  openBoard(jobId: string): void {
    this.closeDrawer();
    this.boardJobId.set(jobId);
    this.board.set(null);
    this.tab.set('pipeline');
    this.search.set('');
    this.loadBoard();
  }

  // ───── Helpers ─────
  column(stage: Stage): ApplicationListItem[] {
    return (this.board() ?? []).filter(a => a.stage === stage);
  }

  daysSince(value: string): number {
    const d = utc(value);
    return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : 0;
  }

  salary(min: number | null, max: number | null): string {
    const fmt = (n: number) => new Intl.NumberFormat(this.lang(), { maximumFractionDigits: 0 }).format(n);
    if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)}`;
    if (min !== null) return `${fmt(min)}+`;
    if (max !== null) return `≤ ${fmt(max)}`;
    return '';
  }

  /** Funnel bar: stage count / sab se bada */
  funnelWidth(counts: number[], n: number): number {
    const max = Math.max(...counts.slice(0, 5), 1);
    return Math.round((n / max) * 100);
  }

  share(n: number): number {
    return Math.round((n / this.headcountMax()) * 100);
  }

  personName(id: string | null): string {
    return id ? this.lookups().people.find(p => p.id === id)?.name ?? '' : '';
  }

  stageIndex(s: Stage): number {
    return BOARD_STAGES.indexOf(s);
  }

  isPast(i: Interview): boolean {
    const d = utc(i.scheduledAt);
    return !!d && d.getTime() < Date.now();
  }

  // ───── Job drawer ─────
  openJob(id: string): void {
    this.job.set(null);
    this.resetForms();
    this.drawer.set('job');
    this.reloadJob(id);
  }

  private reloadJob(id: string): void {
    this.api.job(id).subscribe({ next: j => this.job.set(j), error: e => this.fail(e, 'recruitment.errors.load') });
  }

  jobAction(action: 'submit' | 'approve' | 'hold' | 'resume' | 'reopen'): void {
    const j = this.job()?.job;
    if (!j) return;
    this.submitJob(this.api.jobAction(j.id, action), 'recruitment.msg.job.' + action, { title: j.title });
  }

  sendBack(): void {
    const j = this.job()?.job;
    if (!j) return;
    if (this.sendBackNote === null) {
      this.resetForms();
      this.sendBackNote = '';
      return;
    }
    if (!this.sendBackNote.trim()) return;
    this.submitJob(this.api.sendBack(j.id, this.sendBackNote.trim()), 'recruitment.msg.job.sentBack', { title: j.title });
  }

  startClose(filled: boolean): void {
    this.resetForms();
    this.closeForm = { filled, note: '' };
  }

  closeJob(): void {
    const j = this.job()?.job;
    const f = this.closeForm;
    if (!j || !f) return;
    this.submitJob(this.api.closeJob(j.id, f.filled, f.note.trim() || null), f.filled ? 'recruitment.msg.job.filled' : 'recruitment.msg.job.cancelled', { title: j.title });
  }

  deleteJob(): void {
    const j = this.job()?.job;
    if (!j) return;
    if (this.confirm !== 'deleteJob') {
      this.confirm = 'deleteJob';
      return;
    }
    this.saving.set(true);
    this.api.deleteJob(j.id).subscribe({
      next: () => this.done('recruitment.msg.job.deleted', { title: j.title }),
      error: e => this.fail(e)
    });
  }

  private submitJob(req: Observable<void>, key: string, params?: Record<string, string>): void {
    const j = this.job()?.job;
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForms();
        this.alert.success(this.translate.instant(key, params));
        if (j) this.reloadJob(j.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Job form ─────
  newJob(): void {
    const s = this.summary();
    this.jobForm = {
      id: null, title: '', departmentId: '', designationId: '', locationId: '',
      hiringManagerEmployeeId: s?.canManage ? '' : s?.myEmployeeId ?? '', employmentType: 'FullTime', openings: 1,
      reason: 'NewPosition', replacesEmployeeId: '', targetStartDate: addDays(this.today, 45), salaryMin: null, salaryMax: null,
      description: '', requirements: ''
    };
    this.confirm = null;
    this.drawer.set('jobEdit');
  }

  editJob(): void {
    const d = this.job();
    if (!d) return;
    const j = d.job;
    this.jobForm = {
      id: j.id, title: j.title, departmentId: j.departmentId, designationId: j.designationId ?? '', locationId: j.locationId ?? '',
      hiringManagerEmployeeId: j.hiringManagerEmployeeId ?? '', employmentType: j.employmentType, openings: j.openings, reason: j.reason,
      replacesEmployeeId: d.replacesEmployeeId ?? '', targetStartDate: j.targetStartDate ?? '', salaryMin: j.salaryMin, salaryMax: j.salaryMax,
      description: d.description ?? '', requirements: d.requirements ?? ''
    };
    this.confirm = null;
    this.drawer.set('jobEdit');
  }

  canSaveJob(): boolean {
    const f = this.jobForm;
    return !!f && !!f.title.trim() && !!f.departmentId && f.openings >= 1 && f.openings <= 500
      && (f.salaryMin === null || f.salaryMin >= 0) && (f.salaryMax === null || f.salaryMin === null || f.salaryMax >= f.salaryMin);
  }

  saveJob(): void {
    const f = this.jobForm;
    if (!f || !this.canSaveJob()) return;
    this.saving.set(true);
    const isNew = !f.id;
    this.api.saveJob(f.id, {
      title: f.title.trim(), departmentId: f.departmentId, designationId: f.designationId || null, locationId: f.locationId || null,
      hiringManagerEmployeeId: f.hiringManagerEmployeeId || null, employmentType: f.employmentType, openings: f.openings, reason: f.reason,
      replacesEmployeeId: f.reason === 'Replacement' ? f.replacesEmployeeId || null : null, targetStartDate: f.targetStartDate || null,
      salaryMin: f.salaryMin ?? null, salaryMax: f.salaryMax ?? null, description: f.description.trim() || null, requirements: f.requirements.trim() || null
    }).subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(isNew ? 'recruitment.msg.job.created' : 'recruitment.msg.job.saved', { title: f.title.trim() }));
        this.jobForm = null;
        this.refreshLists();
        this.openJob(id);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Candidate drawer ─────
  openCandidate(id: string): void {
    this.candidate.set(null);
    this.resetForms();
    this.drawer.set('candidate');
    this.api.candidate(id).subscribe({ next: c => this.candidate.set(c), error: e => this.fail(e, 'recruitment.errors.load') });
  }

  newCandidate(jobId = ''): void {
    this.candidateForm = {
      id: null, firstName: '', lastName: '', email: '', phone: '', city: '', currentCompany: '', currentTitle: '', experienceYears: null,
      source: 'Direct', referredByEmployeeId: '', resumeUrl: '', linkedInUrl: '', notes: '',
      jobId: jobId || (this.tab() === 'pipeline' ? this.boardJobId() : '')
    };
    this.confirm = null;
    this.drawer.set('candidateEdit');
  }

  editCandidate(): void {
    const c = this.candidate();
    if (!c) return;
    this.candidateForm = {
      id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone ?? '', city: c.city ?? '',
      currentCompany: c.currentCompany ?? '', currentTitle: c.currentTitle ?? '', experienceYears: c.experienceYears, source: c.source,
      referredByEmployeeId: c.referredByEmployeeId ?? '', resumeUrl: c.resumeUrl ?? '', linkedInUrl: c.linkedInUrl ?? '', notes: c.notes ?? '', jobId: ''
    };
    this.confirm = null;
    this.drawer.set('candidateEdit');
  }

  linkOk(v: string): boolean {
    return !v.trim() || isHttpLink(v);
  }

  canSaveCandidate(): boolean {
    const f = this.candidateForm;
    return !!f && !!f.firstName.trim() && !!f.lastName.trim() && /^\S+@\S+\.\S+$/.test(f.email.trim())
      && this.linkOk(f.resumeUrl) && this.linkOk(f.linkedInUrl)
      && (f.experienceYears === null || (f.experienceYears >= 0 && f.experienceYears <= 60));
  }

  saveCandidate(): void {
    const f = this.candidateForm;
    if (!f || !this.canSaveCandidate()) return;
    this.saving.set(true);
    const isNew = !f.id;
    const name = `${f.firstName.trim()} ${f.lastName.trim()}`;
    this.api.saveCandidate(f.id, {
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim() || null, city: f.city.trim() || null,
      currentCompany: f.currentCompany.trim() || null, currentTitle: f.currentTitle.trim() || null, experienceYears: f.experienceYears ?? null,
      source: f.source, referredByEmployeeId: f.source === 'Referral' ? f.referredByEmployeeId || null : null,
      resumeUrl: f.resumeUrl.trim() || null, linkedInUrl: f.linkedInUrl.trim() || null, notes: f.notes.trim() || null, jobId: f.jobId || null
    }).subscribe({
      next: id => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(isNew ? (f.jobId ? 'recruitment.msg.candidateAdded' : 'recruitment.msg.candidateCreated') : 'recruitment.msg.candidateSaved', { name }));
        this.candidateForm = null;
        this.refreshLists();
        if (isNew && f.jobId && this.tab() === 'pipeline') this.closeDrawer();
        else this.openCandidate(id);
      },
      error: e => this.fail(e)
    });
  }

  deleteCandidate(): void {
    const c = this.candidate();
    if (!c) return;
    if (this.confirm !== 'deleteCandidate') {
      this.confirm = 'deleteCandidate';
      return;
    }
    this.saving.set(true);
    this.api.deleteCandidate(c.id).subscribe({
      next: () => this.done('recruitment.msg.candidateDeleted', { name: `${c.firstName} ${c.lastName}` }),
      error: e => this.fail(e)
    });
  }

  /** Candidate drawer → kisi aur open job par lagana */
  applyJobs(): JobListItem[] {
    const c = this.candidate();
    const taken = new Set((c?.applications ?? []).map(a => a.jobId));
    return this.allJobs().filter(j => j.status === 'Open' && !taken.has(j.id));
  }

  applyToJob(): void {
    const c = this.candidate();
    if (!c || !this.applyJobId) return;
    const job = this.allJobs().find(j => j.id === this.applyJobId);
    this.saving.set(true);
    this.api.apply(this.applyJobId, c.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.applyJobId = '';
        this.alert.success(this.translate.instant('recruitment.msg.applied', { name: `${c.firstName} ${c.lastName}`, title: job?.title ?? '' }));
        this.openCandidate(c.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Application drawer ─────
  openApp(id: string): void {
    this.app.set(null);
    this.resetForms();
    this.drawer.set('application');
    this.reloadApp(id);
  }

  private reloadApp(id: string): void {
    this.api.application(id).subscribe({ next: a => this.app.set(a), error: e => this.fail(e, 'recruitment.errors.load') });
  }

  startAppForm(form: AppForm): void {
    const a = this.app();
    if (!a) return;
    this.resetForms();
    this.appForm = form;
    this.note = '';
    if (form === 'offer') {
      const j = this.allJobs().find(x => x.id === a.application.jobId);
      this.offerForm = {
        salary: a.offerSalary ?? j?.salaryMin ?? null, startDate: a.offerStartDate ?? j?.targetStartDate ?? '',
        expiresOn: a.offerExpiresOn ?? addDays(this.today, 7), note: ''
      };
    }
    if (form === 'hire') {
      const start = a.offerStartDate && a.offerStartDate >= this.today ? a.offerStartDate : addDays(this.today, 14);
      this.hireForm = {
        useExisting: false, existingEmployeeId: '', employeeCode: '', workEmail: '', locationId: a.jobLocationId ?? '',
        departmentId: a.jobDepartmentId, designationId: a.jobDesignationId ?? '', managerId: a.jobHiringManagerId ?? '',
        employmentType: a.jobEmploymentType, joiningDate: start, probationEndDate: addDays(start, 90), startOnboarding: true
      };
    }
  }

  moveTo(stage: Stage): void {
    const a = this.app();
    if (!a) return;
    this.submitApp(this.api.move(a.application.id, stage, null), 'recruitment.msg.moved',
      { name: a.application.candidateName, stage: this.translate.instant('recruitment.stage.' + stage) });
  }

  /** Reject / withdraw (wajah ke saath) */
  saveExit(stage: 'Rejected' | 'Withdrawn'): void {
    const a = this.app();
    if (!a || (stage === 'Rejected' && !this.note.trim())) return;
    this.submitApp(this.api.move(a.application.id, stage, this.note.trim() || null),
      stage === 'Rejected' ? 'recruitment.msg.rejected' : 'recruitment.msg.withdrawn', { name: a.application.candidateName });
  }

  saveNote(): void {
    const a = this.app();
    if (!a || !this.note.trim()) return;
    this.submitApp(this.api.addNote(a.application.id, this.note.trim()), 'recruitment.msg.noteAdded');
  }

  rate(n: number): void {
    const a = this.app();
    if (!a || !a.canWork) return;
    const value = a.application.rating === n ? null : n;
    this.submitApp(this.api.rate(a.application.id, value), 'recruitment.msg.rated', undefined, false);
  }

  saveOffer(): void {
    const a = this.app();
    const f = this.offerForm;
    if (!a || !f) return;
    this.submitApp(this.api.offer(a.application.id, {
      salary: f.salary ?? null, startDate: f.startDate || null, expiresOn: f.expiresOn || null, note: f.note.trim() || null
    }), 'recruitment.msg.offerMade', { name: a.application.candidateName });
  }

  offerResponse(accepted: boolean): void {
    const a = this.app();
    if (!a) return;
    this.submitApp(this.api.offerResponse(a.application.id, accepted, this.note.trim() || null),
      accepted ? 'recruitment.msg.offerAccepted' : 'recruitment.msg.offerDeclined', { name: a.application.candidateName });
  }

  canHire(): boolean {
    const f = this.hireForm;
    if (!f || !f.joiningDate) return false;
    if (f.useExisting) return !!f.existingEmployeeId;
    return /^\S+@\S+\.\S+$/.test(f.workEmail.trim()) && !!f.locationId && !!f.departmentId && !!f.designationId
      && (!f.probationEndDate || f.probationEndDate > f.joiningDate);
  }

  hire(): void {
    const a = this.app();
    const f = this.hireForm;
    if (!a || !f || !this.canHire()) return;
    if (this.confirm !== 'hire') {
      this.confirm = 'hire';
      return;
    }
    this.saving.set(true);
    this.api.hire(a.application.id, {
      existingEmployeeId: f.useExisting ? f.existingEmployeeId : null,
      employeeCode: f.useExisting ? null : f.employeeCode.trim() || null,
      workEmail: f.useExisting ? null : f.workEmail.trim(),
      locationId: f.useExisting ? null : f.locationId, departmentId: f.useExisting ? null : f.departmentId,
      designationId: f.useExisting ? null : f.designationId, managerId: f.useExisting ? null : f.managerId || null,
      employmentType: f.useExisting ? null : f.employmentType, joiningDate: f.joiningDate,
      probationEndDate: f.useExisting ? null : f.probationEndDate || null, startOnboarding: f.startOnboarding, onboardingTemplateId: null
    }).subscribe({
      next: r => {
        this.saving.set(false);
        this.resetForms();
        this.alert.success(this.translate.instant('recruitment.msg.hired', { name: a.application.candidateName, code: r.employeeCode }));
        if (r.onboardingError) this.alert.warning(this.translate.instant('recruitment.msg.onboardingFailed', { reason: r.onboardingError }));
        if (r.jobFilled) this.alert.success(this.translate.instant('recruitment.msg.jobFilled', { title: a.application.jobTitle }));
        this.reloadApp(a.application.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  private submitApp(req: Observable<void>, key: string, params?: Record<string, string>, toast = true): void {
    const a = this.app();
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForms();
        if (toast) this.alert.success(this.translate.instant(key, params));
        if (a) this.reloadApp(a.application.id);
        this.refreshLists();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Interviews ─────
  openInterview(i: Interview): void {
    this.resetForms();
    this.interview.set(i);
    this.feedbackForm = i.canFeedback ? { rating: i.rating, recommendation: i.recommendation, feedback: i.feedback ?? '' } : null;
    this.drawer.set('interview');
  }

  newInterview(): void {
    const a = this.app();
    if (!a) return;
    const start = new Date();
    start.setDate(start.getDate() + 2);
    start.setHours(11, 0, 0, 0);
    const n = a.interviews.length + 1;
    this.interviewForm = {
      id: null, applicationId: a.application.id, candidateName: a.application.candidateName,
      title: this.translate.instant(n === 1 ? 'recruitment.firstRound' : 'recruitment.roundN', { n }),
      scheduledAt: toLocalInput(start), durationMinutes: 45, mode: 'Video', locationOrLink: '', interviewerEmployeeId: a.jobHiringManagerId ?? ''
    };
    this.confirm = null;
    this.drawer.set('interviewEdit');
  }

  editInterview(i: Interview): void {
    const d = utc(i.scheduledAt) ?? new Date();
    this.interviewForm = {
      id: i.id, applicationId: i.applicationId, candidateName: i.candidateName, title: i.title, scheduledAt: toLocalInput(d),
      durationMinutes: i.durationMinutes, mode: i.mode, locationOrLink: i.locationOrLink ?? '', interviewerEmployeeId: i.interviewerEmployeeId
    };
    this.confirm = null;
    this.drawer.set('interviewEdit');
  }

  canSaveInterview(): boolean {
    const f = this.interviewForm;
    return !!f && !!f.title.trim() && !!f.scheduledAt && !!f.interviewerEmployeeId && f.durationMinutes >= 5 && f.durationMinutes <= 480;
  }

  saveInterview(): void {
    const f = this.interviewForm;
    if (!f || !this.canSaveInterview()) return;
    this.saving.set(true);
    const body = {
      title: f.title.trim(), scheduledAt: new Date(f.scheduledAt).toISOString(), durationMinutes: f.durationMinutes, mode: f.mode,
      locationOrLink: f.locationOrLink.trim() || null, interviewerEmployeeId: f.interviewerEmployeeId
    };
    const req: Observable<unknown> = f.id ? this.api.updateInterview(f.id, body) : this.api.schedule(f.applicationId, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant(f.id ? 'recruitment.msg.interviewSaved' : 'recruitment.msg.interviewScheduled',
          { name: f.candidateName, who: this.personName(f.interviewerEmployeeId) }));
        this.interviewForm = null;
        this.refreshLists();
        if (this.app()) {
          this.drawer.set('application');
          this.reloadApp(f.applicationId);
        } else this.closeDrawer();
      },
      error: e => this.fail(e)
    });
  }

  interviewAction(i: Interview, action: 'cancel' | 'no-show'): void {
    const key = action + ':' + i.id;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.saving.set(true);
    this.api.interviewAction(i.id, action).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirm = null;
        this.alert.success(this.translate.instant(action === 'cancel' ? 'recruitment.msg.interviewCancelled' : 'recruitment.msg.noShow', { name: i.candidateName }));
        this.refreshLists();
        if (this.drawer() === 'application' && this.app()) this.reloadApp(this.app()!.application.id);
        else if (this.drawer() === 'interview') this.closeDrawer();
      },
      error: e => this.fail(e)
    });
  }

  saveFeedback(): void {
    const i = this.interview();
    const f = this.feedbackForm;
    if (!i || !f || !f.rating || !f.recommendation) return;
    this.saving.set(true);
    this.api.feedback(i.id, { rating: f.rating, recommendation: f.recommendation, feedback: f.feedback.trim() || null }).subscribe({
      next: () => this.done('recruitment.msg.feedbackSaved', { name: i.candidateName }),
      error: e => this.fail(e)
    });
  }

  /** Interview drawer se application kholna (sirf HR / hiring manager) */
  canOpenApp(i: Interview): boolean {
    return this.isHr() || this.allJobs().some(j => j.id === i.jobId && j.isMine);
  }

  // ───── Plumbing ─────
  private resetForms(): void {
    this.appForm = null;
    this.offerForm = null;
    this.hireForm = null;
    this.feedbackForm = null;
    this.closeForm = null;
    this.sendBackNote = null;
    this.confirm = null;
    this.note = '';
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.job.set(null);
    this.candidate.set(null);
    this.app.set(null);
    this.interview.set(null);
    this.jobForm = null;
    this.candidateForm = null;
    this.interviewForm = null;
    this.applyJobId = '';
    this.resetForms();
  }

  private refreshLists(): void {
    this.loadSummary();
    this.loadAllJobs();
    this.reload();
  }

  private done(key: string, params?: Record<string, string>): void {
    this.saving.set(false);
    this.closeDrawer();
    this.alert.success(this.translate.instant(key, params));
    this.refreshLists();
  }

  private fail(e: unknown, fallback = 'recruitment.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
