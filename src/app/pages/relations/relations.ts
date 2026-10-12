import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { todayIso } from '../lifecycle/lifecycle.models';
import { CaseFilter, RelationsService } from './relations.service';
import {
  ACTIONS, ALWAYS_RESTRICTED, AccessLogItem, CASE_TYPES, CONCERN_TYPES, CaseAction, CaseConfidentiality, CaseDetail, CaseEntry,
  CaseListItem, CaseMemberRole, CaseOutcome, CasePartyRole, CasePhase, CaseScope, CaseSeverity, CaseSource, CaseType, ConcernDetail,
  ConcernListItem, ENTRY_ICON, Lookups, MAX_ESCALATION, MAX_RESPONDENTS, MEMBER_ROLES, OUTCOMES, PARTY_ROLES, PHASES, PHASE_CHIP,
  RelationsSummary, SCOPES, SENSITIVE, SEVERITIES, SEVERITY_CHIP, SOURCES, Stage, TYPE_ICON, initials, isHttpUrl
} from './relations.models';

type Tab = 'cases' | 'concerns' | 'stages';
type Drawer = 'case' | 'caseForm' | 'raise' | 'concern' | 'stage';
type Section = 'overview' | 'timeline' | 'people' | 'evidence' | 'access';
type Action = 'move' | 'close' | 'reopen' | 'deadline' | 'escalate' | 'owner' | 'member' | 'party' | 'evidence' | 'breakGlass';

const TABS: readonly Tab[] = ['cases', 'concerns', 'stages'];

interface PartyRow {
  key: number;
  employeeId: string;
  name: string;
  role: CasePartyRole;
}

interface CaseForm {
  id: string | null;
  isOwner: boolean;
  title: string;
  description: string;
  type: CaseType;
  severity: CaseSeverity;
  confidentiality: CaseConfidentiality;
  source: CaseSource;
  reportedOn: string;
  incidentOn: string;
  location: string;
  reporterEmployeeId: string;
  ownerEmployeeId: string;
  dueOn: string;
  parties: PartyRow[];
}

interface RaiseForm {
  type: CaseType | '';
  title: string;
  description: string;
  incidentOn: string;
  location: string;
  picked: Set<string>;
  search: string;
  hideIdentity: boolean;
  evidenceTitle: string;
  evidenceUrl: string;
}

interface StageForm {
  id: string | null;
  used: boolean;
  name: string;
  description: string;
  phase: CasePhase;
  sortOrder: number;
  targetDays: number | null;
  isActive: boolean;
}

/** Case drawer ke andar ek waqt mein ek hi action form khulta hai. */
interface ActForm {
  stageId: string;
  note: string;
  outcome: CaseOutcome | '';
  action: CaseAction | '';
  summary: string;
  reason: string;
  dueOn: string;
  employeeId: string;
  role: CaseMemberRole;
  partyRole: CasePartyRole;
  external: boolean;
  name: string;
  title: string;
  url: string;
  restricted: boolean;
}

@Component({
  selector: 'app-relations',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './relations.html',
  styleUrl: './relations.css'
})
export class RelationsComponent {
  private readonly api = inject(RelationsService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly today = todayIso();
  readonly phases = PHASES;
  readonly caseTypes = CASE_TYPES;
  readonly concernTypes = CONCERN_TYPES;
  readonly severities = SEVERITIES;
  readonly sources = SOURCES;
  readonly memberRoles = MEMBER_ROLES;
  readonly partyRoles = PARTY_ROLES;
  readonly outcomes = OUTCOMES;
  readonly actions = ACTIONS;
  readonly scopes = SCOPES;
  readonly phaseChip = PHASE_CHIP;
  readonly severityChip = SEVERITY_CHIP;
  readonly typeIcon = TYPE_ICON;
  readonly entryIcon = ENTRY_ICON;
  readonly maxRespondents = MAX_RESPONDENTS;
  readonly maxEscalation = MAX_ESCALATION;
  readonly initials = initials;
  readonly sections: readonly Section[] = ['overview', 'timeline', 'people', 'evidence', 'access'];

  readonly tab = signal<Tab>('cases');
  readonly saving = signal(false);
  readonly summary = signal<RelationsSummary | null>(null);
  readonly lookups = signal<Lookups>({ stages: [], people: [] });

  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  readonly seesCases = computed(() => this.summary()?.seesCases ?? false);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);
  readonly myId = computed(() => this.summary()?.myEmployeeId ?? null);
  readonly activeStages = computed(() => this.lookups().stages.filter(s => s.isActive));
  readonly closedStages = computed(() => this.activeStages().filter(s => s.phase === 'Closed'));
  readonly workStages = computed(() => this.activeStages().filter(s => s.phase !== 'Closed'));

