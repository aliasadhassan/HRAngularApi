import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { todayIso } from '../lifecycle/lifecycle.models';
import { PaginationComponent } from '../../shared/pagination/pagination';
import { clientPager } from '../../shared/pagination/client-pager';
import { IncidentFilter, SafetyService } from './safety.service';
import {
  ACTION_CHIP, ACTION_SCOPES, ActionScope, ActionStatus, ENTRY_ICON, INCIDENT_SCOPES, INCIDENT_TYPES, INSPECTION_CHIP, INSPECTION_SCOPES,
  IncidentDetail, IncidentEntry, IncidentListItem, IncidentScope, IncidentStatus, IncidentTreatment, IncidentType, InspectionDetail,
  InspectionListItem, InspectionResult, InspectionScope, MAX_ITEMS, MAX_LOST_DAYS, MyReport, MyReportDetail, NEEDS_PERSON, RESULTS,
  RESULT_ICON, ROOT_CAUSES, RootCauseCategory, SEVERITIES, SEVERITY_CHIP, STATUSES, STATUS_CHIP, SafetyAction, SafetyChecklist,
  SafetyLookups, SafetySeverity, SafetySummary, TREATMENTS, TYPE_ICON, initials, isoToLocal, localToIso
} from './safety.models';

type Tab = 'overview' | 'incidents' | 'actions' | 'inspections' | 'checklists' | 'reports';
type Drawer = 'incident' | 'incidentForm' | 'report' | 'myReport' | 'action' | 'actionForm' | 'inspection' | 'inspectionForm' | 'checklist';
type Section = 'overview' | 'timeline' | 'actions';
type Act = 'status' | 'investigator' | 'rootCause' | 'authority' | 'close' | 'reopen' | 'complete' | 'verify' | 'reject' | 'cancel';

const TABS: readonly Tab[] = ['overview', 'incidents', 'actions', 'inspections', 'checklists', 'reports'];

interface IncidentForm {
  id: string | null;
  title: string;
  description: string;
  type: IncidentType;
  severity: SafetySeverity;
  occurredAt: string;
  locationId: string;
  area: string;
  departmentId: string;
  external: boolean;
  affectedEmployeeId: string;
  affectedName: string;
  treatment: IncidentTreatment | '';
  injuryNature: string;
  bodyPart: string;
  lostDays: number;
  witnesses: string;
  immediateAction: string;
  isReportable: boolean;
  reporterEmployeeId: string;
  investigatorEmployeeId: string;
}

interface ReportForm {
  title: string;
  description: string;
  type: IncidentType | '';
  severity: SafetySeverity;
  occurredAt: string;
  locationId: string;
  area: string;
  who: 'none' | 'me' | 'employee' | 'other';
  affectedEmployeeId: string;
  affectedName: string;
  injuryNature: string;
  bodyPart: string;
  witnesses: string;
  immediateAction: string;
  anonymous: boolean;
}

interface ActionForm {
  id: string | null;
  incidentId: string | null;
  inspectionId: string | null;
  source: string | null;
  title: string;
  description: string;
  assigneeEmployeeId: string;
  priority: SafetySeverity;
  dueOn: string;
}

interface InspectionForm {
  id: string | null;
  title: string;
  checklistId: string;
  inspectorEmployeeId: string;
  locationId: string;
  area: string;
  dueOn: string;
  repeat: boolean;
  repeatDays: number;
}

interface ChecklistForm {
  id: string | null;
  name: string;
  description: string;
  isActive: boolean;
  items: { key: number; text: string }[];
}

interface AnswerRow {
  lineId: string;
  text: string;
  result: InspectionResult | '';
  note: string;
  raise: boolean;
  assigneeEmployeeId: string;
  priority: SafetySeverity;
  dueOn: string;
}

/** Drawer ke andar ek waqt mein ek hi chhota form. */
interface ActForm {
  status: IncidentStatus;
  employeeId: string;
  category: RootCauseCategory | '';
  text: string;
  date: string;
  reference: string;
}

@Component({
  selector: 'app-safety',
  imports: [DatePipe, DecimalPipe, FormsModule, NgTemplateOutlet, TranslatePipe, PaginationComponent],
  templateUrl: './safety.html',
  styleUrl: './safety.css'
})
export class SafetyComponent {
  private readonly api = inject(SafetyService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly today = todayIso();
  readonly nowLocal = isoToLocal(new Date().toISOString());
  readonly types = INCIDENT_TYPES;
  readonly severities = SEVERITIES;
  readonly statuses = STATUSES;
  readonly workStatuses: readonly IncidentStatus[] = ['Investigating', 'ActionPending'];
  readonly treatments = TREATMENTS;
  readonly rootCauses = ROOT_CAUSES;
  readonly results = RESULTS;
  readonly incidentScopes = INCIDENT_SCOPES;
  readonly actionScopes = ACTION_SCOPES;
  readonly inspectionScopes = INSPECTION_SCOPES;
  readonly actionStatuses: readonly ActionStatus[] = ['Open', 'InProgress', 'Done', 'Verified', 'Cancelled'];
  readonly statusChip = STATUS_CHIP;
  readonly severityChip = SEVERITY_CHIP;
  readonly actionChip = ACTION_CHIP;
  readonly inspectionChip = INSPECTION_CHIP;
  readonly typeIcon = TYPE_ICON;
  readonly entryIcon = ENTRY_ICON;
  readonly resultIcon = RESULT_ICON;
  readonly maxLostDays = MAX_LOST_DAYS;
  readonly maxItems = MAX_ITEMS;
  readonly initials = initials;
  readonly sections: readonly Section[] = ['overview', 'timeline', 'actions'];

  readonly tab = signal<Tab>('reports');
  readonly saving = signal(false);
  readonly summary = signal<SafetySummary | null>(null);
  readonly lookups = signal<SafetyLookups>({ people: [], departments: [], locations: [], checklists: [] });

  readonly canManage = computed(() => this.summary()?.canManage ?? false);
  readonly linked = computed(() => !!this.summary()?.myEmployeeId);
  readonly seesIncidents = computed(() => this.canManage() || (this.summary()?.myInvestigations ?? 0) > 0);
  readonly activeChecklists = computed(() => this.lookups().checklists.filter(c => c.isActive));
  readonly visibleTabs = computed<Tab[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return TABS.filter(t => {
      switch (t) {
        case 'overview':
        case 'checklists': return s.canManage;
        case 'incidents': return this.seesIncidents();
        case 'actions':
        case 'inspections': return s.canManage || !!s.myEmployeeId;
        case 'reports': return !!s.myEmployeeId;
      }
    });
  });

  /** Chart ka sab se ooncha mahina (bars isi se scale hoti hain). */
  readonly chartMax = computed(() => Math.max(1, ...(this.summary()?.byMonth ?? []).map(m => m.incidents + m.nearMisses)));
  readonly typeMax = computed(() => Math.max(1, ...(this.summary()?.byType ?? []).map(t => t.count)));

  // ───── Lists ─────
  readonly incidents = signal<IncidentListItem[] | null>(null);
  readonly incidentsPager = clientPager(() => this.incidents() ?? []);
  readonly incidentScope = signal<IncidentScope>('open');
  readonly status = signal<IncidentStatus | ''>('');
  readonly type = signal<IncidentType | ''>('');
  readonly severity = signal<SafetySeverity | ''>('');
  readonly search = signal('');
  private readonly search$ = new Subject<void>();

  readonly actions = signal<SafetyAction[] | null>(null);
  readonly actionScope = signal<ActionScope>('open');
  readonly actionSearch = signal('');
  private readonly actionSearch$ = new Subject<void>();

  readonly inspections = signal<InspectionListItem[] | null>(null);
  readonly inspectionsPager = clientPager(() => this.inspections() ?? []);
  readonly inspectionScope = signal<InspectionScope>('upcoming');

  readonly checklists = signal<SafetyChecklist[] | null>(null);
  readonly reports = signal<MyReport[] | null>(null);

  // ───── Drawers ─────
  readonly drawer = signal<Drawer | null>(null);
  readonly detail = signal<IncidentDetail | null>(null);
  readonly section = signal<Section>('overview');
  readonly myReport = signal<MyReportDetail | null>(null);
  readonly action = signal<SafetyAction | null>(null);
  readonly inspection = signal<InspectionDetail | null>(null);