  // ───── Cases ─────
  readonly cases = signal<CaseListItem[] | null>(null);
  readonly scope = signal<CaseScope>('all');
  readonly phase = signal<CasePhase | ''>('');
  readonly type = signal<CaseType | ''>('');
  readonly severity = signal<CaseSeverity | ''>('');
  readonly includeClosed = signal(false);
  readonly search = signal('');
  private readonly search$ = new Subject<void>();

  // ───── Concerns ─────
  readonly concerns = signal<ConcernListItem[] | null>(null);

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly detail = signal<CaseDetail | null>(null);
  readonly section = signal<Section>('overview');
  readonly accessLog = signal<AccessLogItem[] | null>(null);
  readonly concern = signal<ConcernDetail | null>(null);

  caseForm: CaseForm | null = null;
  raiseForm: RaiseForm | null = null;
  stageForm: StageForm | null = null;
  act: ActForm | null = null;
  acting: Action | null = null;
  noteText = '';
  noteShared = false;
  replyText = '';
  confirm: string | null = null;
  private partyKey = 0;

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadCases());

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const caseId = route.get('case');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        this.loadLookups();
        const fallback: Tab = s.seesCases ? 'cases' : 'concerns';
        const ok = wanted && TABS.includes(wanted) && (wanted !== 'cases' || s.seesCases) && (wanted !== 'stages' || s.canManage);
        this.setTab(ok ? wanted : fallback);
        if (caseId && s.seesCases) this.openCase(caseId);
      },
      error: e => this.fail(e, 'relations.errors.load')
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'cases' && this.cases() === null) this.loadCases();
    if (t === 'concerns' && this.concerns() === null) this.loadConcerns();
  }

  // ───── Loading ─────
  private loadLookups(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
  }

  loadCases(): void {
    if (!this.seesCases()) return;
    const f: CaseFilter = {
      scope: this.scope(), phase: this.phase(), type: this.type(), severity: this.severity(),
      includeClosed: this.includeClosed(), search: this.search()
    };
    this.api.cases(f).subscribe({ next: l => this.cases.set(l), error: () => this.cases.set([]) });
  }

  loadConcerns(): void {
    if (!this.linked()) {
      this.concerns.set([]);
      return;
    }
    this.api.concerns().subscribe({ next: l => this.concerns.set(l), error: () => this.concerns.set([]) });
  }

  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    if (this.cases() !== null) this.loadCases();
    if (this.concerns() !== null) this.loadConcerns();
  }

  setScope(v: CaseScope): void {
    this.scope.set(v);
    this.loadCases();
  }

  setFilter(which: 'phase' | 'type' | 'severity', v: string): void {
    if (which === 'phase') this.phase.set(v as CasePhase | '');
    if (which === 'type') this.type.set(v as CaseType | '');
    if (which === 'severity') this.severity.set(v as CaseSeverity | '');
    this.loadCases();
  }

  setIncludeClosed(v: boolean): void {
    this.includeClosed.set(v);
    this.loadCases();
  }

  /** Workflow strip click: us phase ke cases (Closed ho to band cases bhi). */
  pickPhase(p: CasePhase): void {
    const off = this.phase() === p;
    this.phase.set(off ? '' : p);
    if (!off && p === 'Closed') this.includeClosed.set(true);
    this.loadCases();
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.search$.next();
  }

  /** Tally click: scope badal ke list. */
  showScope(v: CaseScope): void {
    this.setTab('cases');
    this.setScope(v);
  }

  // ───── Display helpers ─────
  /** Deadline ka label: aaj, kal, N din baqi, N din late. */
  dueKey(daysLeft: number | null): { key: string; n: number } | null {
    if (daysLeft === null) return null;
    if (daysLeft < 0) return { key: 'relations.overdueBy', n: -daysLeft };
    if (daysLeft === 0) return { key: 'relations.dueToday', n: 0 };
    return { key: daysLeft === 1 ? 'relations.dueTomorrow' : 'relations.dueInDays', n: daysLeft };
  }

  phaseIndex(p: CasePhase): number {
    return PHASES.indexOf(p);
  }

  phaseCount(p: CasePhase): number {
    const key = PHASES.indexOf(p) + 1;
    return this.summary()?.byPhase.find(c => c.key === key)?.count ?? 0;
  }

  isBubble(e: CaseEntry): boolean {
    return e.kind === 'Note' || e.kind === 'Message' || e.kind === 'ReporterMessage';
  }

  /** Timeline line ka naam: hidden reporter, team, ya khud. */
  byLabel(e: CaseEntry): string {
    if (e.byMe) return this.translate.instant('relations.you');
    if (e.byName) return e.byName;
    return this.translate.instant(e.byReporter ? 'relations.reporter' : 'relations.team');
  }

  /** Stage drop-down mein mojooda stage ke ilawa sab. */
  moveTargets(d: CaseDetail): Stage[] {
    return this.workStages().filter(s => s.id !== d.case.stageId);
  }

  /** Jo log case par kaam kar sakte hain: reporter/party/member nahi. */
  eligible(d: CaseDetail): { id: string; name: string; extra: string | null }[] {
    const blocked = new Set<string>([
      ...d.members.map(m => m.employeeId),
      ...d.parties.filter(p => p.employeeId).map(p => p.employeeId!)
    ]);
    return this.lookups().people.filter(p => !blocked.has(p.id));
  }

  // ───── Case detail ─────
  openCase(id: string, section: Section = 'overview'): void {
    this.resetForms();
    this.detail.set(null);
    this.accessLog.set(null);
    this.section.set(section);
    this.drawer.set('case');
    this.api.case(id).subscribe({
      next: d => this.detail.set(d),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'relations.errors.load');
      }
    });
  }

  private reloadCase(): void {
    const id = this.detail()?.case.id;
    if (!id || this.drawer() !== 'case') return;
    this.api.case(id).subscribe({ next: d => this.detail.set(d), error: () => undefined });
    if (this.accessLog() !== null) this.loadAccess();
  }

  setSection(s: Section): void {
    this.section.set(s);
    this.cancelAct();
    if (s === 'access' && this.accessLog() === null) this.loadAccess();
  }

  private loadAccess(): void {
    const id = this.detail()?.case.id;
    if (id) this.api.accessLog(id).subscribe({ next: l => this.accessLog.set(l), error: () => this.accessLog.set([]) });
  }

  startAct(a: Action): void {
    const d = this.detail();
    this.confirm = null;
    this.acting = a;
    this.act = {
      stageId: a === 'close' ? this.closedStages()[0]?.id ?? '' : a === 'move' ? (d ? this.nextStage(d)?.id ?? '' : '') : '',
      note: '', outcome: '', action: '', summary: '', reason: '', dueOn: d?.case.dueOn ?? '', employeeId: '', role: 'Investigator',
      partyRole: 'Witness', external: false, name: '', title: '', url: '', restricted: true
    };
  }

  cancelAct(): void {
    this.acting = null;
    this.act = null;
  }

  /** Agla stage (sort order mein) — move form ka default. */
  private nextStage(d: CaseDetail): Stage | undefined {
    const list = this.workStages();
    const i = list.findIndex(s => s.id === d.case.stageId);
    return list[i + 1] ?? list.find(s => s.id !== d.case.stageId);
  }

  canSubmitAct(): boolean {
    const f = this.act;
    if (!f || !this.acting) return false;
    switch (this.acting) {
      case 'move': return !!f.stageId;
      case 'close': return !!f.outcome && !!f.action && f.summary.trim().length >= 10;
      case 'reopen': return f.reason.trim().length >= 3;
      case 'deadline': return !f.dueOn || f.dueOn >= this.today;
      case 'escalate': return f.reason.trim().length >= 3;
      case 'owner': return !!f.employeeId;
      case 'member': return !!f.employeeId;
      case 'party': return f.external ? f.name.trim().length >= 2 : !!f.employeeId;
      case 'evidence': return !!f.title.trim() && isHttpUrl(f.url);
      case 'breakGlass': return f.reason.trim().length >= 10;
    }
  }

  submitAct(): void {
    const d = this.detail();
    const f = this.act;
    const a = this.acting;
    if (!d || !f || !a || !this.canSubmitAct()) return;
    const id = d.case.id;
    const calls: Record<Action, () => Observable<void>> = {
      move: () => this.api.move(id, f.stageId, f.note.trim() || null),
      close: () => this.api.close(id, f.stageId || null, f.outcome as CaseOutcome, f.action as CaseAction, f.summary.trim()),
      reopen: () => this.api.reopen(id, f.stageId || null, f.reason.trim()),
      deadline: () => this.api.deadline(id, f.dueOn || null, f.reason.trim() || null),
      escalate: () => this.api.escalate(id, f.reason.trim(), f.employeeId || null),
      owner: () => this.api.owner(id, f.employeeId),
      member: () => this.api.addMember(id, f.employeeId, f.role),
      party: () => this.api.addParty(id, {
        employeeId: f.external ? null : f.employeeId, name: f.external ? f.name.trim() : null, role: f.partyRole, note: f.note.trim() || null
      }),
      evidence: () => this.api.addEvidence(id, f.title.trim(), f.url.trim(), f.note.trim() || null, f.restricted),
      breakGlass: () => this.api.breakGlass(id, f.reason.trim())
    };
    this.caseCall(calls[a](), `relations.msg.${a}`, d.case.code);
  }

  take(d: CaseDetail): void {
    this.caseCall(this.api.take(d.case.id), 'relations.msg.take', d.case.code);
  }

  removeMember(d: CaseDetail, employeeId: string): void {
    const key = 'm:' + employeeId;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.caseCall(this.api.removeMember(d.case.id, employeeId), 'relations.msg.memberRemoved', d.case.code);
  }

  removeParty(d: CaseDetail, partyId: string): void {
    const key = 'p:' + partyId;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.caseCall(this.api.removeParty(d.case.id, partyId), 'relations.msg.partyRemoved', d.case.code);
  }

  removeEvidence(d: CaseDetail, evidenceId: string): void {
    const key = 'e:' + evidenceId;
    if (this.confirm !== key) {
      this.confirm = key;
      return;
    }
    this.caseCall(this.api.removeEvidence(d.case.id, evidenceId), 'relations.msg.evidenceRemoved', d.case.code);
  }

  addNote(d: CaseDetail): void {
    const text = this.noteText.trim();
    if (!text) return;
    const shared = this.noteShared && d.hasReporter;
    this.saving.set(true);
    this.api.note(d.case.id, text, shared).subscribe({
      next: () => {
        this.noteText = '';
        this.noteShared = false;
        this.done(shared ? 'relations.msg.messageSent' : 'relations.msg.noteAdded', { code: d.case.code });
        this.reloadCase();
      },
      error: e => this.fail(e)
    });
  }

  private caseCall(call$: Observable<void>, key: string, code: string): void {
    this.saving.set(true);
    call$.subscribe({
      next: () => {
        this.cancelAct();
        this.done(key, { code });
        this.loadLookups();
        this.reloadCase();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Case form ─────
  newCase(): void {
    this.resetForms();
    const defaults = this.defaultsFor('Complaint');
    this.caseForm = {
      id: null, isOwner: true, title: '', description: '', type: 'Complaint', severity: defaults.severity,
      confidentiality: defaults.confidentiality, source: 'Hr', reportedOn: this.today, incidentOn: '', location: '',
      reporterEmployeeId: '', ownerEmployeeId: this.myId() ?? '', dueOn: '', parties: []
    };
    this.drawer.set('caseForm');
  }

  editCase(d: CaseDetail): void {
    const c = d.case;
    this.resetForms();
    this.caseForm = {
      id: c.id, isOwner: d.view === 'Owner', title: c.title ?? '', description: d.description ?? '', type: c.type, severity: c.severity,
      confidentiality: c.confidentiality, source: c.source, reportedOn: c.reportedOn, incidentOn: d.incidentOn ?? '',
      location: d.location ?? '', reporterEmployeeId: '', ownerEmployeeId: c.ownerEmployeeId ?? '', dueOn: c.dueOn ?? '', parties: []
    };
    this.drawer.set('caseForm');
  }

  private defaultsFor(t: CaseType): { severity: CaseSeverity; confidentiality: CaseConfidentiality } {
    return SENSITIVE.includes(t) ? { severity: 'High', confidentiality: 'Restricted' } : { severity: 'Medium', confidentiality: 'Standard' };
  }

  forcedRestricted(t: CaseType | ''): boolean {
    return !!t && ALWAYS_RESTRICTED.includes(t);
  }

  setCaseType(t: CaseType): void {
    const f = this.caseForm;
    if (!f) return;
    f.type = t;
    if (!f.id) {
      const d = this.defaultsFor(t);
      f.severity = d.severity;
      f.confidentiality = d.confidentiality;
    }
    if (this.forcedRestricted(t)) f.confidentiality = 'Restricted';
  }

  addPartyRow(): void {
    const f = this.caseForm;
    if (f && f.parties.length < 30) f.parties.push({ key: ++this.partyKey, employeeId: '', name: '', role: 'Respondent' });
  }

  removePartyRow(i: number): void {
    this.caseForm?.parties.splice(i, 1);
  }

  canSaveCase(): boolean {
    const f = this.caseForm;
    if (!f || f.title.trim().length < 3) return false;
    if (f.dueOn && f.dueOn < this.today && !f.id) return false;
    if (f.incidentOn && f.incidentOn > this.today) return false;
    if (f.ownerEmployeeId && f.ownerEmployeeId === f.reporterEmployeeId) return false;
    return f.parties.every(p => p.employeeId ? p.employeeId !== f.ownerEmployeeId : p.name.trim().length >= 2);
  }

  saveCase(): void {
    const f = this.caseForm;
    if (!f || !this.canSaveCase()) return;
    const title = f.title.trim();
    this.saving.set(true);
    const call$: Observable<unknown> = f.id
      ? this.api.update(f.id, {
        title, description: f.description.trim() || null, type: f.type, severity: f.severity, confidentiality: f.confidentiality,
        incidentOn: f.incidentOn || null, location: f.location.trim() || null
      })
      : this.api.create({
        title, description: f.description.trim() || null, type: f.type, severity: f.severity, confidentiality: f.confidentiality,
        source: f.source, reportedOn: f.reportedOn || null, incidentOn: f.incidentOn || null, location: f.location.trim() || null,
        reporterEmployeeId: f.reporterEmployeeId || null, ownerEmployeeId: f.ownerEmployeeId || null, dueOn: f.dueOn || null,
        parties: f.parties
          .filter(p => p.employeeId !== f.reporterEmployeeId || !p.employeeId)
          .map(p => ({ employeeId: p.employeeId || null, name: p.employeeId ? null : p.name.trim(), role: p.role, note: null }))
      });
    call$.subscribe({
      next: r => {
        const id = f.id ?? (r as string);
        this.done(f.id ? 'relations.msg.saved' : 'relations.msg.created', { code: title });
        this.openCase(id);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Concerns (employee) ─────
  raise(): void {
    this.resetForms();
    this.raiseForm = {
      type: '', title: '', description: '', incidentOn: '', location: '', picked: new Set(), search: '', hideIdentity: false,
      evidenceTitle: '', evidenceUrl: ''
    };
    this.drawer.set('raise');
  }

  raisePeople(): { id: string; name: string; extra: string | null }[] {
    const f = this.raiseForm;
    const q = f?.search.trim().toLowerCase() ?? '';
    const list = this.lookups().people.filter(p => p.id !== this.myId());
    return (q ? list.filter(p => p.name.toLowerCase().includes(q) || (p.extra ?? '').toLowerCase().includes(q)) : list).slice(0, 60);
  }

  pickedPeople(): { id: string; name: string }[] {
    const f = this.raiseForm;
    return f ? this.lookups().people.filter(p => f.picked.has(p.id)) : [];
  }

  togglePerson(id: string): void {
    const f = this.raiseForm;
    if (!f) return;
    if (f.picked.has(id)) f.picked.delete(id);
    else if (f.picked.size < MAX_RESPONDENTS) f.picked.add(id);
  }

  canRaise(): boolean {
    const f = this.raiseForm;
    if (!f || !f.type || f.title.trim().length < 3 || f.description.trim().length < 10) return false;
    if (f.incidentOn && f.incidentOn > this.today) return false;
    const hasUrl = !!f.evidenceUrl.trim();
    if (hasUrl && (!isHttpUrl(f.evidenceUrl) || !f.evidenceTitle.trim())) return false;
    return true;
  }

  sendConcern(): void {
    const f = this.raiseForm;
    if (!f || !this.canRaise()) return;
    const hasUrl = !!f.evidenceUrl.trim();
    this.saving.set(true);
    this.api.raise({
      type: f.type as CaseType, title: f.title.trim(), description: f.description.trim(), incidentOn: f.incidentOn || null,
      location: f.location.trim() || null, respondentIds: [...f.picked], hideIdentity: f.hideIdentity,
      evidenceTitle: hasUrl ? f.evidenceTitle.trim() : null, evidenceUrl: hasUrl ? f.evidenceUrl.trim() : null
    }).subscribe({
      next: id => {
        this.done('relations.msg.raised', { code: f.title.trim() });
        this.setTab('concerns');
        this.loadConcerns();
        this.openConcern(id);
      },
      error: e => this.fail(e)
    });
  }

  openConcern(id: string): void {
    this.resetForms();
    this.concern.set(null);
    this.drawer.set('concern');
    this.api.concern(id).subscribe({
      next: c => this.concern.set(c),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'relations.errors.load');
      }
    });
  }

  private reloadConcern(): void {
    const id = this.concern()?.concern.id;
    if (id) this.api.concern(id).subscribe({ next: c => this.concern.set(c), error: () => undefined });
  }

  sendReply(c: ConcernDetail): void {
    const text = this.replyText.trim();
    if (!text) return;
    this.saving.set(true);
    this.api.concernMessage(c.concern.id, text).subscribe({
      next: () => {
        this.replyText = '';
        this.done('relations.msg.messageSent', { code: c.concern.code });
        this.reloadConcern();
      },
      error: e => this.fail(e)
    });
  }

  startConcernEvidence(): void {
    this.startAct('evidence');
  }

  sendConcernEvidence(c: ConcernDetail): void {
    const f = this.act;
    if (!f || !f.title.trim() || !isHttpUrl(f.url)) return;
    this.saving.set(true);
    this.api.concernEvidence(c.concern.id, f.title.trim(), f.url.trim(), f.note.trim() || null).subscribe({
      next: () => {
        this.cancelAct();
        this.done('relations.msg.evidence', { code: c.concern.code });
        this.reloadConcern();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Stages ─────
  newStage(): void {
    this.resetForms();
    const max = Math.max(0, ...this.lookups().stages.map(s => s.sortOrder));
    this.stageForm = {
      id: null, used: false, name: '', description: '', phase: 'Investigation', sortOrder: max + 1, targetDays: 10, isActive: true
    };
    this.drawer.set('stage');
  }

  editStage(s: Stage): void {
    this.resetForms();
    this.stageForm = {
      id: s.id, used: s.totalCases > 0, name: s.name, description: s.description ?? '', phase: s.phase, sortOrder: s.sortOrder,
      targetDays: s.targetDays, isActive: s.isActive
    };
    this.drawer.set('stage');
  }

  setStagePhase(p: CasePhase): void {
    const f = this.stageForm;
    if (!f) return;
    f.phase = p;
    if (p === 'Closed') f.targetDays = null;
    else if (f.targetDays === null) f.targetDays = 10;
  }

  canSaveStage(): boolean {
    const f = this.stageForm;
    if (!f || !f.name.trim()) return false;
    if (f.phase !== 'Closed' && f.targetDays !== null && (f.targetDays < 1 || f.targetDays > 365)) return false;
    return true;
  }

  saveStage(): void {
    const f = this.stageForm;
    if (!f || !this.canSaveStage()) return;
    const body = {
      name: f.name.trim(), description: f.description.trim() || null, phase: f.phase, sortOrder: Number(f.sortOrder) || 0,
      targetDays: f.phase === 'Closed' ? null : f.targetDays || null, isActive: f.isActive
    };
    this.saving.set(true);
    const call$: Observable<unknown> = f.id ? this.api.updateStage(f.id, body) : this.api.createStage(body);
    call$.subscribe({
      next: () => {
        this.closeDrawer();
        this.done('relations.msg.stageSaved', { code: body.name });
        this.loadLookups();
      },
      error: e => this.fail(e)
    });
  }

  deleteStage(): void {
    const f = this.stageForm;
    if (!f?.id) return;
    if (this.confirm !== 'stage') {
      this.confirm = 'stage';
      return;
    }
    this.saving.set(true);
    this.api.deleteStage(f.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.done('relations.msg.stageDeleted', { code: f.name });
        this.loadLookups();
      },
      error: e => this.fail(e)
    });
  }

  addDefaults(): void {
    this.saving.set(true);
    this.api.defaultStages().subscribe({
      next: n => {
        this.done('relations.msg.defaults', { n });
        this.loadLookups();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Helpers ─────
  private resetForms(): void {
    this.caseForm = null;
    this.raiseForm = null;
    this.stageForm = null;
    this.act = null;
    this.acting = null;
    this.noteText = '';
    this.noteShared = false;
    this.replyText = '';
    this.confirm = null;
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.detail.set(null);
    this.concern.set(null);
    this.accessLog.set(null);
    this.resetForms();
  }

  private done(key: string, params: Record<string, string | number>): void {
    this.saving.set(false);
    this.alert.success(this.translate.instant(key, params));
    this.confirm = null;
    this.refresh();
  }

  private fail(e: unknown, fallback = 'relations.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