  incidentForm: IncidentForm | null = null;
  reportForm: ReportForm | null = null;
  actionForm: ActionForm | null = null;
  inspectionForm: InspectionForm | null = null;
  checklistForm: ChecklistForm | null = null;
  answers: AnswerRow[] | null = null;
  answerNotes = '';
  act: ActForm | null = null;
  acting: Act | null = null;
  noteText = '';
  confirm: string | null = null;
  private itemKey = 0;
  private returnTo: 'incident' | 'inspection' | null = null;

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadIncidents());
    this.actionSearch$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadActions());

    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    const wanted = route.get('tab') as Tab | null;
    const incidentId = route.get('incident');

    this.api.summary().subscribe({
      next: s => {
        this.summary.set(s);
        this.loadLookups();
        const tabs = this.visibleTabs();
        const fallback: Tab = s.canManage ? 'overview' : s.myInvestigations ? 'incidents' : 'reports';
        this.setTab(wanted && tabs.includes(wanted) ? wanted : tabs.includes(fallback) ? fallback : (tabs[0] ?? 'reports'));
        if (incidentId && this.seesIncidents()) this.openIncident(incidentId);
      },
      error: e => this.fail(e, 'safety.errors.load')
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'incidents' && this.incidents() === null) {
      if (!this.canManage()) this.incidentScope.set('mine');
      this.loadIncidents();
    }
    if (t === 'actions' && this.actions() === null) {
      if (!this.canManage()) this.actionScope.set('mine');
      this.loadActions();
    }
    if (t === 'inspections' && this.inspections() === null) {
      if (!this.canManage()) this.inspectionScope.set('mine');
      this.loadInspections();
    }
    if (t === 'checklists' && this.checklists() === null) this.loadChecklists();
    if (t === 'reports' && this.reports() === null) this.loadReports();
  }

  // ───── Loading ─────
  private loadLookups(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
  }

  loadIncidents(): void {
    if (!this.seesIncidents()) return;
    const f: IncidentFilter = {
      scope: this.incidentScope(), status: this.status(), type: this.type(), severity: this.severity(), search: this.search()
    };
    this.api.incidents(f).subscribe({ next: l => this.incidents.set(l), error: () => this.incidents.set([]) });
  }

  loadActions(): void {
    this.api.actions(this.actionScope(), '', this.actionSearch()).subscribe({
      next: l => this.actions.set(l),
      error: () => this.actions.set([])
    });
  }

  loadInspections(): void {
    this.api.inspections(this.inspectionScope()).subscribe({ next: l => this.inspections.set(l), error: () => this.inspections.set([]) });
  }

  loadChecklists(): void {
    if (!this.canManage()) return;
    this.api.checklists().subscribe({ next: l => this.checklists.set(l), error: () => this.checklists.set([]) });
  }

  loadReports(): void {
    if (!this.linked()) {
      this.reports.set([]);
      return;
    }
    this.api.myReports().subscribe({ next: l => this.reports.set(l), error: () => this.reports.set([]) });
  }

  private refresh(): void {
    this.api.summary().subscribe({ next: s => this.summary.set(s), error: () => undefined });
    if (this.incidents() !== null) this.loadIncidents();
    if (this.actions() !== null) this.loadActions();
    if (this.inspections() !== null) this.loadInspections();
    if (this.checklists() !== null) this.loadChecklists();
    if (this.reports() !== null) this.loadReports();
  }

  setIncidentScope(v: IncidentScope): void {
    this.incidentScope.set(v);
    this.incidentsPager.reset();
    this.loadIncidents();
  }

  setFilter(which: 'status' | 'type' | 'severity', v: string): void {
    if (which === 'status') this.status.set(v as IncidentStatus | '');
    if (which === 'type') this.type.set(v as IncidentType | '');
    if (which === 'severity') this.severity.set(v as SafetySeverity | '');
    this.incidentsPager.reset();
    this.loadIncidents();
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.incidentsPager.reset();
    this.search$.next();
  }

  setActionScope(v: ActionScope): void {
    this.actionScope.set(v);
    this.loadActions();
  }

  onActionSearch(v: string): void {
    this.actionSearch.set(v);
    this.actionSearch$.next();
  }

  setInspectionScope(v: InspectionScope): void {
    this.inspectionScope.set(v);
    this.inspectionsPager.reset();
    this.loadInspections();
  }

  /** Tally / reminder click: us tab aur scope par le jao. */
  show(t: 'incidents' | 'actions' | 'inspections', scope: string): void {
    if (t === 'incidents') this.incidentScope.set(scope as IncidentScope);
    if (t === 'actions') this.actionScope.set(scope as ActionScope);
    if (t === 'inspections') this.inspectionScope.set(scope as InspectionScope);
    if (t === 'incidents') this.incidentsPager.reset();
    if (t === 'inspections') this.inspectionsPager.reset();
    const loaded = t === 'incidents' ? this.incidents() : t === 'actions' ? this.actions() : this.inspections();
    this.setTab(t);
    if (loaded !== null) {
      if (t === 'incidents') this.loadIncidents();
      if (t === 'actions') this.loadActions();
      if (t === 'inspections') this.loadInspections();
    }
  }

  showReportable(): void {
    this.status.set('');
    this.show('incidents', 'reportable');
  }

  // ───── Display helpers ─────
  dueKey(daysLeft: number): { key: string; n: number } {
    if (daysLeft < 0) return { key: 'safety.overdueBy', n: -daysLeft };
    if (daysLeft === 0) return { key: 'safety.dueToday', n: 0 };
    return { key: daysLeft === 1 ? 'safety.dueTomorrow' : 'safety.dueInDays', n: daysLeft };
  }

  barHeight(n: number): string {
    return `${(n / this.chartMax()) * 100}%`;
  }

  typeOf(key: number): IncidentType {
    return INCIDENT_TYPES[key - 1] ?? 'Other';
  }

  monthDate(m: string): Date {
    return new Date(`${m}-01T00:00:00Z`);
  }

  byLabel(e: IncidentEntry): string {
    if (e.byMe) return this.translate.instant('safety.you');
    return e.byName ?? this.translate.instant('safety.reporterHidden');
  }

  /** Board ka rang: 30+ din = moss, 7+ = brass, warna oxblood. */
  boardTone(days: number | null): string {
    if (days === null || days >= 30) return 'is-good';
    return days >= 7 ? 'is-mid' : 'is-bad';
  }

  stepIndex(s: IncidentStatus): number {
    return STATUSES.indexOf(s);
  }

  scoreTone(score: number | null): string {
    if (score === null) return '';
    return score >= 90 ? 'is-good' : score >= 70 ? 'is-mid' : 'is-bad';
  }

  /** ng-template context typed nahi hota. */
  asActions(v: unknown): SafetyAction[] {
    return v as SafetyAction[];
  }

  // ───── Incident detail ─────
  openIncident(id: string, section: Section = 'overview'): void {
    this.resetForms();
    this.detail.set(null);
    this.section.set(section);
    this.drawer.set('incident');
    this.api.incident(id).subscribe({
      next: d => this.detail.set(d),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'safety.errors.load');
      }
    });
  }

  private reloadIncident(): void {
    const id = this.detail()?.incident.id;
    if (!id || this.drawer() !== 'incident') return;
    this.api.incident(id).subscribe({ next: d => this.detail.set(d), error: () => undefined });
  }

  setSection(s: Section): void {
    this.section.set(s);
    this.cancelAct();
  }

  startAct(a: Act, d?: IncidentDetail): void {
    this.acting = a;
    this.act = {
      status: d?.incident.status === 'Investigating' ? 'ActionPending' : 'Investigating',
      employeeId: d?.incident.investigatorEmployeeId ?? '',
      category: d?.rootCauseCategory ?? '',
      text: a === 'rootCause' ? (d?.rootCause ?? '') : '',
      date: this.today,
      reference: d?.authorityReference ?? ''
    };
  }

  cancelAct(): void {
    this.acting = null;
    this.act = null;
  }

  canSubmitAct(): boolean {
    const f = this.act;
    if (!f || !this.acting) return false;
    switch (this.acting) {
      case 'rootCause': return !!f.category && !!f.text.trim();
      case 'authority': return !!f.date && f.date <= this.today;
      case 'close':
      case 'reopen':
      case 'complete': return !!f.text.trim();
      default: return true;
    }
  }

  submitIncidentAct(d: IncidentDetail): void {
    const f = this.act;
    if (!f || !this.acting || !this.canSubmitAct()) return;
    const id = d.incident.id;
    const text = f.text.trim() || null;
    const calls: Partial<Record<Act, () => Observable<void>>> = {
      status: () => this.api.move(id, f.status, text),
      investigator: () => this.api.investigator(id, f.employeeId || null),
      rootCause: () => this.api.rootCause(id, (f.category || null) as RootCauseCategory | null, text),
      authority: () => this.api.authority(id, f.date, f.reference.trim() || null),
      close: () => this.api.close(id, f.text.trim()),
      reopen: () => this.api.reopen(id, f.text.trim())
    };
    const call = calls[this.acting];
    if (!call) return;
    const key = `safety.msg.${this.acting}`;
    this.saving.set(true);
    call().subscribe({
      next: () => {
        this.cancelAct();
        this.done(key, { code: d.incident.code });
        this.reloadIncident();
      },
      error: e => this.fail(e)
    });
  }

  addNote(d: IncidentDetail): void {
    const text = this.noteText.trim();
    if (!text) return;
    this.saving.set(true);
    this.api.note(d.incident.id, text).subscribe({
      next: () => {
        this.noteText = '';
        this.saving.set(false);
        this.reloadIncident();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Incident form (team) ─────
  newIncident(): void {
    this.resetForms();
    this.incidentForm = {
      id: null, title: '', description: '', type: 'Injury', severity: 'Medium', occurredAt: this.nowLocal, locationId: '', area: '',
      departmentId: '', external: false, affectedEmployeeId: '', affectedName: '', treatment: '', injuryNature: '', bodyPart: '',
      lostDays: 0, witnesses: '', immediateAction: '', isReportable: false, reporterEmployeeId: '', investigatorEmployeeId: ''
    };
    this.drawer.set('incidentForm');
  }

  editIncident(d: IncidentDetail): void {
    const i = d.incident;
    this.resetForms();
    this.incidentForm = {
      id: i.id, title: i.title, description: d.description ?? '', type: i.type, severity: i.severity, occurredAt: isoToLocal(i.occurredAt),
      locationId: d.locationId ?? '', area: i.area ?? '', departmentId: d.departmentId ?? '',
      external: !d.affectedEmployeeId && !!i.affectedName, affectedEmployeeId: d.affectedEmployeeId ?? '',
      affectedName: d.affectedEmployeeId ? '' : (i.affectedName ?? ''), treatment: i.treatment ?? '', injuryNature: d.injuryNature ?? '',
      bodyPart: d.bodyPart ?? '', lostDays: i.lostDays, witnesses: d.witnesses ?? '', immediateAction: d.immediateAction ?? '',
      isReportable: i.isReportable, reporterEmployeeId: '', investigatorEmployeeId: ''
    };
    this.drawer.set('incidentForm');
  }

  needsPerson(t: IncidentType | ''): boolean {
    return !!t && NEEDS_PERSON.includes(t);
  }

  /** Hospital / maut = hamesha reportable (backend bhi yahi karta hai). */
  forcedReportable(f: IncidentForm): boolean {
    return f.treatment === 'Hospitalised' || f.treatment === 'Fatal';
  }

  hasPerson(f: IncidentForm): boolean {
    return f.external ? !!f.affectedName.trim() : !!f.affectedEmployeeId;
  }

  canSaveIncident(): boolean {
    const f = this.incidentForm;
    if (!f || !f.title.trim() || !f.occurredAt) return false;
    if (this.needsPerson(f.type) && !this.hasPerson(f)) return false;
    if (!this.hasPerson(f) && ((f.treatment && f.treatment !== 'None') || f.lostDays > 0)) return false;
    return f.lostDays >= 0 && f.lostDays <= MAX_LOST_DAYS && new Date(f.occurredAt).getTime() <= Date.now() + 5 * 60_000;
  }

  saveIncident(): void {
    const f = this.incidentForm;
    if (!f || !this.canSaveIncident()) return;
    const person = this.hasPerson(f);
    const body = {
      title: f.title.trim(), description: f.description.trim() || null, type: f.type, severity: f.severity,
      occurredAt: localToIso(f.occurredAt), locationId: f.locationId || null, area: f.area.trim() || null,
      departmentId: f.departmentId || null,
      affectedEmployeeId: !f.external && f.affectedEmployeeId ? f.affectedEmployeeId : null,
      affectedName: f.external ? f.affectedName.trim() || null : null,
      treatment: person ? (f.treatment || null) as IncidentTreatment | null : null,
      injuryNature: f.injuryNature.trim() || null, bodyPart: f.bodyPart.trim() || null, lostDays: person ? f.lostDays : 0,
      witnesses: f.witnesses.trim() || null, immediateAction: f.immediateAction.trim() || null,
      isReportable: f.isReportable || this.forcedReportable(f),
      reporterEmployeeId: f.reporterEmployeeId || null, investigatorEmployeeId: f.investigatorEmployeeId || null
    };
    this.saving.set(true);
    if (f.id) {
      const id = f.id;
      this.api.updateIncident(id, body).subscribe({
        next: () => {
          this.done('safety.msg.updated', { title: body.title });
          this.openIncident(id);
        },
        error: e => this.fail(e)
      });
    } else {
      this.api.createIncident(body).subscribe({
        next: id => {
          this.done('safety.msg.created', { title: body.title });
          this.openIncident(id);
        },
        error: e => this.fail(e)
      });
    }
  }

  // ───── Self report ─────
  newReport(): void {
    this.resetForms();
    this.reportForm = {
      title: '', description: '', type: '', severity: 'Low', occurredAt: this.nowLocal, locationId: '', area: '', who: 'none',
      affectedEmployeeId: '', affectedName: '', injuryNature: '', bodyPart: '', witnesses: '', immediateAction: '', anonymous: false
    };
    this.drawer.set('report');
  }

  pickReportType(t: IncidentType): void {
    const f = this.reportForm;
    if (!f) return;
    f.type = t;
    if (this.needsPerson(t) && f.who === 'none') f.who = 'me';
    if (t === 'NearMiss' || t === 'Hazard') f.who = 'none';
  }

  canSendReport(): boolean {
    const f = this.reportForm;
    if (!f || !f.type || !f.title.trim() || !f.occurredAt) return false;
    if (this.needsPerson(f.type) && f.who === 'none') return false;
    if (f.who === 'employee' && !f.affectedEmployeeId) return false;
    if (f.who === 'other' && !f.affectedName.trim()) return false;
    return new Date(f.occurredAt).getTime() <= Date.now() + 5 * 60_000;
  }

  sendReport(): void {
    const f = this.reportForm;
    if (!f || !f.type || !this.canSendReport()) return;
    const me = this.summary()?.myEmployeeId ?? null;
    const affected = f.who === 'me' ? me : f.who === 'employee' ? f.affectedEmployeeId : null;
    const body = {
      title: f.title.trim(), description: f.description.trim() || null, type: f.type, severity: f.severity,
      occurredAt: localToIso(f.occurredAt), locationId: f.locationId || null, area: f.area.trim() || null,
      affectedEmployeeId: affected, affectedName: f.who === 'other' ? f.affectedName.trim() : null,
      injuryNature: f.who === 'none' ? null : f.injuryNature.trim() || null, bodyPart: f.who === 'none' ? null : f.bodyPart.trim() || null,
      witnesses: f.witnesses.trim() || null, immediateAction: f.immediateAction.trim() || null, anonymous: f.anonymous
    };
    this.saving.set(true);
    this.api.report(body).subscribe({
      next: id => {
        this.done('safety.msg.reported', { title: body.title });
        if (this.tab() !== 'reports' && this.visibleTabs().includes('reports')) this.setTab('reports');
        this.openMyReport(id);
      },
      error: e => this.fail(e)
    });
  }

  openMyReport(id: string): void {
    this.resetForms();
    this.myReport.set(null);
    this.drawer.set('myReport');
    this.api.myReport(id).subscribe({
      next: r => this.myReport.set(r),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'safety.errors.load');
      }
    });
  }

  // ───── Actions ─────
  newAction(source?: { incident?: IncidentDetail; inspection?: InspectionDetail }): void {
    const incident = source?.incident;
    const inspection = source?.inspection;
    const back = this.drawer();
    this.resetForms();
    this.actionForm = {
      id: null, incidentId: incident?.incident.id ?? null, inspectionId: inspection?.inspection.id ?? null,
      source: incident?.incident.code ?? inspection?.inspection.code ?? null,
      title: '', description: '', assigneeEmployeeId: '', priority: incident?.incident.severity ?? 'Medium',
      dueOn: this.addDays(14)
    };
    this.returnTo = back === 'incident' || back === 'inspection' ? back : null;
    this.drawer.set('actionForm');
  }

  editAction(a: SafetyAction): void {
    const back = this.drawer();
    this.resetForms();
    this.returnTo = a.incidentId && this.detail()?.incident.id === a.incidentId ? 'incident'
      : a.inspectionId && this.inspection()?.inspection.id === a.inspectionId ? 'inspection' : null;
    if (back !== 'action') this.returnTo = null;
    this.actionForm = {
      id: a.id, incidentId: a.incidentId, inspectionId: a.inspectionId, source: a.incidentCode ?? a.inspectionCode,
      title: a.title, description: a.description ?? '', assigneeEmployeeId: a.assigneeEmployeeId, priority: a.priority, dueOn: a.dueOn
    };
    this.drawer.set('actionForm');
  }

  canSaveAction(): boolean {
    const f = this.actionForm;
    return !!f && !!f.title.trim() && !!f.assigneeEmployeeId && !!f.dueOn && (!!f.id || f.dueOn >= this.today);
  }

  saveAction(): void {
    const f = this.actionForm;
    if (!f || !this.canSaveAction()) return;
    const body = {
      title: f.title.trim(), description: f.description.trim() || null, assigneeEmployeeId: f.assigneeEmployeeId, priority: f.priority,
      dueOn: f.dueOn, incidentId: f.incidentId, inspectionId: f.inspectionId
    };
    const back = this.returnTo;
    const incidentId = f.incidentId;
    const inspectionId = f.inspectionId;
    this.saving.set(true);
    const call = f.id ? this.api.updateAction(f.id, body) : this.api.createAction(body).pipe();
    (call as Observable<unknown>).subscribe({
      next: () => {
        this.done(f.id ? 'safety.msg.actionUpdated' : 'safety.msg.actionAdded', { title: body.title });
        if (back === 'incident' && incidentId) this.openIncident(incidentId, 'actions');
        else if (back === 'inspection' && inspectionId) this.openInspection(inspectionId);
        else this.closeDrawer();
      },
      error: e => this.fail(e)
    });
  }

  openAction(a: SafetyAction): void {
    this.resetForms();
    this.action.set(a);
    this.drawer.set('action');
  }

  startActionAct(a: Act): void {
    this.acting = a;
    this.act = { status: 'Investigating', employeeId: '', category: '', text: '', date: this.today, reference: '' };
  }

  /** Action par seedha kaam (list ya drawer se). */
  progress(a: SafetyAction, what: 'start' | 'complete' | 'verify' | 'reject' | 'cancel'): void {
    const text = this.act?.text.trim() || null;
    if (what === 'complete' && !text) return;
    const calls: Record<typeof what, () => Observable<void>> = {
      start: () => this.api.startAction(a.id),
      complete: () => this.api.completeAction(a.id, text ?? ''),
      verify: () => this.api.verifyAction(a.id, true, null),
      reject: () => this.api.verifyAction(a.id, false, text),
      cancel: () => this.api.cancelAction(a.id, text)
    };
    this.saving.set(true);
    calls[what]().subscribe({
      next: () => {
        this.cancelAct();
        this.done(`safety.msg.action_${what}`, { title: a.title });
        if (this.drawer() === 'action') this.backFromAction(a);
        else {
          this.reloadIncident();
          this.reloadInspection();
        }
      },
      error: e => this.fail(e)
    });
  }

  /** Action drawer incident / inspection se khula ho to wahin wapas. */
  private backFromAction(a: SafetyAction): void {
    if (a.incidentId && this.detail()?.incident.id === a.incidentId) this.openIncident(a.incidentId, 'actions');
    else if (a.inspectionId && this.inspection()?.inspection.id === a.inspectionId) this.openInspection(a.inspectionId);
    else this.closeDrawer();
  }

  // ───── Inspections ─────
  newInspection(): void {
    this.resetForms();
    const first = this.activeChecklists()[0];
    this.inspectionForm = {
      id: null, title: first?.name ?? '', checklistId: first?.id ?? '', inspectorEmployeeId: '', locationId: '', area: '',
      dueOn: this.addDays(7), repeat: false, repeatDays: 30
    };
    this.drawer.set('inspectionForm');
  }

  editInspection(d: InspectionDetail): void {
    const i = d.inspection;
    this.resetForms();
    this.inspectionForm = {
      id: i.id, title: i.title, checklistId: i.checklistId ?? '', inspectorEmployeeId: i.inspectorEmployeeId, locationId: d.locationId ?? '',
      area: i.area ?? '', dueOn: i.dueOn < this.today ? this.today : i.dueOn, repeat: i.repeatDays !== null, repeatDays: i.repeatDays ?? 30
    };
    this.drawer.set('inspectionForm');
  }

  pickChecklist(id: string): void {
    const f = this.inspectionForm;
    if (!f) return;
    const old = this.lookups().checklists.find(c => c.id === f.checklistId);
    if (!f.title.trim() || f.title === old?.name) f.title = this.lookups().checklists.find(c => c.id === id)?.name ?? f.title;
    f.checklistId = id;
  }

  canSaveInspection(): boolean {
    const f = this.inspectionForm;
    return !!f && !!f.title.trim() && !!f.checklistId && !!f.inspectorEmployeeId && !!f.dueOn && f.dueOn >= this.today
      && (!f.repeat || (f.repeatDays >= 7 && f.repeatDays <= 365));
  }

  saveInspection(): void {
    const f = this.inspectionForm;
    if (!f || !this.canSaveInspection()) return;
    const body = {
      title: f.title.trim(), checklistId: f.checklistId, inspectorEmployeeId: f.inspectorEmployeeId, locationId: f.locationId || null,
      area: f.area.trim() || null, dueOn: f.dueOn, repeatDays: f.repeat ? f.repeatDays : null
    };
    this.saving.set(true);
    if (f.id) {
      const id = f.id;
      this.api.reschedule(id, body).subscribe({
        next: () => {
          this.done('safety.msg.rescheduled', { title: body.title });
          this.openInspection(id);
        },
        error: e => this.fail(e)
      });
    } else {
      this.api.schedule(body).subscribe({
        next: id => {
          this.done('safety.msg.scheduled', { title: body.title });
          this.openInspection(id);
        },
        error: e => this.fail(e)
      });
    }
  }

  openInspection(id: string): void {
    this.resetForms();
    this.inspection.set(null);
    this.drawer.set('inspection');
    this.api.inspection(id).subscribe({
      next: d => this.inspection.set(d),
      error: e => {
        this.closeDrawer();
        this.fail(e, 'safety.errors.load');
      }
    });
  }

  private reloadInspection(): void {
    const id = this.inspection()?.inspection.id;
    if (!id || this.drawer() !== 'inspection') return;
    this.api.inspection(id).subscribe({ next: d => this.inspection.set(d), error: () => undefined });
  }

  startInspection(d: InspectionDetail): void {
    this.answers = d.lines.map(l => ({
      lineId: l.id, text: l.text, result: '', note: '', raise: false, assigneeEmployeeId: '', priority: 'Medium', dueOn: this.addDays(14)
    }));
    this.answerNotes = '';
  }

  setAll(result: InspectionResult): void {
    for (const a of this.answers ?? []) if (!a.result) a.result = result;
  }

  answered(): number {
    return (this.answers ?? []).filter(a => !!a.result).length;
  }

  liveScore(): number | null {
    const rows = this.answers ?? [];
    const pass = rows.filter(a => a.result === 'Pass').length;
    const fail = rows.filter(a => a.result === 'Fail').length;
    return pass + fail ? Math.round((1000 * pass) / (pass + fail)) / 10 : null;
  }

  canFinish(): boolean {
    const rows = this.answers;
    return !!rows && rows.every(a => !!a.result
      && (a.result !== 'Fail' || !!a.note.trim())
      && (!a.raise || (a.result === 'Fail' && !!a.assigneeEmployeeId && a.dueOn >= this.today)));
  }

  finishInspection(d: InspectionDetail): void {
    const rows = this.answers;
    if (!rows || !this.canFinish()) return;
    const answers = rows.map(a => ({
      lineId: a.lineId, result: a.result as InspectionResult, note: a.note.trim() || null,
      action: a.raise && a.result === 'Fail' ? { assigneeEmployeeId: a.assigneeEmployeeId, priority: a.priority, dueOn: a.dueOn, title: null } : null
    }));
    this.saving.set(true);
    this.api.completeInspection(d.inspection.id, answers, this.answerNotes.trim() || null).subscribe({
      next: r => {
        this.answers = null;
        this.done(r.nextInspectionCode ? 'safety.msg.completedNext' : 'safety.msg.completed', {
          code: d.inspection.code, n: r.actionsCreated, next: r.nextInspectionCode ?? '', due: r.nextDueOn ?? ''
        });
        this.openInspection(d.inspection.id);
      },
      error: e => this.fail(e)
    });
  }

  cancelInspection(d: InspectionDetail): void {
    if (this.confirm !== 'cancelInspection') {
      this.confirm = 'cancelInspection';
      return;
    }
    this.saving.set(true);
    this.api.cancelInspection(d.inspection.id, null).subscribe({
      next: () => {
        this.done('safety.msg.inspectionCancelled', { code: d.inspection.code });
        this.openInspection(d.inspection.id);
      },
      error: e => this.fail(e)
    });
  }

  // ───── Checklists ─────
  newChecklist(): void {
    this.resetForms();
    this.checklistForm = { id: null, name: '', description: '', isActive: true, items: [this.item(''), this.item('')] };
    this.drawer.set('checklist');
  }

  editChecklist(c: SafetyChecklist): void {
    this.resetForms();
    this.checklistForm = {
      id: c.id, name: c.name, description: c.description ?? '', isActive: c.isActive, items: c.items.map(t => this.item(t))
    };
    this.drawer.set('checklist');
  }

  private item(text: string): { key: number; text: string } {
    return { key: ++this.itemKey, text };
  }

  addItem(): void {
    if (this.checklistForm && this.checklistForm.items.length < MAX_ITEMS) this.checklistForm.items.push(this.item(''));
  }

  removeItem(i: number): void {
    this.checklistForm?.items.splice(i, 1);
  }

  moveItem(i: number, by: -1 | 1): void {
    const items = this.checklistForm?.items;
    if (!items || i + by < 0 || i + by >= items.length) return;
    [items[i], items[i + by]] = [items[i + by]!, items[i]!];
  }

  checklistItems(): string[] {
    return (this.checklistForm?.items ?? []).map(i => i.text.trim()).filter(Boolean);
  }

  hasDuplicateItems(): boolean {
    const items = this.checklistItems().map(t => t.toLowerCase());
    return new Set(items).size !== items.length;
  }

  canSaveChecklist(): boolean {
    const f = this.checklistForm;
    const n = this.checklistItems().length;
    return !!f && !!f.name.trim() && n > 0 && n <= MAX_ITEMS && !this.hasDuplicateItems();
  }

  saveChecklist(): void {
    const f = this.checklistForm;
    if (!f || !this.canSaveChecklist()) return;
    const body = { name: f.name.trim(), description: f.description.trim() || null, isActive: f.isActive, items: this.checklistItems() };
    this.saving.set(true);
    const call: Observable<unknown> = f.id ? this.api.updateChecklist(f.id, body) : this.api.createChecklist(body);
    call.subscribe({
      next: () => {
        this.done('safety.msg.checklistSaved', { name: body.name });
        this.closeDrawer();
        this.loadLookups();
      },
      error: e => this.fail(e)
    });
  }

  deleteChecklist(): void {
    const f = this.checklistForm;
    if (!f?.id) return;
    if (this.confirm !== 'deleteChecklist') {
      this.confirm = 'deleteChecklist';
      return;
    }
    this.saving.set(true);
    this.api.deleteChecklist(f.id).subscribe({
      next: () => {
        this.done('safety.msg.checklistDeleted', { name: f.name });
        this.closeDrawer();
        this.loadLookups();
      },
      error: e => this.fail(e)
    });
  }

  addSamples(): void {
    this.saving.set(true);
    this.api.sampleChecklists().subscribe({
      next: n => {
        this.done('safety.msg.samples', { n });
        this.loadLookups();
        if (this.checklists() === null) this.loadChecklists();
      },
      error: e => this.fail(e)
    });
  }

  // ───── Helpers ─────
  private addDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private resetForms(): void {
    this.incidentForm = null;
    this.reportForm = null;
    this.actionForm = null;
    this.inspectionForm = null;
    this.checklistForm = null;
    this.answers = null;
    this.answerNotes = '';
    this.act = null;
    this.acting = null;
    this.noteText = '';
    this.confirm = null;
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.detail.set(null);
    this.myReport.set(null);
    this.action.set(null);
    this.inspection.set(null);
    this.returnTo = null;
    this.resetForms();
  }

  private done(key: string, params: Record<string, string | number>): void {
    this.saving.set(false);
    this.alert.success(this.translate.instant(key, params));
    this.confirm = null;
    this.refresh();
  }

  private fail(e: unknown, fallback = 'safety.errors.save'): void {
    this.saving.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(fallback)));
  }
}
